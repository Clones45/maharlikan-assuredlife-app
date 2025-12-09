import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, router, useFocusEffect, useLocalSearchParams } from "expo-router";

export default function PublicLookup() {
  const [maf, setMaf] = useState("");
  const [last, setLast] = useState("");
  const [loading, setLoading] = useState(false);
  const mafRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams();

  // 👇 When user returns from SOA
  useFocusEffect(
    React.useCallback(() => {
      setMaf("");
      setLast("");
      // scroll to top
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      // focus MAF input after small delay
      setTimeout(() => {
        if (params.focusMaf === "true") {
          mafRef.current?.focus();
        }
      }, 300);
    }, [params.focusMaf])
  );

  const onFind = async () => {
    if (!maf.trim() || !last.trim()) return;
    setLoading(true);
    try {
      router.push({
        pathname: "/lookup/soa",
        params: { maf_no: maf.trim(), last: last.trim() },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={{ flex: 1, backgroundColor: memorialColors.primary }}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Find your Statement of Account</Text>

          <TextInput
            ref={mafRef}
            style={s.input}
            placeholder="AF No."
            placeholderTextColor={memorialColors.textMuted}
            value={maf}
            onChangeText={setMaf}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TextInput
            style={s.input}
            placeholder="Last name"
            placeholderTextColor={memorialColors.textMuted}
            value={last}
            onChangeText={setLast}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            onPress={onFind}
            disabled={loading || !maf.trim() || !last.trim()}
            style={[
              s.primaryBtn,
              (loading || !maf.trim() || !last.trim()) && { opacity: 0.7 },
            ]}
          >
            <Text style={s.primaryBtnText}>
              {loading ? "Loading..." : "View SOA"}
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginTop: 8 }}>
            <Link href="/login" asChild>
              <TouchableOpacity accessibilityRole="link" style={s.backBtn}>
                <Text style={s.backBtnText}>Back to Login</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <Text style={s.hint}>
            We’ll use your AF No. and Last Name so that we can see and locate your record. No
            account needed.{"\n"}
            Tip: If it doesn’t match, Always double check your information if it is correct!.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ==================== STYLES ==================== */
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../../constants/memorialTheme";

const s = StyleSheet.create({
  // 💎 LUXURIOUS: Page Background
  page: {
    flex: 1,
    backgroundColor: memorialColors.primary, // Luxurious Green
  },

  // 💎 LUXURIOUS: Premium Card
  card: {
    margin: memorialSpacing.lg,
    marginTop: memorialSpacing.xxl,
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.xl,
    borderWidth: 2,
    borderColor: memorialColors.gold,
    ...memorialShadows.xl,
  },

  cardTitle: {
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.xl,
    color: memorialColors.primary,
    marginBottom: memorialSpacing.lg,
    textAlign: "center",
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

  // 💎 LUXURIOUS: Primary Button
  primaryBtn: {
    backgroundColor: memorialColors.primary,
    paddingVertical: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.md,
    alignItems: "center",
    marginTop: memorialSpacing.sm,
    ...memorialShadows.md,
    borderWidth: 1,
    borderColor: memorialColors.primaryLight,
  },
  primaryBtnText: {
    color: memorialColors.white,
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.md,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  // 💎 LUXURIOUS: Secondary/Back Button
  backBtn: {
    borderWidth: 1,
    borderColor: memorialColors.primary,
    paddingVertical: memorialSpacing.md,
    paddingHorizontal: memorialSpacing.xl,
    borderRadius: memorialBorderRadius.md,
    backgroundColor: "transparent",
  },
  backBtnText: {
    color: memorialColors.primary,
    fontWeight: memorialFonts.semibold,
    fontSize: memorialFonts.md,
  },

  hint: {
    color: memorialColors.textMuted,
    marginTop: memorialSpacing.lg,
    fontSize: memorialFonts.sm,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },
});
