// ✨ REDESIGNED: Memorial Services Theme - Promotions/Hierarchy
// 🎨 Visual changes: Memorial colors for org chart, peaceful styling
// ⚙️ Logic: ALL tree building, hierarchy calculations, and data fetching UNCHANGED

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../../lib/supabase";
import BackgroundLogo from "../../components/BackgroundLogo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BenefitsTab from "../../components/BenefitsTab";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../constants/memorialTheme";
import { useFocusEffect } from "expo-router";

// Cutoff helper: selected month → 7th to next 7th
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

  return { gte: fmt(start), lt: fmt(end) };
}

/* ===================== TYPES ===================== */

type Agent = {
  id: number;
  firstname: string;
  lastname: string;
  position: string;
  assigned_id: number | null;
};

type DownlineRow = {
  agent_id: number;
  firstname: string;
  lastname: string;
  position: string;
  assigned_id: number | null;
};

type TreeNode = {
  id: number;
  firstname: string;
  lastname: string;
  position: string;
  assigned_id: number | null;
  children: TreeNode[];
  hasChildren: boolean;
};

type LayoutNode = Omit<TreeNode, "children"> & {
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
};

type RecruiterBonusRow = {
  subordinate_id: number;
  firstname: string;
  lastname: string;
  monthly_bonus: number;
  outright_bonus: number;
  total_bonus: number;
};

/* ===================== HELPERS ===================== */
function displayPosition(pos?: string | null): string {
  if (!pos) return "Sales Executive";
  return pos.toLowerCase() === "agent" ? "Sales Executive" : pos;
}

/* ⚙️ UPDATED: Tree building logic using assigned_id */
function buildTree(rootAgent: Agent, rows: DownlineRow[]): TreeNode {
  const map = new Map<number, TreeNode>();

  const root: TreeNode = {
    id: rootAgent.id,
    firstname: rootAgent.firstname,
    lastname: rootAgent.lastname,
    position: rootAgent.position,
    assigned_id: null,
    children: [],
    hasChildren: false,
  };

  map.set(root.id, root);

  rows.forEach((r) => {
    map.set(r.agent_id, {
      id: r.agent_id,
      firstname: r.firstname,
      lastname: r.lastname,
      position: r.position,
      assigned_id: r.assigned_id,
      children: [],
      hasChildren: false,
    });
  });

  map.forEach((node) => {
    if (node.id === root.id) return;

    // Prevent self-reference
    if (node.assigned_id === node.id) {
      console.warn(`Promotions: Agent ${node.id} is assigned to self. Re-assigning to root.`);
      node.assigned_id = null;
    }

    // Parent is the node with id === node.assigned_id
    // If not found, attach to root
    let parent = (node.assigned_id && map.get(node.assigned_id)) || root;

    // Double check to avoid cycles/self-adding if map.get returned self somehow
    if (parent.id === node.id) parent = root;

    parent.children.push(node);
    parent.hasChildren = true;
  });

  return root;
}

