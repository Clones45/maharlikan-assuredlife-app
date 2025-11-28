import { Tabs } from "expo-router";
import { colors } from "../../../lib/theme";
import { TabIcon } from "../../../components/TabIcon";

export default function PublicMemberLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // 🔹 Hides the top “lookup” header
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#dbeafe",
        tabBarStyle: { backgroundColor: colors.primary },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Find SOA",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="search" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="soa"
        options={{
          title: "SOA",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: "Promotions",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="pricetags" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
