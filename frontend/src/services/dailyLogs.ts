import { supabase } from "../lib/supabase";
import { getCropCycleForPond, recalculateCropCycleMetrics } from "./cropCycle";
import { recalculateCycleExpenses } from "./cycleExpensesService";

export async function saveDailyLog(data: {
  pondId: string;
  observedAt: string;
  dissolvedOxygen: string;
  ph: string;
  temperature: string;
  salinity: string;
  ammonia: string;
  calcium: string;
  magnesium: string;
  potassium: string;
  feedQty: string;
  feedBrand: string;
  mortalityCount: string;
  abwSample: string;
  treatment: string;
  notes: string;
}) {
  const cycle = await getCropCycleForPond(data.pondId);

  if (!cycle) {
    throw new Error(
      "No crop cycle found for this pond. Please complete crop setup before saving a daily log.",
    );
  }

  // Insert the daily log

  const { data: result, error } = await supabase
    .from("pond_logs")
    .insert({
      pond_id: data.pondId,
      cycle_id: cycle.id,

      observed_at: data.observedAt,

      do_mgl: Number(data.dissolvedOxygen),
      ph: Number(data.ph),
      temp_c: Number(data.temperature),
      salinity_ppt: Number(data.salinity),
      ammonia_mgl: Number(data.ammonia),

      calcium_mgl: Number(data.calcium),
      magnesium_mgl: Number(data.magnesium),
      potassium_mgl: Number(data.potassium),

      feed_qty_kg: Number(data.feedQty),
      feed_brand: data.feedBrand,

      mortality_count: Number(data.mortalityCount),

      abw_g: Number(data.abwSample),

      treatment: data.treatment,

      notes: data.notes,

      param_source: "manual",
    })
    .select()
    .single();

  if (error) throw error;

  await recalculateCropCycleMetrics(cycle.id);
  await recalculateCycleExpenses(cycle.id).catch((error) => {
    console.log("[dailyLogs] cycle expense recalculation skipped:", error);
  });

  return result;
}

export async function getLatestAbwLogForCycle(cycleId: string) {
  const { data, error } = await supabase
    .from("pond_logs")
    .select("observed_at, abw_g")
    .eq("cycle_id", cycleId)
    .not("abw_g", "is", null)
    .gt("abw_g", 0)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as { observed_at: string; abw_g: number } | null;
}

