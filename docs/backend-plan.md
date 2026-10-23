# Accounts, settings, and sync: current state and next steps

Updated October 23, 2026 for `nic/big-11-account-workspace`. This is the current plan for the
larger PR. It supersedes the October 19 proposal, which described Google-only
login, normalized record storage and friend invitations before implementation.
Those proposals are not descriptions of the current branch.

The owner wants this PR to improve how accounts fit into the app: a dedicated
Account page with progress information, better Settings, sync throughout the app,
and clearer terminology. The current implementation is the foundation for that
product restructure. The Account/Settings UI described below is implemented for
owner review. The full sync lifecycle/status audit and release verification remain
under validation in BIG-15–17; browser and hosted release checks remain outstanding.

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
  writes. Three-way merging uses an acknowledged local baseline to combine independent
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
and view state. The header Account icon now opens My profile directly.
Progress is a standalone training destination; the shareable username profile remains a separate permission
context. `AccountIdentity`, `AccountProfile` and `AccountData` separate the existing
controls; `DashboardActivity` and `account-workspace.js` share the Progress
presentation and summaries without another attempt-history scan.

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

The draft PR has a Vercel frontend preview. Read-only CLI inspection on October 23
found no Preview environment variables for `nicbats-projects/rubiks-site`; Supabase
configuration exists only for Production. The preview therefore does not establish
a working isolated hosted account environment. A separate hosted staging/preview
backend is not provisioned by the local tooling. End-to-end passwordless sign-in and
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
successful full CI run. The prior pushed checkpoint's real-backend browser job
passed sign-in/profile/deletion but failed two-device setup on an ambiguous
Check sync selector. That selector is now scoped to its dialog; execution of the
revised browser specs still requires approval.

## Navigation contract for beta — revised after owner review

The owner reviewed the first UI and requested less navigation and less prominent
sync management. The initial BIG-12 Overview/Progress/Profile/Sync and data layout
is superseded by this October 23 revision, implemented for review in the same draft
PR. The owner explicitly chose **go directly to My profile**, rather than an account
menu. This is a new UI iteration, not acceptance or browser verification.

- Keep **My learning, Courses, Progress, Timer, People** in the main navigation.
  Progress is a normal training destination at `#/progress`, usable by guests.
- Put an Account icon beside Settings in the header. It opens the saved, read-only
  **My profile** page at `#/account/profile`, with Edit profile and Account settings
  links. There is no Overview screen or Account section navigation.
- **Edit profile**, at `#/account/profile/edit`, owns name/bio/goal, privacy and
  independent public-stat sharing. Preserve drafts until saved/discarded. Visitor
  preview is a collapsed disclosure using saved, explicitly allowed public fields;
  private profiles preview unavailable. Unsaved edits are identified outside the
  disclosure. The shareable `#/u/<username>` remains a distinct permission context.
- **Account settings**, at `#/account`, owns identity/setup, sign-out and confirmed
  deletion. Deletion lives inside an Account deletion disclosure. Unfinished
  accounts can request email links/codes and claim a username here or via My profile.
  Guest training is never gated by setup.
- **Settings → Data & backups** contains full training backup/import, account
  export and explicit guest transfer. Keep transfer confirmation/failure recovery
  and opener focus. Device appearance/learning/timer preferences and equipment
  links stay grouped as before. Keep demo tools clearly separate from real data.
- Replace the combined backup/status header button and large Sync now button with
  a small **Check sync** refresh icon. It checks without reloading the page or
  clearing training/editing state. Keep the header usable at 320px by allowing its
  action row to wrap. The icon retains keyboard focus while working and respects
  reduced motion.
- Manual checks toast the actual result. Demo never claims a server save. Pending
  uploads, deferred incoming updates, conflicts, expired sign-in, rejected payloads
  and device-storage failures have distinct state. A local failure overrides a
  previous cloud acknowledgement. Mixed incoming/outgoing work stays identified
  as changes waiting to sync, not merely an incoming update.
- Pending/error states retain a badge and Review sync link. Recovery opens a small
  Sync status dialog over the current page, with retry, conflict choices, backup
  access or email reauthentication. Toasts are not the only route to recovery.
  Sign-in renewal preserves the active account cache.
