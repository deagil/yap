import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { createServerSupabase } from "@/lib/supabase/server";
import type { GitHubInstallation, NewGitHubInstallation } from "./types";

export interface UpsertInstallationInput {
  workspaceId: string;
  userId: string;
  installationId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
  installationUrl?: string | null;
}

function mapInstallation(r: Record<string, unknown>): GitHubInstallation {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    userId: String(r.user_id),
    installationId: Number(r.installation_id),
    accountLogin: String(r.account_login),
    accountType: r.account_type as "User" | "Organization",
    repositorySelection: r.repository_selection as "all" | "selected",
    installationUrl: (r.installation_url as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  };
}

export async function upsertInstallation(
  data: UpsertInstallationInput,
  client?: SupabaseClient,
): Promise<GitHubInstallation> {
  const supabase = client ?? (await createServerSupabase());

  const { data: byInst, error: errInst } = await supabase
    .from("github_installations")
    .select("id")
    .eq("workspace_id", data.workspaceId)
    .eq("installation_id", data.installationId)
    .maybeSingle();
  if (errInst) {
    throw errInst;
  }

  const { data: byLogin, error: errLogin } = byInst
    ? { data: null, error: null }
    : await supabase
        .from("github_installations")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("account_login", data.accountLogin)
        .maybeSingle();
  if (errLogin) {
    throw errLogin;
  }

  const found = byInst ?? byLogin;

  const now = new Date().toISOString();
  const base = {
    workspace_id: data.workspaceId,
    user_id: data.userId,
    installation_id: data.installationId,
    account_login: data.accountLogin,
    account_type: data.accountType,
    repository_selection: data.repositorySelection,
    installation_url: data.installationUrl ?? null,
    updated_at: now,
  };

  if (found?.id) {
    const { data: updated, error } = await supabase
      .from("github_installations")
      .update(base)
      .eq("id", found.id)
      .select()
      .single();
    if (error) {
      throw error;
    }
    return mapInstallation(updated as Record<string, unknown>);
  }

  const installation: NewGitHubInstallation = {
    id: nanoid(),
    workspaceId: data.workspaceId,
    userId: data.userId,
    installationId: data.installationId,
    accountLogin: data.accountLogin,
    accountType: data.accountType,
    repositorySelection: data.repositorySelection,
    installationUrl: data.installationUrl ?? null,
  };

  const { data: created, error } = await supabase
    .from("github_installations")
    .insert({
      id: installation.id,
      workspace_id: installation.workspaceId,
      user_id: installation.userId,
      installation_id: installation.installationId,
      account_login: installation.accountLogin,
      account_type: installation.accountType,
      repository_selection: installation.repositorySelection,
      installation_url: installation.installationUrl,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapInstallation(created as Record<string, unknown>);
}

export async function getInstallationsByUserId(
  userId: string,
  client?: SupabaseClient,
): Promise<GitHubInstallation[]> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .select()
    .eq("user_id", userId)
    .order("account_login", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapInstallation(r as Record<string, unknown>));
}

export async function getInstallationsForWorkspace(
  workspaceId: string,
  userId: string,
  client?: SupabaseClient,
): Promise<GitHubInstallation[]> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .select()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("account_login", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapInstallation(r as Record<string, unknown>));
}

export async function getInstallationByAccountLogin(
  workspaceId: string,
  userId: string,
  accountLogin: string,
  client?: SupabaseClient,
): Promise<GitHubInstallation | undefined> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .select()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("account_login", accountLogin)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapInstallation(data as Record<string, unknown>) : undefined;
}

export async function getInstallationByUserAndId(
  workspaceId: string,
  userId: string,
  installationId: number,
  client?: SupabaseClient,
): Promise<GitHubInstallation | undefined> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .select()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("installation_id", installationId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapInstallation(data as Record<string, unknown>) : undefined;
}

export async function getInstallationsByInstallationId(
  installationId: number,
  client?: SupabaseClient,
): Promise<GitHubInstallation[]> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .select()
    .eq("installation_id", installationId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapInstallation(r as Record<string, unknown>));
}

export async function deleteInstallationByInstallationId(
  installationId: number,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .delete()
    .eq("installation_id", installationId)
    .select("id");
  if (error) {
    throw error;
  }
  return data?.length ?? 0;
}

export async function deleteInstallationsByUserId(
  userId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("github_installations")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw error;
  }
  return data?.length ?? 0;
}

export async function deleteInstallationsNotInList(
  workspaceId: string,
  userId: string,
  installationIds: number[],
  client?: SupabaseClient,
): Promise<number> {
  const supabase = client ?? (await createServerSupabase());
  if (installationIds.length === 0) {
    const { data, error } = await supabase
      .from("github_installations")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .select("id");
    if (error) {
      throw error;
    }
    return data?.length ?? 0;
  }

  const inList = `(${installationIds.join(",")})`;
  const { data, error } = await supabase
    .from("github_installations")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .not("installation_id", "in", inList)
    .select("id");
  if (error) {
    throw error;
  }
  return data?.length ?? 0;
}

export async function updateInstallationsByInstallationId(
  installationId: number,
  updates: {
    accountLogin?: string;
    accountType?: "User" | "Organization";
    repositorySelection?: "all" | "selected";
    installationUrl?: string | null;
  },
  client?: SupabaseClient,
): Promise<number> {
  if (
    updates.accountLogin === undefined &&
    updates.accountType === undefined &&
    updates.repositorySelection === undefined &&
    updates.installationUrl === undefined
  ) {
    return 0;
  }

  const supabase = client ?? (await createServerSupabase());
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.accountLogin !== undefined) {
    row.account_login = updates.accountLogin;
  }
  if (updates.accountType !== undefined) {
    row.account_type = updates.accountType;
  }
  if (updates.repositorySelection !== undefined) {
    row.repository_selection = updates.repositorySelection;
  }
  if (updates.installationUrl !== undefined) {
    row.installation_url = updates.installationUrl;
  }

  const { data, error } = await supabase
    .from("github_installations")
    .update(row)
    .eq("installation_id", installationId)
    .select("id");
  if (error) {
    throw error;
  }
  return data?.length ?? 0;
}
