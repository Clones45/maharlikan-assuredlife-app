import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

import { memorialSpacing } from "../constants/memorialTheme";

export default function BenefitsTab() {
  return (
    <ScrollView
      style={{ flex: 1, padding: 16, backgroundColor: "#F9FAFB" }}
      contentContainerStyle={{ paddingBottom: memorialSpacing.tabBarHeight }}
    >

      {/* RANK SYSTEM */}
      <Text style={styles.title}>📊 Rank System</Text>

      <View style={styles.box}>
        <Text style={styles.item}>1. Sales Executive (SE)</Text>
        <Text style={styles.subItem}>• Agent’s Application Form</Text>
        <Text style={styles.subItem}>• Account Activation (AA)</Text>
        <Text style={styles.subItem}>• Benefits:</Text>
        <Text style={styles.sub}>   - Outright Commission</Text>
        <Text style={styles.sub}>   - Monthly Commission</Text>
        <Text style={styles.sub}>   - Recruiter’s Lifetime Commission (RLC)</Text>
        <Text style={styles.sub}>   - Incentives</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.item}>2. Assistant Supervisor (AS)</Text>
        <Text style={styles.subItem}>• Minimum of 20 Active SE</Text>
        <Text style={styles.subItem}>• Must comply with AGR</Text>
        <Text style={styles.subItem}>• Benefits:</Text>
        <Text style={styles.sub}>   - Monthly Commission</Text>
        <Text style={styles.sub}>   - Overriding Commission</Text>
        <Text style={styles.sub}>   - Incentives</Text>
        <Text style={styles.sub}>   - Recruiter’s Lifetime Commission (RLC)</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.item}>3. Marketing Supervisor (MS)</Text>
        <Text style={styles.subItem}>
          • Minimum of 10 Active Assistant Supervisors
        </Text>
        <Text style={styles.subItem}>• Must comply with AGR</Text>
        <Text style={styles.subItem}>• Benefits:</Text>
        <Text style={styles.sub}>   - Monthly Commission</Text>
        <Text style={styles.sub}>   - Overriding Commission</Text>
        <Text style={styles.sub}>   - Incentives</Text>
        <Text style={styles.sub}>   - Recruiter’s Lifetime Commission (RLC)</Text>
      </View>

      {/* COMMISSIONS */}
      <Text style={styles.title}>💰 Outright Commission (OC)</Text>

      <View style={styles.box}>
        <Text style={styles.sub}>• Package A1 – ₱150</Text>
        <Text style={styles.sub}>• Package A2 – ₱150</Text>
        <Text style={styles.sub}>• Package B1 – ₱130</Text>
        <Text style={styles.sub}>• Package B2 – ₱130</Text>
        <Text style={styles.sub}>• PAI – ₱25</Text>
        <Text style={styles.sub}>• Membership Card – ₱150</Text>
      </View>

      <Text style={styles.title}>📅 Monthly Commission (MC)</Text>

      <View style={styles.box}>
        <Text style={styles.sub}>• Package A1 – ₱120</Text>
        <Text style={styles.sub}>• Package A2 – ₱120</Text>
        <Text style={styles.sub}>• Package B1 – ₱100</Text>
        <Text style={styles.sub}>• Package B2 – ₱100</Text>
        <Text style={styles.sub}>
          • Collection Traveling Allowance (CTA) – ₱30
        </Text>
      </View>

      <Text style={styles.note}>Must have AGR Compliance</Text>

      {/* OVERRIDES */}
      <Text style={styles.title}>📈 Overriding Commission</Text>

      <View style={styles.box}>
        <Text style={styles.sub}>• Assistant Supervisor – ₱16 / month</Text>
        <Text style={styles.sub}>• Marketing Supervisor – ₱12 / month</Text>
        <Text style={styles.sub}>• Marketing Head – ₱8 / month</Text>
      </View>

      {/* RLC */}
      <Text style={styles.title}>🔁 Recruiter’s Lifetime Commission (RLC)</Text>
      <View style={styles.box}>
        <Text style={styles.sub}>
          Receive 10% monthly from the gross income of your recruits as long as you are ACTIVE.
        </Text>
      </View>

      {/* LOYALTY & ROYALTY */}
      <Text style={styles.title}>🏆 Loyalty & Royalty Bonus</Text>

      <View style={styles.box}>
        <Text style={styles.sub}>
          From all monthly amortizations, ₱4 goes to the Loyalty & Royalty Pool Fund.
        </Text>

        <Text style={styles.sub}>• Loyalty Bonus = 70% (Quarterly)</Text>
        <Text style={styles.sub}>• Royalty Bonus = 30% (Semi-Annual)</Text>

        <Text style={styles.note}>
          Must be MH with 3 active MS + compliant with AGR.
        </Text>
      </View>

      {/* LADDER OF SUCCESS */}
      <Text style={styles.title}>🪜 Ladder of Success</Text>

      <View style={styles.box}>
        <Text style={styles.sub}>
          • Promotion is based on total active recruits
        </Text>
        <Text style={styles.sub}>
          • Needs minimum 10 activated recruits for next rank
        </Text>
        <Text style={styles.sub}>
          • Monthly requirement: 2 new clients minimum
        </Text>
      </View>

      {/* AMBASSADOR RANKS */}
      <Text style={styles.title}>🌟 Ambassador Ranks & Rewards</Text>

      <View style={styles.box}>
        <Text style={styles.item}>Bronze Ambassador</Text>
        <Text style={styles.sub}>• 10 LBR</Text>
        <Text style={styles.sub}>• Reward: Samal Island Tour</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.item}>Silver Ambassador</Text>
        <Text style={styles.sub}>• 20 LBR</Text>
        <Text style={styles.sub}>• Reward: Boracay Island Trip</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.item}>Gold Ambassador</Text>
        <Text style={styles.sub}>• 40 LBR</Text>
        <Text style={styles.sub}>• Reward: El Nido + NMAX</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.item}>Platinum Ambassador</Text>
        <Text style={styles.sub}>• 100 LBR</Text>
        <Text style={styles.sub}>
          • Reward: Hong Kong Disneyland + Car Incentive
        </Text>
      </View>

      <View style={styles.finalBox}>
        <Text style={styles.final}>
          Once you reach the highest rank (RBR), you are no longer required to follow AGR to continue earning overrides and royalty bonuses.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 16,
    color: "#111827",
  },
  box: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#0b4aa2",
  },
  item: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  subItem: {
    fontSize: 13,
    marginBottom: 2,
  },
  sub: {
    fontSize: 13,
    marginBottom: 3,
    marginLeft: 4,
  },
  note: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: "italic",
    color: "#6B7280",
  },
  finalBox: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 12,
    marginBottom: 40,
    marginTop: 10,
  },
  final: {
    color: "#FFFFFF",
    fontSize: 13,
  },
});
