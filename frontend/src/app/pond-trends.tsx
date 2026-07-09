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
import { navigateToDailyLogEntry } from "../lib/daily-log-navigation";
import { getLogsForPond } from "../services/local-daily-logs";
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
  teal: "#14B8A6",
};

type Timeframe = "7D" | "1M" | "3M";

function TrendChartCard({
  title,
  value,
  unit,
  safeZone,
  barColor,
  hasData,
}: {
  title: string;
  value: string;
  unit: string;
  safeZone: string;
  barColor: string;
  hasData: boolean;
}) {
  return (
    <View style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View>
          <Text style={styles.trendTitle}>{title}</Text>
          <Text style={styles.trendValue}>
            {value}
            {unit ? ` ${unit}` : ""}
          </Text>
        </View>
      </View>
      <Text style={styles.safeZone}>SAFE ZONE: {safeZone}</Text>

      {hasData ? (
        <View style={styles.chartArea}>
          {[0.35, 0.55, 0.45, 0.7, 0.6, 0.75, 0.68].map((height, index) => (
            <View key={index} style={styles.chartColumn}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: `${height * 100}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noDataText}>Log more data to see trends</Text>
      )}
    </View>
  );
}

export default function PondTrendsScreen() {
  const router = useRouter();
  const { pondId } = useLocalSearchParams<{ pondId: string }>();

  const [pond, setPond] = useState<StoredPond | null>(null);
  const [hasLogs, setHasLogs] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("7D");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    const [pondData, logs] = await Promise.all([
      getPondById(pondId),
      getLogsForPond(pondId),
    ]);

    setPond(pondData);
    setHasLogs(logs.length > 0);
    setIsLoading(false);
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const readings = pond?.latestReadings;
  const statusLabel =
    pond?.waterQualityStatus === "Good" || pond?.waterQualityStatus === "Excellent"
      ? "Optimal Conditions"
      : pond?.waterQualityStatus === "Attention" || pond?.waterQualityStatus === "Fair"
        ? "Needs Attention"
        : pond?.waterQualityStatus === "Critical" || pond?.waterQualityStatus === "Poor"
          ? "Critical Alerts"
          : "Pending Data";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{pond?.pondName ?? "Pond Trends"}</Text>
          <Pressable style={styles.iconButton}>
            <Feather name="download" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusCard}>
            <Text style={styles.statusEyebrow}>CURRENT STATUS</Text>
            <Text style={styles.statusTitle}>{statusLabel}</Text>
            <Text style={styles.statusBody}>
              {hasLogs
                ? "All parameters within safety zones."
                : "Add logs to unlock trend analytics."}
            </Text>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.badgeGreen]}>
                <Text style={styles.badgeValue}>98%</Text>
                <Text style={styles.badgeLabel}>Stability</Text>
              </View>
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={styles.badgeValue}>0</Text>
                <Text style={styles.badgeLabel}>Alerts</Text>
              </View>
            </View>
          </View>

          <View style={styles.timeframeRow}>
            {(["7D", "1M", "3M"] as Timeframe[]).map((option) => {
              const isActive = timeframe === option;

              return (
                <Pressable
                  key={option}
                  onPress={() => setTimeframe(option)}
                  style={[
                    styles.timeframeChip,
                    isActive && styles.timeframeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeframeText,
                      isActive && styles.timeframeTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : (
            <>
              <TrendChartCard
                title="Dissolved Oxygen"
                value={readings?.dissolvedOxygen ?? "—"}
                unit="mg/L"
                safeZone="5.0 - 10.0 MG/L"
                barColor={colors.primary}
                hasData={hasLogs}
              />
              <TrendChartCard
                title="pH Level"
                value={readings?.ph ?? "—"}
                unit=""
                safeZone="7.5 - 8.5"
                barColor={colors.success}
                hasData={hasLogs}
              />
              <TrendChartCard
                title="Temperature"
                value={readings?.temperature ?? "—"}
                unit="°C"
                safeZone="26 - 32 °C"
                barColor={colors.teal}
                hasData={hasLogs}
              />

              <View style={styles.trendCard}>
                <Text style={styles.trendTitle}>Salinity (ppt)</Text>
                <Text style={styles.noDataText}>
                  Log more data to see trends
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() =>
                      pondId && navigateToDailyLogEntry(router, pondId)
                    }
                    style={styles.outlineButton}
                  >
                    <Text style={styles.outlineButtonText}>+ Add Log</Text>
                  </Pressable>
                  <Pressable style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Export CSV</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.predictiveBanner}>
                <Text style={styles.predictiveEyebrow}>PREDICTIVE ANALYTICS</Text>
                <Text style={styles.predictiveText}>
                  DO levels stable for next 48h
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        {pondId ? (
          <PondBottomNav pondId={pondId} activeTab="trends" />
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
    gap: 12,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  statusEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  statusBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGreen: {
    backgroundColor: "#DCFCE7",
  },
  badgeBlue: {
    backgroundColor: colors.softBlue,
  },
  badgeValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  badgeLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  timeframeRow: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  timeframeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  timeframeChipActive: {
    backgroundColor: colors.softBlue,
  },
  timeframeText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  timeframeTextActive: {
    color: colors.primary,
  },
  loader: { paddingVertical: 40 },
  trendCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  trendTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  trendValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  safeZone: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  chartArea: {
    height: 120,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
  },
  chartColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    borderRadius: 6,
    opacity: 0.85,
  },
  noDataText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  outlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  predictiveBanner: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  predictiveEyebrow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  predictiveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