/* ⚙️ UPDATED: Hierarchy List Component (Vertical List) */
const HierarchyList: React.FC<{ root: TreeNode }> = ({ root }) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([root.id]));

  const toggleNode = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isRoot = level === 0;

    return (
      <View key={node.id} style={{ marginBottom: 8 }}>
        {/* Node Card */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginLeft: level * 20, // Indentation
            backgroundColor: isRoot ? memorialColors.primary : memorialColors.bgCard,
            padding: 12,
            borderRadius: memorialBorderRadius.md,
            borderWidth: 1,
            borderColor: isRoot ? memorialColors.primaryDark : memorialColors.border,
            ...memorialShadows.sm,
          }}
        >
          {/* Collapse/Expand Icon */}
          {hasChildren ? (
            <TouchableOpacity
              onPress={() => toggleNode(node.id)}
              style={{
                marginRight: 8,
                width: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: isRoot ? memorialColors.softWhite : memorialColors.primary,
                }}
              >
                {isExpanded ? "▼" : "▶"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} /> // Spacer for alignment
          )}

          {/* Agent Info */}
          <View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: memorialFonts.semibold,
                color: isRoot ? memorialColors.softWhite : memorialColors.primary,
              }}
            >
              {node.firstname} {node.lastname}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: isRoot ? memorialColors.cream : memorialColors.textMuted,
              }}
            >
              {displayPosition(node.position)}
            </Text>
          </View>
        </View>

        {/* Children (Recursive) */}
        {isExpanded && hasChildren && (
          <View style={{ marginTop: 8 }}>
            {node.children.map((child) => renderNode(child, level + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, padding: memorialSpacing.lg }}
      contentContainerStyle={{ paddingBottom: memorialSpacing.tabBarHeight }}
    >
      {renderNode(root)}
    </ScrollView>
  );
};

/* ===================== RECRUITER BONUS COMPONENT ===================== */

const RecruiterBonusList: React.FC<{ agentId: number }> = ({ agentId }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RecruiterBonusRow[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const changeMonth = (delta: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          setLoading(true);

          let currentYear = selectedDate.getFullYear();
          let currentMonth = selectedDate.getMonth() + 1;

          // If currently viewing "this month" and it's before the 7th,
          // usually we treat "current period" as previous month.
          // BUT given the user wants to "backtrack", explicit month selection is better.
          // let's stick to the strict calendar month selected by the user,
          // OR maintain the "cutoff" logic based on the selected month.
          // The helper `cutoffRange(Y, M)` gives 7th of M-1 to 7th of M.
          // So if selectedDate is "Dec 2025", Y=2025, M=12.
          // Range: Nov 7, 2025 to Dec 7, 2025? Wait, logic says:
          // start = 7th of M-1. end = 7th of M.
          // So for "December", it fetches Nov 7 - Dec 7.
          // This seems to be the intended "commission month".

          const { gte, lt } = cutoffRange(currentYear, currentMonth);

          // 1. Fetch recruiter bonuses with collections
          const { data: commissions } = await supabase
            .from("commissions")
            .select("amount, recruiter_id, collections(payment_for)")
            .eq("agent_id", agentId)
            .eq("commission_type", "recruiter_bonus")
            .gte("date_earned", gte)
            .lt("date_earned", lt);

          if (!commissions || commissions.length === 0) {
            setRows([]);
            return;
          }

          // 2. Collect recruiter_ids (downlines)
          const downlineIds = new Set<number>();
          commissions.forEach((c: any) => {
            if (c.recruiter_id) downlineIds.add(c.recruiter_id);
          });

          // 3. Fetch downline details
          const { data: agents } = await supabase
            .from("agents")
            .select("id, firstname, lastname")
            .in("id", Array.from(downlineIds));

          const agentMap = new Map();
          (agents || []).forEach((a: any) => {
            agentMap.set(a.id, a);
          });

          // 4. Group and calculate
          const groups = new Map<number, RecruiterBonusRow>();

          for (const comm of commissions) {
            const subId = comm.recruiter_id;
            if (!subId) continue;

            const subAgent = agentMap.get(subId);
            if (!subAgent) continue;

            if (!groups.has(subId)) {
              groups.set(subId, {
                subordinate_id: subId,
                firstname: subAgent.firstname,
                lastname: subAgent.lastname,
                monthly_bonus: 0,
                outright_bonus: 0,
                total_bonus: 0,
              });
            }

            const g = groups.get(subId)!;
            const amount = Number(comm.amount || 0);
            const col = Array.isArray(comm.collections) ? comm.collections[0] : comm.collections;
            const type = col?.payment_for;

            if (type === "regular") {
              g.monthly_bonus += amount;
            } else {
              // Assume everything else is Outright/Spot Cash for now
              g.outright_bonus += amount;
            }
            g.total_bonus += amount;
          }

          const result = Array.from(groups.values()).sort((a, b) => b.total_bonus - a.total_bonus);
          setRows(result);

        } catch (err) {
          console.error("Error loading bonuses:", err);
        } finally {
          setLoading(false);
        }
      };

      load();
    }, [agentId, selectedDate])
  );

  const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <ScrollView
      style={{ flex: 1, padding: memorialSpacing.lg }}
      contentContainerStyle={{ paddingBottom: memorialSpacing.tabBarHeight }}
    >
      {/* Date Selector */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: memorialSpacing.md,
          backgroundColor: memorialColors.bgCard,
          padding: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: memorialColors.border,
          ...memorialShadows.sm,
        }}
      >
        <TouchableOpacity
          onPress={() => changeMonth(-1)}
          style={{
            padding: 8,
            width: 40,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 18, color: memorialColors.primary }}>◀</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: memorialFonts.md, fontWeight: memorialFonts.semibold, color: memorialColors.primary }}>
          {monthName}
        </Text>

        <TouchableOpacity
          onPress={() => changeMonth(1)}
          style={{
            padding: 8,
            width: 40,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 18, color: memorialColors.primary }}>▶</Text>
        </TouchableOpacity>
      </View>

      <Text style={{
        fontSize: memorialFonts.sm,
        color: memorialColors.textMuted,
        marginBottom: memorialSpacing.md,
        textAlign: "center"
      }}>
        Recruiter Bonus Breakdown
      </Text>

      {loading && <ActivityIndicator size="small" color={memorialColors.primary} />}

      {!loading && rows.length === 0 && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: memorialColors.textMuted }}>No recruiter bonuses found for this month.</Text>
        </View>
      )}

      {!loading && rows.map((row) => (
        <View key={row.subordinate_id} style={styles.bonusCard}>
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.bonusName}>{row.firstname} {row.lastname}</Text>
          </View>

          <View style={styles.bonusRow}>
            <Text style={styles.bonusSub}>Monthly Bonus:</Text>
            <Text style={styles.bonusSub}>₱{row.monthly_bonus.toFixed(2)}</Text>
          </View>

          <View style={styles.bonusRow}>
            <Text style={styles.bonusSub}>Outright Bonus:</Text>
            <Text style={styles.bonusSub}>₱{row.outright_bonus.toFixed(2)}</Text>
          </View>

          <View style={[styles.bonusRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: memorialColors.borderLight, paddingTop: 4 }]}>
            <Text style={{ fontWeight: "bold", color: memorialColors.primary }}>Total:</Text>
            <Text style={styles.bonusAmount}>
              ₱{row.total_bonus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      ))
      }
      < View style={{ height: 40 }} />
    </ScrollView>
  );
};

