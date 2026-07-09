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

export type BottomNavTab = "dashboard" | "expenses" | "inventory" | "aquagpt";

const tabs: {
  id: BottomNavTab;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route?: string;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid", route: "/home" },
  { id: "expenses", label: "Expenses", icon: "dollar-sign" },
  { id: "inventory", label: "Inventory", icon: "package", route: "/inventory" },
  { id: "aquagpt", label: "AquaGPT", icon: "cpu", route: "/aqua-gpt" },
];

type BottomNavProps = {
  activeTab: BottomNavTab;
};

export function BottomNav({ activeTab }: BottomNavProps) {
  const router = useRouter();

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Pressable
            key={tab.id}
            onPress={() => {
              if (!tab.route || tab.id === activeTab) {
                return;
              }

              router.replace(tab.route as never);
            }}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Feather
                name={tab.icon}
                size={20}
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
    minWidth: 68,
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
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: colors.primary,
  },
});
