"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
};

export function WorkspaceSwitcher(props: {
  activeWorkspaceId: string;
  workspaces: WorkspaceSummary[];
}) {
  const router = useRouter();
  const active = props.workspaces.find((w) => w.id === props.activeWorkspaceId);

  async function switchWorkspace(id: string) {
    if (id === props.activeWorkspaceId) {
      return;
    }
    const res = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  if (props.workspaces.length <= 1) {
    return (
      <div className="truncate px-2 py-1 text-xs text-muted-foreground">
        {active?.name ?? "Workspace"}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 max-w-[12rem] gap-1 px-2 font-normal"
          type="button"
        >
          <span className="truncate">{active?.name ?? "Workspace"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {props.workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => void switchWorkspace(w.id)}
            className={w.id === props.activeWorkspaceId ? "bg-muted" : ""}
          >
            {w.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
