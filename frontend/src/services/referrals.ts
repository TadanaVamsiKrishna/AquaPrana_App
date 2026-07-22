import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";
import { supabase } from "../lib/supabase";

export const REFERRAL_REWARD_AMOUNT = 100;
export const REFERRAL_INVITE_BASE_URL = "https://aquaprana.app/invite";
export const REFERRAL_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.aquaprana";

export type ReferralCoupon = {
  id: string;
  couponCode: string;
  rewardAmount: number;
  title: string;
  expiryDate: string | null;
  redeemed: boolean;
  createdAt: string;
};

export type ReferralStats = {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
};

function sanitizeNamePart(name?: string | null) {
  const cleaned = (name ?? "USER")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return cleaned || "USER";
}

function buildReferralCode(name?: string | null) {
  const prefix = sanitizeNamePart(name);
  const suffix = Math.floor(10000 + Math.random() * 90000).toString();
  return `${prefix}${suffix}`.slice(0, 16);
}

export function buildReferralLink(code: string) {
  return `${REFERRAL_INVITE_BASE_URL}?code=${encodeURIComponent(code)}`;
}

export function buildPlayStoreReferralLink(code: string) {
  return `${REFERRAL_PLAY_STORE_URL}&ref=${encodeURIComponent(code)}`;
}

export function buildShareMessage(code: string) {
  const inviteLink = buildReferralLink(code);
  const storeLink = buildPlayStoreReferralLink(code);

  return [
    "🐟 Join me on AquaPrana!",
    "",
    "Manage your ponds smarter with AI-powered aquaculture insights, pond monitoring, water quality tracking, inventory management, and AquaGPT assistance.",
    "",
    "Download AquaPrana using my referral code:",
    "",
    `Referral Code:`,
    code,
    "",
    "Install AquaPrana:",
    storeLink,
    "",
    `Or open: ${inviteLink}`,
  ].join("\n");
}

async function getAuthUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: error ?? new Error("Not signed in.") };
  }

  return { user, error: null };
}

export async function ensureReferralCode(
  displayName?: string | null,
): Promise<{ code: string | null; error: Error | null }> {
  const { user, error: authError } = await getAuthUser();
  if (!user) {
    return { code: null, error: authError };
  }

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("name, referral_code")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) {
    return { code: null, error: new Error(existingError.message) };
  }

  if (existing?.referral_code?.trim()) {
    return { code: existing.referral_code.trim().toUpperCase(), error: null };
  }

  const name = displayName?.trim() || existing?.name || user.user_metadata?.name;
  let attempts = 0;

  while (attempts < 8) {
    attempts += 1;
    const candidate = buildReferralCode(name);

    const { data, error } = await supabase
      .from("users")
      .update({ referral_code: candidate })
      .eq("id", user.id)
      .is("referral_code", null)
      .select("referral_code")
      .maybeSingle();

    if (!error && data?.referral_code) {
      return { code: data.referral_code, error: null };
    }

    // Row may not exist yet — upsert with code.
    if (error || !data) {
      const upsert = await supabase.from("users").upsert({
        id: user.id,
        phone: user.phone,
        referral_code: candidate,
        name: name || null,
      });

      if (!upsert.error) {
        const again = await supabase
          .from("users")
          .select("referral_code")
          .eq("id", user.id)
          .maybeSingle();

        if (again.data?.referral_code) {
          return {
            code: again.data.referral_code.trim().toUpperCase(),
            error: null,
          };
        }
      }

      // Unique conflict — try another code.
      if (error?.code === "23505" || upsert.error?.code === "23505") {
        continue;
      }

      if (upsert.error) {
        return { code: null, error: new Error(upsert.error.message) };
      }
    }
  }

  return {
    code: null,
    error: new Error("Unable to generate a unique referral code."),
  };
}

export async function fetchReferralStats(): Promise<{
  stats: ReferralStats;
  error: Error | null;
}> {
  const empty: ReferralStats = {
    totalReferrals: 0,
    successfulReferrals: 0,
    pendingReferrals: 0,
    totalRewardsEarned: 0,
  };

  const { user, error: authError } = await getAuthUser();
  if (!user) {
    return { stats: empty, error: authError };
  }

  const { data: referralRows, error: referralError } = await supabase
    .from("referrals")
    .select("status")
    .eq("referrer_user_id", user.id);

  if (referralError) {
    return { stats: empty, error: new Error(referralError.message) };
  }

  const rows = referralRows ?? [];
  const successful = rows.filter((row) => row.status === "successful").length;
  const pending = rows.filter((row) => row.status === "pending").length;

  const { data: coupons, error: couponError } = await supabase
    .from("reward_coupons")
    .select("reward_amount")
    .eq("user_id", user.id);

  if (couponError) {
    return {
      stats: {
        totalReferrals: rows.length,
        successfulReferrals: successful,
        pendingReferrals: pending,
        totalRewardsEarned: 0,
      },
      error: new Error(couponError.message),
    };
  }

  const totalRewardsEarned = (coupons ?? []).reduce(
    (sum, row) => sum + Number(row.reward_amount ?? 0),
    0,
  );

  return {
    stats: {
      totalReferrals: rows.length,
      successfulReferrals: successful,
      pendingReferrals: pending,
      totalRewardsEarned,
    },
    error: null,
  };
}

export async function fetchRewardCoupons(): Promise<{
  coupons: ReferralCoupon[];
  error: Error | null;
}> {
  const { user, error: authError } = await getAuthUser();
  if (!user) {
    return { coupons: [], error: authError };
  }

  const { data, error } = await supabase
    .from("reward_coupons")
    .select(
      "id, coupon_code, reward_amount, title, expiry_date, redeemed, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { coupons: [], error: new Error(error.message) };
  }

  return {
    coupons: (data ?? []).map((row) => ({
      id: row.id,
      couponCode: row.coupon_code,
      rewardAmount: Number(row.reward_amount ?? 0),
      title: row.title?.trim() || `₹${Number(row.reward_amount ?? 0)} OFF`,
      expiryDate: row.expiry_date,
      redeemed: Boolean(row.redeemed),
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export async function applyReferralCode(
  code: string,
): Promise<{ ok: boolean; error: Error | null }> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { ok: false, error: new Error("Referral code is required.") };
  }

  const { data, error } = await supabase.rpc("apply_referral_code", {
    p_code: trimmed,
  });

  if (error) {
    return { ok: false, error: new Error(error.message) };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return {
      ok: false,
      error: new Error(result?.error || "Unable to apply referral code."),
    };
  }

  return { ok: true, error: null };
}

export async function copyText(value: string): Promise<{ error: Error | null }> {
  try {
    await Clipboard.setStringAsync(value);
    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("Unable to copy to clipboard."),
    };
  }
}

export async function shareReferralInvite(
  code: string,
): Promise<{ error: Error | null }> {
  try {
    await Share.share({
      message: buildShareMessage(code),
      title: "Join AquaPrana",
      url: buildReferralLink(code),
    });
    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error : new Error("Unable to open share sheet."),
    };
  }
}

export function formatExpiryDate(isoDate: string | null) {
  if (!isoDate) {
    return "—";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
