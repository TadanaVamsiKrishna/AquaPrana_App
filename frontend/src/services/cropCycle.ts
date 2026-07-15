import { supabase } from "@/lib/supabase";
import {
  calculateCycleMetrics,
  type CycleLogRow,
} from "../lib/cycle-metrics";
import { formatIsoDateForDisplay } from "../lib/harvest-window";
import { calculateCycleDay } from "./local-ponds";

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

const toIsoDate = (date: Date) => date.toISOString().split("T")[0];

export const getCycleDayFromRecord = (cycle: CropCycleRecord | null) => {
  if (!cycle?.stocking_date) {
    return null;
  }

  if (cycle.days_of_culture != null && Number.isFinite(cycle.days_of_culture)) {
    return Math.max(1, cycle.days_of_culture);
  }

  return calculateCycleDay(new Date(`${cycle.stocking_date}T00:00:00`));
};

export const formatCycleFcr = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? String(value) : "—";

export const formatCycleSurvival = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value}%`;
};

export const formatCycleStockingDate = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return "—";
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? formatIsoDateForDisplay(value)
    : value;
};

export const formatClosedCycleDateRange = (cycle: CropCycleRecord) => {
  const start = formatCycleStockingDate(cycle.stocking_date);
  const end = cycle.actual_harvest_date
    ? formatCycleStockingDate(cycle.actual_harvest_date)
    : cycle.closed_at
      ? formatCycleStockingDate(cycle.closed_at.split("T")[0])
      : "—";

  return `${start} - ${end}`;
};

export async function getCropCyclesForPond(pondId: string) {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("*")
    .eq("pond_id", pondId)
    .order("stocking_date", { ascending: false });

  console.log("[cropCycle] fetched cycles:", data);
  console.log("[cropCycle] fetch error:", error);

  if (error) throw error;
  return (data ?? []) as CropCycleRecord[];
}

export async function getLatestCropCyclesForPonds(pondIds: string[]) {
  if (pondIds.length === 0) {
    return new Map<string, CropCycleRecord>();
  }

  const { data, error } = await supabase
    .from("crop_cycles")
    .select("*")
    .in("pond_id", pondIds)
    .order("stocking_date", { ascending: false });

  console.log("[cropCycle] latest cycles for ponds:", data?.length ?? 0);
  console.log("[cropCycle] latest cycles error:", error);

  if (error) throw error;

  const latestByPond = new Map<string, CropCycleRecord>();

  for (const cycle of (data ?? []) as CropCycleRecord[]) {
    const existing = latestByPond.get(cycle.pond_id);

    if (!existing) {
      latestByPond.set(cycle.pond_id, cycle);
      continue;
    }

    if (cycle.status === "active" && existing.status !== "active") {
      latestByPond.set(cycle.pond_id, cycle);
    }
  }

  return latestByPond;
}

export async function getActiveCropCycleForPond(pondId: string) {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("*")
    .eq("pond_id", pondId)
    .eq("status", "active")
    .order("stocking_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("[cropCycle] active cycle:", data);
  console.log("[cropCycle] active cycle error:", error);

  if (error) throw error;
  return (data as CropCycleRecord | null) ?? null;
}

export async function closeCropCycle(
  cycleId: string,
  data: {
    outcome: string;
    actualHarvestDate: Date;
    harvestWeightKg: number;
    notes?: string;
  },
) {
  const payload = {
    outcome: data.outcome,
    actual_harvest_date: toIsoDate(data.actualHarvestDate),
    harvest_weight_kg: data.harvestWeightKg,
    status: "closed",
    closed_at: new Date().toISOString(),
    notes: data.notes?.trim() || null,
  };

  console.log("[cropCycle] closing cycle:", cycleId, payload);

  const { data: result, error } = await supabase
    .from("crop_cycles")
    .update(payload)
    .eq("id", cycleId)
    .select()
    .single();

  console.log("[cropCycle] closed cycle:", result);
  console.log("[cropCycle] close error:", error);

  if (error) throw error;
  return result as CropCycleRecord;
}

export async function getCropCycleById(cycleId: string) {
  const { data, error } = await supabase
    .from("crop_cycles")
    .select("*")
    .eq("id", cycleId)
    .maybeSingle();

  if (error) throw error;
  return (data as CropCycleRecord | null) ?? null;
}

export async function getCropCycleForPond(pondId: string) {
  const { data: activeCycle, error: activeError } = await supabase
    .from("crop_cycles")
    .select("id")
    .eq("pond_id", pondId)
    .eq("status", "active")
    .order("stocking_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) throw activeError;
  if (activeCycle) return activeCycle;

  const { data: latestCycle, error: latestError } = await supabase
    .from("crop_cycles")
    .select("id")
    .eq("pond_id", pondId)
    .order("stocking_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  return latestCycle;
}

export type ActiveCropCycle = {
  pond_id: string;
  species: string;
  stocking_date: string;
  harvest_window_start: string | null;
  harvest_window_end: string | null;
  current_biomass_kg: number | null;
  survival_rate: number | null;
  days_of_culture: number | null;
};

export async function getActiveCropCyclesForPonds(pondIds: string[]) {
  if (pondIds.length === 0) {
    return [] as ActiveCropCycle[];
  }

  const { data, error } = await supabase
    .from("crop_cycles")
    .select(
      "pond_id, species, stocking_date, harvest_window_start, harvest_window_end, current_biomass_kg, survival_rate, days_of_culture",
    )
    .in("pond_id", pondIds)
    .eq("status", "active");

  console.log("[getActiveCropCyclesForPonds] fetched cycles:", data);
  console.log("[getActiveCropCyclesForPonds] fetch error:", error);

  if (error) throw error;

  return (data ?? []) as ActiveCropCycle[];
}

export async function recalculateCropCycleMetrics(cycleId: string) {
  const cycle = await getCropCycleById(cycleId);

  if (!cycle || cycle.status !== "active") {
    return null;
  }

  const { data: logs, error: logsError } = await supabase
    .from("pond_logs")
    .select("observed_at, feed_qty_kg, mortality_count, abw_g")
    .eq("cycle_id", cycleId)
    .order("observed_at", { ascending: true });

  if (logsError) {
    throw logsError;
  }

  const metrics = calculateCycleMetrics(
    {
      stocking_density: cycle.stocking_density,
      stocking_date: cycle.stocking_date,
    },
    (logs ?? []) as CycleLogRow[],
  );

  const payload = {
    current_abw_g: metrics.current_abw_g,
    current_biomass_kg: metrics.current_biomass_kg,
    survival_rate: metrics.survival_rate,
    total_feed_used_kg: metrics.total_feed_used_kg,
    estimated_fcr: metrics.estimated_fcr,
    current_feed_per_day_kg: metrics.current_feed_per_day_kg,
    last_water_test_date: metrics.last_water_test_date,
    days_of_culture: metrics.days_of_culture,
  };

  console.log("[cropCycle] recalculating metrics:", cycleId, payload);

  const { data, error } = await supabase
    .from("crop_cycles")
    .update(payload)
    .eq("id", cycleId)
    .select()
    .single();

  console.log("[cropCycle] updated metrics:", data);
  console.log("[cropCycle] metrics update error:", error);

  if (error) throw error;
  return data as CropCycleRecord;
}

export async function createCropCycle(
  pondId: string,
  data: {
    category: string;
    species: string;
    stockingDensity: number;
    stockingDate: Date;
    seedSupplier?: string;
    harvestWindowStart: Date;
    harvestWindowEnd: Date;
  },
) {
  const payload = {
    pond_id: pondId,
    cycle_type: "new",
    category: data.category,
    species: data.species,
    stocking_density: data.stockingDensity,
    stocking_date: toIsoDate(data.stockingDate),
    seed_supplier: data.seedSupplier,
    harvest_window_start: toIsoDate(data.harvestWindowStart),
    harvest_window_end: toIsoDate(data.harvestWindowEnd),
    status: "active",
  };

  console.log("[createCropCycle] saving payload:", payload);

  const { data: result, error } = await supabase
    .from("crop_cycles")
    .insert(payload)
    .select()
    .single();

  console.log("[createCropCycle] saved cycle:", result);
  console.log("[createCropCycle] save error:", error);

  if (error) throw error;

  return result;
}