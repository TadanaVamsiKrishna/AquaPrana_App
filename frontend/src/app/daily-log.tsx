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
import { resolvePondId } from "../lib/pond-route";
import {
  getParameterStatus,
  getStatusBackground,
  getStatusColor,
  getSurvivalColor,
  type ParameterStatus,
  type WaterParameterKey,
} from "../lib/water-quality";
import {
  getLatestLogForPond,
  getPondLogTotals,
  getTodayLogCountForPond,
  pondHasLogsForActiveCycle,
} from "../services/local-daily-logs";
import { getFeedScheduleForPond } from "../services/local-feed-schedule";
import { getFarmerProfile } from "../services/local-profile";
import { getExpensesForPond } from "../services/local-pond-expenses";
import {
  getPondExpenseSummary,
  resolveCycleId,
} from "../services/pond-expenses";
import {
  getDataSourceForPond,
  saveDataSourceForPond,
  type PondDataSource,
} from "../services/local-pond-preferences";
import { getPondById, formatLastLogTime, type StoredPond } from "../services/local-ponds";

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
  warning: "#F59E0B",
  danger: "#EF4444",
};

const DASHBOARD_VITALS: {
  key: WaterParameterKey;
  label: string;
  unit: string;
  readingKey: keyof NonNullable<StoredPond["latestReadings"]>;
  range: string;
}[] = [
  { key: "do", label: "DO", unit: "mg/L", readingKey: "dissolvedOxygen", range: "4.0 - 10.0" },
  { key: "ph", label: "pH", unit: "UNITS", readingKey: "ph", range: "7.5 - 8.5" },
  { key: "ammonia", label: "Ammonia", unit: "mg/L", readingKey: "ammonia", range: "< 0.1" },
  { key: "temperature", label: "Temp", unit: "°C", readingKey: "temperature", range: "26 - 32 °C" },
  { key: "salinity", label: "Salinity", unit: "PPT", readingKey: "salinity", range: "10 - 25 ppt" },
];

