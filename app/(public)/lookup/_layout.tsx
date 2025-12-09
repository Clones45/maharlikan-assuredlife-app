import { Tabs } from "expo-router";
import { TabIcon } from "../../../components/TabIcon";
import { memorialColors } from "../../../constants/memorialTheme";

export default function PublicMemberLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // 🔹 Hides the top “lookup” header
        tabBarActiveTintColor: memorialColors.softWhite,
        tabBarInactiveTintColor: memorialColors.accentLight,
        tabBarStyle: {
          backgroundColor: memorialColors.primary,
          borderTopColor: memorialColors.primaryLight,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Find SOA",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="search-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="soa"
        options={{
          title: "SOA",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="promotions"
        options={{
          title: "Promotions",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="pricetags-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
