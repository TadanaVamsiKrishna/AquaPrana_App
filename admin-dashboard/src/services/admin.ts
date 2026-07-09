// import { supabase } from "../lib/supabase";

// export async function getAdminProfile() {
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();

//   if (!user) {
//     throw new Error("User not logged in");
//   }

//   const { data, error } = await supabase
//     .from("admins")
//     .select("*")
//     .eq("id", user.id)
//     .single();

//   if (error) throw error;

//   return data;
// }

import { supabase } from "../lib/supabase";

export async function getAdminProfile() {

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return null;

  return {
    id: data.id,
    name: data.full_name,
    email: data.email,
  };
}