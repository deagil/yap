import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Session } from "./types";

export const getServerSession = cache(
  async (): Promise<Session | undefined> => {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return undefined;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("username, email, name, avatar_url, onboarding_complete")
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
        onboardingComplete: (profile?.onboarding_complete ?? true) === true,
      },
    };
  },
);

export async function getSessionFromCookie(): Promise<Session | undefined> {
  return getServerSession();
}
