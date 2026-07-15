import { formatHarvestWindowRange } from "../lib/harvest-window";
import { isAbwStale } from "../lib/cycle-metrics";
import {
  getOverallWaterQuality,
} from "../lib/water-quality";
import {
  getCycleDayFromRecord,
  getLatestCropCyclesForPonds,
  type CropCycleRecord,
} from "./cropCycle";
import { getLatestAbwLogsForPonds, getLatestLogSummariesForPonds } from "./dailyLogs";
import { getSupabasePonds, getPondSetupTimestamp, mapSupabasePondName, sortPondsBySetupDateDesc } from "./pond";

export type PondCycleStatus = "active" | "closed" | "none";

export type MyPondDashboardItem = {
  id: string;
  pondName: string;
  area: string;
  depth: string;
  species: string;
  cycleDay: string;
  biomass: string;
  survivalRate: string;
  harvestWindowStart: string;
  harvestWindowEnd: string;
  cycleStatus: PondCycleStatus;
  waterLogStatus: "Logged Today" | "Pending Log";
  waterQualityStatus: string;
  lastLogTime: string;
  archived: boolean;
  createdAt: string;
  abwStale: boolean;
  survivalRateNumeric: number | null;
};

const formatBiomass = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  return `${value.toLocaleString("en-US")} kg`;
};

const formatSurvival = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  return String(value);
};

export const getPondCycleStatus = (
  latestCycle: CropCycleRecord | null | undefined,
): PondCycleStatus => {
  if (!latestCycle) {
    return "none";
  }

  if (latestCycle.status === "active") {
    return "active";
  }

  return "closed";
};

export const getCycleStatusLabel = (status: PondCycleStatus) => {
  if (status === "active") {
    return "Active";
  }

  if (status === "closed") {
    return "Closed";
  }

  return "No Cycle";
};

export const formatDashboardLastLog = (observedAt: string | null | undefined) => {
  if (!observedAt) {
    return "No log today";
  }

  const date = new Date(observedAt);
  if (!Number.isFinite(date.getTime())) {
    return "No log today";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const deriveWaterQualityStatus = (
  log:
    | {
        dissolvedOxygen: number | null;
        ph: number | null;
        ammonia: number | null;
        temperature: number | null;
        salinity: number | null;
      }
    | null
    | undefined,
) => {
  if (!log) {
    return "Not logged";
  }

  const quality = getOverallWaterQuality({
    do: log.dissolvedOxygen,
    ph: log.ph,
    ammonia: log.ammonia,
    temperature: log.temperature,
    salinity: log.salinity,
  });

  if (quality === "Good") {
    return "Excellent";
  }

  if (quality === "Not logged") {
    return "Not logged";
  }

  return quality;
};

export async function fetchMyPondsDashboard(): Promise<MyPondDashboardItem[]> {
  const { data: ponds, error: pondsError } = await getSupabasePonds();

  if (pondsError) {
    throw new Error(pondsError.message ?? "Unable to load ponds.");
  }

  const sortedPonds = sortPondsBySetupDateDesc(ponds ?? []);

  const pondIds = sortedPonds.map((pond) => pond.id);

  const [latestCycles, logSummaries, latestAbwByPond] = await Promise.all([
    getLatestCropCyclesForPonds(pondIds),
    getLatestLogSummariesForPonds(pondIds),
    getLatestAbwLogsForPonds(pondIds),
  ]);

  console.log("[pondsDashboardService] latest cycles:", Object.fromEntries(latestCycles));
  console.log("[pondsDashboardService] log summaries:", Object.fromEntries(logSummaries));

  return [...sortedPonds.map((pond) => {
      const latestCycle = latestCycles.get(pond.id) ?? null;
      const logSummary = logSummaries.get(pond.id);
      const cycleStatus = getPondCycleStatus(latestCycle);
      const cycleDay = getCycleDayFromRecord(latestCycle);

      return {
        id: pond.id,
        pondName: mapSupabasePondName(pond),
        area: String(pond.area_acres ?? ""),
        depth: String(pond.depth_ft ?? ""),
        species: latestCycle?.species ?? "",
        cycleDay: cycleDay != null ? String(cycleDay) : "—",
        biomass: formatBiomass(latestCycle?.current_biomass_kg),
        survivalRate: formatSurvival(latestCycle?.survival_rate),
        harvestWindowStart: latestCycle?.harvest_window_start ?? "",
        harvestWindowEnd: latestCycle?.harvest_window_end ?? "",
        cycleStatus,
        waterLogStatus: logSummary?.hasLogToday ? "Logged Today" : "Pending Log",
        waterQualityStatus: deriveWaterQualityStatus(logSummary?.latestLog),
        lastLogTime: formatDashboardLastLog(logSummary?.latestObservedAt),
        archived: !!pond.archived,
        createdAt: pond.created_at ?? pond.updated_at ?? "",
        abwStale: isAbwStale(latestAbwByPond.get(pond.id) ?? null),
        survivalRateNumeric: latestCycle?.survival_rate ?? null,
      };
    })].sort(
    (left, right) =>
      getPondSetupTimestamp({ created_at: right.createdAt }) -
      getPondSetupTimestamp({ created_at: left.createdAt }),
  );
}

export const getHarvestRangeLabel = (pond: MyPondDashboardItem) =>
  formatHarvestWindowRange(pond.harvestWindowStart, pond.harvestWindowEnd);
