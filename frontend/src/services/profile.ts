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
    .from("users")
    .select("name, state, district, language, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { profile: null, error: new Error(error.message) };
  }

  if (!data) {
    return {
      profile: {
        name: "",
        state: "",
        district: "",
        language: "English",
        phone: user.phone ?? "",
      },
      error: null,
    };
  }

  return {
    profile: {
      ...data,
      phone: data.phone || user.phone || "",
    },
    error: null,
  };
}

export async function farmerExistsForPhone(phone: string): Promise<{
  exists: boolean;
  profile: UserProfile | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("users")
    .select("name, state, district, language, phone")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    return { exists: false, profile: null, error: new Error(error.message) };
  }

  if (data?.name?.trim()) {
    return { exists: true, profile: data, error: null };
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
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return {
      data: null,
      error: new Error("You must be signed in to update your profile."),
    };
  }

  return await supabase.from("users").upsert({
    id: user.id,
    phone: user.phone,
    name,
    state,
    district,
    language,
  });
}

export async function updateCurrentUserProfile(input: {
  name: string;
  state: string;
  district: string;
  language: string;
}): Promise<{ error: Error | null }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return {
      error: userError ?? new Error("You must be signed in to update your profile."),
    };
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      name: input.name,
      state: input.state,
      district: input.district,
      language: input.language,
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: new Error(error.message) };
  }

  if (!data) {
    // Row may not exist yet for some accounts — fall back to upsert.
    const upsertResult = await saveProfile(
      input.name,
      input.state,
      input.district,
      input.language,
    );

    if (upsertResult.error) {
      return { error: new Error(upsertResult.error.message) };
    }
  }

  return { error: null };
}

