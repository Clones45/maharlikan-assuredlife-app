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
import { s } from "../../utils/responsive";

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

type FilterType = "ALL" | "MS" | "DEFERRED" | "NON_DEFERRED" | "LAPSED" | "AT_RISK" | "WARNING" | "ACTIVE";

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
    const res = await supabase.rpc("get_lapsed_members");
    if (res.error) throw res.error;
    data = (res.data || []).map((m: any) => ({ ...m, agent_id: Number(m.agent_id) }));
    data = data.filter((m: any) => m.agent_id === agentId);
  } else if (filter === "AT_RISK") {
    const res = await supabase.rpc("get_at_risk_members");
    if (res.error) throw res.error;
    data = (res.data || []).map((m: any) => ({ ...m, agent_id: Number(m.agent_id) }));
    data = data.filter((m: any) => m.agent_id === agentId);
  } else if (filter === "WARNING") {
    const res = await supabase.rpc("get_warning_members");
    if (res.error) throw res.error;
    data = (res.data || []).map((m: any) => ({ ...m, agent_id: Number(m.agent_id) }));
    data = data.filter((m: any) => m.agent_id === agentId);
  } else if (filter === "ACTIVE") {
    const res = await supabase.rpc("get_active_members");
    if (res.error) throw res.error;
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

// ... (Rest of fetchBeneficiaries unchanged)

// ...

// Update UI in Return block
// (Lines 281-287 usually)
/*
            <FilterTab label="All Members" value="ALL" />
            <FilterTab label="MS/CARD" value="MS" />
            <FilterTab label="Deferred" value="DEFERRED" />
            <FilterTab label="Non-Deferred" value="NON_DEFERRED" />
            <FilterTab label="Active" value="ACTIVE" />
            <FilterTab label="Warning" value="WARNING" />
            <FilterTab label="At Risk" value="AT_RISK" />
            <FilterTab label="Lapsed" value="LAPSED" />
*/

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
    // Priority 1: Lapsed (> 3 months behind)
    // SQL: months_behind > 3
    if (activeFilter === "LAPSED" || (typeof member.months_behind === 'number' && member.months_behind > 3)) {
      return { label: "LAPSED", color: "#ef4444", bg: "#fee2e2" };
    }

    // Priority 2: At Risk (Lapsable) [2, 3)
    // SQL: months_behind >= 2 AND < 3
    if (activeFilter === "AT_RISK" || (typeof member.months_behind === 'number' && member.months_behind >= 2 && member.months_behind < 3)) {
      return { label: "Lapsable", color: "#f97316", bg: "#ffedd5" };
    }

    // Priority 3: Warning [1, 2)
    // SQL: months_behind >= 1 AND < 2
    // Note: Desktop view_members.js supports Warning filter.
    // If we have data, we show it.
    if ((typeof member.months_behind === 'number' && member.months_behind >= 1 && member.months_behind < 2)) {
      return { label: "WARNING", color: "#eab308", bg: "#fef9c3" };
    }

    // Priority 4: Commissionable vs Non-Commissionable (Default fallback if Active)
    // Or explicit Active
    if (activeFilter === "ACTIVE") {
      return { label: "ACTIVE", color: "#16a34a", bg: "#dcfce7" };
    }

    if (typeof member.months_behind === 'number' && member.months_behind < 1) {
      // It is Active. Detailed logic for commissionable can still apply as sub-label or color?
      // User requested Active status.
      // Let's stick to Green Active status if < 1, but maybe "Commissionable" is important?
      // members.tsx original code returns Commissionable/Non-Commissionable.
      // We can merge?
      // "Active" usually implies up to date.
      // Let's return COMMISSIONABLE/NON-COMMISSIONABLE as requested in original file?
      // Wait, original file had that.
      // User said "implement that in ... members.tsx". SQL has "Active" query.
      // If I change to "Active", I lose commissionable info?
      // Let's default to Commissionable/Non-Commissionable logic BUT if it's strictly < 1 month behind, it IS Active.
      // Just use original logic for the "Good" state?
      // Actually, let's keep Commissionable/Non as the "Active" state representation unless user wants "ACTIVE" text.
      // view_members.js has "ACTIVE" badge.
      // I will add "ACTIVE" badge logic.
    }

    // Fallback if no months_behind data or it is calculated as Active
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
        sStyles.filterTab,
        activeFilter === value && sStyles.filterTabActive
      ]}
    >
      <Text style={[
        sStyles.filterTabText,
        activeFilter === value && sStyles.filterTabTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <BackgroundLogo>
      <View style={sStyles.page}>
        <View style={sStyles.header}>
          <Text style={sStyles.headerTitle}>Member Records</Text>
          <Text style={sStyles.headerSubtitle}>{members.length} records • {activeFilter.replace('_', ' ')}</Text>
        </View>

        <View style={sStyles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sStyles.filterScroll}>
            <FilterTab label="All Members" value="ALL" />
            <FilterTab label="MS/CARD" value="MS" />
            <FilterTab label="Deferred Commissionable" value="DEFERRED" />
            <FilterTab label="Deferred Non-Commissionable" value="NON_DEFERRED" />
            <FilterTab label="Active" value="ACTIVE" />
            <FilterTab label="Warning" value="WARNING" />
            <FilterTab label="Lapsable" value="AT_RISK" />
            <FilterTab label="Lapsed" value="LAPSED" />
          </ScrollView>
        </View>

        <View style={sStyles.searchContainer}>
          <Text style={sStyles.searchIcon}>🔍</Text>
          <TextInput
            style={sStyles.searchInput}
            placeholder="Search by name, address, or AF..."
            placeholderTextColor={memorialColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={sStyles.clearButton}>
              <Text style={sStyles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {(isLoading || isRefetching) && !members.length ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={sStyles.loadingText}>Loading members...</Text>
          </View>
        ) : isError ? (
          <View style={sStyles.errorCard}>
            <Text style={sStyles.errorText}>{(error as Error)?.message}</Text>
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
                <View style={sStyles.cardWrapper}>
                  <TouchableOpacity
                    style={sStyles.card}
                    onPress={() => router.push({ pathname: "/member/[id]", params: { id: String(item.id) } })}
                    activeOpacity={0.7}
                  >
                    <View style={sStyles.cardHeader}>
                      <Text style={sStyles.memberName}>
                        {[item.last_name, item.first_name].filter(Boolean).join(", ").toUpperCase() || "—"}
                      </Text>
                      <View style={[sStyles.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[sStyles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>

                    <View style={sStyles.cardDivider} />

                    <View style={sStyles.cardDetails}>
                      <View style={sStyles.detailRow}>
                        <Text style={sStyles.detailLabel}>AF No.</Text>
                        <Text style={sStyles.detailValue}>{item.maf_no || "—"}</Text>
                      </View>
                      <View style={sStyles.detailRow}>
                        <Text style={sStyles.detailLabel}>PACKAGE</Text>
                        <Text style={sStyles.detailValue}>{item.plan_type ?? "—"}</Text>
                      </View>
                      <View style={sStyles.detailRow}>
                        <Text style={sStyles.detailLabel}>BALANCE</Text>
                        <Text style={sStyles.detailValue}>
                          {(item.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>

                    <View style={sStyles.actionsRow}>
                      <Text style={sStyles.viewDetailsLink}>View details</Text>
                      <TouchableOpacity
                        style={sStyles.expandBtn}
                        onPress={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                      >
                        <Text style={sStyles.expandText}>
                          {isExpanded ? "Hide Beneficiaries" : `Show Beneficiaries (${benes.length})`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Beneficiaries Expansion with Full Detail */}
                  {isExpanded && (
                    <View style={sStyles.beneficiariesContainer}>
                      {benes.length === 0 ? (
                        <Text style={sStyles.noBeneText}>No beneficiaries found.</Text>
                      ) : (
                        benes.map((b, idx) => (
                          <View key={idx} style={sStyles.beneRow}>
                            <View style={sStyles.beneHeader}>
                              <Text style={sStyles.beneName}>
                                {b.first_name} {b.middle_name ? b.middle_name + " " : ""}{b.last_name}
                              </Text>
                              <View style={sStyles.beneBadge}>
                                <Text style={sStyles.beneBadgeText}>{b.relation}</Text>
                              </View>
                            </View>

                            <View style={sStyles.beneDetailsGrid}>
                              {b.birth_date && (
                                <Text style={sStyles.beneDetailItem}>🎂 {b.birth_date} {b.age ? `(${b.age} yrs)` : ''}</Text>
                              )}
                              {b.address && (
                                <Text style={sStyles.beneDetailItem} numberOfLines={1}>📍 {b.address}</Text>
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
              <View style={sStyles.emptyCard}>
                <Text style={sStyles.emptyText}>No members found</Text>
                <Text style={sStyles.emptySubtext}>Try changing filters or search terms</Text>
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

const sStyles = StyleSheet.create({ // Renamed to avoid partial conflict with s() function, though s() is imported.
  // Actually, I will use regular styles object but wrap values in s()
  page: {
    flex: 1,
    padding: s(memorialSpacing.lg),
    backgroundColor: memorialColors.bgPrimary,
  },
  header: {
    marginBottom: s(memorialSpacing.md),
    paddingBottom: s(memorialSpacing.md),
    borderBottomWidth: 2,
    borderBottomColor: memorialColors.gold,
  },
  headerTitle: {
    fontSize: s(memorialFonts.xxl),
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
    marginBottom: s(memorialSpacing.xs),
  },
  headerSubtitle: {
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textMuted,
    textTransform: 'capitalize'
  },
  filterContainer: {
    marginBottom: s(memorialSpacing.md),
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingRight: s(24),
  },
  filterTab: {
    paddingHorizontal: s(memorialSpacing.md),
    paddingVertical: s(memorialSpacing.xs),
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
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textSecondary,
    fontWeight: memorialFonts.medium,
  },
  filterTabTextActive: {
    color: memorialColors.white,
  },
  loadingText: {
    color: memorialColors.textSecondary,
    fontSize: s(memorialFonts.md),
    textAlign: "center",
    padding: s(memorialSpacing.xxl),
  },
  errorCard: {
    backgroundColor: memorialColors.errorLight,
    borderRadius: memorialBorderRadius.md,
    padding: s(memorialSpacing.lg),
    borderLeftWidth: 4,
    borderLeftColor: memorialColors.error,
  },
  errorText: {
    color: memorialColors.error,
    fontSize: s(memorialFonts.md),
  },
  cardWrapper: {
    marginBottom: s(memorialSpacing.md),
  },
  card: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: s(memorialSpacing.lg),
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderLeftWidth: 4,
    borderLeftColor: memorialColors.gold,
    zIndex: 1,
  },
  cardHeader: {
    marginBottom: s(memorialSpacing.sm),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: s(memorialFonts.lg),
    fontWeight: memorialFonts.semibold,
    color: memorialColors.primary,
    flex: 1,
    marginRight: s(8),
  },
  statusBadge: {
    paddingHorizontal: s(8),
    paddingVertical: s(2),
    borderRadius: 4,
  },
  statusText: {
    fontSize: s(10),
    fontWeight: 'bold',
  },
  cardDivider: {
    height: 1,
    backgroundColor: memorialColors.paleGold,
    marginVertical: s(memorialSpacing.sm),
  },
  cardDetails: {
    marginBottom: s(memorialSpacing.sm),
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: s(memorialSpacing.xs),
  },
  detailLabel: {
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textMuted,
  },
  detailValue: {
    fontSize: s(memorialFonts.sm),
    fontWeight: memorialFonts.medium,
    color: memorialColors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(memorialSpacing.xs),
  },
  viewDetailsLink: {
    fontSize: s(memorialFonts.sm),
    color: memorialColors.primaryLight,
    fontWeight: memorialFonts.medium,
  },
  expandBtn: {
    padding: s(4),
  },
  expandText: {
    fontSize: s(memorialFonts.xs),
    color: memorialColors.textMuted,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  beneficiariesContainer: {
    marginTop: s(-10),
    backgroundColor: memorialColors.bgSecondary,
    borderBottomLeftRadius: memorialBorderRadius.xl,
    borderBottomRightRadius: memorialBorderRadius.xl,
    padding: s(memorialSpacing.lg),
    paddingTop: s(memorialSpacing.xl),
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderTopWidth: 0,
  },
  beneRow: {
    marginBottom: s(memorialSpacing.md),
    paddingBottom: s(memorialSpacing.xs),
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.silver,
  },
  beneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(4),
  },
  beneName: {
    fontSize: s(memorialFonts.md),
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textPrimary,
  },
  beneBadge: {
    backgroundColor: memorialColors.primaryLight,
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: 4,
  },
  beneBadgeText: {
    fontSize: s(10),
    color: memorialColors.white,
    textTransform: 'uppercase',
  },
  beneDetailsGrid: {
    marginTop: s(4),
  },
  beneDetailItem: {
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textSecondary,
    marginBottom: s(2),
  },
  noBeneText: {
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textMuted,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: memorialColors.cream,
    borderRadius: memorialBorderRadius.lg,
    padding: s(memorialSpacing.xxxl),
    alignItems: "center",
    marginTop: s(memorialSpacing.xxl),
    borderWidth: 1,
    borderColor: memorialColors.border,
  },
  emptyText: {
    fontSize: s(memorialFonts.lg),
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textSecondary,
    marginBottom: s(memorialSpacing.xs),
  },
  emptySubtext: {
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textMuted,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.md,
    paddingHorizontal: s(memorialSpacing.md),
    paddingVertical: s(memorialSpacing.sm),
    marginBottom: s(memorialSpacing.md),
    borderWidth: 1,
    borderColor: memorialColors.gold,
    ...memorialShadows.sm,
  },
  searchIcon: {
    fontSize: s(18),
    marginRight: s(memorialSpacing.sm),
    color: memorialColors.textMuted,
  },
  searchInput: {
    flex: 1,
    fontSize: s(memorialFonts.md),
    color: memorialColors.textPrimary,
    paddingVertical: s(memorialSpacing.xs),
  },
  clearButton: {
    padding: s(memorialSpacing.xs),
    marginLeft: s(memorialSpacing.sm),
  },
  clearIcon: {
    fontSize: s(16),
    color: memorialColors.textMuted,
  },
});
