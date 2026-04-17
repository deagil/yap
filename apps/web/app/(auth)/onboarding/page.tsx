import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session/get-server-session";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  hasGithubInstallation,
  hasVercelConnection,
} from "@/lib/workspace/connections";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";
import { AuthFlowClient } from "../auth-flow-client";

function defaultWorkspaceLabel(email: string | undefined): string {
  if (typeof email !== "string" || !email.includes("@")) {
    return "Personal";
  }
  return email.split("@")[0] ?? "Personal";
}

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  if (session.user.onboardingComplete) {
    redirect("/sessions");
  }

  const email = session.user.email;
  const defaultDisplayName =
    session.user.name?.trim() ||
    (typeof email === "string" ? email.split("@")[0] : "") ||
    "";

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  let defaultWorkspaceName = defaultWorkspaceLabel(email);
  if (workspaceId) {
    const supabase = await createServerSupabase();
    const { data: ws } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();
    if (ws?.name?.trim()) {
      defaultWorkspaceName = ws.name.trim();
    }
  }

  const profileSaved = Boolean(session.user.name?.trim());
  const githubConnected = workspaceId
    ? await hasGithubInstallation(workspaceId)
    : false;
  const vercelConnected = workspaceId
    ? await hasVercelConnection(workspaceId)
    : false;

  return (
    <AuthFlowClient
      startAuthenticated
      profileSaved={profileSaved}
      githubConnected={githubConnected}
      vercelConnected={vercelConnected}
      defaultDisplayName={defaultDisplayName}
      defaultWorkspaceName={defaultWorkspaceName}
    />
  );
}
