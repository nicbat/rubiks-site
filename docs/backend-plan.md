# Accounts, sync, and friend progress

Planning document, reviewed October 10, 2026. No backend is implemented by this document.

## Goal and recommendation

Let Nicholas and Keven keep separate progress, use multiple devices, and view each other's progress without paying for hosting. Keep guest practice available. Prefer managed infrastructure that agents can implement and maintain without a frontend rewrite.

Keep the existing static Vite app and add Supabase Auth, PostgreSQL, and its generated API. Use database permissions for ordinary reads/writes and small database functions for operations that must be atomic, such as accepting an invitation or importing a backup. Add a privileged server function only where necessary, such as account deletion. Cube mechanics, diagrams, playback, scrambles, and grading remain local.

This is a proposed scope, not approval to provision services or deploy changes. Product defaults below should guide implementation unless changed by the owner.

## Review basis

Reviewed the current working tree, including uncommitted timer-history, notation, and cube-player work: `README.md`, `docs/testing.md`, `docs/ideas.md`, the application controllers and views, progress/preferences/theme storage, solve history, learning-method logic, and existing test coverage/configuration. This is a source review, not a browser usability test.

Important correction to the earlier conversation: completed timer solves now persist locally. They already have IDs and support deletion, and need to be included in the sync design. They are still excluded from learning-progress backups.

## Site-wide impact

| Existing area                 | Current behavior                                                                          | Addition or decision needed                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header/navigation/footer      | Local-save indicator, backup access, five main pages and Settings                         | Account entry point, Friends page, and separate local-save/sync status. Update device-only copy throughout.                                                                                                                |
| My learning                   | Learning set, focused case, today's attempts, hidden practice                             | Load the current account's set and history. Keep focus local. Background sync must not reset the current interaction.                                                                                                      |
| Library                       | Full/two-look methods, OLL/PLL, search, groups, learned filters, selected cases           | Sync membership and explicit variant choices. Recommend syncing learning method because it affects default variants. Search, section, filters, and collapsed groups stay local.                                            |
| Case detail                   | Variant choice, known marks, rehearsal, diagrams, 3D player                               | Sync choices and variant-specific known marks. Friend detail is read-only; any “add to my set” action must explicitly target the viewer's account.                                                                         |
| Hidden practice               | Setup, recognition, reveal/hint, rating, skipping                                         | Save each completed attempt with a stable ID. Snapshot the case and variant at session creation so a remote change cannot misattribute the result. Keep setup, hidden answer, hint state, pool, and session counter local. |
| Rehearsal                     | Repetitions count toward activity but not confidence                                      | Sync rehearsal attempts without changing confidence rules.                                                                                                                                                                 |
| Progress                      | Attempts, practice days, confidence, per-case status                                      | Reuse the same rules for owner and friend views. Distinguish “Already known” from earned confidence, and show whose progress and algorithm variant are displayed.                                                          |
| Timer                         | Completed solves, scramble/date, delete/Backspace, recent averages of 5/12 and best times | Sync completed records and deletion markers. Recompute statistics in a deterministic chronological order. Never sync running clock ticks or partial solves.                                                                |
| Scramble preview              | Interactive final-state cube                                                              | No backend data needed. Preserve timer behavior while sync runs.                                                                                                                                                           |
| Notation and algorithm player | Local demonstrations, stepping, rotation, reduced-motion behavior                         | No backend data needed. Sync updates must not restart playback or disrupt keyboard focus.                                                                                                                                  |
| Settings                      | Theme, PLL arrows, timer minutes; other preferences stored elsewhere                      | Add account, sharing, and sync controls. Keep visual settings and random-side preference device-local initially.                                                                                                           |
| Backup/import                 | Validated version-1 learning JSON; confirmed replacement                                  | Preserve old imports. Add a versioned full-data export covering solves and sync IDs. Define guest replacement separately from account-wide replacement.                                                                    |
| Failure handling              | Local-storage warnings and malformed-data handling                                        | Distinguish local write failure, offline, expired login, rejected records, unavailable backend, and conflicts. Never report synced before server acknowledgement.                                                          |

No shared plan editor, chat, notifications, public leaderboard, analytics, uploaded avatars, or catalog editor is needed for the first release. A shared plan remains a separate idea in `docs/ideas.md`.

## Accounts and friend experience

