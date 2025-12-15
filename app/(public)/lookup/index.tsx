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
  Image,
  Dimensions,
  ActivityIndicator
} from "react-native";
import { Link, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../../constants/memorialTheme";

const LOGO = require("../../../assets/logo.png");
const WATERMARK = require("../../../assets/logo.png");
const { width } = Dimensions.get("window");

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
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(1000).springify()} style={s.header}>
            <Image source={LOGO} style={s.logo} resizeMode="contain" />
            <Text style={s.brandName}>MAHARLIKAN</Text>
            <Text style={s.subBrand}>MORTUARY CARE SERVICES</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(1000).springify()} style={s.cardWrapper}>
            <BlurView intensity={Platform.OS === 'android' ? 100 : 30} tint="dark" style={s.blurContainer}>
              <View style={s.cardContent}>
                <Text style={s.cardTitle}>Statement of Account</Text>
                <Text style={s.instructionText}>Enter your details to view your SOA</Text>

                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>AF No.</Text>
                  <View style={s.inputWrapper}>
                    <Ionicons name="document-text-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                    <TextInput
                      ref={mafRef}
                      style={s.input}
                      placeholder="e.g. 123456"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={maf}
                      onChangeText={setMaf}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>Last Name</Text>
                  <View style={s.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="e.g. Dela Cruz"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={last}
                      onChangeText={setLast}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onFind}
                  disabled={loading || !maf.trim() || !last.trim()}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={(!maf.trim() || !last.trim()) ? ['#555', '#444'] : [memorialColors.gold, '#b8860b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[s.primaryBtn, (loading || !maf.trim() || !last.trim()) && { opacity: 0.8 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#1a2e1a" />
                    ) : (
                      <Text style={[s.primaryBtnText, (!maf.trim() || !last.trim()) && { color: '#aaa' }]}>
                        VIEW SOA
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Link href="/login" asChild>
                  <TouchableOpacity style={s.backBtn}>
                    <Text style={s.backBtnText}>Back to Login</Text>
                  </TouchableOpacity>
                </Link>

                <Text style={s.hint}>
                  We use your details strictly to locate your record. No account login required.
                </Text>

              </View>
            </BlurView>
          </Animated.View>

          <View style={s.footer}>
            <Text style={s.footerText}>© {new Date().getFullYear()} Maharlikan AssuredLife</Text>
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

  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    shadowColor: memorialColors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  brandName: {
    fontSize: 24,
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    fontWeight: 'bold',
    color: memorialColors.gold,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subBrand: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginTop: 4,
    fontWeight: '600',
  },

  /* Card */
  cardWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  blurContainer: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.6)' : undefined,
  },
  cardContent: {
    padding: 24,
    backgroundColor: Platform.OS === 'android' ? 'rgba(0,30,20,0.9)' : 'rgba(0,0,0,0.2)',
  },
  cardTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },

  /* Inputs */
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: memorialColors.gold,
    fontWeight: '600',
    marginBottom: 6,
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
    paddingLeft: 14,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 16,
    color: '#fff',
    fontSize: 16,
  },

  /* Buttons */
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: memorialColors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    color: '#1a2e1a',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  backBtn: {
    marginTop: 20,
    alignItems: 'center',
    padding: 10,
  },
  backBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  hint: {
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 16,
  },

  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  }
});
