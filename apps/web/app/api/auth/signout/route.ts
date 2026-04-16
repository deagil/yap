import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "@/lib/workspace/constants";

export async function POST(req: NextRequest): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 },
    );
  }

  const redirectUrl = new URL("/", req.url);
  let response = NextResponse.redirect(redirectUrl);

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
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

  await supabase.auth.signOut();
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}
