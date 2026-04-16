import type { SupabaseClient } from "@supabase/supabase-js";
import type { VercelProjectSelection } from "@/lib/vercel/types";
import { createServerSupabase } from "@/lib/supabase/server";

function normalizeRepoCoordinate(value: string): string {
  return value.trim().toLowerCase();
}

export async function getVercelProjectLinkByRepo(
  userId: string,
  workspaceId: string,
  repoOwner: string,
  repoName: string,
  client?: SupabaseClient,
): Promise<VercelProjectSelection | null> {
  const supabase = client ?? (await createServerSupabase());
  const normalizedOwner = normalizeRepoCoordinate(repoOwner);
  const normalizedRepo = normalizeRepoCoordinate(repoName);

  const { data: row, error } = await supabase
    .from("vercel_project_links")
    .select("project_id, project_name, team_id, team_slug")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("repo_owner", normalizedOwner)
    .eq("repo_name", normalizedRepo)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!row) {
    return null;
  }

  return {
    projectId: row.project_id as string,
    projectName: row.project_name as string,
    teamId: (row.team_id as string | null) ?? null,
    teamSlug: (row.team_slug as string | null) ?? null,
  };
}

export async function upsertVercelProjectLink(
  params: {
    userId: string;
    workspaceId: string;
    repoOwner: string;
    repoName: string;
    project: VercelProjectSelection;
  },
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createServerSupabase());
  const normalizedOwner = normalizeRepoCoordinate(params.repoOwner);
  const normalizedRepo = normalizeRepoCoordinate(params.repoName);
  const now = new Date().toISOString();

  const { error } = await supabase.from("vercel_project_links").upsert(
    {
      workspace_id: params.workspaceId,
      user_id: params.userId,
      repo_owner: normalizedOwner,
      repo_name: normalizedRepo,
      project_id: params.project.projectId,
      project_name: params.project.projectName,
      team_id: params.project.teamId,
      team_slug: params.project.teamSlug,
      created_at: now,
      updated_at: now,
    },
    {
      onConflict: "workspace_id,repo_owner,repo_name",
    },
  );
  if (error) {
    throw error;
  }
}
