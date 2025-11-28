// app/(agent)/index.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import BackgroundLogo from "../../components/BackgroundLogo";
import { hardLogout } from "../../lib/logout"; // <-- use the robust logout

export default function AgentHome() {
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await hardLogout(); // clears Supabase session + custom token + sb-* keys, then routes to /login
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <BackgroundLogo>
      <View style={styles.wrap}>
        <Text style={styles.title}>Agent Home</Text>
        <View style={{ height: 12 }} />
        <TouchableOpacity
          onPress={onLogout}
          disabled={loggingOut}
          style={[styles.btn, loggingOut && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Logout</Text>}
        </TouchableOpacity>
      </View>
    </BackgroundLogo>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: "#0D47A1" },
  btn: { backgroundColor: "#1976D2", padding: 12, borderRadius: 10, marginTop: 16, minWidth: 120, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
