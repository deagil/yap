import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getServerSession } from "@/lib/session/get-server-session";
import { exchangeVercelCode, getVercelUserInfo } from "@/lib/vercel/oauth";

function clearVercelOauthCookies(store: Awaited<ReturnType<typeof cookies>>) {
  store.delete("vercel_auth_state");
  store.delete("vercel_code_verifier");
  store.delete("vercel_auth_redirect_to");
  store.delete("vercel_oauth_workspace_id");
}

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();

  const storedState = cookieStore.get("vercel_auth_state")?.value;
  const codeVerifier = cookieStore.get("vercel_code_verifier")?.value;
  const rawRedirectTo =
    cookieStore.get("vercel_auth_redirect_to")?.value ?? "/settings/workspace";
  const workspaceId = cookieStore.get("vercel_oauth_workspace_id")?.value;

  const storedRedirectTo =
    rawRedirectTo.startsWith("/") && !rawRedirectTo.startsWith("//")
      ? rawRedirectTo
      : "/settings/workspace";

  if (
    !code ||
    !state ||
    storedState !== state ||
    !codeVerifier ||
    !workspaceId
  ) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const clientId = process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID;
  const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Vercel OAuth not configured", { status: 500 });
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/integrations/vercel/callback`;

    const tokens = await exchangeVercelCode({
      code,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    const userInfo = await getVercelUserInfo(tokens.access_token);

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const admin = getSupabaseAdmin();

    await admin.from("workspace_vercel_connections").upsert(
      {
        workspace_id: workspaceId,
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : null,
        scope: tokens.scope ?? null,
        vercel_user_external_id: userInfo.sub,
        token_expires_at: tokenExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    );

    clearVercelOauthCookies(cookieStore);

    return NextResponse.redirect(new URL(storedRedirectTo, req.url));
  } catch (error) {
    console.error("Vercel integration callback error:", error);
    return new Response("Integration failed", { status: 500 });
  }
}
