import { supabase } from "../lib/supabase";
import { getCycleDayFromRecord, getCropCycleById } from "./cropCycle";
import { getPriceConfigByCycleId } from "./priceConfigService";

export type CycleExpenseRecord = {
  id: string;
  cycle_id: string;
  feed_cost: number;
  seed_cost: number;
  treatment_cost: number;
  labour_cost: number;
  other_cost: number;
  total_cost: number;
  cost_per_kg: number | null;
  computed_at: string | null;
  updated_at: string | null;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const mapCycleExpenseRow = (row: Record<string, unknown>): CycleExpenseRecord => ({
  id: String(row.id),
  cycle_id: String(row.cycle_id),
  feed_cost: Number(row.feed_cost) || 0,
  seed_cost: Number(row.seed_cost) || 0,
  treatment_cost: Number(row.treatment_cost) || 0,
  labour_cost: Number(row.labour_cost) || 0,
  other_cost: Number(row.other_cost) || 0,
  total_cost: Number(row.total_cost) || 0,
  cost_per_kg: row.cost_per_kg != null ? Number(row.cost_per_kg) : null,
  computed_at: row.computed_at ? String(row.computed_at) : null,
  updated_at: row.updated_at ? String(row.updated_at) : null,
});

export const calculateCycleExpenseTotals = ({
  feedKg,
  stockedCount,
  cycleDays,
  biomassKg,
  feedPricePerKg,
  seedPricePerThousand,
  labourCostPerDay,
  treatmentPrices,
  otherExpenses,
}: {
  feedKg: number;
  stockedCount: number;
  cycleDays: number;
  biomassKg: number;
  feedPricePerKg: number;
  seedPricePerThousand: number;
  labourCostPerDay: number;
  treatmentPrices: { price: number }[];
  otherExpenses: { amount: number }[];
}) => {
  const feedCost = roundCurrency(feedKg * feedPricePerKg);
  const seedCost = roundCurrency((stockedCount / 1000) * seedPricePerThousand);
  const labourCost = roundCurrency(cycleDays * labourCostPerDay);
  const treatmentCost = roundCurrency(
    treatmentPrices.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
  );
  const otherCost = roundCurrency(
    otherExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  );
  const totalCost = roundCurrency(
    feedCost + seedCost + labourCost + treatmentCost + otherCost,
  );
  const costPerKg =
    biomassKg > 0 ? roundCurrency(totalCost / biomassKg) : null;

  return {
    feed_cost: feedCost,
    seed_cost: seedCost,
    treatment_cost: treatmentCost,
    labour_cost: labourCost,
    other_cost: otherCost,
    total_cost: totalCost,
    cost_per_kg: costPerKg,
  };
};

async function getTotalFeedKgForCycle(cycleId: string) {
  const { data, error } = await supabase
    .from("pond_logs")
    .select("feed_qty_kg")
    .eq("cycle_id", cycleId);

  if (error) throw error;

  return (data ?? []).reduce(
    (sum, row) => sum + (Number(row.feed_qty_kg) || 0),
    0,
  );
}

export async function recalculateCycleExpenses(cycleId: string) {
  const [priceConfig, cycle] = await Promise.all([
    getPriceConfigByCycleId(cycleId),
    getCropCycleById(cycleId),
  ]);

  if (!priceConfig || !cycle) {
    return null;
  }

  const feedKg =
    cycle.total_feed_used_kg != null && cycle.total_feed_used_kg > 0
      ? cycle.total_feed_used_kg
      : await getTotalFeedKgForCycle(cycleId);

  const totals = calculateCycleExpenseTotals({
    feedKg,
    stockedCount: cycle.stocking_density ?? 0,
    cycleDays: getCycleDayFromRecord(cycle) ?? 1,
    biomassKg: cycle.current_biomass_kg ?? 0,
    feedPricePerKg: priceConfig.feed_price_per_kg ?? 0,
    seedPricePerThousand: priceConfig.seed_price_per_1000 ?? 0,
    labourCostPerDay: priceConfig.labour_cost_per_day ?? 0,
    treatmentPrices: priceConfig.treatment_prices,
    otherExpenses: priceConfig.other_expenses,
  });

  const payload = {
    cycle_id: cycleId,
    ...totals,
    computed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("cycle_expenses")
    .upsert(payload, { onConflict: "cycle_id" })
    .select()
    .single();

  if (error) throw error;
  return mapCycleExpenseRow(data as Record<string, unknown>);
}

export async function getCycleExpensesByCycleId(cycleId: string) {
  const { data, error } = await supabase
    .from("cycle_expenses")
    .select("*")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapCycleExpenseRow(data as Record<string, unknown>) : null;
}

export const formatExpenseUpdatedAt = (value: string | null | undefined) => {
  if (!value) {
    return "Not updated yet";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Not updated yet";
  }

  return date.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
