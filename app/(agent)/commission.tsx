import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Progress from "react-native-progress";
import BackgroundLogo from "../../components/BackgroundLogo";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../constants/memorialTheme";
import { useToast } from "../../components/ToastProvider";

// ========================================
// 🔵 TYPE DEFINITIONS
// ========================================
interface CommissionRollup {
  id: number;
  agent_id: number;
  period_year: number;
  period_month: number;
  monthly_commission: number;
  membership_commission: number;
  override_commission: number;
  recruiter_bonus: number;
  grand_total_commission: number;
  total_collection: number;
  status: string;
  corrected_total?: number;
}

interface LatestPeriod {
  month: number;
  year: number;
}

interface CollectionRow {
  id: number;
  date_paid: string;
  or_no: string | null;
  payment_for: string | null;
  payment: number;
  member_id: number | null;
  members?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

// ========================================

const { width } = Dimensions.get("window");
const scale = width < 420 ? width / 390 : 1;
const s = (n: number): number => Math.round(n * scale);

const peso = (n: number): string =>
  `₱${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const MONTHS = [
  { name: "January", value: 1 },
  { name: "February", value: 2 },
  { name: "March", value: 3 },
  { name: "April", value: 4 },
  { name: "May", value: 5 },
  { name: "June", value: 6 },
  { name: "July", value: 7 },
  { name: "August", value: 8 },
  { name: "September", value: 9 },
  { name: "October", value: 10 },
  { name: "November", value: 11 },
  { name: "December", value: 12 },
];

// Cutoff helper: selected month → 7th to next 7th (same as Electron)
// Cutoff helper: selected month → 6th to next month 7th
function cutoffRange(year: number, month: number) {
  const Y = Number(year);
  const M = Number(month); // 1–12

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  // Start = 7th of selected month
  const start = new Date(Y, M - 1, 7);

  // End = 7th of next month
  const end = new Date(Y, M, 7);

  return { gte: fmt(start), lt: fmt(end), start, end };
}


export default function AgentCommissions() {
  const [data, setData] = useState<CommissionRollup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [month, setMonth] = useState<number>(0);
  const [year, setYear] = useState<number>(0);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [agentId, setAgentId] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [canWithdraw, setCanWithdraw] = useState<boolean>(false);
  const [lifetimeTotal, setLifetimeTotal] = useState<number>(0);
  const [latestPeriod, setLatestPeriod] = useState<LatestPeriod | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [showCollections, setShowCollections] = useState<boolean>(true);
  const [customAmount, setCustomAmount] = useState<string>("");
  const { showToast } = useToast();

  // ========================================
  // 🔵 INITIAL LOAD
  // ========================================
  useEffect(() => {
    (async () => {
      const { data: latest } = await supabase
        .from("agent_commission_rollups")
        .select("period_month, period_year")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();

      if (latest) {
        setMonth(latest.period_month);
        setYear(latest.period_year);
        setLatestPeriod({
          month: latest.period_month,
          year: latest.period_year,
        });
      } else {
        setMonth(now.getMonth() + 1);
        setYear(now.getFullYear());
      }

      // Robust Agent ID Retrieval
      const { data: sessionData } = await supabase.auth.getUser();
      const user_id = sessionData?.user?.id;

      let finalAgentId = null;

      // 1. Try Storage
      const cached = await AsyncStorage.getItem("agent_id");
      if (cached) {
        finalAgentId = Number(cached);
      } else if (user_id) {
        // 2. Try DB
        const { data: profile } = await supabase
          .from("users_profile")
          .select("agent_id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (profile?.agent_id) {
          finalAgentId = profile.agent_id;
          await AsyncStorage.setItem("agent_id", String(finalAgentId));
        }
      }

      console.log("Initialized Commission Page. Agent ID:", finalAgentId);
      setAgentId(finalAgentId);

      setIsInitializing(false);
    })();
  }, []);

  // ========================================
  // 🔵 FETCH COMMISSIONS + WALLET + COLLECTIONS
  // ========================================
  useEffect(() => {
    if (agentId && month > 0 && year > 0) {
      fetchCommissions();
    }
  }, [agentId, month, year]);

  async function fetchCommissions() {
    if (!agentId) return;
    setLoading(true);

    try {
      // 0) Determine cutoff range (same as Electron)
      const { gte, lt } = cutoffRange(year, month);

      // 1) Fetch exact rollup for this period (for status only)
      const { data: rollup } = await supabase
        .from("agent_commission_rollups")
        .select("*")
        .eq("agent_id", agentId)
        .eq("period_month", month)
        .eq("period_year", year)
        .maybeSingle();

      // 1.1) Fetch raw commissions for calculation (Desktop Parity)
      // Added: is_receivable
      console.log("Fetching commissions for:", { agentId, gte, lt });
      const { data: rawComms, error: commError } = await supabase
        .from("commissions")
        .select("amount, commission_type, agent_id, override_commission, is_receivable")
        .gte("date_earned", gte)
        .lt("date_earned", lt);

      if (commError) console.error("Error fetching commissions:", commError);

      // 1.2) Calculate totals clientside (STRICT DESKTOP LOGIC)
      let calcMonthly = 0;
      let calcTravel = 0; // New bucket from desktop
      let calcOutright = 0;
      let calcOverrides = 0;
      let calcRecruiter = 0;

      let calcReceivable = 0;
      let calcNonReceivable = 0;
      let calcTotal = 0;

      (rawComms || []).forEach((c: any) => {
        if (c.agent_id !== agentId) return;

        const amount = Number(c.amount || 0);
        const overrideAmount = Number(c.override_commission || 0);
        const type = String(c.commission_type || "");
        const isReceivable = c.is_receivable === true;

        // RULE 5: OVERRIDES
        if (type === "override" || type.startsWith("override_")) {
          const val = (overrideAmount !== 0) ? overrideAmount : amount;
          calcOverrides += val;
          calcTotal += val;
          calcReceivable += val; // Always Receivable
          return;
        }

        // RULE 6: RECRUITER BONUS
        if (type === "recruiter_bonus") {
          calcRecruiter += amount;
          calcTotal += amount;
          calcReceivable += amount; // Always Receivable
          return;
        }

        // RULE 3: MONTHLY COMMISSION
        if (type === "plan_monthly" || type === "monthly") {
          calcMonthly += amount;
          calcTotal += amount;
          if (isReceivable) calcReceivable += amount;
          else calcNonReceivable += amount;
          return;
        }

        // RULE 4: TRAVEL ALLOWANCE
        if (type === "travel_allowance") {
          calcTravel += amount;
          calcTotal += amount;
          if (isReceivable) calcReceivable += amount;
          else calcNonReceivable += amount;
          return;
        }

        // RULE 7: OUTRIGHT (Membership)
        if (type === "membership_outright" || type.includes("membership")) {
          calcOutright += amount;
          calcTotal += amount;
          if (isReceivable) calcReceivable += amount;
          else calcNonReceivable += amount;
          return;
        }

        // Fallback
        calcTotal += amount;
        if (isReceivable) calcReceivable += amount;
        else calcNonReceivable += amount;
      });

      // 1.3) Construct the display object
      // Note: mapping 'travel' + 'monthly' back to 'monthly_commission' to avoid breaking existing UI types immediately,
      // BUT likely we should expose them if the UI tracks them.
      // For now, I will map the calculated values to the existing rollup structure as best as possible.
      // The user wants 'Desktop Parity', so I should probably update the UI to show these specific breakdowns too.
      // Let's store them in the state or extended rollup.

      const calculatedRollup: CommissionRollup = {
        id: rollup?.id ?? 0,
        agent_id: agentId,
        period_year: year,
        period_month: month,
        monthly_commission: calcMonthly,    // Matches 'Monthly' in desktop
        membership_commission: calcOutright,// Matches 'Outright' in desktop
        override_commission: calcOverrides, // Matches 'Overrides' in desktop
        recruiter_bonus: calcRecruiter,     // Matches 'Recruiter' in desktop
        grand_total_commission: calcTotal,  // Matches 'Total Earned'
        total_collection: 0,
        status: rollup?.status ?? "unreleased",
        corrected_total: calcTotal,

        // Extended properties for the UI (we'll need to cast or extend the type if we want to be strict TS, 
        // but for now we can attach them effectively)
        travel_allowance: calcTravel,
        receivable: calcReceivable,
        non_receivable: calcNonReceivable
      } as any; // Type assertion to allow new fields temporarily

      setData([calculatedRollup]);

      // 2) Lifetime commission (Now stored in DB)
      // The trigger automatically updates agent_wallets.lifetime_commission
      // We'll fetch it in the wallet query below.
      // const { data: lifetimeRows } = await supabase... (REMOVED MANUAL CALC)

      // 3) Eligibility (Rule A OR Rule B using same-member logic)
      const { data: allColls } = await supabase
        .from("collections")
        .select("member_id, is_membership_fee, payment_for, payment")
        .eq("agent_id", agentId)
        .gte("date_paid", gte)
        .lt("date_paid", lt);

      const list = allColls || [];

      // Calculate total collection client-side
      const totalColl = list.reduce((sum, item) => sum + (Number(item.payment) || 0), 0);

      // Update the data object with total collection
      setData(prev => {
        if (!prev[0]) return prev;
        return [{ ...prev[0], total_collection: totalColl }];
      });

      // ---------- RULE A ----------
      const membershipCount = list.filter(x => x.is_membership_fee === true).length;
      setActiveCount(membershipCount); // progress bar update
      const ruleA = membershipCount >= 3;

      // ---------- RULE B (same member must pay membership + regular) ----------
      const memberMap: Record<number, any[]> = {};
      for (const p of list) {
        if (!p.member_id) continue;
        if (!memberMap[p.member_id]) memberMap[p.member_id] = [];
        memberMap[p.member_id].push(p);
      }

      let ruleB = false;
      for (const memberId in memberMap) {
        const payments = memberMap[memberId];

        const hasMembership = payments.some(p => p.is_membership_fee === true);
        const hasRegular = payments.some(
          p => p.is_membership_fee === false && p.payment_for === "regular"
        );

        if (hasMembership && hasRegular) {
          ruleB = true;
          break;
        }
      }

      // ---------- FINAL ELIGIBILITY ----------
      const eligibleNextMonth = ruleA || ruleB;
      setCanWithdraw(eligibleNextMonth);

      console.log("Eligibility:", { ruleA, ruleB, eligibleNextMonth });



      // 4) Collections list for this cutoff (exactly like Electron, then enrich with member names)
      const { data: colls, error: collErr } = await supabase
        .from("collections")
        .select("id, date_paid, or_no, payment_for, payment, member_id")
        .eq("agent_id", agentId)
        .gte("date_paid", gte)
        .lt("date_paid", lt)
        .order("date_paid", { ascending: true });

      if (collErr) {
        console.error("Collections error:", collErr);
        setCollections([]);
      } else {
        const raw = (colls as any[]) || [];

        const memberIds = Array.from(
          new Set(
            raw
              .map((c) => c.member_id)
              .filter((id: any) => id !== null && id !== undefined)
          )
        ) as number[];

        let membersById: Record<
          number,
          { first_name: string | null; last_name: string | null }
        > = {};

        if (memberIds.length > 0) {
          const { data: members, error: memErr } = await supabase
            .from("members")
            .select("id, first_name, last_name")
            .in("id", memberIds);

          if (memErr) {
            console.error("Members lookup error:", memErr);
          } else {
            membersById = {};
            (members as any[]).forEach((m: any) => {
              membersById[m.id] = {
                first_name: m.first_name ?? null,
                last_name: m.last_name ?? null,
              };
            });
          }
        }

        const fixed: CollectionRow[] = raw.map((c: any) => ({
          id: c.id,
          date_paid: c.date_paid,
          or_no: c.or_no,
          payment_for: c.payment_for,
          payment: c.payment,
          member_id: c.member_id,
          members:
            c.member_id && membersById[c.member_id]
              ? membersById[c.member_id]
              : null,
        }));

        setCollections(fixed);
      }

      // 5) Wallet / withdrawable balance + LIFETIME COMMISSION
      const { data: wallet, error: wErr } = await supabase
        .from("agent_wallets")
        .select("balance, lifetime_commission") // Added lifetime_commission
        .eq("agent_id", agentId)
        .maybeSingle();

      if (wErr) {
        console.error("Error loading wallet:", wErr);
        setWalletBalance(0);
        setLifetimeTotal(0);
        setCanWithdraw(false);
      } else {
        const bal = Number(wallet?.balance || 0);
        const life = Number(wallet?.lifetime_commission || 0);

        setWalletBalance(bal);
        setLifetimeTotal(life);

        setCanWithdraw(bal >= 500); // rule: at least ₱500 to withdraw
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  // ========================================
  // 🔵 REALTIME AUTO UPDATE
  // ========================================
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel("agent-rollup-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_commission_rollups",
          filter: `agent_id=eq.${agentId}`,
        },
        async () => {
          console.log("🔵 LIVE UPDATE RECEIVED → REFRESHING...");
          await fetchCommissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, month, year]);

  // ========================================
  // 🔵 REFRESH (MANUAL)
  // ========================================
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCommissions();
    setRefreshing(false);
  };

  // ========================================
  // 🔵 WITHDRAW (wallet-based, all/custom, like Electron)
  // ========================================
  async function handleWithdraw(mode: "all" | "custom") {
    if (!agentId) return;

    const currentBal = walletBalance;

    if (currentBal < 500) {
      Alert.alert(
        "Withdrawal Unavailable",
        "You can withdraw once your Withdrawable Balance reaches at least ₱500.00."
      );
      return;
    }

    let amount = 0;

    if (mode === "all") {
      amount = currentBal;
    } else {
      amount = Number(customAmount || 0);
      if (!amount || amount <= 0) {
        Alert.alert("Invalid Amount", "Please enter a valid amount.");
        return;
      }
      if (amount < 500) {
        Alert.alert(
          "Minimum Amount",
          "Minimum withdrawal per transaction is ₱500.00."
        );
        return;
      }
      if (amount > currentBal) {
        Alert.alert(
          "Too High",
          `Requested amount is higher than your Withdrawable Balance (${peso(
            currentBal
          )}).`
        );
        return;
      }
    }

    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw ${peso(amount)} from your Withdrawable Balance?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.rpc("withdraw_commission", {
              p_agent_id: agentId,
              p_amount: amount,
            });

            if (error) {
              console.error(error);
              Alert.alert(
                "Error",
                "Failed to process withdrawal. Please try again."
              );
            } else {
              setCustomAmount("");
              await fetchCommissions();

              showToast('success', 'Request Sent', `Withdrawal of ${peso(amount)} is now pending.`);
            }
          },
        },
      ]
    );
  }

  // ========================================
  // UI
  // ========================================
  if (isInitializing)
    return (
      <BackgroundLogo>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007aff" />
        </View>
      </BackgroundLogo>
    );

  const r = data[0];
  const correctedTotal = r?.corrected_total ?? 0;

  return (
    <BackgroundLogo>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "center", paddingBottom: memorialSpacing.tabBarHeight }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.innerContainer}>
          {/* HEADER */}
          <View style={styles.topBar}>
            <Text style={styles.header}>My Commission</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={fetchCommissions}>
              <Text style={styles.actionText}>🔄</Text>
            </TouchableOpacity>
          </View>

          {/* PICKERS */}
          <View style={styles.filterWrapper}>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={month}
                onValueChange={(v) => setMonth(Number(v))}
              >
                {MONTHS.map((m) => (
                  <Picker.Item key={m.value} label={m.name} value={m.value} />
                ))}
              </Picker>
            </View>

            <View style={styles.pickerBox}>
              <Picker
                selectedValue={year}
                onValueChange={(v) => setYear(Number(v))}
              >
                {[2024, 2025, 2026].map((y) => (
                  <Picker.Item key={y} label={`${y}`} value={y} />
                ))}
              </Picker>
            </View>
          </View>

          {/* 🎨 ENHANCED: Professional AGR Requirements Card */}
          <View style={styles.requirementsCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderIcon}>📋</Text>
              <Text style={styles.cardHeaderTitle}>AGR Requirements</Text>
            </View>
            <View style={styles.cardDivider} />

            <View style={styles.requirementItem}>
              <Text style={styles.requirementBullet}>•</Text>
              <Text style={styles.requirementText}>
                Have 3 card members OR 1 new member who pays Membership Fee + first MLAP payment
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>✓</Text>
              <Text style={styles.infoText}>
                Complete AGR Requirements to automatically access your withdrawable commission
              </Text>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠</Text>
              <Text style={styles.warningText}>
                Minimum withdrawal: ₱500.00
              </Text>
            </View>
          </View>

          {/* 🎨 ENHANCED: Professional Commission Summary */}
          {r ? (
            <View style={styles.summaryCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderIcon}>💰</Text>
                <Text style={styles.cardHeaderTitle}>Commission Breakdown</Text>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Monthly Commission</Text>
                <Text style={styles.commissionValue}>{peso(r.monthly_commission)}</Text>
              </View>

              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Travelling Allowance</Text>
                <Text style={styles.commissionValue}>{peso((r as any).travel_allowance || 0)}</Text>
              </View>

              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Outright Commission</Text>
                <Text style={styles.commissionValue}>{peso(r.membership_commission)}</Text>
              </View>

              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Override Commission</Text>
                <Text style={styles.commissionValue}>{peso(r.override_commission)}</Text>
              </View>

              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Recruiter Bonus</Text>
                <Text style={styles.commissionValue}>{peso(r.recruiter_bonus)}</Text>
              </View>

              <View style={styles.totalDivider} />

              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalValue}>{peso(correctedTotal)}</Text>
              </View>

              {/* NEW: Classification Breakdown from Desktop */}
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.cardHeaderTitle, { fontSize: 14, marginBottom: 8 }]}>Classification</Text>

                <View style={styles.commissionRow}>
                  <Text style={[styles.commissionLabel, { color: '#94a3b8' }]}>Receivable (Unpaid + OR)</Text>
                  <Text style={[styles.commissionValue, { color: '#4ade80' }]}>{peso((r as any).receivable || 0)}</Text>
                </View>
                <View style={styles.commissionRow}>
                  <Text style={[styles.commissionLabel, { color: '#94a3b8' }]}>Non-Receivable (Paid)</Text>
                  <Text style={[styles.commissionValue, { color: '#64748b' }]}>{peso((r as any).non_receivable || 0)}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Total Collection</Text>
                  <Text style={styles.metaValue}>{peso(r.total_collection)}</Text>
                </View>
                {/* 
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Text style={[styles.metaValue, styles.statusBadge]}>{r.status}</Text>
                </View> 
                */}
              </View>
            </View>
          ) : (
            <Text>No commission records.</Text>
          )}

          {/* COLLECTIONS (matching Electron) */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.collectionsHeader}
              onPress={() => setShowCollections((prev) => !prev)}
            >
              <Text style={styles.agentName}>Collections</Text>
              <Text style={styles.caret}>{showCollections ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showCollections && (
              <View style={{ marginTop: s(8) }}>
                <View style={styles.collectionHeaderRow}>
                  <Text style={[styles.collectionHeaderText, { flex: 1.2 }]}>
                    Date
                  </Text>
                  <Text style={[styles.collectionHeaderText, { flex: 0.9 }]}>
                    OR No
                  </Text>
                  <Text style={[styles.collectionHeaderText, { flex: 1.6 }]}>
                    Member
                  </Text>
                  <Text style={[styles.collectionHeaderText, { flex: 1 }]}>
                    For
                  </Text>
                  <Text
                    style={[
                      styles.collectionHeaderText,
                      { flex: 1, textAlign: "right" },
                    ]}
                  >
                    Amount
                  </Text>
                </View>

                {collections.length === 0 ? (
                  <Text style={styles.collectionEmpty}>
                    No collections for this cutoff period.
                  </Text>
                ) : (
                  collections.map((c) => {
                    const m = c.members;
                    const memberName =
                      m && (m.last_name || m.first_name)
                        ? `${(m.last_name || "").toUpperCase()}, ${m.first_name || ""
                        }`
                        : c.member_id
                          ? `Member #${c.member_id}`
                          : "Unknown";

