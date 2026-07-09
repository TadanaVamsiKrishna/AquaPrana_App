import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getOverallWaterQuality,
  type WaterParameterKey,
} from "../lib/water-quality";
import {
  formatLastLogTime,
  getPonds,
  savePond,
  type StoredPond,
} from "./local-ponds";

export type DailyLogEntry = {
  id: string;
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
};

const LOGS_KEY = "daily_logs";

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getDailyLogs = async (): Promise<DailyLogEntry[]> => {
  const raw = await AsyncStorage.getItem(LOGS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as DailyLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getLatestLogForPond = async (
  pondId: string,
): Promise<DailyLogEntry | null> => {
  const logs = await getDailyLogs();
  const pondLogs = logs
    .filter((log) => log.pondId === pondId)
    .sort(
      (left, right) =>
        new Date(right.observedAt).getTime() -
        new Date(left.observedAt).getTime(),
    );

  return pondLogs[0] ?? null;
};

export const pondHasLogsForActiveCycle = async (
  pondId: string,
): Promise<boolean> => {
  const logs = await getDailyLogs();
  return logs.some((log) => log.pondId === pondId);
};

export const getLogsForPond = async (
  pondId: string,
): Promise<DailyLogEntry[]> => {
  const logs = await getDailyLogs();
  return logs.filter((log) => log.pondId === pondId);
};

export const saveDailyLog = async (entry: DailyLogEntry) => {
  const logs = await getDailyLogs();
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([entry, ...logs]));

  const ponds = await getPonds();
  const pond = ponds.find((item) => item.id === entry.pondId);

  if (!pond) {
    return;
  }

  const readings: Partial<Record<WaterParameterKey, number | null>> = {
    do: parseNumber(entry.dissolvedOxygen),
    ph: parseNumber(entry.ph),
    temperature: parseNumber(entry.temperature),
    salinity: parseNumber(entry.salinity),
    ammonia: parseNumber(entry.ammonia),
    calcium: parseNumber(entry.calcium),
    magnesium: parseNumber(entry.magnesium),
    potassium: parseNumber(entry.potassium),
  };

  const updatedPond: StoredPond = {
    ...pond,
    waterQualityStatus: getOverallWaterQuality(readings),
    lastLogTime: formatLastLogTime(new Date(entry.observedAt)),
    latestReadings: {
      dissolvedOxygen: entry.dissolvedOxygen,
      ph: entry.ph,
      temperature: entry.temperature,
      salinity: entry.salinity,
      ammonia: entry.ammonia,
      calcium: entry.calcium,
      magnesium: entry.magnesium,
      potassium: entry.potassium,
    },
  };

  await savePond(updatedPond);
};
