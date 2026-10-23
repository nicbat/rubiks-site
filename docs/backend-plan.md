# Accounts, settings, and sync: current state and next steps

Updated October 22, 2026 for `feat/supabase-sync`. This is the current plan for the
larger PR. It supersedes the October 19 proposal, which described Google-only
login, normalized record storage and friend invitations before implementation.
Those proposals are not descriptions of the current branch.

The owner wants this PR to improve how accounts fit into the app: a dedicated
Account page with progress information, better Settings, sync throughout the app,
and clearer terminology. The current implementation is the foundation for that
product restructure. The new page organization described below is planned, not
implemented yet.

## What is implemented

- Optional Supabase email sign-in, sign-out and session restoration. The app
  supports email links and code entry when the email template supplies a code.
  Guest training remains available without configuration or sign-in.
- A required unique username creates a stable `#/u/<username>` profile address.
  Usernames are case-insensitive on entry and stored lowercase; changing a
  username is not supported yet. Profiles start private.
- Profile display name, bio, learning goal and public/private visibility. People
  provides exact username lookup. Private and missing profiles have the same
  unavailable view for other people.
- Optional public summary statistics: solve count, best single, recent averages
  of 5 and 12, and algorithms marked known. Individual solves, notes, email and
  full training history remain private. Making a profile public does not opt it
  into statistics sharing automatically.
- Separate guest and per-account local training stores, an in-memory demo store,
  explicit guest-to-account transfer, full account exports and confirmed account
  deletion. Auth identity owns cloud records; usernames and emails are not
  storage ownership keys.
- Automatic sync after saved training mutations, on account initialization and
  when the app reconnects or regains focus. One queue serializes uploads and
  coalesces saves. Sync is not restricted to the Settings screen.
- Full, versioned training snapshots with server revisions and compare-and-swap
  writes. Three-way merging uses the last shared snapshot to combine independent
  edits and propagate removals. Conflicting edits require a choice; an unknown
  baseline requires explicit whole-copy recovery.
- A shared account UI with a network-free fake account and selectable preview
  states. `npm run dev` starts with sample training and this fake account.
- Seeded real local Supabase, captured email codes, disposable SQL/Auth/Data API
  integration tests, and a separate real-backend browser suite configured in CI.

Cube mechanics, catalog data, setup generation, grading and derived confidence
remain local and independent of the backend. Device display/timer preferences
remain device-local. This is still a static Svelte/Vite frontend using Supabase
Auth and its Data API; there is no custom application server.

Current boundaries: `src/supabase.js` owns configuration, auth and HTTP adapters;
`profiles.js` owns profile validation/API operations; `training-storage.js` owns
storage routing; `training-merge.js`, `cloud-sync.js` and `sync-queue.js` own merge
and sync behavior. `main.js` currently coordinates account actions, source changes
and view state. Account controls currently live in the Settings dialog; the full
personal dashboard still lives on Progress, and the shareable profile is a
separate, smaller view.

## Hosted infrastructure and verification status

The hosted project is `https://qdiekemamzzqzaivutse.supabase.co`. The three
versioned migrations for training sync, profiles, and profile details/stats/account
deletion have been applied. The current production app origin remains
`https://cube.nicbat.com`; setting up email on `lastlayer.net` does not itself move
the website or configure preview callback URLs.

The owner reported on October 22 that the other chat completed the `lastlayer.net`
email infrastructure: the domain is verified, DNS is configured, Supabase is
connected, and confirmation/reset emails were delivered successfully. Treat email
infrastructure as ready. This report is the evidence for this status; this worktree
has not independently repeated those hosted delivery checks. The application
currently implements passwordless sign-in, not password-based login or a reset
password screen. Delivery of reset email does not add those app flows.

Frontend changes are not yet deployed. A separate hosted staging/preview backend
is not provisioned by the local tooling. End-to-end passwordless sign-in and
redirects on the intended deployed origins remain release checks. Keep hosted
credentials out of the repository and keep local auth configuration local.

Latest completed checks on the foundation:

