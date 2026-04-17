import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { setActiveWorkspaceCookie } from "@/lib/workspace/active-workspace-cookie";
import { ensureWorkspaceForUser } from "@/lib/workspace/ensure";

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

  const cookieStore = await cookies();
  type PendingAuthCookie = {
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  };
  const pendingAuthCookies: PendingAuthCookie[] = [];

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const row of cookiesToSet) {
          pendingAuthCookies.push(row);
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
  const workspaceId = await ensureWorkspaceForUser(user, admin);

  const { data: profile } = await supabase
    .from("users")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  const onboardingComplete = profile?.onboarding_complete === true;
  const destination = onboardingComplete
    ? new URL(next, url.origin)
    : new URL("/onboarding", url.origin);

  const response = NextResponse.redirect(destination);
  for (const { name, value, options } of pendingAuthCookies) {
    response.cookies.set(name, value, options);
  }
  if (workspaceId) {
    setActiveWorkspaceCookie(response, workspaceId);
  }

  return response;
}
