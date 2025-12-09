import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../../constants/memorialTheme";

/* ---------------- Helper ---------------- */
const peso = (n: any) =>
  `₱${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

/* ---------------- Types ---------------- */
type CollectionRow = {
  member_id: number;
  date_paid?: string | null;
  payment?: number | string | null;
  plan_type?: string | null;
  payment_for?: string | null;
  or_no?: string | null;
};

export default function PublicSOA() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState<any>(null);
  const [payments, setPayments] = useState<CollectionRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  /* ---------------- Fetch Data ---------------- */
  const fetchSOA = async (maf_no: string, last_name: string) => {
    setLoading(true);
    try {
      const { data: members, error: mErr } = await supabase
        .from("members")
        .select("*")
        .eq("maf_no", maf_no)
        .ilike("last_name", `%${last_name}%`)
        .limit(1);

      if (mErr) throw mErr;
      if (!members?.length) {
        Alert.alert("Not Found", "No member found with that AF No. and Last name.");
        setLoading(false);
        return;
      }

      const m = members[0];
      setMember(m);

      const { data: rows, error: tErr } = await supabase
        .from("soa_transactions")
        .select("member_id, date, amount, plan_type, or_no, payment_for")
        .eq("member_id", m.id)
        .order("date", { ascending: true });

      if (tErr) throw tErr;

      const cleaned = (rows || []).map((r: any) => ({
        member_id: r.member_id,
        date_paid: r.date,
        payment: r.amount,
        plan_type: r.plan_type,
        payment_for: r.payment_for || "Regular / Monthly",
        or_no: r.or_no || "-",
      }));

      setPayments(cleaned);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Auto Fetch ---------------- */
  useEffect(() => {
    const maf_no = (params.maf_no as string)?.trim();
    const last = (params.last as string)?.trim();
    if (maf_no && last) {
      const t = setTimeout(() => fetchSOA(maf_no, last), 400);
      return () => clearTimeout(t);
    }
  }, [params.maf_no, params.last]);

  useFocusEffect(
    useCallback(() => {
      const maf_no = (params.maf_no as string)?.trim();
      const last = (params.last as string)?.trim();
      if (maf_no && last) fetchSOA(maf_no, last);
    }, [params.maf_no, params.last])
  );

  /* ---------------- Computations ---------------- */
  const totalPaid = payments.reduce((s, p) => s + (Number(p.payment) || 0), 0);
  const price = Number(member?.contracted_price) || 0;
  const monthly = Number(member?.monthly_due) || 0;
  const balance = Math.max(0, (Number(member?.contracted_price) || 0) - totalPaid);
  const installmentPaid = monthly > 0 ? totalPaid / monthly : 0;

  /* ---------------- Group by Month ---------------- */
  const groupedPayments = useMemo(() => {
    const grouped: Record<string, CollectionRow[]> = {};
    for (const p of payments) {
      if (!p.date_paid) continue;
      const key = new Date(p.date_paid).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      grouped[key] = grouped[key] || [];
      grouped[key].push(p);
    }
    return grouped;
  }, [payments]);

  const months = Object.keys(groupedPayments);

  useEffect(() => {
    if (months.length > 0) {
      const sorted = months.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      setSelectedMonth(sorted[0]);
    }
  }, [months.length]);

  const visibleTxns = selectedMonth ? groupedPayments[selectedMonth] || [] : [];

  /* ---------------- UI ---------------- */
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={{ padding: memorialSpacing.lg }}
    >
      {/* 🔹 Header Banner */}
      <View style={s.headerBanner}>
        <Text style={s.headerTitle}>
          Maharlikan AssuredLife
        </Text>
        <Text style={s.headerSubtitle}>
          Your Simple way to Prepare!
        </Text>
      </View>

      {/* 🔹 Title */}
      <Text style={s.pageTitle}>
        Statement of Account
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={memorialColors.primary} style={{ marginTop: 40 }} />
      ) : (
        member && (
          <View style={s.card}>
            <Text style={s.memberInfo}>
              <Text style={s.label}>AF No: </Text>
              {member.maf_no}
            </Text>
            <Text style={s.memberInfo}>
              <Text style={s.label}>Name: </Text>
              {member.first_name} {member.last_name}
            </Text>
            <Text style={s.memberInfo}>
              <Text style={s.label}>Plan: </Text>
              {member.plan_type}
            </Text>
            <Text style={s.memberInfo}>
              <Text style={s.label}>Address: </Text>
              {member.address}
            </Text>
            <Text style={s.memberInfo}>
              <Text style={s.label}>Balance: </Text>
              {peso(balance)}
            </Text>

            {/* 🔹 Summary Section */}
            <View style={{ marginTop: memorialSpacing.xl }}>
              <Text style={s.sectionTitle}>
                Summary
              </Text>
              <View style={s.tableContainer}>
                <View style={s.tableHeader}>
                  {["Contracted Price", "Total Paid", "Installment Paid", "Balance"].map((h) => (
                    <Text key={h} style={s.tableHeaderText}>
                      {h}
                    </Text>
                  ))}
                </View>
                <View style={s.tableRow}>
                  <Text style={s.tableCell}>{peso(price)}</Text>
                  <Text style={s.tableCell}>{peso(totalPaid)}</Text>
                  <Text style={s.tableCell}>{installmentPaid.toFixed(2)} mo.</Text>
                  <Text style={s.tableCell}>{peso(balance)}</Text>
                </View>
              </View>
            </View>

            {/* 🔹 Month Selector */}
            {months.length > 0 && (
              <View style={{ marginTop: memorialSpacing.xl }}>
                <Text style={s.sectionTitle}>
                  Select Month to View:
                </Text>
                <View style={s.pickerContainer}>
                  <Picker
                    selectedValue={selectedMonth}
                    onValueChange={(v: string) => setSelectedMonth(v)}
                    style={{
                      height: Platform.OS === "ios" ? 160 : 50,
                      color: memorialColors.black,
                    }}
                  >
                    {months.map((m) => (
                      <Picker.Item key={m} label={m} value={m} color={memorialColors.black} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* 🔹 Transactions */}
            {selectedMonth && (
              <View style={{ marginTop: memorialSpacing.xl }}>
                <Text style={s.sectionTitle}>
                  {selectedMonth} Transactions
                </Text>

                <View style={s.tableHeader}>
                  {["Date", "OR No.", "Payment", "Plan Type", "Payment For"].map((h) => (
                    <Text key={h} style={s.tableHeaderText}>
                      {h}
                    </Text>
                  ))}
                </View>

                {visibleTxns.length ? (
                  visibleTxns.map((p, i) => (
                    <View
                      key={i}
                      style={[
                        s.tableRow,
                        i % 2 === 0 ? { backgroundColor: memorialColors.pearl } : { backgroundColor: memorialColors.white }
                      ]}
                    >
                      <Text style={s.tableCell}>{formatDate(p.date_paid)}</Text>
                      <Text style={s.tableCell}>{p.or_no || "-"}</Text>
                      <Text style={s.tableCell}>{peso(p.payment)}</Text>
                      <Text style={s.tableCell}>{p.plan_type || "-"}</Text>
                      <Text style={s.tableCell}>{p.payment_for || "-"}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.emptyText}>
                    No transactions for this month.
                  </Text>
                )}
              </View>
            )}
          </View>
        )
      )}

      {/* 🔹 Back Button */}
      <TouchableOpacity
        onPress={() => router.push("/lookup")}
        style={s.backButton}
      >
        <Text style={s.backButtonText}>
          Back to Search
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ==================== STYLES ==================== */

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: memorialColors.primary, // Luxurious Green Background
  },

  headerBanner: {
    alignItems: "center",
    backgroundColor: memorialColors.white,
    paddingVertical: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.lg,
    marginBottom: memorialSpacing.lg,
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.gold,
  },

  headerTitle: {
    color: memorialColors.primary,
    fontSize: memorialFonts.xl,
    fontWeight: memorialFonts.bold,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  headerSubtitle: {
    color: memorialColors.goldDark,
    fontSize: memorialFonts.sm,
    fontWeight: memorialFonts.medium,
    marginTop: 2,
    fontStyle: "italic",
  },

  pageTitle: {
    fontSize: memorialFonts.xl,
    fontWeight: memorialFonts.bold,
    color: memorialColors.white, // White text on green bg
    textAlign: "center",
    marginBottom: memorialSpacing.lg,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  // 💎 LUXURIOUS: Premium Card
  card: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.lg,
    ...memorialShadows.xl,
    borderWidth: 2,
    borderColor: memorialColors.gold,
  },

  memberInfo: {
    color: memorialColors.textSecondary,
    marginBottom: memorialSpacing.xs,
    fontSize: memorialFonts.md,
  },

  label: {
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
  },

  sectionTitle: {
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.lg,
    color: memorialColors.primary,
    marginBottom: memorialSpacing.sm,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },

  // Tables
  tableContainer: {
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderRadius: memorialBorderRadius.md,
    overflow: "hidden",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: memorialColors.primary,
    paddingVertical: memorialSpacing.sm,
  },

  tableHeaderText: {
    flex: 1,
    color: memorialColors.white,
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.xs,
    textAlign: "center",
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: memorialSpacing.sm,
    borderBottomWidth: 1,
    borderColor: memorialColors.silver,
  },

  tableCell: {
    flex: 1,
    textAlign: "center",
    color: memorialColors.black,
    fontSize: memorialFonts.xs,
  },

  // Picker
  pickerContainer: {
    borderWidth: 1,
    borderColor: memorialColors.silver,
    borderRadius: memorialBorderRadius.md,
    backgroundColor: memorialColors.pearl,
    overflow: "hidden",
  },

  emptyText: {
    marginTop: memorialSpacing.md,
    textAlign: "center",
    color: memorialColors.textMuted,
    fontStyle: "italic",
  },

  // Back Button
  backButton: {
    marginTop: memorialSpacing.xxl,
    borderWidth: 1,
    borderColor: memorialColors.white,
    paddingVertical: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.md,
    backgroundColor: "transparent",
  },

  backButtonText: {
    color: memorialColors.white,
    textAlign: "center",
    fontWeight: memorialFonts.bold,
    fontSize: memorialFonts.md,
  },
});
