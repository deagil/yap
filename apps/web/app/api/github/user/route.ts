import { NextResponse } from "next/server";
import { fetchGitHubUser } from "@/lib/github/api";
import { getUserGitHubToken } from "@/lib/github/user-token";
import { getServerSession } from "@/lib/session/get-server-session";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";
import { hasGithubInstallation } from "@/lib/workspace/connections";

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = await getUserGitHubToken();

  if (!token) {
    const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
    const workspaceGithubAppInstalled =
      workspaceId !== null && (await hasGithubInstallation(workspaceId));
    return NextResponse.json({
      linked: false,
      workspaceGithubAppInstalled,
    });
  }

  try {
    const user = await fetchGitHubUser(token);

    if (!user) {
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 },
      );
    }

    return NextResponse.json({ linked: true, ...user });
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    );
  }
}
