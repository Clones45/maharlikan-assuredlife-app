import { Stack } from "expo-router";
import { View, Text, Image, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { memorialColors, memorialSpacing, memorialFonts, memorialShadows } from "../../constants/memorialTheme";

export default function PublicLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* 💎 LUXURIOUS: Premium Top Banner */}
      <View style={styles.banner}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Maharlikan AssuredLife</Text>
      </View>

      {/* 🔹 Main Navigation Stack */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: memorialColors.primary }, // Luxurious Green
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // 💎 LUXURIOUS: Premium Gradient Banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: memorialColors.white, // White banner
    paddingTop: Constants.statusBarHeight + memorialSpacing.sm, // Add status bar padding
    paddingBottom: memorialSpacing.md,
    paddingHorizontal: memorialSpacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: memorialColors.gold, // Gold accent line
    ...memorialShadows.md,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: memorialSpacing.sm,
  },
  title: {
    color: memorialColors.primary, // Green text
    fontSize: memorialFonts.lg,
    fontWeight: memorialFonts.bold,
    letterSpacing: memorialFonts.letterSpacing.wide,
  },
});
