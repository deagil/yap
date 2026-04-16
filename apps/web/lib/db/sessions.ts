import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  chatMessageToDb,
  chatReadToDb,
  chatToDb,
  mapChat,
  mapChatMessage,
  mapChatRead,
  mapSession,
  mapShare,
  normalizeLegacySandboxState,
  sessionToDb,
  shareToDb,
} from "./session-map";
import type {
  Chat,
  ChatMessage,
  NewChat,
  NewChatMessage,
  NewChatRead,
  NewSession,
  NewShare,
  Session,
} from "./types";

export { normalizeLegacySandboxState };

async function resolveClient(
  client: SupabaseClient | undefined,
  workflow = false,
): Promise<SupabaseClient> {
  if (client) {
    return client;
  }
  if (workflow) {
    return getSupabaseAdmin();
  }
  return createServerSupabase();
}

export async function createSession(data: NewSession, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const row = sessionToDb(data);
  const { data: inserted, error } = await supabase
    .from("sessions")
    .insert(row)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapSession(inserted as Record<string, unknown>);
}

interface CreateSessionWithInitialChatInput {
  session: NewSession;
  initialChat: Pick<NewChat, "id" | "title" | "modelId" | "workspaceId">;
}

export async function createSessionWithInitialChat(
  input: CreateSessionWithInitialChatInput,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const sRow = sessionToDb(input.session);
  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .insert(sRow)
    .select()
    .single();
  if (sErr) {
    throw sErr;
  }

  const cRow = chatToDb({
    id: input.initialChat.id,
    workspaceId: input.initialChat.workspaceId,
    sessionId: (session as { id: string }).id,
    title: input.initialChat.title,
    modelId: input.initialChat.modelId ?? null,
    activeStreamId: null,
    lastAssistantMessageAt: null,
  });

  const { data: chat, error: cErr } = await supabase
    .from("chats")
    .insert(cRow)
    .select()
    .single();
  if (cErr) {
    throw cErr;
  }

  return {
    session: mapSession(session as Record<string, unknown>),
    chat: mapChat(chat as Record<string, unknown>),
  };
}

export async function getSessionById(
  sessionId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client, true);
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapSession(data as Record<string, unknown>) : null;
}

/** GitHub PR webhooks: match sessions by repo + PR number (service-role / admin client). */
export async function getSessionsByRepoAndPrNumber(
  repoOwner: string,
  repoName: string,
  prNumber: number,
  client?: SupabaseClient,
): Promise<Session[]> {
  const supabase = await resolveClient(client, true);
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .ilike("repo_owner", repoOwner)
    .ilike("repo_name", repoName)
    .eq("pr_number", prNumber);
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapSession(r as Record<string, unknown>));
}

export async function getShareById(shareId: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("shares")
    .select()
    .eq("id", shareId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapShare(data as Record<string, unknown>) : null;
}

export async function getShareByChatId(
  chatId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("shares")
    .select()
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapShare(data as Record<string, unknown>) : null;
}

export async function createShareIfNotExists(
  data: NewShare,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const row = shareToDb(data);
  const { data: inserted, error } = await supabase
    .from("shares")
    .insert(row)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return getShareByChatId(data.chatId, supabase);
    }
    throw error;
  }
  if (inserted) {
    return mapShare(inserted as Record<string, unknown>);
  }
  return getShareByChatId(data.chatId, supabase);
}

export async function deleteShareByChatId(
  chatId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("shares")
    .delete()
    .eq("chat_id", chatId);
  if (error) {
    throw error;
  }
}

export async function getSessionsByUserId(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapSession(r as Record<string, unknown>));
}

