-- Synthetic local-only users. Sign in with email codes in the local Mailpit inbox.
-- No passwords, remote records, or developer credentials are copied here.
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', id::uuid,
  'authenticated', 'authenticated', email, now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
from (values
  ('10000000-0000-4000-8000-000000000001', 'learner@example.test'),
  ('10000000-0000-4000-8000-000000000002', 'friend@example.test'),
  ('10000000-0000-4000-8000-000000000003', 'private@example.test')
) as fixtures(id, email);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now()
from auth.users where email in ('learner@example.test', 'friend@example.test', 'private@example.test');

insert into public.profiles (user_id, username, is_public, display_name, bio, learning_goal, share_stats)
values
  ('10000000-0000-4000-8000-000000000001', 'local_learner', false, 'Local Learner', 'Local development account.', 'Learning full PLL', false),
  ('10000000-0000-4000-8000-000000000002', 'local_friend', true, 'Local Friend', 'A public profile for local testing.', 'Consistent sub-20 solves', true),
  ('10000000-0000-4000-8000-000000000003', 'local_private', false, 'Private Learner', 'A private local profile.', '', false);

insert into public.training_snapshots (user_id, revision, payload)
select user_id, 1, jsonb_build_object(
  'format', 'last-layer-training', 'version', 1,
  'progress', '{"version":2,"selected":["pll-T","pll-Ua"],"variants":{},"attempts":[],"known":{"pll-T":[0]}}'::jsonb,
  'cubeCollection', '{"cubes":[],"defaultId":null}'::jsonb,
  'solves', (
    select jsonb_agg(jsonb_build_object(
      'id', 'local-solve-' || i, 'cubeId', null,
      'elapsed', 15000 + (i * 791 % 8000),
      'date', to_char((current_date - (30 - i) + time '12:00') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'day', to_char(current_date - (30 - i), 'YYYY-MM-DD'),
      'scramble', 'R U R'' U'' F2 D L2 U R2 F'' D2 B U2 L'' F R2 U'' B2 L D'''
    ) order by i) from generate_series(1, 30) i
  )
) from public.profiles;
