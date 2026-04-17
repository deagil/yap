import { NextRequest, NextResponse } from "next/server";
import { getInstallationByWorkspaceAndInstallationId } from "@/lib/db/installations";
import { isGitHubAppConfigured } from "@/lib/github/app-auth";
import { listInstallationRepositoriesForApp } from "@/lib/github/installation-repos";
import { getServerSession } from "@/lib/session/get-server-session";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

function parseInstallationId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const installationId = parseInstallationId(
    searchParams.get("installation_id"),
  );
  const query = searchParams.get("query")?.trim() || undefined;
  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit =
    typeof parsedLimit === "number" && Number.isFinite(parsedLimit)
      ? parsedLimit
      : undefined;

  if (!installationId) {
    return NextResponse.json(
      { error: "installation_id is required" },
      { status: 400 },
    );
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 400 },
    );
  }

  const installation = await getInstallationByWorkspaceAndInstallationId(
    workspaceId,
    installationId,
  );
  if (!installation) {
    return NextResponse.json(
      { error: "Installation not found" },
      { status: 403 },
    );
  }

  if (!isGitHubAppConfigured()) {
    return NextResponse.json(
      {
        error:
          "GitHub App is not configured on this deployment (missing GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY).",
      },
      { status: 503 },
    );
  }

  try {
    const repos = await listInstallationRepositoriesForApp({
      installationId,
      owner: installation.accountLogin,
      query,
      limit,
    });

    return NextResponse.json(repos);
  } catch (error) {
    console.error("Failed to fetch installation repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
}
