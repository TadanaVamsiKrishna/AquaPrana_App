import { Pressable, StyleSheet } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

const colors = {
  primary: "#0A84FF",
  shadow: "#0A4F9E",
  white: "#FFFFFF",
};

const HIDDEN_PATHS = new Set([
  "/",
  "/index",
  "/home",
  "/inventory",
  "/add-inventory",
  "/edit-inventory",
  "/aqua-gpt",
  "/profile",
  "/notifications",
  "/phone-login",
  "/verify-otp",
  "/start-journey",
  "/farmer-profile",
  "/pond-setup",
  "/join-existing-cycle",
  "/manual-cycle-summary",
  "/explore",
]);

export function AquaGptFab() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!pathname || HIDDEN_PATHS.has(pathname)) {
    return null;
  }

  const isDailyLogScreen =
    pathname.includes("daily-log") && !pathname.includes("daily-log-entry");

  const bottom = 78 + Math.max(insets.bottom - 8, 0);

  return (
    <Pressable
      onPress={() => router.push("/aqua-gpt" as never)}
      style={[
        styles.fab,
        { bottom },
        isDailyLogScreen ? styles.fabLeft : styles.fabRight,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("aquagpt.open")}
    >
      <Feather name="cpu" size={20} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 40,
  },
  fabRight: { right: 16 },
  fabLeft: { left: 16 },
});
