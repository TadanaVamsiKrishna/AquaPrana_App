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
  sessionId?: string | null;
  conversationHistory?: AquaGPTConversationTurn[];
};

export type AquaGPTEnrichedContext = AquaGPTRequestContext & {
  latestLogsSummary?: string | null;
  feedScheduleSummary?: string | null;
  waterQualitySummary?: string | null;
  inventorySummary?: string | null;
};

const isDev =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

function formatUnknownError(value: unknown): string {
  if (value == null) {
    return "Unknown error";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function readFunctionsErrorBody(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.text !== "function") {
    return null;
  }

  try {
    const text = await context.text();
    if (!text?.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === "string") {
        return parsed.error;
      }
      if (parsed.error != null) {
        return formatUnknownError(parsed.error);
      }
      if (typeof parsed.message === "string") {
        return parsed.message;
      }
      return text;
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

export async function formatAquaGptInvokeError(
  error: unknown,
  data?: unknown,
): Promise<string> {
  const dataError =
    data && typeof data === "object" && "error" in data
      ? (data as { error: unknown }).error
      : null;

  if (typeof dataError === "string" && dataError.trim()) {
    const normalized = dataError.toLowerCase();
    if (normalized.includes("api key") || normalized.includes("groq_api_key")) {
      return "LLM API key is missing.";
    }
    return isDev ? dataError : dataError;
  }

  const bodyMessage = await readFunctionsErrorBody(error);
  if (bodyMessage) {
    const normalized = bodyMessage.toLowerCase();
    if (normalized.includes("api key") || normalized.includes("groq_api_key")) {
      return "LLM API key is missing.";
    }
    const status = (error as { context?: { status?: number } })?.context?.status;
    if (isDev && status) {
      return `HTTP ${status}: ${bodyMessage}`;
    }
    return bodyMessage;
  }

  const message = formatUnknownError(error).toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("networkerror") ||
    message.includes("unable to connect")
  ) {
    return "Unable to reach AquaGPT server.";
  }

  if (
    message.includes("jwt") ||
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("authentication")
  ) {
    return "Authentication failed";
  }

  if (message.includes("non-2xx") || message.includes("edge function")) {
    const status = (error as { context?: { status?: number } })?.context?.status;
    if (isDev && status) {
      return `HTTP ${status}: Edge Function returned an error.`;
    }
    return formatUnknownError(error);
  }

  return formatUnknownError(error);
}

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asValidUuid(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === "undefined" ||
    trimmed === "null" ||
    !UUID_RE.test(trimmed)
  ) {
    return undefined;
  }
  return trimmed;
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

  const sessionId = asValidUuid(enriched.sessionId);
  const userId = asValidUuid(enriched.userId);
  const pondId = asValidUuid(enriched.pondId);
  const cycleId = asValidUuid(enriched.cycleId);

  if (!sessionId) {
    throw new Error(
      "Missing valid session_id. Create an AquaGPT session before asking.",
    );
  }

  if (!userId) {
    throw new Error(
      enriched.userId ? "Invalid user_id." : "Authentication failed",
    );
  }

  // Never send undefined / null / "" for UUID fields — omit the key instead.
  const requestBody: Record<string, unknown> = {
    mode: isGeneric ? "generic" : "pond",
    question,
    sessionId,
    userId,
    conversationHistory: enriched.conversationHistory ?? [],
  };

  if (enriched.screen) {
    requestBody.screen = enriched.screen;
  }

  if (!isGeneric) {
    if (!pondId) {
      throw new Error("Invalid pond_id.");
    }
    requestBody.pondId = pondId;
    if (cycleId) {
      requestBody.cycleId = cycleId;
    }
    requestBody.latestLogsSummary = enriched.latestLogsSummary ?? null;
    requestBody.feedScheduleSummary = enriched.feedScheduleSummary ?? null;
    requestBody.waterQualitySummary = enriched.waterQualitySummary ?? null;
    requestBody.inventorySummary = enriched.inventorySummary ?? null;
  }

  console.log({
    sessionId,
    pondId: pondId ?? null,
    userId,
    requestBody,
  });

  let data: { answer?: string; error?: unknown } | null = null;
  let error: unknown = null;

  try {
    const result = await supabase.functions.invoke("aquagpt", {
      body: requestBody,
    });
    data = result.data as typeof data;
    error = result.error;
  } catch (invokeError) {
    console.log("[aquagpt] invoke threw:", invokeError);
    throw new Error(await formatAquaGptInvokeError(invokeError));
  }

  console.log("[aquagpt] response", { data, error });

  if (error) {
    console.log("[aquagpt] error object:", error);
    throw new Error(await formatAquaGptInvokeError(error, data));
  }

  if (data?.error) {
    throw new Error(await formatAquaGptInvokeError(null, data));
  }

  const answer = data?.answer?.trim();
  if (!answer) {
    throw new Error(
      isDev
        ? `AquaGPT returned an empty answer. Raw response: ${formatUnknownError(data)}`
        : "AquaGPT returned an empty answer.",
    );
  }

  return answer;
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
