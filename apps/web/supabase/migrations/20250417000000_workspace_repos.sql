-- Admin-curated repo allowlist per workspace; Git push/PR use installation tokens.
-- sessions.installation_id denormalizes which GitHub App installation applies to the session.

-- ---------------------------------------------------------------------------
-- workspace_repos
-- ---------------------------------------------------------------------------
create table public.workspace_repos (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  installation_id integer not null,
  added_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, repo_owner, repo_name)
);

create index workspace_repos_workspace_id_idx on public.workspace_repos (workspace_id);

comment on table public.workspace_repos is
  'Repos workspace members may use for sessions; admins add rows after GitHub App is installed.';

-- ---------------------------------------------------------------------------
-- sessions.installation_id
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists installation_id integer;

comment on column public.sessions.installation_id is
  'GitHub App installation_id used for git/API; denormalized from github_installations or workspace_repos.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.workspace_repos enable row level security;

create policy "workspace_repos_select_member" on public.workspace_repos for select
  using (workspace_id in (select public.current_workspace_ids()));

create policy "workspace_repos_mutate_admin" on public.workspace_repos for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
