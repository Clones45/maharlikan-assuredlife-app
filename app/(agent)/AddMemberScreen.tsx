import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme"; // optional, you can replace with your own

const PROFILE_TABLE = "users_profile";

type Beneficiary = {
  firstName: string;
  lastName: string;
  middleName: string;
  relation: string;
  address: string;
  birthDate: string;
  age: string;
};

const PLAN_MAP: Record<
  string,
  { casket_type: string; contracted_price: number; monthly_due: number }
> = {
  "PLAN A1": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 29880,
    monthly_due: 498,
  },
  "PLAN A2": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 30000,
    monthly_due: 500,
  },
  "PLAN B1": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 20880,
    monthly_due: 348,
  },
  "PLAN B2": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 21000,
    monthly_due: 350,
  },
  CARD: {
    casket_type: "NO CASKET",
    contracted_price: 0,
    monthly_due: 0,
  },
};

export default function AddMemberScreen() {
  // ================= AGENT / ACCESS CODE =================
  const [agentId, setAgentId] = useState<number | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: "success" as "success" | "error",
    title: "",
    message: "",
  });

  const showStatus = (
    type: "success" | "error",
    title: string,
    message: string
  ) => {
    setStatusModal({ visible: true, type, title, message });
  };

  // ================= REQUIRED FIELDS =================
  const [mafNo, setMafNo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [birthDate, setBirthDate] = useState(""); // stored as YYYY-MM-DD string
  const [birthDateObj, setBirthDateObj] = useState<Date | null>(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);

  const [age, setAge] = useState("");

  // ================= OPTIONAL MEMBER FIELDS =================
  const [middleName, setMiddleName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [religion, setReligion] = useState("");
  const [gender, setGender] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [nationality, setNationality] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [occupation, setOccupation] = useState("");
  const [membership, setMembership] = useState("");

  // ================= PLAN =================
  const [planType, setPlanType] = useState("");
  const [casketType, setCasketType] = useState("");
  const [contractedPrice, setContractedPrice] = useState<number | null>(null);
  const [monthlyDue, setMonthlyDue] = useState<number | null>(null);

  // ================= BENEFICIARIES =================
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    {
      firstName: "",
      lastName: "",
      middleName: "",
      relation: "",
      address: "",
      birthDate: "",
      age: "",
    },
  ]);

  const [saving, setSaving] = useState(false);

  // =====================================
  // Load agent_id for the logged-in agent
  // =====================================
  useEffect(() => {
    const fetchAgentId = async () => {
      try {
        const { data: sessionData, error: sessErr } =
          await supabase.auth.getSession();
        if (sessErr) {
          console.error("getSession error:", sessErr);
          return;
        }
        const userId = sessionData.session?.user.id;
        if (!userId) {
          Alert.alert("Auth", "No logged-in user found.");
          return;
        }

        // Try users_profile first
        const { data: profile, error: profErr } = await supabase
          .from(PROFILE_TABLE)
          .select("agent_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (profErr) {
          console.error("Profile lookup error:", profErr);
        }

        if (profile?.agent_id) {
          setAgentId(profile.agent_id);
        } else {
          // Fallback to AsyncStorage if you store it there
          const fromStorage = await AsyncStorage.getItem("agent_id");
          if (fromStorage) {
            setAgentId(Number(fromStorage));
          } else {
            console.warn(
              "No agent_id found in users_profile or AsyncStorage. Members will fail to save."
            );
          }
        }
      } catch (err) {
        console.error("fetchAgentId exception:", err);
      }
    };

    fetchAgentId();
  }, []);

  // =====================================
  // Helper: compute age from birthdate
  // =====================================
  const computeAge = (dateStr: string) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const mDiff = now.getMonth() - d.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < d.getDate())) {
      years--;
    }
    setAge(String(years));
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleBirthDateChange = (_event: any, selectedDate?: Date) => {
    setShowBirthPicker(false);
    if (!selectedDate) return;
    const formatted = formatDate(selectedDate);
    setBirthDateObj(selectedDate);
    setBirthDate(formatted);
    computeAge(formatted);
  };

  // ✅ WEB date input handler
  const handleWebDateChange = (e: any) => {
    const value = e.target.value; // YYYY-MM-DD
    setBirthDate(value);
    if (value) computeAge(value);
  };

  // =====================================
  // Plan change handler
  // =====================================
  const handlePlanChange = (value: string) => {
    setPlanType(value);
    const plan = PLAN_MAP[value];
    if (plan) {
      setCasketType(plan.casket_type);
      setContractedPrice(plan.contracted_price);
      setMonthlyDue(plan.monthly_due);
    } else {
      setCasketType("");
      setContractedPrice(null);
      setMonthlyDue(null);
    }
  };

  // =====================================
  // Beneficiary helpers
  // =====================================
  const updateBeneficiary = (
    index: number,
    key: keyof Beneficiary,
    value: string
  ) => {
    setBeneficiaries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addBeneficiary = () => {
    setBeneficiaries((prev) => [
      ...prev,
      {
        firstName: "",
        lastName: "",
        middleName: "",
        relation: "",
        address: "",
        birthDate: "",
        age: "",
      },
    ]);
  };

  const removeBeneficiary = (index: number) => {
    setBeneficiaries((prev) => prev.filter((_, i) => i !== index));
  };



  // =====================================
  // Validation before Save
  // =====================================
  const validateBeforeSave = () => {
    if (!accessCode.trim()) {
      showStatus("error", "Access Code", "Access Code is required.");
      return false;
    }

    if (!mafNo.trim()) {
      showStatus("error", "AF No", "AF No is required.");
      return false;
    }
    if (!firstName.trim() || !lastName.trim()) {
      showStatus("error", "Name", "First Name and Last Name are required.");
      return false;
    }
    if (!birthDate.trim()) {
      showStatus("error", "Birthdate", "Birthdate is required.");
      return false;
    }
    if (!age.trim()) {
      showStatus("error", "Age", "Age is required.");
      return false;
    }
    if (!address.trim()) {
      showStatus("error", "Address", "Address is required.");
      return false;
    }
    if (!membership) {
      showStatus("error", "Membership", "Please select membership.");
      return false;
    }
    if (!planType) {
      showStatus("error", "Plan", "Please select a plan type.");
      return false;
    }
    if (!agentId) {
      showStatus(
        "error",
        "Agent",
        "No agent_id found for this user. Please check users_profile."
      );
      return false;
    }
    return true;
  };

  // =====================================
  // Save Member (real code validation)
  // =====================================
  const saveMember = async () => {
    if (!validateBeforeSave()) return;

    setSaving(true);
    const code = accessCode.trim().toUpperCase();

    try {
      // 1️⃣ Re-check the access code in DB (fresh)
      const { data: codeRow, error: codeErr } = await supabase
        .from("access_codes")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (codeErr) throw codeErr;

      if (!codeRow) {
        showStatus("error", "Invalid Code", "This access code does not exist.");
        setSaving(false);
        return;
      }

      const now = new Date();
      const expiry = new Date(codeRow.expires_at);

      if (codeRow.used) {
        showStatus("error", "Code Used", "This access code has already been used.");
        setSaving(false);
        return;
      }
      if (expiry < now) {
        showStatus("error", "Code Expired", "This access code has already expired.");
        setSaving(false);
        return;
      }

      // 2️⃣ Insert into members table
      const { data: member, error: memberErr } = await supabase
        .from("members")
        .insert({
          maf_no: mafNo.trim().toUpperCase(),
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,

          address: address.trim(),
          contact_number: contactNumber.trim() || null,
          phone_number: phoneNumber.trim() || null,

          religion: religion.trim() || null,
          birth_date: birthDate,
          age: Number(age),

          monthly_due: monthlyDue ?? null,
          plan_type: planType,
          contracted_price: contractedPrice ?? null,

          gender: gender || null,
          civil_status: civilStatus || null,
          zipcode: zipcode.trim() || null,
          birthplace: birthplace.trim() || null,
          nationality: nationality.trim() || null,
          height: height.trim() || null,
          weight: weight.trim() || null,
          casket_type: casketType || null,
          membership: membership || null,
          occupation: occupation.trim() || null,

          agent_id: agentId,
          // date_joined, status, membership_paid, etc. use DB defaults
        })
        .select()
        .single();

      if (memberErr) throw memberErr;

      const memberId = member.id as number;

      // 3️⃣ Insert beneficiaries (duplicates allowed)
      const beneRows = beneficiaries
        .filter((b) => b.firstName.trim() || b.lastName.trim())
        .map((b) => ({
          member_id: memberId,
          last_name: b.lastName.trim() || null,
          first_name: b.firstName.trim() || null,
          middle_name: b.middleName.trim() || null,
          address: b.address.trim() || null,
          age: b.age ? Number(b.age) : null,
          relation: b.relation.trim() || null,
          birth_date: b.birthDate || null,
          agent_id: agentId,
        }));

      if (beneRows.length > 0) {
        const { error: beneErr } = await supabase
          .from("beneficiaries")
          .insert(beneRows);
        if (beneErr) {
          console.error("Beneficiaries insert error:", beneErr);
          showStatus(
            "error",
            "Warning",
            "Member saved, but beneficiaries failed to save."
          );
        }
      }

      // 4️⃣ Mark access code as used
      const { error: updErr } = await supabase
        .from("access_codes")
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq("id", codeRow.id);

      if (updErr) {
        console.error("Access code update error:", updErr);
        showStatus(
          "error",
          "Warning",
          "Member saved, but failed to update access code status."
        );
      }

      showStatus("success", "Success", "Member has been registered successfully.");
      resetForm();
    } catch (err: any) {
      console.error("saveMember error:", err);
      showStatus("error", "Error", err?.message || "Failed to save member.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setAccessCode("");
    setMafNo("");
    setFirstName("");
    setLastName("");
    setMiddleName("");
    setBirthDate("");
    setBirthDateObj(null);
    setShowBirthPicker(false);
    setAge("");
    setAddress("");
    setContactNumber("");
    setPhoneNumber("");
    setReligion("");
    setGender("");
    setCivilStatus("");
    setZipcode("");
    setBirthplace("");
    setNationality("");
    setHeight("");
    setWeight("");
    setOccupation("");
    setMembership("");
    setPlanType("");
    setCasketType("");
    setContractedPrice(null);
    setMonthlyDue(null);
    setBeneficiaries([
      {
        firstName: "",
        lastName: "",
        middleName: "",
        relation: "",
        address: "",
        birthDate: "",
        age: "",
      },
    ]);
  };

  // =====================================
  // UI
  // =====================================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >

      <Text style={{ color: "red", fontWeight: "bold", marginBottom: 10 }}>
        ✅ THIS IS THE PATCHED VERSION
      </Text>
      <Text style={styles.screenTitle}>Add Member (With Code)</Text>

      {/* ACCESS CODE */}
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Enter Access Code"
          value={accessCode}
          onChangeText={setAccessCode}
          autoCapitalize="characters"
        />


      </View>

      {/* MEMBER INFO */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Member Information</Text>

        <TextInput
          style={styles.input}
          placeholder="AF No"
          value={mafNo}
          onChangeText={setMafNo}
        />
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
        />
        <TextInput
          style={styles.input}
          placeholder="Middle Name (optional)"
          value={middleName}
          onChangeText={setMiddleName}
        />

        {/* BIRTHDATE WITH PLATFORM SUPPORT */}
        <Text style={styles.label}>Birthdate</Text>

        {Platform.OS === "web" ? (
          <input
            type="date"
            value={birthDate}
            onChange={handleWebDateChange}
            style={{
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 8,
              padding: 10,
              marginBottom: 8,
              fontSize: 14,
              width: "100%",
            }}
          />
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setShowBirthPicker(true)}
              activeOpacity={0.8}
            >
              <View pointerEvents="none">
                <TextInput
                  style={styles.input}
                  placeholder="Select Birthdate (YYYY-MM-DD)"
                  value={birthDate}
                  editable={false}
                />
              </View>
            </TouchableOpacity>

            {showBirthPicker && (
              <DateTimePicker
                value={birthDateObj || new Date(2000, 0, 1)}
                mode="date"
                display="default"
                onChange={handleBirthDateChange}
              />
            )}
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Age"
          keyboardType="numeric"
          value={age}
          onChangeText={setAge}
        />

        <TextInput
          style={styles.input}
          placeholder="Address"
          multiline
          value={address}
          onChangeText={setAddress}
        />

        <TextInput
          style={styles.input}
          placeholder="Contact Number"
          value={contactNumber}
          onChangeText={setContactNumber}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
        <TextInput
          style={styles.input}
          placeholder="Religion"
          value={religion}
          onChangeText={setReligion}
        />

        {/* GENDER DROPDOWN */}
        <Text style={styles.label}>Gender</Text>
        <Picker selectedValue={gender} onValueChange={(v) => setGender(v)}>
          <Picker.Item label="-- Select Gender --" value="" />
          <Picker.Item label="Male" value="Male" />
          <Picker.Item label="Female" value="Female" />
        </Picker>

        {/* CIVIL STATUS DROPDOWN */}
        <Text style={styles.label}>Civil Status</Text>
        <Picker
          selectedValue={civilStatus}
          onValueChange={(v) => setCivilStatus(v)}
        >
          <Picker.Item label="-- Select Civil Status --" value="" />
          <Picker.Item label="Single" value="Single" />
          <Picker.Item label="Married" value="Married" />
          <Picker.Item label="Widower" value="Widower" />
          <Picker.Item label="Widow" value="Widow" />
          <Picker.Item label="Separated" value="Separated" />
          <Picker.Item label="Divorced" value="Divorced" />
          <Picker.Item label="Annulled" value="Annulled" />
        </Picker>

        <TextInput
          style={styles.input}
          placeholder="Nationality"
          value={nationality}
          onChangeText={setNationality}
        />
        <TextInput
          style={styles.input}
          placeholder="Birthplace"
          value={birthplace}
          onChangeText={setBirthplace}
        />
        <TextInput
          style={styles.input}
          placeholder="Zipcode"
          value={zipcode}
          onChangeText={setZipcode}
        />
        <TextInput
          style={styles.input}
          placeholder="Height"
          value={height}
          onChangeText={setHeight}
        />
        <TextInput
          style={styles.input}
          placeholder="Weight"
          value={weight}
          onChangeText={setWeight}
        />
        <TextInput
          style={styles.input}
          placeholder="Occupation"
          value={occupation}
          onChangeText={setOccupation}
        />
      </View>

      {/* MEMBERSHIP & PLAN */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Membership & Plan</Text>

        <Text style={styles.label}>Membership</Text>
        <Picker
          selectedValue={membership}
          onValueChange={(v) => setMembership(v)}
        >
          <Picker.Item label="-- Select --" value="" />
          <Picker.Item label="Insurable" value="Insurable" />
          <Picker.Item label="Non-Insurable" value="Non-Insurable" />
        </Picker>

        <Text style={styles.label}>Plan Type</Text>
        <Picker selectedValue={planType} onValueChange={handlePlanChange}>
          <Picker.Item label="-- Select --" value="" />
          <Picker.Item label="PLAN A1" value="PLAN A1" />
          <Picker.Item label="PLAN A2" value="PLAN A2" />
          <Picker.Item label="PLAN B1" value="PLAN B1" />
          <Picker.Item label="PLAN B2" value="PLAN B2" />
          <Picker.Item label="CARD" value="CARD" />
        </Picker>

        <TextInput
          style={styles.input}
          placeholder="Casket Type"
          value={casketType}
          editable={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Contracted Price"
          value={contractedPrice != null ? String(contractedPrice) : ""}
          editable={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Monthly Due"
          value={monthlyDue != null ? String(monthlyDue) : ""}
          editable={false}
        />
      </View>

      {/* BENEFICIARIES */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Beneficiaries (Optional)</Text>
        <Text style={styles.helperText}>
          Beneficiaries can be reused across members. Duplicates are allowed.
        </Text>

        {beneficiaries.map((b, index) => (
          <View key={index} style={styles.beneBox}>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={b.firstName}
              onChangeText={(v) => updateBeneficiary(index, "firstName", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={b.lastName}
              onChangeText={(v) => updateBeneficiary(index, "lastName", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Middle Name (optional)"
              value={b.middleName}
              onChangeText={(v) => updateBeneficiary(index, "middleName", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Relationship (e.g. SON, HUSBAND)"
              value={b.relation}
              onChangeText={(v) => updateBeneficiary(index, "relation", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Address (optional)"
              value={b.address}
              onChangeText={(v) => updateBeneficiary(index, "address", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Birthdate (YYYY-MM-DD, optional)"
              value={b.birthDate}
              onChangeText={(v) => updateBeneficiary(index, "birthDate", v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Age (optional)"
              keyboardType="numeric"
              value={b.age}
              onChangeText={(v) => updateBeneficiary(index, "age", v)}
            />

            {beneficiaries.length > 1 && (
              <TouchableOpacity onPress={() => removeBeneficiary(index)}>
                <Text style={styles.removeText}>Remove Beneficiary</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity onPress={addBeneficiary}>
          <Text style={styles.addMoreText}>+ Add another beneficiary</Text>
        </TouchableOpacity>
      </View>

      {/* SAVE BUTTON */}
      <TouchableOpacity
        style={[styles.primaryBtn, { marginBottom: 40 }]}
        onPress={saveMember}
        disabled={saving}
      >
        <Text style={styles.primaryBtnText}>
          {saving ? "Saving..." : "Save Member"}
        </Text>
      </TouchableOpacity>
      {/* CUSTOM STATUS MODAL */}
      <Modal
        transparent
        animationType="fade"
        visible={statusModal.visible}
        onRequestClose={() =>
          setStatusModal((prev) => ({ ...prev, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons
              name={
                statusModal.type === "success"
                  ? "checkmark-circle"
                  : "alert-circle"
              }
              size={60}
              color={statusModal.type === "success" ? "#10b981" : "#ef4444"}
            />
            <Text style={styles.modalTitle}>{statusModal.title}</Text>
            <Text style={styles.modalMessage}>{statusModal.message}</Text>

            <TouchableOpacity
              style={[
                styles.modalButton,
                {
                  backgroundColor:
                    statusModal.type === "success" ? "#10b981" : "#ef4444",
                },
              ]}
              onPress={() =>
                setStatusModal((prev) => ({ ...prev, visible: false }))
              }
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>


  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  content: { padding: 16 },
  screenTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: colors?.primary || "#0b4d87",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },
  label: { fontWeight: "600", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: colors?.primary || "#0b4d87",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  helperText: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  beneBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
  },
  removeText: {
    color: "#b91c1c",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  addMoreText: {
    color: colors?.primary || "#0b4d87",
    fontWeight: "600",
    marginTop: 4,
  },
  verifiedText: {
    marginTop: 6,
    fontSize: 12,
    color: "green",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    color: "#1f2937",
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
