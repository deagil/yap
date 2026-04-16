-- Tenancy foundation: workspaces, profiles, integrations, core app tables, RLS.
-- Apply to a fresh Supabase project (clean slate). Drizzle/Neon migrations are retired.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Workspaces & membership
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_tier text not null default 'free',
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

comment on column public.workspace_members.created_at is 'Used for default workspace ordering';

create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index workspace_invitations_workspace_id_idx
  on public.workspace_invitations (workspace_id);

-- ---------------------------------------------------------------------------
-- Workspace-scoped integrations
-- ---------------------------------------------------------------------------
create table public.workspace_secrets (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key_name text not null,
  encrypted_value text not null,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key_name)
);

create table public.workspace_vercel_connections (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  scope text,
  vercel_user_external_id text,
  token_expires_at timestamptz,
  team_id text,
  team_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_slack_installations (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  slack_team_id text not null unique,
  slack_team_name text,
  bot_token_encrypted text,
  default_channel_id text,
  installed_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, slack_team_id)
);

create index workspace_slack_installations_workspace_id_idx
  on public.workspace_slack_installations (workspace_id);

create table public.workspace_billing (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  metered_sandbox_seconds bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User profile (application layer; auth.users is source of truth for identity)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- GitHub OAuth account link (per user; not workspace-scoped)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null default 'github' check (provider = 'github'),
  external_user_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- ---------------------------------------------------------------------------
-- GitHub App installations (workspace-scoped)
-- ---------------------------------------------------------------------------
create table public.github_installations (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  installation_id integer not null,
  account_login text not null,
  account_type text not null check (account_type in ('User', 'Organization')),
  repository_selection text not null check (repository_selection in ('all', 'selected')),
  installation_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, installation_id),
  unique (workspace_id, account_login)
);

create index github_installations_user_id_idx on public.github_installations (user_id);

-- ---------------------------------------------------------------------------
-- Vercel project links (workspace-scoped)
-- ---------------------------------------------------------------------------
create table public.vercel_project_links (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  project_id text not null,
  project_name text not null,
  team_id text,
  team_slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, repo_owner, repo_name)
);

-- ---------------------------------------------------------------------------
-- Sessions & chats
-- ---------------------------------------------------------------------------
create table public.sessions (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'archived')),
  repo_owner text,
  repo_name text,
  branch text,
  clone_url text,
  vercel_project_id text,
  vercel_project_name text,
  vercel_team_id text,
  vercel_team_slug text,
  is_new_branch boolean not null default false,
  auto_commit_push_override boolean,
  auto_create_pr_override boolean,
  global_skill_refs jsonb not null default '[]'::jsonb,
  sandbox_state jsonb,
  lifecycle_state text check (
    lifecycle_state in (
      'provisioning', 'active', 'hibernating', 'hibernated',
      'restoring', 'archived', 'failed'
    )
  ),
  lifecycle_version integer not null default 0,
  last_activity_at timestamptz,
  sandbox_expires_at timestamptz,
  hibernate_after timestamptz,
  lifecycle_run_id text,
  lifecycle_error text,
  lines_added integer default 0,
  lines_removed integer default 0,
  pr_number integer,
  pr_status text check (pr_status in ('open', 'merged', 'closed')),
  snapshot_url text,
  snapshot_created_at timestamptz,
  snapshot_size_bytes integer,
  cached_diff jsonb,
  cached_diff_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_workspace_id_idx on public.sessions (workspace_id);
create index sessions_workspace_created_idx on public.sessions (workspace_id, created_at);

