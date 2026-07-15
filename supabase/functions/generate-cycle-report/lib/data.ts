import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type CycleReportData = {
  cycle: Record<string, unknown>;
  pond: Record<string, unknown>;
  logs: Record<string, unknown>[];
  priceConfig: Record<string, unknown> | null;
  cycleExpenses: Record<string, unknown> | null;
  userId: string;
  reportTitle: string;
};

export async function fetchCycleReportData(
  supabaseAdmin: SupabaseClient,
  cycleId: string,
  userId: string,
): Promise<CycleReportData> {
  const { data: cycle, error: cycleError } = await supabaseAdmin
    .from("crop_cycles")
    .select("*")
    .eq("id", cycleId)
    .maybeSingle();

  if (cycleError) {
    throw new Error(cycleError.message);
  }

  if (!cycle) {
    throw new Error("Crop cycle not found.");
  }

  const pondId = String(cycle.pond_id);

  const { data: pond, error: pondError } = await supabaseAdmin
    .from("ponds")
    .select("*")
    .eq("id", pondId)
    .maybeSingle();

  if (pondError) {
    throw new Error(pondError.message);
  }

  if (!pond || String(pond.user_id) !== userId) {
    throw new Error("You do not have access to this cycle report.");
  }

  const [logsResult, priceConfigResult, expensesResult] = await Promise.all([
    supabaseAdmin
      .from("pond_logs")
      .select("*")
      .eq("cycle_id", cycleId)
      .order("observed_at", { ascending: true }),
    supabaseAdmin
      .from("price_configs")
      .select("*")
      .eq("cycle_id", cycleId)
      .maybeSingle(),
    supabaseAdmin
      .from("cycle_expenses")
      .select("*")
      .eq("cycle_id", cycleId)
      .maybeSingle(),
  ]);

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  if (priceConfigResult.error) {
    throw new Error(priceConfigResult.error.message);
  }

  if (expensesResult.error) {
    throw new Error(expensesResult.error.message);
  }

  const reportTitle =
    String(cycle.status) === "closed"
      ? "Final Cycle Report"
      : "Current Cycle Report";

  return {
    cycle: cycle as Record<string, unknown>,
    pond: pond as Record<string, unknown>,
    logs: (logsResult.data ?? []) as Record<string, unknown>[],
    priceConfig: (priceConfigResult.data as Record<string, unknown> | null) ?? null,
    cycleExpenses: (expensesResult.data as Record<string, unknown> | null) ?? null,
    userId,
    reportTitle,
  };
}
