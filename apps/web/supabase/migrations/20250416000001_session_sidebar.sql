-- Aggregated session list with unread (replaces Drizzle group-by in getSessionsWithUnreadByUserId)
create or replace function public.get_sessions_with_unread(
  p_workspace_id uuid,
  p_status text,
  p_limit int default null,
  p_offset int default 0
)
returns table (
  id text,
  title text,
  status text,
  repo_owner text,
  repo_name text,
  branch text,
  lines_added int,
  lines_removed int,
  pr_number int,
  pr_status text,
  created_at timestamptz,
  last_activity_at timestamptz,
  has_unread boolean,
  has_streaming boolean,
  latest_chat_id text
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with uid as (
    select auth.uid() as id
  ),
  base as (
    select s.*
    from public.sessions s, uid
    where s.user_id = uid.id
      and s.workspace_id = p_workspace_id
      and (
        p_status = 'all'
        or (p_status = 'active' and s.status <> 'archived')
        or (p_status = 'archived' and s.status = 'archived')
      )
  ),
  agg as (
    select
      b.id,
      coalesce(max(c.updated_at), b.created_at) as last_activity_at,
      coalesce(bool_or(
        case
          when c.last_assistant_message_at is null then false
          when cr.last_read_at is null then true
          when c.last_assistant_message_at > cr.last_read_at then true
          else false
        end
      ), false) as has_unread,
      coalesce(bool_or(c.active_stream_id is not null), false) as has_streaming,
      (
        array_agg(c.id order by c.updated_at desc nulls last, c.created_at desc nulls last)
        filter (where c.id is not null)
      )[1] as latest_chat_id
    from base b
    left join public.chats c on c.session_id = b.id
    left join public.chat_reads cr
      on cr.chat_id = c.id
      and cr.user_id = (select id from uid)
    group by b.id, b.created_at
  )
  select
    b.id,
    b.title,
    b.status,
    b.repo_owner,
    b.repo_name,
    b.branch,
    b.lines_added,
    b.lines_removed,
    b.pr_number,
    b.pr_status,
    b.created_at,
    a.last_activity_at,
    a.has_unread,
    a.has_streaming,
    a.latest_chat_id
  from base b
  join agg a on a.id = b.id
  order by b.created_at desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit case when p_limit is null then null else p_limit end;
$$;

grant execute on function public.get_sessions_with_unread(uuid, text, int, int) to authenticated;