create table public.chats (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  session_id text not null references public.sessions (id) on delete cascade,
  title text not null,
  model_id text default 'anthropic/claude-haiku-4.5',
  active_stream_id text,
  last_assistant_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chats_session_id_idx on public.chats (session_id);
create index chats_workspace_id_idx on public.chats (workspace_id);

create table public.shares (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chat_id text not null references public.chats (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_id)
);

create table public.chat_messages (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chat_id text not null references public.chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index chat_messages_chat_id_idx on public.chat_messages (chat_id);

create table public.chat_reads (
  user_id uuid not null references public.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chat_id text not null references public.chats (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);

create index chat_reads_chat_id_idx on public.chat_reads (chat_id);

create table public.workflow_runs (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chat_id text not null references public.chats (id) on delete cascade,
  session_id text not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  model_id text,
  status text not null check (status in ('completed', 'aborted', 'failed')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  total_duration_ms integer not null,
  slack_channel_id text,
  created_at timestamptz not null default now()
);

create index workflow_runs_chat_id_idx on public.workflow_runs (chat_id);
create index workflow_runs_session_id_idx on public.workflow_runs (session_id);
create index workflow_runs_user_id_idx on public.workflow_runs (user_id);
create index workflow_runs_workspace_id_idx on public.workflow_runs (workspace_id);

create table public.workflow_run_steps (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  workflow_run_id text not null references public.workflow_runs (id) on delete cascade,
  step_number integer not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null,
  finish_reason text,
  raw_finish_reason text,
  created_at timestamptz not null default now(),
  unique (workflow_run_id, step_number)
);

create index workflow_run_steps_run_id_idx on public.workflow_run_steps (workflow_run_id);

create table public.linked_accounts (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null check (provider in ('slack', 'discord', 'whatsapp', 'telegram')),
  external_id text not null,
  provider_workspace_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id, provider_workspace_id)
);

create table public.user_preferences (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  default_model_id text default 'anthropic/claude-haiku-4.5',
  default_subagent_model_id text,
  default_sandbox_type text default 'vercel' check (default_sandbox_type = 'vercel'),
  default_diff_mode text default 'unified' check (default_diff_mode in ('unified', 'split')),
  auto_commit_push boolean not null default false,
  auto_create_pr boolean not null default false,
  alerts_enabled boolean not null default true,
  alert_sound_enabled boolean not null default true,
  public_usage_enabled boolean not null default false,
  global_skill_refs jsonb not null default '[]'::jsonb,
  model_variants jsonb not null default '[]'::jsonb,
  enabled_model_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table public.usage_events (
  id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  source text not null default 'web' check (source = 'web'),
  agent_type text not null default 'main' check (agent_type in ('main', 'subagent')),
  provider text,
  model_id text,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  tool_call_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth trigger: mirror profile row
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, email, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      split_part(new.email, '@', 1),
      'user'
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (avoid recursion on workspace_members)
-- ---------------------------------------------------------------------------
create or replace function public.current_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid();
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: Slack sign-in — join or create workspace by Slack team
-- ---------------------------------------------------------------------------
create or replace function public.ensure_workspace_for_slack(
  p_slack_team_id text,
  p_slack_team_name text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_slug text;
  v_suffix int := 0;
begin
  select wsi.workspace_id into v_workspace_id
  from public.workspace_slack_installations wsi
  where wsi.slack_team_id = p_slack_team_id
  limit 1;

  if v_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, p_user_id, 'member')
    on conflict (workspace_id, user_id) do nothing;
    return v_workspace_id;
  end if;

  v_slug := lower(regexp_replace(coalesce(nullif(trim(p_slack_team_name), ''), 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'workspace';
  end if;

  while exists (select 1 from public.workspaces w where w.slug = v_slug || case when v_suffix = 0 then '' else '-' || v_suffix::text end) loop
    v_suffix := v_suffix + 1;
  end loop;
  if v_suffix > 0 then
    v_slug := v_slug || '-' || v_suffix::text;
  end if;

  insert into public.workspaces (name, slug, plan_tier)
  values (coalesce(nullif(trim(p_slack_team_name), ''), 'Workspace'), v_slug, 'free')
  returning id into v_workspace_id;

  insert into public.workspace_slack_installations (
    workspace_id, slack_team_id, slack_team_name, installed_by_user_id
  )
  values (v_workspace_id, p_slack_team_id, p_slack_team_name, p_user_id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  return v_workspace_id;
end;
$$;

create or replace function public.ensure_personal_workspace(p_user_id uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_slug text;
  v_suffix int := 0;
  v_name text;
begin
  if exists (
    select 1 from public.workspace_members wm where wm.user_id = p_user_id
  ) then
    select wm.workspace_id into v_workspace_id
    from public.workspace_members wm
    where wm.user_id = p_user_id
    order by wm.created_at
    limit 1;
    return v_workspace_id;
  end if;

  v_name := coalesce(nullif(trim(p_label), ''), 'Personal');
  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'personal';
  end if;

  while exists (select 1 from public.workspaces w where w.slug = v_slug || case when v_suffix = 0 then '' else '-' || v_suffix::text end) loop
    v_suffix := v_suffix + 1;
  end loop;
  if v_suffix > 0 then
    v_slug := v_slug || '-' || v_suffix::text;
  end if;

  insert into public.workspaces (name, slug, plan_tier)
  values (v_name, v_slug, 'free')
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  return v_workspace_id;
end;
$$;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant execute on function public.ensure_workspace_for_slack(text, text, uuid) to service_role;
grant execute on function public.ensure_personal_workspace(uuid, text) to service_role;

-- Allow PostgREST RPC from server (optional; Node uses service role client)
grant execute on function public.ensure_workspace_for_slack(text, text, uuid) to authenticated;
grant execute on function public.ensure_personal_workspace(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
create policy "users_select_self" on public.users for select using (id = auth.uid());
create policy "users_update_self" on public.users for update using (id = auth.uid());

alter table public.workspaces enable row level security;
create policy "workspaces_select_member" on public.workspaces for select
  using (id in (select public.current_workspace_ids()));
create policy "workspaces_insert_authenticated" on public.workspaces for insert
  with check (auth.uid() is not null);

alter table public.workspace_members enable row level security;
create policy "wm_select_member" on public.workspace_members for select
  using (workspace_id in (select public.current_workspace_ids()));
create policy "wm_insert_self" on public.workspace_members for insert
  with check (user_id = auth.uid());

alter table public.workspace_invitations enable row level security;
create policy "inv_select_admin" on public.workspace_invitations for select
  using (public.is_workspace_admin(workspace_id));
create policy "inv_insert_admin" on public.workspace_invitations for insert
  with check (public.is_workspace_admin(workspace_id));

alter table public.workspace_secrets enable row level security;
create policy "secrets_select_admin" on public.workspace_secrets for select
  using (public.is_workspace_admin(workspace_id));
create policy "secrets_mutate_admin" on public.workspace_secrets for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

alter table public.workspace_vercel_connections enable row level security;
create policy "vercel_conn_select_admin" on public.workspace_vercel_connections for select
  using (public.is_workspace_admin(workspace_id));
create policy "vercel_conn_mutate_admin" on public.workspace_vercel_connections for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

alter table public.workspace_slack_installations enable row level security;
create policy "slack_inst_select_member" on public.workspace_slack_installations for select
  using (workspace_id in (select public.current_workspace_ids()));
create policy "slack_inst_mutate_admin" on public.workspace_slack_installations for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

alter table public.workspace_billing enable row level security;
create policy "billing_select_admin" on public.workspace_billing for select
  using (public.is_workspace_admin(workspace_id));
create policy "billing_mutate_admin" on public.workspace_billing for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

alter table public.accounts enable row level security;
create policy "accounts_own" on public.accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.github_installations enable row level security;
create policy "gh_inst_select" on public.github_installations for select
  using (workspace_id in (select public.current_workspace_ids()));
create policy "gh_inst_insert" on public.github_installations for insert
  with check (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  );
create policy "gh_inst_update" on public.github_installations for update
  using (workspace_id in (select public.current_workspace_ids()));
create policy "gh_inst_delete" on public.github_installations for delete
  using (workspace_id in (select public.current_workspace_ids()));

alter table public.vercel_project_links enable row level security;
create policy "vpl_all" on public.vercel_project_links for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()) and user_id = auth.uid());

alter table public.sessions enable row level security;
create policy "sessions_select" on public.sessions for select
  using (workspace_id in (select public.current_workspace_ids()));
create policy "sessions_insert" on public.sessions for insert
  with check (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  );
create policy "sessions_update" on public.sessions for update
  using (workspace_id in (select public.current_workspace_ids()));
create policy "sessions_delete" on public.sessions for delete
  using (workspace_id in (select public.current_workspace_ids()));

alter table public.chats enable row level security;
create policy "chats_all" on public.chats for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

alter table public.shares enable row level security;
create policy "shares_all" on public.shares for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

alter table public.chat_messages enable row level security;
create policy "cm_all" on public.chat_messages for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

alter table public.chat_reads enable row level security;
create policy "cr_all" on public.chat_reads for all
  using (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  )
  with check (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  );

alter table public.workflow_runs enable row level security;
create policy "wr_all" on public.workflow_runs for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

alter table public.workflow_run_steps enable row level security;
create policy "wrs_all" on public.workflow_run_steps for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

alter table public.linked_accounts enable row level security;
create policy "la_all" on public.linked_accounts for all
  using (workspace_id in (select public.current_workspace_ids()))
  with check (workspace_id in (select public.current_workspace_ids()));

alter table public.user_preferences enable row level security;
create policy "up_all" on public.user_preferences for all
  using (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  )
  with check (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  );

alter table public.usage_events enable row level security;
create policy "ue_select" on public.usage_events for select
  using (workspace_id in (select public.current_workspace_ids()));
create policy "ue_insert" on public.usage_events for insert
  with check (
    workspace_id in (select public.current_workspace_ids())
    and user_id = auth.uid()
  );
