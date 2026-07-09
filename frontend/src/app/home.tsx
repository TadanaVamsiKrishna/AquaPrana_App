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
import { BottomNav } from "../components/bottom-nav";
import { getSpeciesDuration } from "../lib/harvest-window";
import {
  type OverallWaterQuality,
} from "../lib/water-quality";
import { getFarmerProfile, getGreeting } from "../services/local-profile";
import { getPonds, type StoredPond } from "../services/local-ponds";

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
  statusOrange: "#F59E0B",
  statusRed: "#EF4444",
  linkBlue: "#0056B3",
  metricIcon: "#9CA3AF",
  speciesBlue: "#D6EBFF",
  speciesText: "#0A6BD1",
};

type PondTab = "all" | "archived";

function getHarvestRangeLabel(pond: StoredPond) {
  const cycleDay = Number(pond.cycleDay);
  const duration = getSpeciesDuration(pond.species);

  if (!duration || !Number.isFinite(cycleDay)) {
    return "Harvest window pending";
  }

  if (cycleDay >= duration.minDays && cycleDay <= duration.maxDays) {
    return "Window open";
  }

  const minRemaining = Math.max(duration.minDays - cycleDay, 0);
  const maxRemaining = Math.max(duration.maxDays - cycleDay, 0);

  if (minRemaining === 0 && maxRemaining === 0) {
    return "Window open";
  }

  return `Ready in ${minRemaining}-${maxRemaining} days`;
}

function formatLastLogText(lastLogTime: string) {
  if (!lastLogTime || lastLogTime === "—") {
    return "No log today";
  }

  return lastLogTime;
}

function getWaterQualityLabel(status: string): OverallWaterQuality {
  if (status === "Good" || status === "Excellent") {
    return "Good";
  }

  if (status === "Fair" || status === "Attention") {
    return "Attention";
  }

  if (status === "Poor" || status === "Critical") {
    return "Critical";
  }

  return "Not logged";
}

function getWaterQualityDisplayText(quality: OverallWaterQuality) {
  if (quality === "Good") {
    return "Excellent";
  }

  if (quality === "Not logged") {
    return "Not logged";
  }

  return quality;
}

function getStatusDotColor(quality: OverallWaterQuality) {
  if (quality === "Good") {
    return colors.statusGreen;
  }

  if (quality === "Attention") {
    return colors.statusOrange;
  }

  if (quality === "Critical") {
    return colors.statusRed;
  }

  return colors.muted;
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
  pond: StoredPond;
  onPress: () => void;
}) {
  const waterQuality = getWaterQualityLabel(pond.waterQualityStatus);
  const statusDotColor = getStatusDotColor(waterQuality);
  const waterLabel = getWaterQualityDisplayText(waterQuality);
  const waterValueColor =
    waterQuality === "Good"
      ? colors.text
      : getStatusDotColor(waterQuality);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pondCard, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.pondCardHeader}>
        <Text style={styles.pondName}>{pond.pondName}</Text>
        <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
      </View>

      <View style={styles.speciesBadge}>
        <Text style={styles.speciesBadgeText}>
          {formatSpeciesLabel(pond.species)}
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
          value={formatBiomass(pond.biomass)}
        />
        <MetricCell
          icon="heart"
          label="SURVIVAL"
          value={formatSurvivalValue(pond.survivalRate)}
        />
        <MetricCell
          materialIcon="waves"
          label="WATER QLTY"
          value={waterLabel}
          valueColor={waterValueColor}
        />
      </View>

      <View style={styles.pondFooter}>
        <View style={styles.lastLogRow}>
          <Feather name="rotate-ccw" size={13} color={colors.muted} />
          <Text style={styles.lastLogText}>
            Last Log: {formatLastLogText(pond.lastLogTime)}
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
  const [ponds, setPonds] = useState<StoredPond[]>([]);
  const [farmerName, setFarmerName] = useState("Farmer");
  const [activeTab, setActiveTab] = useState<PondTab>("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [savedPonds, profile] = await Promise.all([
      getPonds(),
      getFarmerProfile(),
    ]);
    setPonds(savedPonds);
    setFarmerName(profile?.name ?? "Farmer");
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const visiblePonds = useMemo(() => {
    return ponds.filter((pond) =>
      activeTab === "archived" ? pond.archived : !pond.archived,
    );
  }, [ponds, activeTab]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.screen}>
        <View style={styles.heroHeader}>
          <View style={styles.brandRow}>
            <View style={styles.brandLogo}>
              <Text style={styles.brandLogoText}>🦐</Text>
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>AQUAPRANA</Text>
              <Text style={styles.brandGreeting}>
                {getGreeting()}, {farmerName}
              </Text>
            </View>
            <Pressable style={styles.notificationButton} accessibilityRole="button">
              <Feather name="bell" size={20} color={colors.white} />
              <View style={styles.notificationDot} />
            </Pressable>
          </View>

          <View style={styles.weatherCard}>
            <Feather name="sun" size={18} color="#FBBF24" />
            <Text style={styles.weatherTemp}>28°C</Text>
            <Text style={styles.weatherLabel}>PARTLY CLOUDY</Text>
          </View>
        </View>

        <View style={styles.contentHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.pageTitle}>My Ponds</Text>
            <Text style={styles.pageSubtitle}>
              Overview of all your ponds at a glance
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
            <Text style={styles.addPondButtonText}>+ Add Pond</Text>
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
              All Ponds
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
              Archived
            </Text>
            {activeTab === "archived" ? (
              <View style={styles.tabIndicator} />
            ) : null}
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <Pressable style={styles.filterDropdown} accessibilityRole="button">
            <Text style={styles.filterDropdownText}>Recent Activity</Text>
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
          ) : visiblePonds.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="droplet" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === "archived"
                  ? "No archived ponds"
                  : "No ponds yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === "archived"
                  ? "Archived ponds will appear here."
                  : "Add your first pond to start tracking cycles and logs."}
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