export async function getLatestAbwLogsForPonds(pondIds: string[]) {
  if (pondIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("pond_logs")
    .select("pond_id, observed_at, abw_g")
    .in("pond_id", pondIds)
    .not("abw_g", "is", null)
    .gt("abw_g", 0)
    .order("observed_at", { ascending: false });

  if (error) throw error;

  const latestByPond = new Map<string, string>();

  for (const row of data ?? []) {
    const pondId = String(row.pond_id);
    if (!latestByPond.has(pondId)) {
      latestByPond.set(pondId, String(row.observed_at));
    }
  }

  return latestByPond;
}

export async function getTodayMortalityForCycle(cycleId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("pond_logs")
    .select("mortality_count")
    .eq("cycle_id", cycleId)
    .gte("observed_at", startOfDay.toISOString())
    .lte("observed_at", endOfDay.toISOString());

  if (error) throw error;

  return (data ?? []).reduce(
    (sum, log) => sum + (Number(log.mortality_count) || 0),
    0,
  );
}

export type DailyLogEntry = {
  id: string;
  pondId: string;
  cycleId?: string;
  observedAt: string;
  dissolvedOxygen: string;
  ph: string;
  temperature: string;
  salinity: string;
  ammonia: string;
  calcium: string;
  magnesium: string;
  potassium: string;
  feedQty: string;
  feedBrand: string;
  mortalityCount: string;
  abwSample: string;
  treatment: string;
  notes: string;
};

const mapPondLog = (log: Record<string, unknown>): DailyLogEntry => ({
  id: String(log.id),
  pondId: String(log.pond_id),
  cycleId: log.cycle_id ? String(log.cycle_id) : undefined,
  observedAt: String(log.observed_at),
  dissolvedOxygen: String(log.do_mgl ?? ""),
  ph: String(log.ph ?? ""),
  temperature: String(log.temp_c ?? ""),
  salinity: String(log.salinity_ppt ?? ""),
  ammonia: String(log.ammonia_mgl ?? ""),
  calcium: String(log.calcium_mgl ?? ""),
  magnesium: String(log.magnesium_mgl ?? ""),
  potassium: String(log.potassium_mgl ?? ""),
  feedQty: String(log.feed_qty_kg ?? ""),
  feedBrand: String(log.feed_brand ?? ""),
  mortalityCount: String(log.mortality_count ?? ""),
  abwSample: String(log.abw_g ?? ""),
  treatment: String(log.treatment ?? ""),
  notes: String(log.notes ?? ""),
});

export async function getLogsForPond(pondId: string) {
  const { data, error } = await supabase
    .from("pond_logs")
    .select("*")
    .eq("pond_id", pondId)
    .order("observed_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((log) => mapPondLog(log as Record<string, unknown>));
}

export async function getLogsForCycle(cycleId: string) {
  const { data, error } = await supabase
    .from("pond_logs")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("observed_at", { ascending: false });

  console.log("[dailyLogs] cycle logs:", data?.length ?? 0);
  console.log("[dailyLogs] cycle logs error:", error);

  if (error) throw error;

  return (data ?? []).map((log) => mapPondLog(log as Record<string, unknown>));
}

export type PondLogSummary = {
  latestObservedAt: string | null;
  hasLogToday: boolean;
  latestLog: {
    dissolvedOxygen: number | null;
    ph: number | null;
    ammonia: number | null;
    temperature: number | null;
    salinity: number | null;
  } | null;
};

const isSameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export async function getLatestLogSummariesForPonds(pondIds: string[]) {
  if (pondIds.length === 0) {
    return new Map<string, PondLogSummary>();
  }

  const { data, error } = await supabase
    .from("pond_logs")
    .select("pond_id, observed_at, do_mgl, ph, ammonia_mgl, temp_c, salinity_ppt")
    .in("pond_id", pondIds)
    .order("observed_at", { ascending: false });

  console.log("[dailyLogs] pond log summaries:", data?.length ?? 0);
  console.log("[dailyLogs] pond log summaries error:", error);

  if (error) throw error;

  const today = new Date();
  const summaries = new Map<string, PondLogSummary>();

  for (const row of data ?? []) {
    const pondId = String(row.pond_id);
    const observedAt = String(row.observed_at);
    const existing = summaries.get(pondId);
    const observedDate = new Date(observedAt);
    const hasLogToday =
      (existing?.hasLogToday ?? false) || isSameLocalDay(observedDate, today);

    if (existing) {
      summaries.set(pondId, {
        ...existing,
        hasLogToday,
      });
      continue;
    }

    summaries.set(pondId, {
      latestObservedAt: observedAt,
      hasLogToday,
      latestLog: {
        dissolvedOxygen:
          row.do_mgl != null && Number.isFinite(Number(row.do_mgl))
            ? Number(row.do_mgl)
            : null,
        ph: row.ph != null && Number.isFinite(Number(row.ph)) ? Number(row.ph) : null,
        ammonia:
          row.ammonia_mgl != null && Number.isFinite(Number(row.ammonia_mgl))
            ? Number(row.ammonia_mgl)
            : null,
        temperature:
          row.temp_c != null && Number.isFinite(Number(row.temp_c))
            ? Number(row.temp_c)
            : null,
        salinity:
          row.salinity_ppt != null && Number.isFinite(Number(row.salinity_ppt))
            ? Number(row.salinity_ppt)
            : null,
      },
    });
  }

  return summaries;
}

export async function pondHasLogs(pondId: string) {
  const { count, error } = await supabase
    .from("pond_logs")
    .select("id", { count: "exact", head: true })
    .eq("pond_id", pondId);

  if (error) throw error;
  return (count ?? 0) > 0;
}