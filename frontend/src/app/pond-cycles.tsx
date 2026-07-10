import { useCallback, useState } from "react";
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PondBottomNav } from "../components/pond-bottom-nav";
import {
  getClosedCyclesForPond,
  type ClosedCycle,
} from "../services/local-cycle-history";
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
  success: "#16A34A",
  successSoft: "#DCFCE7",
};

export default function PondCyclesScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();

  const [pond, setPond] = useState<StoredPond | null>(null);
  const [previousCycles, setPreviousCycles] = useState<ClosedCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    const [pondData, closedCycles] = await Promise.all([
      getPondById(pondId),
      getClosedCyclesForPond(pondId),
    ]);
    setPond(pondData);
    setPreviousCycles(closedCycles);
    setIsLoading(false);
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleGenerateReport = () => {
    if (!pondId) {
      return;
    }

    router.push({
      pathname: "/cycle-report",
      params: { pondId },
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

  const recordCount = 1 + previousCycles.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{pond?.pondName ?? "Pond Cycles"}</Text>
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
          ) : (
            <>
              <View style={styles.activeCard}>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE Current Cycle</Text>
                </View>

                <View style={styles.speciesRow}>
                  <Feather name="droplet" size={16} color={colors.primary} />
                  <Text style={styles.speciesText}>{pond?.species ?? "—"}</Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Stocking Date</Text>
                    <Text style={styles.detailValue}>
                      {pond?.stockingDate ?? "—"}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Cycle Length</Text>
                    <Text style={styles.detailValue}>
                      Day {pond?.cycleDay ?? "—"}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>FCR</Text>
                    <Text style={styles.metricValue}>—</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>Survival</Text>
                    <Text style={[styles.metricValue, styles.survivalValue]}>
                      {pond?.survivalRate ?? "—"}
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

              <Text style={styles.sectionTitle}>Previous Cycles</Text>
              {previousCycles.length === 0 ? (
                <View style={styles.emptyPrevious}>
                  <Text style={styles.emptyPreviousText}>
                    No previous cycles recorded for this pond yet.
                  </Text>
                </View>
              ) : (
                previousCycles.map((cycle) => (
                  <View key={cycle.id} style={styles.previousCard}>
                    <View style={styles.previousHeader}>
                      <View style={styles.previousCopy}>
                        <Text style={styles.previousSpecies}>{cycle.species}</Text>
                        <Text style={styles.previousDates}>
                          {cycle.stockingDate} - {cycle.harvestDate}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.muted} />
                    </View>

                    <View style={styles.previousMetrics}>
                      <View style={styles.previousMetric}>
                        <Text style={styles.previousMetricLabel}>FCR</Text>
                        <Text style={styles.previousMetricValue}>
                          {cycle.finalFcr}
                        </Text>
                      </View>
                      <View style={styles.previousMetric}>
                        <Text style={styles.previousMetricLabel}>Survival</Text>
                        <Text
                          style={[
                            styles.previousMetricValue,
                            styles.survivalValue,
                          ]}
                        >
                          {cycle.finalSurvival}
                        </Text>
                      </View>
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
