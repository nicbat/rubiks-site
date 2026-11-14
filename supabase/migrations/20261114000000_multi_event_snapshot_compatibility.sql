-- Server preparation only: existing snapshots stay v1, with unchanged revisions.
-- New clients must not activate v2 writers until local/sync migration is ready.
create function last_layer_private.event_puzzle(event_id text)
returns text language sql immutable set search_path = '' as $$
  select case event_id when '222' then '2x2' when '333' then '3x3'
    when '333oh' then '3x3' when '333bf' then '3x3'
    when '444' then '4x4' when '444bf' then '4x4'
    when '555' then '5x5' when '555bf' then '5x5'
    when '666' then '6x6' when '777' then '7x7' end;
$$;

-- JavaScript's ISO parser allows year 0000 and timezone offsets through 23:59.
-- PostgreSQL's timestamp text input does not; parse components explicitly.
create function last_layer_private.training_timestamp(value text)
returns timestamptz language plpgsql immutable set search_path = '' as $$
declare parts text[]; result timestamptz; year integer;
begin
  parts := regexp_match(value, '^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,3})?(Z|([+-])([01]\d|2[0-3]):([0-5]\d))$');
  if parts is null then raise exception 'Invalid training timestamp' using errcode = '22007'; end if;
  year := parts[1]::integer;
  result := make_timestamptz(case when year = 0 then -1 else year end, parts[2]::integer, parts[3]::integer,
    parts[4]::integer, parts[5]::integer, (parts[6] || coalesce(parts[7], ''))::double precision, 'UTC');
  if parts[8] <> 'Z' then
    result := result - (case when parts[9] = '+' then 1 else -1 end) * make_interval(hours => parts[10]::integer, mins => parts[11]::integer);
  end if;
  return result;
end;
$$;
create function last_layer_private.training_utc_day(value text)
returns text language sql immutable set search_path = '' as $$
  select case when extract(year from at) = -1 then '0000' || to_char(at, '-MM-DD')
    when extract(year from at) < -1 then '-' || lpad(abs(extract(year from at)::integer + 1)::text, 6, '0') || to_char(at, '-MM')
    when extract(year from at) > 9999 then '+' || lpad(extract(year from at)::integer::text, 6, '0') || to_char(at, '-MM')
    else to_char(at, 'YYYY-MM-DD') end
  from (select last_layer_private.training_timestamp(value) at time zone 'UTC' as at) parsed;
