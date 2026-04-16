import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { refreshVercelToken } from "./oauth";

interface WorkspaceVercelRow {
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  vercel_user_external_id: string | null;
}

export interface UserVercelAuthInfo {
  token: string;
  expiresAt: number;
  externalId: string;
}

async function loadWorkspaceVercelRow(
  workspaceId: string,
): Promise<WorkspaceVercelRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("workspace_vercel_connections")
    .select(
      "access_token_encrypted, refresh_token_encrypted, token_expires_at, vercel_user_external_id",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as WorkspaceVercelRow | null;
}

function toAuthInfo(params: {
  token: string;
  tokenExpiresAt: Date;
  externalId: string;
}): UserVercelAuthInfo {
  return {
    token: params.token,
    expiresAt: Math.floor(params.tokenExpiresAt.getTime() / 1000),
    externalId: params.externalId,
  };
}

async function refreshWorkspaceVercelAuth(
  workspaceId: string,
  row: WorkspaceVercelRow,
): Promise<UserVercelAuthInfo | null> {
  if (!row.refresh_token_encrypted) {
    return null;
  }

  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  const decryptedRefresh = decrypt(row.refresh_token_encrypted);
  const tokens = await refreshVercelToken({
    refreshToken: decryptedRefresh,
    clientId,
    clientSecret,
  });

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const admin = getSupabaseAdmin();
  await admin
    .from("workspace_vercel_connections")
    .update({
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : row.refresh_token_encrypted,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId);

  return toAuthInfo({
    token: tokens.access_token,
    tokenExpiresAt: newExpiresAt,
    externalId: row.vercel_user_external_id ?? "",
  });
}

/**
 * Get a valid Vercel access token for the workspace preview integration.
 */
export async function getWorkspaceVercelAuthInfo(
  workspaceId: string,
): Promise<UserVercelAuthInfo | null> {
  try {
    const row = await loadWorkspaceVercelRow(workspaceId);
    if (!row?.access_token_encrypted) {
      return null;
    }

    const now = Date.now();
    const tokenExpiresAtMs = row.token_expires_at
      ? new Date(row.token_expires_at).getTime()
      : null;
    const isExpired = tokenExpiresAtMs !== null && tokenExpiresAtMs < now;

    if (!isExpired && row.token_expires_at) {
      return toAuthInfo({
        token: decrypt(row.access_token_encrypted),
        tokenExpiresAt: new Date(row.token_expires_at),
        externalId: row.vercel_user_external_id ?? "",
      });
    }

    return refreshWorkspaceVercelAuth(workspaceId, row);
  } catch (error) {
    console.error("Error fetching Vercel auth:", error);
    return null;
  }
}

export async function getWorkspaceVercelToken(
  workspaceId: string,
): Promise<string | null> {
  const authInfo = await getWorkspaceVercelAuthInfo(workspaceId);
  if (authInfo) {
    return authInfo.token;
  }

  try {
    const row = await loadWorkspaceVercelRow(workspaceId);
    if (!row?.access_token_encrypted || row.token_expires_at) {
      return null;
    }

    return decrypt(row.access_token_encrypted);
  } catch (error) {
    console.error("Error fetching Vercel token:", error);
    return null;
  }
}

/** @deprecated Use getWorkspaceVercelToken(workspaceId) */
export async function getUserVercelToken(
  _userId: string,
): Promise<string | null> {
  void _userId;
  return null;
}

/** @deprecated Use getWorkspaceVercelAuthInfo(workspaceId) */
export async function getUserVercelAuthInfo(
  _userId: string,
): Promise<UserVercelAuthInfo | null> {
  void _userId;
  return null;
}
