import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function hasGithubInstallation(
  workspaceId: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("github_installations")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("hasGithubInstallation:", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function hasVercelConnection(
  workspaceId: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("workspace_vercel_connections")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("hasVercelConnection:", error.message);
    return false;
  }
  return data !== null;
}
