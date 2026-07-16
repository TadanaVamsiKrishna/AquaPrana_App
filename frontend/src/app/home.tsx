import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { BottomNav } from "../components/bottom-nav";
import { getFarmerProfile, getGreetingKey } from "../services/local-profile";
import {
  fetchMyPondsDashboard,
  getCycleStatusLabel,
  getHarvestRangeLabel,
  type MyPondDashboardItem,
  type PondCycleStatus,
} from "../services/pondsDashboardService";
import { getPondSetupTimestamp } from "../services/pond";
import { getSurvivalColorFromRate } from "../lib/cycle-metrics";

 

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0B1F3A",
  textSoft: "#334155",
  muted: "#94A3B8",
  border: "#E8EDF3",
  softBlue: "#E8F3FF",
  shadow: "#0A4F9E",
  statusGreen: "#22C55E",
  successSoft: "#DCFCE7",
  statusOrange: "#F59E0B",
  statusRed: "#EF4444",
  linkBlue: "#0056B3",
  metricIcon: "#9CA3AF",
  speciesBlue: "#D6EBFF",
  speciesText: "#0A6BD1",
  statusNeutral: "#94A3B8",
  statusNeutralSoft: "#F1F5F9",
};

type PondTab = "all" | "archived";

function getCycleStatusStyles(status: PondCycleStatus) {
  if (status === "active") {
    return {
      dot: colors.statusGreen,
      badge: colors.successSoft,
      text: colors.statusGreen,
    };
  }

  if (status === "closed") {
    return {
      dot: colors.statusRed,
      badge: "#FEE2E2",
      text: colors.statusRed,
    };
  }

  return {
    dot: colors.statusNeutral,
    badge: colors.statusNeutralSoft,
    text: colors.muted,
  };
}

function getWaterLogStatusColor(status: MyPondDashboardItem["waterLogStatus"]) {
  return status === "Logged Today" ? colors.statusGreen : colors.statusOrange;
}

function formatSpeciesLabel(species: string) {
  const upper = species.trim().toUpperCase();

  if (upper.includes("SHRIMP") || upper.includes("PRAWN")) {
    return upper;
  }

  if (upper === "VANNAMEI") {
    return "VANNAMEI SHRIMP";
  }

  return upper;
}

