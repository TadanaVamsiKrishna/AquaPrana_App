import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function listAllPaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
  });

  if (error || !data?.length) {
    return paths;
  }

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id == null && !item.metadata) {
      paths.push(...(await listAllPaths(admin, bucket, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }

  return paths;
}

async function deleteStorageForUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const aquagptPrefixes = [
    `audio/${userId}`,
    `images/${userId}`,
    `documents/${userId}`,
  ];

  for (const prefix of aquagptPrefixes) {
    const paths = await listAllPaths(admin, "aquagpt-files", prefix);
    if (paths.length > 0) {
      await admin.storage.from("aquagpt-files").remove(paths);
    }
  }

  const reportPaths = await listAllPaths(admin, "reports", userId);
  if (reportPaths.length > 0) {
    await admin.storage.from("reports").remove(reportPaths);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = user.id;

    await deleteStorageForUser(admin, userId);

    const { data: sessions } = await admin
      .from("aquagpt_sessions")
      .select("id")
      .eq("user_id", userId);

    const sessionIds = (sessions ?? []).map((row) => row.id).filter(Boolean);
    if (sessionIds.length > 0) {
      await admin.from("aquagpt_messages").delete().in("session_id", sessionIds);
    }

    await admin.from("aquagpt_sessions").delete().eq("user_id", userId);
    await admin.from("aquagpt_usage").delete().eq("user_id", userId);
    await admin.from("inventory_orders").delete().eq("user_id", userId);
    await admin.from("inventory_items").delete().eq("user_id", userId);
    await admin.from("pond_expenses").delete().eq("user_id", userId);
    await admin.from("farmer_price_configs").delete().eq("user_id", userId);

    // Cascades crop_cycles, pond_logs, feeding_schedules, cycle_expenses, etc.
    await admin.from("ponds").delete().eq("user_id", userId);
    await admin.from("users").delete().eq("id", userId);

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      // Public data is already gone; auth cleanup failure should still be reported.
      console.error("auth.admin.deleteUser:", authDeleteError.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete account right now.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
