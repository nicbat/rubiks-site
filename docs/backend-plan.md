# Accounts, sync, and friend progress

Planning document, reviewed October 19, 2026 against the current working tree. No backend is implemented by this document.

## Goal and recommendation

Let Nicholas and Keven keep separate progress, use multiple devices, and view each other's progress without paying for hosting. Keep guest practice available. Prefer managed infrastructure that agents can implement and maintain without a frontend rewrite.

Keep the static Vite/Svelte app and add Supabase Auth, PostgreSQL, and its generated API. Use database permissions for ordinary reads/writes and small database functions for atomic operations, such as importing a backup or accepting an invitation. Add a privileged server function where necessary, such as account deletion. Cube mechanics, diagrams, playback, scrambles, and grading remain local.

Deliver personal accounts and sync first with Google-only sign-in; add friend sharing second. Add email/password later when mail delivery and recovery are ready, including a way for existing Google users to add a password to the same account. This is a proposed scope, not approval to provision services or deploy changes. Unsettled product choices are listed at the end.

## Current foundations and remaining work

Source review covered `README.md`, `docs/testing.md`, the Svelte views and controller, progress/solve/cube validators, learning-method rules, dashboard, full backups, test-data storage routing, and related tests. This review does not itself establish that tests or browser checks passed.

Already implemented locally:

- Learning storage is version 2 at `last-layer.progress.v2`. Version-1 browser storage is left untouched; version-1 learning files can be explicitly imported. Progress includes learning-set membership, variant choices, shared known marks, legacy two-look marks and recognition links, reviewed lessons, active course, per-course resume positions, and practice attempts.
- New attempts have permanent IDs and capture case, variant, method, result, mode, original local `day`, and timezone-qualified `at`. The validator preserves IDs and rejects duplicates; it still accepts legacy attempts without IDs. Missing IDs are assigned at load/import persistence boundaries, never during rendering.
- Known marks apply to the same case and variant across full/two-look views. Recognition carries over only for matching objectives, with partial-pattern objectives kept distinct. Legacy directional links remain readable. Reviewed Cross/F2L lessons share their mark across courses. Derived confidence must continue to follow these rules.
- Completed solves have stable IDs, raw elapsed milliseconds, scramble, timestamp, optional original local day, cube assignment, optional `+2`/`dnf` penalty, and optional notes. Penalties change effective time without overwriting raw elapsed time. Notes are limited to 5,000 characters. Legacy solves without a day use the viewing device's timezone for day grouping; their original timezone cannot be recovered.
- Cubes have IDs, names, descriptions, a collection-level default, and soft deletion. Retired cubes remain available to resolve historical names; renaming affects displayed history. Deleting the default picks the next active cube or null. Old solves may remain unassigned.
- Full backups use `{ format: "last-layer-training", version: 1, progress, solves, cubeCollection }`. They include learning data, solves/notes/penalties, and retired cubes. Validated learning-only imports replace learning data while retaining solves and cubes; version-1 learning files convert explicitly to version 2. Device preferences are outside the envelope.
- Confirmed full restores and day deletion use a local restore journal to preserve previous stored bytes until replacement commits. Interrupted replacements roll back before training data is read on the next load. Day deletion removes attempts and solves for the selected local date across all cubes, retaining marks, selections, and cube records.
- Bulk Known/learning-set updates build a candidate, save once, and publish it only after success. Failed saves retain the original progress and pending choices. Other local failure paths retain in-tab data and expose warnings/recovery; their behavior must be preserved during the persistence refactor.
- Test data is an isolated in-memory training dataset routed through `training-storage.js`; normal device preferences remain shared. Test mode supports edits, imports, and day deletion without replacing personal training bytes. Reload regenerates sample data. Timer history renders the latest 50 solves and adds 50 per **Show more**; statistics and exports still use all records.

Still required for accounts:

- Guest/per-account storage isolation, durable pending operations, server acknowledgements, incremental downloads, revisions/conflict handling, and deletion propagation.
- Resumable migration/import receipts for legacy records without IDs. Assigning an ID in memory is not enough: after a failed persistence write and reload, the same old record can receive a different ID. Define and test stable identity across save failure/retry before any upload. Do not claim current ID assignment solves this.
- A network/server validation boundary and real database authorization tests. Current local validators and backup recovery are useful foundations, not substitutes.

