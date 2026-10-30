begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222'), ('33333333-3333-4333-8333-333333333333');
insert into public.profiles(user_id, username) values ('11111111-1111-4111-8111-111111111111', 'learner'), ('22222222-2222-4222-8222-222222222222', 'other_learner');
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.profiles set display_name = 'Learner', bio = '<script>plain text</script>', learning_goal = 'Full PLL', share_stats = true where user_id = auth.uid();
do $$ declare data jsonb; result jsonb; begin
  select jsonb_build_object('format', 'last-layer-training', 'version', 1,
    'progress', '{"version":2,"selected":[],"variants":{},"attempts":[],"known":{"pll-T":[0,1],"pll-Ua":[0]},"twoLookKnown":{"pll-T":[0]}}'::jsonb,
    'cubeCollection', '{"cubes":[],"defaultId":null}'::jsonb,
    'solves', jsonb_agg(jsonb_build_object('id', 'solve-' || i, 'elapsed', i * 1000,
      'date', '2026-10-20T00:00:' || lpad(i::text, 2, '0') || 'Z', 'day', '2026-10-20',
      'scramble', repeat('R U ', 9) || 'R U', 'notes', 'secret-note')))
  into data from generate_series(1, 12) as i;
  assert public.save_training_snapshot(data, 0) = 1;
  result := public.profile_stats_for_username('learner');
  assert (result->>'solve_count')::integer = 12;
  assert (result->>'best_ms')::numeric = 1000;
  assert (result->>'ao5_ms')::numeric = 10000;
  assert (result->>'ao12_ms')::numeric = 6500;
  assert (result->>'known_count')::integer = 3, 'Legacy marks deduplicate by case/variant';
  assert not result ? 'solves' and not result ? 'notes' and result::text not like '%secret-note%', 'Summary excludes private history';
  data := jsonb_set(data, '{solves,0,penalty}', '"+2"');
  assert public.save_training_snapshot(data, 1) = 2;
  result := public.profile_stats_for_username('learner');
  assert (result->>'best_ms')::numeric = 2000, 'Penalties affect best single';
  assert (result->>'ao12_ms')::numeric = 6600, 'Penalties affect trimmed average';
  data := data #- '{solves,0,penalty}';
  data := jsonb_set(data, '{solves,11,penalty}', '"dnf"');
  assert public.save_training_snapshot(data, 2) = 3;
  result := public.profile_stats_for_username('learner');
  assert (result->>'ao12_ms')::numeric = 6500, 'One DNF is the discarded worst solve';
  assert (result->>'ao5_dnf')::boolean = false;
  data := jsonb_set(data, '{solves,10,penalty}', '"dnf"');
  assert public.save_training_snapshot(data, 3) = 4;
  result := public.profile_stats_for_username('learner');
  assert result->'ao5_ms' = 'null'::jsonb and (result->>'ao5_dnf')::boolean;
  assert result->'ao12_ms' = 'null'::jsonb and (result->>'ao12_dnf')::boolean;
  begin
    update public.profiles set bio = repeat('x', 281) where user_id = auth.uid();
    raise exception 'Oversized bio allowed';
  exception when check_violation then null; end;
  begin
    perform * from public.profile_stats;
    raise exception 'Direct stats access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from public.profile_stats where user_id = '11111111-1111-4111-8111-111111111111';
update public.training_snapshots set payload = payload where user_id = '11111111-1111-4111-8111-111111111111';
do $$ begin
  assert (select revision from public.training_snapshots where user_id = '11111111-1111-4111-8111-111111111111') = 4, 'Backfill retains revisions';
  assert (select summary->>'solve_count' from public.profile_stats where user_id = '11111111-1111-4111-8111-111111111111') = '12', 'Existing snapshots backfill summary';
end $$;
set local role anon;
set local request.jwt.claim.role = 'anon';
do $$ begin
  assert public.profile_stats_for_username('learner') is null, 'Private profile summary hidden';
  assert public.profile_stats_for_username('missing_learner') is null;
  begin
    perform public.delete_my_account('learner');
    raise exception 'Guest could delete';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
update public.profiles set is_public = true, share_stats = false where user_id = auth.uid();
set local role anon;
set local request.jwt.claim.role = 'anon';
do $$ begin
  assert (select display_name from public.profiles where username = 'learner') = 'Learner';
  assert public.profile_stats_for_username('learner') is not null, 'Public visibility shares summary without a second opt-in';
end $$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
update public.profiles set share_stats = true where user_id = auth.uid();
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
  assert public.profile_stats_for_username('learner') is not null, 'Public opt-in summary visible to other accounts';
  begin
    perform public.delete_my_account('learner');
    raise exception 'Confirmation for another account was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Account confirmation does not match' then raise; end if;
  end;
end $$;
set local role anon;
set local request.jwt.claim.role = 'anon';
do $$ begin assert public.profile_stats_for_username('learner') is not null, 'Public opt-in summary visible to guests'; end $$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
update public.profiles set share_stats = false where user_id = auth.uid();
set local role anon;
set local request.jwt.claim.role = 'anon';
do $$ begin assert public.profile_stats_for_username('learner') is not null, 'Deprecated statistics flag cannot hide a public summary'; end $$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
update public.profiles set is_public = false where user_id = auth.uid();
set local role anon;
set local request.jwt.claim.role = 'anon';
do $$ begin
  assert public.profile_stats_for_username('learner') is null, 'Private visibility immediately revokes legacy summary';
  assert public.profile_for_username('learner')->>'username' = 'learner', 'Private statistics retain discoverable identity';
  assert public.profile_for_username('learner')->'stats' = 'null'::jsonb, 'Private statistics are absent from combined response';
  assert public.profile_for_username('learner')->>'bio' = '<script>plain text</script>';
  assert not public.profile_for_username('learner') ?| array['user_id','email','solves','payload'], 'Identity projection excludes private fields';
  assert public.profile_for_username('missing_learner') is null;
end $$;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
  assert public.profile_for_username('learner')->>'username' = 'learner';
  assert public.profile_for_username('learner')->'stats' = 'null'::jsonb, 'Other accounts cannot see private statistics';
  assert public.profile_stats_for_username('learner') is null;
end $$;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$ begin
  assert public.profile_for_username('learner')->'stats'->>'solve_count' = '12', 'Owner retains private statistics';
  assert public.delete_my_account('learner');
  assert public.delete_my_account('learner'), 'Retry after a lost response is idempotent';
  begin
    insert into public.profiles(user_id, username) values (auth.uid(), 'resurrected');
    raise exception 'Deleted account was resurrected by stale JWT';
  exception when foreign_key_violation then null; end;
end $$;
reset role;
do $$ begin
  assert not exists(select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111');
  assert not exists(select 1 from public.profiles where username = 'learner');
  assert not exists(select 1 from public.training_snapshots where user_id = '11111111-1111-4111-8111-111111111111');
  assert not exists(select 1 from public.profile_stats where user_id = '11111111-1111-4111-8111-111111111111');
  assert exists(select 1 from auth.users where id = '22222222-2222-4222-8222-222222222222'), 'Other account survives';
end $$;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
do $$ begin assert public.delete_my_account('DELETE'), 'Unfinished account can delete itself'; end $$;
rollback;
