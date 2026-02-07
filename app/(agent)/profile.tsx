// ✨ REDESIGNED: Memorial Services Theme - Profile Page
// 🎨 Visual changes: Elegant cards, peaceful colors, respectful layout
// ⚙️ Logic: ALL image uploads, profile updates, password changes, wallet queries UNCHANGED

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
import { Ionicons } from "@expo/vector-icons"; // ✨ NEW: Import Ionicons
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase, signOutUsername } from "../../lib/supabase";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../constants/memorialTheme";
import AddEmailModal from "../../components/AddEmailModal"; // ✨ NEW: Import Modal
import VerifyPasswordModal from "../../components/VerifyPasswordModal"; // ✨ NEW: Import Password Verification Modal

const peso = (n: number): string =>
  `₱${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AgentProfile() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gcashExpanded, setGcashExpanded] = useState(false); // 💎 NEW: Collapsible state
  const [passwordExpanded, setPasswordExpanded] = useState(false); // 💎 NEW: Collapsible state

  const [agent, setAgent] = useState<any>(null);
  const [lifetimeCommission, setLifetimeCommission] = useState(0);
  const [withdrawable, setWithdrawable] = useState(0);

  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashQR, setGcashQR] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // ✨ NEW: Email State
  const [email, setEmail] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [oldPass, setOldPass] = useState(""); // ✨ NEW
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // ✨ NEW: Password Visibility State
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // ⚙️ UNCHANGED: All image picker and upload logic
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

  // ⚙️ UNCHANGED: All Supabase queries for agent data
  const fetchAgentProfile = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("User not found");

      // ✨ NEW: Set Email
      setEmail(userData.user.email || "");

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

      // 2) Lifetime commission is now stored in agent_wallets
      const { data: wallet } = await supabase
        .from("agent_wallets")
        .select("balance, lifetime_commission")
        .eq("agent_id", agentId)
        .maybeSingle();

      const life = Number(wallet?.lifetime_commission || 0);
      const bal = Number(wallet?.balance || 0);

      setLifetimeCommission(life);
      setWithdrawable(bal);
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

  // ⚙️ UNCHANGED: Profile update logic
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

  // ⚙️ UPDATED: Password change logic
  const changePassword = async () => {
    if (!oldPass) return Alert.alert("Error", "Please enter your old password");
    if (newPass.length < 6) return Alert.alert("Weak password", "Minimum 6 characters");
    if (newPass !== confirmPass) return Alert.alert("Error", "Passwords do not match");

    setUploading(true);
    try {
      // 1. Verify Old Password
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: oldPass,
      });

      if (error) {
        throw new Error("Incorrect old password");
      }

      // 2. If valid, open the OTP modal
      setShowPasswordModal(true);
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
        <ActivityIndicator size="large" color={memorialColors.primary} />
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 💎 LUXURIOUS: Premium gradient header */}
      <View style={styles.header}>
        <View style={styles.headerGradient}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.agentName}>{agent?.firstname}</Text>
          <Text style={styles.position}>{agent?.position}</Text>
        </View>
      </View>

      {/* 💎 LUXURIOUS: Premium profile photo with gold ring */}
      <View style={styles.photoSection}>
        <TouchableOpacity onPress={pickAgentPhoto} style={styles.photoContainer}>
          <View style={styles.photoGoldRing}>
            {agent?.photo_url ? (
              <Image source={{ uri: agent.photo_url }} style={styles.agentPhoto} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>+</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* 💎 LUXURIOUS: Premium commission summary with gold accents */}
      <View style={styles.premiumCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>💰</Text>
          <Text style={styles.cardTitle}>Commission Summary</Text>
        </View>
        <View style={styles.goldDivider} />

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Accumulated Commission</Text>
            <Text style={styles.summaryValue}>{peso(lifetimeCommission)}</Text>
            <Text style={styles.summarySubtext}>Non-withdrawable</Text>
          </View>

          <View style={styles.summaryDividerVertical} />

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Withdrawable Balance</Text>
            <Text style={styles.summaryValueGold}>{peso(withdrawable)}</Text>
            <Text style={styles.summarySubtext}>Available now</Text>
          </View>
        </View>
      </View>

      {/* 💎 LUXURIOUS: Recruitment Card */}
      <View style={styles.glassCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🤝</Text>
          <Text style={styles.cardTitle}>Recruitment</Text>
        </View>
        <View style={styles.divider} />

        <Text style={{
          fontSize: memorialFonts.sm,
          color: memorialColors.textSecondary,
          marginBottom: memorialSpacing.lg,
          fontStyle: 'italic'
        }}>
          Grow your team and earn lifetime commissions by recruiting new agents.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/(agent)/add-recruit")}
        >
          <Text style={styles.primaryButtonText}>Add Recruited Agent</Text>
        </TouchableOpacity>
      </View>

      {/* 💎 LUXURIOUS: Edit Profile Card */}
      <View style={styles.glassCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>✏️</Text>
          <Text style={styles.cardTitle}>Edit Profile</Text>
        </View>
        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput
            style={styles.luxuryInput}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor={memorialColors.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput
            style={styles.luxuryInput}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor={memorialColors.textMuted}
          />
        </View>

        {/* ✨ NEW: Email Field (Read-only + Change Button) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={{ gap: 10 }}>
            <TextInput
              style={[styles.luxuryInput, { backgroundColor: '#f3f4f6', color: '#6b7280' }]}
              value={email}
              editable={false}
              placeholder="Email address"
            />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowEmailModal(true)}
            >
              <Text style={styles.secondaryButtonText}>Change Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={updateProfile}>
          <Text style={styles.primaryButtonText}>Update Profile</Text>
        </TouchableOpacity>
      </View>

      {/* 💎 LUXURIOUS: Collapsible GCash Details Card */}
      <View style={styles.glassCard}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setGcashExpanded(!gcashExpanded)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.cardIcon}>💳</Text>
            <Text style={styles.cardTitle}>GCash Payout Details</Text>
          </View>
          <Text style={styles.cardToggle}>{gcashExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {gcashExpanded && (
          <>
            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GCash Number</Text>
              <TextInput
                style={styles.luxuryInput}
                placeholder="09XX XXX XXXX"
                placeholderTextColor={memorialColors.textMuted}
                keyboardType="number-pad"
                value={gcashNumber}
                onChangeText={setGcashNumber}
              />
            </View>

            <View style={styles.qrSection}>
              {gcashQR ? (
                <>
                  <Image source={{ uri: gcashQR }} style={styles.qrImage} />

                  <TouchableOpacity
                    onPress={pickQRImage}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Replace QR Code</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setGcashQR(null)}
                    style={styles.dangerButton}
                  >
                    <Text style={styles.primaryButtonText}>Remove QR Code</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.outlineButton} onPress={pickQRImage}>
                  <Text style={styles.outlineButtonText}>Upload GCash QR Code</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveGcash}>
              <Text style={styles.primaryButtonText}>Save GCash Info</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 💎 LUXURIOUS: Collapsible Change Password Card */}
      <View style={styles.glassCard}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setPasswordExpanded(!passwordExpanded)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.cardIcon}>🔒</Text>
            <Text style={styles.cardTitle}>Change Password</Text>
          </View>
          <Text style={styles.cardToggle}>{passwordExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {passwordExpanded && (
          <>
            <View style={styles.divider} />

            {/* ✨ NEW: Old Password Field with Eye Icon */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Old Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showOldPass}
                  placeholder="Enter old password"
                  placeholderTextColor={memorialColors.textMuted}
                  value={oldPass}
                  onChangeText={setOldPass}
                />
                <TouchableOpacity onPress={() => setShowOldPass(!showOldPass)} style={styles.eyeIcon}>
                  <Ionicons name={showOldPass ? "eye-off" : "eye"} size={20} color={memorialColors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ✨ UPDATED: New Password Field with Eye Icon */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showNewPass}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={memorialColors.textMuted}
                  value={newPass}
                  onChangeText={setNewPass}
                />
                <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} style={styles.eyeIcon}>
                  <Ionicons name={showNewPass ? "eye-off" : "eye"} size={20} color={memorialColors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ✨ UPDATED: Confirm Password Field with Eye Icon */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showConfirmPass}
                  placeholder="Re-enter new password"
                  placeholderTextColor={memorialColors.textMuted}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                />
                <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeIcon}>
                  <Ionicons name={showConfirmPass ? "eye-off" : "eye"} size={20} color={memorialColors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={changePassword}>
              <Text style={styles.primaryButtonText}>Update Password</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 💎 LUXURIOUS: Sign Out Button */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={async () => await signOutUsername()}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* ✨ NEW: Email Modal */}
      <AddEmailModal
        visible={showEmailModal}
        currentEmail={email}
        canDismiss={true}
        onClose={() => setShowEmailModal(false)}
        onSuccess={(newEmail) => {
          setEmail(newEmail);
          setShowEmailModal(false);
          Alert.alert("Success", "Email updated successfully");
        }}
      />

      {/* ✨ NEW: Password Verification Modal */}
      <VerifyPasswordModal
        visible={showPasswordModal}
        email={email}
        newPassword={newPass}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setShowPasswordModal(false);
          setNewPass("");
          setConfirmPass("");
          Alert.alert("Success", "Password updated successfully");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: memorialColors.pearl,
  },
  contentContainer: {
    alignItems: "center",
    paddingBottom: memorialSpacing.tabBarHeight,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: memorialColors.pearl,
  },

  // 💎 LUXURIOUS: Premium gradient header
  header: {
    width: "100%",
    overflow: "hidden",
  },
  headerGradient: {
    backgroundColor: memorialColors.primary,
    paddingTop: memorialSpacing.xxxl,
    paddingBottom: 80, // Increased to accommodate negative margin of photo
    paddingHorizontal: memorialSpacing.lg,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: memorialFonts.sm,
    color: memorialColors.goldLight,
    letterSpacing: memorialFonts.letterSpacing.wider,
    textTransform: "uppercase",
    marginBottom: memorialSpacing.xs,
  },
  agentName: {
    fontSize: memorialFonts.xxl,
    fontWeight: memorialFonts.bold,
    color: memorialColors.white,
    marginBottom: memorialSpacing.xs,
  },
  position: {
    fontSize: memorialFonts.md,
    color: memorialColors.goldLight,
    fontStyle: "italic",
  },

  // 💎 LUXURIOUS: Premium profile photo with gold ring
  photoSection: {
    marginTop: -50,
    marginBottom: memorialSpacing.lg,
    alignItems: "center",
  },
  photoContainer: {
    position: "relative",
  },
  photoGoldRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: memorialColors.gold,
    padding: 3,
    backgroundColor: memorialColors.white,
    ...memorialShadows.gold,
  },
  agentPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 52,
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 52,
    backgroundColor: memorialColors.ivory,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    fontSize: 40,
    color: memorialColors.textMuted,
    fontWeight: memorialFonts.regular,
  },

  // 💎 LUXURIOUS: Premium cards
  premiumCard: {
    width: "90%",
    maxWidth: 500,
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.xxl,
    marginVertical: memorialSpacing.md,
    ...memorialShadows.xl,
    borderWidth: 2,
    borderColor: memorialColors.gold,
  },
  glassCard: {
    width: "90%",
    maxWidth: 500,
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.lg,
    padding: memorialSpacing.xxl,
    marginVertical: memorialSpacing.md,
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.silver,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: memorialSpacing.md,
  },
  cardIcon: {
    fontSize: 20,
    marginRight: memorialSpacing.sm,
  },
  cardTitle: {
    fontSize: memorialFonts.lg,
    fontWeight: memorialFonts.bold,
    color: memorialColors.primary,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },
  cardToggle: {
    fontSize: memorialFonts.lg,
    color: memorialColors.gold,
    fontWeight: memorialFonts.bold,
  },
  goldDivider: {
    height: 2,
    backgroundColor: memorialColors.gold,
    marginBottom: memorialSpacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: memorialColors.silver,
    marginBottom: memorialSpacing.lg,
  },

  // 💎 LUXURIOUS: Commission summary grid
  summaryGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: memorialSpacing.lg,
  },
  summaryDividerVertical: {
    width: 1,
    height: 80,
    backgroundColor: memorialColors.goldLight,
  },
  summaryLabel: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textSecondary,
    marginBottom: memorialSpacing.sm,
    textTransform: "uppercase",
    letterSpacing: memorialFonts.letterSpacing.wide,
    textAlign: "center",
  },
  summaryValue: {
    fontSize: memorialFonts.xl,
    fontWeight: memorialFonts.bold,
    color: memorialColors.black,
    marginBottom: memorialSpacing.xs,
    textAlign: "center",
  },
  summaryValueGold: {
    fontSize: memorialFonts.xl,
    fontWeight: memorialFonts.bold,
    color: memorialColors.gold,
    marginBottom: memorialSpacing.xs,
    textAlign: "center",
  },
  summarySubtext: {
    fontSize: memorialFonts.xs,
    color: memorialColors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
  },

  // 💎 LUXURIOUS: Input fields
  inputGroup: {
    marginBottom: memorialSpacing.lg,
  },
  inputLabel: {
    fontSize: memorialFonts.sm,
    fontWeight: memorialFonts.semibold,
    color: memorialColors.black,
    marginBottom: memorialSpacing.sm,
    letterSpacing: memorialFonts.letterSpacing.wide,
    textTransform: "uppercase",
  },
  luxuryInput: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.md,
    borderWidth: 2,
    borderColor: memorialColors.silver,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.lg,
    fontSize: memorialFonts.md,
    color: memorialColors.black,
    ...memorialShadows.sm,
  },

  // 💎 LUXURIOUS: Buttons
  primaryButton: {
    backgroundColor: memorialColors.primary,
    borderRadius: memorialBorderRadius.md,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.xxl,
    alignItems: "center",
    marginTop: memorialSpacing.md,
    ...memorialShadows.md,
  },
  primaryButtonText: {
    color: memorialColors.white,
    fontSize: memorialFonts.md,
    fontWeight: memorialFonts.bold,
    letterSpacing: memorialFonts.letterSpacing.wider,
    textTransform: "uppercase",
  },


  // 💎 LUXURIOUS: Password Input Container
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.md,
    borderWidth: 2,
    borderColor: memorialColors.silver,
    ...memorialShadows.sm,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.lg,
    fontSize: memorialFonts.md,
    color: memorialColors.black,
  },
  eyeIcon: {
    padding: 10,
    marginRight: 5,
  },

  secondaryButton: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.md,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.xxl,
    alignItems: "center",
    marginTop: memorialSpacing.md,
    borderWidth: 2,
    borderColor: memorialColors.primary,
  },
  secondaryButtonText: {
    color: memorialColors.primary,
    fontSize: memorialFonts.md,
    fontWeight: memorialFonts.bold,
    letterSpacing: memorialFonts.letterSpacing.wider,
    textTransform: "uppercase",
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderRadius: memorialBorderRadius.md,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.xxl,
    alignItems: "center",
    marginTop: memorialSpacing.md,
    borderWidth: 2,
    borderColor: memorialColors.primary,
  },
  outlineButtonText: {
    color: memorialColors.primary,
    fontSize: memorialFonts.md,
    fontWeight: memorialFonts.bold,
    letterSpacing: memorialFonts.letterSpacing.wider,
    textTransform: "uppercase",
  },
  dangerButton: {
    backgroundColor: memorialColors.error,
    borderRadius: memorialBorderRadius.md,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.xxl,
    alignItems: "center",
    marginTop: memorialSpacing.md,
    ...memorialShadows.md,
  },

  // 💎 LUXURIOUS: QR Section
  qrSection: {
    alignItems: "center",
    marginVertical: memorialSpacing.lg,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: memorialBorderRadius.lg,
    borderWidth: 2,
    borderColor: memorialColors.gold,
    marginBottom: memorialSpacing.md,
    ...memorialShadows.md,
  },

  // 💎 LUXURIOUS: Logout button
  logoutButton: {
    marginTop: memorialSpacing.xl,
    backgroundColor: memorialColors.charcoal,
    paddingVertical: memorialSpacing.lg,
    paddingHorizontal: memorialSpacing.huge,
    borderRadius: memorialBorderRadius.md,
    ...memorialShadows.lg,
  },
  logoutText: {
    color: memorialColors.white,
    fontSize: memorialFonts.md,
    fontWeight: memorialFonts.bold,
    letterSpacing: memorialFonts.letterSpacing.wider,
    textTransform: "uppercase",
  },
});
