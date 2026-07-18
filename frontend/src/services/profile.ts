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

/** Soft-delete the signed-in user. Does not remove the row or related data. */
export async function softDeleteCurrentUser(
  phoneHint?: string | null,
): Promise<{ error: Error | null }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return {
      error:
        userError ??
        new Error("You must be signed in to delete your account."),
    };
  }

  const payload = {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  };

  // 1) Prefer update by auth user id (keeps FK relationships intact).
  const byId = await supabase
    .from("users")
    .update(payload)
    .eq("id", user.id)
    .select("id, is_deleted")
    .maybeSingle();

  if (byId.error) {
    const message = byId.error.message || "";
    if (
      message.toLowerCase().includes("is_deleted") ||
      message.toLowerCase().includes("deleted_at") ||
      message.toLowerCase().includes("column")
    ) {
      return {
        error: new Error(
          "Delete columns are missing on public.users. Run the soft-delete SQL in Supabase first (is_deleted, deleted_at).",
        ),
      };
    }
    return { error: new Error(message) };
  }

  if (byId.data?.id && byId.data.is_deleted === true) {
    return { error: null };
  }

  // 2) Fallback: update by phone (auth phone + profile phone variants).
  const candidates = [
    ...phoneLookupCandidates(user.phone ?? ""),
    ...phoneLookupCandidates(phoneHint ?? ""),
  ];
  const uniquePhones = [...new Set(candidates)];

  if (uniquePhones.length === 0) {
    return {
      error: new Error(
        "Unable to delete account. No matching user row was updated. Check RLS update policy on public.users.",
      ),
    };
  }

  const byPhone = await supabase
    .from("users")
    .update(payload)
    .in("phone", uniquePhones)
    .select("id, is_deleted")
    .maybeSingle();

  if (byPhone.error) {
    return { error: new Error(byPhone.error.message) };
  }

  if (byPhone.data?.id && byPhone.data.is_deleted === true) {
    return { error: null };
  }

  return {
    error: new Error(
      "Unable to delete account. No matching user row was updated. Ensure is_deleted/deleted_at exist and RLS allows updates on public.users.",
    ),
  };
}

function phoneLookupCandidates(phone: string): string[] {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (trimmed) candidates.add(trimmed);
  if (digits) {
    candidates.add(digits);
    candidates.add(`+${digits}`);
  }
  if (digits.length === 10) {
    candidates.add(`91${digits}`);
    candidates.add(`+91${digits}`);
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    candidates.add(digits.slice(2));
    candidates.add(`+${digits}`);
  }

  return [...candidates];
}

/**
 * If this phone/auth user was soft-deleted, restore the row and return the
 * profile. On any failure (including missing columns), returns restored:false
 * so the existing OTP login path continues unchanged.
 */
export async function restoreSoftDeletedAccountIfNeeded(
  phone: string,
): Promise<{ restored: boolean; profile: UserProfile | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return { restored: false, profile: null };
    }

    let row: {
      id: string;
      name: string | null;
      state: string | null;
      district: string | null;
      language: string | null;
      phone: string | null;
      is_deleted: boolean | null;
    } | null = null;

    const byId = await supabase
      .from("users")
      .select("id, name, state, district, language, phone, is_deleted")
      .eq("id", user.id)
      .maybeSingle();

    if (byId.error) {
      // Missing columns or RLS — never block OTP login.
      return { restored: false, profile: null };
    }

    if (byId.data?.is_deleted) {
      row = byId.data;
    } else if (!byId.data) {
      const candidates = phoneLookupCandidates(phone);
      if (candidates.length === 0) {
        return { restored: false, profile: null };
      }

      const byPhone = await supabase
        .from("users")
        .select("id, name, state, district, language, phone, is_deleted")
        .in("phone", candidates)
        .limit(1)
        .maybeSingle();

      if (byPhone.error || !byPhone.data?.is_deleted) {
        return { restored: false, profile: null };
      }

      // Keep FK relationships intact — only restore the auth user's own row.
      if (byPhone.data.id !== user.id) {
        return { restored: false, profile: null };
      }

      row = byPhone.data;
    } else {
      return { restored: false, profile: null };
    }

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("id", row.id)
      .select("name, state, district, language, phone")
      .maybeSingle();

    if (updateError || !updated) {
      return { restored: false, profile: null };
    }

    return {
      restored: true,
      profile: {
        name: updated.name ?? "",
        state: updated.state ?? "",
        district: updated.district ?? "",
        language: updated.language ?? "English",
        phone: updated.phone || phone || "",
      },
    };
  } catch {
    return { restored: false, profile: null };
  }
}
