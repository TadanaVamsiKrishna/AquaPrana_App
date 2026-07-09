// import { supabase } from "../lib/supabase";

// export async function getFarmers() {
//   const { data, error } = await supabase
//     .from("users")
//     .select("*")
//     .order("created_at", { ascending: false });

//   if (error) throw error;

//   return (data || []).map((user) => ({
//     id: user.id,
//     name: user.name,
//     phone: user.phone,
//     district: user.district,
//     state: user.state,
//     ponds: 0,
//     activeCycles: 0,
//     logs: 0,
//     expense: 0,
//     aquagpt: 0,
//     joinedAt: user.created_at,
//   }));
// }

export async function getFarmerById(id: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    district: data.district,
    state: data.state,
    ponds: 0,
    activeCycles: 0,
    logs: 0,
    expense: 0,
    aquagpt: 0,
    joinedAt: data.created_at,
  };
}

import { supabase } from "../lib/supabase";

export async function getFarmers() {
  const { data, error } = await supabase
    .from("users")
    .select("*");

  console.log("USERS DATA:", data);
  console.log("USERS ERROR:", error);

  if (error) throw error;

  return (data || []).map((user) => ({
    id: user.id,
    name: user.name,
    phone: user.phone,
    district: user.district,
    state: user.state,
    ponds: 0,
    activeCycles: 0,
    logs: 0,
    expense: 0,
    aquagpt: 0,
    joinedAt: user.created_at,
  }));
}