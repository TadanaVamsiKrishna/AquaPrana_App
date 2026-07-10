import AsyncStorage from "@react-native-async-storage/async-storage";

export type PondReadings = {
  dissolvedOxygen: string;
  ph: string;
  temperature: string;
  salinity: string;
  ammonia: string;
  calcium: string;
  magnesium: string;
  potassium: string;
};

type PondNameSource = {
  pondName?: string;
  name?: string;
};

export type StoredPond = {
  id: string;              // Local AsyncStorage ID
    // Supabase UUID
  pondName: string;
  name?: string;
  area: string;
  depth: string;
  species: string;
  stockingDate: string;
  stockingDensity: string;
  harvestWindowStart: string;
  harvestWindowEnd: string;
  cycleDay: string;
  biomass: string;
  survivalRate: string;
  waterQualityStatus: string;
  lastLogTime: string;
  archived?: boolean;
  latestReadings?: PondReadings;
};

export type LandOwnership = "Own" | "Rented/Leased";

export type PondDraft = {
  pondName: string;
  area: string;
  depth: string;
  landOwnership?: LandOwnership;
};

const PONDS_KEY = "ponds";
const DRAFT_KEY = "pond_draft";

export const calculateCycleDay = (stockingDate: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(stockingDate);
  start.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return Math.max(1, diffDays + 1);
};

export const formatLastLogTime = (date: Date) =>
  date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const getWaterQualityStatus = ({
  ph,
  dissolvedOxygen,
  ammonia,
}: {
  ph: number;
  dissolvedOxygen: number;
  ammonia: number;
}) => {
  let issueCount = 0;

  if (ph < 6.5 || ph > 8.5) {
    issueCount += 1;
  }

  if (dissolvedOxygen < 4) {
    issueCount += 1;
  }

  if (ammonia > 0.5) {
    issueCount += 1;
  }

  if (issueCount === 0) {
    return "Good";
  }

  if (issueCount === 1) {
    return "Fair";
  }

  return "Poor";
};

export const resolvePondName = (
  pond: PondNameSource,
  fallback = "My Pond",
) => {
  const pondName = pond.pondName?.trim() || pond.name?.trim();
  return pondName || fallback;
};

export const normalizeStoredPond = (
  pond: StoredPond & PondNameSource,
): StoredPond => {
  const pondName = pond.pondName?.trim() || pond.name?.trim() || "";

  return {
    ...pond,
    pondName,
  };
};

export const getPonds = async (): Promise<StoredPond[]> => {
  const raw = await AsyncStorage.getItem(PONDS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredPond[];
    return Array.isArray(parsed) ? parsed.map(normalizeStoredPond) : [];
  } catch {
    return [];
  }
};

export const savePond = async (pond: StoredPond) => {
  const normalizedPond = normalizeStoredPond(pond);
  const ponds = await getPonds();
  const existingIndex = ponds.findIndex((item) => item.id === normalizedPond.id);
  const nextPonds =
    existingIndex >= 0
      ? ponds.map((item, index) =>
          index === existingIndex ? normalizedPond : item,
        )
      : [...ponds, normalizedPond];

  await AsyncStorage.setItem(PONDS_KEY, JSON.stringify(nextPonds));
};

export const savePondDraft = async (draft: PondDraft) => {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

export const getPondDraft = async (): Promise<PondDraft | null> => {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PondDraft;
  } catch {
    return null;
  }
};

export const clearPondDraft = async () => {
  await AsyncStorage.removeItem(DRAFT_KEY);
};

export const getPondById = async (id: string): Promise<StoredPond | null> => {
  const ponds = await getPonds();
  const pond = ponds.find((item) => item.id === id);
  return pond ? normalizeStoredPond(pond) : null;
};