export async function countSessionsByUserId(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { count, error } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function countUserMessagesByUserId(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { data: sessions, error: sErr } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (sErr) {
    throw sErr;
  }
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (sessionIds.length === 0) {
    return 0;
  }
  const { data: chats, error: cErr } = await supabase
    .from("chats")
    .select("id")
    .in("session_id", sessionIds);
  if (cErr) {
    throw cErr;
  }
  const chatIds = (chats ?? []).map((c) => c.id as string);
  if (chatIds.length === 0) {
    return 0;
  }
  const { count, error } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "user")
    .in("chat_id", chatIds);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

type SessionSidebarFields = Pick<
  Session,
  | "id"
  | "title"
  | "status"
  | "repoOwner"
  | "repoName"
  | "branch"
  | "linesAdded"
  | "linesRemoved"
  | "prNumber"
  | "prStatus"
  | "createdAt"
>;

export type SessionWithUnread = SessionSidebarFields & {
  hasUnread: boolean;
  hasStreaming: boolean;
  latestChatId: string | null;
  lastActivityAt: Date;
};

type GetSessionsWithUnreadByUserIdOptions = {
  status?: "all" | "active" | "archived";
  limit?: number;
  offset?: number;
};

export async function getSessionsWithUnreadByUserId(
  _userId: string,
  workspaceId: string,
  options?: GetSessionsWithUnreadByUserIdOptions,
  client?: SupabaseClient,
): Promise<SessionWithUnread[]> {
  const supabase = await resolveClient(client);
  const status = options?.status ?? "all";
  const pStatus =
    status === "all" ? "all" : status === "active" ? "active" : "archived";

  const { data: rows, error } = await supabase.rpc("get_sessions_with_unread", {
    p_workspace_id: workspaceId,
    p_status: pStatus,
    p_limit: options?.limit ?? null,
    p_offset: options?.offset ?? 0,
  });
  if (error) {
    throw error;
  }

  return (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    title: r.title,
    status: r.status as Session["status"],
    repoOwner: r.repo_owner,
    repoName: r.repo_name,
    branch: r.branch,
    linesAdded: r.lines_added,
    linesRemoved: r.lines_removed,
    prNumber: r.pr_number,
    prStatus: r.pr_status as Session["prStatus"],
    createdAt: new Date(r.created_at as string),
    lastActivityAt: new Date(r.last_activity_at as string),
    hasUnread: r.has_unread,
    hasStreaming: r.has_streaming,
    latestChatId: r.latest_chat_id,
  }));
}

export async function getArchivedSessionCountByUserId(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<number> {
  const supabase = await resolveClient(client);
  const { count, error } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .eq("status", "archived");
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function getUsedSessionTitles(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<Set<string>> {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("sessions")
    .select("title")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map((r) => String(r.title)));
}

export async function updateSession(
  sessionId: string,
  data: Partial<Omit<NewSession, "id" | "userId" | "createdAt">>,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const map: [keyof typeof data, string][] = [
    ["title", "title"],
    ["workspaceId", "workspace_id"],
    ["status", "status"],
    ["repoOwner", "repo_owner"],
    ["repoName", "repo_name"],
    ["branch", "branch"],
    ["cloneUrl", "clone_url"],
    ["vercelProjectId", "vercel_project_id"],
    ["vercelProjectName", "vercel_project_name"],
    ["vercelTeamId", "vercel_team_id"],
    ["vercelTeamSlug", "vercel_team_slug"],
    ["isNewBranch", "is_new_branch"],
    ["autoCommitPushOverride", "auto_commit_push_override"],
    ["autoCreatePrOverride", "auto_create_pr_override"],
    ["globalSkillRefs", "global_skill_refs"],
    ["sandboxState", "sandbox_state"],
    ["lifecycleState", "lifecycle_state"],
    ["lifecycleVersion", "lifecycle_version"],
    ["lastActivityAt", "last_activity_at"],
    ["sandboxExpiresAt", "sandbox_expires_at"],
    ["hibernateAfter", "hibernate_after"],
    ["lifecycleRunId", "lifecycle_run_id"],
    ["lifecycleError", "lifecycle_error"],
    ["linesAdded", "lines_added"],
    ["linesRemoved", "lines_removed"],
    ["prNumber", "pr_number"],
    ["prStatus", "pr_status"],
    ["snapshotUrl", "snapshot_url"],
    ["snapshotCreatedAt", "snapshot_created_at"],
    ["snapshotSizeBytes", "snapshot_size_bytes"],
    ["cachedDiff", "cached_diff"],
    ["cachedDiffUpdatedAt", "cached_diff_updated_at"],
  ];
  for (const [k, col] of map) {
    if (k in data && (data as Record<string, unknown>)[k] !== undefined) {
      const v = (data as Record<string, unknown>)[k];
      if (
        k === "lastActivityAt" ||
        k === "sandboxExpiresAt" ||
        k === "hibernateAfter" ||
        k === "snapshotCreatedAt" ||
        k === "cachedDiffUpdatedAt"
      ) {
        patch[col] = v == null ? null : ((v as Date).toISOString?.() ?? v);
      } else {
        patch[col] = v;
      }
    }
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", sessionId)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return updated ? mapSession(updated as Record<string, unknown>) : null;
}

export async function claimSessionLifecycleRunId(
  sessionId: string,
  runId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client, true);
  const { data: current } = await supabase
    .from("sessions")
    .select("lifecycle_run_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!current) {
    return false;
  }
  if (current.lifecycle_run_id && current.lifecycle_run_id !== runId) {
    return false;
  }
  if (current.lifecycle_run_id === runId) {
    return true;
  }
  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      lifecycle_run_id: runId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .is("lifecycle_run_id", null)
    .select("id")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(updated);
}

export async function deleteSession(
  sessionId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);
  if (error) {
    throw error;
  }
}

export async function createChat(data: NewChat, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data: chat, error } = await supabase
    .from("chats")
    .insert(chatToDb(data))
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChat(chat as Record<string, unknown>);
}

