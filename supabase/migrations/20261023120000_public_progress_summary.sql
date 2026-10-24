-- Public profiles include one fixed, server-derived all-time summary.
-- share_stats is retained only for compatibility with older clients; visibility
-- is now the sole sharing control. No private training table grants change.
create function last_layer_private.progress_summary(data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  with catalog(case_id, preferred_variant) as (values
    ('oll-1', 0),
    ('oll-2', 0),
    ('oll-3', 0),
    ('oll-4', 0),
    ('oll-5', 0),
    ('oll-6', 0),
    ('oll-7', 0),
    ('oll-8', 0),
    ('oll-9', 0),
    ('oll-10', 0),
    ('oll-11', 0),
    ('oll-12', 0),
    ('oll-13', 0),
    ('oll-14', 0),
    ('oll-15', 0),
    ('oll-16', 0),
    ('oll-17', 0),
    ('oll-18', 0),
    ('oll-19', 0),
    ('oll-20', 0),
    ('oll-21', 0),
    ('oll-22', 0),
    ('oll-23', 0),
    ('oll-24', 0),
    ('oll-25', 0),
    ('oll-26', 0),
    ('oll-27', 0),
    ('oll-28', 0),
    ('oll-29', 0),
    ('oll-30', 0),
    ('oll-31', 0),
    ('oll-32', 0),
    ('oll-33', 0),
    ('oll-34', 0),
    ('oll-35', 0),
    ('oll-36', 0),
    ('oll-37', 0),
    ('oll-38', 0),
    ('oll-39', 0),
    ('oll-40', 0),
    ('oll-41', 0),
    ('oll-42', 0),
    ('oll-43', 0),
    ('oll-44', 0),
    ('oll-45', 0),
    ('oll-46', 0),
    ('oll-47', 0),
    ('oll-48', 0),
    ('oll-49', 0),
    ('oll-50', 0),
    ('oll-51', 0),
    ('oll-52', 0),
    ('oll-53', 0),
    ('oll-54', 0),
    ('oll-55', 0),
    ('oll-56', 0),
    ('oll-57', 0),
    ('pll-H', 0),
    ('pll-Z', 0),
    ('pll-Ua', 0),
    ('pll-Ub', 0),
    ('pll-Aa', 0),
    ('pll-Ab', 0),
    ('pll-E', 0),
    ('pll-F', 0),
    ('pll-Ja', 0),
    ('pll-Jb', 0),
    ('pll-Ra', 0),
    ('pll-Rb', 0),
    ('pll-T', 0),
    ('pll-Y', 0),
    ('pll-V', 0),
    ('pll-Na', 0),
    ('pll-Nb', 0),
    ('pll-Ga', 0),
    ('pll-Gb', 0),
    ('pll-Gc', 0),
    ('pll-Gd', 0)
  ),
  solves as materialized (
    select row_number() over (order by (item->>'date')::timestamptz, ordinal) as n,
      coalesce(item->>'day', to_char((item->>'date')::timestamptz at time zone 'UTC', 'YYYY-MM-DD')) as day,
      (item->>'elapsed')::numeric as raw_elapsed,
      case when item->>'penalty' = 'dnf' then null
        else (item->>'elapsed')::numeric + case when item->>'penalty' = '+2' then 2000 else 0 end end as elapsed
    from jsonb_array_elements(coalesce(data->'solves', '[]'::jsonb)) with ordinality as s(item, ordinal)
  ),
  rolling as (
    select n,
      count(*) over w5 as count5, count(elapsed) over w5 as finite5,
      sum(elapsed) over w5 as sum5, min(elapsed) over w5 as min5, max(elapsed) over w5 as max5,
      count(*) over w12 as count12, count(elapsed) over w12 as finite12,
      sum(elapsed) over w12 as sum12, min(elapsed) over w12 as min12, max(elapsed) over w12 as max12
    from solves window w5 as (order by n rows between 4 preceding and current row),
      w12 as (order by n rows between 11 preceding and current row)
  ), averages as (
    select n,
      case when count5 = 5 and finite5 >= 4 then (sum5 - min5 - case when finite5 = 5 then max5 else 0 end) / 3 end as ao5,
      case when count12 = 12 and finite12 >= 11 then (sum12 - min12 - case when finite12 = 12 then max12 else 0 end) / 10 end as ao12,
      count5 = 5 and finite5 < 4 as dnf5, count12 = 12 and finite12 < 11 as dnf12
    from rolling
  ), attempts as materialized (
    select item, row_number() over (order by (item->>'at')::timestamptz, ordinal) as n
    from jsonb_array_elements(coalesce(data->'progress'->'attempts', '[]'::jsonb)) with ordinality as a(item, ordinal)
  ), selected_cases as (
    select case_id, coalesce((data->'progress'->'variants'->>case_id)::integer, preferred_variant) as variant
    from catalog
  ), recognition as (
    select c.case_id, a.n, a.item->>'day' as day, a.item->>'result' as result
    from attempts a join selected_cases c on a.item->>'caseId' = c.case_id and (a.item->>'variant')::integer = c.variant
    where a.item->>'mode' = 'recognition' and (
      not (coalesce(a.item->>'method', 'full') = 'two-look' and c.case_id in ('oll-45', 'oll-44', 'oll-2', 'pll-T', 'pll-Y'))
      or exists (select 1 from jsonb_array_elements(coalesce(data->'progress'->'transfers', '[]'::jsonb)) t
        where t->>'caseId' = c.case_id and (t->>'variant')::integer = c.variant and t->>'method' = 'full')
    )
  ), resets as (
    select case_id, max(n) filter (where result <> 'confident') as last_reset from recognition group by case_id
  ), confident as (
    select r.case_id from recognition r join resets z using (case_id) join selected_cases c using (case_id)
    where r.result = 'confident' and r.n > coalesce(z.last_reset, 0)
      and not coalesce(data->'progress'->'known'->c.case_id, '[]'::jsonb) @> to_jsonb(c.variant)
      and not coalesce(data->'progress'->'twoLookKnown'->c.case_id, '[]'::jsonb) @> to_jsonb(c.variant)
    group by r.case_id having count(distinct r.day) >= 3
  ), days as (
    select day from solves union select item->>'day' from attempts
  )
  select jsonb_build_object(
    'practice_count', (select count(*) from attempts),
    'active_days', (select count(*) from days),
    'confident_count', (select count(*) from confident),
    'case_count', (select count(*) from catalog),
    'total_time_ms', coalesce((select sum(raw_elapsed) from solves), 0),
    'solve_count', (select count(*) from solves),
    'best_ms', (select min(elapsed) from solves),
    'median_ms', (select percentile_cont(0.5) within group (order by elapsed) from solves),
    'best_ao5_ms', (select min(ao5) from averages),
    'best_ao12_ms', (select min(ao12) from averages),
    -- Retain old response fields for cached/older application versions.
    'ao5_ms', (select ao5 from averages order by n desc limit 1),
    'ao5_dnf', coalesce((select dnf5 from averages order by n desc limit 1), false),
    'ao12_ms', (select ao12 from averages order by n desc limit 1),
    'ao12_dnf', coalesce((select dnf12 from averages order by n desc limit 1), false),
    'known_count', (select count(*) from (
      select key, v from (
        select key, value from jsonb_each(coalesce(data->'progress'->'known', '{}'::jsonb))
        union all select key, value from jsonb_each(coalesce(data->'progress'->'twoLookKnown', '{}'::jsonb))
      ) marks cross join lateral jsonb_array_elements(value) v group by key, v
    ) unique_marks)
  );
$$;
revoke all on function last_layer_private.progress_summary(jsonb) from public, anon, authenticated;

create or replace function last_layer_private.refresh_profile_stats()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.payload = old.payload and exists (
    select 1 from public.profile_stats where user_id = new.user_id and summary ? 'practice_count'
  ) then return new; end if;
  insert into public.profile_stats(user_id, summary)
    values (new.user_id, last_layer_private.progress_summary(new.payload) || jsonb_build_object('updated_at', now()))
    on conflict (user_id) do update set summary = excluded.summary;
  return new;
end;
$$;
-- Update aggregates only, preserving snapshots, revision numbers and sync state.
update public.training_snapshots set payload = payload;

create or replace function public.profile_stats_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.summary from public.profiles p join public.profile_stats s using (user_id)
  where p.username = profile_username and (p.is_public or (auth.role() = 'authenticated' and p.user_id = (select auth.uid())));
$$;

-- One permission-checked response with an explicit projection: never include raw
-- snapshots, notes, equipment, email or auth IDs, even for an owner lookup.
create function public.profile_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', p.username, 'is_public', p.is_public,
    'display_name', p.display_name, 'bio', p.bio, 'learning_goal', p.learning_goal,
    'stats', jsonb_build_object(
      'practice_count', stats.summary->'practice_count', 'active_days', stats.summary->'active_days',
      'confident_count', stats.summary->'confident_count', 'case_count', stats.summary->'case_count',
      'total_time_ms', stats.summary->'total_time_ms', 'solve_count', stats.summary->'solve_count',
      'best_ms', stats.summary->'best_ms', 'median_ms', stats.summary->'median_ms',
      'best_ao5_ms', stats.summary->'best_ao5_ms', 'best_ao12_ms', stats.summary->'best_ao12_ms'))
  from public.profiles p left join public.profile_stats s using (user_id)
  cross join lateral (select coalesce(s.summary, last_layer_private.progress_summary('{}'::jsonb)) as summary) as stats
  where p.username = profile_username and (p.is_public or (auth.role() = 'authenticated' and p.user_id = (select auth.uid())));
$$;
revoke all on function public.profile_for_username(text) from public;
grant execute on function public.profile_for_username(text) to anon, authenticated;
