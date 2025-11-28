// app/(agent)/promotions.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../../lib/supabase";
import BackgroundLogo from "../../components/BackgroundLogo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";
import BenefitsTab from "../../components/BenefitsTab";

/* ===================== TYPES ===================== */

type Agent = {
  id: number;
  firstname: string;
  lastname: string;
  position: string;
  recruiter_id: number | null;
};

type DownlineRow = {
  agent_id: number;
  firstname: string;
  lastname: string;
  position: string;
  recruiter_id: number | null;
};

type TreeNode = {
  id: number;
  firstname: string;
  lastname: string;
  position: string;
  recruiter_id: number | null;
  children: TreeNode[];
};

type LayoutNode = Omit<TreeNode, "children"> & {
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
};

/* ===================== HELPERS ===================== */
function displayPosition(pos?: string | null): string {
  if (!pos) return "Sales Executive";
  return pos.toLowerCase() === "agent" ? "Sales Executive" : pos;
}

/* ===================== BUILD TREE ===================== */
function buildTree(rootAgent: Agent, rows: DownlineRow[]): TreeNode {
  const map = new Map<number, TreeNode>();

  const root: TreeNode = {
    id: rootAgent.id,
    firstname: rootAgent.firstname,
    lastname: rootAgent.lastname,
    position: rootAgent.position,
    recruiter_id: null,
    children: [],
  };

  map.set(root.id, root);

  rows.forEach((r) => {
    map.set(r.agent_id, {
      id: r.agent_id,
      firstname: r.firstname,
      lastname: r.lastname,
      position: r.position,
      recruiter_id: r.recruiter_id,
      children: [],
    });
  });

  map.forEach((node) => {
    if (node.id === root.id) return;
    const parent = map.get(node.recruiter_id!) || root;
    parent.children.push(node);
  });

  return root;
}

/* ===================== TREE LAYOUT ENGINE ===================== */

const NODE_WIDTH = 160;
const NODE_HEIGHT = 70;
const GAP_X = 30;
const GAP_Y = 80;

function calculateLayout(root: TreeNode): LayoutNode {
  const measure = (node: TreeNode): LayoutNode => {
    if (node.children.length === 0) {
      return { ...node, x: 0, y: 0, width: NODE_WIDTH, children: [] };
    }

    const children = node.children.map(measure);
    const childrenTotalWidth =
      children.reduce((sum, c) => sum + c.width, 0) +
      (children.length - 1) * GAP_X;

    return {
      ...node,
      x: 0,
      y: 0,
      width: Math.max(NODE_WIDTH, childrenTotalWidth),
      children,
    };
  };

  const measuredRoot = measure(root);

  const assign = (node: LayoutNode, x: number, y: number) => {
    node.x = x + node.width / 2;
    node.y = y;

    let currentX = x;

    const childrenTotalWidth =
      node.children.reduce((sum, c) => sum + c.width, 0) +
      (node.children.length - 1) * GAP_X;

    if (node.width > childrenTotalWidth) {
      currentX += (node.width - childrenTotalWidth) / 2;
    }

    node.children.forEach((child) => {
      assign(child, currentX, y + NODE_HEIGHT + GAP_Y);
      currentX += child.width + GAP_X;
    });
  };

  assign(measuredRoot, 0, 50);
  return measuredRoot;
}

/* ===================== COMPONENT ===================== */

