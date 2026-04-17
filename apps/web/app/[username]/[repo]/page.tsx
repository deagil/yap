import { nanoid } from "nanoid";
import { headers as nextHeaders } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  createSessionWithInitialChat,
  getUsedSessionTitles,
} from "@/lib/db/sessions";
import { getVercelProjectLinkByRepo } from "@/lib/db/vercel-project-links";
import { getUserPreferences } from "@/lib/db/user-preferences";
import {
  getRepoAccessToken,
  resolveInstallationIdForRepo,
} from "@/lib/github/workspace-token";
import { sanitizeUserPreferencesForSession } from "@/lib/model-access";
import { getRandomCityName } from "@/lib/random-city";
import { getServerSession } from "@/lib/session/get-server-session";
import type { NewSession } from "@/lib/db/types";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

interface RepoPageProps {
  params: Promise<{ username: string; repo: string }>;
}

interface GitHubRepoInfo {
  default_branch: string;
  clone_url: string;
  full_name: string;
}

async function fetchRepoInfo(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubRepoInfo | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers },
  );

  if (!response.ok) {
    console.error(
      `[repo-page] GitHub API returned ${response.status} for /repos/${owner}/${repo}`,
    );
    return null;
  }
  return response.json() as Promise<GitHubRepoInfo>;
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { username, repo } = await params;

  // Auth check -- redirect to sign-in, preserving the URL for return
  const session = await getServerSession();
  if (!session?.user) {
    redirect(
      `/api/auth/signin/vercel?next=${encodeURIComponent(`/${username}/${repo}`)}`,
    );
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId) {
    redirect(`/sign-in?next=${encodeURIComponent(`/${username}/${repo}`)}`);
  }

  const preferencesPromise = getUserPreferences(session.user.id, workspaceId);
  const savedVercelProjectPromise = getVercelProjectLinkByRepo(
    session.user.id,
    workspaceId,
    username,
    repo,
  );

  // Workspace installation token or user OAuth for private repo API access
  const access = await getRepoAccessToken({
    workspaceId,
    repoOwner: username,
    repoName: repo,
    userId: session.user.id,
  }).catch(() => null);
  const token = access?.token;

  // Validate the repo exists and get its default branch
  let repoInfo = await fetchRepoInfo(username, repo, token);

  // If authenticated request failed, retry without auth (public repos)
  if (!repoInfo && token) {
    repoInfo = await fetchRepoInfo(username, repo);
  }

  if (!repoInfo) {
    notFound();
  }

  // Use the user's preferred sandbox type and model
  const requestHost = (await nextHeaders()).get("host") ?? "";
  const [rawPreferences, savedVercelProject] = await Promise.all([
    preferencesPromise,
    savedVercelProjectPromise,
  ]);
  const preferences = sanitizeUserPreferencesForSession(
    rawPreferences,
    session,
    requestHost,
  );

  const cloneUrl = `https://github.com/${username}/${repo}.git`;

  const usedNames = await getUsedSessionTitles(session.user.id, workspaceId);
  const title = getRandomCityName(usedNames);

  const resolvedInstallationId = await resolveInstallationIdForRepo({
    workspaceId,
    repoOwner: username,
    repoName: repo,
    sessionInstallationId: null,
  });

  const newSession: NewSession = {
    id: nanoid(),
    workspaceId,
    userId: session.user.id,
    title,
    status: "running",
    repoOwner: username,
    repoName: repo,
    branch: repoInfo.default_branch,
    cloneUrl,
    vercelProjectId: savedVercelProject?.projectId ?? null,
    vercelProjectName: savedVercelProject?.projectName ?? null,
    vercelTeamId: savedVercelProject?.teamId ?? null,
    vercelTeamSlug: savedVercelProject?.teamSlug ?? null,
    isNewBranch: false,
    autoCommitPushOverride: preferences.autoCommitPush,
    autoCreatePrOverride: preferences.autoCommitPush
      ? preferences.autoCreatePr
      : false,
    globalSkillRefs: preferences.globalSkillRefs,
    sandboxState: { type: preferences.defaultSandboxType },
    lifecycleState: "provisioning",
    lifecycleVersion: 0,
    lastActivityAt: null,
    sandboxExpiresAt: null,
    hibernateAfter: null,
    lifecycleRunId: null,
    lifecycleError: null,
    linesAdded: null,
    linesRemoved: null,
    prNumber: null,
    prStatus: null,
    installationId: resolvedInstallationId,
    snapshotUrl: null,
    snapshotCreatedAt: null,
    snapshotSizeBytes: null,
    cachedDiff: null,
    cachedDiffUpdatedAt: null,
  };

  const result = await createSessionWithInitialChat({
    session: newSession,
    initialChat: {
      id: nanoid(),
      workspaceId,
      title: "New chat",
      modelId: preferences.defaultModelId,
    },
  });

  redirect(`/sessions/${result.session.id}/chats/${result.chat.id}`);
}
