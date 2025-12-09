// ✨ REDESIGNED: Memorial Services Theme - Members List
// 🎨 Visual changes: Respectful card styling, peaceful colors, gentle typography
// ⚙️ Logic: Added Member Segregation (Lapsed, At Risk, Commissionable, Deferred, Non-Deferred) + Beneficiaries
// 🔒 Security: Strictly scoped to logged-in Agent

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { router } from "expo-router";
import BackgroundLogo from "../../components/BackgroundLogo";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../constants/memorialTheme";

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ⚙️ UNCHANGED: Agent ID retrieval logic
async function getAgentId(): Promise<number> {
  const { data } = await supabase.auth.getUser();
  const raw =
    (data?.user?.user_metadata?.agent_id ??
      data?.user?.user_metadata?.agentId) ?? null;
  const id = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(id)) {
    throw new Error("Your account is not linked to an agent_id.");
  }
  return id;
}

// ⚙️ UPDATED: Types to support new fields
type Beneficiary = {
  member_id: number;
  relation: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  birth_date?: string;
  age?: number;
  address?: string;
};

type Member = {
  id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  address?: string;
  maf_no: string;
  plan_type: string;
  monthly_due: number;
  contracted_price: number;
  balance: number;
  gender?: string;
  months_since_start?: number; // From RPC or computed if possible
  months_behind?: number;     // From RPC
  agent_id?: number;
};

type FilterType = "ALL" | "MS" | "DEFERRED" | "NON_DEFERRED" | "LAPSED" | "AT_RISK";

// ⚙️ HELPER: Calculate Paid Months
function calculatePaidMonths(member: Member): number {
  const cPrice = Number(member.contracted_price) || 0;
  const bal = Number(member.balance) || 0;
  const mDue = Number(member.monthly_due) || 0;

  if (mDue <= 0) return 0;
  return (cPrice - bal) / mDue;
}

// ⚙️ UPDATED: Supabase queries for different filters
async function fetchMembers(filter: FilterType) {
  const agentId = await getAgentId();
  let data: Member[] = [];

  if (filter === "LAPSED") {
    // Call RPC for lapsed
    const res = await supabase.rpc("get_lapsed_members");
    if (res.error) throw res.error;
    // 🔒 Security: Filter by agent_id
    data = (res.data || []).map((m: any) => ({ ...m, agent_id: Number(m.agent_id) }));
    data = data.filter((m: any) => m.agent_id === agentId);
  } else if (filter === "AT_RISK") {
    const res = await supabase.rpc("get_at_risk_members");
    if (res.error) throw res.error;
    // 🔒 Security: Filter by agent_id
    data = (res.data || []).map((m: any) => ({ ...m, agent_id: Number(m.agent_id) }));
    data = data.filter((m: any) => m.agent_id === agentId);
  } else {
    // Normal Fetch for ALL, MS, DEFERRED, NON_DEFERRED
    const res = await supabase
      .from("members")
      .select("id, first_name, last_name, middle_name, address, maf_no, plan_type, monthly_due, contracted_price, balance, agent_id")
      .eq("agent_id", agentId)
      .order("last_name", { ascending: true })
      .limit(500);

    if (res.error) throw res.error;
    data = res.data ?? [];
  }

  // Client-side filtering for complex logic
  if (filter === "MS") {
    data = data.filter(m => (m.plan_type || '').toUpperCase() === 'MS');
  } else if (filter === "DEFERRED") {
    // Paid <= 12, Exclude MS
    data = data.filter(m => {
      if ((m.plan_type || '').toUpperCase() === 'MS') return false;
      const paid = calculatePaidMonths(m);
      return paid <= 12;
    });
  } else if (filter === "NON_DEFERRED") {
    // Paid >= 13, Exclude MS
    data = data.filter(m => {
      if ((m.plan_type || '').toUpperCase() === 'MS') return false;
      const paid = calculatePaidMonths(m);
      return paid >= 13;
    });
  }

  return data;
}

