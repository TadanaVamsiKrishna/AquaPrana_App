import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  formatUnitPrice,
  parsePriceValue,
} from "../lib/expense-format";
import { supabase } from "../lib/supabase";
import type { FarmerPriceConfig } from "./farmer-price-config";
import {
  calculateExpenseTotals,
  calculateLineExpenseTotals,
  type ExpensePriceMode,
  type ManualExpense,
  type PondExpenseQuantities,
  type PondExpenseSummary,
  type PondPriceConfig,
  type TreatmentProduct,
} from "./local-pond-expenses";

export type PondExpenseRecord = {
  pondId: string;
  cycleId: string;
  priceMode: ExpensePriceMode;
  quantities: PondExpenseQuantities;
  prices: {
    feedPricePerKg: number;
    seedPricePerThousand: number;
    treatmentPricePerUnit: number;
    labourCostPerDay: number;
  };
  treatmentProducts: TreatmentProduct[];
  manualExpenses: ManualExpense[];
  feed: number;
  seed: number;
  treatment: number;
  labour: number;
  others: number;
  total: number;
  configured: boolean;
};

const LOCAL_KEY = "pond_expenses";

export const resolveCycleId = (stockingDate?: string | null) =>
  stockingDate?.trim() || "current";

const averageTreatmentPrice = (products: TreatmentProduct[]) => {
  const priced = products.filter((product) => parsePriceValue(product.price) > 0);
  if (priced.length === 0) {
    return 0;
  }
  const sum = priced.reduce(
    (total, product) => total + parsePriceValue(product.price),
    0,
  );
  return sum / priced.length;
};

const toSummary = (record: PondExpenseRecord): PondExpenseSummary => ({
  pondId: record.pondId,
  feed: record.feed,
  seed: record.seed,
  treatment: record.treatment,
  labour: record.labour,
  others: record.others,
  total: record.total,
  configured: record.configured,
  priceMode: record.priceMode,
  quantities: record.quantities,
  manualExpenses: record.manualExpenses,
  priceConfig: {
    feedPricePerKg: record.prices.feedPricePerKg,
    seedPricePerThousand: record.prices.seedPricePerThousand,
    labourCostPerDay: record.prices.labourCostPerDay,
    treatmentProducts:
      record.treatmentProducts.length > 0
        ? record.treatmentProducts
        : [
            {
              id: "treatment",
              name: "Treatment / Mineral",
              unit: "Unit",
              price: record.prices.treatmentPricePerUnit,
            },
          ],
  },
});

const fromSummary = (
  summary: PondExpenseSummary,
  cycleId: string,
): PondExpenseRecord => {
  const treatmentPrice =
    summary.priceConfig?.treatmentProducts?.[0]?.price ??
    averageTreatmentPrice(summary.priceConfig?.treatmentProducts ?? []);

  return {
    pondId: summary.pondId,
    cycleId,
    priceMode: summary.priceMode === "manual" ? "manual" : "fixed",
    quantities: summary.quantities ?? {
      feedKg: 0,
      seedCount: 0,
      treatmentQty: 0,
    },
    prices: {
      feedPricePerKg: parsePriceValue(summary.priceConfig?.feedPricePerKg),
      seedPricePerThousand: parsePriceValue(
        summary.priceConfig?.seedPricePerThousand,
      ),
      treatmentPricePerUnit: parsePriceValue(treatmentPrice),
      labourCostPerDay: parsePriceValue(summary.priceConfig?.labourCostPerDay),
    },
    treatmentProducts: summary.priceConfig?.treatmentProducts ?? [],
    manualExpenses: summary.manualExpenses ?? [],
    feed: summary.feed,
    seed: summary.seed,
    treatment: summary.treatment,
    labour: summary.labour,
    others: summary.others,
    total: summary.total,
    configured: !!summary.configured,
  };
};

