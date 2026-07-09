import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";

const colors = {
  primary: "#0A84FF",
  muted: "#6B7280",
  white: "#FFFFFF",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
};

export type PondNavTab = "dashboard" | "logs" | "trends" | "cycles";

const tabs: {
  id: PondNavTab;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid", route: "/daily-log" },
  { id: "logs", label: "Logs", icon: "file-text", route: "/pond-logs" },
  { id: "trends", label: "Trends", icon: "trending-up", route: "/pond-trends" },
  { id: "cycles", label: "Cycles", icon: "refresh-cw", route: "/pond-cycles" },
];

type PondBottomNavProps = {
  pondId: string;
  activeTab: PondNavTab;
};

export function PondBottomNav({ pondId, activeTab }: PondBottomNavProps) {
  const router = useRouter();

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              if (tab.id === activeTab || !pondId) {
                return;
              }

              router.replace({
                pathname: tab.route,
                params: { pondId },
              } as never);
            }}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Feather
                name={tab.icon}
                size={18}
                color={isActive ? colors.primary : colors.muted}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabItem: {
    alignItems: "center",
    gap: 2,
    minWidth: 64,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: colors.softBlue,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: colors.primary,
  },
});
