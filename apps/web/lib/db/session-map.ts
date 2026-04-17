import type { SandboxState } from "@open-harness/sandbox";
import type {
  Chat,
  ChatMessage,
  ChatRead,
  NewChat,
  NewChatMessage,
  NewChatRead,
  NewSession,
  NewShare,
  Session,
  Share,
} from "./types";

export function normalizeLegacySandboxState(
  sandboxState: unknown,
): SandboxState | null | undefined {
  if (!sandboxState || typeof sandboxState !== "object") {
    return sandboxState as null | undefined;
  }

  const state = sandboxState as Record<string, unknown>;
  const normalizedType = state.type === "hybrid" ? "vercel" : state.type;
  const sandboxName =
    typeof state.sandboxName === "string" && state.sandboxName.length > 0
      ? state.sandboxName
      : typeof state.sandboxId === "string" && state.sandboxId.length > 0
        ? state.sandboxId
        : undefined;

  if (normalizedType !== "vercel") {
    return sandboxState as SandboxState;
  }

  if (normalizedType === state.type && sandboxName === undefined) {
    return sandboxState as SandboxState;
  }

  const normalizedState: Record<string, unknown> = {
    ...state,
    type: normalizedType,
  };

  if (sandboxName !== undefined) {
    normalizedState.sandboxName = sandboxName;
    delete normalizedState.sandboxId;
  }

  return normalizedState as unknown as SandboxState;
}

function toDate(v: string | null | undefined): Date | null {
  if (v == null || v === "") {
    return null;
  }
  return new Date(v);
}

