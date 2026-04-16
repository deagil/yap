import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import type { Session } from "./types";

function createSupabaseForRequest(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase URL and anon key are required");
  }
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // Route handlers that only read session should not mutate cookies here
      },
    },
  });
}

export async function getSessionFromReq(
  req: NextRequest,
): Promise<Session | undefined> {
  const supabase = createSupabaseForRequest(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return undefined;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username, email, name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const email = profile?.email ?? user.email ?? undefined;
  const username =
    profile?.username ??
    (typeof email === "string" ? email.split("@")[0] : undefined) ??
    "user";

  return {
    created: Date.now(),
    user: {
      id: user.id,
      username,
      email,
      name: profile?.name ?? user.user_metadata?.full_name ?? undefined,
      avatar:
        (profile?.avatar_url as string | undefined) ??
        (user.user_metadata?.avatar_url as string | undefined) ??
        "",
    },
  };
}
