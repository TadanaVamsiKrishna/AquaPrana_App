import { supabase } from "../lib/supabase";

export async function sendOTP(phone: string) {
  return await supabase.auth.signInWithOtp({
    phone,
  });
}

export async function verifyOTP(
  phone: string,
  otp: string
) {
  return await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: "sms",
  });
}

export async function logout() {
  return await supabase.auth.signOut();
}