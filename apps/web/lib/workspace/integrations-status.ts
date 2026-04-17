import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

export interface WorkspaceIntegrationsStatus {
  workspaceId: string | null;
  workspaceName: string | null;
  isAdmin: boolean;
  githubApp: {
    installed: boolean;
    installationUrl: string | null;
    accountLogin: string | null;
  };
  vercel: {
    connected: boolean;
    teamSlug: string | null;
  };
}

export async function getWorkspaceIntegrationsStatus(
  userId: string,
): Promise<WorkspaceIntegrationsStatus> {
  const workspaceId = await getActiveWorkspaceIdForUser(userId);
  if (!workspaceId) {
    return {
      workspaceId: null,
      workspaceName: null,
      isAdmin: false,
      githubApp: {
        installed: false,
        installationUrl: null,
        accountLogin: null,
      },
      vercel: { connected: false, teamSlug: null },
    };
  }

  const supabase = await createServerSupabase();

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  const role = member?.role as string | undefined;
  const isAdmin = role === "owner" || role === "admin";

  const { data: ws } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: ghRows } = await supabase
    .from("github_installations")
    .select("installation_url, account_login")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1);

  const gh = ghRows?.[0] ?? null;

  const { data: vc } = await supabase
    .from("workspace_vercel_connections")
    .select("team_slug")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return {
    workspaceId,
    workspaceName: (ws?.name as string | undefined) ?? null,
    isAdmin,
    githubApp: {
      installed: gh != null,
      installationUrl: (gh?.installation_url as string | undefined) ?? null,
      accountLogin: (gh?.account_login as string | undefined) ?? null,
    },
    vercel: {
      connected: vc != null,
      teamSlug: (vc?.team_slug as string | undefined) ?? null,
    },
  };
}