$$;
create function last_layer_private.valid_training_day(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare parts text[];
begin
  parts := regexp_match(value, '^(\d{4})-(\d{2})-(\d{2})$');
  if parts is null then return false; end if;
  perform make_date(case when parts[1]::integer = 0 then -1 else parts[1]::integer end, parts[2]::integer, parts[3]::integer);
  return true;
exception when others then return false;
end;
$$;
create function last_layer_private.valid_training_timestamp(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(isfinite(last_layer_private.training_timestamp(value)), false);
exception when others then return false;
end;
$$;

create function last_layer_private.valid_event_scramble(event_id text, algorithm text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare size integer; moves text[]; token text; wide text[]; width integer;
begin
  size := left(last_layer_private.event_puzzle(event_id), 1)::integer;
  if size is null or algorithm is null or length(algorithm) not between 1 and 4096
    or algorithm ~ '[^URFDLBwxyz0-9 '' ]' then return false; end if;
  moves := string_to_array(algorithm, ' ');
  if cardinality(moves) > 512 then return false; end if;
  foreach token in array moves loop
    if token ~ '^[URFDLB](2|'')?$' then continue; end if;
    if event_id in ('333bf', '444bf', '555bf') and token ~ '^[xyz](2|'')?$' then continue; end if;
    wide := regexp_match(token, '^([2-3])?[URFDLB]w(2|'')?$');
    if wide is null or size < 4 then return false; end if;
    width := coalesce(wide[1]::integer, 2);
    if width > size / 2 then return false; end if;
  end loop;
  return true;
end;
$$;

-- Match JavaScript string budgets (UTF-16 code units) and String.trim.
create function last_layer_private.training_string_length(value text)
returns integer language sql immutable set search_path = '' as $$
  select length(value) + length(regexp_replace(value, U&'[\0001-\FFFF]', '', 'g'));
$$;
create function last_layer_private.training_string_trim(value text)
returns text language sql immutable set search_path = '' as $$
  select btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

-- Structural learning checks protect every cast used by summaries. Catalog IDs,
-- variant availability and course/module membership remain client-owned checks.
create function last_layer_private.valid_training_progress(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; entry record; field text;
begin
  if jsonb_typeof(value) is distinct from 'object' or value->'version' is distinct from '2'::jsonb
    or jsonb_typeof(value->'selected') is distinct from 'array'
    or jsonb_typeof(value->'attempts') is distinct from 'array'
    or jsonb_typeof(value->'variants') is distinct from 'object'
    then return false; end if;
  if jsonb_array_length(value->'attempts') > 100000 then return false; end if;
  if exists(select 1 from jsonb_array_elements(value->'selected') x where jsonb_typeof(x) <> 'string') then return false; end if;
  for entry in select * from jsonb_each(value->'variants') loop
    if jsonb_typeof(entry.value) <> 'number' or entry.value::text !~ '^[0-9]+$' or entry.value::text::numeric > 2147483647 then return false; end if;
  end loop;
  foreach field in array array['known','twoLookKnown'] loop
    if value ? field then
      if jsonb_typeof(value->field) <> 'object' then return false; end if;
      for entry in select * from jsonb_each(value->field) loop
        if jsonb_typeof(entry.value) <> 'array' then return false; end if;
        if exists(select 1 from jsonb_array_elements(entry.value) x where jsonb_typeof(x) <> 'number' or x::text !~ '^[0-9]+$' or x::text::numeric > 2147483647) then return false; end if;
      end loop;
    end if;
  end loop;
  if value ? 'reviewed' then
    if jsonb_typeof(value->'reviewed') <> 'array' then return false; end if;
    if exists(select 1 from jsonb_array_elements(value->'reviewed') x where jsonb_typeof(x) <> 'string') then return false; end if;
  end if;
  if value ? 'activeCourse' and jsonb_typeof(value->'activeCourse') <> 'string' then return false; end if;
  if value ? 'resume' then
    if jsonb_typeof(value->'resume') <> 'object' then return false; end if;
    if exists(select 1 from jsonb_each(value->'resume') x where jsonb_typeof(x.value) <> 'string') then return false; end if;
  end if;
  if value ? 'transfers' then
    if jsonb_typeof(value->'transfers') <> 'array' then return false; end if;
    if jsonb_array_length(value->'transfers') > 1000 then return false; end if;
    for item in select x from jsonb_array_elements(value->'transfers') x loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'caseId') is distinct from 'string'
        or jsonb_typeof(item->'variant') is distinct from 'number' or item->>'variant' !~ '^[0-9]+$'
        or (item->>'variant')::numeric > 2147483647
        or not coalesce(item->>'method' in ('full','two-look'),false) then return false; end if;
    end loop;
  end if;
  for item in select x from jsonb_array_elements(value->'attempts') x loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'caseId') is distinct from 'string'
      or (item ? 'id' and (jsonb_typeof(item->'id') <> 'string' or length(item->>'id') = 0))
      or jsonb_typeof(item->'variant') is distinct from 'number' or item->>'variant' !~ '^[0-9]+$'
      or (item->>'variant')::numeric > 2147483647
      or not coalesce(item->>'result' in ('help','effort','confident'),false)
      or not coalesce(item->>'mode' in ('recognition','rehearsal'),false)
      or (item ? 'method' and not coalesce(item->>'method' in ('full','two-look'),false))
      or not last_layer_private.valid_training_timestamp(item->>'at')
      or not last_layer_private.valid_training_day(item->>'day') then return false; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(value->'attempts') x where x ? 'id' group by x->>'id' having count(*) > 1) then return false; end if;
  return true;
exception when others then return false;
end;
$$;

create function last_layer_private.valid_training_v2(data jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; grip jsonb; provenance jsonb; defaults jsonb; entry record; up_color text; front_color text;
begin
  if jsonb_typeof(data) is distinct from 'object'
    or data - array['format','version','progress','solves','cubeCollection'] <> '{}'::jsonb
    or data->>'format' is distinct from 'last-layer-training' or data->'version' is distinct from '2'::jsonb
    or not last_layer_private.valid_training_progress(data->'progress')
    or jsonb_typeof(data->'solves') is distinct from 'array'
    or jsonb_typeof(data->'cubeCollection') is distinct from 'object'
    or (data->'cubeCollection') - array['cubes','defaultsByEvent'] <> '{}'::jsonb
    or jsonb_typeof(data->'cubeCollection'->'cubes') is distinct from 'array'
    or jsonb_typeof(data->'cubeCollection'->'defaultsByEvent') is distinct from 'object'
    then return false; end if;
  if jsonb_array_length(data->'solves') > 100000 or jsonb_array_length(data->'cubeCollection'->'cubes') > 100000 then return false; end if;
  for item in select value from jsonb_array_elements(data->'cubeCollection'->'cubes') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['id','name','description','deleted','puzzleId'] <> '{}'::jsonb
      or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') = 0
      or jsonb_typeof(item->'name') is distinct from 'string' or length(last_layer_private.training_string_trim(item->>'name')) = 0 or last_layer_private.training_string_length(item->>'name') > 100
      or jsonb_typeof(item->'description') is distinct from 'string' or last_layer_private.training_string_length(item->>'description') > 1000
      or (item ? 'deleted' and jsonb_typeof(item->'deleted') <> 'boolean')
      or not coalesce(item->>'puzzleId' in ('2x2','3x3','4x4','5x5','6x6','7x7'), false)
      then return false; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(data->'cubeCollection'->'cubes') c group by c->>'id' having count(*) > 1) then return false; end if;
  defaults := data->'cubeCollection'->'defaultsByEvent';
  for entry in select key, value from jsonb_each(defaults) loop
    if last_layer_private.event_puzzle(entry.key) is null or jsonb_typeof(entry.value) <> 'string'
      or not exists (select 1 from jsonb_array_elements(data->'cubeCollection'->'cubes') c
        where c->'id' = entry.value and c->>'puzzleId' = last_layer_private.event_puzzle(entry.key)
          and not coalesce((c->>'deleted')::boolean, false)) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(data->'solves') loop
    if jsonb_typeof(item) is distinct from 'object'
      or item - array['id','cubeId','elapsed','penalty','date','day','scramble','notes','eventId','scrambleGrip','scrambleProvenance'] <> '{}'::jsonb
      or jsonb_typeof(item->'id') is distinct from 'string' or length(item->>'id') = 0
      or (item ? 'cubeId' and item->'cubeId' <> 'null'::jsonb and (jsonb_typeof(item->'cubeId') <> 'string' or length(item->>'cubeId') = 0))
      or jsonb_typeof(item->'elapsed') is distinct from 'number' or (item->>'elapsed')::numeric < 0 or (item->>'elapsed')::numeric > 1.7976931348623157e308
      or jsonb_typeof(item->'eventId') is distinct from 'string'
      or not last_layer_private.valid_training_timestamp(item->>'date')
      or (item ? 'day' and not last_layer_private.valid_training_day(item->>'day'))
      or (item ? 'penalty' and not coalesce(item->>'penalty' in ('+2','dnf'), false))
      or (item ? 'notes' and (jsonb_typeof(item->'notes') <> 'string' or last_layer_private.training_string_length(item->>'notes') > 5000))
      or jsonb_typeof(item->'scramble') is distinct from 'string'
      or not last_layer_private.valid_event_scramble(item->>'eventId', item->>'scramble')
      then return false; end if;
    grip := item->'scrambleGrip'; up_color := grip->>'up'; front_color := grip->>'front';
    if jsonb_typeof(grip) is distinct from 'object' or grip - array['up','front'] <> '{}'::jsonb
      or not coalesce(up_color in ('white','yellow','red','orange','green','blue'), false)
      or not coalesce(front_color in ('white','yellow','red','orange','green','blue'), false)
      or up_color = front_color
      or (case up_color when 'white' then 'yellow' when 'yellow' then 'white' when 'red' then 'orange' when 'orange' then 'red' when 'green' then 'blue' when 'blue' then 'green' end) = front_color
      then return false; end if;
    if item ? 'scrambleProvenance' then
      provenance := item->'scrambleProvenance';
      if jsonb_typeof(provenance) is distinct from 'object' or provenance - array['id','version','method'] <> '{}'::jsonb
        or jsonb_typeof(provenance->'id') is distinct from 'string' or last_layer_private.training_string_length(provenance->>'id') not between 1 and 128
        or jsonb_typeof(provenance->'version') is distinct from 'string' or last_layer_private.training_string_length(provenance->>'version') not between 1 and 128
        or last_layer_private.training_string_trim(provenance->>'id') <> provenance->>'id' or last_layer_private.training_string_trim(provenance->>'version') <> provenance->>'version'
        or (provenance->>'id') ~ U&'[\0001-\001F\007F]' or (provenance->>'version') ~ U&'[\0001-\001F\007F]'
        or not coalesce(provenance->>'method' in ('random-state','random-move'), false)
        then return false; end if;
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(data->'solves') s group by s->>'id' having count(*) > 1) then return false; end if;
  if exists (select 1 from jsonb_array_elements(data->'solves') s
    left join jsonb_array_elements(data->'cubeCollection'->'cubes') c on c->'id' = s->'cubeId'
    where s->'cubeId' is not null and s->'cubeId' <> 'null'::jsonb
      and (c is null or c->>'puzzleId' <> last_layer_private.event_puzzle(s->>'eventId'))) then return false; end if;
  return true;
