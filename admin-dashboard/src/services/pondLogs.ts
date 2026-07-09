
import { supabase } from "../lib/supabase";
import type { PondLog } from "../types/pond";

export async function getPondLogs(): Promise<PondLog[]> {
  const { data, error } = await supabase
    .from("pond_logs")
    .select(`
      *,
      ponds!pond_logs_pond_id_fkey (
        name
      ),
      crop_cycles (
        id
      )
    `)
    .order("observed_at", { ascending: false });

  console.log("POND LOGS:", data);
  console.log("POND LOGS ERROR:", error);

  if (error) throw error;

  return (data || []).map(
    (log: any): PondLog => ({
      id: log.id,
      time: log.observed_at,

      pondName: log.ponds?.name ?? "",

      pondScore: "",

      farmerName: "",

      phone: "",

      doLevel: log.do_mgl ?? 0,

      ph: log.ph ?? 0,

      temp: log.temp_c ?? 0,

      ammonia: log.ammonia_mgl ?? 0,

      feedKg: log.feed_qty_kg ?? 0,

      mortality: log.mortality_count ?? 0,

      status: (log.mortality_count ?? 0) > 0 ? "Warning" : "Stable",
    })
  );
}
