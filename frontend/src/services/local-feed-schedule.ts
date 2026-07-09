import AsyncStorage from "@react-native-async-storage/async-storage";

export type FeedCalculationRule = "Fixed Quantity" | "% Biomass";

export type FeedSchedule = {
  pondId: string;
  feedsPerDay: number;
  feedingTimes: string[];
  initialQuantity: string;
  calculationRule: FeedCalculationRule;
  feedBrand: string;
};

const SCHEDULE_KEY = "feed_schedules";

export const DEFAULT_FEEDING_TIMES = ["06:00", "11:00", "14:00", "17:00"];

export const getFeedSchedules = async (): Promise<FeedSchedule[]> => {
  const raw = await AsyncStorage.getItem(SCHEDULE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as FeedSchedule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getFeedScheduleForPond = async (
  pondId: string,
): Promise<FeedSchedule | null> => {
  const schedules = await getFeedSchedules();
  return schedules.find((schedule) => schedule.pondId === pondId) ?? null;
};

export const saveFeedSchedule = async (schedule: FeedSchedule) => {
  const schedules = await getFeedSchedules();
  const existingIndex = schedules.findIndex(
    (item) => item.pondId === schedule.pondId,
  );
  const nextSchedules =
    existingIndex >= 0
      ? schedules.map((item, index) =>
          index === existingIndex ? schedule : item,
        )
      : [...schedules, schedule];

  await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(nextSchedules));
};

export const buildFeedingTimes = (count: number) => {
  const slots = [
    "06:00",
    "09:00",
    "11:00",
    "14:00",
    "17:00",
    "20:00",
  ].slice(0, Math.max(1, count));

  return slots;
};
