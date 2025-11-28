import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Ionicons } from "@expo/vector-icons";

type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  target_role: string | null;
  user_id: string | null;
  created_at: string;
};

export default function NotificationDropdown({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ✅ ONLY FETCH NOTIFICATIONS FOR THIS USER ONLY
  const fetchNotifications = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId) // ✅ FIXED: only this user
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setNotifications(data);
    if (error) console.error(error);

    setLoading(false);
  };

  const markAsRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);

    if (unreadIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unreadIds);

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchNotifications();
    };

    load();

    // ✅ REALTIME: only push notif if it belongs to THIS user
    const sub = supabase
      .channel("notif-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notification;

          // ✅ Only this user's notification is allowed here
          if (n.user_id === userId) {
            setNotifications((prev) => [n, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(sub);
    };
  }, []);

  const toggleDropdown = () => {
    setVisible(!visible);
    if (!visible) markAsRead();
  };

  const formatTime = (t: string) => {
    const d = new Date(t);
    return d.toLocaleString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View>
      <TouchableOpacity onPress={toggleDropdown}>
        <Ionicons name="notifications-outline" size={26} color="#fff" />
        {notifications.some((n) => !n.is_read) && <View style={styles.badge} />}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleDropdown}
        >
          <View style={styles.dropdown}>
            <Text style={styles.header}>Notifications</Text>

            {loading ? (
              <ActivityIndicator
                color="#0b4aa2"
                style={{ marginVertical: 20 }}
              />
            ) : notifications.length === 0 ? (
              <Text style={styles.empty}>No notifications yet</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.item}>
                    <Ionicons
                      name={
                        item.type?.includes("payout")
                          ? "cash-outline"
                          : "notifications"
                      }
                      size={20}
                      color={
                        item.type === "payout_released"
                          ? "#16a34a"
                          : item.type === "payout_request"
                          ? "#fbbf24"
                          : "#0b4aa2"
                      }
                      style={{ marginRight: 8, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.message}>{item.message}</Text>
                      <Text style={styles.time}>
                        {formatTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  dropdown: {
    backgroundColor: "#fff",
    width: 300,
    maxHeight: 420,
    marginTop: 60,
    marginRight: 10,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
  },
  header: {
    fontWeight: "700",
    color: "#0b4aa2",
    fontSize: 16,
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  title: { fontWeight: "600", color: "#111" },
  message: { fontSize: 12, color: "#444" },
  time: { fontSize: 11, color: "#777", marginTop: 2 },
  empty: {
    textAlign: "center",
    color: "#999",
    fontSize: 13,
    marginVertical: 30,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
});
