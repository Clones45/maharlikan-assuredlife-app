import React, { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { memorialColors } from "../constants/memorialTheme";

export default function VerifyPasswordModal({
    visible,
    email,
    newPassword,
    onSuccess,
    onClose,
}: {
    visible: boolean;
    email: string;
    newPassword: string;
    onSuccess: () => void;
    onClose: () => void;
}) {
    const [step, setStep] = useState<"send" | "verify">("send");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setStep("send");
            setOtp("");
            setError(null);
        }
    }, [visible]);

    const handleSendCode = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            setStep("verify");
            Alert.alert("Code Sent", `A verification code has been sent to ${email}`);
        } catch (err: any) {
            setError(err.message || "Failed to send code.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndChange = async () => {
        if (otp.length < 6) {
            setError("Please enter the 6-digit code.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Verify the OTP (This logs the user in/establishes the recovery session)
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: "recovery",
            });

            if (verifyError) throw verifyError;

            // 2. Update the password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) throw updateError;

            onSuccess();
        } catch (err: any) {
            setError(err.message || "Invalid code or failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={s.overlay}>
                <View style={s.card}>
                    <View style={s.header}>
                        <View style={{ width: 24 }} />
                        <View style={{ alignItems: 'center' }}>
                            <Ionicons name="shield-checkmark-outline" size={32} color={memorialColors.gold} />
                            <Text style={s.title}>Security Verification</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Ionicons name="close" size={24} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>

                    <Text style={s.description}>
                        {step === "send"
                            ? "To change your password, we need to verify it's really you. We'll send a code to your email."
                            : `Enter the code sent to ${email} to authorize the password change. if it is not in your primary, CHECK YOUR SPAM FOLDER`}
                    </Text>

                    {error && (
                        <View style={s.errorBox}>
                            <Ionicons name="alert-circle" size={16} color="#ef4444" />
                            <Text style={s.errorText}>{error}</Text>
                        </View>
                    )}

                    {step === "verify" && (
                        <View style={s.inputGroup}>
                            <Text style={s.label}>Verification Code</Text>
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
                        onPress={step === "send" ? handleSendCode : handleVerifyAndChange}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#1a2e1a" />
                        ) : (
                            <Text style={s.buttonText}>
                                {step === "send" ? "Send Verification Code" : "Verify & Change Password"}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {step === "verify" && (
                        <TouchableOpacity onPress={() => setStep("send")} style={s.backBtn}>
                            <Text style={s.backText}>Resend Code</Text>
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
