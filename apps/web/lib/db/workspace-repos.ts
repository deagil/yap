import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export type WorkspaceRepoRow = {
  workspaceId: string;
  repoOwner: string;
  repoName: string;
  installationId: number;
  addedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(r: Record<string, unknown>): WorkspaceRepoRow {
  return {
    workspaceId: String(r.workspace_id),
    repoOwner: String(r.repo_owner),
    repoName: String(r.repo_name),
    installationId: Number(r.installation_id),
    addedByUserId: r.added_by_user_id ? String(r.added_by_user_id) : null,
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

export async function workspaceHasRepoAllowlist(
  workspaceId: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const supabase = client ?? (await createServerSupabase());
  const { count, error } = await supabase
    .from("workspace_repos")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (error) {
    throw error;
  }
  return (count ?? 0) > 0;
}

export async function listWorkspaceRepos(
  workspaceId: string,
  client?: SupabaseClient,
): Promise<WorkspaceRepoRow[]> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("workspace_repos")
    .select()
    .eq("workspace_id", workspaceId)
    .order("repo_owner", { ascending: true })
    .order("repo_name", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getWorkspaceRepo(
  workspaceId: string,
  repoOwner: string,
  repoName: string,
  client?: SupabaseClient,
): Promise<WorkspaceRepoRow | null> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("workspace_repos")
    .select()
    .eq("workspace_id", workspaceId)
    .eq("repo_owner", repoOwner)
    .eq("repo_name", repoName)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function upsertWorkspaceRepo(input: {
  workspaceId: string;
  repoOwner: string;
  repoName: string;
  installationId: number;
  addedByUserId: string;
}): Promise<WorkspaceRepoRow> {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("workspace_repos")
    .upsert(
      {
        workspace_id: input.workspaceId,
        repo_owner: input.repoOwner,
        repo_name: input.repoName,
        installation_id: input.installationId,
        added_by_user_id: input.addedByUserId,
        updated_at: now,
      },
      {
        onConflict: "workspace_id,repo_owner,repo_name",
      },
    )
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapRow(data as Record<string, unknown>);
}

export async function deleteWorkspaceRepo(
  workspaceId: string,
  repoOwner: string,
  repoName: string,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("workspace_repos")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("repo_owner", repoOwner)
    .eq("repo_name", repoName);
  if (error) {
    throw error;
  }
}
