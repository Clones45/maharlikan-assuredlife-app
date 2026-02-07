import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Image,
    Platform,
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { supabase } from "../lib/supabase";
import { memorialColors, memorialFonts, memorialSpacing, memorialBorderRadius, memorialShadows } from "../constants/memorialTheme";

const LOGO = require("../assets/logo.png");
const WATERMARK = require("../assets/logo.png");
const { width, height } = Dimensions.get("window");

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState<"email" | "verify">("email");
    const [loading, setLoading] = useState(false);

    // Visibility states
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    const handleSendCode = async () => {
        if (!email.includes("@") || !email.includes(".")) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            setStep("verify");
            Alert.alert("Code Sent", `A verification code has been sent to ${email}`);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (otp.length < 6) return Alert.alert("Error", "Please enter the 6-digit code.");
        if (newPassword.length < 6) return Alert.alert("Weak Password", "Minimum 6 characters.");
        if (newPassword !== confirmPassword) return Alert.alert("Error", "Passwords do not match.");

        setLoading(true);
        try {
            // 1. Verify OTP (Logs user in)
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: "recovery",
            });
            if (verifyError) throw verifyError;

            // 2. Update Password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateError) throw updateError;

            // 3. Sign out so they have to log in with new password
            await supabase.auth.signOut();

            Alert.alert("Success", "Password reset successfully. Please log in with your new password.", [
                { text: "OK", onPress: () => router.replace("/login") }
            ]);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={s.container}>
            <LinearGradient
                colors={["#002117", "#004d36", "#002117"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={s.watermarkContainer} pointerEvents="none">
                <Image source={WATERMARK} style={s.watermark} resizeMode="contain" />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.keyboardView}>
                <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={s.innerContent}>

                        <Animated.View entering={FadeInDown.duration(800).springify()} style={s.header}>
                            <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                                <Ionicons name="arrow-back" size={24} color={memorialColors.gold} />
                            </TouchableOpacity>
                            <Image source={LOGO} style={s.logo} resizeMode="contain" />
                            <Text style={s.title}>Reset Password</Text>
                            <Text style={s.subtitle}>
                                {step === "email" ? "Enter your email to receive a code" : "Verify code and set new password"}
                            </Text>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(200).duration(800).springify()} style={s.cardWrapper}>
                            <BlurView intensity={Platform.OS === 'android' ? 100 : 30} tint="dark" style={s.blurContainer}>
                                <View style={s.cardContent}>

                                    {step === "email" ? (
                                        <View style={s.inputGroup}>
                                            <Text style={s.inputLabel}>Email Address</Text>
                                            <View style={s.inputWrapper}>
                                                <Ionicons name="mail-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                                                <TextInput
                                                    style={s.input}
                                                    placeholder="name@example.com"
                                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                                    value={email}
                                                    onChangeText={setEmail}
                                                    autoCapitalize="none"
                                                    keyboardType="email-address"
                                                />
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <View style={s.inputGroup}>
                                                <Text style={s.inputLabel}>Verification Code</Text>
                                                <TextInput
                                                    style={[s.input, s.otpInput]}
                                                    placeholder="000000"
                                                    placeholderTextColor="rgba(255,255,255,0.4)"
                                                    value={otp}
                                                    onChangeText={setOtp}
                                                    keyboardType="number-pad"
                                                    maxLength={6}
                                                />
                                            </View>

                                            <View style={s.inputGroup}>
                                                <Text style={s.inputLabel}>New Password</Text>
                                                <View style={s.inputWrapper}>
                                                    <Ionicons name="lock-closed-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                                                    <TextInput
                                                        style={s.input}
                                                        secureTextEntry={!showNewPass}
                                                        placeholder="Min 6 chars"
                                                        placeholderTextColor="rgba(255,255,255,0.4)"
                                                        value={newPassword}
                                                        onChangeText={setNewPassword}
                                                    />
                                                    <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)} style={s.eyeIcon}>
                                                        <Ionicons name={showNewPass ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.6)" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View style={s.inputGroup}>
                                                <Text style={s.inputLabel}>Confirm Password</Text>
                                                <View style={s.inputWrapper}>
                                                    <Ionicons name="lock-closed-outline" size={20} color={memorialColors.gold} style={s.inputIcon} />
                                                    <TextInput
                                                        style={s.input}
                                                        secureTextEntry={!showConfirmPass}
                                                        placeholder="Re-enter password"
                                                        placeholderTextColor="rgba(255,255,255,0.4)"
                                                        value={confirmPassword}
                                                        onChangeText={setConfirmPassword}
                                                    />
                                                    <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={s.eyeIcon}>
                                                        <Ionicons name={showConfirmPass ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.6)" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </>
                                    )}

                                    <TouchableOpacity
                                        style={s.primaryButton}
                                        onPress={step === "email" ? handleSendCode : handleResetPassword}
                                        disabled={loading}
                                    >
                                        {loading ? <ActivityIndicator color="#1a2e1a" /> : (
                                            <Text style={s.primaryButtonText}>
                                                {step === "email" ? "Send Code" : "Reset Password"}
                                            </Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => router.back()} style={s.secondaryLink}>
                                        <Text style={s.secondaryLinkText}>Cancel</Text>
                                    </TouchableOpacity>

                                </View>
                            </BlurView>
                        </Animated.View>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#011510' },
    watermarkContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center', opacity: 0.08, transform: [{ scale: 1.2 }]
    },
    watermark: { width: width * 0.8, height: width * 0.8, tintColor: memorialColors.gold },
    keyboardView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    innerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: height },

    header: { alignItems: 'center', marginBottom: 30, width: '100%' },
    backButton: { position: 'absolute', left: 0, top: 0, padding: 8 },
    logo: { width: 80, height: 80, marginBottom: 16 },
    title: { fontSize: 24, fontWeight: 'bold', color: memorialColors.gold, marginBottom: 8 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },

    cardWrapper: {
        width: '100%', maxWidth: 400, borderRadius: 24, overflow: 'hidden', borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.2)', marginBottom: 40, ...memorialShadows.md
    },
    blurContainer: { backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.6)' : undefined },
    cardContent: { padding: 32, backgroundColor: Platform.OS === 'android' ? 'rgba(0,30,20,0.9)' : 'rgba(0,0,0,0.2)' },

    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 12, color: memorialColors.gold, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    inputIcon: { paddingLeft: 16, paddingRight: 8 },
    input: { flex: 1, paddingVertical: 14, paddingRight: 16, color: '#fff', fontSize: 16 },
    otpInput: {
        textAlign: 'center', letterSpacing: 8, fontSize: 24, backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16
    },
    eyeIcon: { padding: 12 },

    primaryButton: {
        backgroundColor: memorialColors.gold, borderRadius: 12, paddingVertical: 16,
        alignItems: 'center', marginTop: 8, ...memorialShadows.sm
    },
    primaryButtonText: { color: '#1a2e1a', fontSize: 16, fontWeight: 'bold' },

    secondaryLink: { marginTop: 20, alignItems: 'center' },
    secondaryLinkText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 }
});
