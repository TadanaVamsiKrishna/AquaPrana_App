import { supabase } from "../lib/supabase";

export type UserProfile = {
  name: string;
  state: string;
  district: string;
  language: string;
  phone?: string;
};

export async function getCurrentUserProfile(): Promise<{
  profile: UserProfile | null;
  error: Error | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { profile: null, error: userError };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("name, state, district, language, phone")
    .eq("id", user.id)
    .maybeSingle();

  return { profile: data, error };
}

export async function farmerExistsForPhone(phone: string): Promise<{
  exists: boolean;
  profile: UserProfile | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, state, district, language, phone")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    return {
      exists: false,
      profile: null,
      error: new Error(error.message),
    };
  }

  if (data?.name?.trim()) {
    return { exists: true, profile: data, error: null };
  }

  const farmersResult = await supabase
    .from("farmers")
    .select("name, state, district, language, phone")
    .eq("phone", phone)
    .maybeSingle();

  if (farmersResult.error) {
    const isMissingTable =
      farmersResult.error.code === "PGRST205" ||
      farmersResult.error.message.toLowerCase().includes("does not exist");

    if (!isMissingTable) {
      return {
        exists: false,
        profile: null,
        error: new Error(farmersResult.error.message),
      };
    }

    return { exists: false, profile: null, error: null };
  }

  const farmer = farmersResult.data;

  if (farmer?.name?.trim()) {
    return {
      exists: true,
      profile: {
        name: farmer.name,
        state: farmer.state ?? "",
        district: farmer.district ?? "",
        language: farmer.language ?? "",
        phone: farmer.phone,
      },
      error: null,
    };
  }

  return { exists: false, profile: null, error: null };
}

export async function saveProfile(
  name: string,
  state: string,
  district: string,
  language: string
) {

  const {
    data:{user}
  } = await supabase.auth.getUser();

  return await supabase
      .from("users")
      .upsert({

        id:user?.id,

        phone:user?.phone,

        name,

        state,

        district,

        language

      });

}

