alter table public.profiles
  add column display_name text not null default '' check (char_length(display_name) <= 60),
  add column bio text not null default '' check (char_length(bio) <= 280),
  add column learning_goal text not null default '' check (char_length(learning_goal) <= 120),
  add column share_stats boolean not null default false;
grant select (display_name, bio, learning_goal, share_stats) on public.profiles to anon, authenticated;
grant update (display_name, bio, learning_goal, share_stats) on public.profiles to authenticated;

-- A server-maintained summary. Raw training snapshots remain owner-only, and
-- clients cannot publish arbitrary aggregates or query this table directly.
create table public.profile_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary jsonb not null
);
alter table public.profile_stats enable row level security;
revoke all on public.profile_stats from public, anon, authenticated;
create schema if not exists last_layer_private;
revoke all on schema last_layer_private from public, anon, authenticated;
create function last_layer_private.refresh_profile_stats()
returns trigger language plpgsql security definer set search_path = '' as $$
declare result jsonb; known_count integer;
begin
  if tg_op = 'UPDATE' and new.payload = old.payload and exists (
    select 1 from public.profile_stats where user_id = new.user_id
  ) then return new; end if;
  with history as (
    select row_number() over (order by (item->>'date')::timestamptz desc, ordinal desc) as recent,
      case when item->>'penalty' = 'dnf' then null
        else (item->>'elapsed')::numeric + case when item->>'penalty' = '+2' then 2000 else 0 end end as elapsed
    from jsonb_array_elements(new.payload->'solves') with ordinality as solves(item, ordinal)
  ), windows as (
    select n, count(*) as total, count(*) filter (where elapsed is null) as dnfs,
      sum(elapsed) as total_time, min(elapsed) as fastest, max(elapsed) as slowest
    from history cross join (values (5), (12)) as sizes(n) where recent <= n group by n
  )
  select jsonb_build_object(
    'solve_count', (select count(*) from history),
    'best_ms', (select min(elapsed) from history),
    'ao5_ms', (select case when total = 5 and dnfs <= 1 then (total_time - fastest - case when dnfs = 0 then slowest else 0 end) / 3 end from windows where n = 5),
    'ao5_dnf', coalesce((select total = 5 and dnfs > 1 from windows where n = 5), false),
    'ao12_ms', (select case when total = 12 and dnfs <= 1 then (total_time - fastest - case when dnfs = 0 then slowest else 0 end) / 10 end from windows where n = 12),
    'ao12_dnf', coalesce((select total = 12 and dnfs > 1 from windows where n = 12), false),
    'updated_at', now()
  ) into result;
  select count(*) into known_count from (
    select key, variant from (
      select key, value from jsonb_each(coalesce(new.payload->'progress'->'known', '{}'::jsonb))
      union all
      select key, value from jsonb_each(coalesce(new.payload->'progress'->'twoLookKnown', '{}'::jsonb))
    ) as marks cross join lateral jsonb_array_elements(value) as variants(variant)
    group by key, variant
  ) as unique_marks;
  insert into public.profile_stats(user_id, summary)
    values (new.user_id, result || jsonb_build_object('known_count', known_count))
    on conflict (user_id) do update set summary = excluded.summary;
  return new;
end;
$$;
revoke all on function last_layer_private.refresh_profile_stats() from public, anon, authenticated;
create trigger refresh_profile_stats after insert or update of payload on public.training_snapshots
  for each row execute function last_layer_private.refresh_profile_stats();
-- Backfill through the trigger without changing payloads or revisions.
update public.training_snapshots set payload = payload;
create function public.profile_stats_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.summary from public.profiles p join public.profile_stats s using (user_id)
  where p.username = profile_username
    and ((auth.role() = 'authenticated' and p.user_id = (select auth.uid())) or (p.is_public and p.share_stats));
$$;
revoke all on function public.profile_stats_for_username(text) from public;
grant execute on function public.profile_stats_for_username(text) to anon, authenticated;

-- This function accepts a confirmation string, never a target user ID. Deleting
-- auth.users cascades through this account's profile, snapshots and summary.
create function public.delete_my_account(confirmation text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); expected text;
begin
  if owner_id is null or auth.role() is distinct from 'authenticated' then raise exception 'Authentication required'; end if;
  if not exists(select 1 from auth.users where id = owner_id) then return true; end if;
  select username into expected from public.profiles where user_id = owner_id for update;
  if confirmation is distinct from coalesce(expected, 'DELETE') then
    raise exception 'Account confirmation does not match';
  end if;
  delete from auth.users where id = owner_id;
  return true;
end;
$$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
