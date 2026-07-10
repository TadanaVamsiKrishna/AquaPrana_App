import { supabase } from "../lib/supabase";
import { getCropCycleForPond } from "./cropCycle";

export async function saveDailyLog(data: {
  pondId: string;
  observedAt: string;
  dissolvedOxygen: string;
  ph: string;
  temperature: string;
  salinity: string;
  ammonia: string;
  calcium: string;
  magnesium: string;
  potassium: string;
  feedQty: string;
  feedBrand: string;
  mortalityCount: string;
  abwSample: string;
  treatment: string;
  notes: string;
}) {
  const cycle = await getCropCycleForPond(data.pondId);

  if (!cycle) {
    throw new Error(
      "No crop cycle found for this pond. Please complete crop setup before saving a daily log.",
    );
  }

  // Insert the daily log

  const { data: result, error } = await supabase
    .from("pond_logs")
    .insert({
      pond_id: data.pondId,
      cycle_id: cycle.id,

      observed_at: data.observedAt,

      do_mgl: Number(data.dissolvedOxygen),
      ph: Number(data.ph),
      temp_c: Number(data.temperature),
      salinity_ppt: Number(data.salinity),
      ammonia_mgl: Number(data.ammonia),

      calcium_mgl: Number(data.calcium),
      magnesium_mgl: Number(data.magnesium),
      potassium_mgl: Number(data.potassium),

      feed_qty_kg: Number(data.feedQty),
      feed_brand: data.feedBrand,

      mortality_count: Number(data.mortalityCount),

      abw_g: Number(data.abwSample),

      treatment: data.treatment,

      notes: data.notes,

      param_source: "manual",
    })
    .select()
    .single();

  if (error) throw error;

  return result;
}

export type DailyLogEntry = {
    id: string;
    pondId: string;
  
    observedAt: string;
  
    dissolvedOxygen: string;
    ph: string;
    temperature: string;
    salinity: string;
    ammonia: string;
  
    calcium: string;
    magnesium: string;
    potassium: string;
  
    feedQty: string;
    feedBrand: string;
  
    mortalityCount: string;
  
    abwSample: string;
  
    treatment: string;
    notes: string;
  };

export async function getLogsForPond(pondId: string) {
    const { data, error } = await supabase
      .from("pond_logs")
      .select("*")
      .eq("pond_id", pondId)
      .order("observed_at", { ascending: false });
  
    if (error) throw error;
  
    return (data ?? []).map((log) => ({
      id: log.id,
      pondId: log.pond_id,
  
      observedAt: log.observed_at,
  
      dissolvedOxygen: String(log.do_mgl ?? ""),
      ph: String(log.ph ?? ""),
      temperature: String(log.temp_c ?? ""),
      salinity: String(log.salinity_ppt ?? ""),
      ammonia: String(log.ammonia_mgl ?? ""),
  
      calcium: String(log.calcium_mgl ?? ""),
      magnesium: String(log.magnesium_mgl ?? ""),
      potassium: String(log.potassium_mgl ?? ""),
  
      feedQty: String(log.feed_qty_kg ?? ""),
      feedBrand: log.feed_brand ?? "",
  
      mortalityCount: String(log.mortality_count ?? ""),
  
      abwSample: String(log.abw_g ?? ""),
  
      treatment: log.treatment ?? "",
      notes: log.notes ?? "",
    }));
  }