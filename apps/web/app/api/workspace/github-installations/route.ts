import { NextResponse } from "next/server";
import { getInstallationManageUrl } from "@/lib/github/installation-url";
import { listGitHubInstallationsForWorkspace } from "@/lib/db/installations";
import { getServerSession } from "@/lib/session/get-server-session";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

export async function GET(): Promise<Response> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 400 },
    );
  }

  try {
    const installations =
      await listGitHubInstallationsForWorkspace(workspaceId);

    return NextResponse.json(
      installations.map((installation) => ({
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        repositorySelection: installation.repositorySelection,
        installationUrl: getInstallationManageUrl(
          installation.installationId,
          installation.installationUrl,
        ),
      })),
    );
  } catch (error) {
    console.error("workspace github-installations:", error);
    return NextResponse.json(
      { error: "Failed to fetch installations" },
      { status: 500 },
    );
  }
}
