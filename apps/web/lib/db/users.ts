import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Check if a user exists in the database by ID.
 * Returns true if found, false otherwise. Lightweight query (only fetches the ID).
 */
export async function userExists(
  userId: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data != null;
}
