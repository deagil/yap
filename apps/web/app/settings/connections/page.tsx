import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "@/lib/session/get-server-session";
import { getWorkspaceIntegrationsStatus } from "@/lib/workspace/integrations-status";
import { AccountsSection, AccountsSectionSkeleton } from "../accounts-section";
import { WorkspaceAllowedReposSection } from "./workspace-allowed-repos-section";
import { WorkspaceIntegrationsSection } from "./workspace-integrations-section";

export const metadata: Metadata = {
  title: "Connections",
  description:
    "Workspace integrations (GitHub App, Vercel, Slack) and your GitHub account link.",
};

export default async function ConnectionsPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/sign-in?next=/settings/connections");
  }

  const status = await getWorkspaceIntegrationsStatus(session.user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect workspace-level apps for repos, previews, and chat. If you
          skipped any step during onboarding, finish here. Your personal GitHub
          account link and per-organization installs are managed below.
        </p>
      </div>

      <WorkspaceIntegrationsSection status={status} />

      {status.workspaceId ? (
        <WorkspaceAllowedReposSection isAdmin={status.isAdmin} />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">GitHub account</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Link the GitHub user that owns OAuth access, then install or configure
          the app on each organization. Use{" "}
          <span className="font-medium text-foreground">
            Workspace integrations
          </span>{" "}
          above for the first install or to open GitHub&apos;s app settings.
        </p>
        <Suspense fallback={<AccountsSectionSkeleton />}>
          <AccountsSection />
        </Suspense>
      </section>
    </div>
  );
}
