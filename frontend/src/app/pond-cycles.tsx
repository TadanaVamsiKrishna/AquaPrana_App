import { useCallback, useMemo, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PondBottomNav } from "../components/pond-bottom-nav";
import {
  formatClosedCycleDateRange,
  formatCycleFcr,
  formatCycleStockingDate,
  formatCycleSurvival,
  getActiveCropCycleForPond,
  getCropCyclesForPond,
  getCycleDayFromRecord,
  type CropCycleRecord,
} from "../services/cropCycle";
import { getLatestAbwLogForCycle } from "../services/dailyLogs";
import { getSupabasePondById } from "../services/pond";
import { generateAndOpenCycleReport } from "../services/reportService";
import {
  getAbwDisplayValue,
  getFcrColor,
  getSurvivalColorFromRate,
  isAbwStale,
} from "../lib/cycle-metrics";
import { navigateBackToHome } from "../lib/pond-route";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  success: "#16A34A",
  successSoft: "#DCFCE7",
  warning: "#F59E0B",
  danger: "#EF4444",
  mutedText: "#94A3B8",
};

export default function PondCyclesScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();

  const [pondName, setPondName] = useState("Pond Cycles");
  const [activeCycle, setActiveCycle] = useState<CropCycleRecord | null>(null);
  const [closedCycles, setClosedCycles] = useState<CropCycleRecord[]>([]);
  const [latestAbwObservedAt, setLatestAbwObservedAt] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadingReportCycleId, setDownloadingReportCycleId] = useState<
    string | null
  >(null);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [pondData, cycles, active] = await Promise.all([
        getSupabasePondById(pondId),
        getCropCyclesForPond(pondId),
        getActiveCropCycleForPond(pondId),
      ]);

      setPondName(pondData?.name?.trim() || "Pond Cycles");
      setActiveCycle(active);
      setClosedCycles(
        cycles.filter((cycle) => cycle.status === "closed"),
      );

      if (active?.id) {
        const latestAbwLog = await getLatestAbwLogForCycle(active.id);
        setLatestAbwObservedAt(latestAbwLog?.observed_at ?? null);
      } else {
        setLatestAbwObservedAt(null);
      }
    } catch (error) {
      console.log("[pond-cycles] load error:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load cycle history.",
      );
      setActiveCycle(null);
      setClosedCycles([]);
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const recordCount = useMemo(
    () => (activeCycle ? 1 : 0) + closedCycles.length,
    [activeCycle, closedCycles.length],
  );

  const activeCycleDay = getCycleDayFromRecord(activeCycle);
  const abwStale = isAbwStale(latestAbwObservedAt);
  const activeBiomass =
    activeCycle?.current_biomass_kg != null
      ? `${activeCycle.current_biomass_kg.toLocaleString("en-US")} kg`
      : "—";
  const activeAbw = getAbwDisplayValue(
    activeCycle?.current_abw_g,
    latestAbwObservedAt,
  );
  const activeFcrColor = getFcrColor(activeCycle?.estimated_fcr);
  const activeSurvivalColor = getSurvivalColorFromRate(
    activeCycle?.survival_rate,
  );

  const handleGenerateReport = () => {
    if (!pondId || !activeCycle?.id) {
      return;
    }

    router.push({
      pathname: "/cycle-report",
      params: { pondId, cycleId: activeCycle.id },
    } as never);
  };

  const handleCloseCycle = () => {
    if (!pondId) {
      return;
    }

    router.push({
      pathname: "/close-cycle",
      params: { pondId },
    } as never);
  };

  const handleViewLogs = (cycleId: string) => {
    if (!pondId) {
      return;
    }

    router.push({
      pathname: "/pond-logs",
      params: { pondId, cycleId },
    } as never);
  };

  const handleDownloadReport = async (cycleId: string) => {
    if (!pondId || downloadingReportCycleId) {
      return;
    }

    setDownloadingReportCycleId(cycleId);

    try {
      await generateAndOpenCycleReport(cycleId);
    } catch (error) {
      Alert.alert(
        "Report unavailable",
        error instanceof Error
          ? error.message
          : "Unable to generate or open the cycle report.",
      );
    } finally {
      setDownloadingReportCycleId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigateBackToHome(router)}
            style={styles.iconButton}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{pondName}</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Cycle History</Text>
            <Text style={styles.recordCount}>
              {recordCount} {recordCount === 1 ? "Record" : "Records"}
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : loadError ? (
            <View style={styles.emptyPrevious}>
              <Text style={styles.emptyPreviousTitle}>Unable to load cycles</Text>
              <Text style={styles.emptyPreviousText}>{loadError}</Text>
            </View>
          ) : (
            <>
              {activeCycle ? (
                <View style={styles.activeCard}>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE Current Cycle</Text>
                  </View>

                  <Text style={styles.pondNameText}>{pondName}</Text>

                  <View style={styles.speciesRow}>
                    <Feather name="droplet" size={16} color={colors.primary} />
                    <Text style={styles.speciesText}>
                      {activeCycle.species ?? "—"}
                    </Text>
                  </View>

                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Stocking Date</Text>
                      <Text style={styles.detailValue}>
                        {formatCycleStockingDate(activeCycle.stocking_date)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Cycle Length</Text>
                      <Text style={styles.detailValue}>
                        {activeCycleDay != null ? `Day ${activeCycleDay}` : "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricBlock}>
                      <Text style={styles.metricLabel}>Biomass</Text>
                      <Text
                        style={[
                          styles.metricValue,
                          abwStale ? { color: colors.mutedText } : null,
                        ]}
                      >
                        {activeBiomass}
                      </Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={styles.metricLabel}>ABW</Text>
                      <Text
                        style={[
                          styles.metricValue,
                          abwStale ? { color: colors.warning } : null,
                        ]}
                      >
                        {activeAbw}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricBlock}>
                      <Text style={styles.metricLabel}>FCR</Text>
                      <Text style={[styles.metricValue, { color: activeFcrColor }]}>
                        {formatCycleFcr(activeCycle.estimated_fcr)}
                      </Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={styles.metricLabel}>Survival</Text>
                      <Text
                        style={[
                          styles.metricValue,
                          { color: activeSurvivalColor },
                        ]}
                      >
                        {formatCycleSurvival(activeCycle.survival_rate)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={handleGenerateReport}
                      style={styles.outlineButton}
                    >
                      <Text style={styles.outlineButtonText}>Generate Report</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCloseCycle}
                      style={styles.primaryButton}
                    >
                      <Feather name="power" size={14} color={colors.white} />
                      <Text style={styles.primaryButtonText}>Close Cycle</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyPrevious}>
                  <Text style={styles.emptyPreviousTitle}>No Active Crop Cycle</Text>
                  <Text style={styles.emptyPreviousText}>
                    Start a new crop cycle to track performance here.
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>Previous Cycles</Text>
              {closedCycles.length === 0 ? (
                <View style={styles.emptyPrevious}>
                  <Text style={styles.emptyPreviousText}>
                    No previous cycles recorded for this pond yet.
                  </Text>
                </View>
              ) : (
                closedCycles.map((cycle) => (
                  <View key={cycle.id} style={styles.previousCard}>
                    <View style={styles.previousHeader}>
                      <View style={styles.previousCopy}>
                        <Text style={styles.previousSpecies}>
                          {cycle.species ?? "—"}
                        </Text>
                        <Text style={styles.previousDates}>
                          {formatClosedCycleDateRange(cycle)}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.muted} />
                    </View>

                    <View style={styles.previousMetrics}>
                      <View style={styles.previousMetric}>
                        <Text style={styles.previousMetricLabel}>FCR</Text>
                        <Text
                          style={[
                            styles.previousMetricValue,
                            { color: getFcrColor(cycle.estimated_fcr) },
                          ]}
                        >
                          {formatCycleFcr(cycle.estimated_fcr)}
                        </Text>
                      </View>
                      <View style={styles.previousMetric}>
                        <Text style={styles.previousMetricLabel}>Survival</Text>
                        <Text
                          style={[
                            styles.previousMetricValue,
                            {
                              color: getSurvivalColorFromRate(cycle.survival_rate),
                            },
                          ]}
                        >
                          {formatCycleSurvival(cycle.survival_rate)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={() => handleViewLogs(cycle.id)}
                        style={styles.outlineButton}
                      >
                        <Text style={styles.outlineButtonText}>View Logs</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDownloadReport(cycle.id)}
                        disabled={downloadingReportCycleId === cycle.id}
                        style={styles.outlineButton}
                      >
                        {downloadingReportCycleId === cycle.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={styles.outlineButtonText}>Download PDF</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {pondId ? (
          <PondBottomNav pondId={pondId} activeTab="cycles" />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  recordCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  loader: { paddingVertical: 40 },
  activeCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  activeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "800",
  },
  pondNameText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  speciesText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  detailGrid: {
    flexDirection: "row",
    gap: 12,
  },
  detailItem: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBlock: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  survivalValue: {
    color: colors.success,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  outlineButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyPrevious: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 6,
  },
  emptyPreviousTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyPreviousText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  previousCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  previousHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previousCopy: {
    flex: 1,
    gap: 4,
  },
  previousSpecies: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  previousDates: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  previousMetrics: {
    flexDirection: "row",
    gap: 12,
  },
  previousMetric: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  previousMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  previousMetricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
});
