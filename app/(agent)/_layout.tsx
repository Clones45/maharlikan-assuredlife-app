// ✨ REDESIGNED: Memorial Services Theme - Tab Layout
// 🎨 Visual changes: Deep green header/tabs, respectful icon updates
// ⚙️ Logic: ALL authentication, routing, and notification logic UNCHANGED

import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, router, usePathname } from "expo-router";
import { supabase } from "../../lib/supabase";
import { TabIcon } from "../../components/TabIcon";
import { memorialColors } from "../../constants/memorialTheme"; // ✨ NEW: Memorial theme
import { GlassTabBar } from "../../components/GlassTabBar";
import { useToast } from "../../components/ToastProvider";
import AgentHeader from "../../components/AgentHeader"; // ✨ NEW: Fixed Header

const PROFILE_TABLE = "users_profile";

export default function AgentTabsLayout() {
  const pathname = usePathname();
  const shouldHideTabs = pathname.includes("/member/");
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { showToast } = useToast();
  const [agentId, setAgentId] = useState<number | null>(null);

  // ⚙️ UNCHANGED: All authentication and role checking logic
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data?.session) {
        router.replace("/login");
        return;
      }

      setUserId(data.session.user.id);

      const { data: prof, error } = await supabase
        .from(PROFILE_TABLE)
        .select("role, agent_id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        // 🛡️ SECURITY: Only sign out if it's strictly an auth/permissions issue
        if (error.code === "PGRST116" || error.message.includes("JWT")) {
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }
      }

      // Save agent ID for notifications
      if (prof?.agent_id) setAgentId(prof.agent_id);

      const role = String(prof?.role ?? "").toLowerCase();
      if (role === "admin") {
        router.replace("/(admin)");
        return;
      }
      if (role !== "agent") {
        router.replace("/login");
        return;
      }

      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/login");
    });

    // 🔔 REALTIME NOTIFICATIONS
    const channel = supabase
      .channel('agent-withdrawals')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `agent_id=eq.${agentId}`, // Listen only for this agent's requests
        },
        (payload) => {
          const newItem = payload.new;
          const oldItem = payload.old; // May be empty depending on replica identity

          if (newItem.status === 'approved' && oldItem.status !== 'approved') {
            showToast('success', 'Commission Approved!', `Your withdrawal of ₱${newItem.amount} has been approved.`);
          } else if (newItem.status === 'rejected' && oldItem.status !== 'rejected') {
            showToast('error', 'Withdrawal Rejected', `Your request for ₱${newItem.amount} was rejected.`);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
      supabase.removeChannel(channel);
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: memorialColors.bgPrimary }}>
        {/* 🎨 VISUAL: Memorial-themed loading indicator */}
        <ActivityIndicator size="large" color={memorialColors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        header: () => <AgentHeader userId={userId} agentId={agentId} />,
        tabBarStyle: shouldHideTabs ? { display: "none" } : undefined,
      }}
    >
      <Tabs.Screen
        name="members"
        options={{
          title: "Members",
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: "Promotions",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />

      <Tabs.Screen
        name="commission"
        options={{
          title: "Commission",
        }}
      />

      <Tabs.Screen
        name="AddMemberScreen"
        options={{
          title: "Add Member",
        }}
      />

      {/* ⚙️ UNCHANGED: Hidden internal routes */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="member/[id]" options={{ href: null }} />
      <Tabs.Screen name="member/soa" options={{ href: null }} />
    </Tabs>
  );
}
