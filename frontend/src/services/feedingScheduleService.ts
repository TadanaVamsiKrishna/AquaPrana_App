import { supabase } from "../lib/supabase";
import { getCropCycleForPond } from "./cropCycle";

export type FeedCalculationRule = "Fixed Quantity" | "% Biomass";

export type FeedingScheduleRecord = {
  id: string;
  pond_id: string;
  cycle_id: string;
  feeds_per_day: number;
  feed_times: string[] | string | null;
  interval_rule: "fixed" | "pct_biomass";
  feed_rate_pct: number | null;
  default_brand: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type FeedingScheduleInput = {
  pondId: string;
  feedsPerDay: number;
  feedingTimes: string[];
  initialQuantity: string;
  calculationRule: FeedCalculationRule;
  feedBrand: string;
};

export type FeedingScheduleView = {
  feedsPerDay: number;
  feedTimes: string[];
  feedTimesLabel: string;
  intervalRule: FeedCalculationRule;
  intervalRuleLabel: string;
  defaultBrand: string | null;
  recommendedDailyKg: string;
  perFeedQty: string;
  nextFeedTime: string;
  nextFeedRaw: string;
  nextFeedQty: string;
  lastUpdated: string;
};

export const DEFAULT_FEEDING_TIMES = ["06:00", "11:00", "14:00", "17:00"];

export const buildFeedingTimes = (count: number) => {
  const slots = ["06:00", "09:00", "11:00", "14:00", "17:00", "20:00"].slice(
    0,
    Math.max(1, count),
  );

  return slots;
};

const mapIntervalRuleToDb = (
  rule: FeedCalculationRule,
): FeedingScheduleRecord["interval_rule"] =>
  rule === "% Biomass" ? "pct_biomass" : "fixed";

export const mapIntervalRuleFromDb = (
  rule: string | null | undefined,
): FeedCalculationRule =>
  rule === "pct_biomass" ? "% Biomass" : "Fixed Quantity";

export const normalizeFeedTimes = (value: unknown, feedsPerDay = 4) => {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      const split = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (split.length > 0) {
        return split;
      }
    }
  }

  return buildFeedingTimes(feedsPerDay);
};

const parseTimeToMinutes = (time: string) => {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

export const formatFeedTimeDisplay = (time: string) => {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) {
    return time;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(mins).padStart(2, "0")} ${period}`;
};

export const getNextFeedTime = (feedTimes: string[]) => {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = feedTimes
    .map((raw) => ({ raw, minutes: parseTimeToMinutes(raw) }))
    .filter(
      (entry): entry is { raw: string; minutes: number } =>
        entry.minutes !== null,
    )
    .sort((left, right) => left.minutes - right.minutes);

  if (sorted.length === 0) {
    return { time: "—", raw: "" };
  }

  const upcoming =
    sorted.find((entry) => entry.minutes > nowMinutes) ?? sorted[0];

  return {
    time: formatFeedTimeDisplay(upcoming.raw),
    raw: upcoming.raw,
  };
};

const formatUpdatedAt = (value: string | null | undefined) => {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const buildFeedScheduleView = (
  schedule: FeedingScheduleRecord,
  biomassKg: number | null = null,
): FeedingScheduleView => {
  const feedTimes = normalizeFeedTimes(
    schedule.feed_times,
    schedule.feeds_per_day,
  );
  const intervalRule = mapIntervalRuleFromDb(schedule.interval_rule);
  const rate = schedule.feed_rate_pct ?? 0;

  let dailyKg = 0;
  if (intervalRule === "Fixed Quantity") {
    dailyKg = rate;
  } else if (biomassKg != null && biomassKg > 0) {
    dailyKg = (biomassKg * rate) / 100;
  }

  const perFeed =
    schedule.feeds_per_day > 0 && dailyKg > 0
      ? dailyKg / schedule.feeds_per_day
      : 0;
  const nextFeed = getNextFeedTime(feedTimes);

  return {
    feedsPerDay: schedule.feeds_per_day,
    feedTimes,
    feedTimesLabel: feedTimes.join(", "),
    intervalRule,
    intervalRuleLabel: intervalRule,
    defaultBrand: schedule.default_brand,
    recommendedDailyKg: dailyKg > 0 ? dailyKg.toFixed(1) : "—",
    perFeedQty: perFeed > 0 ? perFeed.toFixed(1) : "—",
    nextFeedTime: nextFeed.time,
    nextFeedRaw: nextFeed.raw,
    nextFeedQty: perFeed > 0 ? `${perFeed.toFixed(1)} kg` : "—",
    lastUpdated: formatUpdatedAt(schedule.updated_at ?? schedule.created_at),
  };
};

export async function getLatestFeedingScheduleForPond(pondId: string) {
  const { data, error } = await supabase
    .from("feeding_schedules")
    .select("*")
    .eq("pond_id", pondId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("[feedingScheduleService] latest schedule:", data);
  console.log("[feedingScheduleService] fetch error:", error);

  if (error) throw error;
  return (data as FeedingScheduleRecord | null) ?? null;
}

export async function getFeedingScheduleForCycle(cycleId: string) {
  const { data, error } = await supabase
    .from("feeding_schedules")
    .select("*")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (error) throw error;
  return (data as FeedingScheduleRecord | null) ?? null;
}

export async function saveFeedingSchedule(input: FeedingScheduleInput) {
  const cycle = await getCropCycleForPond(input.pondId);

  if (!cycle?.id) {
    throw new Error(
      "No crop cycle found for this pond. Please complete crop setup before saving a feeding schedule.",
    );
  }

  const payload = {
    pond_id: input.pondId,
    cycle_id: cycle.id,
    feeds_per_day: input.feedsPerDay,
    feed_times: input.feedingTimes,
    interval_rule: mapIntervalRuleToDb(input.calculationRule),
    feed_rate_pct: Number(input.initialQuantity) || 0,
    default_brand: input.feedBrand.trim() || null,
  };

  console.log("[feedingScheduleService] saving payload:", payload);

  const { data: existing, error: existingError } = await supabase
    .from("feeding_schedules")
    .select("id")
    .eq("pond_id", input.pondId)
    .eq("cycle_id", cycle.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("feeding_schedules")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    console.log("[feedingScheduleService] updated schedule:", data);
    console.log("[feedingScheduleService] update error:", error);

    if (error) throw error;
    return data as FeedingScheduleRecord;
  }

  const { data, error } = await supabase
    .from("feeding_schedules")
    .insert(payload)
    .select()
    .single();

  console.log("[feedingScheduleService] inserted schedule:", data);
  console.log("[feedingScheduleService] insert error:", error);

  if (error) throw error;
  return data as FeedingScheduleRecord;
}

export async function fetchFeedScheduleViewForPond(
  pondId: string,
  biomassKg: number | null = null,
) {
  const schedule = await getLatestFeedingScheduleForPond(pondId);

  if (!schedule) {
    return null;
  }

  return buildFeedScheduleView(schedule, biomassKg);
}

export async function fetchFeedScheduleViewForCycle(
  cycleId: string,
  biomassKg: number | null = null,
) {
  const schedule = await getFeedingScheduleForCycle(cycleId);

  if (!schedule) {
    return null;
  }

  return buildFeedScheduleView(schedule, biomassKg);
}