function formatHarvestWindow(pond: StoredPond) {
  const duration = getSpeciesDuration(pond.species);
  const cycleDay = Number(pond.cycleDay);

  if (duration && Number.isFinite(cycleDay)) {
    return `Day ${duration.minDays} - ${duration.maxDays}`;
  }

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

function getStatusLabel(status: ParameterStatus) {
  if (status === "good") {
    return "Good";
  }

  if (status === "attention") {
    return "Sub-optimal";
  }

  if (status === "critical") {
    return "Critical";
  }

  return "—";
}

function formatPercent(value: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function VitalCard({
  label,
  value,
  unit,
  range,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  range: string;
  status: ParameterStatus;
}) {
  const isCritical = status === "critical";

  return (
    <View
      style={[
        styles.vitalCard,
        isCritical && styles.vitalCardCritical,
        { backgroundColor: getStatusBackground(status) },
      ]}
    >
      <View style={styles.vitalCardTop}>
        <Text style={[styles.vitalCardLabel, isCritical && styles.vitalCardLabelCritical]}>
          {label}
        </Text>
        <View
          style={[
            styles.vitalStatusBadge,
            { backgroundColor: isCritical ? colors.danger : getStatusColor(status) },
          ]}
        >
          <Text style={styles.vitalStatusText}>{getStatusLabel(status)}</Text>
        </View>
      </View>
      <Text style={[styles.vitalCardValue, isCritical && styles.vitalCardValueCritical]}>
        {value}
      </Text>
      <Text style={styles.vitalCardUnit}>{unit}</Text>
      <Text style={styles.vitalCardRange}>RANGE: {range}</Text>
    </View>
  );
}

export default function DailyLogScreen() {
  const router = useRouter();
  const { pondId: pondIdParam } = useLocalSearchParams<{ pondId: string }>();
  const pondId = resolvePondId(pondIdParam);

  const [pond, setPond] = useState<StoredPond | null>(null);
  const [farmerName, setFarmerName] = useState("Farmer");
  const [dataSource, setDataSource] = useState<PondDataSource | null>(null);
  const [hasLogs, setHasLogs] = useState(false);
  const [hasFeedSetup, setHasFeedSetup] = useState(false);
  const [hasExpenseSetup, setHasExpenseSetup] = useState(false);
  const [todayLogCount, setTodayLogCount] = useState(0);
  const [latestAbw, setLatestAbw] = useState("—");
  const [cumulativeFeed, setCumulativeFeed] = useState(0);
  const [mortalityTotal, setMortalityTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expenseBreakdown, setExpenseBreakdown] = useState({
    feed: 0,
    seed: 0,
    treatment: 0,
    labour: 0,
  });
  const [feedSchedule, setFeedSchedule] = useState({
    feedsPerDay: 4,
    perFeedQty: "12.0",
    dailyQty: "48.0",
    feedingTimes: "06:00, 11:00, 14:00, 17:00",
    nextFeedTime: "10:00 AM",
    nextFeedQty: "11.0",
    lastUpdated: "",
  });

  const loadPond = useCallback(async () => {
    if (!pondId) {
      return;
    }

    const [
      pondData,
      profile,
      latestLog,
      logsExist,
      source,
      schedule,
      todayCount,
      totals,
    ] = await Promise.all([
      getPondById(pondId),
      getFarmerProfile(),
      getLatestLogForPond(pondId),
      pondHasLogsForActiveCycle(pondId),
      getDataSourceForPond(pondId),
      getFeedScheduleForPond(pondId),
      getTodayLogCountForPond(pondId),
      getPondLogTotals(pondId),
    ]);

    const expenseResult = await getPondExpenseSummary(
      pondId,
      resolveCycleId(pondData?.stockingDate),
    );
    const expenses = expenseResult.summary ?? (await getExpensesForPond(pondId));

    const hasLogData =
      logsExist ||
      !!latestLog ||
      !!pondData?.latestReadings?.dissolvedOxygen ||
      !!pondData?.latestReadings?.ph;

    setPond(pondData);
    setFarmerName(profile?.name ?? "Farmer");
    setDataSource(source);
    setHasLogs(hasLogData);
    setHasFeedSetup(!!schedule);
    setHasExpenseSetup(
      !!expenses &&
        (!!expenses.configured ||
          !!expenses.priceConfig ||
          (expenses.total ?? 0) > 0),
    );
    setTodayLogCount(todayCount);
    setLatestAbw(latestLog?.abwSample ? `${latestLog.abwSample} g` : "—");
    setCumulativeFeed(totals.cumulativeFeed);
    setMortalityTotal(totals.mortality);

    if (expenses) {
      setExpenseTotal(expenses.total);
      setExpenseBreakdown({
        feed: expenses.feed,
        seed: expenses.seed,
        treatment: expenses.treatment,
        labour: expenses.labour + (expenses.others ?? 0),
      });
    } else {
      setExpenseTotal(0);
      setExpenseBreakdown({ feed: 0, seed: 0, treatment: 0, labour: 0 });
    }

    if (schedule) {
      const perFeed = Number(schedule.initialQuantity) || 12;
      const daily = perFeed * schedule.feedsPerDay;
      const nextTime =
        schedule.feedingTimes[1] ?? schedule.feedingTimes[0] ?? "10:00";
      const lastUpdated = schedule.updatedAt
        ? formatLastLogTime(new Date(schedule.updatedAt))
        : "Recently";

      setFeedSchedule({
        feedsPerDay: schedule.feedsPerDay,
        perFeedQty: perFeed.toFixed(1),
        dailyQty: daily.toFixed(1),
        feedingTimes: schedule.feedingTimes.join(", "),
        nextFeedTime:
          nextTime.includes("AM") || nextTime.includes("PM")
            ? nextTime
            : `${nextTime}`,
        nextFeedQty: perFeed.toFixed(1),
        lastUpdated,
      });
    } else {
      setFeedSchedule({
        feedsPerDay: 4,
        perFeedQty: "12.0",
        dailyQty: "48.0",
        feedingTimes: "06:00, 11:00, 14:00, 17:00",
        nextFeedTime: "10:00 AM",
        nextFeedQty: "11.0",
        lastUpdated: "",
      });
    }
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadPond();
    }, [loadPond]),
  );

  const showDataSourceSelection = !dataSource;
  const showDashboardSections = !!dataSource;

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

    if (dataSource === "iot") {
      Alert.alert("IoT", "IoT import will be added soon.");
      return;
    }

    await navigateToDailyLogEntry(router, pondId);
  };

  const handleSelectManual = async () => {
    if (!pondId) {
      return;
    }

    await saveDataSourceForPond(pondId, "manual");
    setDataSource("manual");
    await navigateToDailyLogEntry(router, pondId);
  };

  const handleSelectIot = async () => {
    if (!pondId) {
      return;
    }

    await saveDataSourceForPond(pondId, "iot");
    setDataSource("iot");
    Alert.alert("IoT", "IoT connection will be added soon.");
  };

  const vitalCards = useMemo(() => {
    const readings = pond?.latestReadings;
    const hasReadingValues =
      readings &&
      Object.values(readings).some(
        (value) => value && value !== "0" && value !== "—",
      );

    return DASHBOARD_VITALS.map((vital) => {
      const rawValue = readings?.[vital.readingKey] ?? "";
      const numericValue =
        rawValue && rawValue !== "0" ? Number(rawValue) : null;
      const status = hasReadingValues
        ? getParameterStatus(
            vital.key,
            Number.isFinite(numericValue) ? numericValue : null,
          )
        : ("none" as ParameterStatus);

      return {
        ...vital,
        value: rawValue && rawValue !== "0" ? rawValue : "—",
        status,
      };
    });
  }, [pond]);

  const survivalRate = pond?.survivalRate ?? "—";
  const survivalColor = getSurvivalColor(survivalRate);

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

          {showDataSourceSelection ? (
            <>
              <Text style={styles.sectionEyebrow}>DATA SOURCE SELECTION</Text>
              <View style={styles.sourceRow}>
                <View style={styles.sourceCard}>
                  <Feather name="radio" size={22} color={colors.primary} />
                  <Text style={styles.sourceTitle}>Import from IoT</Text>
                  <Pressable onPress={handleSelectIot} style={styles.sourceButton}>
                    <Text style={styles.sourceButtonText}>Connect</Text>
                  </Pressable>
                </View>

                <Pressable onPress={handleSelectManual} style={styles.sourceCard}>
                  <Feather name="edit-3" size={22} color={colors.primary} />
                  <Text style={styles.sourceTitle}>Manual Entry</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {!showDashboardSections && !hasExpenseSetup ? (
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
                onPress={() => navigateWithPond("/expense-setup")}
                style={styles.setupButton}
              >
                <Text style={styles.setupButtonText}>Setup Expenses →</Text>
              </Pressable>
            </View>
          ) : null}

          {!showDashboardSections && !hasFeedSetup ? (
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
          ) : null}

          {showDashboardSections && hasLogs ? (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Water Vitals</Text>
                  <Pressable onPress={() => navigateWithPond("/pond-trends")}>
                    <Text style={styles.sectionLink}>View Live Trend</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vitalsScroll}
                >
                  {vitalCards.map((vital) => (
                    <VitalCard
                      key={vital.key}
                      label={vital.label}
                      value={vital.value}
                      unit={vital.unit}
                      range={vital.range}
                      status={vital.status}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Growth & Biomass</Text>
                <View style={styles.growthGrid}>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>Total Biomass</Text>
                    <Text style={styles.growthValue}>{pond?.biomass ?? "—"}</Text>
                  </View>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>ABW</Text>
                    <Text style={styles.growthValue}>{latestAbw}</Text>
                    <Text style={styles.growthHint}>Updated Today</Text>
                  </View>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>Survival</Text>
                    <Text style={[styles.growthValue, { color: survivalColor }]}>
                      {survivalRate}
                    </Text>
                    <Text style={styles.growthHint}>Optimal (&gt;85%)</Text>
                  </View>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>FCR</Text>
                    <Text style={styles.growthValue}>1.32</Text>
                    <Text style={styles.growthHint}>Good</Text>
                  </View>
                </View>
                <View style={styles.growthFooter}>
                  <Text style={styles.growthFooterText}>
                    Cumulative Feed: {cumulativeFeed.toLocaleString("en-US")} kg
                  </Text>
                  <Text style={styles.growthFooterText}>
                    Mortality: {mortalityTotal}
                  </Text>
                </View>
              </View>

              <View style={styles.logProgressCard}>
                <Pressable onPress={handleLogToday} style={styles.logTodayButton}>
                  <Feather name="plus" size={16} color={colors.white} />
                  <Text style={styles.logTodayButtonText}>Log Today&apos;s Data</Text>
                </Pressable>
                <View style={styles.logProgressMeta}>
                  <Text style={styles.logProgressLast}>
                    Last: {pond?.lastLogTime ?? "No log today"}
                  </Text>
                  <Text style={styles.logProgressCount}>
                    {Math.min(todayLogCount, 4)} / 4 Logs
                  </Text>
                </View>
                <View style={styles.logProgressTrack}>
                  <View
                    style={[
                      styles.logProgressFill,
                      { width: `${(Math.min(todayLogCount, 4) / 4) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </>
          ) : showDashboardSections ? (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Water Vitals</Text>
                <Text style={styles.emptyInfoTitle}>Pending First Log</Text>
                <Text style={styles.emptyInfoBody}>
                  Log Required. Record your first daily water parameter check.
                </Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Growth & Biomass</Text>
                <View style={styles.placeholderImage}>
                  <Feather name="image" size={28} color={colors.muted} />
                </View>
                <Text style={styles.emptyInfoTitle}>Pending First Log</Text>
                <Text style={styles.emptyInfoBody}>
                  Wait for your first sampling to see growth trends.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Water Vitals</Text>
                <Text style={styles.emptyInfoTitle}>No recent data</Text>
                <Text style={styles.emptyInfoBody}>
                  Log Required. Record your first daily water parameter check.
                </Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Growth & Biomass</Text>
                <View style={styles.placeholderImage}>
                  <Feather name="image" size={28} color={colors.muted} />
                </View>
                <Text style={styles.emptyInfoTitle}>Pending First Log</Text>
                <Text style={styles.emptyInfoBody}>
                  Wait for your first sampling to see growth trends.
                </Text>
              </View>
            </>
          )}

          {showDashboardSections && !hasFeedSetup ? (
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
          ) : null}

          {showDashboardSections && hasFeedSetup ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Feed Recommendation</Text>
                <Pressable onPress={() => navigateWithPond("/feed-management")}>
                  <Text style={styles.sectionLink}>Manage Feed Schedule</Text>
                </Pressable>
              </View>
              <View style={styles.feedSummaryGrid}>
                <View style={styles.feedSummaryItem}>
                  <Text style={styles.feedSummaryLabel}>Recommended Feed</Text>
                  <Text style={styles.feedSummaryValue}>
                    {feedSchedule.dailyQty} kg/day
                  </Text>
                </View>
                <View style={styles.feedSummaryItem}>
                  <Text style={styles.feedSummaryLabel}>Feed Times</Text>
                  <Text style={styles.feedSummaryValue}>
                    {feedSchedule.feedingTimes}
                  </Text>
                </View>
                <View style={styles.feedSummaryItem}>
                  <Text style={styles.feedSummaryLabel}>Per Feed Quantity</Text>
                  <Text style={styles.feedSummaryValue}>
                    {feedSchedule.perFeedQty} kg
                  </Text>
                </View>
              </View>
              <View style={styles.nextFeedRow}>
                <Text style={styles.nextFeedText}>
                  Last updated: {feedSchedule.lastUpdated || "Recently"}
                </Text>
                <View style={styles.nextFeedBadge}>
                  <Text style={styles.nextFeedBadgeText}>
                    Next: {feedSchedule.nextFeedTime}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {showDashboardSections && !hasExpenseSetup ? (
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
                onPress={() => navigateWithPond("/expense-setup")}
                style={styles.setupButton}
              >
                <Text style={styles.setupButtonText}>Setup Expenses →</Text>
              </Pressable>
            </View>
          ) : null}

          {showDashboardSections && hasExpenseSetup ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Expense Summary (This Cycle)</Text>
                <Pressable onPress={() => navigateWithPond("/expense-setup")}>
                  <Text style={styles.sectionLink}>Manage Expenses</Text>
                </Pressable>
              </View>
              <Text style={styles.expenseTotal}>
                ₹ {expenseTotal.toLocaleString("en-IN")}
              </Text>
              <View style={styles.expenseGrid}>
                {[
                  { label: "Feed", value: expenseBreakdown.feed },
                  { label: "Seed", value: expenseBreakdown.seed },
                  {
                    label: "Other",
                    value: expenseBreakdown.treatment + expenseBreakdown.labour,
                  },
                ].map((item) => (
                  <View key={item.label} style={styles.expenseItem}>
                    <Text style={styles.expenseItemLabel}>{item.label}</Text>
                    <Text style={styles.expenseItemValue}>
                      ₹ {item.value.toLocaleString("en-IN")}
                    </Text>
                    <Text style={styles.expenseItemPercent}>
                      {formatPercent(item.value, expenseTotal)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {showDashboardSections ? (
          <Pressable
            onPress={handleLogToday}
            style={styles.fab}
            accessibilityRole="button"
          >
            <Feather name="edit-3" size={16} color={colors.white} />
            <Text style={styles.fabText}>Log Today&apos;s...</Text>
          </Pressable>
        ) : null}

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
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  vitalsScroll: {
    gap: 10,
    paddingRight: 4,
  },
  vitalCard: {
    width: 132,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vitalCardCritical: {
    borderColor: "#FECACA",
  },
  vitalCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  vitalCardLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  vitalCardLabelCritical: {
    color: colors.danger,
  },
  vitalStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vitalStatusText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
  },
  vitalCardValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  vitalCardValueCritical: {
    color: colors.danger,
  },
  vitalCardUnit: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  vitalCardRange: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
  },
  growthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  growthItem: {
    width: "48%",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  growthLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  growthValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  growthHint: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
  },
  growthFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  growthFooterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  logProgressCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  logTodayButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logTodayButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  logProgressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logProgressLast: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  logProgressCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  logProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.softBlue,
    overflow: "hidden",
  },
  logProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  feedSummaryGrid: {
    gap: 10,
  },
  feedSummaryItem: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  feedSummaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  feedSummaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  nextFeedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextFeedText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  nextFeedBadge: {
    backgroundColor: colors.softBlue,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextFeedBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  expenseTotal: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  expenseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  expenseItem: {
    width: "48%",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  expenseItemLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  expenseItemValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  expenseItemPercent: {
    color: colors.primary,
    fontSize: 11,
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
