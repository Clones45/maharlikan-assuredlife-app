// app/_tabs.tsx
import { Tabs, router } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; // adjust if needed

function RequireAuth() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    // 1) Check on mount
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session) {
        router.replace("/login");   // go to your login.tsx
      }
      setChecked(true);
    })();

    // 2) Watch for future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Render nothing while checking session
  if (!checked) return null;
  return null;
}

export default function TabsScaffold() {
  return (
    <>
      <RequireAuth />
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#0D47A1",
        }}
      />
    </>
  );
}
