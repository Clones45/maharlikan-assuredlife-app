// app/index.tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

const PROFILE_TABLE = "users_profile"; // <-- IMPORTANT

export default function Index() {
  const [msg, setMsg] = useState("Loading…");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setMsg("Checking session…");
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!alive) return;

        if (!session) {
          router.replace("/login");
          return;
        }

        setMsg("Fetching role…");
        const { data: prof, error } = await supabase
          .from(PROFILE_TABLE)
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!alive) return;

        if (error || !prof?.role) {
          router.replace("/login");
          return;
        }

        const role = String(prof.role).toLowerCase();
        if (role === "admin") router.replace("/(admin)");
        else if (role === "agent") router.replace("/(agent)");
        else if (role === "member") router.replace("/(member)");
        else router.replace("/login");
      } catch {
        router.replace("/login");
      }
    }

    run();

    // if auth is lost, go to login
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.replace("/login");
    });

    // safety: if something hangs > 7s, force login
    const t = setTimeout(() => router.replace("/login"), 7000);

    return () => {
      alive = false;
      clearTimeout(t);
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={{ marginTop: 10, color: "#334155" }}>{msg}</Text>
    </View>
  );
}
