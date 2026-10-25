begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin
  begin
    perform public.save_training_snapshot('{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}', 0);
    raise exception 'Unfinished account wrote training data';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.profiles(user_id, username) values (auth.uid(), 'learner');
do $$ begin
  assert (select is_public from public.profiles where username = 'learner') = false, 'Private by default';
  begin
    update public.profiles set username = 'renamed' where user_id = auth.uid();
    raise exception 'Handle changed without support';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.profiles;
    raise exception 'Client deleted a profile';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
  assert (select count(username) from public.profiles) = 0, 'Private profile invisible to others';
  begin
    insert into public.profiles(user_id, username) values (auth.uid(), 'learner');
    raise exception 'Duplicate username allowed';
  exception when unique_violation then null; end;
  begin
    insert into public.profiles(user_id, username) values (auth.uid(), 'LEARNER');
    raise exception 'Mixed-case alias allowed';
  exception when check_violation then null; end;
  begin
    insert into public.profiles(user_id, username) values (auth.uid(), 'admin');
    raise exception 'Reserved username allowed';
  exception when check_violation then null; end;
  begin
    insert into public.profiles(user_id, username) values ('11111111-1111-4111-8111-111111111111', 'forged');
    raise exception 'Forged owner allowed';
  exception when insufficient_privilege then null; end;
  update public.profiles set is_public = true where username = 'learner';
  assert not exists(select 1 from public.profiles where username = 'learner'), 'Other user cannot publish private profile';
end $$;
set local role anon;
do $$ begin
  assert (select count(username) from public.profiles) = 0, 'Private profile invisible to guests';
  begin
    insert into public.profiles(user_id, username) values ('22222222-2222-4222-8222-222222222222', 'guest');
    raise exception 'Guest claimed a username';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.profiles set is_public = true where user_id = auth.uid();
set local role anon;
do $$ begin
  assert (select username from public.profiles) = 'learner', 'Published profile readable by guests';
end $$;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
update public.profiles set is_public = false where username = 'learner';
set local role anon;
do $$ begin assert (select count(username) from public.profiles) = 1, 'Other user cannot change a public profile'; end $$;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.profiles set is_public = false where user_id = auth.uid();
set local role anon;
do $$ begin assert (select count(username) from public.profiles) = 0, 'Privacy revoked public access'; end $$;
rollback;