const fromRemoteRow = (row: Record<string, unknown>): PondExpenseRecord => {
  let treatmentProducts: TreatmentProduct[] = [];
  const productsRaw = row.treatment_products;
  if (Array.isArray(productsRaw)) {
    treatmentProducts = productsRaw as TreatmentProduct[];
  } else if (typeof productsRaw === "string") {
    try {
      const parsed = JSON.parse(productsRaw) as TreatmentProduct[];
      treatmentProducts = Array.isArray(parsed) ? parsed : [];
    } catch {
      treatmentProducts = [];
    }
  }

  let manualExpenses: ManualExpense[] = [];
  const manualRaw = row.manual_expenses;
  if (Array.isArray(manualRaw)) {
    manualExpenses = manualRaw as ManualExpense[];
  } else if (typeof manualRaw === "string") {
    try {
      const parsed = JSON.parse(manualRaw) as ManualExpense[];
      manualExpenses = Array.isArray(parsed) ? parsed : [];
    } catch {
      manualExpenses = [];
    }
  }

  return {
    pondId: String(row.pond_id ?? ""),
    cycleId: String(row.cycle_id ?? "current"),
    priceMode: row.price_mode === "manual" ? "manual" : "fixed",
    quantities: {
      feedKg: parsePriceValue(row.feed_qty_kg),
      seedCount: parsePriceValue(row.seed_qty_count),
      treatmentQty: parsePriceValue(row.treatment_qty),
    },
    prices: {
      feedPricePerKg: parsePriceValue(row.feed_price_per_kg),
      seedPricePerThousand: parsePriceValue(row.seed_price_per_thousand),
      treatmentPricePerUnit: parsePriceValue(row.treatment_price_per_unit),
      labourCostPerDay: parsePriceValue(row.labour_cost_per_day),
    },
    treatmentProducts,
    manualExpenses,
    feed: parsePriceValue(row.feed_total),
    seed: parsePriceValue(row.seed_total),
    treatment: parsePriceValue(row.treatment_total),
    labour: parsePriceValue(row.labour_total),
    others: parsePriceValue(row.others_total),
    total: parsePriceValue(row.total),
    configured: Boolean(row.configured),
  };
};

const getLocalSummaries = async (): Promise<PondExpenseSummary[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PondExpenseSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalSummary = async (summary: PondExpenseSummary) => {
  const all = await getLocalSummaries();
  const index = all.findIndex((item) => item.pondId === summary.pondId);
  const next =
    index >= 0
      ? all.map((item, itemIndex) => (itemIndex === index ? summary : item))
      : [...all, summary];
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next));
};

export const buildPriceConfigFromSources = ({
  priceMode,
  globalConfig,
  pondRecord,
}: {
  priceMode: ExpensePriceMode;
  globalConfig: FarmerPriceConfig;
  pondRecord?: PondExpenseRecord | null;
}): PondPriceConfig => {
  if (priceMode === "manual" && pondRecord) {
    return {
      feedPricePerKg: pondRecord.prices.feedPricePerKg,
      seedPricePerThousand: pondRecord.prices.seedPricePerThousand,
      labourCostPerDay: pondRecord.prices.labourCostPerDay,
      treatmentProducts:
        pondRecord.treatmentProducts.length > 0
          ? pondRecord.treatmentProducts
          : [
              {
                id: "manual-treatment",
                name: "Treatment / Mineral",
                unit: "Unit",
                price: pondRecord.prices.treatmentPricePerUnit,
              },
            ],
    };
  }

  return {
    feedPricePerKg: parsePriceValue(globalConfig.feedPricePerKg),
    seedPricePerThousand: parsePriceValue(globalConfig.seedPricePerThousand),
    labourCostPerDay: parsePriceValue(globalConfig.labourCostPerDay),
    treatmentProducts: globalConfig.treatmentProducts,
  };
};

export const getPondExpenseRecord = async (
  pondId: string,
  cycleId = "current",
): Promise<{ record: PondExpenseRecord | null; error: string | null }> => {
  const local = (await getLocalSummaries()).find((item) => item.pondId === pondId);
  const localRecord = local ? fromSummary(local, cycleId) : null;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { record: localRecord, error: userError?.message ?? null };
    }

    const { data, error } = await supabase
      .from("pond_expenses")
      .select("*")
      .eq("pond_id", pondId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    if (error) {
      return { record: localRecord, error: error.message };
    }

    if (!data) {
      return { record: localRecord, error: null };
    }

    const record = fromRemoteRow(data as Record<string, unknown>);
    await saveLocalSummary(toSummary(record));
    return { record, error: null };
  } catch (error) {
    return {
      record: localRecord,
      error: error instanceof Error ? error.message : "Failed to load pond expenses",
    };
  }
};

