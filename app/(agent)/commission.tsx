// app/(agent)/commission.tsx
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

  // Start = 6th of selected month
  const start = new Date(Y, M - 1, 6);

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

      const id = await AsyncStorage.getItem("agent_id");
      setAgentId(id ? Number(id) : null);

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

      // 1) Fetch exact rollup for this period
      const { data: rollup } = await supabase
        .from("agent_commission_rollups")
        .select("*")
        .eq("agent_id", agentId)
        .eq("period_month", month)
        .eq("period_year", year)
        .maybeSingle();

      const row = rollup ? [rollup] : [];
      if (rollup) {
        rollup.corrected_total =
          Number(rollup.monthly_commission) +
          Number(rollup.membership_commission) +
          Number(rollup.override_commission) +
          Number(rollup.recruiter_bonus);
      }
      setData(row);

      // 2) Lifetime commission (non-withdrawable, from Nov 2025 onwards)
      const { data: allRows } = await supabase
        .from("agent_commission_rollups")
        .select(
          "period_year, period_month, monthly_commission, membership_commission, override_commission, recruiter_bonus"
        )
        .eq("agent_id", agentId)
        .gte("period_year", 2025);

      const lifetime = (allRows || []).reduce((sum, r: any) => {
        const isAfterStart =
          r.period_year > 2025 ||
          (r.period_year === 2025 && r.period_month >= 11);

        if (!isAfterStart) return sum;

        return (
          sum +
          (Number(r.monthly_commission) +
            Number(r.membership_commission) +
            Number(r.override_commission) +
            Number(r.recruiter_bonus))
        );
      }, 0);

      setLifetimeTotal(lifetime || 0);

      // 3) Eligibility (Rule A OR Rule B using same-member logic)
const { data: allColls } = await supabase
  .from("collections")
  .select("member_id, is_membership_fee, payment_for")
  .eq("agent_id", agentId)
  .gte("date_paid", gte)
  .lt("date_paid", lt);