- Add optional sign-in, sign-out, session restoration, and a small profile with a display name. Suggest GitHub OAuth if both people have GitHub accounts; confirm provider choice before configuration.
- Keep guest storage separate from account storage. Signing in should offer to bring guest progress into the account; it must not upload someone else's history automatically on a shared browser.
- Preview local and remote record counts before first migration. Preserve a recoverable local copy until the transfer is acknowledged. An existing cloud account requires an explicit merge decision.
- Add a Friends page with invite creation, acceptance, current friends, and removal. Prefer an expiring, single-use invitation link over searchable emails or a public user directory.
- Proposed invitation behavior: accepting establishes mutual progress sharing, described clearly before acceptance. Either person can remove the relationship. Reject self-invites, duplicate relationships, expired/reused tokens, and unauthorized acceptance.
- Share learning set, selected variants, known/confident case status, practice totals, and a bounded recent-practice list with accepted friends. Keep account email and authentication details private.
- Offer a separate opt-in for sharing solve history/statistics. Personal solve sync can exist even while solve sharing is off. Enforce this distinction in database permissions, not just UI controls.
- Show last refresh time and refresh on opening a friend page. Live subscriptions are unnecessary initially. Empty, unavailable, removed-friend, and permission-denied states must be clear.
- Avoid persistent friend-history caching initially. Revocation stops future reads and clears visible data at the next permission check; it cannot retract information someone already saw or copied.
- Include an account deletion flow with export opportunity and explicit confirmation. It must remove owned data, invites, relationships, and authentication identity through trusted server-side code, and invalidate local sessions/queues.

## Data to store

Use migrations committed to the repository. The following is a logical model, not final SQL.

| Record           | Suggested fields and behavior                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile          | Auth user ID, display name, learning method, solve-sharing preference, revision. Restrict profile visibility to self and accepted friends.                                                          |
| Case selection   | Owner ID, case ID, selected boolean, revision. Explicit false values preserve removals across offline devices. Preserve learning-set ordering, or document and test an intentional ordering change. |
| Variant choice   | Owner ID, case ID, nullable explicit variant index, revision. Null means use the owner's learning-method recommendation.                                                                            |
| Known mark       | Owner ID, case ID, variant index, known boolean, revision. False must sync as an actual change.                                                                                                     |
| Practice attempt | Owner ID, client-generated ID, case ID, variant, result, mode, original local day, original timestamp, server change sequence. Ordinary attempts are immutable.                                     |
| Solve            | Owner ID, existing/client-generated ID, elapsed milliseconds, original date, scramble, deletion state, server change sequence.                                                                      |
| Friendship       | Canonical pair of user IDs, accepted relationship metadata. Only participants can inspect/remove it; acceptance requires a valid invitation.                                                        |
| Invitation       | Issuer, hashed random token, expiry, consumed/revoked state. Token lookup and acceptance use a narrowly scoped server operation.                                                                    |
| Sync metadata    | Account data generation, changes/cursors, operation IDs and migration/import receipts for retries and resets. Keep this private to its owner.                                                       |

Scope record uniqueness by owner. Add indexes for owner/change sequence, owner/time, and friendship checks. Do not store derived confidence as an independently editable truth: derive it from ordered attempts and known marks, reusing `src/progress-index.js` semantics. The friend's effective variant must come from their choices and method, not the viewer's method.

Keep algorithm JSON in the repository. Validate case IDs and variant indices against a versioned catalog manifest on the backend as well as the client. Do not regenerate the upstream catalog. An old client encountering a newer catalog/schema should receive an update-required error without dropping data.

## Reliable sync requirements

1. **Durable local writes.** Introduce an account-scoped local repository, preferably IndexedDB, so a data change and its pending upload can be committed together. Keep tiny device preferences in localStorage. Storage denial/quota failure must retain the in-memory result and expose recovery/export.
2. **Retry-safe uploads.** Assign an ID before recording an attempt and retain existing solve IDs. Persist pending operations across reloads. Server retries must acknowledge the same operation without creating another attempt or solve.
3. **Incremental downloads.** Use paginated reads and a server-controlled change cursor with a stable tie-breaker. Advance it only after the fetched batch is committed locally. Do not assume an API's default page contains the whole history or download every friend's full history on every render.
4. **Explicit conflicts.** Independent attempts merge by ID. Mutable choices use expected revisions; a stale write gets a conflict rather than silently overriding another device. Preserve the pending local choice and offer “keep this device's choice” or “use synced choice.” Avoid client-clock last-write-wins.
5. **Deletion propagation.** Keep solve deletion markers so an offline device cannot resurrect a deleted solve. Set a retention/compaction policy only alongside a required full resync for devices older than the retained change history.
6. **Account isolation.** Separate guest and per-user caches/outboxes. Cancel requests and reject stale responses after sign-out/account switch, across tabs too. Never replay one user's queue under another user's session. Warn about unsynced data before clearing an account's local cache; provide export or explicit discard.
7. **Bounded work.** Sync after local changes, login, reconnect, and suitable page visibility events, with batching and backoff. Stop automatic retries for permanent validation/auth failures. Avoid a network call per animation frame or full-page rerenders during timing/playback.
8. **Stable chronology.** Preserve original `at` and local `day`; server receipt time is sync metadata, not practice time. Define a deterministic order for equal timestamps and test confidence resets against it. Sort merged solves by original date plus stable ID before calculating recent windows.

