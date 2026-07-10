import AsyncStorage from "@react-native-async-storage/async-storage";

export type TreatmentProduct = {
  id: string;
  name: string;
  unit: string;
  price: number;
};

export type ManualExpense = {
  id: string;
  title: string;
  note: string;
  amount: number;
};

export type PondPriceConfig = {
  feedPricePerKg: number;
  seedPricePerThousand: number;
  labourCostPerDay: number;
  treatmentProducts: TreatmentProduct[];
};

export type ExpensePriceMode = "fixed" | "manual";

export type PondExpenseQuantities = {
  feedKg: number;
  seedCount: number;
  treatmentQty: number;
};

export type PondExpenseSummary = {
  pondId: string;
  total: number;
  feed: number;
  seed: number;
  treatment: number;
  labour: number;
  others: number;
  priceConfig?: PondPriceConfig;
  manualExpenses?: ManualExpense[];
  configured?: boolean;
  priceMode?: ExpensePriceMode;
  quantities?: PondExpenseQuantities;
};

const EXPENSES_KEY = "pond_expenses";

export const DEFAULT_PRICE_CONFIG: PondPriceConfig = {
  feedPricePerKg: 0,
  seedPricePerThousand: 0,
  labourCostPerDay: 0,
  treatmentProducts: [
    {
      id: "default-product",
      name: "",
      unit: "Litre",
      price: 0,
    },
  ],
};

export const getPondExpenses = async (): Promise<PondExpenseSummary[]> => {
  const raw = await AsyncStorage.getItem(EXPENSES_KEY);

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

export const getExpensesForPond = async (
  pondId: string,
): Promise<PondExpenseSummary | null> => {
  const expenses = await getPondExpenses();
  return expenses.find((item) => item.pondId === pondId) ?? null;
};

/** Sync local cache after remote pond expense save. */
export const syncLocalPondExpenseSummary = async (summary: PondExpenseSummary) => {
  await saveExpensesForPond(summary);
};

export const saveExpensesForPond = async (summary: PondExpenseSummary) => {
  const expenses = await getPondExpenses();
  const existingIndex = expenses.findIndex(
    (item) => item.pondId === summary.pondId,
  );
  const nextExpenses =
    existingIndex >= 0
      ? expenses.map((item, index) =>
          index === existingIndex ? summary : item,
        )
      : [...expenses, summary];

  await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(nextExpenses));
};

export const calculateExpenseTotals = ({
  feedKg,
  stockingCount,
  cycleDays,
  priceConfig,
  manualExpenses,
}: {
  feedKg: number;
  stockingCount: number;
  cycleDays: number;
  priceConfig: PondPriceConfig;
  manualExpenses: ManualExpense[];
}) => {
  const feed = Math.round(feedKg * (priceConfig.feedPricePerKg || 0));
  const seed = Math.round(
    (stockingCount / 1000) * (priceConfig.seedPricePerThousand || 0),
  );
  const treatment = Math.round(
    priceConfig.treatmentProducts.reduce(
      (sum, product) => sum + (Number(product.price) || 0),
      0,
    ),
  );
  const labour = Math.round(cycleDays * (priceConfig.labourCostPerDay || 0));
  const others = Math.round(
    manualExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  );
  const total = feed + seed + treatment + labour + others;

  return { feed, seed, treatment, labour, others, total };
};

export const calculateLineExpenseTotals = ({
  feedKg,
  seedCount,
  treatmentQty,
  feedPricePerKg,
  seedPricePerThousand,
  treatmentPrice,
}: {
  feedKg: number;
  seedCount: number;
  treatmentQty: number;
  feedPricePerKg: number;
  seedPricePerThousand: number;
  treatmentPrice: number;
}) => {
  const feed = Math.round(feedKg * (feedPricePerKg || 0));
  const seed = Math.round((seedCount / 1000) * (seedPricePerThousand || 0));
  const treatment = Math.round(treatmentQty * (treatmentPrice || 0));
  const total = feed + seed + treatment;

  return { feed, seed, treatment, labour: 0, others: 0, total };
};
