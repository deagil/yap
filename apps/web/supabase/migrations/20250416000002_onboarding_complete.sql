-- Gate app routes until post-auth onboarding; allow workspace rename during onboarding.

alter table public.users
  add column if not exists onboarding_complete boolean not null default false;

comment on column public.users.onboarding_complete is
  'False until the post-auth onboarding survey is submitted.';

-- Existing accounts skip onboarding (column was added with default false for old rows).
update public.users set onboarding_complete = true;

drop policy if exists "workspaces_update_admin" on public.workspaces;
create policy "workspaces_update_admin" on public.workspaces for update
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));
