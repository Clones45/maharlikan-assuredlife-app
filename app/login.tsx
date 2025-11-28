// app/login.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Platform,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // 👁 for eye icon
import { router } from "expo-router";
import { supabase, AuthStorage } from "../lib/supabase";
import { usernameLogin } from "../lib/usernameLogin";

/* ----- Types for the edge-function response ----- */
type UsernameLoginResult = {
  ok: boolean;
  error?: string;
  token?: string;
  access_token?: string;
  refresh_token?: string;
  user?: {
    user_id: string;
    username: string;
    role: string;
    agent_id?: number | null;
  };
  user_id?: string;
  username?: string;
  role?: string;
  agent_id?: number | null;
};

/* ----- Brand assets ----- */
const LOGO = require("../assets/logo.png");
const WATERMARK = require("../assets/logo.png");

/* ----- Route targets ----- */
const ADMIN_HOME = "/(admin)/agent";
const AGENT_HOME = "/(agent)/profile";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 👁 state for toggle
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const usernamePlaceholder = useMemo(
    () => (Platform.OS === "web" ? "your username" : "username"),
    []
  );

  const signIn = async () => {
    setErr(null);
    const u = username.trim();
    const pw = password;

    if (!u || !pw) {
      setErr("Enter username and password.");
      return;
    }

    setLoading(true);
    try {
      // A) Call your Edge Function once
      const raw = await usernameLogin(u, pw);
      const res = raw as UsernameLoginResult;
      if (!res?.ok) throw new Error(res?.error || "Login failed.");

      // B) If GoTrue tokens are provided, set Supabase session
      if (res.access_token && res.refresh_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (sessErr) throw new Error(`setSession error: ${sessErr.message}`);
      }

      // C) Persist custom token + user payload for the AuthGate
      try {
        if (res.token) {
          await AuthStorage.saveItem(AuthStorage.TOKEN_KEY, res.token);
        }
        const userPayload =
          res.user ??
          ({
            user_id: res.user_id ?? "",
            username: res.username ?? u,
            role: (res.role ?? "agent").toLowerCase(),
            agent_id: res.agent_id ?? null,
          } as UsernameLoginResult["user"]);
        if (userPayload) {
          await AuthStorage.saveItem(
            AuthStorage.USER_KEY,
            JSON.stringify(userPayload)
          );
        }
      } catch {
        // ignore storage errors
      }

      // D) Let web AuthGate know storage changed
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:changed"));
      }

      // 🔹 F) Fetch agent_id and role from users_profile table (live sync)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: profile, error: profileErr } = await supabase
            .from("users_profile")
            .select("agent_id, role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profileErr) console.warn("⚠️ users_profile fetch error:", profileErr);
          else if (profile) {
            if (profile.agent_id) {
              await AuthStorage.saveItem("agent_id", String(profile.agent_id));
            }
            await AuthStorage.saveItem("user_role", String(profile.role ?? ""));
            console.log("✅ Synced user_profile:", profile);
          }
        }
      } catch (e) {
        console.warn("⚠️ Unable to fetch users_profile:", e);
      }

      // E) Navigate immediately by role
      const role = (res.user?.role ?? res.role ?? "agent").toString().toLowerCase();
      router.replace(role === "admin" ? ADMIN_HOME : AGENT_HOME);
    } catch (e: any) {
      setErr(
        e?.message?.includes("Invalid login credentials")
          ? "Invalid username or password."
          : e?.message ?? "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.screen}>
      {/* Watermark behind everything */}
      <View style={s.watermarkWrap} pointerEvents="none">
        <Image source={WATERMARK} style={s.watermark} resizeMode="contain" />
      </View>

      <View style={s.cardWrap}>
        <Image source={LOGO} style={s.logo} resizeMode="contain" />
        <Text style={s.h1}>Maharlikan AssuredLife</Text>

        <View style={s.card}>
          <Text style={s.title}>Sign in to continue</Text>

          {/* Username */}
          <TextInput
            style={s.input}
            placeholder={usernamePlaceholder}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            returnKeyType="next"
          />

          {/* Password + Eye toggle */}
          <View style={s.passwordWrap}>
            <TextInput
              style={s.passwordInput}
              placeholder="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={() => signIn()}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={s.eyeBtn}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          {err ? <Text style={s.err}>{err}</Text> : null}

          <TouchableOpacity
            onPress={signIn}
            disabled={loading}
            style={[s.btn, loading && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            {loading ? <ActivityIndicator /> : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>

          {/* Public link */}
          <View style={{ marginTop: 12, gap: 8, alignItems: "center" }}>
            <Pressable
              onPress={() => router.push("/lookup")}
              accessibilityRole="link"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.publicLink, { textDecorationLine: "underline" }]}>
                I’m a member — view my SOA
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={s.footerYear}>
          © {new Date().getFullYear()} Maharlikan AssuredLife
        </Text>
      </View>
    </View>
  );
}

/* ==================== STYLES ==================== */
const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#e9eef7",
    alignItems: "center",
    justifyContent: "center",
  },

  watermarkWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  watermark: {
    width: "80%",
    height: "80%",
    opacity: 0.08,
  },

  cardWrap: { width: 420, maxWidth: "92%", alignItems: "center" },
  logo: { width: 120, height: 120, marginBottom: 4 },
  h1: { fontWeight: "800", fontSize: 20, marginBottom: 12, color: "#0d3b7a" },

  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dbe4f1",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 12,
    color: "#0d3b7a",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  /* 👁 Password field with eye icon */
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingRight: 8,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
  },
  eyeBtn: {
    padding: 6,
  },

  btn: {
    backgroundColor: "#0b4aa2",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800" },

  publicLink: { color: "#0b4aa2", fontWeight: "800" },
  publicLinkMuted: { color: "#0b4aa2", opacity: 0.8, fontWeight: "700" },

  err: { color: "#b91c1c", marginBottom: 8, textAlign: "center" },
  footerYear: { marginTop: 10, color: "#6b7280", fontSize: 12 },
});
