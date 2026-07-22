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
import { useTranslation } from "react-i18next";
import { getCurrentUserProfile } from "../services/profile";
import {
  REFERRAL_REWARD_AMOUNT,
  buildReferralLink,
  copyText,
  ensureReferralCode,
  fetchReferralStats,
  fetchRewardCoupons,
  formatExpiryDate,
  shareReferralInvite,
  type ReferralCoupon,
  type ReferralStats,
} from "../services/referrals";

const colors = {
  primary: "#0A84FF",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0B1F3A",
  muted: "#94A3B8",
  border: "#E8EDF3",
  shadow: "#0A4F9E",
  softBlue: "#E8F3FF",
  softGreen: "#ECFDF5",
  green: "#059669",
  softAmber: "#FFFBEB",
  amber: "#D97706",
};

const emptyStats: ReferralStats = {
  totalReferrals: 0,
  successfulReferrals: 0,
  pendingReferrals: 0,
  totalRewardsEarned: 0,
};

export default function ReferEarnScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [stats, setStats] = useState<ReferralStats>(emptyStats);
  const [coupons, setCoupons] = useState<ReferralCoupon[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);

    const profileResult = await getCurrentUserProfile();
    const codeResult = await ensureReferralCode(profileResult.profile?.name);

    if (codeResult.error || !codeResult.code) {
      Alert.alert(
        t("common.error"),
        codeResult.error?.message || t("referEarn.loadFailed"),
      );
      setIsLoading(false);
      return;
    }

    setReferralCode(codeResult.code);

    const [statsResult, couponsResult] = await Promise.all([
      fetchReferralStats(),
      fetchRewardCoupons(),
    ]);

    if (statsResult.error) {
      console.log("[ReferEarn] stats:", statsResult.error.message);
    }
    if (couponsResult.error) {
      console.log("[ReferEarn] coupons:", couponsResult.error.message);
    }

    setStats(statsResult.stats);
    setCoupons(couponsResult.coupons);
    setIsLoading(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleCopyCode = async () => {
    const { error } = await copyText(referralCode);
    if (error) {
      Alert.alert(t("common.error"), error.message);
      return;
    }
    Alert.alert(t("common.success"), t("referEarn.codeCopied"));
  };

  const handleShare = async () => {
    const { error } = await shareReferralInvite(referralCode);
    if (error) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  const handleCopyCoupon = async (couponCode: string) => {
    const { error } = await copyText(couponCode);
    if (error) {
      Alert.alert(t("common.error"), error.message);
      return;
    }
    Alert.alert(t("common.success"), t("referEarn.couponCopied"));
  };

  const handleRedeemLater = () => {
    Alert.alert(t("referEarn.redeemLaterTitle"), t("referEarn.redeemLaterBody"));
  };

  const referralLink = referralCode ? buildReferralLink(referralCode) : "";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <Feather name="arrow-left" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("referEarn.title")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>{t("referEarn.subtitle")}</Text>

            <View style={styles.rewardBanner}>
              <View style={styles.rewardIconWrap}>
                <Feather name="gift" size={22} color={colors.primary} />
              </View>
              <Text style={styles.rewardTitle}>
                {t("referEarn.rewardTitle", { amount: REFERRAL_REWARD_AMOUNT })}
              </Text>
              <Text style={styles.rewardBody}>{t("referEarn.rewardBody")}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>{t("referEarn.yourCode")}</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{referralCode}</Text>
              </View>
              <Text style={styles.linkHint} numberOfLines={1}>
                {referralLink}
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleCopyCode()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="copy" size={16} color={colors.primary} />
                  <Text style={styles.secondaryButtonText}>
                    {t("referEarn.copy")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleShare()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Feather name="share-2" size={16} color={colors.white} />
                  <Text style={styles.primaryButtonText}>
                    {t("referEarn.share")}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>{t("referEarn.statsTitle")}</Text>
              <View style={styles.statsGrid}>
                <StatTile
                  label={t("referEarn.totalReferrals")}
                  value={String(stats.totalReferrals)}
                />
                <StatTile
                  label={t("referEarn.successful")}
                  value={String(stats.successfulReferrals)}
                />
                <StatTile
                  label={t("referEarn.pending")}
                  value={String(stats.pendingReferrals)}
                />
                <StatTile
                  label={t("referEarn.earned")}
                  value={`₹${stats.totalRewardsEarned}`}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>{t("referEarn.myRewards")}</Text>
              <Text style={styles.sectionHint}>
                {t("referEarn.availableCoupons")}
              </Text>

              {coupons.length === 0 ? (
                <Text style={styles.emptyText}>{t("referEarn.noCoupons")}</Text>
              ) : (
                coupons.map((coupon) => (
                  <View key={coupon.id} style={styles.couponCard}>
                    <View style={styles.couponTop}>
                      <Text style={styles.couponTitle}>{coupon.title}</Text>
                      <View
                        style={[
                          styles.statusChip,
                          coupon.redeemed
                            ? styles.statusRedeemed
                            : styles.statusUnused,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            coupon.redeemed
                              ? styles.statusRedeemedText
                              : styles.statusUnusedText,
                          ]}
                        >
                          {coupon.redeemed
                            ? t("referEarn.redeemed")
                            : t("referEarn.unused")}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.couponMeta}>
                      {t("referEarn.couponLabel")}: {coupon.couponCode}
                    </Text>
                    <Text style={styles.couponMeta}>
                      {t("referEarn.expiry")}:{" "}
                      {formatExpiryDate(coupon.expiryDate)}
                    </Text>
                    <View style={styles.couponActions}>
                      <Pressable
                        onPress={() => void handleCopyCoupon(coupon.couponCode)}
                        style={({ pressed }) => [
                          styles.couponButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Feather name="copy" size={14} color={colors.primary} />
                        <Text style={styles.couponButtonText}>
                          {t("referEarn.copyCoupon")}
                        </Text>
                      </Pressable>
                      {!coupon.redeemed ? (
                        <Pressable
                          onPress={handleRedeemLater}
                          style={({ pressed }) => [
                            styles.couponButtonMuted,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.couponButtonMutedText}>
                            {t("referEarn.redeemLater")}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>{t("referEarn.howItWorks")}</Text>
              {[1, 2, 3, 4, 5].map((step) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{step}</Text>
                  </View>
                  <Text style={styles.stepText}>
                    {t(`referEarn.steps.${step}`)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
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
  headerSpacer: { width: 34 },
  headerTitle: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    paddingHorizontal: 2,
  },
  rewardBanner: {
    backgroundColor: colors.softBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E8FF",
    padding: 16,
    gap: 8,
  },
  rewardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  rewardBody: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: -4,
  },
  codeBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  codeText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  linkHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statTile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    paddingVertical: 8,
  },
  couponCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
    padding: 12,
    gap: 6,
  },
  couponTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  couponTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusUnused: { backgroundColor: colors.softGreen },
  statusRedeemed: { backgroundColor: colors.softAmber },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  statusUnusedText: { color: colors.green },
  statusRedeemedText: { color: colors.amber },
  couponMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  couponActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  couponButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  couponButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  couponButtonMuted: {
    borderRadius: 10,
    backgroundColor: colors.softBlue,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  couponButtonMutedText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  stepText: {
    flex: 1,
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  pressed: { opacity: 0.84 },
});
