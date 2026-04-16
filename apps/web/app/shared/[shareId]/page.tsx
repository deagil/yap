import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { WebAgentUIMessage } from "@/app/types";
import { getChatById, getChatMessages } from "@/lib/db/sessions";
import {
  getSessionByIdCached,
  getShareByIdCached,
} from "@/lib/db/sessions-cache";
import { getUserPreferences } from "@/lib/db/user-preferences";
import { getAllVariants, MODEL_VARIANT_ID_PREFIX } from "@/lib/model-variants";
import { getServerSession } from "@/lib/session/get-server-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { redactSharedEnvContent } from "./redact-shared-env-content";
import { SharedChatContent } from "./shared-chat-content";
import type { MessageWithTiming } from "./shared-chat-content";

interface SharedPageProps {
  params: Promise<{ shareId: string }>;
}

async function resolveSharedModelName(
  userId: string,
  workspaceId: string,
  modelId: string | null | undefined,
): Promise<string | null> {
  if (!modelId || !modelId.startsWith(MODEL_VARIANT_ID_PREFIX)) {
    return null;
  }

  try {
    const admin = getSupabaseAdmin();
    const preferences = await getUserPreferences(userId, workspaceId, admin);
    const variant = getAllVariants(preferences.modelVariants).find(
      (item) => item.id === modelId,
    );

    return variant?.name ?? null;
  } catch (error) {
    console.error("Failed to resolve shared model name:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: SharedPageProps): Promise<Metadata> {
  const { shareId } = await params;
  const share = await getShareByIdCached(shareId);
  const admin = getSupabaseAdmin();
  const sharedChat = share ? await getChatById(share.chatId, admin) : null;

  return {
    title: sharedChat?.title ?? "Shared Chat",
    description: "A shared Open Agents chat.",
  };
}

export default async function SharedPage({ params }: SharedPageProps) {
  const { shareId } = await params;

  const viewerSessionPromise = getServerSession();
  const admin = getSupabaseAdmin();
  const sharePromise = getShareByIdCached(shareId);

  const [viewerSession, share] = await Promise.all([
    viewerSessionPromise,
    sharePromise,
  ]);
  if (!share) {
    notFound();
  }

  const sharedChat = await getChatById(share.chatId, admin);
  if (!sharedChat) {
    notFound();
  }

  const session = await getSessionByIdCached(sharedChat.sessionId);
  if (!session) {
    notFound();
  }

  // Fetch the user who owns this session (public profile info only)
  const { data: sessionUser } = await admin
    .from("users")
    .select("username, name, avatar_url")
    .eq("id", session.userId)
    .maybeSingle();

  const dbMessages = await getChatMessages(sharedChat.id, admin);

  // Build messages with timing: compute duration for each assistant message
  // based on the gap from the preceding user message's createdAt
  const messagesWithTiming: MessageWithTiming[] = dbMessages.map((m, idx) => {
    const message = redactSharedEnvContent(m.parts as WebAgentUIMessage);
    let durationMs: number | null = null;

    if (m.role === "assistant" && idx > 0) {
      const prev = dbMessages[idx - 1];
      if (prev && prev.role === "user") {
        durationMs = m.createdAt.getTime() - prev.createdAt.getTime();
      }
    }

    return { message, durationMs };
  });

  // Derive streaming status and the timestamp of the last user message so the
  // shared page can show a live "in progress" timer without accessing the stream.
  const isStreaming = sharedChat.activeStreamId != null;
  const lastUserMessage = dbMessages
    .toReversed()
    .find((m) => m.role === "user");
  const lastUserMessageSentAt = lastUserMessage
    ? lastUserMessage.createdAt.toISOString()
    : null;

  const { title, repoOwner, repoName, branch, cloneUrl, prNumber, prStatus } =
    session;
  const modelName = await resolveSharedModelName(
    session.userId,
    session.workspaceId,
    sharedChat.modelId,
  );
  const ownerSessionHref =
    viewerSession?.user?.id === session.userId
      ? `/sessions/${sharedChat.sessionId}/chats/${sharedChat.id}`
      : null;

  return (
    <SharedChatContent
      session={{
        title,
        repoOwner,
        repoName,
        branch,
        cloneUrl,
        prNumber,
        prStatus,
      }}
      chats={[{ chat: sharedChat, messagesWithTiming }]}
      modelId={sharedChat.modelId}
      modelName={modelName}
      sharedBy={
        sessionUser
          ? {
              username: sessionUser.username as string,
              name: sessionUser.name as string | null,
              avatarUrl: sessionUser.avatar_url as string | null,
            }
          : null
      }
      ownerSessionHref={ownerSessionHref}
      isStreaming={isStreaming}
      lastUserMessageSentAt={lastUserMessageSentAt}
      shareId={shareId}
    />
  );
}
