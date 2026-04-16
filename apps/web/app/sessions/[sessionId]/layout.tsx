import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getChatSummariesBySessionId } from "@/lib/db/sessions";
import { getSessionByIdCached } from "@/lib/db/sessions-cache";
import {
  getUserPreferences,
  toUserPreferencesData,
} from "@/lib/db/user-preferences";
import { sanitizeUserPreferencesForSession } from "@/lib/model-access";
import { getServerSession } from "@/lib/session/get-server-session";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";
import { SessionLayoutShell } from "./session-layout-shell";

interface SessionLayoutProps {
  params: Promise<{ sessionId: string }>;
  children: ReactNode;
}

export default async function SessionLayout({
  params,
  children,
}: SessionLayoutProps) {
  const { sessionId } = await params;

  const sessionPromise = getServerSession();
  const sessionRecordPromise = getSessionByIdCached(sessionId);

  const session = await sessionPromise;
  if (!session?.user) {
    redirect("/");
  }

  const sessionRecord = await sessionRecordPromise;
  if (!sessionRecord) {
    notFound();
  }

  if (sessionRecord.userId !== session.user.id) {
    redirect("/");
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);

  let initialChatsData:
    | {
        chats: Awaited<ReturnType<typeof getChatSummariesBySessionId>>;
        defaultModelId: string | null;
      }
    | undefined;

  try {
    const requestHost = (await headers()).get("host") ?? "";
    const chats = await getChatSummariesBySessionId(sessionId, session.user.id);
    const rawPreferences = workspaceId
      ? await getUserPreferences(session.user.id, workspaceId)
      : toUserPreferencesData();
    const preferences = sanitizeUserPreferencesForSession(
      rawPreferences,
      session,
      requestHost,
    );
    initialChatsData = {
      chats,
      defaultModelId: preferences.defaultModelId,
    };
  } catch (error) {
    console.error("Failed to prefetch session chat data:", error);
  }

  return (
    <SessionLayoutShell
      session={sessionRecord}
      initialChatsData={initialChatsData}
    >
      {children}
    </SessionLayoutShell>
  );
}
