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
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { PondBottomNav } from "../components/pond-bottom-nav";
import { navigateToDailyLogEntry } from "../lib/daily-log-navigation";
import { navigateBackToHome, resolvePondId } from "../lib/pond-route";
import {
  getAbwDisplayValue,
  getFcrColor,
  getSurvivalColorFromRate,
  isAbwStale,
  isMortalityElevated,
} from "../lib/cycle-metrics";
import {
  getParameterStatus,
  getStatusBackground,
  getStatusColor,
  type ParameterStatus,
  type WaterParameterKey,
} from "../lib/water-quality";
import {
  fetchDashboardData,
  formatObservedAt,
  formatSpeciesLine,
  getCycleDay,
  getHarvestProgress,
  getHarvestWindowLabel,
  type CropCycleRecord,
  type DashboardPondLog,
} from "../services/dashboardService";
import {
  fetchFeedScheduleViewForCycle,
  formatFeedTimeDisplay,
  type FeedingScheduleView,
} from "../services/feedingScheduleService";
import { getFarmerProfile } from "../services/local-profile";
import {
  formatExpenseUpdatedAt,
  getCycleExpensesByCycleId,
  type CycleExpenseRecord,
} from "../services/cycleExpensesService";
import { getPriceConfigByCycleId } from "../services/priceConfigService";
import {
  getDataSourceForPond,
  saveDataSourceForPond,
  type PondDataSource,
} from "../services/local-pond-preferences";

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
  readingKey: keyof Pick<
    DashboardPondLog,
    | "dissolvedOxygen"
    | "ph"
    | "ammonia"
    | "temperature"
    | "salinity"
  >;
  range: string;
}[] = [
  { key: "do", label: "DO", unit: "mg/L", readingKey: "dissolvedOxygen", range: "4.0 - 10.0" },
  { key: "ph", label: "pH", unit: "UNITS", readingKey: "ph", range: "7.5 - 8.5" },
  { key: "ammonia", label: "Ammonia", unit: "mg/L", readingKey: "ammonia", range: "< 0.1" },
  { key: "temperature", label: "Temp", unit: "°C", readingKey: "temperature", range: "26 - 32 °C" },
  { key: "salinity", label: "Salinity", unit: "PPT", readingKey: "salinity", range: "10 - 25 ppt" },
];

function formatMetricValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return String(value);
}

function formatBiomassValue(cycle: CropCycleRecord | null) {
  if (cycle?.current_biomass_kg == null) {
    return "—";
  }

  return `${cycle.current_biomass_kg.toLocaleString("en-US")} kg`;
}

