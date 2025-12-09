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
  extra?: any;
  created_at: string;
};

export default function NotificationDropdown({
  userId,
  agentId,
  role, // NEW: pass "agent" or "admin"
}: {
  userId: string;
  agentId?: number | null;
  role: "agent" | "admin";
}) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ============================================================
  // FETCH NOTIFICATIONS (FULLY FIXED)
  // ============================================================
  const fetchNotifications = async () => {
    setLoading(true);

    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // FIXED: Correct filtering for roles
    if (role === "agent") {
      query = query.eq("user_id", userId);
    } else if (role === "admin") {
      query = query.eq("target_role", "admin");
    }

    const { data, error } = await query;

    if (error) console.error("Notif Fetch Error:", error);
    if (data) setNotifications(data);

    setLoading(false);
  };

  // ============================================================
  // MARK AS READ
  // ============================================================
  const markAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);

    if (unreadIds.length === 0) return;

    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    );

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
  };

  useEffect(() => {
    fetchNotifications();

    // REAL-TIME SYNC
    const channel = supabase
      .channel("notif-dropdown-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        payload => {
          const n = payload.new as Notification;

          // FIXED: Relevance check by user role
          let isRelevant = false;

          if (role === "agent" && n.user_id === userId) {
            isRelevant = true;
          }

          if (role === "admin" && n.target_role === "admin") {
            isRelevant = true;
          }

          if (!isRelevant) return;

          if (payload.eventType === "INSERT") {
            setNotifications(prev => [n, ...prev]);
          }

          if (payload.eventType === "UPDATE") {
            setNotifications(prev =>
              prev.map(item => (item.id === n.id ? n : item))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role]);

  const toggleDropdown = () => {
    setVisible(!visible);
    if (!visible) markAsRead();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const formatTime = (t: string) => {
    const d = new Date(t);
    return d.toLocaleString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  };

  const getNotificationIcon = (type: string) => {
    if (type === "withdrawal_status") return "cash-outline";
    if (type === "payout_request") return "cash-outline";
    return "notifications";
  };

  const getNotificationColor = (type: string) => {
    if (type === "withdrawal_status") return "#16a34a";
    if (type === "payout_request") return "#fbbf24";
    return "#0b4aa2";
  };

  return (
    <View>
      <TouchableOpacity onPress={toggleDropdown}>
        <Ionicons name="notifications-outline" size={26} color="#fff" />
        {unreadCount > 0 && <View style={styles.badge} />}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          {/* Backdrop - Closes Modal */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={toggleDropdown}
          />

          <View style={styles.dropdown}>
            <Text style={styles.header}>Notifications</Text>

            {loading && notifications.length === 0 ? (
              <ActivityIndicator color="#0b4aa2" style={{ marginVertical: 20 }} />
            ) : notifications.length === 0 ? (
              <Text style={styles.empty}>No notifications yet</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={item => item.id.toString()}
                style={{ flexShrink: 1 }}
                renderItem={({ item }) => (
                  <View style={styles.item}>
                    <Ionicons
                      name={getNotificationIcon(item.type) as any}
                      size={20}
                      color={getNotificationColor(item.type)}
                      style={{ marginRight: 8, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{item.title}</Text>
                      <Text style={styles.message}>{item.message}</Text>
                      <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
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
