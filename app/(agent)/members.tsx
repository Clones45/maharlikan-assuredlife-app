// app/(agent)/members.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import BackgroundLogo from "../../components/BackgroundLogo";

/** Read agent_id from the current user's metadata */
async function getAgentId(): Promise<number> {
  const { data } = await supabase.auth.getUser();
  const raw =
    (data?.user?.user_metadata?.agent_id ??
      data?.user?.user_metadata?.agentId) ?? null;
  const id = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(id)) {
    throw new Error("Your account is not linked to an agent_id.");
  }
  return id;
}

/** Load only members assigned to this agent */
async function fetchMyMembers() {
  const agentId = await getAgentId();

  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, maf_no, plan_type")
    .eq("agent_id", agentId)
    .order("last_name", { ascending: true })
    .limit(150);

  if (error) throw error;
  return data ?? [];
}

export default function AgentMembers() {
  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: ["agent-members"], queryFn: fetchMyMembers });

  if (isLoading) {
    return (
      <BackgroundLogo>
        <View style={s.page}>
          <Text style={s.meta}>Loading…</Text>
        </View>
      </BackgroundLogo>
    );
  }

  if (isError) {
    return (
      <BackgroundLogo>
        <View style={s.page}>
          <Text style={[s.meta, { color: "#b91c1c" }]}>
            {(error as Error)?.message}
          </Text>
        </View>
      </BackgroundLogo>
    );
  }

  return (
    <BackgroundLogo>
      <View style={s.page}>
        <FlatList
          data={data}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() =>
                router.push({
                  pathname: "/member/[id]",
                  params: { id: String(item.id) },
                })
              }
            >
              <Text style={s.title}>
  {[item.first_name, item.last_name]
    .filter(Boolean)
    .join(" ")
    .toUpperCase() || "—"}
</Text>
              <Text>
  {(item.maf_no ? `AF No. ${item.maf_no}` : "AF No. —")} • {item.plan_type ?? "—"}
</Text>
              <Text style={s.link}>
                SOA available (statement) • beneficiaries available
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={s.meta}>No members found.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </BackgroundLogo>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 12 },
  meta: { color: "#334155", padding: 12 },
  card: {
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  title: { fontWeight: "700" },
  link: { marginTop: 6, color: "#0D47A1" },
});
