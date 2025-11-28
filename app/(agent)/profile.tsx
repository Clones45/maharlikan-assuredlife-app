import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "../../lib/supabase";

const peso = (n: number): string =>
  `₱${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AgentProfile() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [agent, setAgent] = useState<any>(null);
  const [lifetimeCommission, setLifetimeCommission] = useState(0);
  const [withdrawable, setWithdrawable] = useState(0);

  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashQR, setGcashQR] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  /* -----------------------------
     📸 PICK AGENT PHOTO
  ----------------------------- */
  const pickAgentPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        return Alert.alert("Permission required to access photos");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) return;

      const image = result.assets[0];
      const fileName = `agent_${agent.id}_${Date.now()}.jpg`;
      const filePath = `agents/${fileName}`;

      setUploading(true);

      const body = decode(image.base64 || "");

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, body, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      await supabase
        .from("agents")
        .update({ photo_url: data.publicUrl })
        .eq("id", agent.id);

      setAgent((prev: any) => ({
        ...prev,
        photo_url: data.publicUrl,
      }));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  /* -----------------------------
     🧾 PICK GCash QR
  ----------------------------- */
  const pickQRImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    const image = result.assets[0];
    const fileName = `gcash_${agent.id}.jpg`;
    const filePath = `gcash/${fileName}`;

    try {
      setUploading(true);

      const body = decode(image.base64 || "");

      const { error } = await supabase.storage
        .from("gcash")
        .upload(filePath, body, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage.from("gcash").getPublicUrl(filePath);

      await supabase
        .from("agents")
        .update({ gcash_qr: data.publicUrl })
        .eq("id", agent.id);

      setGcashQR(data.publicUrl);
      Alert.alert("Uploaded", "GCash QR updated");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  /* -----------------------------
     💾 SAVE GCASH INFO
  ----------------------------- */
  const handleSaveGcash = async () => {
    if (!agent) return;

    setUploading(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          gcash_number: gcashNumber,
          gcash_qr: gcashQR,
        })
        .eq("id", agent.id);

      if (error) throw error;

      Alert.alert("Success", "GCash info saved");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  /* -----------------------------
     🔃 FETCH AGENT DATA
  ----------------------------- */
  const fetchAgentProfile = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("User not found");

      const { data: profile } = await supabase
        .from("users_profile")
        .select("agent_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!profile?.agent_id) throw new Error("No agent linked");

      const agentId = profile.agent_id;

      const { data: agentData } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .single();

      setAgent({
        ...agentData,
        position: agentData.position || "Sales Executive",
      });

      setFirstName(agentData.firstname);
      setLastName(agentData.lastname);
      setGcashNumber(agentData.gcash_number || "");
      setGcashQR(agentData.gcash_qr || null);

      /* ✅ LIFETIME (FROM NOV 2025) */
      const { data: allRows } = await supabase
        .from("agent_commission_rollups")
        .select(
          "period_year, period_month, monthly_commission, membership_commission, override_commission, recruiter_bonus"
        )
        .eq("agent_id", agentId)
        .gte("period_year", 2025);

      const lifetime = (allRows || []).reduce((sum: number, r: any) => {
        const isAfterStart =
          r.period_year > 2025 ||
          (r.period_year === 2025 && r.period_month >= 11);

        if (!isAfterStart) return sum;

        return (
          sum +
          (Number(r.monthly_commission) +
            Number(r.membership_commission) +
            Number(r.override_commission) +
            Number(r.recruiter_bonus))
        );
      }, 0);

      setLifetimeCommission(lifetime || 0);

      /* ✅ WALLET */
      const { data: wallet } = await supabase
        .from("agent_wallets")
        .select("balance")
        .eq("agent_id", agentId)
        .maybeSingle();

      setWithdrawable(Number(wallet?.balance || 0));
    } catch (err: any) {
      console.error("PROFILE ERROR:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentProfile();
  }, [fetchAgentProfile]);

  /* -----------------------------
     ✅ UPDATE PROFILE
  ----------------------------- */
  const updateProfile = async () => {
    if (!firstName || !lastName) {
      Alert.alert("Error", "Fill all name fields");
      return;
    }

    setUploading(true);
    try {
      const { error } = await supabase
        .from("agents")
        .update({
          firstname: firstName,
          lastname: lastName,
        })
        .eq("id", agent.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated");
      fetchAgentProfile();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  /* -----------------------------
     🔐 CHANGE PASSWORD
  ----------------------------- */
  const changePassword = async () => {
    if (newPass.length < 6)
      return Alert.alert("Weak password", "Minimum 6 characters");

    if (newPass !== confirmPass)
      return Alert.alert("Error", "Passwords do not match");

    try {
      setUploading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPass,
      });

      if (error) throw error;

      Alert.alert("Success", "Password updated");
      setNewPass("");
      setConfirmPass("");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgentProfile();
  }, [fetchAgentProfile]);

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0b4aa2" />
      </View>
    );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.welcome}>
        Welcome back, {agent?.firstname} 👋
      </Text>

      <TouchableOpacity onPress={pickAgentPhoto}>
        {agent?.photo_url ? (
          <Image source={{ uri: agent.photo_url }} style={styles.agentPhoto} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text>Tap to add photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.role}>{agent?.position}</Text>

      {/* ✅ COMMISSION SUMMARY */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Commission Summary</Text>
        <View style={styles.row}>
          <Text>Lifetime Commission</Text>
          <Text style={styles.value}>{peso(lifetimeCommission)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Withdrawable Balance</Text>
          <Text style={styles.value}>{peso(withdrawable)}</Text>
        </View>
      </View>

      {/* ✅ EDIT PROFILE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>

        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
        />

        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={updateProfile}>
          <Text style={styles.saveTxt}>Update Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ GCASH DETAILS (BELOW EDIT PROFILE) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>GCash Payout Details</Text>

        <TextInput
          style={styles.input}
          placeholder="GCash Number"
          keyboardType="number-pad"
          value={gcashNumber}
          onChangeText={setGcashNumber}
        />

        <View style={{ alignItems: "center", marginTop: 10 }}>
          {gcashQR ? (
            <>
              <Image source={{ uri: gcashQR }} style={styles.qr} />

              <TouchableOpacity
                onPress={pickQRImage}
                style={[styles.saveBtn, { backgroundColor: "#e0e7ff" }]}
              >
                <Text style={{ color: "#0b4aa2", fontWeight: "700" }}>
                  Replace QR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setGcashQR(null)}
                style={[styles.saveBtn, { backgroundColor: "#fee2e2" }]}
              >
                <Text style={{ color: "#dc2626", fontWeight: "700" }}>
                  Remove QR
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.saveBtn} onPress={pickQRImage}>
              <Text style={styles.saveTxt}>Upload GCash QR</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGcash}>
          <Text style={styles.saveTxt}>Save GCash Info</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ CHANGE PASSWORD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="New password"
          value={newPass}
          onChangeText={setNewPass}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Confirm password"
          value={confirmPass}
          onChangeText={setConfirmPass}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={changePassword}>
          <Text style={styles.saveTxt}>Update Password</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ LOGOUT */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => await supabase.auth.signOut()}
      >
        <Text style={styles.logoutTxt}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f2f6ff",
    alignItems: "center",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  welcome: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0b4aa2",
    marginBottom: 12,
  },
  agentPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 6,
  },
  photoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
  },
  role: {
    marginTop: 4,
    marginBottom: 12,
    color: "#333",
  },
  card: {
    width: "95%",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginVertical: 8,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#0b4aa2",
  },
  row: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  value: {
    fontWeight: "700",
    color: "#0b4aa2",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: "#0b4aa2",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: "center",
  },
  saveTxt: { color: "#fff", fontWeight: "700" },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: "#ef4444",
    padding: 12,
    width: "60%",
    alignItems: "center",
    borderRadius: 10,
  },
  logoutTxt: { color: "#fff", fontWeight: "700" },
  qr: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
});
