import { supabase } from "../lib/supabase";

export type TreatmentPriceItem = {
  id: string;
  name: string;
  unit: string;
  price: number;
};

export type OtherExpenseItem = {
  id: string;
  title: string;
  note: string;
  amount: number;
};

export type PriceConfigRecord = {
  id: string;
  cycle_id: string;
  feed_price_per_kg: number | null;
  seed_price_per_1000: number | null;
  labour_cost_per_day: number | null;
  treatment_prices: TreatmentPriceItem[];
  other_expenses: OtherExpenseItem[];
  created_at: string | null;
  updated_at: string | null;
};

const parseTreatmentPrices = (value: unknown): TreatmentPriceItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? `${Date.now()}`),
        name: String(record.name ?? ""),
        unit: String(record.unit ?? "Unit"),
        price: Number(record.price) || 0,
      };
    })
    .filter(Boolean) as TreatmentPriceItem[];
};

const parseOtherExpenses = (value: unknown): OtherExpenseItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? `${Date.now()}`),
        title: String(record.title ?? ""),
        note: String(record.note ?? ""),
        amount: Number(record.amount) || 0,
      };
    })
    .filter(Boolean) as OtherExpenseItem[];
};

const mapPriceConfigRow = (row: Record<string, unknown>): PriceConfigRecord => ({
  id: String(row.id),
  cycle_id: String(row.cycle_id),
  feed_price_per_kg:
    row.feed_price_per_kg != null ? Number(row.feed_price_per_kg) : null,
  seed_price_per_1000:
    row.seed_price_per_1000 != null ? Number(row.seed_price_per_1000) : null,
  labour_cost_per_day:
    row.labour_cost_per_day != null ? Number(row.labour_cost_per_day) : null,
  treatment_prices: parseTreatmentPrices(row.treatment_prices),
  other_expenses: parseOtherExpenses(row.other_expenses),
  created_at: row.created_at ? String(row.created_at) : null,
  updated_at: row.updated_at ? String(row.updated_at) : null,
});

export async function getPriceConfigByCycleId(cycleId: string) {
  const { data, error } = await supabase
    .from("price_configs")
    .select("*")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPriceConfigRow(data as Record<string, unknown>) : null;
}

export async function upsertPriceConfig(
  cycleId: string,
  payload: {
    feedPricePerKg: number;
    seedPricePerThousand: number;
    labourCostPerDay: number;
    treatmentPrices: TreatmentPriceItem[];
    otherExpenses: OtherExpenseItem[];
  },
) {
  const row = {
    cycle_id: cycleId,
    feed_price_per_kg: payload.feedPricePerKg,
    seed_price_per_1000: payload.seedPricePerThousand,
    labour_cost_per_day: payload.labourCostPerDay,
    treatment_prices: payload.treatmentPrices,
    other_expenses: payload.otherExpenses,
  };

  const { data, error } = await supabase
    .from("price_configs")
    .upsert(row, { onConflict: "cycle_id" })
    .select()
    .single();

  if (error) throw error;
  return mapPriceConfigRow(data as Record<string, unknown>);
}

export const hasConfiguredPriceConfig = (config: PriceConfigRecord | null) =>
  !!config &&
  (config.feed_price_per_kg ?? 0) > 0 &&
  (config.seed_price_per_1000 != null ||
    config.labour_cost_per_day != null ||
    config.treatment_prices.length > 0 ||
    config.other_expenses.length > 0);
