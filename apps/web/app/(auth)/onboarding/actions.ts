"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  getActiveWorkspaceIdForUser,
  getActiveWorkspaceIdFromCookie,
} from "@/lib/workspace/context";
import { hasGithubInstallation } from "@/lib/workspace/connections";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  workspaceName: z.string().trim().min(1).max(120),
});

export async function saveOnboardingProfile(
  raw: z.infer<typeof profileSchema>,
): Promise<{ error: string } | undefined> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please check your answers and try again." };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { displayName, workspaceName } = parsed.data;

  let workspaceId = await getActiveWorkspaceIdFromCookie();
  if (!workspaceId) {
    workspaceId = await getActiveWorkspaceIdForUser(user.id);
  }
  if (!workspaceId) {
    return { error: "No workspace found. Try signing in again." };
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = member?.role as string | undefined;
  if (role !== "owner" && role !== "admin") {
    return { error: "You cannot update this workspace." };
  }

  const { error: userError } = await supabase
    .from("users")
    .update({
      name: displayName,
    })
    .eq("id", user.id);

  if (userError) {
    return { error: userError.message };
  }

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .update({ name: workspaceName })
    .eq("id", workspaceId);

  if (workspaceError) {
    return { error: workspaceError.message };
  }

  return undefined;
}

export async function completeOnboarding(): Promise<
  { error: string } | undefined
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  let workspaceId = await getActiveWorkspaceIdFromCookie();
  if (!workspaceId) {
    workspaceId = await getActiveWorkspaceIdForUser(user.id);
  }
  if (!workspaceId) {
    return { error: "No workspace found. Try signing in again." };
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = member?.role as string | undefined;
  const isAdmin = role === "owner" || role === "admin";

  if (isAdmin) {
    const { count, error: countError } = await supabase
      .from("github_installations")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (countError) {
      return { error: countError.message };
    }
    if ((count ?? 0) < 1) {
      return { error: "Please connect GitHub before continuing." };
    }
  } else if (!(await hasGithubInstallation(workspaceId))) {
    return {
      error:
        "GitHub is not connected for this workspace yet. Ask a workspace admin to install the GitHub App.",
    };
  }

  const { error: userError } = await supabase
    .from("users")
    .update({
      onboarding_complete: true,
    })
    .eq("id", user.id);

  if (userError) {
    return { error: userError.message };
  }

  redirect("/sessions");
}
