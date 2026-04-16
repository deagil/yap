import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { createServerSupabase } from "@/lib/supabase/server";

export async function upsertGitHubAccount(
  data: {
    userId: string;
    externalUserId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    username: string;
  },
  client?: SupabaseClient,
): Promise<string> {
  const supabase = client ?? (await createServerSupabase());

  const { data: existing, error: selErr } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", data.userId)
    .eq("provider", "github")
    .maybeSingle();
  if (selErr) {
    throw selErr;
  }

  const now = new Date().toISOString();
  const row = {
    external_user_id: data.externalUserId,
    access_token: data.accessToken,
    refresh_token: data.refreshToken ?? null,
    expires_at: data.expiresAt?.toISOString() ?? null,
    scope: data.scope ?? null,
    username: data.username,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("accounts")
      .update(row)
      .eq("id", existing.id);
    if (error) {
      throw error;
    }
    return existing.id;
  }

  const id = nanoid();
  const { error } = await supabase.from("accounts").insert({
    id,
    user_id: data.userId,
    provider: "github",
    ...row,
    created_at: now,
  });
  if (error) {
    throw error;
  }
  return id;
}

export async function getGitHubAccount(
  userId: string,
  client?: SupabaseClient,
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  username: string;
  externalUserId: string;
} | null> {
  const supabase = client ?? (await createServerSupabase());
  const { data, error } = await supabase
    .from("accounts")
    .select(
      "access_token, refresh_token, expires_at, username, external_user_id",
    )
    .eq("user_id", userId)
    .eq("provider", "github")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string | null) ?? null,
    expiresAt: data.expires_at ? new Date(data.expires_at as string) : null,
    username: data.username as string,
    externalUserId: data.external_user_id as string,
  };
}

export async function updateGitHubAccountTokens(
  userId: string,
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  },
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createServerSupabase());
  const { error } = await supabase
    .from("accounts")
    .update({
      access_token: data.accessToken,
      refresh_token: data.refreshToken ?? null,
      expires_at: data.expiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "github");
  if (error) {
    throw error;
  }
}

export async function deleteGitHubAccount(
  userId: string,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createServerSupabase());
  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "github");
  if (error) {
    throw error;
  }
}
