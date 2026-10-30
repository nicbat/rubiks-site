-- Every claimed username is discoverable. Keep the existing privacy choice:
-- is_public now controls statistics only, so previously private stats stay private.
comment on column public.profiles.is_public is 'Whether profile statistics are public; identity fields are always discoverable.';
alter policy profile_public_read on public.profiles using (true);
-- Authenticated table reads remain owner-only so legacy owner filters and
-- writes keep working without making auth IDs enumerable. Public lookups use
-- the explicit SECURITY DEFINER projection below. Guests can read only public
-- columns through the table (including the legacy lookup fallback).
alter policy profile_read on public.profiles using ((select auth.uid()) = user_id);
revoke select (user_id) on public.profiles from anon;

create or replace function public.profile_stats_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.summary from public.profiles p join public.profile_stats s using (user_id)
  where p.username = profile_username and (p.is_public or (auth.role() = 'authenticated' and p.user_id = (select auth.uid())));
$$;

-- Only the fixed summary can be shared. Raw training, notes and auth IDs stay
-- outside this projection, including when the caller owns the requested page.
create or replace function public.profile_for_username(profile_username text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', p.username, 'is_public', p.is_public,
    'display_name', p.display_name, 'bio', p.bio, 'learning_goal', p.learning_goal,
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
