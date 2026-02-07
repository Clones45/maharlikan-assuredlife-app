// ✨ REDESIGNED: Memorial Services Theme - Add Member Form
// 🎨 Visual changes: Gentle form styling, peaceful colors, respectful layout
// ⚙️ Logic: ALL validation, access code checks, Supabase inserts UNCHANGED

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
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from "../../constants/memorialTheme";

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
  "PACKAGE A1": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 29880,
    monthly_due: 498,
  },
  "PACKAGE A2": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 30000,
    monthly_due: 500,
  },
  "PACKAGE B1": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 20880,
    monthly_due: 348,
  },
  "PACKAGE B2": {
    casket_type: "JUNIOR PLAIN",
    contracted_price: 21000,
    monthly_due: 350,
  },
  MS: {
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
  // Track which beneficiary is picking a date (for native picker)
  const [activeBeneDateIndex, setActiveBeneDateIndex] = useState<number | null>(null);

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
  const calculateAge = (dateStr: string): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const mDiff = now.getMonth() - d.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < d.getDate())) {
      years--;
    }
    return String(years);
  };

  const computeAge = (dateStr: string) => {
    setAge(calculateAge(dateStr));
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

  const handleBeneBirthDateChange = (_event: any, selectedDate?: Date) => {
    const idx = activeBeneDateIndex;
    setActiveBeneDateIndex(null); // Close picker
    if (idx === null || !selectedDate) return;

    const formatted = formatDate(selectedDate);
    const ageVal = calculateAge(formatted);

    setBeneficiaries((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        birthDate: formatted,
        age: ageVal
      };
      return next;
    });
  };

  const handleWebBeneDateChange = (index: number, e: any) => {
    const value = e.target.value;
    const ageVal = calculateAge(value);

    setBeneficiaries((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        birthDate: value,
        age: ageVal
      };
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

    if (accessCode.trim().toUpperCase().startsWith("A")) {
      showStatus("error", "Invalid Code", "This code is for Agent Recruitment only.");
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
      showStatus("error", "Package", "Please select a PACKAGE type.");
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
          balance: contractedPrice ?? 0,
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


      <Text style={styles.screenTitle}>Add Member (Using your CODE)</Text>

      {/* ACCESS CODE */}
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Enter Access Code"
          placeholderTextColor={memorialColors.textSecondary}
          value={accessCode}
          onChangeText={setAccessCode}
          autoCapitalize="characters"
        />


      </View>

      {/* MEMBER INFO */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Member Information</Text>

        <Text style={styles.label}>AF No</Text>
        <TextInput
          style={styles.input}
          placeholder="AF No"
          placeholderTextColor={memorialColors.textSecondary}
          value={mafNo}
          onChangeText={setMafNo}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          placeholderTextColor={memorialColors.textSecondary}
          value={lastName}
          onChangeText={setLastName}
        />
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          placeholderTextColor={memorialColors.textSecondary}
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text style={styles.label}>Middle Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Middle Name (optional)"
          placeholderTextColor={memorialColors.textSecondary}
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
                  style={[
                    styles.input,
                    !birthDate && { color: memorialColors.textSecondary }, // ⚡ FIX: Fake placeholder color
                  ]}
                  value={birthDate || "Select Birthdate (YYYY-MM-DD)"} // ⚡ FIX: Render as value
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

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          placeholder="Age"
          placeholderTextColor={memorialColors.textSecondary}
          keyboardType="numeric"
          value={age}
          onChangeText={setAge}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Address"
          placeholderTextColor={memorialColors.textSecondary}
          multiline
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Contact Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Contact Number"
          placeholderTextColor={memorialColors.textSecondary}
          value={contactNumber}
          onChangeText={setContactNumber}
        />
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor={memorialColors.textSecondary}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
        <Text style={styles.label}>Religion</Text>
        <TextInput
          style={styles.input}
          placeholder="Religion"
          placeholderTextColor={memorialColors.textSecondary}
          value={religion}
          onChangeText={setReligion}
        />

        {/* GENDER DROPDOWN */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={gender}
            onValueChange={(v) => setGender(v)}
            style={{
              color: gender
                ? memorialColors.textPrimary
                : memorialColors.textSecondary,
            }}
            dropdownIconColor={memorialColors.textPrimary}
          >
            <Picker.Item
              label="-- Select Gender --"
              value=""
              color={memorialColors.textSecondary}
            />
            <Picker.Item label="Male" value="Male" />
            <Picker.Item label="Female" value="Female" />
          </Picker>
          {!gender && (
            <View style={styles.pickerPlaceholderOverlay} pointerEvents="none">
              <Text style={styles.pickerPlaceholderText}>
                -- Select Gender --
              </Text>
            </View>
          )}
        </View>

        {/* CIVIL STATUS DROPDOWN */}
        <Text style={styles.label}>Civil Status</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={civilStatus}
            onValueChange={(v) => setCivilStatus(v)}
            style={{
              color: civilStatus
                ? memorialColors.textPrimary
                : memorialColors.textSecondary,
            }}
            dropdownIconColor={memorialColors.textPrimary}
          >
            <Picker.Item
              label="-- Select Civil Status --"
              value=""
              color={memorialColors.textSecondary}
            />
            <Picker.Item label="Single" value="Single" />
            <Picker.Item label="Married" value="Married" />
            <Picker.Item label="Widower" value="Widower" />
            <Picker.Item label="Widow" value="Widow" />
            <Picker.Item label="Separated" value="Separated" />
            <Picker.Item label="Divorced" value="Divorced" />
            <Picker.Item label="Annulled" value="Annulled" />
          </Picker>
          {!civilStatus && (
            <View style={styles.pickerPlaceholderOverlay} pointerEvents="none">
              <Text style={styles.pickerPlaceholderText}>
                -- Select Civil Status --
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Nationality</Text>
        <TextInput
          style={styles.input}
          placeholder="Nationality"
          placeholderTextColor={memorialColors.textSecondary}
          value={nationality}
          onChangeText={setNationality}
        />
        <Text style={styles.label}>Birthplace</Text>
        <TextInput
          style={styles.input}
          placeholder="Birthplace"
          placeholderTextColor={memorialColors.textSecondary}
          value={birthplace}
          onChangeText={setBirthplace}
        />
        <Text style={styles.label}>Zipcode</Text>
        <TextInput
          style={styles.input}
          placeholder="Zipcode"
          placeholderTextColor={memorialColors.textSecondary}
          value={zipcode}
          onChangeText={setZipcode}
        />
        <Text style={styles.label}>Height</Text>
        <TextInput
          style={styles.input}
          placeholder="Height"
          placeholderTextColor={memorialColors.textSecondary}
          value={height}
          onChangeText={setHeight}
        />
        <Text style={styles.label}>Weight</Text>
        <TextInput
          style={styles.input}
          placeholder="Weight"
          placeholderTextColor={memorialColors.textSecondary}
          value={weight}
          onChangeText={setWeight}
        />
        <Text style={styles.label}>Occupation</Text>
        <TextInput
          style={styles.input}
          placeholder="Occupation"
          placeholderTextColor={memorialColors.textSecondary}
          value={occupation}
          onChangeText={setOccupation}
        />
      </View>

      {/* MEMBERSHIP & PLAN */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Membership & Plan</Text>

        <Text style={styles.label}>Membership</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={membership}
            onValueChange={(v) => setMembership(v)}
            style={{
              color: membership
                ? memorialColors.textPrimary
                : memorialColors.textSecondary,
            }}
            dropdownIconColor={memorialColors.textPrimary}
          >
            <Picker.Item
              label="-- Select --"
              value=""
              color={memorialColors.textSecondary}
            />
            <Picker.Item label="Insurable" value="Insurable" />
            <Picker.Item label="Non-Insurable" value="Non-Insurable" />
          </Picker>
          {!membership && (
            <View style={styles.pickerPlaceholderOverlay} pointerEvents="none">
              <Text style={styles.pickerPlaceholderText}>-- Select --</Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>PACKAGE Type</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={planType}
            onValueChange={handlePlanChange}
            style={{
              color: planType
                ? memorialColors.textPrimary
                : memorialColors.textSecondary,
            }}
            dropdownIconColor={memorialColors.textPrimary}
          >
            <Picker.Item
              label="-- Select --"
              value=""
              color={memorialColors.textSecondary}
            />
            <Picker.Item label="PACKAGE A1" value="PACKAGE A1" />
            <Picker.Item label="PACKAGE A2" value="PACKAGE A2" />
            <Picker.Item label="PACKAGE B1" value="PACKAGE B1" />
            <Picker.Item label="PACKAGE B2" value="PACKAGE B2" />
            <Picker.Item label="CARD" value="CARD" />
          </Picker>
          {!planType && (
            <View style={styles.pickerPlaceholderOverlay} pointerEvents="none">
              <Text style={styles.pickerPlaceholderText}>-- Select --</Text>
            </View>
          )}
        </View>

        <Text style={styles.label}>Casket Type</Text>
        <TextInput
          style={[
            styles.input,
            !casketType && { color: memorialColors.textSecondary },
          ]}
          value={casketType || "Casket Type"}
          editable={false}
        />
        <Text style={styles.label}>Contracted Price</Text>
        <TextInput
          style={[
            styles.input,
            contractedPrice == null && { color: memorialColors.textSecondary },
          ]}
          value={
            contractedPrice != null
              ? String(contractedPrice)
              : "Contracted Price"
          }
          editable={false}
        />
        <Text style={styles.label}>Monthly Due</Text>
        <TextInput
          style={[
            styles.input,
            monthlyDue == null && { color: memorialColors.textSecondary },
          ]}
          value={monthlyDue != null ? String(monthlyDue) : "Monthly Due"}
          editable={false}
        />
      </View>

      {/* BENEFICIARIES */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Beneficiaries (Optional)</Text>
        <Text style={styles.helperText}>
          Beneficiaries can be reused across members.
        </Text>

        {beneficiaries.map((b, index) => (
          <View key={index} style={styles.beneBox}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor={memorialColors.textSecondary}
              value={b.lastName}
              onChangeText={(v) => updateBeneficiary(index, "lastName", v)}
            />
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor={memorialColors.textSecondary}
              value={b.firstName}
              onChangeText={(v) => updateBeneficiary(index, "firstName", v)}
            />
            <Text style={styles.label}>Middle Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Middle Name (optional)"
              placeholderTextColor={memorialColors.textSecondary}
              value={b.middleName}
              onChangeText={(v) => updateBeneficiary(index, "middleName", v)}
            />
            <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
              placeholder="Relationship (e.g. SON, HUSBAND)"
              placeholderTextColor={memorialColors.textSecondary}
              value={b.relation}
              onChangeText={(v) => updateBeneficiary(index, "relation", v)}
            />
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Address (optional)"
              placeholderTextColor={memorialColors.textSecondary}
              value={b.address}
              onChangeText={(v) => updateBeneficiary(index, "address", v)}
            />

            <Text style={styles.label}>Birthdate</Text>
            {Platform.OS === "web" ? (
              <input
                type="date"
                value={b.birthDate}
                onChange={(e) => handleWebBeneDateChange(index, e)}
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
              <TouchableOpacity
                onPress={() => setActiveBeneDateIndex(index)}
                activeOpacity={0.8}
              >
                <View pointerEvents="none">
                  <TextInput
                    style={[
                      styles.input,
                      !b.birthDate && { color: memorialColors.textSecondary },
                    ]}
                    value={b.birthDate || "Select Birthdate (YYYY-MM-DD)"}
                    editable={false}
                  />
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="Age (optional)"
              placeholderTextColor={memorialColors.textSecondary}
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
      {activeBeneDateIndex !== null && (
        <DateTimePicker
          value={new Date(activeBeneDateIndex !== null && beneficiaries[activeBeneDateIndex]?.birthDate ? beneficiaries[activeBeneDateIndex].birthDate : '2000-01-01')}
          mode="date"
          display="default"
          onChange={handleBeneBirthDateChange}
        />
      )}
    </ScrollView>


  );
}

// 🎨 MEMORIAL-THEMED STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: memorialColors.bgPrimary,
  },
  content: {
    padding: memorialSpacing.lg,
    paddingBottom: memorialSpacing.tabBarHeight,
  },
  screenTitle: {
    fontSize: memorialFonts.xxl,
    fontWeight: memorialFonts.bold,
    marginBottom: memorialSpacing.md,
    color: memorialColors.primary,
  },
  // 🎨 VISUAL: Peaceful card styling
  card: {
    backgroundColor: memorialColors.bgCard,
    borderRadius: memorialBorderRadius.lg,
    padding: memorialSpacing.lg,
    marginBottom: memorialSpacing.md,
    ...memorialShadows.md,
    borderWidth: 1,
    borderColor: memorialColors.borderLight,
  },
  sectionTitle: {
    fontSize: memorialFonts.lg,
    fontWeight: memorialFonts.semibold,
    marginBottom: memorialSpacing.sm,
    color: memorialColors.primary,
  },
  label: {
    fontWeight: memorialFonts.medium,
    marginTop: memorialSpacing.sm,
    marginBottom: memorialSpacing.xs,
    color: memorialColors.textSecondary,
  },
  // 🎨 VISUAL: Gentle input fields
  input: {
    borderWidth: 1,
    borderColor: memorialColors.border,
    borderRadius: memorialBorderRadius.md,
    paddingHorizontal: memorialSpacing.md,
    paddingVertical: memorialSpacing.sm,
    marginBottom: memorialSpacing.sm,
    backgroundColor: memorialColors.softWhite,
    fontSize: memorialFonts.md,
    color: memorialColors.textPrimary,
    minHeight: 50, // ⚡ FIX: Prevent clipping on Samsung/Xiaomi
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: memorialColors.border,
    borderRadius: memorialBorderRadius.md,
    marginBottom: memorialSpacing.sm,
    backgroundColor: memorialColors.softWhite,
    justifyContent: "center", // Center the picker text vertically
    height: 50, // Match aprox height of inputs
    position: "relative", // Ensure absolute child works
  },
  pickerPlaceholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: memorialColors.softWhite, // Opaque to hide flaky native text
    justifyContent: "center",
    paddingHorizontal: memorialSpacing.md, // Match Picker padding
    right: 40, // Leave space for dropdown arrow icon
  },
  pickerPlaceholderText: {
    color: memorialColors.textSecondary,
    fontSize: memorialFonts.md,
  },
  // 🎨 VISUAL: Memorial-themed buttons
  primaryBtn: {
    backgroundColor: memorialColors.primary,
    paddingVertical: memorialSpacing.md,
    borderRadius: memorialBorderRadius.md,
    alignItems: "center",
    marginTop: memorialSpacing.xs,
    ...memorialShadows.sm,
  },
  primaryBtnText: {
    color: memorialColors.softWhite,
    fontWeight: memorialFonts.semibold,
    fontSize: memorialFonts.md,
  },
  helperText: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    marginBottom: memorialSpacing.sm,
    fontStyle: "italic",
  },
  // 🎨 VISUAL: Respectful beneficiary boxes
  beneBox: {
    borderWidth: 1,
    borderColor: memorialColors.border,
    borderRadius: memorialBorderRadius.md,
    padding: memorialSpacing.md,
    marginBottom: memorialSpacing.sm,
    backgroundColor: memorialColors.cream,
  },
  removeText: {
    color: memorialColors.error,
    fontSize: memorialFonts.sm,
    textAlign: "right",
    marginTop: memorialSpacing.xs,
  },
  addMoreText: {
    color: memorialColors.primary,
    fontWeight: memorialFonts.semibold,
    marginTop: memorialSpacing.xs,
  },
  verifiedText: {
    marginTop: memorialSpacing.sm,
    fontSize: memorialFonts.sm,
    color: memorialColors.success,
    fontWeight: memorialFonts.medium,
  },
  // 🎨 VISUAL: Peaceful modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: memorialColors.overlayDark,
    justifyContent: "center",
    alignItems: "center",
    padding: memorialSpacing.xl,
  },
  modalContent: {
    backgroundColor: memorialColors.bgCard,
    borderRadius: memorialBorderRadius.xl,
    padding: memorialSpacing.xxl,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    ...memorialShadows.lg,
    borderWidth: 1,
    borderColor: memorialColors.borderLight,
  },
  modalTitle: {
    fontSize: memorialFonts.xl,
    fontWeight: memorialFonts.bold,
    marginTop: memorialSpacing.lg,
    marginBottom: memorialSpacing.sm,
    color: memorialColors.primary,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: memorialFonts.md,
    color: memorialColors.textSecondary,
    textAlign: "center",
    marginBottom: memorialSpacing.xxl,
  },
  modalButton: {
    paddingVertical: memorialSpacing.md,
    paddingHorizontal: memorialSpacing.xxxl,
    borderRadius: memorialBorderRadius.md,
    width: "100%",
    alignItems: "center",
    ...memorialShadows.sm,
  },
  modalButtonText: {
    color: memorialColors.softWhite,
    fontWeight: memorialFonts.semibold,
    fontSize: memorialFonts.md,
  },
});
