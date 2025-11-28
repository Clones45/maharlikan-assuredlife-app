import { Stack } from "expo-router";
import { View, Text, Image, StyleSheet } from "react-native";

export default function PublicLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* 🔹 Top Banner */}
      <View style={styles.banner}>
        <Image
          source={require("../../assets/logo.png")} // 🖼️ adjust to your actual logo path
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Maharlikan AssuredLife</Text>
      </View>

      {/* 🔹 Main Navigation Stack */}
      <Stack
        screenOptions={{
          headerShown: false, // hide default headers for cleaner design
          contentStyle: { backgroundColor: "#eef3fb" },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b4aa2",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
