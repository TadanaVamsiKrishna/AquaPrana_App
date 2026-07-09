import { supabase } from "../lib/supabase";
import type { AquaGptSession, AquaGptUsage } from "../types/aquagpt";

export async function getAquaGptSessions(): Promise<AquaGptSession[]> {
  const { data, error } = await supabase
    .from("aquagpt_sessions")
    .select(`
      *,
      users (
        name,
        phone
      )
    `)
    .order("created_at", { ascending: false });

  console.log("AQUAGPT SESSIONS:", data);
  console.log("AQUAGPT SESSION ERROR:", error);

  if (error) throw error;

  return (data || []).map(
    (session: any): AquaGptSession => ({
      id: session.id,

      scope: session.pond_id ? "Pond Session" : "General",

      farmerName: session.users?.name ?? "",

      phone: session.users?.phone ?? "",

      model: "OpenAI GPT",

      messages: 0,

      tokens: 0,
    })
  );
}

export async function getAquaGptUsage(): Promise<AquaGptUsage[]> {
  const { data, error } = await supabase
    .from("aquagpt_sessions")
    .select(`
      *,
      users (
        name,
        phone
      )
    `)
    .order("created_at", { ascending: false });

  console.log("AQUAGPT USAGE:", data);
  console.log("AQUAGPT USAGE ERROR:", error);

  if (error) throw error;

  return (data || []).map(
    (session: any): AquaGptUsage => ({
      id: session.id,

      date: session.created_at,

      farmerName: session.users?.name ?? "",

      phone: session.users?.phone ?? "",

      messages: 0,

      tokens: 0,

      updatedAt: session.created_at,
    })
  );
}