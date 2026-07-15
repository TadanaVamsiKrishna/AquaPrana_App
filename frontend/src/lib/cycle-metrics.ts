import { calculateCycleDay } from "../services/local-ponds";

export const ABW_STALE_DAYS = 7;

export type CycleLogRow = {
  observed_at: string;
  feed_qty_kg?: number | null;
  mortality_count?: number | null;
  abw_g?: number | null;
};

export type CycleMetricsInput = {
  stocking_density: number;
  stocking_date: string;
};

export type CalculatedCycleMetrics = {
  current_abw_g: number | null;
  current_biomass_kg: number | null;
  survival_rate: number | null;
  total_feed_used_kg: number | null;
  estimated_fcr: number | null;
  current_feed_per_day_kg: number | null;
  last_water_test_date: string | null;
  days_of_culture: number | null;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const sortLogsChronologically = (logs: CycleLogRow[]) =>
  [...logs].sort(
    (left, right) =>
      Date.parse(left.observed_at) - Date.parse(right.observed_at),
  );

export const calculateCycleMetrics = (
  cycle: CycleMetricsInput,
  logs: CycleLogRow[],
): CalculatedCycleMetrics => {
  const stockedCount = toNumber(cycle.stocking_density) ?? 0;
  const chronological = sortLogsChronologically(logs);
  const latestLog = chronological[chronological.length - 1] ?? null;

  const totalMortality = logs.reduce(
    (sum, log) => sum + (toNumber(log.mortality_count) ?? 0),
    0,
  );

  const totalFeedUsed = logs.reduce(
    (sum, log) => sum + (toNumber(log.feed_qty_kg) ?? 0),
    0,
  );

  const survivalRate =
    stockedCount > 0
      ? roundTo(((stockedCount - totalMortality) / stockedCount) * 100, 1)
      : null;

  const abwLogs = chronological.filter((log) => {
    const abw = toNumber(log.abw_g);
    return abw != null && abw > 0;
  });

  const latestAbw = abwLogs.length
    ? (toNumber(abwLogs[abwLogs.length - 1].abw_g) ?? null)
    : null;
  const firstAbw = abwLogs.length
    ? (toNumber(abwLogs[0].abw_g) ?? null)
    : null;

  const currentBiomassKg =
    stockedCount > 0 && latestAbw != null && survivalRate != null
      ? roundTo((stockedCount * latestAbw * survivalRate) / 1000, 1)
      : null;

  const initialBiomassKg =
    stockedCount > 0 && firstAbw != null
      ? roundTo((stockedCount * firstAbw) / 1000, 1)
      : null;

  const biomassGained =
    currentBiomassKg != null && initialBiomassKg != null
      ? Math.max(currentBiomassKg - initialBiomassKg, 0)
      : null;

  const estimatedFcr =
    biomassGained != null && biomassGained > 0 && totalFeedUsed > 0
      ? roundTo(totalFeedUsed / biomassGained, 2)
      : null;

  const latestFeedQty = latestLog ? toNumber(latestLog.feed_qty_kg) : null;

  const daysOfCulture = cycle.stocking_date
    ? calculateCycleDay(new Date(`${cycle.stocking_date}T00:00:00`))
    : null;

  return {
    current_abw_g: latestAbw,
    current_biomass_kg: currentBiomassKg,
    survival_rate: survivalRate,
    total_feed_used_kg: totalFeedUsed > 0 ? roundTo(totalFeedUsed, 2) : null,
    estimated_fcr: estimatedFcr,
    current_feed_per_day_kg:
      latestFeedQty != null && latestFeedQty > 0
        ? roundTo(latestFeedQty, 2)
        : null,
    last_water_test_date: latestLog?.observed_at ?? null,
    days_of_culture: daysOfCulture,
  };
};

export const getDaysSinceDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const diffMs = Date.now() - parsed;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const isAbwStale = (latestAbwObservedAt: string | null | undefined) => {
  const daysSince = getDaysSinceDate(latestAbwObservedAt);
  if (daysSince == null) {
    return true;
  }

  return daysSince > ABW_STALE_DAYS;
};

export const getAbwDisplayValue = (
  abwG: number | null | undefined,
  latestAbwObservedAt: string | null | undefined,
) => {
  if (abwG == null || !Number.isFinite(abwG)) {
    return "Update Needed";
  }

  if (isAbwStale(latestAbwObservedAt)) {
    return "Update Needed";
  }

  return `${abwG} g`;
};

export const getSurvivalColorFromRate = (rate: number | null | undefined) => {
  if (rate == null || !Number.isFinite(rate)) {
    return "#94A3B8";
  }

  if (rate > 85) {
    return "#16A34A";
  }

  if (rate >= 70) {
    return "#F59E0B";
  }

  return "#EF4444";
};

export const getFcrColor = (fcr: number | null | undefined) => {
  if (fcr == null || !Number.isFinite(fcr)) {
    return "#94A3B8";
  }

  if (fcr <= 1.4) {
    return "#16A34A";
  }

  if (fcr <= 1.8) {
    return "#F59E0B";
  }

  return "#EF4444";
};

export const isMortalityElevated = (
  todayMortality: number,
  stockedCount: number,
) => {
  if (stockedCount <= 0 || todayMortality <= 0) {
    return false;
  }

  const threshold = stockedCount * 0.005;
  return todayMortality > threshold;
};

export const sumTodayMortality = (
  logs: { observed_at: string; mortality_count?: number | null }[],
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return logs.reduce((sum, log) => {
    const observedAt = Date.parse(log.observed_at);
    if (!Number.isFinite(observedAt)) {
      return sum;
    }

    if (observedAt >= today.getTime() && observedAt < tomorrow.getTime()) {
      return sum + (toNumber(log.mortality_count) ?? 0);
    }

    return sum;
  }, 0);
};
