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
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { supabase, AuthStorage } from "../lib/supabase";
import { usernameLogin } from "../lib/usernameLogin";
import { memorialColors, memorialFonts, memorialSpacing, memorialBorderRadius } from "../constants/memorialTheme";

/* ----- Types ----- */
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

/* ----- Assets ----- */
const LOGO = require("../assets/logo.png");
const WATERMARK = require("../assets/logo.png");

/* ----- Constants ----- */
const ADMIN_HOME = "/(admin)/agent";
const AGENT_HOME = "/(agent)/profile";
const { width, height } = Dimensions.get("window");

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const signIn = async () => {
    setErr(null);
    const u = username.trim();
    const pw = password;

    if (!u || !pw) {
      setErr("Please enter both username and password.");
      return;
    }

    setLoading(true);
    try {
      // A) Edge Function Login
      const raw = await usernameLogin(u, pw);
      const res = raw as UsernameLoginResult;

      if (!res?.ok) {
        throw new Error(res?.error || "Login failed.");
      }

      // B) Supabase Session
      if (res.access_token && res.refresh_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (sessErr) throw new Error(`Session error: ${sessErr.message}`);
      }

      // C) Local Persistence (User Metadata)
      try {
        const userPayload = res.user ?? ({
          user_id: res.user_id ?? "",
          username: res.username ?? u,
          role: (res.role ?? "agent").toLowerCase(),
          agent_id: res.agent_id ?? null,
        } as UsernameLoginResult["user"]);

        if (userPayload) {
          await AuthStorage.saveItem(AuthStorage.USER_KEY, JSON.stringify(userPayload));
        }
      } catch { }

      // D) Web Event
      if (Platform.OS === 'web' && typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:changed"));
      }

      // E) Fetch & Sync Profile
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: profile } = await supabase
            .from("users_profile")
            .select("agent_id, role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile) {
            if (profile.agent_id) await AuthStorage.saveItem("agent_id", String(profile.agent_id));
            await AuthStorage.saveItem("user_role", String(profile.role ?? ""));
          }
        }
      } catch (e) { }

      // F) Navigate
      const role = (res.user?.role ?? res.role ?? "agent").toString().toLowerCase();
      router.replace(role === "admin" ? ADMIN_HOME : AGENT_HOME);

    } catch (e: any) {
      const msg = e?.message?.toLowerCase();
      if (msg?.includes("invalid") || msg?.includes("credentials")) {
        setErr("Invalid username or password.");
      } else {
        setErr(e?.message || "Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      {/* 1. Luxurious Gradient Background */}
      <LinearGradient
        colors={["#002117", "#004d36", "#002117"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Abstract Golden Glow (Watermark) */}
      <View style={s.watermarkContainer} pointerEvents="none">
        <Image source={WATERMARK} style={s.watermark} resizeMode="contain" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.keyboardView}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.innerContent}>
            <Animated.View entering={FadeInDown.duration(1000).springify()} style={s.header}>
              <Image source={LOGO} style={s.logo} resizeMode="contain" />
              <Text style={s.brandName}>MAHARLIKAN</Text>
              <Text style={s.subBrand}>MORTUARY CARE SERVICES</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(200).duration(1000).springify()} style={s.cardWrapper}>
              {/* Glassmorphism Card */}
              <BlurView intensity={Platform.OS === 'android' ? 100 : 30} tint="dark" style={s.blurContainer}>
                <View style={s.cardContent}>
                  <Text style={s.welcomeText}>Welcome Back</Text>
                  <Text style={s.instructionText}>Sign in to access your dashboard</Text>

                  {/* Inputs */}
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>Username</Text>
                    <View style={s.inputWrapper}>
                      <Ionicons name="person-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                      <TextInput
                        style={s.input}
                        placeholder="Enter your username"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>Password</Text>
                    <View style={s.inputWrapper}>
                      <Ionicons name="lock-closed-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                      <TextInput
                        style={s.input}
                        placeholder="Enter your password"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                        <Ionicons
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color="rgba(255,255,255,0.6)"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Error Message */}
                  {err ? (
                    <Animated.View entering={FadeInUp} style={s.errorBox}>
                      <Ionicons name="alert-circle" size={18} color="#fca5a5" />
                      <Text style={s.errorText}>{err}</Text>
                    </Animated.View>
                  ) : <View style={{ height: 20 }} />}

                  {/* Sign In Button */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={signIn}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={[memorialColors.gold, '#b8860b']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.loginBtn}
                    >
                      {loading ? (
                        <ActivityIndicator color="#1a2e1a" />
                      ) : (
                        <Text style={s.loginBtnText}>SIGN IN</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Public Link */}
                  <TouchableOpacity onPress={() => router.push("/lookup")} style={s.linkBtn}>
                    <Text style={s.linkText}>I'm a member — view my SOA</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Animated.View>

            <View style={s.footer}>
              <Text style={s.footerText}>© {new Date().getFullYear()} Maharlikan AssuredLife</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#011510',
  },
  watermarkContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.08,
    transform: [{ scale: 1.2 }]
  },
  watermark: {
    width: width * 0.8,
    height: width * 0.8,
    tintColor: memorialColors.gold,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: height, // Ensure full height availability
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
    shadowColor: memorialColors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  brandName: {
    fontSize: 28,
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    fontWeight: 'bold',
    color: memorialColors.gold,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subBrand: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
    marginTop: 4,
    fontWeight: '600',
  },

  /* Card */
  cardWrapper: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0, 0.2)', // Glimmer of gold border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
    marginBottom: 60, // Space for footer
  },
  blurContainer: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.6)' : undefined,
  },
  cardContent: {
    padding: 32,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0,30,20,0.9)' : 'rgba(0,0,0,0.2)',
  },
  welcomeText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 32,
  },

  /* Inputs */
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: memorialColors.gold,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    color: '#fff',
    fontSize: 16,
  },
  eyeBtn: {
    padding: 12,
  },

  /* Error */
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    gap: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  /* Button */
  loginBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: memorialColors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  loginBtnText: {
    color: '#1a2e1a', // Dark green text on gold button
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  /* Footer Links */
  linkBtn: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  footer: {
    paddingBottom: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  }
});
