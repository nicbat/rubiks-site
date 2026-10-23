-- Authentication establishes identity. A claimed username completes the account.
-- Profile rows contain no email or training data. Handles are permanent in v1.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (
    username ~ '^[a-z][a-z0-9_]{2,23}$'
    and username not in ('admin','administrator','support','settings','account','accounts','lastlayer','last_layer','api','auth')
  ),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select (user_id, username, is_public) on public.profiles to anon, authenticated;
grant insert (user_id, username) on public.profiles to authenticated;
grant update (is_public) on public.profiles to authenticated;
create policy profile_public_read on public.profiles for select to anon
  using (is_public);
create policy profile_read on public.profiles for select to authenticated
  using (is_public or (select auth.uid()) = user_id);
create policy profile_claim on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profile_visibility on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Clients cannot bypass required setup by writing training data directly.
alter policy own_training_insert on public.training_snapshots
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
  ));
alter policy own_training_update on public.training_snapshots
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
  ));
