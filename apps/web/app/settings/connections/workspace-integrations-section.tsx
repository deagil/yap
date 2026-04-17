import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { WorkspaceIntegrationsStatus } from "@/lib/workspace/integrations-status";

const NEXT = "/settings/connections";

/** Full browser navigation — avoids Next.js Link prefetching API routes as RSC. */
function NavButton({
  href,
  children,
  variant = "outline",
  size = "sm",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Button variant={variant} size={size} asChild>
      <a href={href}>{children}</a>
    </Button>
  );
}

export function WorkspaceIntegrationsSection({
  status,
}: {
  status: WorkspaceIntegrationsStatus;
}) {
  if (!status.workspaceId) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/10 p-4 text-sm text-muted-foreground">
        No active workspace was found. Open the app from your home workspace or
        pick a workspace, then return here to manage integrations.
      </div>
    );
  }

  const workspaceLabel = status.workspaceName?.trim() || "Active workspace";
  const canManage = status.isAdmin;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 bg-muted/10">
        <div className="border-b border-border/50 px-4 py-3">
          <h2 className="text-sm font-medium">Workspace integrations</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {workspaceLabel}. Finish anything you skipped during onboarding, or
            change how this workspace talks to GitHub, Vercel, and Slack.
          </p>
        </div>

        <ul className="divide-y divide-border/50">
          <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">GitHub App</p>
              <p className="text-xs text-muted-foreground">
                Install the app on orgs or accounts whose repos the agent should
                use. Configure repo access on GitHub anytime.
              </p>
              {status.githubApp.installed && status.githubApp.accountLogin ? (
                <p className="text-xs text-muted-foreground">
                  Linked account/org:{" "}
                  <span className="font-medium text-foreground">
                    {status.githubApp.accountLogin}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {status.githubApp.installed ? (
                <>
                  {status.githubApp.installationUrl ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={status.githubApp.installationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Configure on GitHub
                        <ExternalLink className="ml-1 size-3" />
                      </Link>
                    </Button>
                  ) : null}
                  {canManage ? (
                    <NavButton
                      variant="secondary"
                      href={`/api/github/app/install?next=${encodeURIComponent(NEXT)}`}
                    >
                      Add installation
                    </NavButton>
                  ) : null}
                </>
              ) : canManage ? (
                <NavButton
                  variant="default"
                  href={`/api/github/app/install?next=${encodeURIComponent(NEXT)}`}
                >
                  Install GitHub App
                </NavButton>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Ask an owner or admin to install the app.
                </span>
              )}
            </div>
          </li>

          <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Vercel</p>
              <p className="text-xs text-muted-foreground">
                Customer Vercel OAuth for preview URLs when the agent pushes
                branches. Reconnect to refresh tokens or switch teams.
              </p>
              {status.vercel.connected ? (
                <p className="text-xs text-muted-foreground">
                  {status.vercel.teamSlug ? (
                    <>
                      Team:{" "}
                      <span className="font-medium text-foreground">
                        {status.vercel.teamSlug}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Connected</span>
                  )}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canManage ? (
                <>
                  <NavButton
                    href={`/api/integrations/vercel/start?next=${encodeURIComponent(NEXT)}`}
                  >
                    {status.vercel.connected
                      ? "Reconnect Vercel"
                      : "Connect Vercel"}
                  </NavButton>
                  {status.vercel.connected ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href="https://vercel.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Vercel dashboard
                        <ExternalLink className="ml-1 size-3" />
                      </Link>
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Ask an owner or admin to connect Vercel.
                </span>
              )}
            </div>
          </li>

          <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Slack</p>
              <p className="text-xs text-muted-foreground">
                Install the Slack app into this workspace for chat-driven runs.
                Not available yet — same flow as onboarding will land here.
              </p>
            </div>
            <div className="flex shrink-0">
              <Button type="button" variant="secondary" size="sm" disabled>
                Coming soon
              </Button>
            </div>
          </li>
        </ul>

        {!canManage ? (
          <p className="border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
            You need owner or admin on this workspace to connect or reconnect
            integrations.
          </p>
        ) : null}
      </div>
    </div>
  );
}
