import {
  formatHarvestWindowRange,
  formatIsoDateForDisplay,
} from "../lib/harvest-window";
import { supabase } from "../lib/supabase";
import { getActiveCropCycleForPond } from "./cropCycle";
import {
  getLatestAbwLogForCycle,
  getTodayMortalityForCycle,
} from "./dailyLogs";
import { calculateCycleDay } from "./local-ponds";
import { getSupabasePondById } from "./pond";

export type CropCycleRecord = {
  id: string;
  pond_id: string;
  cycle_type: string;
  category: string;
  species: string;
  stocking_density: number;
  stocking_date: string;
  seed_supplier: string | null;
  days_of_culture: number | null;
  current_abw_g: number | null;
  current_biomass_kg: number | null;
  survival_rate: number | null;
  current_feed_per_day_kg: number | null;
  total_feed_used_kg: number | null;
  estimated_fcr: number | null;
  last_water_test_date: string | null;
  previous_harvest_weight: number | null;
  remarks: string | null;
  harvest_window_start: string | null;
  harvest_window_end: string | null;
  outcome: string | null;
  harvest_weight_kg: number | null;
  actual_harvest_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  closed_at: string | null;
};

export type DashboardPondLog = {
  id: string;
  pondId: string;
  observedAt: string;
  dissolvedOxygen: number | null;
  ph: number | null;
  temperature: number | null;
  salinity: number | null;
  ammonia: number | null;
  calcium: number | null;
  magnesium: number | null;
  potassium: number | null;
  feedQty: number | null;
  feedBrand: string | null;
  mortalityCount: number | null;
  abwG: number | null;
  treatment: string | null;
  notes: string | null;
};

export type PondLogTotals = {
  cumulativeFeed: number;
  mortality: number;
};

