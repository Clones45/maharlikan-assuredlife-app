import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, router, usePathname } from "expo-router";
import { supabase } from "../../lib/supabase";
import { TabIcon } from "../../components/TabIcon";
import { colors } from "../../lib/theme";
import NotificationDropdown from "../../components/NotificationDropdown"; // ✅ added

const PROFILE_TABLE = "users_profile";

export default function AgentTabsLayout() {
  const pathname = usePathname();
  const shouldHideTabs = pathname.includes("/member/");
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null); // ✅ new state

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data?.session) {
        router.replace("/login");
        return;
      }

      setUserId(data.session.user.id); // ✅ store agent id

      const { data: prof } = await supabase
        .from(PROFILE_TABLE)
        .select("role")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

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

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#dbeafe",
        tabBarStyle: shouldHideTabs
          ? { display: "none" }
          : { backgroundColor: colors.primary },

        // ✅ Add this block for dropdown
        headerRight: () =>
          userId ? (
            <View style={{ marginRight: 12 }}>
              <NotificationDropdown userId={userId} />
            </View>
          ) : null,
      }}
    >
      {/* visible tabs */}
      <Tabs.Screen
        name="members"
        options={{
          title: "Members",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: "Promotions",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="pricetags" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="commission"
        options={{
          title: "Commission",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="cash" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="AddMemberScreen"
        options={{
          title: "Add Member",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-circle" color={color} size={size} />
          ),
        }}
      />
      

      {/* hidden (internal) routes */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="member/[id]" options={{ href: null }} />
      <Tabs.Screen name="member/soa" options={{ href: null }} />
    </Tabs>
  );
}
