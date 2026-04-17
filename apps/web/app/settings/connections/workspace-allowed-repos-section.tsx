"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useId, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useInstallationRepos } from "@/hooks/use-installation-repos";
import { fetcher } from "@/lib/swr";
import { cn } from "@/lib/utils";

type AllowedRepo = {
  repoOwner: string;
  repoName: string;
  installationId: number;
};

type AllowedReposPayload = {
  allowlistEnabled: boolean;
  repos: AllowedRepo[];
};

type WorkspaceInstallation = {
  installationId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
};

export function WorkspaceAllowedReposSection({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const installationSelectId = useId();
  const { data, isLoading, mutate } = useSWR<AllowedReposPayload>(
    "/api/workspace/allowed-repos",
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load");
      }
      return res.json() as Promise<AllowedReposPayload>;
    },
  );

  const { data: workspaceInstallations = [] } = useSWR<WorkspaceInstallation[]>(
    isAdmin ? "/api/workspace/github-installations" : null,
    fetcher,
  );

  const [selectedInstallationId, setSelectedInstallationId] = useState<
    number | null
  >(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const { repos, isLoading: reposLoading } = useInstallationRepos({
    installationId: selectedInstallationId,
    query: repoSearch,
    limit: 30,
  });

  const handleAdd = useCallback(
    async (fullName: string, installationId: number) => {
      const [owner, name] = fullName.split("/");
      if (!owner || !name) {
        return;
      }
      const res = await fetch("/api/workspace/allowed-repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner: owner,
          repoName: name,
          installationId,
        }),
      });
      if (!res.ok) {
        return;
      }
      await mutate();
      setAddOpen(false);
      setRepoSearch("");
    },
    [mutate],
  );

  const handleRemove = useCallback(
    async (repo: AllowedRepo) => {
      const key = `${repo.repoOwner}/${repo.repoName}`;
      setPendingRemove(key);
      try {
        const params = new URLSearchParams({
          repo_owner: repo.repoOwner,
          repo_name: repo.repoName,
        });
        const res = await fetch(
          `/api/workspace/allowed-repos?${params.toString()}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          await mutate();
        }
      } finally {
        setPendingRemove(null);
      }
    },
    [mutate],
  );

  if (isLoading || !data) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Repository allowlist
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Repository allowlist
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          When you add repositories here, workspace members can open sessions on
          those repos without linking their own GitHub accounts. Leave the list
          empty to use the default picker (personal GitHub connection).
        </p>
      </div>

      {data.repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No repositories allowlisted yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {data.repos.map((r) => {
            const key = `${r.repoOwner}/${r.repoName}`;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="font-mono text-xs sm:text-sm">
                  {r.repoOwner}/{r.repoName}
                </span>
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    disabled={pendingRemove === key}
                    onClick={() => handleRemove(r)}
                    aria-label={`Remove ${key}`}
                  >
                    {pendingRemove === key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={installationSelectId}
            >
              Installation
            </label>
            <select
              id={installationSelectId}
              className={cn(
                "flex h-9 w-full min-w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
              value={selectedInstallationId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedInstallationId(v ? Number.parseInt(v, 10) : null);
              }}
            >
              <option value="">Select org or account…</option>
              {workspaceInstallations.map((i) => (
                <option key={i.installationId} value={i.installationId}>
                  {i.accountLogin} ({i.accountType})
                </option>
              ))}
            </select>
          </div>

          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!selectedInstallationId}
              >
                Search & add repo
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(100vw-2rem,400px)] p-0"
              align="start"
            >
              <div className="border-b border-border p-2">
                <input
                  type="search"
                  placeholder="Filter repositories…"
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                />
              </div>
              <Command>
                <CommandList className="max-h-[280px]">
                  <CommandGroup>
                    {reposLoading ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading…
                      </div>
                    ) : repos.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        No matching repositories.
                      </div>
                    ) : (
                      repos.map((repo) => (
                        <CommandItem
                          key={repo.full_name}
                          value={repo.full_name}
                          onSelect={() => {
                            if (selectedInstallationId) {
                              void handleAdd(
                                repo.full_name,
                                selectedInstallationId,
                              );
                            }
                          }}
                        >
                          {repo.full_name}
                          {repo.private ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Private
                            </span>
                          ) : null}
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </section>
  );
}
