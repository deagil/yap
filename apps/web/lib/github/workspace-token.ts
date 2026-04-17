import "server-only";

import { Octokit } from "@octokit/rest";
import { getInstallationByWorkspaceAndAccountLogin } from "@/lib/db/installations";
import {
  getWorkspaceRepo,
  workspaceHasRepoAllowlist,
} from "@/lib/db/workspace-repos";
import {
  getInstallationToken,
  getInstallationOctokit,
} from "@/lib/github/app-auth";
import { getUserGitHubToken } from "@/lib/github/user-token";

const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;

type CachedToken = { token: string; expiresAtMs: number };

const installationTokenCache = new Map<number, CachedToken>();

function getCachedInstallationToken(installationId: number): string | null {
  const hit = installationTokenCache.get(installationId);
  if (!hit || hit.expiresAtMs <= Date.now()) {
    return null;
  }
  return hit.token;
}

function setCachedInstallationToken(installationId: number, token: string) {
  installationTokenCache.set(installationId, {
    token,
    expiresAtMs: Date.now() + TOKEN_CACHE_TTL_MS,
  });
}

export type RepoTokenSource = "installation" | "user";

export type ResolvedRepoToken = {
  token: string;
  source: RepoTokenSource;
  installationId: number | null;
};

/**
 * Resolve GitHub App installation_id for a repo in a workspace.
 * Order: session cache → workspace_repos allowlist → github_installations by account.
 */
export async function resolveInstallationIdForRepo(params: {
  workspaceId: string;
  repoOwner: string;
  repoName?: string | null;
  sessionInstallationId?: number | null;
  /**
   * When the workspace uses a repo allowlist but the operation targets a new or
   * not-yet-listed repo (e.g. `POST /orgs/{org}/repos`), skip the allowlist
   * gate and resolve installation from `github_installations` only.
   */
  allowUnlistedTarget?: boolean;
}): Promise<number | null> {
  const {
    workspaceId,
    repoOwner,
    repoName,
    sessionInstallationId,
    allowUnlistedTarget,
  } = params;

  if (sessionInstallationId != null && Number.isFinite(sessionInstallationId)) {
    return sessionInstallationId;
  }

  const allowlist = await workspaceHasRepoAllowlist(workspaceId);
  if (allowlist && !allowUnlistedTarget) {
    if (!repoName) {
      return null;
    }
    const row = await getWorkspaceRepo(workspaceId, repoOwner, repoName);
    return row?.installationId ?? null;
  }

  if (repoName) {
    const optionalRow = await getWorkspaceRepo(
      workspaceId,
      repoOwner,
      repoName,
    );
    if (optionalRow) {
      return optionalRow.installationId;
    }
  }

  const inst = await getInstallationByWorkspaceAndAccountLogin(
    workspaceId,
    repoOwner,
  );
  return inst?.installationId ?? null;
}

/**
 * Mint or return cached installation access token (~1h lifetime; cache ~50m).
 */
export async function getWorkspaceGitHubToken(
  installationId: number,
): Promise<string> {
  const cached = getCachedInstallationToken(installationId);
  if (cached) {
    return cached;
  }
  const token = await getInstallationToken(installationId);
  setCachedInstallationToken(installationId, token);
  return token;
}

export function getWorkspaceOctokit(installationId: number): Octokit {
  return getInstallationOctokit(installationId);
}

/**
 * Prefer workspace installation token for git/GitHub API; fall back to user OAuth.
 */
export async function getRepoAccessToken(params: {
  workspaceId: string;
  repoOwner: string;
  repoName?: string | null;
  userId: string;
  sessionInstallationId?: number | null;
  allowUnlistedTarget?: boolean;
}): Promise<ResolvedRepoToken | null> {
  const installationId = await resolveInstallationIdForRepo({
    workspaceId: params.workspaceId,
    repoOwner: params.repoOwner,
    repoName: params.repoName,
    sessionInstallationId: params.sessionInstallationId,
    allowUnlistedTarget: params.allowUnlistedTarget,
  });

  if (installationId != null) {
    try {
      const token = await getWorkspaceGitHubToken(installationId);
      return { token, source: "installation", installationId };
    } catch (error) {
      console.error(
        "getRepoAccessToken: installation token failed, falling back to user",
        { installationId, error },
      );
    }
  }

  const userToken = await getUserGitHubToken(params.userId);
  if (userToken) {
    return {
      token: userToken,
      source: "user",
      installationId: installationId ?? null,
    };
  }

  return null;
}
