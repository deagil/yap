import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * `Co-Authored-By:` trailer for the signed-in Harness user when git commits
 * use the GitHub App bot as committer.
 */
export async function getMemberCoAuthorTrailer(
  userId: string,
): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("username, name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const username = String(data.username ?? "").trim();
  const displayName = String(data.name ?? "").trim() || username;
  if (!displayName) {
    return null;
  }

  const rawEmail = typeof data.email === "string" ? data.email.trim() : "";
  const email =
    rawEmail && rawEmail.includes("@")
      ? rawEmail
      : `${username || "user"}@users.noreply.harness.local`;

  return `Co-Authored-By: ${displayName} <${email}>`;
}
