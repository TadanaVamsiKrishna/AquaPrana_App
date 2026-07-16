
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ConversationTurn = {
  role?: string;
  text?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const {
      question,
      pondId,
      cycleId,
      userId,
      screen,
      mode,
      conversationHistory,
      latestLogsSummary,
      feedScheduleSummary,
      waterQualitySummary,
      inventorySummary,
    } = body ?? {};

    if (!question) {
      return new Response(
        JSON.stringify({
          error: "Question is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const isGeneric = mode === "generic" || !pondId;

    const history = Array.isArray(conversationHistory)
      ? (conversationHistory as ConversationTurn[])
          .slice(-6)
          .map((turn) => `${turn.role ?? "user"}: ${turn.text ?? ""}`)
          .join("\n")
      : "";

    let systemPrompt = "";
    let userContent = "";

    if (isGeneric) {
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
Pond ID: none
Crop Cycle ID: none

Recent Conversation:
${history || "none"}

Farmer Question:
${question}

Answer as a general aquaculture assistant. Do not use or invent pond-specific data.
`;
    } else {
      const { data: pond, error: pondError } = await supabase
        .from("ponds")
        .select("*")
        .eq("id", pondId)
        .single();

      if (pondError) {
        return new Response(
          JSON.stringify({
            error: pondError.message,
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      let cycle = null as Record<string, unknown> | null;
      if (cycleId) {
        const { data } = await supabase
          .from("crop_cycles")
          .select("*")
          .eq("id", cycleId)
          .maybeSingle();
        cycle = data;
      } else {
        const { data } = await supabase
          .from("crop_cycles")
          .select("*")
          .eq("pond_id", pondId)
          .ilike("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        cycle = data;
      }

      const { data: latestLog } = await supabase
        .from("pond_logs")
        .select("*")
        .eq("pond_id", pondId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const pondContext = `
Application Context
Mode: pond
User ID: ${userId ?? "unavailable"}
Current Screen: ${screen ?? "unavailable"}
Pond ID: ${pondId}
Cycle ID: ${cycle?.id ?? cycleId ?? "unavailable"}

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
${question}

Answer using the pond information above.
If information is missing, clearly mention that.
`;
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GROQ_API_KEY not found",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
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

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      return new Response(
        JSON.stringify({
          error: groqData,
        }),
        {
          status: groqResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        answer:
          groqData.choices?.[0]?.message?.content ?? "No response received.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
