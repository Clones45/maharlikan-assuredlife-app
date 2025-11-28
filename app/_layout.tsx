// app/_layout.tsx
import "react-native-gesture-handler";
import "react-native-reanimated";
import { LogBox, ActivityIndicator, View, AppState } from "react-native";

LogBox.ignoreLogs([
  "Functions are not valid as a React child",
  "shadow style props are deprecated",
  "props.pointerEvents is deprecated",
]);

import { Stack, router, usePathname } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import * as Updates from "expo-updates";

import {
  supabase,
  ensureAuthConsistency,
  currentUser,
} from "../lib/supabase";

const PUBLIC_PREFIXES = ["/lookup", "/promotions"];
const ADMIN_HOME = "/(admin)";
const AGENT_HOME = "/(agent)/profile";
const LOGIN_ROUTE = "/login";

/* ============================================================
   🔥 FORCED OTA UPDATE (blocks app until updated)
============================================================ */
function useForcedUpdate() {
  const [updating, setUpdating] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        if (__DEV__) {
          setUpdating(false);
          return;
        }

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.log("🔥 FORCED UPDATE FOUND — downloading…");

          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // reload now (forces update)
          return; // app will reload
        } else {
          console.log("✔ No forced update needed");
        }
      } catch (err) {
        console.log("Forced update error:", err);
      }

      // continue boot normally
      setUpdating(false);
    };

    checkUpdate();
  }, []);

  return updating;
}

/* ============================================================
   🔵 FETCH ROLE
============================================================ */
async function fetchRoleSmart(): Promise<"admin" | "agent" | "member" | null> {
  try {
    const { data } = await supabase.auth.getUser();
    const metaRole = data?.user?.user_metadata?.role;
    if (metaRole) return metaRole as any;
  } catch {}

  try {
    const cu = await currentUser();
    if (cu?.role) return cu.role as any;
  } catch {}

  const readTable = async (table: string) => {
    try {
      const au = await supabase.auth.getUser();
      const uid = au?.data?.user?.id;
      if (!uid) return null;

      const { data } = await supabase
        .from(table)
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      const r = data?.role ? String(data.role).toLowerCase() : null;
      if (r && ["admin", "agent", "member"].includes(r)) return r as any;
    } catch {}

    return null;
  };

  return (
    (await readTable("users_profile")) ||
    (await readTable("user_profile")) ||
    null
  );
}

/* ============================================================
   🔵 AUTH GATE
============================================================ */
function AuthGate() {
  const pathname = usePathname();
  const [booted, setBooted] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let alive = true;

    const go = (target: string) => {
      if (pathname === target) return;
      router.replace(target);
    };

    const decide = async () => {
      await ensureAuthConsistency(false);

      const { data } = await supabase.auth.getSession();
      const hasSession = !!data?.session;

      if (!alive) return;

      const isPublic = PUBLIC_PREFIXES.some((p) =>
        pathname.startsWith(p)
      );

      if (!hasSession) {
        if (isPublic || pathname === "/login") {
          setBooted(true);
          return;
        }
        go(LOGIN_ROUTE);
        setBooted(true);
        return;
      }

      if (pathname === "/login") {
        const role = await fetchRoleSmart();
        if (!alive) return;

        if (role === "admin") go(ADMIN_HOME);
        else go(AGENT_HOME);
      }

      setBooted(true);
    };

    decide();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      decide();
    });

    const subscription = AppState.addEventListener("change", (nextState) => {
      appState.current = nextState;
      if (nextState === "active") decide();
    });

    return () => {
      alive = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
      subscription.remove();
    };
  }, [pathname]);

  if (!booted) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#0f813b" />
      </View>
    );
  }

  return null;
}

/* ============================================================
   🔵 ROOT LAYOUT WITH FORCED UPDATE
============================================================ */
export default function RootLayout() {
  const updating = useForcedUpdate(); // 🔥 forced update enabled

  const qcRef = useRef<QueryClient | null>(null);
  if (!qcRef.current) qcRef.current = new QueryClient();

  // WAIT here until update is finished
  if (updating) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#2563eb" />
        <View style={{ height: 12 }} />
        <ActivityIndicator size="small" color="#0f813b" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={qcRef.current}>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
