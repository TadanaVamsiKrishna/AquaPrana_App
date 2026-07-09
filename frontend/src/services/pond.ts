// import { supabase } from "../lib/supabase";

// export async function addPond(

//     pond_name:string,

//     area:number,

//     depth:number,

//     culture:string

// ){

// const {

// data:{user}

// }=await supabase.auth.getUser();

// return await supabase

// .from("ponds")

// .insert({

// user_id:user?.id,

// pond_name,

// area,

// depth,

// culture

// });

// }



import { supabase } from "../lib/supabase";

export type SupabasePondRecord = {
  id: string;
  name: string;
  area_acres?: number | null;
  depth_ft?: number | null;
  latitude?: number | null;
  longitude?: number | null;
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
    .select();

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
    .select("id, name, area_acres, depth_ft, latitude, longitude")
    .eq("user_id", user.id);

  return {
    data: (data ?? []) as SupabasePondRecord[],
    error,
  };
}