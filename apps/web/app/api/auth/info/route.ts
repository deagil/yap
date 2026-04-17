import type { NextRequest } from "next/server";
import { getGitHubAccount } from "@/lib/db/accounts";
import { listGitHubInstallationsForWorkspace } from "@/lib/db/installations";
import { userExists } from "@/lib/db/users";
import { getSessionFromReq } from "@/lib/session/server";
import type { SessionUserInfo } from "@/lib/session/types";
import { createServerSupabase } from "@/lib/supabase/server";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

const UNAUTHENTICATED: SessionUserInfo = { user: undefined };

export async function GET(req: NextRequest) {
  const session = await getSessionFromReq(req);

  if (!session?.user?.id) {
    return Response.json(UNAUTHENTICATED);
  }

  const supabase = await createServerSupabase();
  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);

  const [exists, ghAccount, workspaceInstallations] = await Promise.all([
    userExists(session.user.id, supabase),
    getGitHubAccount(session.user.id, supabase),
    workspaceId
      ? listGitHubInstallationsForWorkspace(workspaceId, supabase)
      : Promise.resolve([]),
  ]);

  if (!exists) {
    return Response.json(UNAUTHENTICATED);
  }

  const hasGitHubAccount = ghAccount !== null;
  const hasGitHubInstallations = workspaceInstallations.length > 0;
  const hasGitHub = hasGitHubAccount || hasGitHubInstallations;

  const data: SessionUserInfo = {
    user: session.user,
    hasGitHub,
    hasGitHubAccount,
    hasGitHubInstallations,
  };

  return Response.json(data);
}