const OrgChartTree: React.FC<{ root: TreeNode }> = ({ root }) => {
  const { width: screenWidth } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  const layoutRoot = calculateLayout(root);

  const nodes: LayoutNode[] = [];
  const collectNodes = (n: LayoutNode) => {
    nodes.push(n);
    n.children.forEach(collectNodes);
  };
  collectNodes(layoutRoot);

  const baseContentWidth = Math.max(screenWidth, layoutRoot.width);
  const baseContentHeight = Math.max(
    500,
    ...nodes.map((n) => n.y + NODE_HEIGHT + 50)
  );

  const scaledWidth = baseContentWidth * zoom;
  const scaledHeight = baseContentHeight * zoom;

  return (
    <View style={{ flex: 1, position: "relative" }}>
      {/* ZOOM CONTROLS */}
      <View
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 100,
          flexDirection: "column",
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => setZoom((z) => Math.min(z + 0.1, 2))}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setZoom((z) => Math.max(z - 0.1, 0.4))}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomText}>-</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={{
          width: Math.max(screenWidth, scaledWidth),
          height: Math.max(500, scaledHeight),
        }}
      >
        <ScrollView
          contentContainerStyle={{
            width: Math.max(screenWidth, scaledWidth),
            height: Math.max(500, scaledHeight),
          }}
        >
          <View
            style={{
              width: baseContentWidth,
              height: baseContentHeight,
              transform: [
                { scale: zoom },
                { translateX: (baseContentWidth * (zoom - 1)) / 2 },
                { translateY: (baseContentHeight * (zoom - 1)) / 2 },
              ],
            }}
          >
            <Svg
              width={baseContentWidth}
              height={baseContentHeight}
              style={StyleSheet.absoluteFill}
            >
              {nodes.map((node) =>
                node.children.map((child) => {
                  const startX = node.x;
                  const startY = node.y + NODE_HEIGHT;
                  const endX = child.x;
                  const endY = child.y;
                  const midY = (startY + endY) / 2;

                  const d = `M${startX},${startY} 
                             C${startX},${midY} ${endX},${midY} ${endX},${endY}`;

                  return (
                    <Path
                      key={`link-${node.id}-${child.id}`}
                      d={d}
                      stroke="#9CA3AF"
                      strokeWidth={2}
                      fill="none"
                    />
                  );
                })
              )}
            </Svg>

            {nodes.map((node) => {
              const isRoot = node.id === root.id;

              return (
                <View
                  key={node.id}
                  style={{
                    position: "absolute",
                    left: node.x - NODE_WIDTH / 2,
                    top: node.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    backgroundColor: isRoot ? "#111827" : "#FFFFFF",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isRoot ? "#111827" : "#E5E7EB",
                    padding: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: isRoot ? "#FFFFFF" : "#111827",
                    }}
                  >
                    {node.firstname} {node.lastname}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 11,
                      color: isRoot ? "#D1D5DB" : "#6B7280",
                    }}
                  >
                    {displayPosition(node.position)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

/* ===================== MAIN ===================== */

export default function Promotions() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [rows, setRows] = useState<DownlineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tree" | "benefits">("tree");


  const getAgentId = useCallback(async () => {
    const { data: session } = await supabase.auth.getUser();
    const user_id = session?.user?.id;
    if (!user_id) return null;

    const cached = await AsyncStorage.getItem("agent_id");
    if (cached) return Number(cached);

    const { data } = await supabase
      .from("users_profile")
      .select("agent_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!data?.agent_id) return null;

    await AsyncStorage.setItem("agent_id", String(data.agent_id));
    return data.agent_id;
  }, []);

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

      const { data: downlines } = await supabase
        .from("full_hierarchy_downlines")
        .select("*")
        .eq("root_id", id);

      const filtered = (downlines || []).filter(
        (r: any) => r.agent_id !== id
      );

      setAgent(agentData as Agent);
      setRows(filtered as DownlineRow[]);
    } finally {
      setLoading(false);
    }
  }, [getAgentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <BackgroundLogo>
        <ActivityIndicator size="large" color="#0b4aa2" />
      </BackgroundLogo>
    );

  if (!agent) return null;

  const treeRoot = buildTree(agent, rows);

  return (
    <BackgroundLogo>
      <View style={{ flex: 1 }}>
        {/* ===== HEADER ===== */}
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#111827" }}>
            {agent.firstname} {agent.lastname}
          </Text>
          <Text style={{ color: "#6B7280" }}>
            {displayPosition(agent.position)}
          </Text>
        </View>

        {/* ✅ PROMOTION RULES NOTE (ONLY THIS WAS ADDED) */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            margin: 16,
            padding: 14,
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: "#0b4aa2",
          }}
        >
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>
            📌 Promotion Rules
          </Text>

          <Text style={styles.noteText}>
            ✅ 20 direct Agents / Sales Executives → Assistant Supervisor
          </Text>
          <Text style={styles.noteText}>
            ✅ 10 direct Assistant Supervisors → Marketing Supervisor
          </Text>
          <Text style={styles.noteText}>
            ✅ 3 direct Marketing Supervisors → Marketing Head
          </Text>

          <Text
            style={{
              marginTop: 6,
              fontStyle: "italic",
              fontSize: 12,
              color: "#6B7280",
            }}
          >
            Grow your team to grow your rank.
          </Text>
        </View>

        {/* ===== TREE VIEW ===== */}
        {/* ===== TOGGLE BUTTONS ===== */}
<View style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8 }}>
  <TouchableOpacity
    onPress={() => setActiveTab("tree")}
    style={{
      flex: 1,
      padding: 10,
      borderRadius: 8,
      backgroundColor: activeTab === "tree" ? "#0b4aa2" : "#E5E7EB",
      marginRight: 6,
    }}
  >
    <Text
      style={{
        textAlign: "center",
        fontWeight: "700",
        color: activeTab === "tree" ? "#FFFFFF" : "#111827",
      }}
    >
      Hierarchy
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => setActiveTab("benefits")}
    style={{
      flex: 1,
      padding: 10,
      borderRadius: 8,
      backgroundColor: activeTab === "benefits" ? "#0b4aa2" : "#E5E7EB",
      marginLeft: 6,
    }}
  >
    <Text
      style={{
        textAlign: "center",
        fontWeight: "700",
        color: activeTab === "benefits" ? "#FFFFFF" : "#111827",
      }}
    >
      Benefits
    </Text>
  </TouchableOpacity>
</View>

{/* ===== TAB CONTENT ===== */}
<View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
  {activeTab === "tree" ? (
    <OrgChartTree root={treeRoot} />
  ) : (
    <BenefitsTab />
  )}
</View>
</View>

    </BackgroundLogo>
    
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  noteText: {
    fontSize: 13,
    marginBottom: 4,
  },
});
