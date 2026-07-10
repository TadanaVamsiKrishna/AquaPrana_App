
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  );

  try {
    const { question, pondId} = await req.json();
    const { data: pond, error: pondError } = await supabase
  .from("ponds")
  .select("*")
  .eq("id", pondId)
  .single();

console.log("Selected Pond:", pond);
console.log("Pond Error:", pondError);
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
    }
  );
}
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
        }
      );
    }
    const { data: latestLog, error: logError } = await supabase
    .from("pond_logs")
    .select("*")
    .eq("pond_id", pondId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  console.log("Latest Log:", latestLog);
  console.log("Log Error:", logError);
  const pondContext = `
Selected Pond Information

Pond Name: ${pond?.name}

Area: ${pond?.area_acres} acres

Depth: ${pond?.depth_ft} ft

Latest Water Quality

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

Biomass: ${latestLog?.biomass_kg}

Observed At:
${latestLog?.observed_at}
`;


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
        }
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
              content: `
              You are AquaGPT.
              
              You are an AI shrimp farming assistant.
              
              You will receive:
              
              1. Pond Information
              
              2. Latest Pond Log
              
              3. Farmer Question
              
              Rules:
              
              • Always analyze the pond data before answering.
              
              • Never ignore the pond data.
              
              • Mention actual values.
              
              Example:
              
              Current pH is 7.8 which is ideal.
              
              Current DO is 5.5 mg/L which is acceptable.
              
              Current ammonia is 0.8 mg/L which is high.
              
              • Never invent values.
              
              • If a value is missing, say it is unavailable.
              
              • Keep answers under 150 words.
              
              • Use bullet points whenever appropriate.
              
              • Explain recommendations in simple language.
              `
            },
            {
              role: "user",
              content: `
            ${pondContext}
            
            Farmer Question:
            
            ${question}
            
            Answer only using the pond information above.
            If information is missing, clearly mention that.
            `,
            },
          ],

          temperature: 0.3,
          max_tokens: 500,
        }),
      }
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
        }
      );
    }

    return new Response(
      JSON.stringify({
        answer: groqData.choices?.[0]?.message?.content ??
          "No response received.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
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
      }
    );
  }
});