The restore journal is rollback protection for multi-key localStorage replacement. It is not an account outbox, operation log, account separation, or an IndexedDB migration. Attempts and solves are currently removed locally without sync tombstones.

## Site-wide impact

- **Navigation and settings:** add an account entry point, local-save/sync status, sign-in/out and recovery controls. Add Friends only in the second milestone. Keep all destinations available on phones.
- **Courses, My learning, and library:** sync selections, explicit variants, known/reviewed marks, course/resume state, and agreed learning preferences. Keep filters, searches, collapsed groups, active case popups, and transient focus local. Preserve learning-set ordering or explicitly document/test a change.
- **Practice and rehearsal:** upload completed attempts only. Preserve the existing snapshot of case/variant/method and hidden answer/hint rules. Keep setup, pool, counter, quiz session, and unfinished practice local. Remote updates must not reattribute a result or expose an answer.
- **Progress:** reuse `progress-index.js` and `dashboard.js` semantics. Sync individual attempt/solve deletions and a selected day's deletion atomically. Recompute confidence/statistics; never upload derived confidence as an editable truth.
- **Timer and solve review:** sync completed solves, penalty/notes/cube edits, and deletions. Keep running clock, unfinished solves, scramble preview, chosen session cube, and history expansion local. The latest-50 display limit must not limit sync, backup, or statistics.
- **Cubes:** sync names/descriptions, default changes, and retirement. Preserve same-owner references and historical names. Define conflicts when another device retires the selected/default cube.
- **Backup and recovery:** preserve full and learning-only import scopes, validation, previews, cancellation, and recoverable failure behavior. Define guest replacement separately from signed-in account-wide replacement.
- **Test data:** exclude sample records from migration and every account cache/outbox/upload. Account actions must clearly target personal data; switching sources must not mix queues or replay sample changes.
- **Playback, guides, and preferences:** cube mechanics/catalogs stay bundled. Remote updates must not restart playback, interrupt timing, steal focus, or reset the current interaction. Keep theme, display colors/randomization, PLL arrows, timer display settings, test-data toggle, and collapsed groups device-local initially.

No shared plan editor, chat, notifications, public leaderboard, analytics, uploaded avatars, or catalog editor is needed. A shared plan remains a separate idea in `docs/ideas.md`.

## Accounts and friend experience

- Add optional Google sign-in, sign-out, session restoration, and a small display-name profile for launch. Guest mode remains available. The owner chose email/password for a later rollout; email links and GitHub are outside the requested scope.
- Keep guest and each account separate. Signing in offers a preview of guest and cloud record counts before bringing personal guest data into the account. Never upload automatically on a shared browser. Preserve a recoverable local copy until transfer is acknowledged; an existing cloud account needs an explicit merge decision.
- Sign-out/account switching must invalidate stale responses and isolate pending work across tabs. Warn before explicitly clearing unsynced account data and offer export or discard. Signing out itself must not erase pending work silently.
- Include account deletion with an export opportunity and explicit confirmation. Trusted server-side code must remove owned data, invitations, relationships, and auth identity, then invalidate sessions and local queues.
- In milestone two, add expiring, single-use invitations, acceptance, current friends, and removal. Prefer links over searchable emails or a public user directory. Proposed acceptance establishes mutual learning-progress sharing, explained before acceptance; either participant can remove the relationship.
- Share learning set, chosen variants, known/confident status, practice totals, and a bounded recent-practice list. Keep auth details private. Timer history/statistics require a separate opt-in enforced by database permissions; decide whether notes and cube descriptions are included before enabling solve sharing.
- Refresh friend pages when opened and show last refresh time. Live subscriptions and persistent friend-history caching are unnecessary initially. Revocation blocks future reads and clears visible data at the next permission check; it cannot retract information already copied.

## Sign-in rollout and adding a password

The owner chose this rollout on October 19, 2026:

