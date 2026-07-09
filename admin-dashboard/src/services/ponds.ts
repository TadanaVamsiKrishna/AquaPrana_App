import { supabase } from "../lib/supabase";
import type { Pond } from "../types/pond";

export async function getPonds(): Promise<Pond[]> {
  const { data, error } = await supabase
    .from("ponds")
    .select(`
      *,
      users!ponds_user_id_fkey (
        name,
        phone,
        district,
        state
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(
    (pond: any): Pond => ({
      id: pond.id,
      name: pond.name,
      farmerName: pond.users?.name ?? "",
      phone: pond.users?.phone ?? "",
      district: pond.users?.district ?? "",
      state: pond.users?.state ?? "",
      coordinates:
        pond.latitude && pond.longitude
          ? `${pond.latitude}, ${pond.longitude}`
          : "",
      status: pond.is_active ? "Stable" : "Warning",
      density: "Not Available",
      area: `${pond.area_acres} acres`,
      depth: `${pond.depth_ft} ft`,
    })
  );
}

export async function getPondById(id: string): Promise<Pond | undefined> {
  const ponds = await getPonds();
  return ponds.find((p) => p.id === id);
}