begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.profiles(user_id, username) values ('11111111-1111-4111-8111-111111111111', 'learner'), ('22222222-2222-4222-8222-222222222222', 'other_learner');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin
  assert (select avatar_id from public.profiles where user_id = auth.uid()) = 'cube';
  update public.profiles set avatar_id = 'ocean' where user_id = auth.uid();
  assert public.profile_for_username('learner')->>'avatar_id' = 'ocean';
  -- A newer/removed catalog ID remains valid, independent of database releases.
  update public.profiles set avatar_id = 'retired-picture' where user_id = auth.uid();
  begin
    update public.profiles set avatar_id = '../untrusted' where user_id = auth.uid();
    raise exception 'Unsafe picture ID accepted';
  exception when check_violation then null; end;
  update public.profiles set avatar_id = 'ocean' where username = 'other_learner';
end $$;
reset role;
do $$ begin
  assert (select avatar_id from public.profiles where username = 'other_learner') = 'cube';
end $$;
set local role anon;
set local request.jwt.claim.role = 'anon';
do $$ begin
  assert public.profile_for_username('learner')->>'avatar_id' = 'retired-picture';
  assert public.profile_for_username('learner')->'stats' = 'null'::jsonb;
  assert (select avatar_id from public.profiles where username = 'learner') = 'retired-picture';
  begin
    update public.profiles set avatar_id = 'ocean' where username = 'learner';
    raise exception 'Anonymous picture write allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