function formatBiomass(value: string) {
  const match = value.match(/^([\d,.\s]+)\s*(.*)$/);

  if (!match) {
    return value;
  }

  const numeric = Number(match[1].replace(/,/g, ""));

  if (!Number.isFinite(numeric)) {
    return value;
  }

  const unit = match[2]?.trim();
  const formatted = numeric.toLocaleString("en-US");
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatSurvivalValue(survivalRate: string) {
  const trimmed = survivalRate.trim();

  if (!trimmed || trimmed === "—") {
    return "—";
  }

  if (trimmed.endsWith("%")) {
    return trimmed;
  }

  return `${trimmed}%`;
}

function MetricCell({
  icon,
  materialIcon,
  label,
  value,
  valueColor,
}: {
  icon?: keyof typeof Feather.glyphMap;
  materialIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.metricCell}>
      {materialIcon ? (
        <MaterialCommunityIcons
          name={materialIcon}
          size={17}
          color={colors.metricIcon}
        />
      ) : (
        <Feather name={icon ?? "circle"} size={16} color={colors.metricIcon} />
      )}

      <View style={styles.metricCellCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text
          style={[styles.metricValue, valueColor ? { color: valueColor } : null]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function PondListCard({
  pond,
  onPress,
}: {
  pond: MyPondDashboardItem;
  onPress: () => void;
}) {
  const cycleStatusStyles = getCycleStatusStyles(pond.cycleStatus);
  const waterValueColor = getWaterLogStatusColor(pond.waterLogStatus);
  const speciesLabel = pond.species.trim() || "—";
  const survivalColor = getSurvivalColorFromRate(pond.survivalRateNumeric);
  const biomassColor = pond.abwStale ? colors.muted : colors.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pondCard, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.pondCardHeader}>
        <Text style={styles.pondName}>{pond.pondName}</Text>
        <View
          style={[
            styles.cycleStatusBadge,
            { backgroundColor: cycleStatusStyles.badge },
          ]}
        >
          <View
            style={[
              styles.cycleStatusDot,
              { backgroundColor: cycleStatusStyles.dot },
            ]}
          />
          <Text
            style={[styles.cycleStatusText, { color: cycleStatusStyles.text }]}
          >
            {getCycleStatusLabel(pond.cycleStatus)}
          </Text>
        </View>
      </View>

      <View style={styles.speciesBadge}>
        <Text style={styles.speciesBadgeText}>
          {formatSpeciesLabel(speciesLabel)}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCell
          icon="calendar"
          label={`DAY ${pond.cycleDay}`}
          value={getHarvestRangeLabel(pond)}
        />
        <MetricCell
          materialIcon="scale-balance"
          label="BIOMASS"
          value={formatBiomass(pond.biomass || "—")}
          valueColor={pond.biomass && pond.biomass !== "—" ? biomassColor : undefined}
        />
        <MetricCell
          icon="heart"
          label="SURVIVAL"
          value={formatSurvivalValue(pond.survivalRate || "—")}
          valueColor={
            pond.survivalRateNumeric != null ? survivalColor : undefined
          }
        />
        <MetricCell
          materialIcon="waves"
          label="WATER QLTY"
          value={pond.waterLogStatus}
          valueColor={waterValueColor}
        />
      </View>

      <View style={styles.pondFooter}>
        <View style={styles.lastLogRow}>
          <Feather name="rotate-ccw" size={13} color={colors.muted} />
          <Text style={styles.lastLogText}>
            Last Log: {pond.lastLogTime}
          </Text>
        </View>

        <View style={styles.detailsLink}>
          <Text style={styles.detailsLinkText}>Details</Text>
          <Feather name="chevron-right" size={14} color={colors.linkBlue} />
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [ponds, setPonds] = useState<MyPondDashboardItem[]>([]);
  const [farmerName, setFarmerName] = useState("Farmer");
  const [activeTab, setActiveTab] = useState<PondTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [dashboardPonds, profile] = await Promise.all([
        fetchMyPondsDashboard(),
        getFarmerProfile(),
      ]);

      setPonds(dashboardPonds);
      setFarmerName(profile?.name ?? "Farmer");
    } catch (err) {
      console.log("[home] load error:", err);
      setLoadError(
        err instanceof Error ? err.message : t("home.unableToLoad"),
      );
      setPonds([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const visiblePonds = useMemo(() => {
    return ponds
      .filter((pond) =>
        activeTab === "archived" ? pond.archived : !pond.archived,
      )
      .sort(
        (left, right) =>
          getPondSetupTimestamp({ created_at: right.createdAt }) -
          getPondSetupTimestamp({ created_at: left.createdAt }),
      );
  }, [ponds, activeTab]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.screen}>
        <View style={styles.heroHeader}>
          <View style={styles.brandRow}>
            <Pressable
              onPress={() => router.push("/profile" as never)}
              style={({ pressed }) => [
                styles.profileEntry,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("profile.title")}
            >
              <View style={styles.brandLogo}>
                <Text style={styles.brandLogoText}>🦐</Text>
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>AQUAPRANA</Text>
                <Text style={styles.brandGreeting}>
                  {t(getGreetingKey())}, {farmerName}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push("/notifications" as never)}
              style={styles.notificationButton}
              accessibilityRole="button"
              accessibilityLabel={t("common.details")}
            >
              <Feather name="bell" size={20} color={colors.white} />
              <View style={styles.notificationDot} />
            </Pressable>
          </View>

          <View style={styles.weatherCard}>
            <Feather name="sun" size={18} color="#FBBF24" />
            <Text style={styles.weatherTemp}>28°C</Text>
            <Text style={styles.weatherLabel}>{t("home.weather.partlyCloudy")}</Text>
          </View>
        </View>

        <View style={styles.contentHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>{t("home.title")}</Text>
            <Text style={styles.pageSubtitle}>
              {t("home.subtitle")}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/pond-setup" as never)}
            style={({ pressed }) => [
              styles.addPondButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.addPondButtonText}>{t("home.addPond")}</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("all")}
            style={styles.tabButton}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "all" && styles.tabLabelActive,
              ]}
            >
              {t("home.allPonds")}
            </Text>
            {activeTab === "all" ? <View style={styles.tabIndicator} /> : null}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("archived")}
            style={styles.tabButton}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === "archived" && styles.tabLabelActive,
              ]}
            >
              {t("home.archived")}
            </Text>
            {activeTab === "archived" ? (
              <View style={styles.tabIndicator} />
            ) : null}
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <Pressable style={styles.filterDropdown} accessibilityRole="button">
            <Text style={styles.filterDropdownText}>{t("home.recentActivity")}</Text>
            <Feather name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
          <Pressable style={styles.filterIconButton} accessibilityRole="button">
            <Feather name="sliders" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="alert-circle" size={28} color={colors.statusRed} />
              </View>
              <Text style={styles.emptyTitle}>{t("home.unableToLoad")}</Text>
              <Text style={styles.emptySubtitle}>{loadError}</Text>
            </View>
          ) : visiblePonds.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="droplet" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === "archived"
                  ? t("home.noArchived")
                  : t("home.noPonds")}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === "archived"
                  ? t("home.archivedHint")
                  : t("home.noPondsHint")}
              </Text>
            </View>
          ) : (
            visiblePonds.map((pond) => (
              <PondListCard
                key={pond.id}
                pond={pond}
                onPress={() =>
                  router.push({
                    pathname: "/daily-log",
                    params: { pondId: pond.id },
                  } as never)
                }
              />
            ))
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
  },
  heroHeader: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: colors.primaryDark,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileEntry: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  brandLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandLogoText: {
    fontSize: 22,
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  brandGreeting: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  weatherCard: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weatherTemp: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  weatherLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  contentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 4,
  },
  addPondButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addPondButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 18,
    marginTop: 16,
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    paddingBottom: 10,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  tabIndicator: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  filterDropdown: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterDropdownText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 14,
  },
  loadingState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontWeight: "500",
  },
  pondCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  pondCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pondName: {
    color: "#111827",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  cycleStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cycleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cycleStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  speciesBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.speciesBlue,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  speciesBadgeText: {
    color: colors.speciesText,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 18,
    marginBottom: 16,
  },
  metricCell: {
    width: "50%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingRight: 8,
  },
  metricCellCopy: {
    flex: 1,
    gap: 2,
  },
  metricLabel: {
    color: colors.metricIcon,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  metricValue: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  pondFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  lastLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  lastLogText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  detailsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailsLinkText: {
    color: colors.linkBlue,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.9,
  },
});
