import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { setActiveWorkspaceCookie } from "@/lib/workspace/active-workspace-cookie";
import { ensureWorkspaceForUser } from "@/lib/workspace/ensure";

type PendingCookie = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function POST(): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const pendingAuthCookies: PendingCookie[] = [];

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const workspaceId = await ensureWorkspaceForUser(user, admin);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Could not ensure workspace" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ workspaceId });
  for (const { name, value, options } of pendingAuthCookies) {
    response.cookies.set(name, value, options);
  }
  setActiveWorkspaceCookie(response, workspaceId);
  return response;
}
