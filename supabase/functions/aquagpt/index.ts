
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_TIMEOUT_MS = 45_000;

type ConversationTurn = {
  role?: string;
  text?: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  const serviceKey =
    Deno.env.get("SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseUrl || !serviceKey) {
    console.error("[aquagpt] Missing SUPABASE_URL or service role key");
    return jsonResponse(
      { error: "Server configuration error: missing Supabase credentials." },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const {
      question,
      pondId,
      cycleId,
      userId,
      screen,
      mode,
      sessionId,
      conversationHistory,
      latestLogsSummary,
      feedScheduleSummary,
      waterQualitySummary,
      inventorySummary,
    } = body ?? {};

    console.log("[aquagpt] request", {
      mode,
      pondId: pondId ?? null,
      cycleId: cycleId ?? null,
      sessionId: sessionId ?? null,
      userId: userId ?? null,
      screen: screen ?? null,
      questionPreview:
        typeof question === "string" ? question.slice(0, 120) : question,
    });

    if (!question || typeof question !== "string" || !question.trim()) {
      return jsonResponse({ error: "Question is required" }, 400);
    }

    const resolvedPondId = isValidUuid(pondId) ? pondId : null;
    const resolvedCycleId = isValidUuid(cycleId) ? cycleId : null;
    const isGeneric = mode === "generic" || !resolvedPondId;

    const history = Array.isArray(conversationHistory)
      ? (conversationHistory as ConversationTurn[])
          .slice(-6)
          .map((turn) => `${turn.role ?? "user"}: ${turn.text ?? ""}`)
          .join("\n")
      : "";

    let systemPrompt = "";
    let userContent = "";

    if (isGeneric) {
      // Generic Assistant: question only — no pond/cycle/log/inventory fetches.
      systemPrompt = `
You are AquaGPT, an AI shrimp/fish farming assistant inside AquaPrana.

Mode: Generic Assistant (General Aquaculture)

Rules:
• Answer using general aquaculture knowledge only.
• Do NOT ask for pond selection unless the farmer wants pond-specific advice.
• Do NOT invent pond-specific readings, IDs, or farmer private data.
• Keep answers under 150 words.
• Use bullet points when helpful.
• Explain recommendations in simple language for farmers.
`;

      userContent = `
Application Context
Mode: generic
User ID: ${userId ?? "unavailable"}
Current Screen: ${screen ?? "unavailable"}
Session ID: ${sessionId ?? "unavailable"}
Pond ID: none
Crop Cycle ID: none

Recent Conversation:
${history || "none"}

Farmer Question:
${question.trim()}

Answer as a general aquaculture assistant. Do not use or invent pond-specific data.
`;
    } else {
      const { data: pond, error: pondError } = await supabase
        .from("ponds")
        .select("*")
        .eq("id", resolvedPondId)
        .single();

      if (pondError) {
        console.error("[aquagpt] pond fetch error:", pondError);
        return jsonResponse({ error: pondError.message }, 400);
      }

      let cycle = null as Record<string, unknown> | null;
      if (resolvedCycleId) {
        const { data } = await supabase
          .from("crop_cycles")
          .select("*")
          .eq("id", resolvedCycleId)
          .maybeSingle();
        cycle = data;
      } else {
        const { data } = await supabase
          .from("crop_cycles")
          .select("*")
          .eq("pond_id", resolvedPondId)
          .ilike("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        cycle = data;
      }

      const { data: latestLog } = await supabase
        .from("pond_logs")
        .select("*")
        .eq("pond_id", resolvedPondId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const pondContext = `
Application Context
Mode: pond
User ID: ${userId ?? "unavailable"}
Current Screen: ${screen ?? "unavailable"}
Session ID: ${sessionId ?? "unavailable"}
Pond ID: ${resolvedPondId}
Cycle ID: ${cycle?.id ?? resolvedCycleId ?? "unavailable"}

Selected Pond Information
Pond Name: ${pond?.name}
Area: ${pond?.area_acres} acres
Depth: ${pond?.depth_ft} ft

Active Crop Cycle
Species: ${cycle?.species ?? "unavailable"}
Status: ${cycle?.status ?? "unavailable"}
Biomass: ${cycle?.current_biomass_kg ?? "unavailable"} kg
Survival: ${cycle?.survival_rate ?? "unavailable"}%
FCR: ${cycle?.estimated_fcr ?? "unavailable"}
ABW: ${cycle?.current_abw_g ?? "unavailable"} g

Latest Water Quality (server)
DO: ${latestLog?.do_mgl}
pH: ${latestLog?.ph}
Temperature: ${latestLog?.temp_c} °C
Salinity: ${latestLog?.salinity_ppt} ppt
Ammonia: ${latestLog?.ammonia_mgl} mg/L
Calcium: ${latestLog?.calcium_mgl}
Magnesium: ${latestLog?.magnesium_mgl}
Potassium: ${latestLog?.potassium_mgl}
Feed Quantity: ${latestLog?.feed_qty_kg} kg
Mortality: ${latestLog?.mortality_count}
Observed At: ${latestLog?.observed_at}

Client Water Quality Summary:
${waterQualitySummary ?? "unavailable"}

Latest Pond Logs Summary:
${latestLogsSummary ?? "unavailable"}

Feed Schedule:
${feedScheduleSummary ?? "unavailable"}

Inventory Data:
${inventorySummary ?? "not requested"}

Recent Conversation:
${history || "none"}
`;

      systemPrompt = `
You are AquaGPT, an AI shrimp/fish farming assistant inside AquaPrana.

You receive live application context for the pond the farmer is currently viewing.

Rules:
• Always analyze the provided pond/cycle/log data before answering.
• Use the current pond context. Do not ask the farmer to select a pond if pond data is present.
• Mention actual values from the context.
• Never invent values. If missing, say unavailable.
• Keep answers under 150 words.
• Use bullet points when helpful.
• Explain recommendations in simple language.
`;

      userContent = `
${pondContext}

Farmer Question:
${question.trim()}

Answer using the pond information above.
If information is missing, clearly mention that.
`;
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");

    if (!apiKey) {
      console.error("[aquagpt] GROQ_API_KEY missing");
      return jsonResponse(
        { error: "LLM API key is missing." },
        500,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    let groqResponse: Response;
    try {
      groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userContent,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        },
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const aborted =
        fetchError instanceof DOMException && fetchError.name === "AbortError";
      console.error("[aquagpt] Groq fetch failed:", fetchError);
      return jsonResponse(
        {
          error: aborted
            ? "LLM request timed out."
            : fetchError instanceof Error
            ? fetchError.message
            : "Unable to reach LLM provider.",
        },
        aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("[aquagpt] Groq API error:", groqResponse.status, groqData);
      const message =
        typeof groqData?.error === "string"
          ? groqData.error
          : groqData?.error?.message ??
            JSON.stringify(groqData);
      return jsonResponse(
        { error: message, status: groqResponse.status },
        groqResponse.status >= 400 ? groqResponse.status : 502,
      );
    }

    const answer =
      groqData.choices?.[0]?.message?.content ?? "No response received.";

    console.log("[aquagpt] success", {
      mode: isGeneric ? "generic" : "pond",
      answerLength: typeof answer === "string" ? answer.length : 0,
    });

    return jsonResponse({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[aquagpt] unhandled error:", message, stack);
    return jsonResponse(
      {
        error: message,
        stack: stack ?? null,
      },
      500,
    );
  }
});