exception when others then return false;
end;
$$;

alter table public.training_snapshots drop constraint training_snapshots_payload_check;
alter table public.training_snapshots add constraint training_snapshots_payload_check check (
  jsonb_typeof(payload) = 'object' and payload @> '{"format":"last-layer-training"}'::jsonb
  and payload->'version' in ('1'::jsonb, '2'::jsonb)
  and payload ?& array['format','version','progress','solves','cubeCollection']
  and octet_length(payload::text) <= 20000000
);
create function last_layer_private.guard_training_snapshot_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.payload->'version' = '2'::jsonb and new.payload->'version' = '1'::jsonb then
    raise exception using errcode = '23514', message = 'TRAINING_SCHEMA_DOWNGRADE: update this client before saving version-2 training data';
  end if;
  if new.payload->'version' = '2'::jsonb and not last_layer_private.valid_training_v2(new.payload) then
    raise exception using errcode = '23514', message = 'Invalid version-2 training snapshot';
  end if;
  return new;
end;
$$;
create trigger guard_training_snapshot_version before insert or update on public.training_snapshots
  for each row execute function last_layer_private.guard_training_snapshot_version();

-- Reuse the catalog-sensitive learning computation once, never once per event.
alter function last_layer_private.progress_summary(jsonb) rename to progress_summary_learning_legacy;
create function last_layer_private.progress_summary(data jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  with event_ids(event_id) as (values ('222'),('333'),('444'),('555'),('666'),('777'),('333oh'),('333bf'),('444bf'),('555bf')),
  snapshot_version as materialized (select data->'version' = '2'::jsonb as native_v2),
  learning_payload as materialized (
    select jsonb_set(jsonb_set(data, '{solves}', '[]'::jsonb), '{progress,attempts}',
      coalesce((select jsonb_agg(case when item->>'at' ~ '^0000|[+-](1[6-9]|2[0-3]):[0-5][0-9]$'
        then jsonb_set(item, '{at}', to_jsonb(last_layer_private.training_timestamp(item->>'at')::text)) else item end order by ordinal)
        from jsonb_array_elements(coalesce(data->'progress'->'attempts', '[]'::jsonb)) with ordinality a(item, ordinal)), '[]'::jsonb)) as value
  ), learning as materialized (
    select last_layer_private.progress_summary_learning_legacy(value) as summary from learning_payload
  ), solves as materialized (
    select case when snapshot_version.native_v2 then item->>'eventId' else '333' end as event_id,
      row_number() over (order by last_layer_private.training_timestamp(item->>'date'), ordinal) as n,
      coalesce(item->>'day', last_layer_private.training_utc_day(item->>'date')) as day,
      (item->>'elapsed')::numeric as raw_elapsed,
      case when item->>'penalty' = 'dnf' then null else (item->>'elapsed')::numeric + case when item->>'penalty' = '+2' then 2000 else 0 end end as elapsed
    from jsonb_array_elements(coalesce(data->'solves', '[]'::jsonb)) with ordinality as s(item, ordinal)
    cross join snapshot_version
  ), rolling as (
    select event_id, n,
      count(*) over w5 as count5, count(elapsed) over w5 as finite5,
      sum(elapsed) over w5 as sum5, min(elapsed) over w5 as min5, max(elapsed) over w5 as max5,
      count(*) over w12 as count12, count(elapsed) over w12 as finite12,
      sum(elapsed) over w12 as sum12, min(elapsed) over w12 as min12, max(elapsed) over w12 as max12
    from solves window w5 as (partition by event_id order by n rows between 4 preceding and current row),
      w12 as (partition by event_id order by n rows between 11 preceding and current row)
  ), averages as materialized (
    select event_id, n,
      case when count5 = 5 and finite5 >= 4 then (sum5 - min5 - case when finite5 = 5 then max5 else 0 end) / 3 end as ao5,
      case when count12 = 12 and finite12 >= 11 then (sum12 - min12 - case when finite12 = 12 then max12 else 0 end) / 10 end as ao12,
      count5 = 5 and finite5 < 4 as dnf5, count12 = 12 and finite12 < 11 as dnf12 from rolling
  ), single_stats as (
    select event_id, count(*) as solve_count, sum(raw_elapsed) as total_time_ms,
      min(elapsed) as best_ms, percentile_cont(0.5) within group (order by elapsed) as median_ms from solves group by event_id
  ), average_stats as (
    select event_id, min(ao5) as best_ao5_ms, min(ao12) as best_ao12_ms from averages group by event_id
  ), events as (
    select jsonb_object_agg(e.event_id, jsonb_build_object(
      'solve_count', coalesce(s.solve_count, 0), 'total_time_ms', coalesce(s.total_time_ms, 0),
      'best_ms', s.best_ms, 'median_ms', s.median_ms, 'best_ao5_ms', a.best_ao5_ms, 'best_ao12_ms', a.best_ao12_ms)) as summary
    from event_ids e left join single_stats s using(event_id) left join average_stats a using(event_id)
  ), days as (
    select day from solves union select coalesce(item->>'day', last_layer_private.training_utc_day(item->>'at')) from jsonb_array_elements(coalesce(data->'progress'->'attempts', '[]'::jsonb)) item
  ), activity as (
    select jsonb_build_object('solve_count', (select count(*) from solves), 'total_time_ms', coalesce((select sum(raw_elapsed) from solves), 0),
      'practice_count', learning.summary->'practice_count', 'active_days', (select count(*) from days)) as summary from learning
  )
  select learning.summary || (events.summary->'333') || jsonb_build_object(
    'summary_version', 2, 'activity', activity.summary, 'events', events.summary,
    'active_days', activity.summary->'active_days',
    'ao5_ms', (select ao5 from averages where event_id = '333' order by n desc limit 1),
    'ao12_ms', (select ao12 from averages where event_id = '333' order by n desc limit 1),
    'ao5_dnf', coalesce((select dnf5 from averages where event_id = '333' order by n desc limit 1), false),
    'ao12_dnf', coalesce((select dnf12 from averages where event_id = '333' order by n desc limit 1), false))
  from learning cross join events cross join activity;
$$;

create or replace function last_layer_private.refresh_profile_stats()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.payload = old.payload and exists (
    select 1 from public.profile_stats where user_id = new.user_id and summary->>'summary_version' = '2'
  ) then return new; end if;
  insert into public.profile_stats(user_id, summary)
    values(new.user_id, last_layer_private.progress_summary(new.payload) || jsonb_build_object('updated_at', now()))
    on conflict(user_id) do update set summary = excluded.summary;
  return new;
end;
$$;
-- Do not touch training_snapshots: a summary rebuild is not a user's data edit.
insert into public.profile_stats(user_id, summary)
  select user_id, last_layer_private.progress_summary(payload) || jsonb_build_object('updated_at', now()) from public.training_snapshots
  on conflict(user_id) do update set summary = excluded.summary;

create or replace function public.profile_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', p.username, 'is_public', p.is_public,
    'avatar_id', p.avatar_id, 'display_name', p.display_name, 'bio', p.bio, 'learning_goal', p.learning_goal,
    'stats', case when p.is_public or (auth.role() = 'authenticated' and p.user_id = (select auth.uid()))
      then jsonb_build_object(
        'summary_version', stats.summary->'summary_version', 'activity', stats.summary->'activity', 'events', stats.summary->'events',
        'practice_count', stats.summary->'practice_count', 'active_days', stats.summary->'active_days',
        'confident_count', stats.summary->'confident_count', 'case_count', stats.summary->'case_count',
        'total_time_ms', stats.summary->'total_time_ms', 'solve_count', stats.summary->'solve_count',
        'best_ms', stats.summary->'best_ms', 'median_ms', stats.summary->'median_ms',
        'best_ao5_ms', stats.summary->'best_ao5_ms', 'best_ao12_ms', stats.summary->'best_ao12_ms') else null end)
  from public.profiles p left join public.profile_stats s using(user_id)
  cross join lateral (select coalesce(s.summary, last_layer_private.progress_summary('{}'::jsonb)) as summary) stats
  where p.username = profile_username;
$$;
-- profile_stats_for_username already returns the full fixed summary with the
-- same owner/public gate; it automatically includes the versioned projection.
revoke all on function last_layer_private.event_puzzle(text),
  last_layer_private.valid_training_day(text), last_layer_private.valid_training_timestamp(text),
  last_layer_private.valid_event_scramble(text,text), last_layer_private.valid_training_v2(jsonb),
  last_layer_private.training_string_length(text), last_layer_private.training_string_trim(text),
  last_layer_private.valid_training_progress(jsonb),
  last_layer_private.training_timestamp(text), last_layer_private.training_utc_day(text),
  last_layer_private.guard_training_snapshot_version(), last_layer_private.progress_summary(jsonb)
  from public, anon, authenticated;