export async function getChatById(chatId: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("chats")
    .select()
    .eq("id", chatId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapChat(data as Record<string, unknown>) : null;
}

export async function getChatsBySessionId(
  sessionId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("chats")
    .select()
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapChat(r as Record<string, unknown>));
}

export type ChatSummary = Chat & {
  hasUnread: boolean;
  isStreaming: boolean;
};

export async function getChatSummariesBySessionId(
  sessionId: string,
  userId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: chats, error: cErr } = await supabase
    .from("chats")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (cErr) {
    throw cErr;
  }
  const list = chats ?? [];
  if (list.length === 0) {
    return [];
  }
  const chatIds = list.map((c) => c.id as string);
  const { data: reads, error: rErr } = await supabase
    .from("chat_reads")
    .select()
    .eq("user_id", userId)
    .in("chat_id", chatIds);
  if (rErr) {
    throw rErr;
  }
  const readMap = new Map(
    (reads ?? []).map((r) => [
      r.chat_id as string,
      new Date(r.last_read_at as string),
    ]),
  );

  return list.map((c) => {
    const chat = mapChat(c as Record<string, unknown>);
    const lastAssistant = chat.lastAssistantMessageAt;
    const lastRead = readMap.get(chat.id);
    const hasUnread =
      lastAssistant != null && (lastRead == null || lastAssistant > lastRead);
    return {
      ...chat,
      hasUnread,
      isStreaming: chat.activeStreamId != null,
    };
  });
}

export async function updateChat(
  chatId: string,
  data: Partial<Omit<NewChat, "id" | "sessionId" | "createdAt">>,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.title !== undefined) {
    patch.title = data.title;
  }
  if (data.modelId !== undefined) {
    patch.model_id = data.modelId;
  }
  if (data.activeStreamId !== undefined) {
    patch.active_stream_id = data.activeStreamId;
  }
  if (data.lastAssistantMessageAt !== undefined) {
    patch.last_assistant_message_at =
      data.lastAssistantMessageAt?.toISOString() ?? null;
  }
  const { data: chat, error } = await supabase
    .from("chats")
    .update(patch)
    .eq("id", chatId)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChat(chat as Record<string, unknown>);
}

export async function touchChat(
  chatId: string,
  activityAt = new Date(),
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: chat, error } = await supabase
    .from("chats")
    .update({ updated_at: activityAt.toISOString() })
    .eq("id", chatId)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChat(chat as Record<string, unknown>);
}

export async function updateChatAssistantActivity(
  chatId: string,
  activityAt: Date,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: chat, error } = await supabase
    .from("chats")
    .update({
      last_assistant_message_at: activityAt.toISOString(),
      updated_at: activityAt.toISOString(),
    })
    .eq("id", chatId)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChat(chat as Record<string, unknown>);
}

export async function updateChatActiveStreamId(
  chatId: string,
  streamId: string | null,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { error } = await supabase
    .from("chats")
    .update({ active_stream_id: streamId })
    .eq("id", chatId);
  if (error) {
    throw error;
  }
}

