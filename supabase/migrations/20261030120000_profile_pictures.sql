-- IDs stay independent of the deployed catalog; removed choices fall back visually.
alter table public.profiles add column avatar_id text not null default 'cube'
  check (avatar_id ~ '^[a-z][a-z0-9_-]{0,63}$');
grant select (avatar_id) on public.profiles to anon;
grant select (avatar_id), update (avatar_id) on public.profiles to authenticated;
create or replace function public.profile_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', p.username, 'is_public', p.is_public,
    'avatar_id', p.avatar_id, 'display_name', p.display_name, 'bio', p.bio, 'learning_goal', p.learning_goal,
    'stats', case when p.is_public or (auth.role() = 'authenticated' and p.user_id = (select auth.uid()))
      then jsonb_build_object(
        'practice_count', stats.summary->'practice_count', 'active_days', stats.summary->'active_days',
        'confident_count', stats.summary->'confident_count', 'case_count', stats.summary->'case_count',
        'total_time_ms', stats.summary->'total_time_ms', 'solve_count', stats.summary->'solve_count',
        'best_ms', stats.summary->'best_ms', 'median_ms', stats.summary->'median_ms',
        'best_ao5_ms', stats.summary->'best_ao5_ms', 'best_ao12_ms', stats.summary->'best_ao12_ms')
      else null end)
  from public.profiles p left join public.profile_stats s using (user_id)
  cross join lateral (select coalesce(s.summary, last_layer_private.progress_summary('{}'::jsonb)) as summary) as stats
  where p.username = profile_username;
$$;
