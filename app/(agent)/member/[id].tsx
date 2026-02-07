// app/(agent)/member/[id].tsx
import "react-native-reanimated";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, ScrollView, RefreshControl, TouchableOpacity,
  Platform, UIManager, LayoutAnimation
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import BackButton from "../../../components/BackButton";
import BackgroundLogo from "../../../components/BackgroundLogo";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../../constants/memorialTheme";

// Enable animations
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AnyStr = string | null;
type AnyNum = number | string | null | undefined;

type Member = {
  id: number;
  maf_no: AnyStr;
  last_name: AnyStr;
  first_name: AnyStr;
  middle_name: AnyStr;
  address: AnyStr;
  contact_number: AnyStr;
  religion: AnyStr;
  birth_date: AnyStr;
  age: AnyNum;
  monthly_due: AnyNum;
  plan_type: AnyStr;
  contracted_price: AnyNum;
  date_joined: AnyStr;
  balance: AnyNum;
  gender: AnyStr;
  civil_status: AnyStr;
  zipcode: AnyStr;
  birthplace: AnyStr;
  nationality: AnyStr;
  height: AnyStr;
  weight: AnyStr;
  casket_type: AnyStr;
  membership: AnyStr;
  occupation: AnyStr;
  agent: AnyStr;
  agent_id?: number | null;
  status?: string;
  statusColor?: string;
  created_at?: string;
  plan_start_date?: string;
};

type Beneficiary = {
  id: number;
  member_id?: number | null;
  last_name?: AnyStr;
  first_name?: AnyStr;
  middle_name?: AnyStr;
  relation?: AnyStr;
  birth_date?: AnyStr;
  address?: AnyStr;
};

