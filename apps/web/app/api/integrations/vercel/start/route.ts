import { generateState } from "arctic";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  getVercelAuthorizationUrl,
} from "@/lib/vercel/oauth";
import { getServerSession } from "@/lib/session/get-server-session";
import { createServerSupabase } from "@/lib/supabase/server";
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

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.redirect(new URL("/sign-in", req.url));
  }

  const workspaceId = await getActiveWorkspaceIdForUser(session.user.id);
  if (!workspaceId || !(await isWorkspaceAdmin(workspaceId, session.user.id))) {
    return new Response("Workspace admin access required", { status: 403 });
  }

  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const redirectUri = `${req.nextUrl.origin}/api/integrations/vercel/callback`;

  if (!clientId) {
    return Response.redirect(new URL("/?error=vercel_not_configured", req.url));
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const store = await cookies();
  const redirectTo =
    req.nextUrl.searchParams.get("next") ?? "/settings/workspace";

  store.set("vercel_auth_state", state, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  store.set("vercel_code_verifier", codeVerifier, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  store.set("vercel_auth_redirect_to", redirectTo, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  store.set("vercel_oauth_workspace_id", workspaceId, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  const url = getVercelAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  return Response.redirect(url);
}
