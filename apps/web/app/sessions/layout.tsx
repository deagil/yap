import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getLastRepoByUserId } from "@/lib/db/last-repo";
import {
  getArchivedSessionCountByUserId,
  getSessionsWithUnreadByUserId,
} from "@/lib/db/sessions";
import { getServerSession } from "@/lib/session/get-server-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";
import { SessionsRouteShell } from "./sessions-route-shell";

type SessionsLayoutProps = {
  children: ReactNode;
};

export default async function SessionsLayout({
  children,
}: SessionsLayoutProps) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/");
  }

  if (session.user.onboardingComplete === false) {
    redirect("/onboarding");
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId) {
    redirect("/settings/workspace");
  }

  const supabase = await createServerSupabase();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", session.user.id);
  const memberIds = (memberships ?? []).map((m) => m.workspace_id as string);
  const { data: workspaces } =
    memberIds.length > 0
      ? await supabase
          .from("workspaces")
          .select("id, name, slug")
          .in("id", memberIds)
      : { data: [] };

  const [lastRepo, sessions, archivedCount] = await Promise.all([
    getLastRepoByUserId(session.user.id, workspaceId),
    getSessionsWithUnreadByUserId(session.user.id, workspaceId, {
      status: "active",
    }),
    getArchivedSessionCountByUserId(session.user.id, workspaceId),
  ]);

  return (
    <SessionsRouteShell
      currentUser={session.user}
      initialSessionsData={{ sessions, archivedCount }}
      lastRepo={lastRepo}
      workspaceSwitcher={{
        activeWorkspaceId: workspaceId,
        workspaces: (workspaces ?? []).map((w) => ({
          id: w.id as string,
          name: (w.name as string) ?? w.id,
          slug: (w.slug as string) ?? "",
        })),
      }}
    >
      {children}
    </SessionsRouteShell>
  );
}
