import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PondBottomNav } from "../components/pond-bottom-nav";
import { getSpeciesDuration } from "../lib/harvest-window";
import { navigateToDailyLogEntry } from "../lib/daily-log-navigation";
import { getLatestLogForPond } from "../services/local-daily-logs";
import { getFarmerProfile } from "../services/local-profile";
import { getPondById, type StoredPond } from "../services/local-ponds";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  feedBlue: "#EAF4FF",
  success: "#22C55E",
};

function formatHarvestWindow(pond: StoredPond) {
  if (pond.harvestWindowStart && pond.harvestWindowEnd) {
    const start = pond.harvestWindowStart.replace(/\s+\d{4}$/, "");
    const end = pond.harvestWindowEnd.replace(/^\d+\s+\w+\s+/, "").replace(/\s+\d{4}$/, "");
    return `${start} - ${end}`;
  }

  return "Not set";
}

function getHarvestProgress(pond: StoredPond) {
  const cycleDay = Number(pond.cycleDay);
  const duration = getSpeciesDuration(pond.species);

  if (!duration || !Number.isFinite(cycleDay)) {
    return 0.35;
  }

  return Math.min(Math.max(cycleDay / duration.maxDays, 0.08), 1);
}

function getUserInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "F";
}

export default function DailyLogScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();

  const [pond, setPond] = useState<StoredPond | null>(null);
  const [farmerName, setFarmerName] = useState("Farmer");
  const [hasRecentLog, setHasRecentLog] = useState(false);

  const loadPond = useCallback(async () => {
    if (!pondId) {
      return;
    }

    const [pondData, profile, latestLog] = await Promise.all([
      getPondById(pondId),
      getFarmerProfile(),
      getLatestLogForPond(pondId),
    ]);

    setPond(pondData);
    setFarmerName(profile?.name ?? "Farmer");
    setHasRecentLog(!!latestLog || !!pondData?.latestReadings);
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadPond();
    }, [loadPond]),
  );

  const waterVitals = useMemo(() => {
    const readings = pond?.latestReadings;

    return [
      { label: "DO", value: readings?.dissolvedOxygen || "—" },
      { label: "pH", value: readings?.ph || "—" },
      { label: "Temp", value: readings?.temperature || "—" },
      { label: "Salinity", value: readings?.salinity || "—" },
    ];
  }, [pond]);

  const navigateWithPond = (pathname: string) => {
    router.push({
      pathname,
      params: { pondId },
    } as never);
  };

  const handleLogToday = async () => {
    if (!pondId) {
      return;
    }

    await navigateToDailyLogEntry(router, pondId);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconButton}
            accessibilityRole="button"
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.profileChip}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {getUserInitial(farmerName)}
              </Text>
            </View>
            <Text style={styles.profileName}>Hi, {farmerName}</Text>
          </View>

          <Pressable style={styles.iconButton} accessibilityRole="button">
            <Feather name="bell" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pondHeroCard}>
            <View style={styles.pondHeroTop}>
              <View>
                <Text style={styles.pondHeroName}>
                  {pond?.pondName ?? "Pond"}
                </Text>
                <View style={styles.activeRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>ACTIVE</Text>
                </View>
              </View>
              <View style={styles.cycleDayBlock}>
                <Text style={styles.cycleDayLabel}>Cycle Day</Text>
                <Text style={styles.cycleDayValue}>
                  Day {pond?.cycleDay ?? "—"}
                </Text>
              </View>
            </View>

            <View style={styles.pondHeroBottom}>
              <Text style={styles.speciesText}>
                Species: {pond?.species ?? "—"}
              </Text>
              <View style={styles.harvestBlock}>
                <Text style={styles.harvestLabel}>Harvest Window</Text>
                <Text style={styles.harvestValue}>
                  {pond ? formatHarvestWindow(pond) : "—"}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(pond ? getHarvestProgress(pond) : 0.3) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.sectionEyebrow}>DATA SOURCE SELECTION</Text>
          <View style={styles.sourceRow}>
            <View style={styles.sourceCard}>
              <Feather name="radio" size={22} color={colors.primary} />
              <Text style={styles.sourceTitle}>Import from IoT</Text>
              <Pressable
                onPress={() =>
                  Alert.alert("IoT", "IoT connection will be added soon.")
                }
                style={styles.sourceButton}
              >
                <Text style={styles.sourceButtonText}>Connect</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogToday}
              style={styles.sourceCard}
            >
              <Feather name="edit-3" size={22} color={colors.primary} />
              <Text style={styles.sourceTitle}>Manual Entry</Text>
            </Pressable>
          </View>

          <View style={styles.setupCard}>
            <View style={styles.setupIcon}>
              <Feather name="dollar-sign" size={18} color={colors.primary} />
            </View>
            <Text style={styles.setupTitle}>Explore Expense Setup</Text>
            <Text style={styles.setupBody}>
              Add every cost incurred on this pond only. Configure and track every
              investment made in this specific pond for accurate ROI calculations.
            </Text>
            <Pressable
              onPress={() => Alert.alert("Expenses", "Expense setup coming soon.")}
              style={styles.setupButton}
            >
              <Text style={styles.setupButtonText}>Setup Expenses →</Text>
            </Pressable>
          </View>

          <View style={[styles.setupCard, styles.feedCard]}>
            <View style={[styles.setupIcon, styles.feedIcon]}>
              <Feather name="coffee" size={18} color={colors.primaryDark} />
            </View>
            <Text style={styles.setupTitle}>Optimize Your Growth</Text>
            <Text style={styles.setupBody}>
              Configure your feeding schedules and feed types to optimize growth,
              minimize waste, and track nutrition efficiency across your cycle.
            </Text>
            <Pressable
              onPress={() => navigateWithPond("/feed-management")}
              style={[styles.setupButton, styles.feedButton]}
            >
              <Text style={styles.feedButtonText}>
                Explore Feed Management →
              </Text>
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Water Vitals</Text>
            {hasRecentLog ? (
              <View style={styles.vitalsRow}>
                {waterVitals.map((vital) => (
                  <View key={vital.label} style={styles.vitalItem}>
                    <Text style={styles.vitalLabel}>{vital.label}</Text>
                    <Text style={styles.vitalValue}>{vital.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <Text style={styles.emptyInfoTitle}>No recent data</Text>
                <Text style={styles.emptyInfoBody}>
                  Log Required. Record your first daily water parameter check.
                </Text>
              </>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Growth & Biomass</Text>
            {hasRecentLog && pond?.biomass && pond.biomass !== "—" ? (
              <Text style={styles.biomassValue}>{pond.biomass}</Text>
            ) : (
              <>
                <View style={styles.placeholderImage}>
                  <Feather name="image" size={28} color={colors.muted} />
                </View>
                <Text style={styles.emptyInfoTitle}>Pending First Log</Text>
                <Text style={styles.emptyInfoBody}>
                  Wait for your first sampling to see growth trends.
                </Text>
              </>
            )}
          </View>
        </ScrollView>

        <Pressable
          onPress={handleLogToday}
          style={styles.fab}
          accessibilityRole="button"
        >
          <Feather name="edit-3" size={16} color={colors.white} />
          <Text style={styles.fabText}>Log Today&apos;s...</Text>
        </Pressable>

        {pondId ? (
          <PondBottomNav pondId={pondId} activeTab="dashboard" />
        ) : null}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  profileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  profileName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 14,
  },
  pondHeroCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  pondHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pondHeroName: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  activeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  cycleDayBlock: {
    alignItems: "flex-end",
  },
  cycleDayLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  cycleDayValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  pondHeroBottom: {
    gap: 12,
  },
  speciesText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "600",
  },
  harvestBlock: {
    gap: 6,
  },
  harvestLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  harvestValue: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  sectionEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  sourceRow: {
    flexDirection: "row",
    gap: 12,
  },
  sourceCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
    gap: 10,
    minHeight: 130,
    justifyContent: "center",
  },
  sourceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  sourceButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sourceButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  setupCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  feedCard: {
    backgroundColor: colors.feedBlue,
    borderColor: "#D6E9FF",
  },
  setupIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  feedIcon: {
    backgroundColor: colors.white,
  },
  setupTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  setupBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  setupButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  setupButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  feedButton: {
    backgroundColor: colors.primaryDark,
  },
  feedButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  infoCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  vitalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  vitalItem: {
    width: "22%",
    minWidth: 68,
    gap: 4,
  },
  vitalLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  vitalValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyInfoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyInfoBody: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  placeholderImage: {
    width: "100%",
    height: 90,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  biomassValue: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "900",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  fabText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
});
