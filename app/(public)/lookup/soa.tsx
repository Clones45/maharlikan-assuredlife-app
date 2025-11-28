import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../../lib/supabase";

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
      style={{ flex: 1, backgroundColor: "#f1f5fb" }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* 🔹 Header Banner */}
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#0b4aa2",
          paddingVertical: 18,
          borderRadius: 10,
          marginBottom: 16,
          elevation: 2,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "800",
            letterSpacing: 0.5,
          }}
        >
          Maharlikan AssuredLife
        </Text>
        <Text
          style={{
            color: "#dbeafe",
            fontSize: 13,
            fontWeight: "500",
            marginTop: 2,
          }}
        >
          Your Simple way to Prepare!
        </Text>
      </View>

      {/* 🔹 Title */}
      <Text
        style={{
          fontSize: 20,
          fontWeight: "800",
          color: "#0a3478",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        Statement of Account
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#004aad" style={{ marginTop: 40 }} />
      ) : (
        member && (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#0a1f44", marginBottom: 4 }}>
              AF No: {member.maf_no}
            </Text>
            <Text style={{ color: "#333", marginBottom: 2 }}>
              <Text style={{ fontWeight: "700" }}>Name: </Text>
              {member.first_name} {member.last_name}
            </Text>
            <Text style={{ color: "#333", marginBottom: 2 }}>
              <Text style={{ fontWeight: "700" }}>Plan: </Text>
              {member.plan_type}
            </Text>
            <Text style={{ color: "#333", marginBottom: 2 }}>
              <Text style={{ fontWeight: "700" }}>Address: </Text>
              {member.address}
            </Text>
            <Text style={{ color: "#333" }}>
              <Text style={{ fontWeight: "700" }}>Balance: </Text>
              {peso(balance)}
            </Text>

            {/* 🔹 Summary Section */}
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontWeight: "700", fontSize: 16, color: "#0a1f44", marginBottom: 6 }}>
                Summary
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "#d0d7e2",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <View style={{ flexDirection: "row", backgroundColor: "#004aad", padding: 8 }}>
                  {["Contracted Price", "Total Paid", "Installment Paid", "Balance"].map((h) => (
                    <Text
                      key={h}
                      style={{
                        flex: 1,
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      {h}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: "row", padding: 10 }}>
                  <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>{peso(price)}</Text>
                  <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                    {peso(totalPaid)}
                  </Text>
                  <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                    {installmentPaid.toFixed(2)} mo.
                  </Text>
                  <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>{peso(balance)}</Text>
                </View>
              </View>
            </View>

            {/* 🔹 Month Selector */}
            {months.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontWeight: "700", color: "#0a1f44", marginBottom: 6 }}>
                  Select Month to View:
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 10,
                    backgroundColor: "#f9fafc",
                    overflow: "hidden",
                  }}
                >
                  <Picker
                    selectedValue={selectedMonth}
                    onValueChange={(v: string) => setSelectedMonth(v)}
                    style={{
                      height: Platform.OS === "ios" ? 160 : 50,
                      fontSize: 14,
                      color: "#222",
                    }}
                  >
                    {months.map((m) => (
                      <Picker.Item key={m} label={m} value={m} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            {/* 🔹 Transactions */}
            {selectedMonth && (
              <View style={{ marginTop: 24 }}>
                <Text
                  style={{
                    fontWeight: "700",
                    fontSize: 16,
                    color: "#0a1f44",
                    marginBottom: 8,
                  }}
                >
                  {selectedMonth} Transactions
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "#004aad",
                    paddingVertical: 6,
                  }}
                >
                  {["Date", "OR No.", "Payment", "Plan Type", "Payment For"].map((h) => (
                    <Text
                      key={h}
                      style={{
                        flex: 1,
                        color: "#fff",
                        fontWeight: "700",
                        textAlign: "center",
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </Text>
                  ))}
                </View>

                {visibleTxns.length ? (
                  visibleTxns.map((p, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        backgroundColor: i % 2 === 0 ? "#f9fafc" : "#fff",
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderColor: "#e5e7eb",
                      }}
                    >
                      <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                        {formatDate(p.date_paid)}
                      </Text>
                      <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                        {p.or_no || "-"}
                      </Text>
                      <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                        {peso(p.payment)}
                      </Text>
                      <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                        {p.plan_type || "-"}
                      </Text>
                      <Text style={{ flex: 1, textAlign: "center", color: "#222" }}>
                        {p.payment_for || "-"}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ marginTop: 10, textAlign: "center", color: "#777" }}>
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
        style={{
          marginTop: 24,
          borderWidth: 1,
          borderColor: "#004aad",
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: "#fff",
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <Text
          style={{
            color: "#004aad",
            textAlign: "center",
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          ← Back to Search
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
