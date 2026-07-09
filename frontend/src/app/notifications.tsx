import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/bottom-nav";

const colors = {
  primary: "#0A84FF",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0B1F3A",
  muted: "#94A3B8",
  border: "#E8EDF3",
  shadow: "#0A4F9E",
  softBlue: "#E8F3FF",
  softRed: "#FFF1F2",
  blueText: "#0284C7",
  orangeText: "#D97706",
  redText: "#DC2626",
  greenText: "#15803D",
};

type FilterTab = "all" | "pond1" | "pond3" | "critical";

type NotificationItem = {
  id: string;
  type: "critical" | "warning" | "system";
  title: string;
  pond: string;
  age: string;
  message: string;
  filter: Exclude<FilterTab, "all">;
};

const filterTabs: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pond1", label: "Pond 1" },
  { id: "pond3", label: "Pond 3" },
  { id: "critical", label: "Critical" },
];

const notifications: NotificationItem[] = [
  {
    id: "1",
    type: "critical",
    title: "Critical: Low DO Levels!",
    pond: "Pond 1 - East",
    age: "10m ago",
    message:
      "DO levels dropped to 3.2 mg/L. Aerators required immediately to prevent livestock stress.",
    filter: "critical",
  },
  {
    id: "2",
    type: "warning",
    title: "Warning: Missed Feed",
    pond: "Pond 3 - South",
    age: "2h ago",
    message:
      "The scheduled 08:00 AM automated feeding cycle was not initiated. Check hopper levels.",
    filter: "pond3",
  },
  {
    id: "3",
    type: "system",
    title: "System: IoT Connected",
    pond: "All Ponds",
    age: "5h ago",
    message:
      "Connectivity restored for Pond 1 and Pond 2 telemetry sensors. All systems nominal.",
    filter: "pond1",
  },
  {
    id: "4",
    type: "warning",
    title: "Warning: pH Drift",
    pond: "Pond 1 - East",
    age: "1d ago",
    message:
      "pH levels reached upper threshold of 8.5. Monitor water exchange rates.",
    filter: "pond1",
  },
];

function getNotificationColors(type: NotificationItem["type"]) {
  if (type === "critical") {
    return {
      iconBg: "#FEE2E2",
      iconColor: colors.redText,
      pinColor: "#2563EB",
      titleColor: colors.redText,
    };
  }

  if (type === "warning") {
    return {
      iconBg: "#E0F2FE",
      iconColor: colors.blueText,
      pinColor: "#2563EB",
      titleColor: colors.orangeText,
    };
  }

  return {
    iconBg: "#DCFCE7",
    iconColor: colors.greenText,
    pinColor: "#94A3B8",
    titleColor: colors.text,
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesTab = activeTab === "all" || item.filter === activeTab;
      const haystack = `${item.title} ${item.pond} ${item.message}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesTab && matchesQuery;
    });
  }, [activeTab, query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={18} color={colors.primary} />
          </Pressable>

          <Text style={styles.headerTitle}>Notifications</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchWrap}>
          <Feather name="search" size={14} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search alerts..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {filterTabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const isCritical = tab.id === "critical";

            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.filterChip,
                  isActive && (isCritical ? styles.filterChipCritical : styles.filterChipActive),
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive &&
                      (isCritical
                        ? styles.filterChipTextCritical
                        : styles.filterChipTextActive),
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredNotifications.map((item) => {
            const ui = getNotificationColors(item.type);

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={[styles.iconCircle, { backgroundColor: ui.iconBg }]}>
                    <Feather
                      name={item.type === "system" ? "check" : "alert-triangle"}
                      size={15}
                      color={ui.iconColor}
                    />
                  </View>

                  <View style={styles.cardCopy}>
                    <View style={styles.cardTitleRow}>
                      <View style={styles.cardTitleBlock}>
                        <Text style={[styles.cardTitle, { color: ui.titleColor }]}>
                          {item.title}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {item.pond}
                        </Text>
                      </View>

                      <View style={styles.cardAside}>
                        <Text style={styles.ageText}>{item.age}</Text>
                        <Feather name="map-pin" size={12} color={ui.pinColor} />
                      </View>
                    </View>

                    <Text style={styles.cardMessage}>{item.message}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="bell-off" size={24} color={colors.muted} />
              <Text style={styles.emptyTitle}>No notifications found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different filter or search term.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <BottomNav activeTab="dashboard" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 34,
  },
  headerTitle: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  searchWrap: {
    height: 42,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  filterChip: {
    minHeight: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipCritical: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  filterChipText: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: colors.white,
  },
  filterChipTextCritical: {
    color: colors.redText,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardCopy: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardTitleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  cardMeta: {
    color: "#64748B",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  cardAside: {
    alignItems: "flex-end",
    gap: 4,
  },
  ageText: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  cardMessage: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 8,
  },
  emptyState: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
