import { supabase } from "../lib/supabase";
import { getActiveCropCycleForPond } from "./cropCycle";
import { getLogsForPond } from "./dailyLogs";
import { fetchFeedScheduleViewForCycle } from "./feedingScheduleService";
import { getInventoryItems } from "./inventory";

export type AquaGPTConversationTurn = {
  role: "assistant" | "user";
  text: string;
};

export type AquaGPTRequestContext = {
  pondId?: string | null;
  cycleId?: string | null;
  userId?: string | null;
  screen?: string | null;
  mode?: "pond" | "generic";
  conversationHistory?: AquaGPTConversationTurn[];
};

export type AquaGPTEnrichedContext = AquaGPTRequestContext & {
  latestLogsSummary?: string | null;
  feedScheduleSummary?: string | null;
  waterQualitySummary?: string | null;
  inventorySummary?: string | null;
};

async function buildClientContext(
  context: AquaGPTRequestContext,
): Promise<AquaGPTEnrichedContext> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = context.userId ?? authData.user?.id ?? null;

  if (context.mode === "generic" || !context.pondId) {
    return {
      ...context,
      pondId: null,
      cycleId: null,
      userId,
      mode: "generic",
      latestLogsSummary: null,
      feedScheduleSummary: null,
      waterQualitySummary: null,
      inventorySummary: null,
    };
  }

  let cycleId = context.cycleId ?? null;
  let feedScheduleSummary: string | null = null;
  let latestLogsSummary: string | null = null;
  let waterQualitySummary: string | null = null;
  let inventorySummary: string | null = null;

  try {
    if (!cycleId) {
      const cycle = await getActiveCropCycleForPond(context.pondId);
      cycleId = cycle?.id ?? null;
    }

    if (cycleId) {
      const feed = await fetchFeedScheduleViewForCycle(cycleId);
      if (feed) {
        feedScheduleSummary = [
          `Feeds/day: ${feed.feedsPerDay}`,
          `Recommended: ${feed.recommendedDailyKg} kg/day`,
          `Per feed: ${feed.perFeedQty} kg`,
          `Times: ${feed.feedTimesLabel}`,
          `Rule: ${feed.intervalRuleLabel}`,
          feed.defaultBrand ? `Brand: ${feed.defaultBrand}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
      }
    }
  } catch (error) {
    console.log("[aquagpt] feed/cycle context skipped:", error);
  }

  try {
    const logs = await getLogsForPond(context.pondId);
    const latest = logs.slice(0, 3);
    if (latest.length > 0) {
      latestLogsSummary = latest
        .map((log, index) => {
          return [
            `#${index + 1} @ ${log.observedAt}`,
            `DO ${log.dissolvedOxygen || "—"}`,
            `pH ${log.ph || "—"}`,
            `Ammonia ${log.ammonia || "—"}`,
            `Temp ${log.temperature || "—"}`,
            `Salinity ${log.salinity || "—"}`,
            `Feed ${log.feedQty || "—"} kg`,
            `Mortality ${log.mortalityCount || "—"}`,
          ].join(" · ");
        })
        .join("\n");

      const top = latest[0];
      waterQualitySummary = [
        `DO: ${top.dissolvedOxygen || "unavailable"}`,
        `pH: ${top.ph || "unavailable"}`,
        `Ammonia: ${top.ammonia || "unavailable"}`,
        `Temp: ${top.temperature || "unavailable"}`,
        `Salinity: ${top.salinity || "unavailable"}`,
      ].join(" · ");
    }
  } catch (error) {
    console.log("[aquagpt] logs context skipped:", error);
  }

  try {
    if (context.screen?.includes("inventory")) {
      const items = await getInventoryItems();
      inventorySummary =
        !items || items.length === 0
          ? "No inventory items found."
          : items
              .slice(0, 8)
              .map((item) => {
                const name = String(item.product_name ?? "Item");
                const qty = String(item.current_qty ?? "—");
                const unit = String(item.unit ?? "");
                const location = item.location
                  ? ` @ ${String(item.location)}`
                  : "";
                return `${name}: ${qty} ${unit}${location}`.trim();
              })
              .join("; ");
    }
  } catch (error) {
    console.log("[aquagpt] inventory context skipped:", error);
  }

  return {
    ...context,
    userId,
    cycleId,
    mode: "pond",
    latestLogsSummary,
    feedScheduleSummary,
    waterQualitySummary,
    inventorySummary,
  };
}

export async function askAquaGPT(
  question: string,
  context: string | AquaGPTRequestContext,
) {
  const requestContext: AquaGPTRequestContext =
    typeof context === "string"
      ? { pondId: context, mode: "pond" }
      : context;

  const enriched = await buildClientContext(requestContext);

  const isGeneric = enriched.mode === "generic" || !enriched.pondId;

  const { data, error } = await supabase.functions.invoke("aquagpt", {
    body: {
      question,
      mode: isGeneric ? "generic" : "pond",
      pondId: isGeneric ? null : enriched.pondId,
      cycleId: isGeneric ? null : enriched.cycleId,
      userId: enriched.userId,
      screen: enriched.screen,
      conversationHistory: enriched.conversationHistory ?? [],
      latestLogsSummary: isGeneric ? null : enriched.latestLogsSummary,
      feedScheduleSummary: isGeneric ? null : enriched.feedScheduleSummary,
      waterQualitySummary: isGeneric ? null : enriched.waterQualitySummary,
      inventorySummary: isGeneric ? null : enriched.inventorySummary,
    },
  });

  if (error) throw error;

  return data.answer as string;
}

export async function transcribeAquaGptAudio(filePath: string) {
  const { data, error } = await supabase.functions.invoke("aquagpt-transcribe", {
    body: { filePath },
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Unable to transcribe audio.",
    );
  }

  return (data?.transcript as string | undefined)?.trim() ?? "";
}
