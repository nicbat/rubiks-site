-- One complete, versioned training backup per authenticated user. Device
-- preferences and demo data never belong in this table.
create table public.training_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload @> '{"format":"last-layer-training","version":1}'::jsonb
    and payload ?& array['progress', 'solves', 'cubeCollection']
    and octet_length(payload::text) <= 20000000
  ),
  updated_at timestamptz not null default now()
);
alter table public.training_snapshots enable row level security;
revoke all on public.training_snapshots from anon, authenticated;
grant select, insert, update on public.training_snapshots to authenticated;
create policy own_training_read on public.training_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);
create policy own_training_insert on public.training_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy own_training_update on public.training_snapshots for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The owner comes from the verified JWT, never a browser argument. A stale
-- revision returns null instead of overwriting another device's data.
create function public.save_training_snapshot(payload jsonb, expected_revision integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare saved_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if expected_revision < 0 or expected_revision is null then raise exception 'Invalid revision'; end if;
  if expected_revision = 0 then
    insert into public.training_snapshots(user_id, revision, payload)
    values (auth.uid(), 1, payload)
    on conflict (user_id) do nothing returning revision into saved_revision;
  else
    update public.training_snapshots as snapshots
    set payload = save_training_snapshot.payload,
        revision = snapshots.revision + 1, updated_at = now()
    where snapshots.user_id = auth.uid() and snapshots.revision = expected_revision
    returning snapshots.revision into saved_revision;
  end if;
  return saved_revision;
end;
$$;
revoke all on function public.save_training_snapshot(jsonb, integer) from public, anon;
grant execute on function public.save_training_snapshot(jsonb, integer) to authenticated;