export const savePondExpenseRecord = async (
  record: PondExpenseRecord,
): Promise<{ record: PondExpenseRecord | null; error: string | null }> => {
  const summary = toSummary(record);
  await saveLocalSummary(summary);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        record,
        error:
          userError?.message ??
          "Not signed in. Expenses saved on this device only.",
      };
    }

    const { error } = await supabase.from("pond_expenses").upsert(
      {
        user_id: user.id,
        pond_id: record.pondId,
        cycle_id: record.cycleId,
        price_mode: record.priceMode,
        feed_qty_kg: record.quantities.feedKg,
        seed_qty_count: record.quantities.seedCount,
        treatment_qty: record.quantities.treatmentQty,
        feed_price_per_kg: record.prices.feedPricePerKg,
        seed_price_per_thousand: record.prices.seedPricePerThousand,
        treatment_price_per_unit: record.prices.treatmentPricePerUnit,
        labour_cost_per_day: record.prices.labourCostPerDay,
        feed_total: record.feed,
        seed_total: record.seed,
        treatment_total: record.treatment,
        labour_total: record.labour,
        others_total: record.others,
        total: record.total,
        treatment_products: record.treatmentProducts,
        manual_expenses: record.manualExpenses,
        configured: record.configured,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "pond_id,cycle_id" },
    );

    if (error) {
      return {
        record,
        error: `${error.message}. Expenses saved on this device only.`,
      };
    }

    return { record, error: null };
  } catch (error) {
    return {
      record,
      error:
        error instanceof Error
          ? `${error.message}. Expenses saved on this device only.`
          : "Failed to sync pond expenses.",
    };
  }
};

export const recalculatePondExpenseRecord = ({
  record,
  globalConfig,
  feedKg,
  stockingCount,
  cycleDays,
}: {
  record: PondExpenseRecord;
  globalConfig: FarmerPriceConfig;
  feedKg?: number;
  stockingCount?: number;
  cycleDays?: number;
}) => {
  const priceConfig = buildPriceConfigFromSources({
    priceMode: record.priceMode,
    globalConfig,
    pondRecord: record,
  });

  const quantities = {
    feedKg: feedKg ?? record.quantities.feedKg,
    seedCount: stockingCount ?? record.quantities.seedCount,
    treatmentQty: record.quantities.treatmentQty,
  };

  const lineTotals = calculateLineExpenseTotals({
    feedKg: quantities.feedKg,
    seedCount: quantities.seedCount,
    treatmentQty: quantities.treatmentQty,
    feedPricePerKg: priceConfig.feedPricePerKg,
    seedPricePerThousand: priceConfig.seedPricePerThousand,
    treatmentPrice: averageTreatmentPrice(priceConfig.treatmentProducts),
  });

  const fullTotals = calculateExpenseTotals({
    feedKg: quantities.feedKg,
    stockingCount: quantities.seedCount,
    cycleDays: cycleDays ?? 0,
    priceConfig,
    manualExpenses: record.manualExpenses,
  });

  return {
    ...record,
    quantities,
    prices: {
      feedPricePerKg: priceConfig.feedPricePerKg,
      seedPricePerThousand: priceConfig.seedPricePerThousand,
      treatmentPricePerUnit: averageTreatmentPrice(priceConfig.treatmentProducts),
      labourCostPerDay: priceConfig.labourCostPerDay,
    },
    treatmentProducts: priceConfig.treatmentProducts,
    feed: lineTotals.feed,
    seed: lineTotals.seed,
    treatment: lineTotals.treatment,
    labour: fullTotals.labour,
    others: fullTotals.others,
    total: lineTotals.feed + lineTotals.seed + lineTotals.treatment + fullTotals.labour + fullTotals.others,
  };
};

export const priceInputValue = (value: number) => formatUnitPrice(value);

export const getPondExpenseSummary = async (
  pondId: string,
  cycleId = "current",
): Promise<{ summary: PondExpenseSummary | null; error: string | null }> => {
  const { record, error } = await getPondExpenseRecord(pondId, cycleId);
  return {
    summary: record ? toSummary(record) : null,
    error,
  };
};
