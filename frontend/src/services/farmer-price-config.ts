import AsyncStorage from "@react-native-async-storage/async-storage";
import { parsePriceValue } from "../lib/expense-format";
import { supabase } from "../lib/supabase";
import type { TreatmentProduct } from "./local-pond-expenses";

export type FarmerPriceConfig = {
  feedPricePerKg: number;
  seedPricePerThousand: number;
  labourCostPerDay: number;
  treatmentProducts: TreatmentProduct[];
  updatedAt?: string;
};

const LOCAL_KEY = "farmer_price_config";

export const DEFAULT_FARMER_PRICE_CONFIG: FarmerPriceConfig = {
  feedPricePerKg: 0,
  seedPricePerThousand: 0,
  labourCostPerDay: 0,
  treatmentProducts: [
    {
      id: "default-treatment",
      name: "",
      unit: "Litre",
      price: 0,
    },
  ],
};

const createProductId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const normalizeConfig = (
  value: Partial<FarmerPriceConfig> | null | undefined,
): FarmerPriceConfig => {
  const products = Array.isArray(value?.treatmentProducts)
    ? value.treatmentProducts
    : [];

  return {
    feedPricePerKg: parsePriceValue(value?.feedPricePerKg),
    seedPricePerThousand: parsePriceValue(value?.seedPricePerThousand),
    labourCostPerDay: parsePriceValue(value?.labourCostPerDay),
    treatmentProducts:
      products.length > 0
        ? products.map((product) => ({
            id: product.id || createProductId(),
            name: product.name ?? "",
            unit: product.unit || "Litre",
            price: parsePriceValue(product.price),
          }))
        : DEFAULT_FARMER_PRICE_CONFIG.treatmentProducts.map((product) => ({
            ...product,
            id: createProductId(),
          })),
    updatedAt: value?.updatedAt,
  };
};

const fromRemoteRow = (row: Record<string, unknown>): FarmerPriceConfig => {
  const productsRaw = row.treatment_products;
  let products: TreatmentProduct[] = [];

  if (Array.isArray(productsRaw)) {
    products = productsRaw as TreatmentProduct[];
  } else if (typeof productsRaw === "string") {
    try {
      const parsed = JSON.parse(productsRaw) as TreatmentProduct[];
      products = Array.isArray(parsed) ? parsed : [];
    } catch {
      products = [];
    }
  }

  return normalizeConfig({
    feedPricePerKg: row.feed_price_per_kg,
    seedPricePerThousand: row.seed_price_per_thousand,
    labourCostPerDay: row.labour_cost_per_day,
    treatmentProducts: products,
    updatedAt:
      typeof row.updated_at === "string" ? row.updated_at : undefined,
  });
};

const getLocalConfig = async (): Promise<FarmerPriceConfig | null> => {
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeConfig(JSON.parse(raw) as FarmerPriceConfig);
  } catch {
    return null;
  }
};

const saveLocalConfig = async (config: FarmerPriceConfig) => {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(config));
};

export const getFarmerPriceConfig = async (): Promise<{
  config: FarmerPriceConfig;
  error: string | null;
  source: "supabase" | "local" | "default";
}> => {
  const local = await getLocalConfig();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        config: local ?? DEFAULT_FARMER_PRICE_CONFIG,
        error: userError?.message ?? null,
        source: local ? "local" : "default",
      };
    }

    const { data, error } = await supabase
      .from("farmer_price_configs")
      .select(
        "user_id, feed_price_per_kg, seed_price_per_thousand, labour_cost_per_day, treatment_products, updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return {
        config: local ?? DEFAULT_FARMER_PRICE_CONFIG,
        error: error.message,
        source: local ? "local" : "default",
      };
    }

    if (!data) {
      return {
        config: local ?? DEFAULT_FARMER_PRICE_CONFIG,
        error: null,
        source: local ? "local" : "default",
      };
    }

    const config = fromRemoteRow(data as Record<string, unknown>);
    await saveLocalConfig(config);

    return { config, error: null, source: "supabase" };
  } catch (error) {
    return {
      config: local ?? DEFAULT_FARMER_PRICE_CONFIG,
      error: error instanceof Error ? error.message : "Failed to load prices",
      source: local ? "local" : "default",
    };
  }
};

export const saveFarmerPriceConfig = async (
  input: FarmerPriceConfig,
): Promise<{ config: FarmerPriceConfig | null; error: string | null }> => {
  const config = normalizeConfig({
    ...input,
    updatedAt: new Date().toISOString(),
  });

  await saveLocalConfig(config);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        config,
        error:
          userError?.message ??
          "Not signed in. Prices saved on this device only.",
      };
    }

    const { error } = await supabase.from("farmer_price_configs").upsert(
      {
        user_id: user.id,
        feed_price_per_kg: config.feedPricePerKg,
        seed_price_per_thousand: config.seedPricePerThousand,
        labour_cost_per_day: config.labourCostPerDay,
        treatment_products: config.treatmentProducts,
        updated_at: config.updatedAt,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return {
        config,
        error: `${error.message}. Prices saved on this device only.`,
      };
    }

    return { config, error: null };
  } catch (error) {
    return {
      config,
      error:
        error instanceof Error
          ? `${error.message}. Prices saved on this device only.`
          : "Failed to sync prices to Supabase.",
    };
  }
};

export const hasConfiguredFarmerPrices = (config: FarmerPriceConfig) =>
  config.feedPricePerKg > 0 ||
  config.seedPricePerThousand > 0 ||
  config.labourCostPerDay > 0 ||
  config.treatmentProducts.some(
    (product) => parsePriceValue(product.price) > 0 || !!product.name.trim(),
  );