An already-loaded app should remain usable when the backend is offline or paused. Loading/reloading the site with no network is a separate capability: there is no service worker today. Defer full offline installation unless specifically desired, or add asset caching with its own update and recovery tests.

## Migration and backup behavior

Current storage is split across `last-layer.progress.v1`, `last-layer.solves.v1`, `last-layer.preferences.v1`, and `last-layer-theme`. Learning attempts have no IDs; solve records do. The learning validator strips unknown fields, so simply adding IDs to the current object will not preserve them through validation or legacy export/import.

- Introduce a versioned migration and validator that preserve new IDs and metadata while still reading version-1 backups. Never destructively rewrite the only legacy copy before validating the new representation.
- Make initial local migration resumable and idempotent using a migration receipt and stable per-record mapping. Assign IDs once, including distinct IDs for repeated identical attempts.
- Old backups imported on different devices may contain overlapping history without IDs. Do not deduplicate only by timestamp/case/result: legitimate repetitions can match. Preview ambiguity and require a merge/replace decision; maintain import receipts so the same completed import cannot replay accidentally.
- Preserve guest backup replacement. For signed-in users, offer an explicit account-wide replacement only while online, with a validated preview and atomic server transaction. Use an account data generation to reject stale queued writes from before replacement. Other devices must refresh rather than restore the discarded history.
- Version the full-data export to include learning history, selections, known marks, variant choices, solves, and learning method. Exclude credentials, auth tokens, invite secrets, and friend data. Clearly label any legacy learning-only export.
- Bound file size and record counts, validate every field before mutation, and preserve existing data on cancellation or failure. Strengthen solve date/size validation for network input; the current local solve validator is not a complete server validation boundary.
- Keep a tested restore path. Sync alone is not a backup, especially when deletions and replacements propagate.

## Backend permissions and validation

Enable row-level security on every exposed table. Signed-out users receive no private account data. Owners can write only their own valid records; accepted friends receive only the explicitly shared read access. A friend must never modify another person's attempts, selections, solves, profile, or sharing preferences.

Use database constraints and server validation for IDs, enums, timestamps/local dates, elapsed values, text sizes, catalog references, and request limits. Escape display names in existing HTML rendering. Validate responses before incorporating them into local state.

Test direct API access with real database policies, including forged owner IDs and removed friendships. Review functions/views for policy bypasses; privileged functions must explicitly verify the authenticated user and use a fixed safe search path. Invitation consumption and relationship creation must be one transaction with bounded, abuse-resistant token lookup.

Only the project URL and browser-safe publishable key belong in the frontend. Supabase service/admin keys and OAuth provider secrets must never appear in `VITE_*` variables or generated assets. The publishable key does not replace database authorization.

## Repository additions and integration points

Suggested boundaries; filenames can change during implementation:

- `src/backend.js`: managed service client, configuration, request adapter, and session lifecycle.
- `src/local-store.js`: guest/account local persistence and legacy migration.
- `src/sync.js`: DOM-independent outbox, retries, conflict handling, cursors, account-generation checks.
- `src/account-view.js` and `src/friends-view.js`: declarative account/sharing markup using existing styling and escaping.
- `src/main.js`: orchestrate login, account transitions, local mutations, sync events, and focus. Replace direct save calls with repository operations while keeping DOM event handling here.
- `src/progress.js` and `src/solve-history.js`: versioned validation, stable identities, migration support, and deterministic ordering. Preserve existing rules and independent cube tests.
- `src/views.js` and `src/timer-view.js`: account-aware status/copy, read-only friend context, and recovery states. Reuse existing diagram and progress modules.
- `supabase/migrations/` and local backend configuration: schema, constraints, policies, transactional functions, and disposable test fixtures. Add a privileged function for account deletion if required.
- `.env.example`: public frontend settings with placeholders; keep secrets and local environment files ignored. Missing configuration must leave guest mode functional.
- `tests/`: deterministic sync/migration tests, actual local database policy tests, and browser account/friend flows. Add isolated backend setup commands and CI service lifecycle.
- `README.md`, `docs/testing.md`, and `.github/workflows/check.yml`: setup, migrations, auth redirects, test commands, recovery, exports, and deployment. Update the local-only architecture description when functionality actually changes.

