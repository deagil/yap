import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Returns the repo info from the user's most recently created session
 * in the workspace that was started from a repository, or null if none exists.
 */
export async function getLastRepoByUserId(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
) {
  const supabase = client ?? (await createServerSupabase());
  const { data: rows, error } = await supabase
    .from("sessions")
    .select("repo_owner, repo_name")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    throw error;
  }

  for (const row of rows ?? []) {
    const owner = row.repo_owner as string | null | undefined;
    const repo = row.repo_name as string | null | undefined;
    if (owner && repo) {
      return { owner, repo };
    }
  }

  return null;
}
