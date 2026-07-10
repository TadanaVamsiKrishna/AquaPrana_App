import { supabase } from "../lib/supabase";
import { getLogsForPond, type DailyLogEntry } from "./local-daily-logs";

export type PondTrendPoint = {
  id: string;
  observedAt: string;
  dissolvedOxygen: number | null;
  ph: number | null;
  temperature: number | null;
  salinity: number | null;
  ammonia: number | null;
  calcium: number | null;
  magnesium: number | null;
  potassium: number | null;
};

export type TrendTimeframe = "7D" | "14D" | "30D";

const TIMEFRAME_DAYS: Record<TrendTimeframe, number> = {
  "7D": 7,
  "14D": 14,
  "30D": 30,
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fromLocalLog = (log: DailyLogEntry): PondTrendPoint => ({
  id: `local-${log.id}`,
  observedAt: log.observedAt,
  dissolvedOxygen: toNumber(log.dissolvedOxygen),
  ph: toNumber(log.ph),
  temperature: toNumber(log.temperature),
  salinity: toNumber(log.salinity),
  ammonia: toNumber(log.ammonia),
  calcium: toNumber(log.calcium),
  magnesium: toNumber(log.magnesium),
  potassium: toNumber(log.potassium),
});

const fromRemoteLog = (log: Record<string, unknown>): PondTrendPoint | null => {
  const observedAt =
    (typeof log.observed_at === "string" && log.observed_at) ||
    (typeof log.created_at === "string" && log.created_at) ||
    null;

  if (!observedAt) {
    return null;
  }

  const id = typeof log.id === "string" ? log.id : `remote-${observedAt}`;

  return {
    id: `remote-${id}`,
    observedAt,
    dissolvedOxygen: toNumber(log.do_mgl ?? log.dissolved_oxygen ?? log.do),
    ph: toNumber(log.ph),
    temperature: toNumber(log.temp_c ?? log.temperature),
    salinity: toNumber(log.salinity_ppt ?? log.salinity),
    ammonia: toNumber(log.ammonia_mgl ?? log.ammonia),
    calcium: toNumber(log.calcium_mgl ?? log.calcium),
    magnesium: toNumber(log.magnesium_mgl ?? log.magnesium),
    potassium: toNumber(log.potassium_mgl ?? log.potassium),
  };
};

const mergeTrendPoints = (
  remote: PondTrendPoint[],
  local: PondTrendPoint[],
): PondTrendPoint[] => {
  const byKey = new Map<string, PondTrendPoint>();

  for (const point of [...remote, ...local]) {
    const key = `${new Date(point.observedAt).getTime()}-${point.dissolvedOxygen ?? ""}-${point.ph ?? ""}-${point.ammonia ?? ""}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, point);
      continue;
    }

    byKey.set(key, {
      ...existing,
      dissolvedOxygen: existing.dissolvedOxygen ?? point.dissolvedOxygen,
      ph: existing.ph ?? point.ph,
      temperature: existing.temperature ?? point.temperature,
      salinity: existing.salinity ?? point.salinity,
      ammonia: existing.ammonia ?? point.ammonia,
      calcium: existing.calcium ?? point.calcium,
      magnesium: existing.magnesium ?? point.magnesium,
      potassium: existing.potassium ?? point.potassium,
    });
  }

  return Array.from(byKey.values()).sort(
    (left, right) =>
      new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime(),
  );
};

export const getTimeframeStart = (timeframe: TrendTimeframe, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (TIMEFRAME_DAYS[timeframe] - 1));
  return start;
};

export const filterPointsByTimeframe = (
  points: PondTrendPoint[],
  timeframe: TrendTimeframe,
  now = new Date(),
) => {
  const start = getTimeframeStart(timeframe, now).getTime();
  const end = now.getTime();

  return points.filter((point) => {
    const time = new Date(point.observedAt).getTime();
    return Number.isFinite(time) && time >= start && time <= end;
  });
};

export const fetchRemotePondLogs = async (
  pondId: string,
): Promise<PondTrendPoint[]> => {
  try {
    const { data, error } = await supabase
      .from("pond_logs")
      .select("*")
      .eq("pond_id", pondId)
      .order("observed_at", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data
      .map((row) => fromRemoteLog(row as Record<string, unknown>))
      .filter((point): point is PondTrendPoint => point !== null);
  } catch {
    return [];
  }
};

export const getTrendPointsForPond = async (
  pondId: string,
  timeframe: TrendTimeframe,
): Promise<PondTrendPoint[]> => {
  const [remote, localLogs] = await Promise.all([
    fetchRemotePondLogs(pondId),
    getLogsForPond(pondId),
  ]);

  const merged = mergeTrendPoints(
    remote,
    localLogs.map(fromLocalLog),
  );

  return filterPointsByTimeframe(merged, timeframe);
};
