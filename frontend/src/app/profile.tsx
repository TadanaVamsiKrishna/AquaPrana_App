import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/bottom-nav";
import { logout } from "../services/auth";
import { getFarmerProfile, type FarmerProfile } from "../services/local-profile";
import { getCurrentUserProfile } from "../services/profile";

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
  red: "#EF4444",
  success: "#16A34A",
};

type ProfileState = FarmerProfile & {
  phone?: string;
};

const menuItems = [
  { icon: "credit-card", label: "My Subscription" },
  { icon: "gift", label: "Refer & Earn" },
  { icon: "edit-3", label: "Edit Profile" },
  { icon: "info", label: "About Us" },
];

function MenuRow({
  icon,
  label,
  onPress,
  rightAccessory,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        danger && styles.menuRowDanger,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.menuLeft}>
        <View style={[styles.menuIconWrap, danger && styles.menuIconWrapDanger]}>
          <Feather
            name={icon}
            size={16}
            color={danger ? colors.red : colors.primary}
          />
        </View>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
          {label}
        </Text>
      </View>

      {rightAccessory ?? (
        <Feather
          name="chevron-right"
          size={16}
          color={danger ? "#F87171" : colors.muted}
        />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);

    const [localProfile, remoteResult] = await Promise.all([
      getFarmerProfile(),
      getCurrentUserProfile(),
    ]);

    setProfile({
      name: remoteResult.profile?.name || localProfile?.name || "Farmer",
      state: remoteResult.profile?.state || localProfile?.state || "",
      district: remoteResult.profile?.district || localProfile?.district || "",
      language: remoteResult.profile?.language || localProfile?.language || "English",
      phone: remoteResult.profile?.phone || "",
    });

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleLogout = async () => {
    await logout();
    router.replace("/" as never);
  };

  const handleComingSoon = (title: string) => {
    Alert.alert(title, "This option will be available soon.");
  };

  const userName = profile?.name?.trim() || "Farmer";
  const initial = userName.charAt(0).toUpperCase() || "F";
  const phone = profile?.phone?.trim() || "+91 - 0000000000";
  const language = profile?.language?.trim() || "English";

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

          <Text style={styles.headerTitle}>Profile</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.profileCopy}>
                  <Text style={styles.profileName}>{userName}</Text>
                  <Text style={styles.profilePhone}>{phone}</Text>
                </View>

                <Feather name="cloud" size={18} color="#D1D5DB" />
              </View>

              <View style={styles.menuCard}>
                {menuItems.map((item) => (
                  <MenuRow
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    onPress={() => handleComingSoon(item.label)}
                  />
                ))}

                <MenuRow
                  icon="globe"
                  label="Language"
                  onPress={() => handleComingSoon("Language")}
                  rightAccessory={
                    <View style={styles.languageChip}>
                      <Text style={styles.languageChipText}>{language}</Text>
                      <Feather name="chevron-down" size={14} color={colors.muted} />
                    </View>
                  }
                />

                <MenuRow icon="log-out" label="Logout" onPress={handleLogout} />

                <MenuRow
                  icon="trash-2"
                  label="Delete account"
                  danger
                  onPress={() => handleComingSoon("Delete account")}
                />
              </View>

              <View style={styles.infoBlock}>
                <View style={styles.infoRow}>
                  <Feather name="shield" size={12} color={colors.muted} />
                  <Text style={styles.infoText}>
                    AquaExchange is collecting information such as mobile number,
                    email, and name to ensure optimal feed support and secure
                    account verification.
                  </Text>
                </View>

                <Text style={styles.versionText}>App version: 1.0.0</Text>
              </View>
            </>
          )}
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
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingState: {
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  profileCopy: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  profilePhone: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  menuCard: {
    marginTop: 12,
    gap: 10,
  },
  menuRow: {
    minHeight: 54,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  menuRowDanger: {
    backgroundColor: "#FFF8F8",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconWrapDanger: {
    backgroundColor: colors.softRed,
  },
  menuLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginLeft: 12,
  },
  menuLabelDanger: {
    color: colors.red,
  },
  languageChip: {
    minHeight: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  languageChipText: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  infoBlock: {
    marginTop: 18,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    color: "#64748B",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "500",
  },
  versionText: {
    marginTop: 14,
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
});
