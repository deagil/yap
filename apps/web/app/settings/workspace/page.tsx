import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session/get-server-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function WorkspaceSettingsPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/sign-in?next=/settings/workspace");
  }

  const supabase = await createServerSupabase();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", session.user.id);

  const ids = (memberships ?? []).map((m) => m.workspace_id as string);
  const { data: workspaces } =
    ids.length > 0
      ? await supabase.from("workspaces").select("id, name, slug").in("id", ids)
      : { data: [] };

  const workspaceById = new Map(
    (workspaces ?? []).map((w) => [w.id as string, w]),
  );

  const rows = memberships ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-muted-foreground text-sm">
          General, members, secrets, and integrations for your active workspace.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <h2 className="font-medium">Your workspaces</h2>
        <ul className="text-sm space-y-2">
          {rows.map((m) => {
            const wid = m.workspace_id as string;
            const w = workspaceById.get(wid);
            return (
              <li key={wid}>
                <span className="font-medium">{w?.name ?? wid}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {m.role as string}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-6">
        <h2 className="font-medium">Integrations</h2>
        <p className="text-muted-foreground text-sm">
          Connect Vercel for preview URLs and project listing. Requires owner or
          admin on the active workspace.
        </p>
        <Button asChild variant="secondary">
          <Link href="/api/integrations/vercel/start?next=/settings/workspace">
            Connect Vercel
          </Link>
        </Button>
      </section>
    </div>
  );
}