/* ===================== MAIN ===================== */

export default function Promotions() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [rows, setRows] = useState<DownlineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tree" | "benefits" | "recruiter">("tree");
  const [rulesExpanded, setRulesExpanded] = useState(false); // 💎 NEW: Collapsible rules state


  // ⚙️ UNCHANGED: Agent ID retrieval logic
  const getAgentId = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    const user_id = session?.user?.id;
    if (!user_id) {
      console.log("Promotions: No user_id found in session");
      return null;
    }
    console.log("Promotions: Current user_id:", user_id);

    const cached = await AsyncStorage.getItem("agent_id");
    console.log("Promotions: Cached agent_id:", cached);

    if (cached) {
      console.log("Promotions: Using cached agent_id:", cached);
      return Number(cached);
    }

    console.log("Promotions: Fetching agent_id from DB...");
    const { data } = await supabase
      .from("users_profile")
      .select("agent_id")
      .eq("user_id", user_id)
      .maybeSingle();

    console.log("Promotions: DB Result:", data);

    if (!data?.agent_id) return null;

    await AsyncStorage.setItem("agent_id", String(data.agent_id));
    return data.agent_id;
  }, []);

  // ⚙️ UPDATED: Data loading logic with assigned_id
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const id = await getAgentId();
      if (!id) return;

      const { data: agentData } = await supabase
        .from("agents")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      console.log("Promotions: Fetching hierarchy for root:", id);

      // 1. Fetch the hierarchy structure (IDs only)
      const { data: rawDownlines, error: hierError } = await supabase
        .from("full_hierarchy_downlines")
        .select("agent_id")
        .eq("root_id", id);

      if (hierError) {
        console.error("Promotions: Hierarchy error:", hierError);
        throw hierError;
      }

      // 2. Collect IDs to fetch details
      const agentIds = (rawDownlines || []).map((r: any) => r.agent_id);

      // 3. Fetch agent details manually (including assigned_id)
      const { data: agentsDetails, error: agentsError } = await supabase
        .from("agents")
        .select("id, firstname, lastname, position, assigned_id")
        .in("id", agentIds);

      if (agentsError) {
        console.error("Promotions: Agents fetch error:", agentsError);
        throw agentsError;
      }

      // 4. Create a map for quick lookup
      const agentsMap = new Map();
      (agentsDetails || []).forEach((a: any) => {
        agentsMap.set(a.id, a);
      });

      // 5. Merge data
      const downlines = (rawDownlines || []).map((r: any) => {
        const details = agentsMap.get(r.agent_id);
        return {
          agent_id: r.agent_id,
          assigned_id: details?.assigned_id || null,
          firstname: details?.firstname || "Unknown",
          lastname: details?.lastname || "Agent",
          position: details?.position || "Sales Executive",
        };
      });

      const filtered = downlines.filter(
        (r: any) => r.agent_id !== id
      );
      console.log("Promotions: Filtered rows (excluding root):", filtered.length);

      setAgent(agentData as Agent);
      setRows(filtered as DownlineRow[]);
    } catch (err: any) {
      console.error("Promotions Load Error:", err);
      alert("Error loading promotions: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [getAgentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading)
    return (
      <BackgroundLogo>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={memorialColors.primary} />
        </View>
      </BackgroundLogo>
    );

  if (!agent) return null;

  const treeRoot = buildTree(agent, rows);

  return (
    <BackgroundLogo>
      <View style={{ flex: 1 }}>
        {/* 💎 LUXURIOUS: Premium header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {agent.firstname} {agent.lastname}
          </Text>
          <Text style={styles.headerSubtitle}>
            {displayPosition(agent.position)}
          </Text>
        </View>

        {/* 💎 LUXURIOUS: Collapsible promotion rules card */}
        <TouchableOpacity
          style={styles.rulesCard}
          onPress={() => setRulesExpanded(!rulesExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.rulesHeader}>
            <Text style={styles.rulesTitle}>
              📌 Promotion Rules
            </Text>
            <Text style={styles.rulesToggle}>
              {rulesExpanded ? '▲' : '▼'}
            </Text>
          </View>

          {rulesExpanded && (
            <>
              <Text style={styles.ruleText}>
                ✅ 20 direct Agents / Sales Executives - Assistant Supervisor
              </Text>
              <Text style={styles.ruleText}>
                ✅ 10 direct Assistant Supervisors - Marketing Supervisor
              </Text>
              <Text style={styles.ruleText}>
                ✅ 3 direct Marketing Supervisors - Marketing Head
              </Text>

              <Text style={styles.ruleFooter}>
                Grow your team to grow your rank.
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* 🎨 VISUAL: Memorial-themed toggle buttons */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab("tree")}
            style={[
              styles.tabButton,
              activeTab === "tree" && styles.tabButtonActive
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "tree" && styles.tabTextActive
              ]}
            >
              Hierarchy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("benefits")}
            style={[
              styles.tabButton,
              activeTab === "benefits" && styles.tabButtonActive
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "benefits" && styles.tabTextActive
              ]}
            >
              Benefits
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("recruiter")}
            style={[
              styles.tabButton,
              activeTab === "recruiter" && styles.tabButtonActive
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "recruiter" && styles.tabTextActive
              ]}
            >
              Recruiter Bonus
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        <View style={{ flex: 1, backgroundColor: memorialColors.bgPrimary }}>
          {activeTab === "tree" ? (
            <HierarchyList root={treeRoot} />
          ) : activeTab === "benefits" ? (
            <BenefitsTab />
          ) : (
            <RecruiterBonusList agentId={agent.id} />
          )}
        </View>
      </View>
    </BackgroundLogo >
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // 💎 LUXURIOUS: Premium header
  header: {
    padding: memorialSpacing.xxl,
    paddingBottom: memorialSpacing.lg,
    backgroundColor: memorialColors.primary,
    borderBottomWidth: 2,
    borderBottomColor: memorialColors.gold,
  },

  headerTitle: {
    fontSize: memorialFonts.xxxl,
    fontWeight: memorialFonts.bold,
    color: memorialColors.white,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  headerSubtitle: {
    color: memorialColors.goldLight,
    fontSize: memorialFonts.lg,
    marginTop: memorialSpacing.xs,
    fontStyle: "italic",
  },

  // 💎 LUXURIOUS: Collapsible premium rules card
  rulesCard: {
    backgroundColor: memorialColors.white,
    margin: memorialSpacing.lg,
    padding: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.xl,
    borderLeftWidth: 4,
    borderLeftColor: memorialColors.gold,
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.silver,
  },

  rulesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: memorialSpacing.xs,
  },

  rulesTitle: {
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.lg,
    color: memorialColors.black,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  rulesToggle: {
    fontSize: memorialFonts.lg,
    color: memorialColors.gold,
    fontWeight: memorialFonts.bold,
  },

  ruleText: {
    fontSize: memorialFonts.sm,
    marginBottom: memorialSpacing.xs,
    color: memorialColors.textSecondary,
  },

  ruleFooter: {
    marginTop: memorialSpacing.sm,
    fontStyle: "italic",
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
  },

  // 🎨 VISUAL: Memorial-themed tabs
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: memorialSpacing.lg,
    marginBottom: memorialSpacing.sm,
  },



  tabButton: {
    flex: 1,
    padding: memorialSpacing.md,
    borderRadius: memorialBorderRadius.md,
    backgroundColor: memorialColors.cream,
    alignItems: "center",
    borderWidth: 1,
    borderColor: memorialColors.border,
    marginHorizontal: memorialSpacing.xs / 2, // Replaces gap
  },

  tabButtonActive: {
    backgroundColor: memorialColors.primary,
    borderColor: memorialColors.primaryDark,
  },

  tabText: {
    fontWeight: memorialFonts.semibold,
    color: memorialColors.textSecondary,
    fontSize: memorialFonts.md,
  },

  tabTextActive: {
    color: memorialColors.softWhite,
  },

  // 💎 LUXURIOUS: Premium zoom buttons
  zoomBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: memorialColors.gold,
    justifyContent: "center",
    alignItems: "center",
    ...memorialShadows.gold,
    borderWidth: 2,
    borderColor: memorialColors.white,
  },

  zoomText: {
    color: memorialColors.black,
    fontSize: 26,
    fontWeight: memorialFonts.black,
    lineHeight: 30,
  },

  // 💎 LUXURIOUS: Premium bonus card
  bonusCard: {
    backgroundColor: memorialColors.white,
    padding: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.xl,
    marginBottom: memorialSpacing.md,
    ...memorialShadows.lg,
    borderLeftWidth: 4,
    borderLeftColor: memorialColors.gold,
    borderWidth: 1,
    borderColor: memorialColors.silver,
  },
  bonusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bonusName: {
    fontSize: memorialFonts.md,
    fontWeight: memorialFonts.semibold,
    color: memorialColors.primary,
  },
  bonusSub: {
    fontSize: memorialFonts.xs,
    color: memorialColors.textMuted,
    marginTop: 2,
  },
  bonusAmount: {
    fontSize: memorialFonts.lg,
    fontWeight: memorialFonts.bold,
    color: memorialColors.success,
  },
});