const list = allColls || [];

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

      // 5) Wallet / withdrawable balance
      const { data: wallet, error: wErr } = await supabase
        .from("agent_wallets")
        .select("balance")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (wErr) {
        console.error("Error loading wallet:", wErr);
        setWalletBalance(0);
        setCanWithdraw(false);
      } else {
        const bal = Number(wallet?.balance || 0);
        setWalletBalance(bal);
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
              Alert.alert(
                "Success",
                `Withdrawal of ${peso(amount)} has been processed.`
              );
              setCustomAmount("");
              await fetchCommissions();
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
        contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
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

          {/* PROGRESS */}
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>AGR Requirements</Text>
            <Text style={{ fontSize: 12, color: "#000000ff", marginTop: 4 }}>
            Have 3 card members OR 1 new member who will pay its Membership Fee AND its first MLAP payment.
            </Text>
            <Text style={{ fontWeight: "bold",fontSize: 12, color: "#38a322ff", marginTop: 4 }}>
            If you complete our AGR Requirements you can automatically see and withdraw your available commission in the Withdrawable Balance.
            </Text>
            <Text style={{ fontWeight: "bold",fontSize: 14, color: "#750f08ff", marginTop: 4 }}>
            NOTE: YOU CAN ONLY WITHDRAW WHEN YOU HAVE A MINIMUM BALANCE OF 500 PESOS.
            </Text>
          </View>

          {/* COMMISSION SUMMARY CARD */}
          {r ? (
            <View style={styles.card}>
              <Text style={styles.agentName}>Commission Summary</Text>

              <Text style={{ fontWeight: "bold",fontSize: 14, color: "#092b88ff", marginTop: 4 }}>

                Monthly Commission: {peso(r.monthly_commission)}
              
              </Text>

              <Text style={{ fontWeight: "bold",fontSize: 14, color: "#092b88ff", marginTop: 4 }}>
                Outright Commission: {peso(r.membership_commission)}
              </Text>
              <Text style={{ fontWeight: "bold",fontSize: 14, color: "#092b88ff", marginTop: 4 }}>
                Override Commission: {peso(r.override_commission)}</Text>
              <Text style={{ fontWeight: "bold",fontSize: 14, color: "#092b88ff", marginTop: 4 }}>
                Recruiter Bonus: {peso(r.recruiter_bonus)}</Text>

              <Text style={styles.total}>
                Grand Total: {peso(correctedTotal)}
              </Text>
              <Text style={{ fontWeight: "bold",fontSize: 14, color: "#000000ff", marginTop: 4 }}>
                Total Collection: {peso(r.total_collection)}</Text>
              <Text style={{ fontWeight: "bold",fontSize: 14, color: "#000000ff", marginTop: 4 }}>
                Status: {r.status}</Text>
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
                        ? `${(m.last_name || "").toUpperCase()}, ${
                            m.first_name || ""
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
              Lifetime Commission (Not Withdrawable): {peso(lifetimeTotal)}
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
// 🔵 STYLES
// ========================================
const styles = StyleSheet.create({
  innerContainer: { width: "100%", maxWidth: 480 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: s(12),
    backgroundColor: "#fff",
    borderRadius: s(12),
    marginTop: s(10),
    marginBottom: s(10),
  },
  header: { fontSize: s(20), fontWeight: "700" },

  actionBtn: {
    backgroundColor: "#007aff",
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: { color: "#fff", fontSize: s(20), fontWeight: "700" },

  filterWrapper: {
    flexDirection: "row",
    gap: s(10),
    backgroundColor: "#fff",
    padding: s(8),
    borderRadius: s(12),
  },
  pickerBox: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    borderRadius: s(10),
  },

  progressCard: {
    backgroundColor: "#fff",
    padding: s(12),
    borderRadius: s(12),
    marginTop: s(10),
  },
  progressTitle: { fontWeight: "700", marginBottom: s(6) },
  progressText: { textAlign: "right", marginTop: s(4), fontSize: s(12) },

  card: {
    backgroundColor: "#fff",
    padding: s(14),
    borderRadius: s(12),
    marginTop: s(10),
  },
  agentName: { fontSize: s(18), fontWeight: "700", marginBottom: s(6) },
  total: { marginTop: s(6), fontWeight: "700", color: "#007aff" },

  summaryCard: {
    backgroundColor: "#fff",
    padding: s(14),
    borderRadius: s(12),
    marginTop: s(15),
    marginBottom: s(30),
    borderWidth: 1,
    borderColor: "#007aff",
  },
  summaryTitle: { fontWeight: "700", fontSize: s(16), marginBottom: s(6) },
  summaryTotal: { marginTop: s(4), fontWeight: "700", color: "#007aff" },

  motivation: {
    marginTop: s(10),
    fontSize: s(12),
    textAlign: "center",
    color: "#555",
  },

  // Collections styles
  collectionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  caret: {
    fontSize: s(16),
    fontWeight: "700",
    color: "#007aff",
  },
  collectionHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: s(4),
    marginBottom: s(4),
  },
  collectionHeaderText: {
    fontSize: s(12),
    fontWeight: "700",
    color: "#4b5563",
  },
  collectionRow: {
    flexDirection: "row",
    paddingVertical: s(4),
  },
  collectionCell: {
    fontSize: s(12),
    color: "#111827",
  },
  collectionEmpty: {
    fontSize: s(12),
    color: "#6b7280",
    marginTop: s(6),
  },

  // Withdraw
  withdrawRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: s(12),
    gap: s(6),
  },
  withdrawBtnSmall: {
    paddingVertical: s(8),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  withdrawSmallTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: s(12),
  },
  amountInput: {
    flex: 1,
    paddingVertical: s(8),
    paddingHorizontal: s(8),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    fontSize: s(12),
    color: "#111827",
  },
});
