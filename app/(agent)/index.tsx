// ✨ REDESIGNED: Memorial Services Theme - Agent Dashboard
// 🎨 Visual changes: Peaceful card layout, respectful typography, memorial colors
// ⚙️ Logic: ALL logout logic UNCHANGED

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import BackgroundLogo from "../../components/BackgroundLogo";
import { hardLogout } from "../../lib/logout";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../constants/memorialTheme";
import { s } from "../../utils/responsive";

export default function AgentHome() {
  const [loggingOut, setLoggingOut] = useState(false);

  // ⚙️ UNCHANGED: Logout logic remains identical
  const onLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await hardLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <BackgroundLogo>
      <View style={styles.container}>
        {/* 🎨 VISUAL: Peaceful welcome card */}
        <View style={styles.welcomeCard}>
          <Text style={styles.greeting}>Welcome</Text>
          <Text style={styles.subtitle}>Agent Dashboard</Text>

          {/* 🎨 VISUAL: Soft divider */}
          <View style={styles.divider} />

          <Text style={styles.message}>
            Serving families with care and compassion
          </Text>
        </View>

        {/* 🎨 VISUAL: Memorial-themed logout button */}
        <TouchableOpacity
          onPress={onLogout}
          disabled={loggingOut}
          style={[styles.logoutButton, loggingOut && { opacity: 0.6 }]}
          accessibilityRole="button"
        >
          {loggingOut ? (
            <ActivityIndicator color={memorialColors.softWhite} />
          ) : (
            <Text style={styles.logoutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        {/* 🎨 VISUAL: Peaceful footer message */}
        <Text style={styles.footerText}>
          Navigate using the tabs below
        </Text>
      </View>
    </BackgroundLogo>
  );
}

const styles = StyleSheet.create({
  // 🎨 VISUAL: Memorial-themed container
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: s(memorialSpacing.xxl),
  },

  // 🎨 VISUAL: Elegant welcome card with soft shadows
  welcomeCard: {
    backgroundColor: memorialColors.bgCard,
    borderRadius: memorialBorderRadius.lg,
    padding: s(memorialSpacing.xxxl),
    width: "100%",
    maxWidth: s(400),
    alignItems: "center",
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.borderLight,
  },

  // 🎨 VISUAL: Respectful typography
  greeting: {
    fontSize: s(memorialFonts.xxxl),
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
    marginBottom: s(memorialSpacing.xs),
  },

  subtitle: {
    fontSize: s(memorialFonts.lg),
    fontWeight: memorialFonts.medium,
    color: memorialColors.textSecondary,
    marginBottom: s(memorialSpacing.lg),
  },

  // 🎨 VISUAL: Soft divider for visual separation
  divider: {
    width: s(60),
    height: 2,
    backgroundColor: memorialColors.goldLight,
    borderRadius: 1,
    marginVertical: s(memorialSpacing.lg),
  },

  message: {
    fontSize: s(memorialFonts.md),
    color: memorialColors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },

  // 🎨 VISUAL: Gentle logout button with memorial colors
  logoutButton: {
    backgroundColor: memorialColors.primary,
    paddingVertical: s(memorialSpacing.md),
    paddingHorizontal: s(memorialSpacing.xxxl),
    borderRadius: memorialBorderRadius.md,
    marginTop: s(memorialSpacing.xxxl),
    minWidth: s(140),
    alignItems: "center",
    ...memorialShadows.sm,
  },

  logoutText: {
    color: memorialColors.softWhite,
    fontSize: s(memorialFonts.md),
    fontWeight: memorialFonts.semibold,
  },

  // 🎨 VISUAL: Peaceful footer text
  footerText: {
    marginTop: s(memorialSpacing.xxl),
    fontSize: s(memorialFonts.sm),
    color: memorialColors.textMuted,
    textAlign: "center",
  },
});
