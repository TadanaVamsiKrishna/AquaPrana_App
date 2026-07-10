



import { supabase } from "../lib/supabase";

export type SupabasePondRecord = {
  id: string;
  name: string;
  area_acres?: number | null;
  depth_ft?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  species?: string | null;
  stocking_date?: string | null;
  stocking_density?: number | string | null;
  cycle_day?: number | string | null;
  biomass?: string | null;
  survival_rate?: string | null;
  water_quality_status?: string | null;
  last_log_time?: string | null;
  archived?: boolean | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const mapSupabasePondName = (record: { name?: string | null }) =>
  record.name?.trim() ?? "";

export async function savePond(
  pondName: string,
  area: string,
  averageDepth: string,
  latitude?: number,
  longitude?: number,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("Current User:", user);

  if (!user) {
    return {
      data: null,
      error: {
        message: "User not logged in",
      },
    };
  }

  const { data, error } = await supabase
  .from("ponds")
  .insert({
    user_id: user.id,
    name: pondName,
    area_acres: Number(area),
    depth_ft: Number(averageDepth),
    latitude,
    longitude,
  })
  .select()
  .single();

  console.log("Inserted Data:", data);
  
  console.log("Insert Error:", error);

  return { data, error };
}

export async function getSupabasePonds() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      data: [] as SupabasePondRecord[],
      error: {
        message: "User not logged in",
      },
    };
  }

  const { data, error } = await supabase
    .from("ponds")
    .select(
      "id, name, area_acres, depth_ft, latitude, longitude, species, stocking_date, stocking_density, cycle_day, biomass, survival_rate, water_quality_status, last_log_time, archived, is_active, created_at, updated_at",
    )
    .eq("user_id", user.id);

  // Fall back to core columns if extended schema is not available yet.
  if (error) {
    const fallback = await supabase
      .from("ponds")
      .select("id, name, area_acres, depth_ft, latitude, longitude")
      .eq("user_id", user.id);

    return {
      data: (fallback.data ?? []) as SupabasePondRecord[],
      error: fallback.error,
    };
  }

  return {
    data: (data ?? []) as SupabasePondRecord[],
    error,
  };
}

export async function getSupabasePondById(id: string) {
  const { data, error } = await supabase
    .from("ponds")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
}