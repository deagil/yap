import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "@/lib/workspace/constants";

function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }
  return raw;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 },
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", url.origin),
    );
  }

  const redirectTo = new URL(next, url.origin);
  let response = NextResponse.redirect(redirectTo);

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth callback:", error);
    return NextResponse.redirect(
      new URL("/sign-in?error=auth_exchange_failed", url.origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", url.origin));
  }

  const admin = getSupabaseAdmin();
  let workspaceId: string | null = null;

  const identities = user.identities ?? [];
  const slackIdentity = identities.find((i) => i.provider === "slack_oidc");
  if (slackIdentity) {
    const idData = slackIdentity.identity_data as
      | Record<string, unknown>
      | undefined;
    const teamId =
      (idData?.["https://slack.com/team_id"] as string | undefined) ??
      (idData?.team_id as string | undefined);
    const teamName =
      (idData?.["https://slack.com/team_name"] as string | undefined) ??
      (idData?.team_name as string | undefined) ??
      "Workspace";

    if (teamId) {
      const { data: wid, error: rpcErr } = await admin.rpc(
        "ensure_workspace_for_slack",
        {
          p_slack_team_id: teamId,
          p_slack_team_name: teamName,
          p_user_id: user.id,
        },
      );
      if (!rpcErr && wid != null) {
        workspaceId = String(wid);
      }
    }
  }

  if (!workspaceId) {
    const label =
      typeof user.email === "string"
        ? (user.email.split("@")[0] ?? "Personal")
        : "Personal";
    const { data: wid, error: rpcErr } = await admin.rpc(
      "ensure_personal_workspace",
      {
        p_user_id: user.id,
        p_label: label,
      },
    );
    if (!rpcErr && wid != null) {
      workspaceId = String(wid);
    }
  }

  if (workspaceId) {
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 400,
    });
  }

  return response;
}
