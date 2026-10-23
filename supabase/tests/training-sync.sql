-- Run against a migrated, disposable Supabase database with ON_ERROR_STOP=1.
-- Every fixture and write is rolled back. Assertion errors fail psql's exit code.
begin;
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.profiles(user_id, username) values
  ('11111111-1111-4111-8111-111111111111', 'training_owner'),
  ('22222222-2222-4222-8222-222222222222', 'training_other');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
declare result integer;
begin
  assert auth.uid() = '11111111-1111-4111-8111-111111111111'::uuid, 'JWT owner';
  result := public.save_training_snapshot('{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}', 0);
  assert result = 1, 'First insert must start at revision 1';
  assert (select count(*) from public.training_snapshots) = 1, 'Owner can read';
  assert public.save_training_snapshot('{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}', 0) is null, 'Duplicate first write must conflict';
  result := public.save_training_snapshot('{"format":"last-layer-training","version":1,"progress":{"marker":"new"},"solves":[],"cubeCollection":{}}', 1);
  assert result = 2, 'Matching update increments revision';
  assert public.save_training_snapshot('{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}', 1) is null, 'Stale revision must conflict';
  assert (select payload->'progress'->>'marker' from public.training_snapshots) = 'new', 'Stale write preserved latest payload';
  begin
    perform public.save_training_snapshot('{}', 2);
    raise exception 'Invalid payload was accepted';
  exception when check_violation then null;
  end;
  begin
    delete from public.training_snapshots;
    raise exception 'Direct deletion was permitted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare affected integer;
begin
  assert (select count(*) from public.training_snapshots) = 0, 'Other user data must be invisible';
  update public.training_snapshots set payload = '{}' where user_id = '11111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  assert affected = 0, 'Other user cannot update owner data';
  begin
    insert into public.training_snapshots(user_id, revision, payload)
    values ('11111111-1111-4111-8111-111111111111', 3, '{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}');
    raise exception 'Forged owner was accepted';
  exception when insufficient_privilege then null;
  end;
  assert public.save_training_snapshot('{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}', 0) = 1, 'Second owner writes own independent snapshot';
  assert (select count(*) from public.training_snapshots) = 1, 'Second owner sees only own data';
end;
$$;
set local role anon;
do $$
begin
  begin
    perform * from public.training_snapshots;
    raise exception 'Anonymous read was permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_training_snapshot('{}', 0);
    raise exception 'Anonymous write was permitted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
