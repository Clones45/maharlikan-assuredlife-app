// app/(agent)/member/[id].tsx
import "react-native-reanimated";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, ScrollView, RefreshControl, TouchableOpacity,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import BackButton from "../../../components/BackButton";

type AnyStr = string | null;
type AnyNum = number | string | null;

type Member = {
  id: number;
  maf_no: AnyStr;
  last_name: AnyStr;
  first_name: AnyStr;
  middle_name: AnyStr;
  address: AnyStr;
  contact_number: AnyStr;
  religion: AnyStr;
  birth_date: AnyStr;
  age: AnyNum;
  monthly_due: AnyNum;
  plan_type: AnyStr;
  contracted_price: AnyNum;
  date_joined: AnyStr;
  balance: AnyNum;
  gender: AnyStr;
  civil_status: AnyStr;
  zipcode: AnyStr;
  birthplace: AnyStr;
  nationality: AnyStr;
  height: AnyStr;
  weight: AnyStr;
  casket_type: AnyStr;
  membership: AnyStr;
  occupation: AnyStr;
  agent: AnyStr;
  agent_id?: number | null;
};

type Beneficiary = {
  id: number;
  member_id?: number | null;
  last_name?: AnyStr;
  first_name?: AnyStr;
  middle_name?: AnyStr;
  relation?: AnyStr;
  birth_date?: AnyStr;
  address?: AnyStr;
};

function cleanValue(v: AnyStr | AnyNum | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toUpperCase() === "N/A" || s === "0" || s === "00" || s === "0.00") {
    return "";
  }
  return s;
}
function fmtDate(d?: AnyStr): string {
  const s = cleanValue(d);
  if (!s || s === "0001-01-01") return "";
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? s : dt.toLocaleDateString();
}

export default function AgentMemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const name = useMemo(() => {
    if (!member) return "";
    return [cleanValue(member.last_name), cleanValue(member.first_name), cleanValue(member.middle_name)]
      .filter(Boolean).join(", ").replace(/\s+,/g, ",");
  }, [member]);

  /** Guard: only allow if this member belongs to the logged-in agent */
  const ensureOwnership = useCallback(async (m: Member | null) => {
    const { data: user } = await supabase.auth.getUser();
    const userAgentId =
      (user?.user?.user_metadata?.agent_id ?? user?.user?.user_metadata?.agentId) ?? null;
    const ua = userAgentId === null ? NaN : Number(userAgentId);

    if (m && Number.isFinite(ua) && m.agent_id != null && Number(m.agent_id) === ua) {
      return true;
    }
    // If RLS is already enforcing, this can be lenient. Otherwise, kick back:
    router.replace("/(agent)/members");
    return false;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: m, error: mErr } = await supabase
      .from("members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle();

    if (mErr) console.warn("Member fetch error:", mErr.message);
    const mem = (m as Member) ?? null;
    setMember(mem);

    // ownership check
    const ok = await ensureOwnership(mem);
    if (!ok) return;

    const { data: b, error: bErr } = await supabase
      .from("beneficiaries")
      .select("id, member_id, last_name, first_name, middle_name, relation, birth_date, address")
      .eq("member_id", memberId)
      .order("id", { ascending: true });

    if (bErr) console.warn("Beneficiaries fetch error:", bErr.message);
    setBeneficiaries((b as Beneficiary[]) ?? []);

    setLoading(false);
  }, [memberId, ensureOwnership]);

  useEffect(() => {
    if (!Number.isFinite(memberId)) return;
    load();
  }, [load, memberId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const Field = ({ label, value }: { label: string; value?: AnyStr | AnyNum }) => {
    const val = cleanValue(value);
    return val ? (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{val}</Text>
      </View>
    ) : null;
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.card}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );

  const renderBeneficiary = ({ item }: { item: Beneficiary }) => {
    const bName = [cleanValue(item.last_name), cleanValue(item.first_name), cleanValue(item.middle_name)]
      .filter(Boolean).join(", ").replace(/\s+,/g, ",");
    return (
      <View style={styles.benCard}>
        <Text style={styles.benName}>{bName || "Beneficiary"}</Text>
        <Field label="Relationship" value={item.relation} />
        {fmtDate(item.birth_date) ? <Field label="Birth date" value={fmtDate(item.birth_date)} /> : null}
        <Field label="Address" value={item.address} />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#eef3fb" }}>
      <Stack.Screen
        options={{
          title: member ? `${member.last_name}, ${member.first_name}` : "Member",
          headerLeft: () => <BackButton />,
          headerBackTitle: "Back",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Member card */}
        <View style={styles.card}>
          <Text style={styles.title}>{name || "Member"}</Text>
          <Field label="AF No." value={member?.maf_no} />
          <Field label="Contact No." value={member?.contact_number} />
          <Field label="Address" value={member?.address} />
          {fmtDate(member?.birth_date) ? <Field label="Birth date" value={fmtDate(member?.birth_date)} /> : null}
          <Field label="Age" value={member?.age} />
          <Field label="Gender" value={member?.gender} />
          <Field label="Civil Status" value={member?.civil_status} />
        </View>

        {/* Plan & Account */}
        <Section title="Plan & Account">
          <Field label="Plan type" value={member?.plan_type} />
          <Field label="Monthly dues" value={member?.monthly_due} />
          <Field label="Contracted price" value={member?.contracted_price} />
          {fmtDate(member?.date_joined) ? <Field label="Date joined" value={fmtDate(member?.date_joined)} /> : null}
          <Field label="Balance" value={member?.balance} />
          <Field label="Membership" value={member?.membership} />
          <Field label="Casket type" value={member?.casket_type} />
          <Field label="Agent" value={member?.agent} />
        </Section>

        {/* Personal info */}
        <Section title="Personal Info">
          <Field label="Birthplace" value={member?.birthplace} />
          <Field label="Nationality" value={member?.nationality} />
          <Field label="Height" value={member?.height} />
          <Field label="Weight" value={member?.weight} />
          <Field label="Religion" value={member?.religion} />
          <Field label="Zipcode" value={member?.zipcode} />
          <Field label="Occupation" value={member?.occupation} />
        </Section>

        {/* Beneficiaries */}
        <Section title="Beneficiaries">
          {loading ? <Text style={styles.note}>Loading…</Text> : null}
          {!loading && beneficiaries.length === 0 ? (
            <Text style={styles.note}>No beneficiaries found</Text>
          ) : (
            <FlatList
              data={beneficiaries}
              keyExtractor={(b) => String(b.id)}
              renderItem={renderBeneficiary}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </Section>

        {/* View Statement */}
        <TouchableOpacity
          style={styles.primaryBtn}
          disabled={!member}
          onPress={() =>
            router.push({
              pathname: "/member/soa",
              params: { id: String(memberId), maf_no: cleanValue(member?.maf_no) },
            })
          }
        >
          <Text style={styles.primaryBtnText}>View Statement</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  title: { fontSize: 18, fontWeight: "800", color: "#0d3b7a", marginBottom: 6 },
  section: { fontSize: 16, fontWeight: "700", color: "#0d3b7a", marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 6 },
  rowLabel: { width: 135, color: "#4b5563", fontWeight: "600" },
  rowValue: { flex: 1, color: "#111827" },
  note: { color: "#4b5563" },
  benCard: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12 },
  benName: { fontSize: 15, fontWeight: "700", color: "#0d3b7a", marginBottom: 4 },
  primaryBtn: { backgroundColor: "#1f6feb", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
});