1. **Launch with Google only.** Configure Google OAuth and Supabase redirects. No application SMTP service or sending domain is required for this sign-in flow. Keep email/password signup, reset-password controls, and email-based confirmation flows out of the launch interface.
2. **Add email/password after mail delivery is ready.** Configure and test confirmation/recovery mail before exposing email/password registration and password-reset flows. This is a later capability, not a prerequisite for Google accounts and sync.
3. **Let existing Google users add a password in Account settings.** Start from their authenticated account and use Supabase's password-update flow, rather than a second signup. Use their existing account email initially. Preserve the auth user ID, profile, data ownership, friendships, and every training record. Adding a password enables another sign-in method and retains Google; it must not create another account, copy history, or remove Google automatically. Changing email is a separate verified flow.

Key all private records, caches, and outboxes by the stable Supabase user ID, never
by email address or sign-in provider. Follow the configured recent-authentication
requirements for password setup, and handle an expired session without exposing
password controls or losing training data. Send passwords only to Supabase Auth;
never save them in application data, logs, local training storage, or backups.

Acceptance checks for the later email/password rollout: sign in with Google,
record training data, add a password, sign out, then sign in with email/password
and verify the same user ID and full data. Verify Google still reaches that same
account. Cover rejected passwords, expired sessions, failed updates, account
email verification, and working password recovery before enabling the feature.
Do not show password sign-in as enabled until the update succeeds. Any future
provider-removal feature must prove another usable sign-in method before unlinking.

