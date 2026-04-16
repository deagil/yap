import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import type { LinkedAccount, NewLinkedAccount } from "./types";

function mapRow(r: Record<string, unknown>): LinkedAccount {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    userId: String(r.user_id),
    provider: r.provider as LinkedAccount["provider"],
    externalId: String(r.external_id),
    providerWorkspaceId: (r.provider_workspace_id as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

async function db(client?: SupabaseClient) {
  return client ?? (await createServerSupabase());
}

export async function createLinkedAccount(
  data: Omit<NewLinkedAccount, "id" | "createdAt" | "updatedAt">,
  client?: SupabaseClient,
): Promise<LinkedAccount> {
  const supabase = await db(client);
  const id = nanoid();
  const now = new Date().toISOString();
  const { data: account, error } = await supabase
    .from("linked_accounts")
    .insert({
      id,
      workspace_id: data.workspaceId,
      user_id: data.userId,
      provider: data.provider,
      external_id: data.externalId,
      provider_workspace_id: data.providerWorkspaceId ?? null,
      metadata: data.metadata ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapRow(account as Record<string, unknown>);
}

export async function getLinkedAccountById(
  id: string,
  client?: SupabaseClient,
): Promise<LinkedAccount | undefined> {
  const supabase = await db(client);
  const { data, error } = await supabase
    .from("linked_accounts")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : undefined;
}

export async function getLinkedAccountsByUserId(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<LinkedAccount[]> {
  const supabase = await db(client);
  const { data, error } = await supabase
    .from("linked_accounts")
    .select()
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getLinkedAccountByProviderAndExternalId(
  provider: LinkedAccount["provider"],
  externalId: string,
  yapWorkspaceId?: string,
  client?: SupabaseClient,
): Promise<LinkedAccount | undefined> {
  const supabase = await db(client);
  let q = supabase
    .from("linked_accounts")
    .select()
    .eq("provider", provider)
    .eq("external_id", externalId);
  if (yapWorkspaceId !== undefined) {
    q = q.eq("workspace_id", yapWorkspaceId);
  }
  const { data, error } = await q.maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : undefined;
}

export async function updateLinkedAccount(
  id: string,
  data: Partial<Pick<LinkedAccount, "metadata">>,
  client?: SupabaseClient,
): Promise<LinkedAccount | undefined> {
  const supabase = await db(client);
  const { data: account, error } = await supabase
    .from("linked_accounts")
    .update({
      metadata: data.metadata ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    throw error;
  }
  return account ? mapRow(account as Record<string, unknown>) : undefined;
}

export async function deleteLinkedAccount(
  id: string,
  client?: SupabaseClient,
): Promise<boolean> {
  const supabase = await db(client);
  const { data, error } = await supabase
    .from("linked_accounts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    throw error;
  }
  return (data?.length ?? 0) > 0;
}

export async function deleteLinkedAccountsByUserId(
  userId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await db(client);
  const { data, error } = await supabase
    .from("linked_accounts")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) {
    throw error;
  }
  return data?.length ?? 0;
}
