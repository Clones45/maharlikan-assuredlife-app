import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "../../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    memorialColors,
    memorialSpacing,
    memorialBorderRadius,
    memorialFonts,
    memorialShadows,
} from "../../constants/memorialTheme";
// import { Picker } from "@react-native-picker/picker";



const ADMIN_SECRET = "LOVE";

export default function AddRecruitScreen() {
    const [loading, setLoading] = useState(false);
    const [recruiterId, setRecruiterId] = useState<number | null>(null);

    // Form State
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [middleName, setMiddleName] = useState("");
    const [position, setPosition] = useState("Sales Executive");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Additional Details
    const [address, setAddress] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [birthDateObj, setBirthDateObj] = useState<Date | null>(null);
    const [showBirthPicker, setShowBirthPicker] = useState(false);

    // Access Code
    const [accessCode, setAccessCode] = useState("");


    const [successFlash, setSuccessFlash] = useState(false);

    const resetForm = () => {
        setFirstName("");
        setLastName("");
        setMiddleName("");
        setPosition("Sales Executive");
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setAddress("");
        setBirthDate("");
        setBirthDateObj(null);
        setAccessCode("");
    };


    useEffect(() => {
        const fetchRecruiterId = async () => {
            const id = await AsyncStorage.getItem("agent_id");
            if (id) {
                setRecruiterId(Number(id));
            } else {
                // Fallback to fetching from DB if not in storage
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from("users_profile")
                        .select("agent_id")
                        .eq("user_id", user.id)
                        .maybeSingle();
                    if (profile?.agent_id) {
                        setRecruiterId(profile.agent_id);
                        await AsyncStorage.setItem("agent_id", String(profile.agent_id));
                    }
                }
            }
        };
        fetchRecruiterId();
    }, []);

    const triggerSuccessFlash = () => {
        setSuccessFlash(true);
        setTimeout(() => setSuccessFlash(false), 4000);
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
        setBirthDateObj(selectedDate);
        setBirthDate(formatDate(selectedDate));
    };


    const handleCreateRecruit = async () => {
        console.log("[handleCreateRecruit] Starting...");
        if (!firstName || !lastName || !username || !password || !confirmPassword) {
            Alert.alert("Error", "Please fill in all required fields.");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            Alert.alert("Error", "Password must be at least 6 characters.");
            return;
        }

        if (!recruiterId) {
            console.error("[handleCreateRecruit] Missing recruiterId");
            Alert.alert("Error", "Could not identify you as a recruiter. Please try again later.");
            return;
        }

        setLoading(true);

        try {
            // 0. Validate Access Code
            if (!accessCode.trim()) {
                Alert.alert("Error", "Access Code is required.");
                return;
            }

            const code = accessCode.trim().toUpperCase();
            if (!code.startsWith("A")) {
                Alert.alert("Error", "For Agent Recruitment, the Access Code must start with 'A'.");
                return;
            }

            console.log("[handleCreateRecruit] Validating Access Code:", code);
            const { data: codeRow, error: codeErr } = await supabase
                .from("access_codes")
                .select("*")
                .eq("code", code)
                .maybeSingle();

            if (codeErr) throw codeErr;

            if (!codeRow) {
                Alert.alert("Error", "Invalid Access Code.");
                return;
            }

            if (codeRow.used) {
                Alert.alert("Error", "This Access Code has already been used.");
                return;
            }

            if (new Date(codeRow.expires_at) < new Date()) {
                Alert.alert("Error", "This Access Code has expired.");
                return;
            }


            // 0. Check if username already exists in users_profile to avoid 500 error
            console.log("[handleCreateRecruit] Checking if username exists:", username);
            const { data: existingUser, error: checkError } = await supabase
                .from("users_profile")
                .select("user_id")
                .eq("username", username.trim())
                .maybeSingle();

            if (checkError) {
                console.warn("[handleCreateRecruit] Username check error:", checkError);
            }
            if (existingUser) {
                Alert.alert("Error", "Username is already taken. Please choose another one.");
                setLoading(false);
                return;
            }

            // 1. Insert into agents table
            const agentPayload = {
                firstname: firstName.trim(),
                lastname: lastName.trim(),
                middlename: middleName.trim() || null,
                position: position,
                parent_id: recruiterId, // Used in registeragent.js
                recruiter_id: recruiterId, // Also in schema
                assigned_id: recruiterId, // Just in case
                address: address.trim() || null,
                birthdate: birthDate || null,
                hier_role: "SE",
            };


            console.log("[handleCreateRecruit] Inserting agent:", agentPayload);
            const { data: newAgent, error: agentError } = await supabase
                .from("agents")
                .insert(agentPayload)
                .select("id")
                .single();

            if (agentError) {
                console.error("[handleCreateRecruit] Agent insert error:", agentError);
                throw agentError;
            }
            if (!newAgent?.id) throw new Error("Failed to create agent record.");

            const agentId = newAgent.id;
            console.log("[handleCreateRecruit] Agent created with ID:", agentId);

            // 2. Create User Account via Edge Function
            const finalEmail = email.trim() || `${username.trim().toLowerCase()}@maharlikan.local`;

            console.log("[handleCreateRecruit] Invoking admin-create-user for username:", username);
            // PASSED as Object directly to let Supabase client handle serialization
            const { data: userData, error: userError } = await supabase.functions.invoke("admin-create-user", {
                headers: {
                    "x-admin-secret": ADMIN_SECRET,
                },
                body: {
                    username: username.trim(),
                    password: password,
                    role: "agent",
                    agent_id: agentId,
                    email: finalEmail,
                },
            });

            if (userError) {
                console.error("[handleCreateRecruit] Edge function invoke error:", userError);
                throw userError;
            }
            console.log("[handleCreateRecruit] Edge function response:", userData);

            if (userData?.error) throw new Error(userData.error);
            if (!userData?.ok) throw new Error("Edge function failed to create user (ok=false).");

            // 3. Initialize Agent Wallet (Optional but good for consistency)
            console.log("[handleCreateRecruit] Initializing wallet for agent:", agentId);
            const { error: walletError } = await supabase
                .from("agent_wallets")
                .insert({
                    agent_id: agentId,
                    balance: 0,
                    lifetime_commission: 0
                });

            if (walletError) {
                console.warn("[handleCreateRecruit] Wallet initialization warning:", walletError);
                // We don't throw here to avoid failing the whole process if RLS blocks wallet creation
            }

            // 4. Mark Access Code as Used
            const { error: updErr } = await supabase
                .from("access_codes")
                .update({
                    used: true,
                    used_at: new Date().toISOString(),
                })
                .eq("id", codeRow.id);

            if (updErr) {
                console.error("Failed to mark access code as used:", updErr);
                Alert.alert("Warning", "Agent created, but failed to mark code as used. Please report this.");
            }


            resetForm();
            triggerSuccessFlash();

            Alert.alert("Success", "Recruited agent created successfully!");

        } catch (error: any) {
            console.error("Recruitment Error:", error);
            Alert.alert("Error", error.message || "Failed to add recruited agent.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={memorialColors.white} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Recruit New Agent</Text>
                </View>

                {successFlash && (
                    <View style={styles.flashMessage}>
                        <Ionicons name="checkmark-circle" size={24} color={memorialColors.white} />
                        <Text style={styles.flashText}>Agent Account Created Successfully!</Text>
                    </View>
                )}

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Agent Details</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Access Code *</Text>
                        <TextInput
                            style={styles.input}
                            value={accessCode}
                            onChangeText={setAccessCode}
                            placeholder="Enter 'A' Code (e.g. A-12345)"
                            autoCapitalize="characters"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Enter last name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>First Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Enter first name"
                        />
                    </View>



                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Middle Name</Text>
                        <TextInput
                            style={styles.input}
                            value={middleName}
                            onChangeText={setMiddleName}
                            placeholder="Enter middle name (optional)"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Birthdate</Text>
                        <TouchableOpacity
                            onPress={() => setShowBirthPicker(true)}
                            activeOpacity={0.8}
                        >
                            <View pointerEvents="none">
                                <TextInput
                                    style={[
                                        styles.input,
                                        !birthDate && { color: memorialColors.textSecondary },
                                    ]}
                                    value={birthDate || "Select Birthdate (YYYY-MM-DD)"}
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
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address</Text>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Enter full address"
                            multiline
                        />
                    </View>




                    <View style={styles.divider} />

                    <Text style={styles.sectionTitle}>Login Credentials</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username *</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="Enter username"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="agent@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password *</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Minimum 6 characters"
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm Password *</Text>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Re-enter password"
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleCreateRecruit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={memorialColors.white} />
                        ) : (
                            <Text style={styles.submitButtonText}>Create Agent Account</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: memorialColors.pearl,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        backgroundColor: memorialColors.primary,
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        ...memorialShadows.md,
    },
    backButton: {
        marginRight: 15,
    },
    title: {
        fontSize: 22,
        fontWeight: memorialFonts.bold,
        color: memorialColors.white,
    },
    card: {
        margin: 20,
        padding: 24,
        backgroundColor: memorialColors.white,
        borderRadius: memorialBorderRadius.xl,
        ...memorialShadows.lg,
        borderWidth: 1,
        borderColor: memorialColors.silver,
    },
    flashMessage: {
        backgroundColor: "#4CAF50",
        margin: 20,
        marginBottom: 0,
        padding: 15,
        borderRadius: memorialBorderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...memorialShadows.md,
    },
    flashText: {
        color: memorialColors.white,
        fontWeight: memorialFonts.bold,
        marginLeft: 10,
        fontSize: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: memorialFonts.bold,
        color: memorialColors.primary,
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: memorialColors.gold,
        paddingBottom: 5,
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        fontWeight: memorialFonts.semibold,
        color: memorialColors.black,
        marginBottom: 8,
        textTransform: "uppercase",
    },
    input: {
        backgroundColor: memorialColors.white,
        borderRadius: memorialBorderRadius.md,
        borderWidth: 1,
        borderColor: memorialColors.silver,
        padding: 12,
        fontSize: 16,
        color: memorialColors.black,
    },
    pickerContainer: {
        backgroundColor: memorialColors.white,
        borderRadius: memorialBorderRadius.md,
        borderWidth: 1,
        borderColor: memorialColors.silver,
        overflow: "hidden",
    },
    picker: {
        height: 50,
        width: "100%",
    },
    divider: {
        height: 1,
        backgroundColor: memorialColors.silver,
        marginVertical: 25,
    },
    submitButton: {
        backgroundColor: memorialColors.primary,
        borderRadius: memorialBorderRadius.md,
        padding: 16,
        alignItems: "center",
        marginTop: 20,
        ...memorialShadows.md,
    },
    submitButtonText: {
        color: memorialColors.white,
        fontSize: 16,
        fontWeight: memorialFonts.bold,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
});
