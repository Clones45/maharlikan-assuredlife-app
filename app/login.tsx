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

      // D) Let web AuthGate know storage changed (Web only)
      if (Platform.OS === 'web' && typeof window !== "undefined") {
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
/* ==================== STYLES ==================== */
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../constants/memorialTheme";

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: memorialColors.primary, // Luxurious Green Background
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
    opacity: 0.05,
    tintColor: memorialColors.gold, // Gold tint for watermark
  },

  cardWrap: {
    width: 420,
    maxWidth: "92%",
    alignItems: "center"
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: memorialSpacing.md,
    // Optional: Add a subtle glow or shadow to logo if possible, or keep clean
  },
  h1: {
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.xxl,
    marginBottom: memorialSpacing.xl,
    color: memorialColors.white, // White text on green bg
    letterSpacing: memorialFonts.letterSpacing.wide,
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // 💎 LUXURIOUS: Premium Glass/Gold Card
  card: {
    width: "100%",
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.xxl,
    borderWidth: 2,
    borderColor: memorialColors.gold, // Gold border
    ...memorialShadows.xl, // Deep shadow
  },
  title: {
    textAlign: "center",
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.lg,
    marginBottom: memorialSpacing.lg,
    color: memorialColors.primary,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  // 💎 LUXURIOUS: Inputs
  input: {
    backgroundColor: memorialColors.pearl,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderRadius: memorialBorderRadius.md,
    padding: memorialSpacing.lg,
    marginBottom: memorialSpacing.md,
    fontSize: memorialFonts.md,
    color: memorialColors.black,
  },

  /* 👁 Password field with eye icon */
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: memorialColors.pearl,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderRadius: memorialBorderRadius.md,
    paddingRight: memorialSpacing.sm,
    marginBottom: memorialSpacing.md,
  },
  passwordInput: {
    flex: 1,
    padding: memorialSpacing.lg,
    fontSize: memorialFonts.md,
    color: memorialColors.black,
  },
  eyeBtn: {
    padding: memorialSpacing.sm,
  },

  // 💎 LUXURIOUS: Primary Button
  btn: {
    backgroundColor: memorialColors.primary,
    padding: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.md,
    alignItems: "center",
    marginTop: memorialSpacing.sm,
    ...memorialShadows.md,
    borderWidth: 1,
    borderColor: memorialColors.primaryLight,
  },
  btnText: {
    color: memorialColors.white,
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.md,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  publicLink: {
    color: memorialColors.primary,
    fontWeight: memorialFonts.semibold,
    fontSize: memorialFonts.sm,
  },
  publicLinkMuted: {
    color: memorialColors.textMuted,
    opacity: 0.8,
    fontWeight: memorialFonts.medium
  },

  err: {
    color: memorialColors.error,
    marginBottom: memorialSpacing.sm,
    textAlign: "center",
    fontSize: memorialFonts.sm,
    fontWeight: memorialFonts.medium,
  },
  footerYear: {
    marginTop: memorialSpacing.xl,
    color: memorialColors.goldLight, // Gold text on green bg
    fontSize: memorialFonts.xs,
    opacity: 0.8,
  },
});