Supabase explicitly supports adding email/password to an OAuth account through
`updateUser({ password })`. [Identity-linking FAQ](https://supabase.com/docs/guides/auth/auth-identity-linking#how-to-add-emailpassword-sign-in-to-an-oauth-account),
[password update API](https://supabase.com/docs/reference/javascript/auth-updateuser).

## Data to store

Use repository migrations. This is a logical model, not final SQL; preserve current field meanings rather than copying storage objects into one unversioned row.

- **Profile/account learning state:** auth owner ID, display name, revisions, and agreed learning method. Active course and each course's resume module need explicit values and clear/reset changes. Solve-sharing settings remain owner-controlled.
- **Case selection:** owner, case ID, explicit selected boolean, ordering, revision. Removing membership must sync as a change.
- **Variant choice:** owner, case ID, nullable explicit variant index, revision. Null restores the learning-method/catalog recommendation.
- **Known/reviewed marks:** owner, case/variant or lesson identity, explicit boolean, revision. Support unmarking and bulk transactions. Preserve legacy marks/recognition links through a tested normalization or representation; do not broaden partial-pattern confidence accidentally.
- **Practice attempt:** owner, client ID, case ID, variant, method (legacy omission means full), result, recognition/rehearsal mode, original `at` and local `day`, revision/deletion metadata, server change sequence. Current UI creates and deletes attempts; an immutable payload still needs deletion support.
- **Solve:** owner, existing/client ID, raw elapsed, scramble, original timestamp, optional original local day, nullable same-owner cube reference, optional penalty, notes, revision/deletion metadata, server change sequence. Removing a penalty, note, or cube assignment is an explicit update.
- **Cube/default:** owner, cube ID, name, description, retired flag and revision; account-level nullable default references an active owned cube. A retired cube's historical reference must remain valid.
- **Sync metadata:** private owner/account generation, changes/cursors, operation IDs, migration/import receipts and revision expectations. Distinguish server sync tombstones from the existing cube retirement flag.
- **Friendship/invitation (milestone two):** canonical participant pair; invitation issuer, hashed random token, expiry and consumed/revoked state. Accept through a narrow transactional operation; only participants inspect/remove a relationship.

Scope identities and uniqueness by owner. Index owner/change sequence, owner/time, and friendship checks. A friend's effective variant/method must come from their account, not the viewer. Derive confidence from ordered attempts and shared marks using existing rules; reviewed guides do not grant mastery and quiz scores do not count as practice.

Keep catalog/course JSON in the repository. Validate case, variant, course/module/lesson IDs and recognition-link rules against a versioned manifest on server and client. Do not regenerate upstream data. Older clients encountering a newer incompatible schema/catalog must receive an update-required response without dropping data.

## Reliable sync requirements

1. **Durable local writes.** Introduce a guest/account-scoped repository, preferably IndexedDB, that commits each mutation and pending operation together. Tiny device preferences can remain in localStorage. Preserve in-memory results on storage denial/quota failure and expose recovery/export; never report a failed durable write as saved or synced.
2. **Retry-safe identity.** Preserve attempt/solve/cube IDs and assign operation IDs before recording pending work. Persist retries across reloads and retain the same identity after save failure. Server retries acknowledge the same operation once. Legacy records need resumable mappings/receipts, including distinct IDs for identical repeated attempts.
3. **Incremental downloads.** Use pagination and a server-controlled change cursor with a stable tie-breaker. Advance only after committing a batch locally. An API default page is not the complete history. Bound friend reads and retain one history scan per render.
4. **Explicit conflicts.** Independent attempts/solves merge by ID. Mutable selections, variants, marks, course/resume state, solve edits and cube/default changes use expected revisions. Preserve a stale local choice and offer keep-local/use-synced resolution; avoid client-clock last-write-wins. Define update-versus-delete behavior explicitly.
5. **Deletion propagation.** Persist tombstones/operations for attempt and solve deletion, day deletion, mark/selection removal, and cube retirement/default changes. A day deletion should atomically target the reviewed record IDs; new remote activity must not be silently included after confirmation. Decide how concurrent new activity is presented. An offline device must not resurrect deleted records. Compact change history only with a required full resync for older devices.
6. **Account/source isolation.** Separate guest, each account, and test-data stores/queues. Cancel requests and reject stale responses after account/source changes, across tabs. Never replay one account's operations under another session or upload generated test data.
7. **Bounded work and honest status.** Batch after mutations, login, reconnect and suitable visibility changes, with backoff. Stop retries for permanent validation/auth failures. Distinguish local write failure, offline, expired login, rejected data, backend outage, conflicts, and acknowledged sync. Avoid network calls per timer frame and interaction-disrupting rerenders.
8. **Stable chronology.** Preserve original `at`/`date` and local `day`; server receipt time is metadata. Define deterministic equal-timestamp order, including a tested migration from existing stable input order, before merging. Test difficult-attempt resets and solve average windows. Preserve the legacy missing-day limitation rather than inventing an original timezone.

An already-loaded app should remain usable during backend outages. No-network reload/installation is separate: there is no service worker today. Defer asset caching unless desired, with its own update/recovery tests.

## Migration and backup behavior

Current personal data is split across `last-layer.progress.v2`, `last-layer.solves.v1`, and `last-layer.cubes.v1`; `last-layer.restore.v1` may temporarily hold rollback bytes. Device settings use `last-layer.preferences.v1` and `last-layer-theme`. Existing version-1 learning browser storage remains untouched.

- Recover pending local restore journals before reading or migrating personal data. Validate the complete candidate before creating account data. Retain a recoverable guest copy until the server acknowledges migration.
- Build a resumable, idempotent migration to the account repository. Preserve existing IDs; persist missing-ID mappings/receipts so failures, reloads, and retries cannot remap uploaded history. Keep repeated identical attempts distinct. The existing `identifyAttempts` helper does not provide cross-device legacy import receipts.
- Missing-ID backups imported on different devices may overlap. Do not deduplicate by timestamp/case/result alone. Preview ambiguity and require merge/replace choice; maintain completed import receipts and account generation checks so a replay cannot duplicate history accidentally.
- Keep the existing full-envelope version and old learning-only imports readable. Introduce a new version only when actual exported semantics require it, with tested migrations. Include all owned learning data, solves, notes/penalties and cubes; decide whether learning method joins account exports (it currently lives in device preferences). Exclude credentials, tokens, invitation secrets, friend data and internal queues.
- Preserve guest local replacement. For signed-in users, explicitly preview full-account versus learning-only replacement, allow account-wide replacement only online, and commit it atomically server-side. Bump account data generation so old queued writes cannot restore discarded data. Other devices refresh; do not silently re-upload obsolete caches.
- Keep file-size/record-count bounds, real-date checks, same-owner/reference integrity, and cancellation/failure preservation. Existing limits include a 100 MB file picker bound, 100,000 attempts/solves, and 5,000-character notes; define stricter network/request/text bounds as appropriate on the server. Local validation alone is not a server boundary.
- Keep full export/restore tested. Sync is not a backup when edits, deletions and replacements propagate.

## Backend permissions and validation

Enable row-level security on every exposed table. Signed-out users receive no private account data. Owners write only their own valid records; accepted friends receive only explicitly shared read access. Friends never modify another account's attempts, selections, solves, cubes, marks, profile or sharing controls.

Use constraints and server validation for IDs, enums, valid timestamps/local dates, elapsed values, text/request sizes, catalog references and owner-scoped cube references. Render names/notes as text in Svelte and validate server responses before local incorporation.

Test direct API access against actual policies with owner, unrelated user and signed-out identities; add friend/revocation tests in milestone two. Cover forged owner IDs, cross-owner references and unauthorized generation/cursor changes. Review functions/views for policy bypass; privileged functions verify the authenticated user and use a fixed safe search path. Invitation consumption/relationship creation must be atomic with bounded token lookup.

Only the project URL and browser-safe publishable key belong in the frontend. Service/admin keys and OAuth secrets must never appear in `VITE_*` or built assets. A public key does not replace authorization.

## Repository additions and integration points

Suggested boundaries; filenames may change:

- `src/backend.js`: lazy managed-service client, public configuration, request adapter and session lifecycle.
- `src/local-store.js`: guest/account persistence, journal recovery and resumable legacy migration.
- `src/sync.js`: DOM-independent outbox, retries, revisions/conflicts, cursors and account-generation checks.
- `src/components/Account.svelte`, later `src/components/Friends.svelte`: declarative Svelte 5 account/sharing UI using shared shadcn-svelte primitives and theme tokens.
- `src/main.js`: orchestrate login, account/source transitions, local mutations, sync events and focus through repository operations. Keep derived rules outside DOM handling.
- `src/progress.js`, `src/solve-history.js`, `src/cubes.js`, `src/training-backup.js`, `src/training-storage.js`: preserve validators, identities, current field meanings, import scopes and test-data isolation while adding migrations/persistence adapters.
- `src/components/AppView.svelte`, `SettingsDialog.svelte`, `BackupDialog.svelte`, `Progress.svelte`, `Timer.svelte`, and `SolveDialog.svelte`: status, account context, import/recovery and later read-only friend views; reuse diagram and summary modules.
- `supabase/migrations/` and local backend configuration: schema, constraints, policies, transactional functions and disposable fixtures; privileged account-deletion function if needed.
- `.env.example`: public placeholders. Ignore local secrets/configuration. Missing backend settings must leave guest mode usable.
- `tests/`, `README.md`, `docs/testing.md`, `.github/workflows/check.yml`: sync/migration/policy/browser tests; isolated backend lifecycle, auth redirects, recovery, exports and deployment setup. Update the local-only description when behavior actually changes.

Measure any auth dependency against the current 160 KiB gzip JavaScript / 14 KiB gzip CSS budgets in `scripts/check-build.mjs` and `docs/testing.md`. They are explicit transfer-size guardrails, not browser-performance measurements. Lazy loading defers account code but does not exempt it from the total-asset budget. A measured, documented budget revision is an owner decision; preserve catalog/oracle coverage and evaluate dependency size before changing it.

## Deployment and maintenance

The owner confirmed this is a fresh Supabase setup, with no existing Last Layer project to reuse. Create a new project for the Google-only launch after confirming account/organization ownership and region. Keep the project on Free initially. Confirm the current static host/public URL before configuring auth callbacks for development and the production origin/subdirectory; the app uses relative assets and hash routes, with no account callback flow yet. Keep existing static hosting if suitable.

Supabase Free was checked October 19, 2026: $0/month, 500 MB database storage, 50,000 monthly active users, 5 GB egress and two active projects. Social OAuth is included; projects pause after one week of inactivity and automatic backups are not included. These are current plan terms, not a permanent cost guarantee. Recheck during setup and avoid paid additions. [Supabase pricing](https://supabase.com/pricing)

Mail delivery is deferred with email/password and does not block Google-only launch. Email/password uses mail for signup confirmation and password resets. Plan custom SMTP for public use: the hosted default service currently sends only to organization-team addresses and is limited to two messages per hour. Choose the sending service, verify its sender/domain requirements, configure credentials and sender details in Supabase, and test confirmation/reset callbacks before enabling the later email/password rollout. [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp)

Verify provider redirects, billing controls and policies during setup using [cost controls](https://supabase.com/docs/guides/platform/cost-control), the selected provider's auth guide, and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Retain portable exports and guest fallback. Add a short operator runbook for usage inspection, paused/unavailable projects, compatible migrations, failed imports, backup restore, secret rotation and disabling cloud features without destroying local data. Use disposable local backend tests instead of live production data.

## Implementation milestones and acceptance checks

### 1. Safe personal accounts and sync

- Settle launch project/hosting and data-handling decisions below, verify provider/plan constraints, and configure Google with repository migrations, RLS and local setup instructions. Email/password and SMTP remain deferred as specified above.
- Build account-isolated storage, resumable migration/receipts, durable retry-safe operations, validated sync and recovery. Preserve full/learning-only backups, local dates and legacy identity semantics.
- Sync learning state, reviewed/course/resume state, completed solves/edits and cubes/defaults across two independent contexts. Test full history beyond UI/API page limits.
- Prove offline changes survive reload and upload once; save failure/retry preserves IDs; concurrent mutable choices surface conflicts; deletion/day deletion propagates; expired sessions retain pending data.
- Prove replacements reject old-generation operations, account switches reject stale responses, guest import is explicit, and test data never reaches account storage or uploads.
- Test owner/other-user/signed-out policies directly, forged owners/references, account deletion, and lossless full export/restore.

### 2. Friend sharing

- Add invitations, mutual acceptance/removal, read-only learning progress, and separately opted-in solve sharing with explicit note/cube visibility.
- Test real policies for owner, accepted friend, unrelated third user and signed-out access; reject expired/reused/self/duplicate invites and acceptance races.
- Prove friends cannot write each other's data, hidden solve data stays unreadable, removal blocks future reads, and owner/friend views agree despite different viewer preferences.

### 3. Release checks and recovery

- Cover empty states, storage failure, backend outage/pause, malformed responses, pagination, multiple tabs, stale clients and interrupted migration/import.
- Exercise callbacks/session restoration, 320px portrait and 667×375 landscape, keyboard focus, dialogs, light/dark/system themes and status announcements. Sync must not reveal answers, change the current practice snapshot, interrupt timing or reset playback.
- Keep deterministic time/randomness, isolated Playwright ports/contexts and disposable backend identities. CI must not rely on live OAuth or production data; manually smoke-test the actual callback before release.
- Run fast diagnostics/domain tests and bundle checks, then approved browser verification and the new database-policy/integration suite. `npm run verify` includes browser tests and requires the repository's browser-verification approval during interactive work. Preserve cubing.js oracles, one-history-scan coverage and meaningful failure assertions. Benchmark before/after performance-sensitive changes.
- Complete a two-person deployment and full export/restore exercise. Confirm current billing/plan settings and document outage/pause recovery.

## Decisions to settle before implementation

1. Login rollout is settled: Google only at launch; email/password later, with an Add password flow for existing accounts. The mail provider/sending domain and recovery configuration can be decided for that later rollout. Confirm the intended launch audience.
2. Project and hosting: a new Supabase project is needed. Confirm the owning account/organization, region, Google OAuth configuration ownership, and production/development redirect URLs. Confirm the zero-cost requirement against current plan terms.
3. Guest migration: explicit import into a new account; when cloud history exists, choose merge/replace behavior and how ambiguous missing-ID legacy records are handled.
4. Synced preferences: recommend learning method plus course/resume/review state; keep visual/device settings local. Decide whether resume should follow the account across devices or remain device-local.
5. Conflicts and restores: confirm keep-local/use-synced prompts and explicit online full-account/learning-only replacement with stale-queue invalidation.
6. Friend sharing (second milestone): mutual learning sharing on acceptance, timer sharing separately opt-in, and explicit inclusion/exclusion of notes and cube descriptions.

Full offline installation, real-time updates, shared plans and public social features can wait.
