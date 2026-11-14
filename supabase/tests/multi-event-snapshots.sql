-- No hosted data: disposable integration stack, every fixture rolled back.
begin;
create temporary table event_fixture(data jsonb);
insert into event_fixture
select jsonb_build_object('format','last-layer-training','version',2,
  'progress','{"version":2,"selected":[],"attempts":[],"known":{},"variants":{}}'::jsonb,
  'cubeCollection','{"cubes":[{"id":"a","name":"Three","description":"","puzzleId":"3x3"},{"id":"b","name":"Two","description":"","puzzleId":"2x2","deleted":true}],"defaultsByEvent":{"333":"a","333oh":"a"}}'::jsonb,
  'solves', jsonb_agg(jsonb_build_object('id', 's-'||n, 'eventId', case when n % 2 = 0 then '222' else '333' end,
    'cubeId', case when n % 2 = 0 then 'b' else 'a' end,
    'date', '2026-10-20T01:00:'||lpad(n::text,2,'0')||'Z', 'day', case when n % 2 = 0 then '2026-10-19' else '2026-10-20' end,
    'elapsed', case when n % 2 = 0 then n*100 else n*1000 end, 'scramble','R U2 F''',
    'notes','secret-note', 'scrambleGrip',jsonb_build_object('up','white','front','green')) order by n)) from generate_series(1,24) n;
