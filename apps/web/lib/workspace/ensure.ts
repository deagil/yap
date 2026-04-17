import "server-only";
import type { User } from "@supabase/supabase-js";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

/**
 * Ensures the user has at least one workspace via Slack team or personal workspace RPCs.
 * Call only from trusted server routes (auth callback, post-OTP) after `getUser()` succeeds.
 */
export async function ensureWorkspaceForUser(
  user: User,
  admin: TypedSupabaseClient,
): Promise<string | null> {
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

  return workspaceId;
}