function formatFcr(cycle: CropCycleRecord | null) {
  if (cycle?.estimated_fcr == null) {
    return "—";
  }

  return String(cycle.estimated_fcr);
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
  const { t } = useTranslation();
  const { pondId: pondIdParam } = useLocalSearchParams<{ pondId: string }>();
  const pondId = resolvePondId(pondIdParam);

  const [pondName, setPondName] = useState("Pond");
  const [cropCycle, setCropCycle] = useState<CropCycleRecord | null>(null);
  const [latestLog, setLatestLog] = useState<DashboardPondLog | null>(null);
  const [farmerName, setFarmerName] = useState("Farmer");
  const [dataSource, setDataSource] = useState<PondDataSource | null>(null);
  const [hasLogs, setHasLogs] = useState(false);
  const [hasFeedSetup, setHasFeedSetup] = useState(false);
  const [todayLogCount, setTodayLogCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycleExpenses, setCycleExpenses] = useState<CycleExpenseRecord | null>(
    null,
  );
  const [hasPriceConfig, setHasPriceConfig] = useState(false);
  const [feedSchedule, setFeedSchedule] = useState<FeedingScheduleView | null>(
    null,
  );
  const [feedScheduleError, setFeedScheduleError] = useState<string | null>(
    null,
  );
  const [latestAbwObservedAt, setLatestAbwObservedAt] = useState<string | null>(
    null,
  );
  const [todayMortality, setTodayMortality] = useState(0);

  const loadPond = useCallback(async () => {
    if (!pondId) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [dashboardData, profile, source] = await Promise.all([
        fetchDashboardData(pondId),
        getFarmerProfile(),
        getDataSourceForPond(pondId),
      ]);

      const cycleId = dashboardData.cropCycle?.id;
      let resolvedFeedSchedule: FeedingScheduleView | null = null;

      if (cycleId) {
        try {
          resolvedFeedSchedule = await fetchFeedScheduleViewForCycle(
            cycleId,
            dashboardData.cropCycle?.current_biomass_kg ?? null,
          );
          setFeedScheduleError(null);
        } catch (error) {
          console.log("[daily-log] feed schedule fetch error:", error);
          setFeedScheduleError(
            error instanceof Error
              ? error.message
              : "Unable to load feeding schedule.",
          );
        }
      } else {
        setFeedScheduleError(null);
      }

      const [priceConfig, expenses] = cycleId
        ? await Promise.all([
            getPriceConfigByCycleId(cycleId),
            getCycleExpensesByCycleId(cycleId),
          ])
        : [null, null];

      setPondName(dashboardData.pondName);
      setCropCycle(dashboardData.cropCycle);
      setLatestLog(dashboardData.latestLog);
      setFarmerName(profile?.name ?? "Farmer");
      setDataSource(source);
      setHasLogs(!!dashboardData.latestLog);
      setFeedSchedule(resolvedFeedSchedule);
      setHasFeedSetup(!!resolvedFeedSchedule);
      setHasPriceConfig(!!priceConfig);
      setCycleExpenses(expenses);
      setTodayLogCount(dashboardData.todayLogCount);
      setLatestAbwObservedAt(dashboardData.latestAbwObservedAt);
      setTodayMortality(dashboardData.todayMortality);
    } catch (error) {
      console.log("[daily-log] dashboard load error:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pondId]);

  useFocusEffect(
    useCallback(() => {
      loadPond();
    }, [loadPond]),
  );

  const showDataSourceSelection = !dataSource;
  const showDashboardSections = !!dataSource;
  const hasActiveCycle = !!cropCycle;

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
    const hasReadingValues =
      !!latestLog &&
      DASHBOARD_VITALS.some((vital) => latestLog[vital.readingKey] !== null);

    return DASHBOARD_VITALS.map((vital) => {
      const numericValue = latestLog?.[vital.readingKey] ?? null;
      const status = hasReadingValues
        ? getParameterStatus(vital.key, numericValue)
        : ("none" as ParameterStatus);

      return {
        ...vital,
        value: formatMetricValue(numericValue),
        status,
      };
    });
  }, [latestLog]);

  const cycleDay = getCycleDay(cropCycle);
  const survivalRateValue = cropCycle?.survival_rate ?? null;
  const survivalRate =
    survivalRateValue != null ? `${survivalRateValue}%` : "—";
  const survivalColor = getSurvivalColorFromRate(survivalRateValue);
  const abwStale = isAbwStale(latestAbwObservedAt);
  const latestAbw = getAbwDisplayValue(
    cropCycle?.current_abw_g,
    latestAbwObservedAt,
  );
  const biomassValue = formatBiomassValue(cropCycle);
  const biomassColor = abwStale ? colors.muted : colors.text;
  const fcrValue = formatFcr(cropCycle);
  const fcrColor = getFcrColor(cropCycle?.estimated_fcr);
  const latestFeedQty =
    cropCycle?.current_feed_per_day_kg != null
      ? `${cropCycle.current_feed_per_day_kg} kg`
      : latestLog?.feedQty != null
        ? `${latestLog.feedQty} kg`
        : "—";
  const latestFeedBrand = latestLog?.feedBrand ?? "—";
  const latestMortality = cropCycle ? String(todayMortality) : "—";
  const mortalityColor = isMortalityElevated(
    todayMortality,
    cropCycle?.stocking_density ?? 0,
  )
    ? colors.danger
    : colors.muted;
  const latestTreatment = latestLog?.treatment ?? "—";
  const lastUpdatedLabel = formatObservedAt(
    cropCycle?.last_water_test_date ?? latestLog?.observedAt,
  );
  const abwUpdatedLabel = latestAbwObservedAt
    ? formatObservedAt(latestAbwObservedAt)
    : "No ABW log";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigateBackToHome(router)}
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

          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} accessibilityRole="button">
              <Feather name="bell" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null}

          {loadError ? (
            <View style={styles.infoCard}>
              <Text style={styles.emptyInfoTitle}>{t("home.unableToLoad")}</Text>
              <Text style={styles.emptyInfoBody}>{loadError}</Text>
            </View>
          ) : null}

          <View style={styles.pondHeroCard}>
            <View style={styles.pondHeroTop}>
              <View>
                <Text style={styles.pondHeroName}>{pondName}</Text>
                <View style={styles.activeRow}>
                  <View
                    style={[
                      styles.activeDot,
                      !hasActiveCycle && styles.inactiveDot,
                    ]}
                  />
                  <Text style={styles.activeText}>
                    {hasActiveCycle
                      ? cropCycle?.status?.toUpperCase() ?? t("dashboard.active")
                      : t("dashboard.noActiveCycleStatus")}
                  </Text>
                </View>
              </View>
              {hasActiveCycle ? (
                <View style={styles.cycleDayBlock}>
                  <Text style={styles.cycleDayLabel}>{t("dashboard.cycleDay")}</Text>
                  <Text style={styles.cycleDayValue}>
                    {cycleDay != null ? `Day ${cycleDay}` : "Day —"}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => navigateWithPond("/crop-details")}
                  style={({ pressed }) => [
                    styles.createCycleButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Create crop cycle"
                >
                  <Feather name="plus" size={14} color={colors.primaryDark} />
                  <Text style={styles.createCycleButtonText}>{t("dashboard.createCycle")}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.pondHeroBottom}>
              <Text style={styles.speciesText}>
                {t("dashboard.species", { species: formatSpeciesLine(cropCycle) })}
              </Text>
              {!hasActiveCycle ? (
                <Text style={styles.harvestValue}>{t("dashboard.noActiveCropCycle")}</Text>
              ) : null}
              <View style={styles.harvestBlock}>
                <Text style={styles.harvestLabel}>{t("dashboard.harvestWindow")}</Text>
                <Text style={styles.harvestValue}>
                  {getHarvestWindowLabel(cropCycle)}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${getHarvestProgress(cropCycle) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>

          {cropCycle?.id && feedScheduleError && !hasFeedSetup ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>{t("dashboard.feedRecommendation")}</Text>
              <Text style={styles.emptyInfoTitle}>{t("dashboard.noFeedingSchedule")}</Text>
              <Text style={styles.emptyInfoBody}>{feedScheduleError}</Text>
            </View>
          ) : null}

          {cropCycle?.id && !hasFeedSetup && !feedScheduleError ? (
            <View style={[styles.setupCard, styles.feedSetupCard]}>
              <View style={[styles.setupIcon, styles.feedIcon]}>
                <Feather name="coffee" size={18} color={colors.primaryDark} />
              </View>
              <Text style={styles.setupTitle}>{t("dashboard.feedManagementRequired")}</Text>
              <Text style={styles.setupBody}>{t("dashboard.feedManagementBody")}</Text>
              <Pressable
                onPress={() => navigateWithPond("/feed-management")}
                style={[styles.setupButton, styles.feedButton]}
              >
                <Text style={styles.feedButtonText}>{t("dashboard.exploreFeedManagement")}</Text>
              </Pressable>
            </View>
          ) : null}

          {cropCycle?.id && hasFeedSetup && feedSchedule ? (
            <View style={styles.feedCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t("dashboard.feedRecommendation")}</Text>
                <Pressable
                  onPress={() => navigateWithPond("/feed-management")}
                  style={styles.feedScheduleLink}
                >
                  <Text style={styles.sectionLink}>{t("common.viewSchedule")}</Text>
                  <Feather name="chevron-right" size={14} color={colors.primary} />
                </Pressable>
              </View>

              <View style={styles.feedHeroRow}>
                <View style={styles.feedHeroCopy}>
                  <Text style={styles.feedHeroLabel}>{t("dashboard.recommendedFeed")}</Text>
                  <View style={styles.feedHeroValueRow}>
                    <Text style={styles.feedHeroValue}>
                      {feedSchedule.recommendedDailyKg}
                    </Text>
                    <Text style={styles.feedHeroUnit}>{t("dashboard.kgPerDay")}</Text>
                  </View>
                </View>
                <View style={styles.feedHeroIcon}>
                  <Feather name="package" size={18} color={colors.primary} />
                </View>
              </View>

              <View style={styles.feedDivider} />

              <View style={styles.feedMetricsRow}>
                <View style={styles.feedMetricBlock}>
                  <Text style={styles.feedMetricLabel}>{t("dashboard.feedsPerDay")}</Text>
                  <Text style={styles.feedMetricValue}>
                    {t("dashboard.times", { count: feedSchedule.feedsPerDay })}
                  </Text>
                </View>
                <View style={styles.feedMetricBlock}>
                  <Text style={styles.feedMetricLabel}>{t("dashboard.perFeedQuantity")}</Text>
                  <Text style={styles.feedMetricValue}>
                    {feedSchedule.perFeedQty} kg
                  </Text>
                </View>
              </View>

              <View style={styles.feedTimesSection}>
                <Text style={styles.feedMetricLabel}>{t("dashboard.feedTimes")}</Text>
                <View style={styles.feedTimesRow}>
                  {feedSchedule.feedTimes.map((time) => {
                    const isNext = time === feedSchedule.nextFeedRaw;

                    return (
                      <View
                        key={time}
                        style={[
                          styles.feedTimeChip,
                          isNext && styles.feedTimeChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.feedTimeChipText,
                            isNext && styles.feedTimeChipTextActive,
                          ]}
                        >
                          {formatFeedTimeDisplay(time)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.nextFeedBanner}>
                <View style={styles.nextFeedBannerLeft}>
                  <Feather name="clock" size={14} color={colors.primary} />
                  <Text style={styles.nextFeedBannerText}>
                    {t("dashboard.nextFeedAt", { time: feedSchedule.nextFeedTime })}
                  </Text>
                </View>
                <View style={styles.nextFeedBadge}>
                  <Text style={styles.nextFeedBadgeText}>
                    {feedSchedule.nextFeedQty}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {cropCycle?.id && !hasPriceConfig ? (
            <View style={styles.setupCard}>
              <View style={styles.setupIcon}>
                <Feather name="dollar-sign" size={18} color={colors.primary} />
              </View>
              <Text style={styles.setupTitle}>{t("dashboard.expenseSetupRequired")}</Text>
              <Text style={styles.setupBody}>{t("dashboard.expenseSetupBody")}</Text>
              <Pressable
                onPress={() => navigateWithPond("/expense-setup")}
                style={styles.setupButton}
              >
                <Text style={styles.setupButtonText}>{t("common.setupExpenses")}</Text>
              </Pressable>
            </View>
          ) : null}

          {cropCycle?.id && hasPriceConfig ? (
            <View style={styles.runningCostCard}>
              <View style={styles.runningCostHeader}>
                <Pressable
                  onPress={() => navigateWithPond("/expense-details")}
                  style={styles.runningCostMainPressable}
                >
                  <View style={styles.runningCostIcon}>
                    <Feather name="dollar-sign" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.runningCostCopy}>
                    <Text style={styles.runningCostLabel}>{t("dashboard.runningCost")}</Text>
                    <Text style={styles.runningCostValue}>
                      ₹ {(cycleExpenses?.total_cost ?? 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
                <Pressable
                  onPress={() => navigateWithPond("/expense-setup")}
                  style={styles.editPriceButton}
                  accessibilityRole="button"
                  accessibilityLabel="Edit price configuration"
                >
                  <Feather name="edit-2" size={16} color={colors.primary} />
                </Pressable>
              </View>
              <Pressable onPress={() => navigateWithPond("/expense-details")}>
                <View style={styles.runningCostMetaRow}>
                  <Text style={styles.runningCostMeta}>
                    {t("dashboard.costPerKg", {
                      value:
                        cycleExpenses?.cost_per_kg != null
                          ? `₹ ${cycleExpenses.cost_per_kg.toFixed(2)}`
                          : "—",
                    })}
                  </Text>
                  <Text style={styles.runningCostMeta}>
                    {formatExpenseUpdatedAt(cycleExpenses?.computed_at)}
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {showDataSourceSelection ? (
            <>
              <Text style={styles.sectionEyebrow}>{t("dashboard.dataSourceSelection")}</Text>
              <View style={styles.sourceRow}>
                <View style={styles.sourceCard}>
                  <Feather name="radio" size={22} color={colors.primary} />
                  <Text style={styles.sourceTitle}>{t("dashboard.importFromIot")}</Text>
                  <Pressable onPress={handleSelectIot} style={styles.sourceButton}>
                    <Text style={styles.sourceButtonText}>{t("common.connect")}</Text>
                  </Pressable>
                </View>

                <Pressable onPress={handleSelectManual} style={styles.sourceCard}>
                  <Feather name="edit-3" size={22} color={colors.primary} />
                  <Text style={styles.sourceTitle}>{t("common.manualEntry")}</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {showDashboardSections && hasLogs && hasActiveCycle ? (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t("dashboard.waterVitals")}</Text>
                  <Pressable onPress={() => navigateWithPond("/pond-trends")}>
                    <Text style={styles.sectionLink}>{t("dashboard.viewLiveTrend")}</Text>
                  </Pressable>
                </View>
                <Text style={styles.lastUpdatedText}>
                  {t("dashboard.lastUpdated", { value: lastUpdatedLabel })}
                </Text>

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
                <Text style={styles.sectionTitle}>{t("dashboard.growthBiomass")}</Text>
                <View style={styles.growthGrid}>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>Total Biomass</Text>
                    <Text style={[styles.growthValue, { color: biomassColor }]}>
                      {biomassValue}
                    </Text>
                    {abwStale ? (
                      <Text style={styles.growthHint}>ABW update overdue</Text>
                    ) : null}
                  </View>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>ABW</Text>
                    <Text
                      style={[
                        styles.growthValue,
                        abwStale ? { color: colors.warning } : null,
                      ]}
                    >
                      {latestAbw}
                    </Text>
                    <Text style={styles.growthHint}>
                      Updated {abwUpdatedLabel}
                    </Text>
                  </View>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>Survival</Text>
                    <Text style={[styles.growthValue, { color: survivalColor }]}>
                      {survivalRate}
                    </Text>
                    <Text style={styles.growthHint}>Target &gt;85%</Text>
                  </View>
                  <View style={styles.growthItem}>
                    <Text style={styles.growthLabel}>FCR</Text>
                    <Text style={[styles.growthValue, { color: fcrColor }]}>
                      {fcrValue}
                    </Text>
                    <Text style={styles.growthHint}>
                      Feed: {latestFeedQty}
                    </Text>
                  </View>
                </View>
                <View style={styles.growthFooter}>
                  <Text style={styles.growthFooterText}>
                    Feed Brand: {latestFeedBrand}
                  </Text>
                  <Text style={styles.growthFooterText}>
                    Mortality:{" "}
                    <Text style={{ color: mortalityColor }}>{latestMortality}</Text>
                    {" · "}Treatment: {latestTreatment}
                  </Text>
                </View>
              </View>

              <View style={styles.logProgressCard}>
                <Pressable onPress={handleLogToday} style={styles.logTodayButton}>
                  <Feather name="plus" size={16} color={colors.white} />
                  <Text style={styles.logTodayButtonText}>{t("dashboard.logTodayData")}</Text>
                </Pressable>
                <View style={styles.logProgressMeta}>
                  <Text style={styles.logProgressLast}>
                    Last: {lastUpdatedLabel}
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
          ) : !hasLogs ? (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{t("dashboard.waterVitals")}</Text>
                <Text style={styles.emptyInfoTitle}>{t("dashboard.noPondLog")}</Text>
                <Text style={styles.emptyInfoBody}>{t("dashboard.logRequired")}</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>{t("dashboard.growthBiomass")}</Text>
                <View style={styles.placeholderImage}>
                  <Feather name="image" size={28} color={colors.muted} />
                </View>
                <Text style={styles.emptyInfoTitle}>{t("dashboard.noPondLog")}</Text>
                <Text style={styles.emptyInfoBody}>{t("dashboard.firstSamplingHint")}</Text>
              </View>
            </>
          ) : null}
        </ScrollView>

        {showDashboardSections && hasActiveCycle ? (
          <Pressable
            onPress={handleLogToday}
            style={styles.fab}
            accessibilityRole="button"
          >
            <Feather name="edit-3" size={16} color={colors.white} />
            <Text style={styles.fabText}>{t("dashboard.logTodayShort")}</Text>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.92,
  },
  runningCostCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  runningCostHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  runningCostMainPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  runningCostIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  runningCostCopy: {
    flex: 1,
    gap: 4,
  },
  runningCostLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  runningCostValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  runningCostMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  runningCostMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  editPriceButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.softBlue,
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
  loadingState: {
    paddingVertical: 24,
    alignItems: "center",
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
  inactiveDot: {
    backgroundColor: "rgba(255,255,255,0.45)",
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
  createCycleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  createCycleButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
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
  feedSetupCard: {
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
  lastUpdatedText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: -4,
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
  feedCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  feedScheduleLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  feedHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  feedHeroCopy: {
    flex: 1,
    gap: 4,
  },
  feedHeroLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  feedHeroValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  feedHeroValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36,
  },
  feedHeroUnit: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  feedHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  feedDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  feedMetricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  feedMetricBlock: {
    flex: 1,
    gap: 4,
  },
  feedMetricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  feedMetricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  feedTimesSection: {
    gap: 8,
  },
  feedTimesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedTimeChip: {
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedTimeChipActive: {
    backgroundColor: colors.softBlue,
    borderColor: "#BFDBFE",
  },
  feedTimeChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  feedTimeChipTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  nextFeedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.softBlue,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  nextFeedBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  nextFeedBannerText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  nextFeedBadge: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextFeedBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
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