do $$
declare data jsonb; invalid jsonb; result jsonb; value text; pair text[];
begin
  select f.data into data from event_fixture f;
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{progress}','{}'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{progress,variants}','{"pll-T":"bad"}'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{progress,known}','{"pll-T":null}'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{progress,attempts}','[{"caseId":"pll-T","variant":0,"result":"confident","mode":"recognition","at":"invalid","day":"2026-10-20"}]'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{progress,attempts}','[{"caseId":"pll-T","variant":0,"result":"confident","mode":"recognition","at":"2026-10-20T00:00:00Z","day":"2026-10-20","method":"unknown"}]'));
  assert last_layer_private.valid_training_day('0000-02-29');
  assert not last_layer_private.valid_training_day('0000-02-30');
  assert last_layer_private.valid_training_timestamp('0000-02-29T12:34:56.123+23:00');
  assert last_layer_private.training_utc_day('0000-02-29T12:34:56.123+23:00') = '0000-02-28';
  assert last_layer_private.training_utc_day('2026-10-20T12:00:00+23:00') = '2026-10-19';
  assert last_layer_private.training_utc_day('0000-01-01T00:00:00+23:00') = '-000001-12';
  assert last_layer_private.training_utc_day('9999-12-31T23:00:00-23:00') = '+010000-01';
  assert last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,date}','"0000-02-29T12:34:56.123+23:00"'));
  assert last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleProvenance}',jsonb_build_object('id',U&'x\0085','version','1','method','random-state')));
  assert last_layer_private.valid_training_v2(data), 'Valid interleaved v2 snapshot';
  result := last_layer_private.progress_summary(data);
  assert result->>'summary_version' = '2';
  assert result->'activity'->>'solve_count' = '24';
  assert result->'activity'->>'total_time_ms' = '159600', 'Activity uses raw elapsed';
  assert result->'activity'->>'active_days' = '2', 'Saved local calendar days retained';
  assert result->'events'->'333'->>'solve_count' = '12' and result->>'solve_count' = '12';
  assert result->'events'->'222'->>'solve_count' = '12';
  assert (result->'events'->'333'->>'best_ao5_ms')::numeric = 5000, 'Interleaved other events do not enter rolling windows';
  assert (result->'events'->'222'->>'best_ao5_ms')::numeric = 600;
  assert (result->'events'->'333'->>'best_ao12_ms')::numeric = 12000;
  assert (result->'events'->'222'->>'median_ms')::numeric = 1300;
  assert result->'events'->'777'->>'solve_count' = '0' and result->'events'->'777'->'best_ms' = 'null'::jsonb;
  assert (select count(*) from jsonb_object_keys(result->'events')) = 10;
  assert not (result::text like '%secret-note%') and not result ? 'solves';
  invalid := jsonb_set(data,'{solves,0,penalty}','"dnf"');
  invalid := jsonb_set(invalid,'{solves,2,penalty}','"dnf"');
  result := last_layer_private.progress_summary(invalid);
  assert result->'events'->'333'->'best_ao12_ms' = 'null'::jsonb, 'Two DNF in event-only window';
  assert (result->'events'->'222'->>'best_ao12_ms')::numeric = 1300, 'Other event unaffected by DNF';
  invalid := jsonb_set(data,'{solves,0,penalty}','"+2"');
  assert (last_layer_private.progress_summary(invalid)->'events'->'333'->>'best_ms')::numeric = 3000;
  assert last_layer_private.progress_summary(invalid)->'activity'->>'total_time_ms' = '159600';
  invalid := data #- '{solves,0,day}';
  assert last_layer_private.progress_summary(invalid)->'activity'->>'active_days' = '2', 'Missing day uses UTC date';
  foreach value in array array['333mbf','pyram','toString','__proto__',''] loop
    assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,eventId}',to_jsonb(value))), 'Unknown event rejected';
  end loop;
  assert not last_layer_private.valid_training_v2(data #- '{solves,0,eventId}');
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,eventId}','333'));
  assert not last_layer_private.valid_training_v2(data #- '{solves,0,scrambleGrip}');
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleGrip,front}','"yellow"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleGrip,extra}','true'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleProvenance}','{"id":"x","version":"1","method":"official"}'));
  assert last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleProvenance}','{"id":"x","version":"1","method":"random-state"}'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleProvenance}','{"id":"x","version":"1","method":"random-state","extra":true}'));
  foreach value in array array['R  U','Rw','x','[R,U]','R'||chr(10)||'U','R'||chr(10),''] loop
    assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scramble}',to_jsonb(value))), 'Incompatible notation rejected';
  end loop;
  foreach pair slice 1 in array array[['222','R U'],['333','R U'],['333oh','R U'],['444','Rw U'],['555','2Rw U'],['666','3Rw U'],['777','3Rw U'],['333bf','R x'],['444bf','Rw x'],['555bf','Rw y']] loop
    assert last_layer_private.valid_event_scramble(pair[1],pair[2]), 'All ten event notation policies';
  end loop;
  assert not last_layer_private.valid_event_scramble('444','3Rw');
  assert not last_layer_private.valid_event_scramble('555','3Rw');
  assert not last_layer_private.valid_event_scramble('666','4Rw');
  assert not last_layer_private.valid_event_scramble('777','03Rw');
  assert not last_layer_private.valid_event_scramble('333',repeat('R ',512)||'R');
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,cubeId}','"b"')), 'Equipment mismatch';
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,cubeId}','"missing"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,defaultsByEvent,222}','"b"')), 'Deleted default rejected';
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,defaultsByEvent,222}','"a"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,defaultsByEvent,__proto__}','"a"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,defaultId}','"a"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,id}','"s-2"')), 'Duplicate solve IDs';
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,cubes,0,id}','"b"')), 'Duplicate equipment IDs';
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,date}','"2026-02-30T00:00:00Z"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,day}','"2026-02-30"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,elapsed}','-1'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,puzzleId}','"3x3"'));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,cubes,0,name}',to_jsonb(repeat('😀',51))));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{cubeCollection,cubes,0,name}',to_jsonb(U&'\00A0'::text)));
  assert not last_layer_private.valid_training_v2(jsonb_set(data,'{solves,0,scrambleProvenance}',jsonb_build_object('id',U&'\00A0x','version','1','method','random-state')));
  invalid := jsonb_set(data,'{progress,attempts}','[{"at":"2026-10-18T23:00:00Z","day":"2026-10-18"},{"at":"2026-10-17T23:00:00Z"}]');
  assert last_layer_private.progress_summary(invalid)->'activity'->>'active_days' = '4', 'Practice UTC fallback contributes activity days';
end $$;

