// Member Type Selection Screen Component
// Allows agent to choose between New Member or Adapt Member

import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialShadows } from "../../constants/memorialTheme";

type MemberTypeSelectionProps = {
    onSelectType: (type: "new" | "adapt") => void;
};

export default function MemberTypeSelection({ onSelectType }: MemberTypeSelectionProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.header}>Add Member</Text>
            <Text style={styles.subheader}>Choose member type:</Text>

            <TouchableOpacity
                style={styles.optionCard}
                onPress={() => onSelectType("new")}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="person-add" size={48} color={memorialColors.primary} />
                </View>
                <Text style={styles.optionTitle}>New Member</Text>
                <Text style={styles.optionDesc}>
                    Standard registration process{"\n"}
                    • Requires access code{"\n"}
                    • Full payment schedule{"\n"}
                    • Normal commissions
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.optionCard}
                onPress={() => onSelectType("adapt")}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="repeat" size={48} color={memorialColors.accent} />
                </View>
                <Text style={styles.optionTitle}>Adapt a Member</Text>
                <Text style={styles.optionDesc}>
                    Prepaid months registration{"\n"}
                    • No access code needed{"\n"}
                    • Enter adapted months{"\n"}
                    • Zero commission on prepaid amount
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: memorialSpacing.large,
        backgroundColor: memorialColors.background,
    },
    header: {
        fontSize: 28,
        fontWeight: "bold",
        color: memorialColors.text,
        marginBottom: memorialSpacing.small,
        textAlign: "center",
    },
    subheader: {
        fontSize: 16,
        color: memorialColors.textSecondary,
        marginBottom: memorialSpacing.large,
        textAlign: "center",
    },
    optionCard: {
        backgroundColor: "#fff",
        borderRadius: memorialBorderRadius.medium,
        padding: memorialSpacing.large,
        marginBottom: memorialSpacing.medium,
        ...memorialShadows.medium,
        alignItems: "center",
    },
    iconContainer: {
        marginBottom: memorialSpacing.medium,
    },
    optionTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: memorialColors.text,
        marginBottom: memorialSpacing.small,
    },
    optionDesc: {
        fontSize: 14,
        color: memorialColors.textSecondary,
        textAlign: "center",
        lineHeight: 22,
    },
});
