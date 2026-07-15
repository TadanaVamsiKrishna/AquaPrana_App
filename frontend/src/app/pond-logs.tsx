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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PondBottomNav } from "../components/pond-bottom-nav";
import { navigateBackToHome } from "../lib/pond-route";
import {
  getAmmoniaStatus,
  getDoStatus,
  getPhStatus,
  getStatusColor,
  getTemperatureStatus,
} from "../lib/water-quality";
import {
  getLogsForCycle,
  getLogsForPond,
  type DailyLogEntry,
} from "../services/dailyLogs";

import {
  getSupabasePondById,
  mapSupabasePondName,
  type SupabasePondRecord,
} from "../services/pond";

const colors = {
  primary: "#0A84FF",
  primaryDark: "#0646A8",
  background: "#F4F7FA",
  white: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  softBlue: "#E8F3FF",
  infoBlue: "#EAF4FF",
};

const PAGE_SIZE = 10;

function formatLogDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function MetricCell({
  label,
  value,
  statusColor,
}: {
  label: string;
  value: string;
  statusColor: string;
}) {
  return (
    <View style={styles.metricCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={[styles.metricBar, { backgroundColor: statusColor }]} />
    </View>
  );
}

function LogHistoryCard({ log }: { log: DailyLogEntry }) {
  const doStatus = getDoStatus(Number(log.dissolvedOxygen));
  const phStatus = getPhStatus(Number(log.ph));
  const tempStatus = getTemperatureStatus(Number(log.temperature));
  const ammoniaStatus = getAmmoniaStatus(Number(log.ammonia));

  return (
    <View style={styles.logCard}>
      <View style={styles.logCardHeader}>
        <View>
          <Text style={styles.logDate}>{formatLogDate(log.observedAt)}</Text>
          <View style={styles.manualTag}>
            <Text style={styles.manualTagText}>Manual Entry</Text>
          </View>
        </View>
        <Feather name="edit-2" size={16} color={colors.muted} />
      </View>

      <View style={styles.metricsGrid}>
        <MetricCell
          label="DO"
          value={log.dissolvedOxygen}
          statusColor={getStatusColor(doStatus)}
        />
        <MetricCell
          label="pH"
          value={log.ph}
          statusColor={getStatusColor(phStatus)}
        />
        <MetricCell
          label="Temp"
          value={log.temperature}
          statusColor={getStatusColor(tempStatus)}
        />
        <MetricCell
          label="Ammonia"
          value={log.ammonia}
          statusColor={getStatusColor(ammoniaStatus)}
        />
      </View>
    </View>
  );
}

export default function PondLogsScreen() {
  const router = useRouter();
  const { pondId, cycleId } = useLocalSearchParams<{
    pondId: string;
    cycleId?: string;
  }>();
  const [pond, setPond] = useState<SupabasePondRecord | null>(null);
  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    const [pondData, pondLogs] = await Promise.all([
      getSupabasePondById(pondId),
      cycleId ? getLogsForCycle(cycleId) : getLogsForPond(pondId),
    ]);

    const sortedLogs = pondLogs.sort(
      (left, right) =>
        new Date(right.observedAt).getTime() -
        new Date(left.observedAt).getTime(),
    );

    setPond(pondData);
    setLogs(sortedLogs);
    setIsLoading(false);
  }, [pondId, cycleId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));

  const visibleLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return logs.slice(start, start + PAGE_SIZE);
  }, [logs, page]);

  const rangeStart = logs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, logs.length);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigateBackToHome(router)}
            style={styles.iconButton}
          >
            <Feather name="arrow-left" size={22} color={colors.primaryDark} />
          </Pressable>
          <Text style={styles.headerTitle}>Logs History</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pondCard}>
            <Text style={styles.pondCardEyebrow}>CURRENT VIEW</Text>
            <View style={styles.pondCardRow}>
              <Text style={styles.pondCardName}>
              {pond ? mapSupabasePondName(pond) : "Selected Pond"}
              </Text>
              <Feather name="sliders" size={18} color={colors.white} />
            </View>
          </View>

          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Log Management Rules: Logs can be edited within 24 hours of entry.
              There is a limit of 3 manual logs per pond per day.
            </Text>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterChip}>
              <Feather name="clock" size={14} color={colors.primary} />
              <Text style={styles.filterChipText}>LAST 7 DAYS</Text>
            </View>
            <View style={styles.filterChip}>
              <Feather name="filter" size={14} color={colors.primary} />
              <Text style={styles.filterChipText}>FILTERS</Text>
            </View>
            <Text style={styles.totalLogs}>{logs.length} Total Logs</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : visibleLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No logs yet</Text>
              <Text style={styles.emptyBody}>
                Add your first daily log from the dashboard.
              </Text>
            </View>
          ) : (
            visibleLogs.map((log) => <LogHistoryCard key={log.id} log={log} />)
          )}

          {logs.length > 0 ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
                style={styles.pageButton}
              >
                <Text style={styles.pageButtonText}>Previous</Text>
              </Pressable>

              <Text style={styles.pageIndicator}>
                {page} / {totalPages}
              </Text>

              <Pressable
                onPress={() =>
                  setPage((current) => Math.min(current + 1, totalPages))
                }
                disabled={page === totalPages}
                style={styles.pageButton}
              >
                <Text style={styles.pageButtonText}>Next</Text>
              </Pressable>
            </View>
          ) : null}

          {logs.length > 0 ? (
            <Text style={styles.paginationMeta}>
              Showing {rangeStart}-{rangeEnd} of {logs.length} logs
            </Text>
          ) : null}
        </ScrollView>

        {pondId ? (
          <PondBottomNav pondId={pondId} activeTab="logs" />
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
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  pondCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    padding: 16,
  },
  pondCardEyebrow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  pondCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pondCardName: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "900",
    flex: 1,
    paddingRight: 12,
  },
  infoBanner: {
    backgroundColor: colors.infoBlue,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D6E9FF",
  },
  infoBannerText: {
    color: colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  totalLogs: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: "auto",
  },
  loader: { paddingVertical: 40 },
  emptyState: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
  },
  logCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  logCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  manualTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.softBlue,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  manualTagText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCell: {
    width: "47%",
    gap: 4,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  metricBar: {
    height: 4,
    borderRadius: 999,
    marginTop: 2,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  pageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  pageIndicator: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  paginationMeta: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
});
