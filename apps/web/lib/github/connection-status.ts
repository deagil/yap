export type GitHubConnectionStatus =
  | "not_connected"
  | "connected"
  | "reconnect_required";

export type GitHubConnectionReason =
  | "token_unavailable"
  | "installations_missing"
  | "sync_auth_failed";

export interface GitHubConnectionStatusResponse {
  status: GitHubConnectionStatus;
  reason: GitHubConnectionReason | null;
  /** User-scoped installation rows (used with OAuth sync / reconnect flows). */
  hasInstallations: boolean;
  syncedInstallationsCount: number | null;
  /** True when the active workspace has at least one GitHub App installation row. */
  workspaceGithubAppInstalled: boolean;
  workspaceInstallationCount: number;
  /** User has a linked GitHub OAuth account in `accounts`. */
  userGithubLinked: boolean;
}

export function buildGitHubReconnectUrl(next: string): string {
  const params = new URLSearchParams({ next });
  return `/api/auth/github/reconnect?${params.toString()}`;
}
