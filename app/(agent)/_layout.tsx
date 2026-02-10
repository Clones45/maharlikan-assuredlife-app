import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { Tabs, router, usePathname } from "expo-router";
import { supabase, signOutUsername } from "../../lib/supabase";
import { TabIcon } from "../../components/TabIcon";
import { memorialColors } from "../../constants/memorialTheme"; // ✨ NEW: Memorial theme
import { GlassTabBar } from "../../components/GlassTabBar";
import { useToast } from "../../components/ToastProvider";
import AgentHeader from "../../components/AgentHeader"; // ✨ NEW: Fixed Header
import AddEmailModal from "../../components/AddEmailModal"; // ✨ NEW: Email Verification
import VerificationEntryModal from "../../components/VerificationEntryModal"; // ✨ NEW: Verification Modal

const PROFILE_TABLE = "users_profile";

export const AgentVerificationContext = React.createContext<boolean>(false);

export default function AgentTabsLayout() {
  const pathname = usePathname();
  const shouldHideTabs = pathname.includes("/member/");
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { showToast } = useToast();
  const [agentId, setAgentId] = useState<number | null>(null);

  // ✨ NEW: Email Verification State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [isVerified, setIsVerified] = useState<boolean>(false); // 🔒 SECURE DEFAULT: Locked until proven verified
  const [showVerificationModal, setShowVerificationModal] = useState(false);

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
      const email = data.session.user.email || "";
      setCurrentEmail(email);

      // 🔍 CHECK: If email is placeholder or missing, show modal immediately
      if (!email || email.includes("@maharlikan.local")) {
        setShowEmailModal(true);
      }

      const { data: prof, error } = await supabase
        .from(PROFILE_TABLE)
        .select("role, agent_id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        // 🛡️ SECURITY: Only sign out if it's strictly an auth/permissions issue
        if (error.code === "PGRST116" || error.message.includes("JWT")) {
          await signOutUsername();
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

      // 🔐 CHECK VERIFICATION STATUS
      if (prof?.agent_id) {
        console.log("[_layout] Checking verification for agent:", prof.agent_id);
        const { data: agentData, error: agentErr } = await supabase
          .from('agents')
          .select('is_verified')
          .eq('id', prof.agent_id)
          .single();

        if (agentErr) console.error("[_layout] Agent fetch error:", agentErr);
        console.log("[_layout] Agent data:", agentData);

        const verified = agentData?.is_verified ?? false; // Changed default to FALSE to see if it locks
        console.log("[_layout] Resolved verified status:", verified);
        setIsVerified(verified);

        if (!verified) {
          console.log("[_layout] Agent is restricted. Checking recruit count...");
          // Check recruit count (Need 2 recruits + self = 3)
          const { count, error: countErr } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', prof.agent_id);

          console.log("[_layout] Recruit count:", count, "Error:", countErr);

          if ((count || 0) >= 2) {
            setShowVerificationModal(true);
            // Note: Admin will manually generate and send verification codes via admin panel
          }

          // Redirect to Add Member if strictly enforced (and not already there)
          // We'll let the Tab logic handle hiding, but if they are on index, we might want to push them
          if (pathname === '/(agent)' || pathname === '/(agent)/') {
            router.replace('/(agent)/AddMemberScreen');
          }
        }
      }

      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/login");
    });

    // ... (Notification logic unchanged) ... 
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

  // 🛡️ NAVIGATION GUARD: Removed in favor of Locked View component per new requirements
  // Logic is now handled by individual screens using the Context

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: memorialColors.bgPrimary }}>
        {/* 🎨 VISUAL: Memorial-themed loading indicator */}
        <ActivityIndicator size="large" color={memorialColors.primary} />
      </View>
    );
  }

  return (
    <AgentVerificationContext.Provider value={isVerified}>
      <Tabs
        tabBar={(props) => <GlassTabBar {...props} />}
        screenOptions={{
          header: () => <AgentHeader userId={userId} agentId={agentId} />,
          // tabBarStyle: shouldHideTabs ? { display: "none" } : undefined, // Removed hiding logic
        }}
      >
        <Tabs.Screen
          name="members"
          options={{ title: "Members" }}
        />
        <Tabs.Screen
          name="promotions"
          options={{ title: "Promotions" }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile" }}
        />

        <Tabs.Screen
          name="commission"
          options={{ title: "Commission" }}
        />

        <Tabs.Screen
          name="AddMemberScreen"
          options={{
            title: "Add Member",
            // Always accessible
          }}
        />

        {/* ⚙️ UNCHANGED: Hidden internal routes */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="member/[id]" options={{ href: null }} />
        <Tabs.Screen name="member/soa" options={{ href: null }} />
        <Tabs.Screen name="add-recruit" options={{ href: null }} />
      </Tabs>

      {/* ✨ Email Verification Modal */}
      <AddEmailModal
        visible={showEmailModal}
        currentEmail={currentEmail}
        onSuccess={(newEmail) => {
          setCurrentEmail(newEmail);
          setShowEmailModal(false);
          showToast('success', 'Email Verified', 'Your personal email has been securely linked.');
        }}
      />

      {/* 🔐 Agent Verification Modal */}
      <VerificationEntryModal
        visible={showVerificationModal}
        agentId={agentId || 0}
        onVerified={() => {
          setShowVerificationModal(false);
          setIsVerified(true);
          showToast('success', 'Agent Verified', 'You now have full access to current features.');
          router.replace('/(agent)');
        }}
      />
    </AgentVerificationContext.Provider>
  );
}