function cleanValue(v: AnyStr | AnyNum | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toUpperCase() === "N/A" || s === "0" || s === "00" || s === "0.00") {
    return "";
  }
  return s;
}
function fmtDate(d?: AnyStr): string {
  const s = cleanValue(d);
  if (!s || s === "0001-01-01") return "";
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtMoney(amount: AnyNum): string {
  const val = Number(amount);
  if (isNaN(val)) return "—";
  return val.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}

export default function AgentMemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const name = useMemo(() => {
    if (!member) return "";
    return [cleanValue(member.last_name), cleanValue(member.first_name), cleanValue(member.middle_name)]
      .filter(Boolean).join(", ").replace(/\s+,/g, ",");
  }, [member]);

  /** Guard: only allow if this member belongs to the logged-in agent */
  const ensureOwnership = useCallback(async (m: Member | null) => {
    const { data: user } = await supabase.auth.getUser();
    const userAgentId =
      (user?.user?.user_metadata?.agent_id ?? user?.user?.user_metadata?.agentId) ?? null;
    const ua = userAgentId === null ? NaN : Number(userAgentId);

    if (m && Number.isFinite(ua) && m.agent_id != null && Number(m.agent_id) === ua) {
      return true;
    }
    // If RLS is already enforcing, this can be lenient. Otherwise, kick back:
    router.replace("/(agent)/members");
    return false;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: m, error: mErr } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle();

    if (mErr) console.warn("Member fetch error:", mErr.message);

    // Fetch Collections to Calculate Balance (Source of Truth)
    const { data: collections, error: cErr } = await supabase
      .from('collections')
      .select('payment, is_membership_fee, date_paid, created_at')
      .eq('member_id', memberId)
      .order('date_paid', { ascending: true });

    if (cErr) console.warn("Collections fetch error:", cErr.message);

    const rawPayments = collections || [];
    // Only count regular payments towards the balance
    const totalPaid = rawPayments
      .filter(c => !c.is_membership_fee)
      .reduce((sum, c) => sum + (Number(c.payment) || 0), 0);
    const paymentsCount = rawPayments.filter(c => !c.is_membership_fee).length;

    // Calculate Status
    let status = 'Active';
    let statusColor = '#22c55e'; // Green

    if (m) {
      // DYNAMIC BALANCE CALCULATION
      const contracted = Number(m.contracted_price) || 0;
      const calculatedBalance = Math.max(0, contracted - totalPaid);

      // Override member balance with calculated one
      m.balance = calculatedBalance;

      if (calculatedBalance <= 0) {
        status = 'Completed';
        statusColor = '#22c55e';
      } else {
        // Start Date
        let startDateVal = m.plan_start_date ? new Date(m.plan_start_date).getTime() : null;
        if (!startDateVal) {
          if (m.date_joined) startDateVal = new Date(m.date_joined).getTime();
          else startDateVal = new Date(m.created_at || Date.now()).getTime();
        }
        const startDate = new Date(startDateVal);

        // Find Last Regular Payment
        const regularPayments = (collections || []).filter((c: any) => !c.is_membership_fee);
        const lastPayment = regularPayments.length > 0 ? regularPayments[regularPayments.length - 1] : null;

        let paidUntilDate = new Date(startDate);

        if (lastPayment) {
          const lpDate = new Date(lastPayment.date_paid || lastPayment.created_at);
          const lpAmount = Number(lastPayment.payment) || 0;
          const mDue = Number(m.monthly_due) || 0;

          if (mDue > 0) {
            const monthsCovered = lpAmount / mDue;
            const wholeMonths = Math.floor(monthsCovered);
            const fraction = monthsCovered - wholeMonths;

            paidUntilDate = new Date(lpDate);
            paidUntilDate.setMonth(paidUntilDate.getMonth() + wholeMonths);
            paidUntilDate.setDate(paidUntilDate.getDate() + Math.round(fraction * 30));
          } else {
            paidUntilDate = new Date();
          }
        }

        // Calculate Months Behind
        const now = new Date();
        let monthsBehind = (now.getFullYear() - paidUntilDate.getFullYear()) * 12 +
          (now.getMonth() - paidUntilDate.getMonth());

        if (now.getDate() < paidUntilDate.getDate()) {
          monthsBehind--;
        }
        monthsBehind = Math.max(0, monthsBehind);

        if (monthsBehind > 3) {
          status = 'Lapsed';
          statusColor = '#ef4444';
        } else if (monthsBehind >= 2) {
          status = 'Lapsable';
          statusColor = '#f97316';
        } else if (monthsBehind >= 1) {
          status = 'Warning';
          statusColor = '#eab308';
        } else {
          status = 'Active';
          statusColor = '#22c55e';
        }
      }
    }

    const mem = m ? { ...m, status, statusColor } : null;
    setMember(mem);

    // ownership check
    const ok = await ensureOwnership(mem);
    if (!ok) return;

    const { data: b, error: bErr } = await supabase
      .from("beneficiaries")
      .select("id, member_id, last_name, first_name, middle_name, relation, birth_date, address")
      .eq("member_id", memberId)
      .order("id", { ascending: true });

    if (bErr) console.warn("Beneficiaries fetch error:", bErr.message);
    setBeneficiaries((b as Beneficiary[]) ?? []);

    setLoading(false);
  }, [memberId, ensureOwnership]);

  useEffect(() => {
    if (!Number.isFinite(memberId)) return;
    load();
  }, [load, memberId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const Field = ({ label, value, isMoney = false, fullWidth = false }: { label: string; value?: AnyStr | AnyNum, isMoney?: boolean, fullWidth?: boolean }) => {
    const rawVal = cleanValue(value);
    const displayVal = isMoney ? fmtMoney(value) : rawVal;

    if (!displayVal) return null;

    return (
      <View style={[styles.fieldRow, fullWidth && styles.fieldRowFull]}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{displayVal}</Text>
      </View>
    );
  };

  const Section = ({ title, children, icon }: { title: string; children: React.ReactNode, icon?: string }) => (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {/* Could add icon here if passed */}
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const renderBeneficiary = ({ item }: { item: Beneficiary }) => {
    const bName = [cleanValue(item.first_name), cleanValue(item.middle_name), cleanValue(item.last_name)]
      .filter(Boolean).join(" ").replace(/\s+,/g, ",");
    return (
      <View style={styles.benCard}>
        <View style={styles.benHeader}>
          <Text style={styles.benName}>{bName || "Beneficiary"}</Text>
          {item.relation && <View style={styles.benBadge}><Text style={styles.benBadgeText}>{item.relation}</Text></View>}
        </View>
        <View style={styles.benDetails}>
          {fmtDate(item.birth_date) ? <Text style={styles.benText}>Born: {fmtDate(item.birth_date)}</Text> : null}
          {item.address ? <Text style={styles.benText} numberOfLines={2}>📍 {item.address}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <BackgroundLogo>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: "Member Profile",
            headerTitleStyle: { fontFamily: 'serif', color: memorialColors.primary },
            headerLeft: () => <BackButton />,
            headerBackTitle: "Back",
            headerTransparent: true,
            headerBlurEffect: 'regular',
            headerBackground: () => <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
          }}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: memorialSpacing.lg, paddingTop: 100, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={memorialColors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitials}>
                {(member?.first_name?.[0] || "")}{(member?.last_name?.[0] || "")}
              </Text>
            </View>
            <Text style={styles.profileName}>{name || "Loading..."}</Text>
            <Text style={styles.profileId}>AF No. {member?.maf_no || "—"}</Text>

            <View style={styles.profileStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Status</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: member?.statusColor || '#ccc' }} />
                  <Text style={[styles.statValue, { color: member?.statusColor || memorialColors.textPrimary }]}>
                    {member?.status || 'Active'}
                  </Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Date of Inception</Text>
                <Text style={styles.statValue}>{fmtDate(member?.date_joined) || "—"}</Text>
              </View>
            </View>
          </View>

          {/* Plan & Account */}
          <Section title="Plan & Account">
            <View style={styles.gridContainer}>
              <Field label="Package" value={member?.plan_type} />
              <Field label="Monthly" value={member?.monthly_due} isMoney />
              <Field label="Contract Price" value={member?.contracted_price} isMoney />
              <Field label="Balance" value={member?.balance} isMoney />
              <Field label="Casket Type" value={member?.casket_type} fullWidth />
              <Field label="Membership" value={member?.membership} fullWidth />
              <Field label="Agent" value={member?.agent} fullWidth />
            </View>
          </Section>

          {/* Personal info */}
          <Section title="Personal Information">
            <View style={styles.gridContainer}>
              <Field label="Birth date" value={fmtDate(member?.birth_date)} />
              <Field label="Age" value={member?.age} />
              <Field label="Civil Status" value={member?.civil_status} />
              <Field label="Gender" value={member?.gender} />
              <Field label="Religion" value={member?.religion} />
              <Field label="Contact" value={member?.contact_number} />
              <Field label="Address" value={member?.address} fullWidth />
              <Field label="Zipcode" value={member?.zipcode} />
              <Field label="Origin" value={member?.birthplace} fullWidth />
              <Field label="Occupation" value={member?.occupation} fullWidth />
            </View>
            <View style={styles.gridContainer}>
              <Field label="Height" value={member?.height} />
              <Field label="Weight" value={member?.weight} />
            </View>
          </Section>

          {/* Beneficiaries */}
          <Section title="Beneficiaries">
            {loading ? <Text style={styles.note}>Loading details...</Text> : null}
            {!loading && beneficiaries.length === 0 ? (
              <Text style={styles.note}>No beneficiaries recorded.</Text>
            ) : (
              <FlatList
                data={beneficiaries}
                keyExtractor={(b) => String(b.id)}
                renderItem={renderBeneficiary}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: memorialSpacing.sm }} />}
              />
            )}
          </Section>

          {/* View Statement Action */}
          <TouchableOpacity
            style={styles.actionBtn}
            disabled={!member}
            onPress={() =>
              router.push({
                pathname: "/member/soa",
                params: { id: String(memberId), maf_no: cleanValue(member?.maf_no) },
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>View Statement of Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </BackgroundLogo>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.xl,
    alignItems: 'center',
    marginBottom: memorialSpacing.lg,
    ...memorialShadows.md,
    borderTopWidth: 4,
    borderTopColor: memorialColors.gold,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: memorialColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: memorialSpacing.md,
    ...memorialShadows.sm,
  },
  profileInitials: {
    color: memorialColors.white,
    fontSize: 32,
    fontFamily: 'serif',
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: memorialFonts.xl,
    fontFamily: 'serif',
    color: memorialColors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  profileId: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    marginBottom: memorialSpacing.lg,
  },
  profileStats: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    borderTopWidth: 1,
    borderTopColor: memorialColors.border,
    paddingTop: memorialSpacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: memorialColors.border,
  },
  statLabel: {
    fontSize: memorialFonts.xs,
    color: memorialColors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: memorialFonts.md,
    color: memorialColors.textPrimary,
    fontWeight: '600',
  },

  card: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.lg,
    marginBottom: memorialSpacing.md,
    ...memorialShadows.sm,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: memorialColors.bgSecondary,
    paddingVertical: memorialSpacing.sm,
    paddingHorizontal: memorialSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.border,
  },
  sectionTitle: {
    fontSize: memorialFonts.md,
    fontFamily: 'serif',
    color: memorialColors.primary,
  },
  sectionContent: {
    padding: memorialSpacing.md,
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  fieldRow: {
    width: '48%',
    marginBottom: memorialSpacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  fieldRowFull: {
    width: '100%',
  },
  fieldLabel: {
    fontSize: memorialFonts.xs,
    color: memorialColors.textMuted,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textPrimary,
    fontWeight: '500',
  },

  note: {
    color: memorialColors.textMuted,
    fontStyle: 'italic',
    fontSize: memorialFonts.sm,
  },

  benCard: {
    backgroundColor: memorialColors.bgSecondary,
    borderRadius: memorialBorderRadius.md,
    padding: memorialSpacing.md,
    borderLeftWidth: 3,
    borderLeftColor: memorialColors.primaryLight,
  },
  benHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  benName: {
    fontSize: memorialFonts.md,
    fontWeight: '600',
    color: memorialColors.primary,
  },
  benBadge: {
    backgroundColor: memorialColors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  benBadgeText: {
    color: memorialColors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  benDetails: {
    marginTop: 2,
  },
  benText: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textSecondary,
  },

  actionBtn: {
    backgroundColor: memorialColors.gold,
    paddingVertical: memorialSpacing.md,
    borderRadius: memorialBorderRadius.round,
    alignItems: "center",
    marginTop: memorialSpacing.md,
    ...memorialShadows.md,
  },
  actionBtnText: {
    color: memorialColors.primaryDark,
    fontWeight: "bold",
    fontSize: memorialFonts.md,
    textTransform: 'uppercase',
  },
});