- 305 unit tests; Svelte diagnostics with zero errors/warnings; formatting and
  build checks. Assets measured 189.2 KiB JavaScript / 17.6 KiB CSS gzip, within the
  owner-approved 192/18 KiB budgets.
- All three SQL regression scripts and six real-backend integration scenarios
  (seven Node tests including their parent). These cover delivered local OTPs,
  required/unique usernames, session refresh/restoration, actual permission
  enforcement, two-device sync, offline recovery, conflicts, public stats and
  account deletion.
- Development server compilation/configuration checks and a real local reset /
  seeded sign-in exercise.

Current browser regressions are written but execution remains deferred at the
owner's request. CI is configured to run the ordinary mocked UI suite and the
separate real-backend/browser suite; that configuration is not evidence of a
successful CI run on this unpushed branch.

## Product direction for the larger PR

### Account as the private personal workspace

Create a dedicated Account destination instead of housing the whole account
experience in Settings. Proposed contents:

- An overview combining profile identity with personal training totals, activity
  and progress information already available on Progress.
- Detailed learning/solve progress using the existing dashboard rules, filters,
  charts and solve review. Reuse those components and summaries rather than
  implementing a second statistics model.
- Profile editing, privacy/sharing controls, a link to the shareable profile and
  an explicit way to preview what other people can see.
- Sign-in/setup, sync details and recovery, export/guest transfer, sign-out and a
  clearly separated deletion area.

The intended direction is to bring Progress into this personal workspace. Decide
whether detailed Progress is an Account section or a linked subpage while laying
out the new screens. Preserve existing progress links through a deliberate route
mapping. Guests must retain access to their own progress without needing an
account; the guest view explains optional sign-in without blocking training.

The owner view and another learner's profile must remain distinct permission
contexts even if they share presentation components. A public profile does not
expose the owner's full dashboard, raw history, notes or account controls.

### Settings organized around preferences

Replace the current crowded dialog with a settings experience organized into
clear groups: appearance, learning/display, timer, equipment, and data/development.
Move identity, profile privacy and account management to Account, with clear
cross-links. Keep development/demo controls recognizable as preview tools.

Use existing shared components and semantic theme tokens. Preserve device-local
preference semantics unless a separate change explicitly adds preference sync.
Final navigation labels, section ordering, and full-page versus grouped-dialog
presentation are design decisions for the next implementation pass. Keep every
navigation destination reachable at 320px portrait and 667×375 landscape.

### Automatic sync across the app

“Sync no matter what” means route-independent sync for every saved signed-in
training mutation: learning selections/marks, completed practice, solves and
penalty/notes/cube edits, equipment changes, deletions and confirmed imports.
Navigating away from Account/Settings must not stop the queue. Manual Sync now is
an optional recovery/check action, not a required normal step.

Keep these distinctions explicit:

- Save to the active local store first; successful cloud acknowledgement is a
  separate state. Failed local saves must never be presented as safely synced.
- Offline/backend failures retain local work for retry. The browser cannot upload
  while disconnected or closed, and guest/demo data must never be uploaded.
- Upload completed changes during active use, but defer replacing incoming local
  state when that would interrupt a running solve, practice, import or edit.
  Resume reconciliation when it is safe. Automatic sync must not reveal hidden
  answers, reset an interaction or steal focus.
- Conflicts need a choice only for conflicting edits; preserve unrelated edits
  from both devices. Source/account changes cancel pending work and invalidate
  stale responses.

The current queue already handles many of these cases. The restructure needs an
explicit mutation/source/lifecycle audit and regressions for any gaps, rather
than making unconditional background requests or a polling loop on every render.

### Consistent language and status

Use one vocabulary throughout navigation, banners, Settings, backups and profiles:

- **Account:** sign-in identity and private personal workspace.
- **Profile:** the username page another person may view, controlled by privacy.
- **Progress:** personal training activity, learning history and solve statistics.
- **Settings:** app/device preferences.
- **Saved on this device:** the current changes are persisted locally.
- **Syncing:** a cloud request is in progress.
- **Synced:** cloud acknowledged the saved state; do not use this for a demo save.
- **Saved on this device · waiting to sync:** local work is safe and upload is
  pending/offline. Use a separate actionable message for expired sign-in, local
  storage failure, rejected data or conflicting edits.