- Preserve old `#/account/progress` links as history-replaced aliases for
  `#/progress`, including Settings overlays. Old `#/account/sync` opens Account
  settings. Keep `?settings`, Back/Forward, all training routes, public profile
  addresses, source isolation, shared dashboard rules and one attempt-history scan.

Ordinary successful saves, initialization, reconnect and focus already schedule
the shared queue. A refresh icon is an optional check/retry, not a required save
step and not a way to upload without a connection. No polling, Realtime dependency,
backend schema, training identifiers or preference-sync semantics were added.
Full lifecycle audit and release verification remain BIG-15/BIG-17 work.

Phone/landscape browser regressions are updated for direct header navigation,
saved versus editable profiles, privacy/drafts, data placement, deletion disclosure,
manual confirmation and incoming-update deferral while a timer is running. Browser
execution and screenshot inspection remain deferred under AGENTS.md. Run them at
an approved step before claiming layout/focus behavior verified.

## Product direction for the larger PR

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

The BIG-15 audit confirms that progress, solves and equipment share post-save
queue scheduling; confirmed imports and day deletion schedule after transactional
storage replacement. Read failures and unsaved drafts stop uploads. Completed
local changes now upload while the activity guard protects incoming replacement.
Checkpointing the local input after acknowledgement preserves later local
deletions and unapplied remote additions, including after reload/conflict choices.

The guard covers running/stopped timers, timer arming, hidden practice/quiz,
solve review, import/backup, profile/equipment/bulk drafts and deletion confirmation.
Exit/cancel/next-scramble paths resume deferred work. Other-tab training changes
wait behind the same guard; sync-metadata events do not reload the UI. Cross-tab
draft saves against stale bytes fail safely and require export/reload recovery;
the app does not automatically merge live drafts from multiple tabs.

Repeat guest transfers with record IDs retain unrelated records and account edits.
Anonymous legacy attempt conflicts now stop the transfer rather than silently
discarding guest history. The existing guest initialization assigns IDs before a
retry. Full imports remain replacements, so repeating one does not append history.
Cloud snapshots are capped at 20 MB versus the 100 MB local import limit. SQL
checks the envelope/size; the client checks domain/catalog invariants. Oversized
or malformed writes preserve the prior server snapshot and local recovery data.

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

The header now separates sync checking from backup actions; Progress describes
the active training source. `sync-status.js` supplies one presentation to the
header, recovery dialog and manual toast. Final review should confirm concise
labels, focus and actionable recovery in each state.

## Owner review and delivery

The owner requested on October 23 that work be pushed in a dedicated branch and
worktree, and reviewed before Linear completion. Use `nic/big-11-account-workspace`
in `/tmp/last-layer-big-11`. BIG-12 was returned to In Review; the reviewed navigation decision supersedes its original layout; keep BIG-11 and its
sub-issues In Progress or In Review until the owner explicitly approves completion.
Pushing code, passing checks or preparing a preview does not grant that approval.

## Implementation sequence

1. **Checkpoint the foundation.** Commit the implemented accounts, sync, demo,
   local tooling/tests and this plan. Preserve a reviewable starting point before
   the larger screen changes. Keep subsequent commits focused within the same PR.
2. **Map the Account/Progress/Settings experience (BIG-12).** The navigation contract
   above selects routes, legacy mappings, grouped Settings, permission boundaries
   and owner/guest/setup/visitor/demo journeys. Source and populated fixtures have
   been inspected; rendered layout review remains part of implementation validation.
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

## Current review limits

After merging the course/chart work from `origin/main` (`b5f60dd`), 347 unit tests
and Svelte diagnostics pass. Production compilation succeeds, but combined assets
exceed the unchanged 192 KiB JS / 18 KiB CSS gates: 203,558 / 18,893 bytes gzip
against 196,608 / 18,432 allowed. No budgets were raised.

The owner explicitly deferred further UI tests for this merge. Earlier browser
results do not verify the merged screens. Hosted isolation/auth callbacks and a
two-person release exercise remain open. Keep the PR draft and all issues subject
to owner review, with no issue marked Done.

## Remaining release and design work

- [x] Define the Account/Progress relationship, route compatibility, navigation
      labels and grouped Settings presentation (BIG-12, October 23).
- [ ] Build the simplified Profile/edit/Account settings flow and reorganized Settings
      per the navigation contract (BIG-13/BIG-14): implemented, awaiting owner review
      and approved browser verification.
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
