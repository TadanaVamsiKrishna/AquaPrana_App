import { supabase } from "../lib/supabase";

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
    id,
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
  const { data, error } = await supabase
    .from("pond_logs")
    .select("*")
    .eq("pond_id", pondId)
    .order("observed_at", { ascending: true });

  console.log("[pond-logs] fetched trend logs:", data?.length ?? 0);
  console.log("[pond-logs] fetch error:", error);

  if (error) throw error;

  return (data ?? [])
    .map((row) => fromRemoteLog(row as Record<string, unknown>))
    .filter((point): point is PondTrendPoint => point !== null);
};

export const getTrendPointsForPond = async (
  pondId: string,
  timeframe: TrendTimeframe,
): Promise<PondTrendPoint[]> => {
  const remote = await fetchRemotePondLogs(pondId);
  return filterPointsByTimeframe(remote, timeframe);
};
