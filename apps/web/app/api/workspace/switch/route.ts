import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromReq } from "@/lib/session/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "@/lib/workspace/constants";

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getSessionFromReq(req);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { workspaceId?: string };
  try {
    body = (await req.json()) as { workspaceId?: string };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workspaceId = body.workspaceId;
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    return Response.json({ error: "Invalid workspace" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!data?.workspace_id) {
    return Response.json({ error: "Not a member" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
  });
  return res;
}
