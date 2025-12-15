import React from "react";
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, Image, TouchableOpacity } from "react-native";
import { memorialColors, memorialFonts, memorialShadows, memorialSpacing } from "../constants/memorialTheme";
import NotificationDropdown from "./NotificationDropdown";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { s } from "../utils/responsive";

interface AgentHeaderProps {
    userId: string | null;
    agentId: number | null;
}

export default function AgentHeader({ userId, agentId }: AgentHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const canGoBack = router.canGoBack();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.titleContainer}>
                    {canGoBack && (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
                            <Ionicons name="arrow-back" size={24} color={memorialColors.white} />
                        </TouchableOpacity>
                    )}
                    <Image
                        source={require("../assets/logo.png")}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.companyName}>Maharlikan Mortuary Care Services</Text>
                </View>

                <View style={styles.rightContainer}>
                    {userId && (
                        <NotificationDropdown userId={userId} agentId={agentId} role="agent" />
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        backgroundColor: memorialColors.primary,
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
        zIndex: 100, // Ensure dropdown aligns correctly on top
    },
    container: {
        height: s(70), // Increased height for better logo visibility
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: s(memorialSpacing.lg),
        backgroundColor: memorialColors.primary,
        borderBottomWidth: 2,
        borderBottomColor: memorialColors.gold,
        ...memorialShadows.md,
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: s(50), // Visible size
        height: s(50),
        marginRight: s(memorialSpacing.sm),
    },
    companyName: {
        fontSize: s(memorialFonts.md), // Slightly adjusted for space
        fontWeight: memorialFonts.bold,
        color: memorialColors.white,
        letterSpacing: memorialFonts.letterSpacing.wide,
        textTransform: "uppercase",
        flexShrink: 1, // Allow text to wrap if needed
    },
    rightContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: s(memorialSpacing.sm),
    },
});
