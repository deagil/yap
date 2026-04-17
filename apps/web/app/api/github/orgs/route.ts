import { NextResponse } from "next/server";
import { listGitHubInstallationsForWorkspace } from "@/lib/db/installations";
import { fetchGitHubOrgs } from "@/lib/github/api";
import { getUserGitHubToken } from "@/lib/github/user-token";
import { getServerSession } from "@/lib/session/get-server-session";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

/** Minimal org row compatible with repo-target pickers when using workspace installs only. */
function orgsFromWorkspaceInstallations(
  rows: Awaited<ReturnType<typeof listGitHubInstallationsForWorkspace>>,
) {
  return rows
    .filter((r) => r.accountType === "Organization")
    .map((r) => ({
      login: r.accountLogin,
      name: r.accountLogin,
      avatar_url: "",
    }));
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 401 },
    );
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  const token = await getUserGitHubToken();

  if (!token) {
    if (!workspaceId) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 401 },
      );
    }
    const fromWorkspace = orgsFromWorkspaceInstallations(
      await listGitHubInstallationsForWorkspace(workspaceId),
    );
    if (fromWorkspace.length === 0) {
      return NextResponse.json(
        { error: "GitHub not connected" },
        { status: 401 },
      );
    }
    return NextResponse.json(fromWorkspace);
  }

  try {
    const orgs = await fetchGitHubOrgs(token);

    if (!orgs) {
      return NextResponse.json(
        { error: "Failed to fetch organizations" },
        { status: 500 },
      );
    }

    return NextResponse.json(orgs);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}
