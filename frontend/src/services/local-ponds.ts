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
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  latestReadings?: PondReadings;
};

export type LandOwnership = "Own" | "Rented/Leased";

export type PondDraft = {
  id?: string;
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

export const isPondCycleActive = (pond: StoredPond) => {
  if (pond.isActive === false || pond.archived) {
    return false;
  }

  if (pond.isActive === true) {
    return true;
  }

  return !pond.archived && !!pond.species?.trim();
};

export const getPondSortTimestamp = (pond: StoredPond) => {
  const candidates = [pond.updatedAt, pond.createdAt, pond.lastLogTime];

  for (const value of candidates) {
    if (!value || value === "—") {
      continue;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const idTime = Number(pond.id);
  if (Number.isFinite(idTime) && idTime > 1e11) {
    return idTime;
  }

  return 0;
};

export const sortPondsByActiveThenRecent = (ponds: StoredPond[]) =>
  [...ponds].sort((left, right) => {
    const activeDiff =
      Number(isPondCycleActive(right)) - Number(isPondCycleActive(left));

    if (activeDiff !== 0) {
      return activeDiff;
    }

    return getPondSortTimestamp(right) - getPondSortTimestamp(left);
  });

export const savePond = async (pond: StoredPond) => {
  const now = new Date().toISOString();
  const normalizedPond = normalizeStoredPond({
    ...pond,
    isActive: pond.isActive ?? !pond.archived,
    createdAt: pond.createdAt || now,
    updatedAt: now,
  });
  const ponds = await getPonds();
  const existingIndex = ponds.findIndex((item) => item.id === normalizedPond.id);
  const nextPonds =
    existingIndex >= 0
      ? ponds.map((item, index) =>
          index === existingIndex
            ? {
                ...normalizedPond,
                createdAt: item.createdAt || normalizedPond.createdAt,
              }
            : item,
        )
      : [...ponds, normalizedPond];

  await AsyncStorage.setItem(PONDS_KEY, JSON.stringify(nextPonds));
};

export const saveLocalPond = savePond;

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

export const mapRemotePondToStored = (record: {
  id: string;
  name?: string | null;
  area_acres?: number | null;
  depth_ft?: number | null;
  species?: string | null;
  stocking_date?: string | null;
  stocking_density?: number | string | null;
  cycle_day?: number | string | null;
  biomass?: string | null;
  survival_rate?: string | null;
  water_quality_status?: string | null;
  last_log_time?: string | null;
  archived?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}): StoredPond =>
  normalizeStoredPond({
    id: String(record.id),
    pondName: record.name?.trim() || "",
    name: record.name?.trim() || "",
    area: record.area_acres != null ? String(record.area_acres) : "",
    depth: record.depth_ft != null ? String(record.depth_ft) : "",
    species: record.species?.trim() || "",
    stockingDate: record.stocking_date?.trim() || "",
    stockingDensity:
      record.stocking_density != null ? String(record.stocking_density) : "",
    harvestWindowStart: "",
    harvestWindowEnd: "",
    cycleDay: record.cycle_day != null ? String(record.cycle_day) : "1",
    biomass: record.biomass?.trim() || "—",
    survivalRate: record.survival_rate?.trim() || "—",
    waterQualityStatus: record.water_quality_status?.trim() || "Not logged",
    lastLogTime: record.last_log_time?.trim() || "—",
    archived: !!record.archived,
    isActive:
      record.is_active != null ? !!record.is_active : !record.archived,
    createdAt: record.created_at ?? undefined,
    updatedAt: record.updated_at ?? undefined,
  });

export const mergeLocalAndRemotePonds = (
  localPonds: StoredPond[],
  remotePonds: Array<{
    id: string;
    name?: string | null;
    area_acres?: number | null;
    depth_ft?: number | null;
    species?: string | null;
    stocking_date?: string | null;
    stocking_density?: number | string | null;
    cycle_day?: number | string | null;
    biomass?: string | null;
    survival_rate?: string | null;
    water_quality_status?: string | null;
    last_log_time?: string | null;
    archived?: boolean | null;
    is_active?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>,
): StoredPond[] => {
  const localById = new Map(localPonds.map((pond) => [pond.id, pond]));
  const localByName = new Map(
    localPonds.map((pond) => [resolvePondName(pond).toLowerCase(), pond]),
  );
  const usedLocalIds = new Set<string>();
  const merged: StoredPond[] = [];

  for (const remote of remotePonds) {
    const remoteName = remote.name?.trim().toLowerCase() || "";
    const localMatch =
      localById.get(String(remote.id)) ??
      (remoteName ? localByName.get(remoteName) : undefined);

    if (localMatch) {
      usedLocalIds.add(localMatch.id);
      merged.push(
        normalizeStoredPond({
          ...localMatch,
          pondName: remote.name?.trim() || localMatch.pondName,
          name: remote.name?.trim() || localMatch.name,
          area:
            remote.area_acres != null
              ? String(remote.area_acres)
              : localMatch.area,
          depth:
            remote.depth_ft != null ? String(remote.depth_ft) : localMatch.depth,
          species: remote.species?.trim() || localMatch.species,
          stockingDate: remote.stocking_date?.trim() || localMatch.stockingDate,
          stockingDensity:
            remote.stocking_density != null
              ? String(remote.stocking_density)
              : localMatch.stockingDensity,
          cycleDay:
            remote.cycle_day != null
              ? String(remote.cycle_day)
              : localMatch.cycleDay,
          biomass: remote.biomass?.trim() || localMatch.biomass,
          survivalRate:
            remote.survival_rate?.trim() || localMatch.survivalRate,
          waterQualityStatus:
            remote.water_quality_status?.trim() ||
            localMatch.waterQualityStatus,
          lastLogTime:
            remote.last_log_time?.trim() || localMatch.lastLogTime,
          archived:
            remote.archived != null ? !!remote.archived : localMatch.archived,
          isActive:
            remote.is_active != null
              ? !!remote.is_active
              : localMatch.isActive ??
                !(remote.archived != null
                  ? !!remote.archived
                  : localMatch.archived),
          createdAt: remote.created_at || localMatch.createdAt,
          updatedAt: remote.updated_at || localMatch.updatedAt,
        }),
      );
      continue;
    }

    merged.push(mapRemotePondToStored(remote));
  }

  for (const localPond of localPonds) {
    if (!usedLocalIds.has(localPond.id)) {
      merged.push(localPond);
    }
  }

  return sortPondsByActiveThenRecent(merged);
};
