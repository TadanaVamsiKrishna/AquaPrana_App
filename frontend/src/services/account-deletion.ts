import AsyncStorage from "@react-native-async-storage/async-storage";
import { AQUAGPT_FILES_BUCKET } from "../lib/aquagpt-files";
import { supabase } from "../lib/supabase";
import { logout } from "./auth";

const REPORTS_BUCKET = "reports";

async function deleteByUserId(table: string, userId: string) {
  const { error } = await supabase.from(table).delete().eq("user_id", userId);
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function listAllStoragePaths(
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
  });

  if (error || !data?.length) {
    return paths;
  }

  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id == null && !item.metadata) {
      paths.push(...(await listAllStoragePaths(bucket, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }

  return paths;
}

async function deleteUserStorageFiles(userId: string) {
  const aquagptPrefixes = [
    `audio/${userId}`,
    `images/${userId}`,
    `documents/${userId}`,
  ];

  for (const prefix of aquagptPrefixes) {
    const paths = await listAllStoragePaths(AQUAGPT_FILES_BUCKET, prefix);
    if (paths.length > 0) {
      await supabase.storage.from(AQUAGPT_FILES_BUCKET).remove(paths);
    }
  }

  const reportPaths = await listAllStoragePaths(REPORTS_BUCKET, userId);
  if (reportPaths.length > 0) {
    await supabase.storage.from(REPORTS_BUCKET).remove(reportPaths);
  }
}

async function deleteAccountClientSide(userId: string) {
  await deleteUserStorageFiles(userId);

  const { data: sessions } = await supabase
    .from("aquagpt_sessions")
    .select("id")
    .eq("user_id", userId);

  const sessionIds = (sessions ?? []).map((row) => row.id).filter(Boolean);
  if (sessionIds.length > 0) {
    await supabase.from("aquagpt_messages").delete().in("session_id", sessionIds);
  }

  await deleteByUserId("aquagpt_sessions", userId);
  await deleteByUserId("aquagpt_usage", userId);
  await deleteByUserId("inventory_orders", userId);
  await deleteByUserId("inventory_items", userId);
  await deleteByUserId("pond_expenses", userId);
  await deleteByUserId("farmer_price_configs", userId);
  await deleteByUserId("ponds", userId);

  const { error: userDeleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (userDeleteError) {
    throw new Error(userDeleteError.message);
  }
}

/**
 * Permanently deletes the signed-in user and all related app data.
 * Prefers the delete-account edge function; falls back to client deletes.
 */
export async function permanentlyDeleteCurrentAccount(): Promise<{
  error: Error | null;
}> {
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

  try {
    const { data, error } = await supabase.functions.invoke("delete-account", {
      method: "POST",
      body: {},
    });

    if (error || data?.error) {
      console.log(
        "[account-deletion] edge function failed, falling back:",
        error?.message ?? data?.error,
      );
      await deleteAccountClientSide(user.id);
    }

    try {
      await AsyncStorage.clear();
    } catch (storageError) {
      console.log("[account-deletion] AsyncStorage.clear:", storageError);
    }

    try {
      await logout();
    } catch (logoutError) {
      console.log("[account-deletion] logout:", logoutError);
    }

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error("Unable to delete account right now."),
    };
  }
}