                    const dateLabel = c.date_paid
                      ? new Date(c.date_paid).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                      : "";

                    return (
                      <View key={c.id} style={styles.collectionRow}>
                        <Text style={[styles.collectionCell, { flex: 1.2 }]}>
                          {dateLabel}
                        </Text>
                        <Text style={[styles.collectionCell, { flex: 0.9 }]}>
                          {c.or_no || ""}
                        </Text>
                        <Text style={[styles.collectionCell, { flex: 1.6 }]}>
                          {memberName}
                        </Text>
                        <Text style={[styles.collectionCell, { flex: 1 }]}>
                          {c.payment_for || ""}
                        </Text>
                        <Text
                          style={[
                            styles.collectionCell,
                            { flex: 1, textAlign: "right" },
                          ]}
                        >
                          {peso(c.payment)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* OVERALL SUMMARY + WALLET / WITHDRAW (Electron-like) */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Overall Summary</Text>

            <Text>Total Collection: {peso(r?.total_collection || 0)}</Text>
            <Text style={styles.summaryTotal}>
              Total Commission (This Month): {peso(correctedTotal)}
            </Text>

            <Text style={{ fontWeight: "700", marginTop: 10 }}>
              Lifetime Accumulated Commission (Not Withdrawable): {peso(lifetimeTotal)}
            </Text>

            <Text style={{ fontWeight: "700", marginTop: 6 }}>
              Withdrawable Balance: {peso(walletBalance)}
            </Text>

            {/* Withdraw controls like Electron */}
            <View style={styles.withdrawRow}>
              <TouchableOpacity
                style={[
                  styles.withdrawBtnSmall,
                  { backgroundColor: canWithdraw ? "#16a34a" : "#9ca3af" },
                ]}
                disabled={!canWithdraw}
                onPress={() => handleWithdraw("all")}
              >
                <Text style={styles.withdrawSmallTxt}>Withdraw All</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.amountInput}
                placeholder="Custom amount"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={customAmount}
                onChangeText={setCustomAmount}
              />

              <TouchableOpacity
                style={[
                  styles.withdrawBtnSmall,
                  { backgroundColor: canWithdraw ? "#0ea5e9" : "#9ca3af" },
                ]}
                disabled={!canWithdraw}
                onPress={() => handleWithdraw("custom")}
              >
                <Text style={styles.withdrawSmallTxt}>Withdraw Custom</Text>
              </TouchableOpacity>
            </View>

            {!canWithdraw && (
              <Text style={styles.motivation}>
                💡 You can withdraw once your Withdrawable Balance reaches at
                least ₱500.00.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </BackgroundLogo>
  );
}

// ========================================
// 💎 LUXURIOUS STYLES
// ========================================
const styles = StyleSheet.create({
  innerContainer: { width: "100%", maxWidth: 480 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // 💎 LUXURIOUS: Premium header
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: s(16),
    backgroundColor: memorialColors.primary,
    borderRadius: memorialBorderRadius.xl,
    marginTop: s(10),
    marginBottom: s(10),
    ...memorialShadows.xl,
    borderWidth: 2,
    borderColor: memorialColors.gold,
  },
  header: {
    fontSize: s(24),
    fontWeight: memorialFonts.bold,
    color: memorialColors.white,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  actionBtn: {
    backgroundColor: memorialColors.gold,
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    justifyContent: "center",
    alignItems: "center",
    ...memorialShadows.gold,
  },
  actionText: {
    color: memorialColors.black,
    fontSize: s(22),
    fontWeight: memorialFonts.bold,
  },

  // 🎨 VISUAL: Peaceful filter wrapper
  filterWrapper: {
    flexDirection: "row",
    backgroundColor: memorialColors.bgCard,
    padding: s(8),
    borderRadius: memorialBorderRadius.lg,
    ...memorialShadows.sm,
    borderWidth: 1,
    borderColor: memorialColors.borderLight,
  },
  pickerBox: {
    flex: 1,
    backgroundColor: memorialColors.cream,
    borderRadius: memorialBorderRadius.md,
    borderWidth: 1,
    borderColor: memorialColors.border,
    marginHorizontal: s(5), // Replaces gap
  },

  // 🎨 VISUAL: Gentle progress card
  progressCard: {
    backgroundColor: memorialColors.bgCard,
    padding: s(12),
    borderRadius: memorialBorderRadius.lg,
    marginTop: s(10),
    ...memorialShadows.md,
    borderWidth: 1,
    borderColor: memorialColors.borderLight,
  },
  progressTitle: {
    fontWeight: memorialFonts.semibold,
    marginBottom: s(6),
    color: memorialColors.primary,
    fontSize: s(16),
  },
  progressText: {
    textAlign: "right",
    marginTop: s(4),
    fontSize: s(12),
    color: memorialColors.textSecondary,
  },

  // 💎 LUXURIOUS: Premium commission cards
  card: {
    backgroundColor: memorialColors.white,
    padding: s(18),
    borderRadius: memorialBorderRadius.xl,
    marginTop: s(12),
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.silver,
  },
  agentName: {
    fontSize: s(18),
    fontWeight: memorialFonts.bold,
    marginBottom: s(6),
    color: memorialColors.primary,
  },
  total: {
    marginTop: s(6),
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
    fontSize: s(16),
  },

  // 💎 LUXURIOUS: Premium summary card with gold border
  summaryCard: {
    backgroundColor: memorialColors.white,
    padding: s(20),
    borderRadius: memorialBorderRadius.xxl,
    marginTop: s(15),
    marginBottom: s(30),
    borderWidth: 3,
    borderColor: memorialColors.gold,
    ...memorialShadows.xl,
  },
  summaryTitle: {
    fontWeight: memorialFonts.bold,
    fontSize: s(16),
    marginBottom: s(6),
    color: memorialColors.primary,
  },
  summaryTotal: {
    marginTop: s(4),
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
    fontSize: s(15),
  },

  motivation: {
    marginTop: s(10),
    fontSize: s(12),
    textAlign: "center",
    color: memorialColors.textMuted,
    fontStyle: "italic",
  },

  // 🎨 VISUAL: Peaceful collections section
  collectionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  caret: {
    fontSize: s(16),
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
  },
  collectionHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.paleGold,
    paddingBottom: s(4),
    marginBottom: s(4),
  },
  collectionHeaderText: {
    fontSize: s(12),
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textSecondary,
  },
  collectionRow: {
    flexDirection: "row",
    paddingVertical: s(4),
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.borderLight,
  },
  collectionCell: {
    fontSize: s(12),
    color: memorialColors.textPrimary,
  },
  collectionEmpty: {
    fontSize: s(12),
    color: memorialColors.textMuted,
    marginTop: s(6),
    fontStyle: "italic",
  },

  // 🎨 VISUAL: Memorial-themed withdraw controls
  withdrawRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: s(12),
  },
  withdrawBtnSmall: {
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: memorialBorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...memorialShadows.sm,
    marginRight: s(6), // Replaces gap
  },
  withdrawSmallTxt: {
    color: memorialColors.softWhite,
    fontWeight: memorialFonts.semibold,
    fontSize: s(12),
  },
  amountInput: {
    flex: 1,
    paddingVertical: s(8),
    paddingHorizontal: s(8),
    borderRadius: memorialBorderRadius.md,
    borderWidth: 1,
    borderColor: memorialColors.border,
    backgroundColor: memorialColors.softWhite,
    fontSize: s(12),
    color: memorialColors.textPrimary,
  },

  // 💎 LUXURIOUS: Premium requirements card
  requirementsCard: {
    backgroundColor: memorialColors.white,
    padding: s(20),
    borderRadius: memorialBorderRadius.xl,
    marginTop: s(10),
    ...memorialShadows.lg,
    borderWidth: 2,
    borderColor: memorialColors.primary,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: s(8),
  },

  cardHeaderIcon: {
    fontSize: s(20),
    marginRight: s(8),
  },

  cardHeaderTitle: {
    fontSize: s(20),
    fontWeight: memorialFonts.bold,
    color: memorialColors.black,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  cardDivider: {
    height: 2,
    backgroundColor: memorialColors.gold,
    marginBottom: s(12),
  },

  requirementItem: {
    flexDirection: "row",
    marginBottom: s(10),
  },

  requirementBullet: {
    fontSize: s(16),
    color: memorialColors.primary,
    marginRight: s(8),
    marginTop: s(2),
  },

  requirementText: {
    flex: 1,
    fontSize: s(13),
    color: memorialColors.textPrimary,
    lineHeight: s(18),
  },

  infoBox: {
    flexDirection: "row",
    backgroundColor: memorialColors.successLight,
    padding: s(10),
    borderRadius: memorialBorderRadius.md,
    marginTop: s(8),
    borderLeftWidth: 3,
    borderLeftColor: memorialColors.success,
  },

  infoIcon: {
    fontSize: s(16),
    color: memorialColors.success,
    marginRight: s(8),
    fontWeight: memorialFonts.bold,
  },

  infoText: {
    flex: 1,
    fontSize: s(12),
    color: memorialColors.success,
    lineHeight: s(16),
  },

  warningBox: {
    flexDirection: "row",
    backgroundColor: memorialColors.warningLight,
    padding: s(10),
    borderRadius: memorialBorderRadius.md,
    marginTop: s(8),
    borderLeftWidth: 3,
    borderLeftColor: memorialColors.warning,
  },

  warningIcon: {
    fontSize: s(16),
    color: memorialColors.warning,
    marginRight: s(8),
    fontWeight: memorialFonts.bold,
  },

  warningText: {
    flex: 1,
    fontSize: s(12),
    color: memorialColors.warning,
    fontWeight: memorialFonts.semibold,
    lineHeight: s(16),
  },

  // Commission breakdown styles
  commissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: s(8),
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.borderLight,
  },

  commissionLabel: {
    fontSize: s(14),
    color: memorialColors.textSecondary,
  },

  commissionValue: {
    fontSize: s(14),
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textPrimary,
  },

  totalDivider: {
    height: 3,
    backgroundColor: memorialColors.gold,
    marginVertical: s(12),
  },

  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: s(14),
    backgroundColor: memorialColors.primary,
    paddingHorizontal: s(16),
    borderRadius: memorialBorderRadius.lg,
    marginBottom: s(12),
    ...memorialShadows.md,
  },

  grandTotalLabel: {
    fontSize: s(18),
    fontWeight: memorialFonts.bold,
    color: memorialColors.white,
    letterSpacing: memorialFonts.letterSpacing.wider,
  },

  grandTotalValue: {
    fontSize: s(22),
    fontWeight: memorialFonts.black,
    color: memorialColors.gold,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap", // Allows wrapping on small screens
  },

  metaItem: {
    flex: 1,
    minWidth: 100, // Ensures readability on small screens
    paddingHorizontal: s(6), // Replaces gap
  },

  metaLabel: {
    fontSize: s(11),
    color: memorialColors.textMuted,
    marginBottom: s(4),
  },

  metaValue: {
    fontSize: s(13),
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textSecondary,
  },

  statusBadge: {
    backgroundColor: memorialColors.successLight,
    paddingHorizontal: s(8),
    paddingVertical: s(4),
    borderRadius: memorialBorderRadius.sm,
    color: memorialColors.success,
    overflow: "hidden",
  },
});
