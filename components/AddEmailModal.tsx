import React, { useState } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { memorialColors } from "../constants/memorialTheme";

export default function AddEmailModal({
    visible,
    currentEmail,
    onSuccess,
    onClose,        // ✨ NEW
    canDismiss = false, // ✨ NEW
}: {
    visible: boolean;
    currentEmail: string;
    onSuccess: (newEmail: string) => void;
    onClose?: () => void;
    canDismiss?: boolean;
}) {
    const [step, setStep] = useState<"email" | "otp">("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setStep("email");
            setEmail("");
            setOtp("");
            setError(null);
        }
    }, [visible]);

    const handleUpdateEmail = async () => {
        if (!email.includes("@") || !email.includes(".")) {
            setError("Please enter a valid email address.");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.updateUser({ email: email });
            if (error) throw error;

            // Check if email confirmation is required (it usually is for secure flows)
            // Supabase usually sends a confirmation email to the NEW email address.
            // We need to verify that OTP.
            setStep("otp");
        } catch (err: any) {
            setError(err.message || "Failed to send verification code.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) {
            setError("Please enter the 6-digit code.");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: email,
                token: otp,
                type: "email_change",
            });

            if (error) throw error;

            // Update users_profile
            const user = data.user;
            if (user) {
                const { error: dbError } = await supabase
                    .from("users_profile")
                    .update({ email: user.email })
                    .eq("user_id", user.id);

                if (dbError) console.error("Failed to update profile email:", dbError);
            }

            onSuccess(email);
        } catch (err: any) {
            setError(err.message || "Invalid code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => canDismiss && onClose?.()}>
            <View style={s.overlay}>
                <View style={s.card}>
                    <View style={s.header}>
                        <View style={{ width: 24 }} />
                        <View style={{ alignItems: 'center' }}>
                            <Ionicons name="mail-unread-outline" size={32} color={memorialColors.gold} />
                            <Text style={s.title}>Verify Personal Email</Text>
                        </View>
                        {/* ✨ NEW: Close Button */}
                        {canDismiss ? (
                            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color="#9ca3af" />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 24 }} />
                        )}
                    </View>

                    <Text style={s.description}>
                        {step === "email"
                            ? "To secure your account, please associate a personal email address. You will use this for recovery and notifications."
                            : `We sent a verification code to ${email}. Please enter it below.`}
                    </Text>

                    {error && (
                        <View style={s.errorBox}>
                            <Ionicons name="alert-circle" size={16} color="#ef4444" />
                            <Text style={s.errorText}>{error}</Text>
                        </View>
                    )}

                    {step === "email" ? (
                        <View style={s.inputGroup}>
                            <Text style={s.label}>Personal Email Address</Text>
                            <TextInput
                                style={s.input}
                                placeholder="juan@example.com"
                                placeholderTextColor="#9ca3af"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                    ) : (
                        <View style={s.inputGroup}>
                            <Text style={s.label}>Verification Code (OTP)</Text>
                            <TextInput
                                style={[s.input, { textAlign: "center", letterSpacing: 5, fontSize: 24 }]}
                                placeholder="000000"
                                placeholderTextColor="#9ca3af"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>
                    )}

                    <TouchableOpacity
                        style={s.button}
                        onPress={step === "email" ? handleUpdateEmail : handleVerifyOtp}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1a2e1a" />
                        ) : (
                            <Text style={s.buttonText}>
                                {step === "email" ? "Send Verification Code" : "Verify & Save"}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {step === "otp" && (
                        <TouchableOpacity onPress={() => setStep("email")} style={s.backBtn}>
                            <Text style={s.backText}>Change Email</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        padding: 20,
    },
    card: {
        backgroundColor: "#1f2937",
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: memorialColors.gold,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#fff",
        marginTop: 12,
    },
    description: {
        fontSize: 14,
        color: "#d1d5db",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 12,
        color: memorialColors.gold,
        fontWeight: "600",
        marginBottom: 8,
        textTransform: "uppercase",
    },
    input: {
        backgroundColor: "rgba(0,0,0,0.3)",
        borderWidth: 1,
        borderColor: "#374151",
        borderRadius: 12,
        padding: 16,
        color: "#fff",
        fontSize: 16,
    },
    button: {
        backgroundColor: memorialColors.gold,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    buttonText: {
        color: "#1a2e1a",
        fontWeight: "bold",
        fontSize: 16,
    },
    errorBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(239, 68, 68, 0.2)",
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    errorText: {
        color: "#fca5a5",
        fontSize: 13,
        flex: 1,
    },
    backBtn: {
        marginTop: 16,
        alignItems: 'center'
    },
    backText: {
        color: '#9ca3af',
        fontSize: 14,
        textDecorationLine: 'underline'
    }
});