insert into auth.users(id) values ('44444444-4444-4444-8444-444444444444'), ('55555555-5555-4555-8555-555555555555');
insert into public.profiles(user_id,username) values ('44444444-4444-4444-8444-444444444444','multi_owner'), ('55555555-5555-4555-8555-555555555555','multi_other');
grant select on event_fixture to authenticated;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
do $$ declare data jsonb; old_data jsonb; result jsonb; before jsonb; begin
  select f.data into data from event_fixture f;
  old_data := '{"format":"last-layer-training","version":1,"progress":{},"solves":[],"cubeCollection":{}}';
  assert public.save_training_snapshot(old_data,0) = 1, 'Legacy shape remains accepted';
  assert public.save_training_snapshot(data,1) = 2, 'Explicit CAS upgrade accepted';
  assert public.save_training_snapshot(data,1) is null, 'Stale upgrade conflicts';
  select to_jsonb(s) into before from public.training_snapshots s where user_id = auth.uid();
  begin
    perform public.save_training_snapshot(old_data,2);
    raise exception 'RPC downgrade permitted';
  exception when check_violation then assert sqlerrm like 'TRAINING_SCHEMA_DOWNGRADE:%'; end;
  begin
    update public.training_snapshots set payload = old_data, revision = 3 where user_id = auth.uid();
    raise exception 'Direct downgrade permitted';
  exception when check_violation then assert sqlerrm like 'TRAINING_SCHEMA_DOWNGRADE:%'; end;
  assert (select to_jsonb(s) from public.training_snapshots s where user_id = auth.uid()) = before, 'Failed downgrade preserves exact row';
  begin
    update public.training_snapshots set payload = jsonb_set(data,'{solves,0,eventId}','"pyram"') where user_id = auth.uid();
    raise exception 'Direct invalid v2 permitted';
  exception when check_violation then null; end;
  begin
    perform public.save_training_snapshot(jsonb_set(data,'{solves,0,cubeId}','"b"'),2);
    raise exception 'RPC incompatible equipment permitted';
  exception when check_violation then null; end;
  begin
    perform public.save_training_snapshot(jsonb_set(data,'{progress}','{}'),2);
    raise exception 'RPC invalid progress permitted';
  exception when check_violation then null; end;
  begin
    update public.training_snapshots set payload = jsonb_set(data,'{progress,variants}','[]') where user_id = auth.uid();
    raise exception 'Direct invalid progress permitted';
  exception when check_violation then null; end;
  result := public.profile_for_username('multi_owner');
  assert result->'stats'->>'summary_version' = '2';
  assert result->'stats'->'events' = public.profile_stats_for_username('multi_owner')->'events';
  assert result->'stats'->'activity' = public.profile_stats_for_username('multi_owner')->'activity';
  assert result->>'avatar_id' = 'cube';
  assert result::text not like '%secret-note%' and not result ? 'user_id';
end $$;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
do $$ begin
  assert public.profile_for_username('multi_owner')->'stats' = 'null'::jsonb, 'Private stats stay private';
  assert public.profile_stats_for_username('multi_owner') is null;
  assert (select count(*) from public.training_snapshots) = 0;
end $$;
reset role;
-- A stale summary is repaired even when its snapshot bytes did not change.
update public.profile_stats set summary = summary - 'summary_version' where user_id = '44444444-4444-4444-8444-444444444444';
update public.training_snapshots set payload = payload where user_id = '44444444-4444-4444-8444-444444444444';
do $$ begin
  assert (select revision from public.training_snapshots where user_id = '44444444-4444-4444-8444-444444444444') = 2;
  assert (select payload->>'version' from public.training_snapshots where user_id = '44444444-4444-4444-8444-444444444444') = '2';
  assert (select summary->>'summary_version' from public.profile_stats where user_id = '44444444-4444-4444-8444-444444444444') = '2';
end $$;
update public.profiles set is_public = true where username = 'multi_owner';
set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
do $$ declare result jsonb; begin
  result := public.profile_for_username('multi_owner');
  assert result->'stats'->'activity'->>'solve_count' = '24';
  assert result->'stats'->'events' = public.profile_stats_for_username('multi_owner')->'events';
  assert result::text not like '%secret-note%' and not result ? 'user_id';
  begin
    perform * from public.training_snapshots;
    raise exception 'Anonymous snapshot read permitted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