- **Demo:** sample data and a fake account; edits remain in memory and reset on
  reload. A demo must not impersonate a real cloud connection.

Review the current header's combined backup/status button, Progress's
“saved on this device” subtitle and overlapping test-data/cloud labels. Route
save/sync status to useful details; keep backup/export as a clearly named action.
Status should describe actual state and the next action when one is needed.

## Implementation sequence

1. **Checkpoint the foundation.** Commit the implemented accounts, sync, demo,
   local tooling/tests and this plan. Preserve a reviewable starting point before
   the larger screen changes. Keep subsequent commits focused within the same PR.
2. **Map the Account/Progress/Settings experience.** Set route and navigation
   behavior for owner, guest, other learner, signup and demo states. Reuse Progress
   components and preserve deep links. Review layout and copy with actual data.
3. **Build the Account workspace and reorganize Settings.** Move account actions
   to their intended home, retain mobile/keyboard/theme contracts and cover all
   states in the demo. Keep private owner data separate from public profile data.
4. **Unify save/sync presentation and audit lifecycle behavior.** Introduce one
   consistent status model across screens, test mutation coverage and safe incoming
   reconciliation, and reduce duplicated real/demo orchestration where it helps
   those product changes. Keep DOM event handling in `main.js`; extract
   DOM-independent services as needed rather than rewriting the whole app.
5. **Validate and prepare release.** Run fast checks and real local integration
   checks, then the deferred browser suites when requested/approved. Verify
   narrow/landscape layouts, focus and hidden answers, then deployed passwordless
   sign-in/callbacks and two-device behavior against an isolated hosted backend.
   Review the final PR description against the resulting product scope.

## Remaining release and design work

- [ ] Finalize the Account/Progress relationship, navigation labels and Settings
      presentation. These are proposed product changes, not completed screens.
- [ ] Implement and validate route-independent status and sync behavior across
      the redesigned flows, including activity/editor exit and reconnect paths.
- [ ] Review network payload validation/limits against local backup limits and
      test actionable rejection/recovery. Current snapshots validate the outer
      envelope/size in SQL and the full training data in the client; do not claim
      every catalog/domain invariant is checked by the server.
- [ ] Review repeated/legacy backup imports, storage failure/retry, source changes,
      cross-tab behavior and stale offline edits against actual snapshot semantics.
      The implementation does not have an operation outbox, incremental cursors or
      a server-side account reset generation; do not promise those contracts.
- [ ] Execute the deferred mocked UI and real-backend browser suites, and inspect
      narrow portrait/short landscape screenshots for the redesigned screens.
- [ ] Configure/verify hosted preview isolation and the correct auth redirects;
      verify the app's actual passwordless sign-in flow with the ready mail setup.
- [ ] Run a two-person/two-device release exercise, export/restore and account
      deletion checks. Keep guest recovery and account export available.
- [x] Email infrastructure: `lastlayer.net` domain verification, DNS, Supabase
      connection, confirmation/reset delivery (owner-reported completion in the
      other chat on October 22).

Additional login providers, password login/reset UI, username changes, friendships
and invitations are separate future scope. Public/private profiles are already
supported; a social graph is not required for this Account/Settings restructure.
Incremental sync/IndexedDB and full offline installation need their own concrete
requirements and migrations if snapshot size or usage warrants them.

## Where to find operational details

- [README setup and development commands](../README.md#run-locally)
- [Local backend and integration workflow](testing.md#local-backend-and-integration-workflow)
- [Demo account previews](testing.md#manual-account-previews-with-test-data)
- `supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql`
- `.github/workflows/check.yml`

This document tracks product direction and outstanding work. README/testing docs
track commands and verified behavior. Update both as each part of the restructure
lands; do not mark planned behavior as implemented based on mock screens alone.
