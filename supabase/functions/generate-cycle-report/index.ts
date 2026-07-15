import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse } from "./lib/cors.ts";
import { fetchCycleReportData } from "./lib/data.ts";
import { buildCycleReportPdf } from "./lib/pdf-builder.ts";

const REPORT_BUCKET = "reports";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization required" }, 401);
    }

    const { cycleId } = await req.json();

    if (!cycleId || typeof cycleId !== "string") {
      return jsonResponse({ error: "cycleId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const reportData = await fetchCycleReportData(
      supabaseAdmin,
      cycleId,
      user.id,
    );

    const pdfBytes = await buildCycleReportPdf(reportData);
    const storagePath = `${user.id}/${cycleId}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(REPORT_BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload report: ${uploadError.message}`);
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(REPORT_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(
        signedError?.message ?? "Failed to create signed URL for report.",
      );
    }

    return jsonResponse({
      signedUrl: signedData.signedUrl,
      reportTitle: reportData.reportTitle,
      generatedAt: new Date().toISOString(),
      storagePath,
    });
  } catch (error) {
    console.error("[generate-cycle-report]", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to generate report",
      },
      500,
    );
  }
});
