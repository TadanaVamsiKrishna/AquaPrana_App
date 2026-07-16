import { Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

const colors = {
  primary: "#0A84FF",
  muted: "#6B7280",
  white: "#FFFFFF",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
};

export type PondNavTab = "dashboard" | "logs" | "trends" | "cycles";

const tabs = [
  { id: "dashboard", labelKey: "bottomNav.dashboard", icon: "grid", route: "/daily-log" },
  { id: "logs", labelKey: "bottomNav.logs", icon: "file-text", route: "/pond-logs" },
  { id: "trends", labelKey: "bottomNav.trends", icon: "trending-up", route: "/pond-trends" },
  { id: "cycles", labelKey: "bottomNav.cycles", icon: "refresh-cw", route: "/pond-cycles" },
] as const;

type PondBottomNavProps = {
  pondId: string;
  activeTab: PondNavTab;
};

export function PondBottomNav({ pondId, activeTab }: PondBottomNavProps) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const label = t(tab.labelKey);

        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              if (tab.id === activeTab || !pondId) {
                return;
              }

              router.replace({ pathname: tab.route, params: { pondId } } as never);
            }}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Feather
                name={tab.icon}
                size={18}
                color={isActive ? colors.primary : colors.muted}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {label}
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
  iconWrapActive: { backgroundColor: colors.softBlue },
  tabLabel: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  tabLabelActive: { color: colors.primary },
});
