import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { memorialColors, memorialBorderRadius, memorialShadows, memorialFonts } from '../constants/memorialTheme';

interface VerificationEntryModalProps {
    visible: boolean;
    onVerified: () => void;
    agentId: number;  // Added agent_id prop
}

export default function VerificationEntryModal({ visible, onVerified, agentId }: VerificationEntryModalProps) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (!code.trim()) {
            Alert.alert("Error", "Please enter the code.");
            return;
        }
        setLoading(true);
        // Trim and uppercase just in case, though numeric usually
        const cleanCode = code.trim(); // .toUpperCase() if alphanumeric

        try {
            const { data, error } = await supabase.rpc('verify_agent_access_code', {
                p_agent_id: agentId,
                p_code: cleanCode
            });

            if (error) throw error;

            if (data === true) {
                Alert.alert('Success', 'Account Verified! You now have full access.');
                onVerified();
            } else {
                Alert.alert('Error', 'Invalid Authorization Code. Please try again.');
            }
        } catch (err: any) {
            console.error("Verification error:", err);
            Alert.alert('Error', 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>Verification Required</Text>
                    <Text style={styles.desc}>
                        You have successfully recruited your first 3 members!
                        {"\n\n"}
                        Compliance with the <Text style={{ fontWeight: 'bold' }}>3-Member Rule</Text> is now met.
                        {"\n\n"}
                        A verification code has been generated. Please enter it below to unlock full access.
                    </Text>

                    <TextInput
                        value={code} onChangeText={setCode}
                        placeholder="Enter Verification Code"
                        style={styles.input}
                        // keyboardType="numeric" // Use default to allow flexibility if code changes
                        autoCapitalize="none"
                    />

                    <TouchableOpacity onPress={handleVerify} style={styles.btn} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify And Unlock</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: memorialColors.white,
        borderRadius: memorialBorderRadius.xl,
        padding: 25,
        ...memorialShadows.lg,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: memorialFonts.bold,
        color: memorialColors.primary,
        marginBottom: 15,
        textAlign: 'center',
    },
    desc: {
        fontSize: 16,
        color: memorialColors.textSecondary,
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 22,
    },
    input: {
        width: '100%',
        backgroundColor: memorialColors.pearl,
        borderWidth: 1,
        borderColor: memorialColors.silver,
        borderRadius: memorialBorderRadius.md,
        padding: 15,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: 'bold',
    },
    btn: {
        backgroundColor: memorialColors.primary,
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: memorialBorderRadius.lg,
        width: '100%',
        alignItems: 'center',
        ...memorialShadows.md,
    },
    btnText: {
        color: memorialColors.white,
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
