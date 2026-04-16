import "server-only";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE_NAME } from "./constants";

/**
 * Returns the active workspace UUID from the cookie, or null if missing/invalid.
 */
export async function getActiveWorkspaceIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(ACTIVE_WORKSPACE_COOKIE_NAME)?.value;
  if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Resolves the active workspace for the current user: cookie value if they are a member,
 * otherwise first membership.
 */
export async function getActiveWorkspaceIdForUser(
  userId: string,
): Promise<string | null> {
  const fromCookie = await getActiveWorkspaceIdFromCookie();
  const supabase = await createServerSupabase();

  if (fromCookie) {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", fromCookie)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.workspace_id) {
      return data.workspace_id as string;
    }
  }

  const { data: first } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (first?.workspace_id as string | undefined) ?? null;
}

export async function requireWorkspaceForUser(userId: string): Promise<string> {
  const id = await getActiveWorkspaceIdForUser(userId);
  if (!id) {
    throw new Error("No workspace context");
  }
  return id;
}
