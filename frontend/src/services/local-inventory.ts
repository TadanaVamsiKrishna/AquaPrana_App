import AsyncStorage from "@react-native-async-storage/async-storage";

export type InventoryUnit = "kg" | "Bag" | "Ltr" | "pcs" | "g";

export type InventoryCategory = "Feed" | "Treatment" | "Minerals" | "Other";

export type StoredInventoryItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  currentStock: number;
  restockThreshold: number;
  restockQuantity: number;
  location: string;
  createdAt: string;
};

export type InventoryDraft = {
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  currentStock: string;
  restockThreshold: string;
  restockQuantity: string;
  location: string;
};

const INVENTORY_KEY = "inventory_items";

export const INVENTORY_UNITS: InventoryUnit[] = ["kg", "Bag", "Ltr", "pcs", "g"];

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "Feed",
  "Treatment",
  "Minerals",
  "Other",
];

export const getInventoryItems = async (): Promise<StoredInventoryItem[]> => {
  const raw = await AsyncStorage.getItem(INVENTORY_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredInventoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveInventoryItem = async (item: StoredInventoryItem) => {
  const items = await getInventoryItems();
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  const nextItems =
    existingIndex >= 0
      ? items.map((entry, index) => (index === existingIndex ? item : entry))
      : [...items, item];

  await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(nextItems));
};

export const restockInventoryItem = async (id: string) => {
  const items = await getInventoryItems();
  const nextItems = items.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      currentStock: Number((item.currentStock + item.restockQuantity).toFixed(2)),
    };
  });

  await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(nextItems));
  return nextItems;
};

export const isLowStock = (item: StoredInventoryItem) =>
  item.currentStock <= item.restockThreshold;

export const getLowStockItems = (items: StoredInventoryItem[]) =>
  items.filter(isLowStock);

export const getTotalStockQuantity = (items: StoredInventoryItem[]) =>
  items.reduce((total, item) => total + item.currentStock, 0);

export const formatStockAmount = (value: number, unit: string) => {
  const formatted =
    Number.isInteger(value) || value % 1 === 0
      ? String(Math.round(value))
      : value.toFixed(2).replace(/\.?0+$/, "");

  return `${formatted} ${unit}`;
};

export const inferCategory = (name: string): InventoryCategory => {
  const value = name.toLowerCase();

  if (
    value.includes("feed") ||
    value.includes("pellet") ||
    value.includes("protein")
  ) {
    return "Feed";
  }

  if (
    value.includes("oxygen") ||
    value.includes("probiotic") ||
    value.includes("tablet") ||
    value.includes("treat")
  ) {
    return "Treatment";
  }

  if (
    value.includes("mineral") ||
    value.includes("lime") ||
    value.includes("salt")
  ) {
    return "Minerals";
  }

  return "Other";
};
