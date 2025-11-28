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
      style={{ flex: 1, backgroundColor: "#eef3fb" }}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Find your Statement of Account</Text>

          <TextInput
            ref={mafRef}
            style={s.input}
            placeholder="AF No."
            value={maf}
            onChangeText={setMaf}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TextInput
            style={s.input}
            placeholder="Last name"
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

const s = StyleSheet.create({
  card: {
    margin: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardTitle: { fontWeight: "800", color: "#0d3b7a", marginBottom: 10 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: "#0b4aa2",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  backBtn: {
    borderWidth: 1,
    borderColor: "#0b4aa2",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  backBtnText: { color: "#0b4aa2", fontWeight: "800" },
  hint: { color: "#64748b", marginTop: 10 },
});