Measure any auth-client dependency against current build budgets (40 KiB gzip JS, 10 KiB gzip CSS). Lazy loading can defer account code but does not bypass the current total-asset budget. Optimize or explicitly justify a measured budget change; do not raise it just to pass.

## Free deployment and maintenance

Use the existing static hosting arrangement if suitable; confirm its actual provider and public URL before configuring auth. No custom domain or paid hosting migration is required by this design. Configure OAuth redirects for development and the deployed origin/subdirectory; the app currently uses relative Vite asset paths and no dedicated account callback route.

As checked October 10, 2026, Supabase Free includes 500 MB database storage, 50,000 monthly active users, and 5 GB egress. Projects may pause after a week of inactivity; automatic backups are not included. These limits should comfortably fit two people's practice records, but usage still needs checking. [Supabase pricing](https://supabase.com/pricing)

Supabase states that users are not charged while on Free. Stay on Free and avoid paid add-ons or upgrades; the paid-plan spend cap is not a promise of a zero-dollar bill. A free offering can change, so retain portable exports and a guest-only fallback. [Cost controls](https://supabase.com/docs/guides/platform/cost-control)

Add a short operator runbook: resume a paused project, inspect usage, apply/roll back compatible migrations, recover from a failed import, restore a backup, rotate a compromised secret, and disable cloud features without destroying local data. Use local backend tests rather than consuming another hosted project for every test run.

Provider references: [GitHub sign-in setup](https://supabase.com/docs/guides/auth/social-login/auth-github), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security). Recheck provider requirements during implementation.

## Implementation milestones and acceptance checks

### 1. Safe personal accounts and sync

- Configure the free project and selected login provider; commit schema/policies and local setup instructions.
- Build account-isolated storage, resumable migration, validated sync, backup updates, and sign-out/deletion recovery.
- Sync learning data and completed solves across two independent browser contexts.
- Prove offline attempts survive reload and upload once; retries do not duplicate records; concurrent choices surface conflicts; solve deletions propagate; expired sessions do not lose pending data.
- Prove replacement imports reject old queued data and sign-out/account switching never exposes or uploads the previous account's data.

### 2. Friend sharing

- Add invitations, mutual acceptance/removal, read-only friend progress, and optional solve sharing.
- Test owner, accepted friend, unrelated third user, and signed-out access directly against the database.
- Prove invite expiry/reuse/races are handled, friends cannot write each other's data, hidden solve records remain unreadable, and removal blocks future reads.
- Verify the same confidence/known status on owner and friend pages even when their methods and chosen algorithms differ.

### 3. Release checks and recovery

- Cover empty states, local storage failure, backend pause/outage, malformed responses, pagination, multiple tabs, stale clients, and interrupted migration/import.
- Exercise login callback/session restoration, mobile layouts, keyboard focus, dialogs, light/dark/system themes, and status announcements. Background sync must not reveal practice answers, change a session's variant, interrupt a solve, or reset cube playback.
- Keep deterministic time/randomness and isolated Playwright contexts/port 4174. Use a disposable local backend and test identities; do not depend on live OAuth or production data in CI. Manually smoke-test the real provider callback before release.
- Run `npm run verify` plus the new database-policy/integration suite. Run `npm run test:build` for dependency/bundle changes. Preserve cubing.js oracle coverage, one history scan per render, and current failure-path tests. Benchmark before/after if altering performance-sensitive rendering.
- Perform a two-person deployment smoke test and a full export/restore exercise. Confirm the project remains on Free and document the pause/resume process.

## Decisions to settle before implementation

1. Login provider: GitHub if both people already have accounts, otherwise choose another supported provider.
2. Sharing scope: recommended mutual learning-progress sharing upon invite acceptance, with timer sharing separately opt-in.
3. Confirm syncing learning method while leaving visual preferences device-local.
4. Confirm account-wide backup replacement behavior and conflict prompts described above.
5. Identify the current static host/deployment URL and who will own the Supabase project and provider configuration.

Everything else above can be implemented incrementally by agents against the acceptance checks. Full offline installation, real-time updates, shared plans, and public social features can wait.