// 🔒 Security: Ensure we only get beneficiaries for the members we own
async function fetchBeneficiaries(memberIds: number[]) {
  if (!memberIds.length) return [];

  const { data, error } = await supabase
    .from("beneficiaries")
    .select("member_id, relation, last_name, first_name, middle_name, birth_date, age, address")
    .in("member_id", memberIds)
    .order("relation", { ascending: true });

  if (error) {
    console.warn("Error fetching beneficiaries:", error);
    return [];
  }
  return data ?? [];
}

export default function AgentMembers() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<FilterType>("ALL");

  // Beneficiaries State
  const [expandedMembers, setExpandedMembers] = React.useState<Set<number>>(new Set());

  // Queries
  const {
    data: members = [],
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["agent-members", activeFilter],
    queryFn: () => fetchMembers(activeFilter)
  });

  // Fetch Beneficiaries when members change
  const { data: beneficiariesMap = new Map<number, Beneficiary[]>() } = useQuery({
    queryKey: ["agent-beneficiaries", members.map(m => m.id).join(',')],
    queryFn: async () => {
      const ids = members.map(m => m.id);
      const benes = await fetchBeneficiaries(ids);
      const map = new Map<number, Beneficiary[]>();
      benes.forEach((b: any) => {
        const list = map.get(b.member_id) || [];
        list.push(b);
        map.set(b.member_id, list);
      });
      return map;
    },
    enabled: members.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Filter members based on search query
  const filteredData = React.useMemo(() => {
    let result = members;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((member) => {
        // Desktop Fields: maf_no, last_name, first_name, middle_name, address, plan_type
        const parts = [
          member.first_name,
          member.last_name,
          member.middle_name,
          member.maf_no,
          member.address,
          member.plan_type
        ];

        const fullText = parts.filter(Boolean).join(" ").toLowerCase();
        return fullText.includes(query);
      });
    }
    return result;
  }, [members, searchQuery]);

  // STATUS BADGE LOGIC (Strict Desktop Parity)
  function getStatus(member: Member) {
    // 1. LAPSED: High Priority
    // Logic: Active Filter 'LAPSED' OR Data-driven (months_behind >= 3)
    const isLapsedData = (typeof member.months_behind === 'number' && member.months_behind >= 3);

    if (activeFilter === "LAPSED" || isLapsedData) {
      return { label: "LAPSED", color: "#ef4444", bg: "#fee2e2" };
    }

    // 2. AT RISK
    // Logic: Active Filter 'AT_RISK' (RPC sourced)
    // Note: If normal query returns 'at_risk' flag we would check it here, but desktop mainly uses filter match
    if (activeFilter === "AT_RISK") {
      return { label: "AT RISK", color: "#b45309", bg: "#fef3c7" };
    }

    // 3. Commissionable vs Non-Commissionable
    const paid = calculatePaidMonths(member);
    if (paid <= 12) {
      return { label: "COMMISSIONABLE", color: "#16a34a", bg: "#dcfce7" };
    } else {
      return { label: "NON COMMISSIONABLE", color: "#d97706", bg: "#fef9c3" };
    }
  }

  const toggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const FilterTab = ({ label, value }: { label: string, value: FilterType }) => (
    <TouchableOpacity
      onPress={() => setActiveFilter(value)}
      style={[
        s.filterTab,
        activeFilter === value && s.filterTabActive
      ]}
    >
      <Text style={[
        s.filterTabText,
        activeFilter === value && s.filterTabTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <BackgroundLogo>
      <View style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Member Records</Text>
          <Text style={s.headerSubtitle}>{members.length} records • {activeFilter.replace('_', ' ')}</Text>
        </View>

        <View style={s.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
            <FilterTab label="All Members" value="ALL" />
            <FilterTab label="MS/CARD" value="MS" />
            <FilterTab label="Deferred" value="DEFERRED" />
            <FilterTab label="Non-Deferred" value="NON_DEFERRED" />
            <FilterTab label="At Risk" value="AT_RISK" />
            <FilterTab label="Lapsed" value="LAPSED" />
          </ScrollView>
        </View>

        <View style={s.searchContainer}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name, address, or AF..."
            placeholderTextColor={memorialColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={s.clearButton}>
              <Text style={s.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {(isLoading || isRefetching) && !members.length ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={s.loadingText}>Loading members...</Text>
          </View>
        ) : isError ? (
          <View style={s.errorCard}>
            <Text style={s.errorText}>{(error as Error)?.message}</Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: memorialColors.primary, textDecorationLine: 'underline' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => {
              const status = getStatus(item);
              const isExpanded = expandedMembers.has(item.id);
              const benes = beneficiariesMap.get(item.id) || [];

              return (
                <View style={s.cardWrapper}>
                  <TouchableOpacity
                    style={s.card}
                    onPress={() => router.push({ pathname: "/member/[id]", params: { id: String(item.id) } })}
                    activeOpacity={0.7}
                  >
                    <View style={s.cardHeader}>
                      <Text style={s.memberName}>
                        {[item.first_name, item.last_name].filter(Boolean).join(" ").toUpperCase() || "—"}
                      </Text>
                      <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>

                    <View style={s.cardDivider} />

                    <View style={s.cardDetails}>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>AF No.</Text>
                        <Text style={s.detailValue}>{item.maf_no || "—"}</Text>
                      </View>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>PACKAGE</Text>
                        <Text style={s.detailValue}>{item.plan_type ?? "—"}</Text>
                      </View>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>BALANCE</Text>
                        <Text style={s.detailValue}>
                          {(item.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>

                    <View style={s.actionsRow}>
                      <Text style={s.viewDetailsLink}>View details</Text>
                      <TouchableOpacity
                        style={s.expandBtn}
                        onPress={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                      >
                        <Text style={s.expandText}>
                          {isExpanded ? "Hide Beneficiaries" : `Show Beneficiaries (${benes.length})`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Beneficiaries Expansion with Full Detail */}
                  {isExpanded && (
                    <View style={s.beneficiariesContainer}>
                      {benes.length === 0 ? (
                        <Text style={s.noBeneText}>No beneficiaries found.</Text>
                      ) : (
                        benes.map((b, idx) => (
                          <View key={idx} style={s.beneRow}>
                            <View style={s.beneHeader}>
                              <Text style={s.beneName}>
                                {b.first_name} {b.middle_name ? b.middle_name + " " : ""}{b.last_name}
                              </Text>
                              <View style={s.beneBadge}>
                                <Text style={s.beneBadgeText}>{b.relation}</Text>
                              </View>
                            </View>

                            <View style={s.beneDetailsGrid}>
                              {b.birth_date && (
                                <Text style={s.beneDetailItem}>🎂 {b.birth_date} {b.age ? `(${b.age} yrs)` : ''}</Text>
                              )}
                              {b.address && (
                                <Text style={s.beneDetailItem} numberOfLines={1}>📍 {b.address}</Text>
                              )}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No members found</Text>
                <Text style={s.emptySubtext}>Try changing filters or search terms</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: memorialSpacing.tabBarHeight }}
            refreshing={isLoading || isRefetching}
            onRefresh={refetch}
          />
        )}
      </View>
    </BackgroundLogo>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    padding: memorialSpacing.lg,
    backgroundColor: memorialColors.bgPrimary,
  },
  header: {
    marginBottom: memorialSpacing.md,
    paddingBottom: memorialSpacing.md,
    borderBottomWidth: 2,
    borderBottomColor: memorialColors.gold,
  },
  headerTitle: {
    fontSize: memorialFonts.xxl,
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
    marginBottom: memorialSpacing.xs,
  },
  headerSubtitle: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    textTransform: 'capitalize'
  },
  filterContainer: {
    marginBottom: memorialSpacing.md,
    // Removed fixed height to allow tabs to sizing naturally
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  filterTab: {
    paddingHorizontal: memorialSpacing.md,
    paddingVertical: memorialSpacing.xs,
    borderRadius: memorialBorderRadius.round,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    backgroundColor: memorialColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterTabActive: {
    backgroundColor: memorialColors.primary,
    borderColor: memorialColors.primary,
  },
  filterTabText: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textSecondary,
    fontWeight: memorialFonts.medium,
  },
  filterTabTextActive: {
    color: memorialColors.white,
  },
  loadingText: {
    color: memorialColors.textSecondary,
    fontSize: memorialFonts.md,
    textAlign: "center",
    padding: memorialSpacing.xxl,
  },
  errorCard: {
    backgroundColor: memorialColors.errorLight,
    borderRadius: memorialBorderRadius.md,
    padding: memorialSpacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: memorialColors.error,
  },
  errorText: {
    color: memorialColors.error,
    fontSize: memorialFonts.md,
  },
  cardWrapper: {
    marginBottom: memorialSpacing.md,
  },
  card: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.lg,
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderLeftWidth: 4,
    borderLeftColor: memorialColors.gold,
    zIndex: 1,
  },
  cardHeader: {
    marginBottom: memorialSpacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: memorialFonts.lg,
    fontWeight: memorialFonts.semibold,
    color: memorialColors.primary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardDivider: {
    height: 1,
    backgroundColor: memorialColors.paleGold,
    marginVertical: memorialSpacing.sm,
  },
  cardDetails: {
    marginBottom: memorialSpacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: memorialSpacing.xs,
  },
  detailLabel: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
  },
  detailValue: {
    fontSize: memorialFonts.sm,
    fontWeight: memorialFonts.medium,
    color: memorialColors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: memorialSpacing.xs,
  },
  viewDetailsLink: {
    fontSize: memorialFonts.sm,
    color: memorialColors.primaryLight,
    fontWeight: memorialFonts.medium,
  },
  expandBtn: {
    padding: 4,
  },
  expandText: {
    fontSize: memorialFonts.xs,
    color: memorialColors.textMuted,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  beneficiariesContainer: {
    marginTop: -10,
    backgroundColor: memorialColors.bgSecondary,
    borderBottomLeftRadius: memorialBorderRadius.xl,
    borderBottomRightRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.lg,
    paddingTop: memorialSpacing.xl,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderTopWidth: 0,
  },
  beneRow: {
    marginBottom: memorialSpacing.md,
    paddingBottom: memorialSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.silver,
  },
  beneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  beneName: {
    fontSize: memorialFonts.md,
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textPrimary,
  },
  beneBadge: {
    backgroundColor: memorialColors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  beneBadgeText: {
    fontSize: 10,
    color: memorialColors.white,
    textTransform: 'uppercase',
  },
  beneDetailsGrid: {
    marginTop: 4,
  },
  beneDetailItem: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textSecondary,
    marginBottom: 2,
  },
  noBeneText: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: memorialColors.cream,
    borderRadius: memorialBorderRadius.lg,
    padding: memorialSpacing.xxxl,
    alignItems: "center",
    marginTop: memorialSpacing.xxl,
    borderWidth: 1,
    borderColor: memorialColors.border,
  },
  emptyText: {
    fontSize: memorialFonts.lg,
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textSecondary,
    marginBottom: memorialSpacing.xs,
  },
  emptySubtext: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.md,
    paddingHorizontal: memorialSpacing.md,
    paddingVertical: memorialSpacing.sm,
    marginBottom: memorialSpacing.md,
    borderWidth: 1,
    borderColor: memorialColors.gold,
    ...memorialShadows.sm,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: memorialSpacing.sm,
    color: memorialColors.textMuted,
  },
  searchInput: {
    flex: 1,
    fontSize: memorialFonts.md,
    color: memorialColors.textPrimary,
    paddingVertical: memorialSpacing.xs,
  },
  clearButton: {
    padding: memorialSpacing.xs,
    marginLeft: memorialSpacing.sm,
  },
  clearIcon: {
    fontSize: 16,
    color: memorialColors.textMuted,
  },
});
