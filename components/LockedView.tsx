import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { memorialColors, memorialFonts, memorialSpacing } from '../constants/memorialTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LockedView() {
    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="lock-outline" size={80} color={memorialColors.textMuted} />
            <Text style={styles.title}>LOCKED</Text>
            <Text style={styles.message}>
                You need 3 membership (including yourself) to unlocked your whole dashboard
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: memorialColors.bgPrimary,
        padding: memorialSpacing.xl,
    },
    title: {
        fontSize: 24,
        fontWeight: memorialFonts.bold,
        color: memorialColors.textSecondary,
        marginTop: memorialSpacing.md,
        letterSpacing: 2,
    },
    message: {
        fontSize: 16,
        color: memorialColors.textMuted,
        textAlign: 'center',
        marginTop: memorialSpacing.sm,
        lineHeight: 24,
        maxWidth: '80%',
    },
});