export type DashboardData = {
  pondId: string;
  pondName: string;
  cropCycle: CropCycleRecord | null;
  latestLog: DashboardPondLog | null;
  todayLogCount: number;
  logTotals: PondLogTotals;
  latestAbwObservedAt: string | null;
  todayMortality: number;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapPondLog = (log: Record<string, unknown>): DashboardPondLog => ({
  id: String(log.id),
  pondId: String(log.pond_id),
  observedAt: String(log.observed_at),
  dissolvedOxygen: toNumber(log.do_mgl ?? log.dissolved_oxygen ?? log.do),
  ph: toNumber(log.ph),
  temperature: toNumber(log.temp_c ?? log.temperature),
  salinity: toNumber(log.salinity_ppt ?? log.salinity),
  ammonia: toNumber(log.ammonia_mgl ?? log.ammonia),
  calcium: toNumber(log.calcium_mgl ?? log.calcium),
  magnesium: toNumber(log.magnesium_mgl ?? log.magnesium),
  potassium: toNumber(log.potassium_mgl ?? log.potassium),
  feedQty: toNumber(log.feed_qty_kg),
  feedBrand:
    typeof log.feed_brand === "string" && log.feed_brand.trim()
      ? log.feed_brand.trim()
      : null,
  mortalityCount: toNumber(log.mortality_count),
  abwG: toNumber(log.abw_g),
  treatment:
    typeof log.treatment === "string" && log.treatment.trim()
      ? log.treatment.trim()
      : null,
  notes:
    typeof log.notes === "string" && log.notes.trim() ? log.notes.trim() : null,
});

export const getExpectedHarvestDate = (cycle: CropCycleRecord | null) =>
  cycle?.harvest_window_end?.trim() || null;

export const getCycleDay = (cycle: CropCycleRecord | null) => {
  if (!cycle?.stocking_date) {
    return null;
  }

  if (cycle.days_of_culture != null && Number.isFinite(cycle.days_of_culture)) {
    return Math.max(1, cycle.days_of_culture);
  }

  return calculateCycleDay(new Date(`${cycle.stocking_date}T00:00:00`));
};

export const getHarvestWindowLabel = (cycle: CropCycleRecord | null) => {
  if (!cycle) {
    return "Harvest window pending";
  }

  return formatHarvestWindowRange(
    cycle.harvest_window_start,
    cycle.harvest_window_end,
  );
};

export const getHarvestProgress = (cycle: CropCycleRecord | null) => {
  if (!cycle?.stocking_date) {
    return 0.08;
  }

  const expectedHarvestDate = getExpectedHarvestDate(cycle);
  if (!expectedHarvestDate) {
    return 0.08;
  }

  const start = new Date(`${cycle.stocking_date}T00:00:00`).getTime();
  const end = new Date(`${expectedHarvestDate}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = today.getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0.08;
  }

  const ratio = (now - start) / (end - start);
  return Math.min(Math.max(ratio, 0.08), 1);
};

export const formatObservedAt = (observedAt: string | null | undefined) => {
  if (!observedAt) {
    return "—";
  }

  const date = new Date(observedAt);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatSpeciesLine = (cycle: CropCycleRecord | null) => {
  if (!cycle) {
    return "—";
  }

  const parts = [
    cycle.species?.trim(),
    cycle.category?.trim(),
    cycle.cycle_type?.trim(),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "—";
};

export async function getLatestCropCycleForPond(pondId: string) {
  const activeCycle = await getActiveCropCycleForPond(pondId);
  if (activeCycle) {
    return activeCycle;
  }

  const { data, error } = await supabase
    .from("crop_cycles")
    .select("*")
    .eq("pond_id", pondId)
    .order("stocking_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("[dashboardService] latest crop cycle:", data);
  console.log("[dashboardService] crop cycle error:", error);

  if (error) throw error;
  return (data as CropCycleRecord | null) ?? null;
}

export async function getLatestPondLogForPond(pondId: string) {
  const { data, error } = await supabase
    .from("pond_logs")
    .select("*")
    .eq("pond_id", pondId)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("[dashboardService] latest pond log:", data);
  console.log("[dashboardService] pond log error:", error);

  if (error) throw error;
  return data ? mapPondLog(data as Record<string, unknown>) : null;
}

export async function getTodayLogCountForPond(pondId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from("pond_logs")
    .select("id", { count: "exact", head: true })
    .eq("pond_id", pondId)
    .gte("observed_at", startOfDay.toISOString())
    .lte("observed_at", endOfDay.toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function getPondLogTotalsForPond(pondId: string) {
  const { data, error } = await supabase
    .from("pond_logs")
    .select("feed_qty_kg, mortality_count")
    .eq("pond_id", pondId);

  if (error) throw error;

  return (data ?? []).reduce<PondLogTotals>(
    (totals, log) => ({
      cumulativeFeed:
        totals.cumulativeFeed + (toNumber(log.feed_qty_kg) ?? 0),
      mortality: totals.mortality + (toNumber(log.mortality_count) ?? 0),
    }),
    { cumulativeFeed: 0, mortality: 0 },
  );
}

export async function fetchDashboardData(pondId: string): Promise<DashboardData> {
  const [pondRecord, cropCycle, latestLog, todayLogCount, logTotals] =
    await Promise.all([
      getSupabasePondById(pondId).catch(() => null),
      getLatestCropCycleForPond(pondId),
      getLatestPondLogForPond(pondId),
      getTodayLogCountForPond(pondId),
      getPondLogTotalsForPond(pondId),
    ]);

  const [latestAbwLog, todayMortality] = cropCycle
    ? await Promise.all([
        getLatestAbwLogForCycle(cropCycle.id),
        getTodayMortalityForCycle(cropCycle.id),
      ])
    : [null, 0];

  console.log("[dashboardService] dashboard payload:", {
    pondId,
    cropCycle,
    latestLog,
    todayLogCount,
    logTotals,
    latestAbwLog,
    todayMortality,
  });

  return {
    pondId,
    pondName: pondRecord?.name?.trim() || "Pond",
    cropCycle,
    latestLog,
    todayLogCount,
    logTotals,
    latestAbwObservedAt: latestAbwLog?.observed_at ?? null,
    todayMortality,
  };
}

export const formatDashboardHarvestMeta = (cycle: CropCycleRecord | null) => {
  const expectedHarvestDate = getExpectedHarvestDate(cycle);

  if (!cycle?.stocking_date || !expectedHarvestDate) {
    return null;
  }

  return `${formatIsoDateForDisplay(cycle.stocking_date)} → ${formatIsoDateForDisplay(expectedHarvestDate)}`;
};