export function mapSession(r: Record<string, unknown>): Session {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    userId: String(r.user_id),
    title: String(r.title),
    status: r.status as Session["status"],
    repoOwner: (r.repo_owner as string | null) ?? null,
    repoName: (r.repo_name as string | null) ?? null,
    branch: (r.branch as string | null) ?? null,
    cloneUrl: (r.clone_url as string | null) ?? null,
    vercelProjectId: (r.vercel_project_id as string | null) ?? null,
    vercelProjectName: (r.vercel_project_name as string | null) ?? null,
    vercelTeamId: (r.vercel_team_id as string | null) ?? null,
    vercelTeamSlug: (r.vercel_team_slug as string | null) ?? null,
    isNewBranch: Boolean(r.is_new_branch),
    autoCommitPushOverride:
      r.auto_commit_push_override === null
        ? null
        : Boolean(r.auto_commit_push_override),
    autoCreatePrOverride:
      r.auto_create_pr_override === null
        ? null
        : Boolean(r.auto_create_pr_override),
    globalSkillRefs: (r.global_skill_refs as Session["globalSkillRefs"]) ?? [],
    sandboxState: normalizeLegacySandboxState(r.sandbox_state),
    lifecycleState: r.lifecycle_state as Session["lifecycleState"],
    lifecycleVersion: Number(r.lifecycle_version ?? 0),
    lastActivityAt: toDate(r.last_activity_at as string | null),
    sandboxExpiresAt: toDate(r.sandbox_expires_at as string | null),
    hibernateAfter: toDate(r.hibernate_after as string | null),
    lifecycleRunId: (r.lifecycle_run_id as string | null) ?? null,
    lifecycleError: (r.lifecycle_error as string | null) ?? null,
    linesAdded: r.lines_added != null ? Number(r.lines_added) : null,
    linesRemoved: r.lines_removed != null ? Number(r.lines_removed) : null,
    prNumber: r.pr_number != null ? Number(r.pr_number) : null,
    prStatus: r.pr_status as Session["prStatus"],
    installationId:
      r.installation_id != null ? Number(r.installation_id) : null,
    snapshotUrl: (r.snapshot_url as string | null) ?? null,
    snapshotCreatedAt: toDate(r.snapshot_created_at as string | null),
    snapshotSizeBytes:
      r.snapshot_size_bytes != null ? Number(r.snapshot_size_bytes) : null,
    cachedDiff: r.cached_diff,
    cachedDiffUpdatedAt: toDate(r.cached_diff_updated_at as string | null),
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

export function sessionToDb(
  data: NewSession & { updatedAt?: Date },
): Record<string, unknown> {
  const u = data.updatedAt ?? new Date();
  return {
    id: data.id,
    workspace_id: data.workspaceId,
    user_id: data.userId,
    title: data.title,
    status: data.status,
    repo_owner: data.repoOwner,
    repo_name: data.repoName,
    branch: data.branch,
    clone_url: data.cloneUrl,
    vercel_project_id: data.vercelProjectId,
    vercel_project_name: data.vercelProjectName,
    vercel_team_id: data.vercelTeamId,
    vercel_team_slug: data.vercelTeamSlug,
    is_new_branch: data.isNewBranch,
    auto_commit_push_override: data.autoCommitPushOverride,
    auto_create_pr_override: data.autoCreatePrOverride,
    global_skill_refs: data.globalSkillRefs,
    sandbox_state: data.sandboxState ?? null,
    lifecycle_state: data.lifecycleState ?? null,
    lifecycle_version: data.lifecycleVersion ?? 0,
    last_activity_at: data.lastActivityAt?.toISOString() ?? null,
    sandbox_expires_at: data.sandboxExpiresAt?.toISOString() ?? null,
    hibernate_after: data.hibernateAfter?.toISOString() ?? null,
    lifecycle_run_id: data.lifecycleRunId,
    lifecycle_error: data.lifecycleError,
    lines_added: data.linesAdded,
    lines_removed: data.linesRemoved,
    pr_number: data.prNumber,
    pr_status: data.prStatus,
    installation_id: data.installationId ?? null,
    snapshot_url: data.snapshotUrl,
    snapshot_created_at: data.snapshotCreatedAt?.toISOString() ?? null,
    snapshot_size_bytes: data.snapshotSizeBytes,
    cached_diff: data.cachedDiff ?? null,
    cached_diff_updated_at: data.cachedDiffUpdatedAt?.toISOString() ?? null,
    created_at: data.createdAt?.toISOString() ?? new Date().toISOString(),
    updated_at: u.toISOString(),
  };
}

export function mapChat(r: Record<string, unknown>): Chat {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    sessionId: String(r.session_id),
    title: String(r.title),
    modelId: (r.model_id as string | null) ?? null,
    activeStreamId: (r.active_stream_id as string | null) ?? null,
    lastAssistantMessageAt: toDate(
      r.last_assistant_message_at as string | null,
    ),
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

export function chatToDb(data: NewChat): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: data.id,
    workspace_id: data.workspaceId,
    session_id: data.sessionId,
    title: data.title,
    model_id: data.modelId ?? "anthropic/claude-haiku-4.5",
    active_stream_id: data.activeStreamId ?? null,
    last_assistant_message_at:
      data.lastAssistantMessageAt?.toISOString() ?? null,
    created_at: data.createdAt?.toISOString() ?? now,
    updated_at: data.updatedAt?.toISOString() ?? now,
  };
}

export function mapShare(r: Record<string, unknown>): Share {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    chatId: String(r.chat_id),
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

export function mapChatMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    chatId: String(r.chat_id),
    role: r.role as ChatMessage["role"],
    parts: r.parts,
    createdAt: new Date(String(r.created_at)),
  };
}

export function mapChatRead(r: Record<string, unknown>): ChatRead {
  return {
    userId: String(r.user_id),
    workspaceId: String(r.workspace_id),
    chatId: String(r.chat_id),
    lastReadAt: new Date(String(r.last_read_at)),
    createdAt: new Date(String(r.created_at)),
    updatedAt: new Date(String(r.updated_at)),
  };
}

export function shareToDb(data: NewShare): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: data.id,
    workspace_id: data.workspaceId,
    chat_id: data.chatId,
    created_at: data.createdAt?.toISOString() ?? now,
    updated_at: data.updatedAt?.toISOString() ?? now,
  };
}

export function chatMessageToDb(data: NewChatMessage): Record<string, unknown> {
  return {
    id: data.id,
    workspace_id: data.workspaceId,
    chat_id: data.chatId,
    role: data.role,
    parts: data.parts,
    created_at: data.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export function chatReadToDb(data: NewChatRead): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    user_id: data.userId,
    workspace_id: data.workspaceId,
    chat_id: data.chatId,
    last_read_at: data.lastReadAt?.toISOString() ?? now,
    created_at: data.createdAt?.toISOString() ?? now,
    updated_at: data.updatedAt?.toISOString() ?? now,
  };
}
