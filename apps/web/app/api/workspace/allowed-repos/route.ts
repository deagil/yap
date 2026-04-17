import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  deleteWorkspaceRepo,
  listWorkspaceRepos,
  upsertWorkspaceRepo,
  workspaceHasRepoAllowlist,
} from "@/lib/db/workspace-repos";
import { getServerSession } from "@/lib/session/get-server-session";
import { getActiveWorkspaceIdForUser } from "@/lib/workspace/context";

async function isWorkspaceAdmin(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = data?.role as string | undefined;
  return role === "owner" || role === "admin";
}

const postBodySchema = z.object({
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  installationId: z.number().int().positive(),
});

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

  const [allowlistEnabled, repos] = await Promise.all([
    workspaceHasRepoAllowlist(workspaceId),
    listWorkspaceRepos(workspaceId),
  ]);

  return NextResponse.json({
    allowlistEnabled,
    repos: repos.map((r) => ({
      repoOwner: r.repoOwner,
      repoName: r.repoName,
      installationId: r.installationId,
    })),
  });
}

export async function POST(req: Request): Promise<Response> {
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

  if (!(await isWorkspaceAdmin(workspaceId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { repoOwner, repoName, installationId } = parsed.data;

  try {
    await upsertWorkspaceRepo({
      workspaceId,
      repoOwner,
      repoName,
      installationId,
      addedByUserId: session.user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("allowed-repos POST:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
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

  if (!(await isWorkspaceAdmin(workspaceId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const repoOwner = req.nextUrl.searchParams.get("repo_owner");
  const repoName = req.nextUrl.searchParams.get("repo_name");
  if (!repoOwner || !repoName) {
    return NextResponse.json(
      { error: "repo_owner and repo_name are required" },
      { status: 400 },
    );
  }

  try {
    await deleteWorkspaceRepo(workspaceId, repoOwner, repoName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("allowed-repos DELETE:", error);
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}