export async function compareAndSetChatActiveStreamId(
  chatId: string,
  expectedStreamId: string | null,
  nextStreamId: string | null,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  let q = supabase
    .from("chats")
    .update({ active_stream_id: nextStreamId })
    .eq("id", chatId);
  q =
    expectedStreamId === null
      ? q.is("active_stream_id", null)
      : q.eq("active_stream_id", expectedStreamId);
  const { data, error } = await q.select("id").maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(data);
}

export async function deleteChat(chatId: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) {
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneChatMessagePartsWithId(parts: unknown, id: string): unknown {
  const clonedParts = structuredClone(parts);
  if (!isRecord(clonedParts)) {
    return clonedParts;
  }

  return {
    ...clonedParts,
    id,
  };
}

type ForkChatThroughMessageInput = {
  userId: string;
  sourceChatId: string;
  throughMessageId: string;
  forkedChat: Pick<
    NewChat,
    "id" | "sessionId" | "title" | "modelId" | "workspaceId"
  >;
};

type ForkChatThroughMessageResult =
  | { status: "created"; chat: Chat }
  | { status: "message_not_found" }
  | { status: "not_assistant_message" };

export async function forkChatThroughMessage(
  input: ForkChatThroughMessageInput,
  client?: SupabaseClient,
): Promise<ForkChatThroughMessageResult> {
  const supabase = await resolveClient(client, true);

  const { data: sourceMessages, error: mErr } = await supabase
    .from("chat_messages")
    .select("id, role, parts, created_at")
    .eq("chat_id", input.sourceChatId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (mErr) {
    throw mErr;
  }

  const ordered = sourceMessages ?? [];
  const throughMessageIndex = ordered.findIndex(
    (message) => message.id === input.throughMessageId,
  );
  if (throughMessageIndex < 0) {
    return { status: "message_not_found" };
  }

  const throughMessage = ordered[throughMessageIndex];
  if (!throughMessage || throughMessage.role !== "assistant") {
    return { status: "not_assistant_message" };
  }

  const now = new Date().toISOString();
  const { data: forkedChat, error: cErr } = await supabase
    .from("chats")
    .insert(
      chatToDb({
        id: input.forkedChat.id,
        workspaceId: input.forkedChat.workspaceId,
        sessionId: input.forkedChat.sessionId,
        title: input.forkedChat.title,
        modelId: input.forkedChat.modelId ?? null,
        activeStreamId: null,
        lastAssistantMessageAt: new Date(throughMessage.created_at as string),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      }),
    )
    .select()
    .single();
  if (cErr) {
    throw cErr;
  }

  const messagesToCopy = ordered.slice(0, throughMessageIndex + 1);
  if (messagesToCopy.length > 0) {
    const rows = messagesToCopy.map((message) => {
      const forkedMessageId = crypto.randomUUID();
      return chatMessageToDb({
        id: forkedMessageId,
        workspaceId: input.forkedChat.workspaceId,
        chatId: forkedChat.id as string,
        role: message.role as "user" | "assistant",
        parts: cloneChatMessagePartsWithId(message.parts, forkedMessageId),
        createdAt: new Date(message.created_at as string),
      });
    });
    const { error: insErr } = await supabase.from("chat_messages").insert(rows);
    if (insErr) {
      throw insErr;
    }
  }

  const { error: readErr } = await supabase.from("chat_reads").upsert(
    chatReadToDb({
      userId: input.userId,
      workspaceId: input.forkedChat.workspaceId,
      chatId: forkedChat.id as string,
      lastReadAt: new Date(now),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }),
    { onConflict: "user_id,chat_id" },
  );
  if (readErr) {
    throw readErr;
  }

  return {
    status: "created",
    chat: mapChat(forkedChat as Record<string, unknown>),
  };
}

export async function createChatMessage(
  data: NewChatMessage,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert(chatMessageToDb(data))
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChatMessage(message as Record<string, unknown>);
}

export async function createChatMessageIfNotExists(
  data: NewChatMessage,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert(chatMessageToDb(data))
    .select()
    .maybeSingle();
  if (error && error.code !== "23505") {
    throw error;
  }
  return message
    ? mapChatMessage(message as Record<string, unknown>)
    : undefined;
}

export async function upsertChatMessage(
  data: NewChatMessage,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: message, error } = await supabase
    .from("chat_messages")
    .upsert(chatMessageToDb(data), { onConflict: "id" })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChatMessage(message as Record<string, unknown>);
}

type UpsertChatMessageScopedResult =
  | { status: "inserted"; message: ChatMessage }
  | { status: "updated"; message: ChatMessage }
  | { status: "conflict" };

export async function upsertChatMessageScoped(
  data: NewChatMessage,
  client?: SupabaseClient,
): Promise<UpsertChatMessageScopedResult> {
  const supabase = await resolveClient(client);
  const { data: inserted, error: insErr } = await supabase
    .from("chat_messages")
    .insert(chatMessageToDb(data))
    .select()
    .maybeSingle();
  if (insErr && insErr.code !== "23505") {
    throw insErr;
  }
  if (inserted) {
    return {
      status: "inserted",
      message: mapChatMessage(inserted as Record<string, unknown>),
    };
  }

  const { data: updated, error: updErr } = await supabase
    .from("chat_messages")
    .update({ parts: data.parts })
    .eq("id", data.id)
    .eq("chat_id", data.chatId)
    .eq("role", data.role)
    .select()
    .maybeSingle();
  if (updErr) {
    throw updErr;
  }
  if (updated) {
    return {
      status: "updated",
      message: mapChatMessage(updated as Record<string, unknown>),
    };
  }

  return { status: "conflict" };
}

export async function getChatMessageById(
  messageId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("chat_messages")
    .select()
    .eq("id", messageId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapChatMessage(data as Record<string, unknown>) : null;
}

export async function getChatMessages(chatId: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data, error } = await supabase
    .from("chat_messages")
    .select()
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((r) => mapChatMessage(r as Record<string, unknown>));
}

type DeleteChatMessageAndFollowingResult =
  | { status: "not_found" }
  | { status: "not_user_message" }
  | { status: "deleted"; deletedMessageIds: string[] };

export async function deleteChatMessageAndFollowing(
  chatId: string,
  messageId: string,
  client?: SupabaseClient,
): Promise<DeleteChatMessageAndFollowingResult> {
  const supabase = await resolveClient(client, true);

  const { data: orderedMessages, error: oErr } = await supabase
    .from("chat_messages")
    .select("id, role")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (oErr) {
    throw oErr;
  }

  const ordered = orderedMessages ?? [];
  const startIndex = ordered.findIndex((message) => message.id === messageId);
  if (startIndex < 0) {
    return { status: "not_found" };
  }

  const targetMessage = ordered[startIndex];
  if (!targetMessage || targetMessage.role !== "user") {
    return { status: "not_user_message" };
  }

  const idsToDelete = ordered
    .slice(startIndex)
    .map((message) => message.id as string);

  const { error: delErr } = await supabase
    .from("chat_messages")
    .delete()
    .eq("chat_id", chatId)
    .in("id", idsToDelete);
  if (delErr) {
    throw delErr;
  }

  const { data: latestAssistant } = await supabase
    .from("chat_messages")
    .select("created_at")
    .eq("chat_id", chatId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("chats")
    .update({
      last_assistant_message_at: latestAssistant?.created_at ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId);

  return {
    status: "deleted",
    deletedMessageIds: idsToDelete,
  };
}

export async function isFirstChatMessage(
  chatId: string,
  messageId: string,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(2);
  if (error) {
    throw error;
  }
  return rows?.length === 1 && rows[0]?.id === messageId;
}

export async function markChatRead(
  data: Pick<NewChatRead, "userId" | "chatId" | "workspaceId">,
  client?: SupabaseClient,
) {
  const supabase = await resolveClient(client);
  const now = new Date().toISOString();
  const { data: chatRead, error } = await supabase
    .from("chat_reads")
    .upsert(
      {
        ...chatReadToDb({
          userId: data.userId,
          workspaceId: data.workspaceId,
          chatId: data.chatId,
          lastReadAt: new Date(now),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        }),
      },
      { onConflict: "user_id,chat_id" },
    )
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapChatRead(chatRead as Record<string, unknown>);
}
