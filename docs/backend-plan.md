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
outstanding.

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
and view state. Account controls now live in the private Account workspace.
Detailed Progress is an Account subpage; the shareable username profile remains a separate permission
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

## Navigation contract for beta (BIG-12)

These are the chosen implementation requirements for BIG-13 and BIG-14, based on
the foundation at `0ee8c1a`. The routes and screen moves below are implemented
on `nic/big-11-account-workspace` for review (BIG-13/BIG-14). Browser verification
and screenshot inspection remain deferred; implementation is not acceptance.

### Destinations and existing links

Main navigation becomes **My learning, Courses, Account, Timer, People**, in that
order. Account replaces the primary Progress button and is available to guests.
Keep Settings in the header and Algorithm library / Guides in the footer. The
command palette exposes Account, Progress, Profile settings, Sync and data,
People, Settings, Cubes, and Backup & transfer alongside the existing training
destinations. The Progress command opens the detailed dashboard directly.

Account has four linked subpages, with an always-visible wrapping section nav:

- `#/account` — **Overview**. Identity/setup state followed by personal activity,
  learning and solve summaries, with links to detailed Progress and Profile.
- `#/account/progress` — **Progress**. The existing full dashboard, including
  Learning / Solves views, period/cube filters, day selection, case details, solve
  review and confirmed day deletion. These are views within Progress, not new
  separately persisted routes.
- `#/account/profile` — **Profile**. Profile fields, privacy, independent public
  statistics opt-in, copy/open profile link and a visitor preview.
- `#/account/sync` — **Sync and data**. Local/cloud state, retry/conflict recovery,
  explicit guest transfer, backup actions, sign-out and a separated account
  deletion area. Sync now remains a recovery action; navigation never starts or
  stops the automatic queue.

Read `#/progress` as an alias for `#/account/progress`, including
`#/progress?settings`. Canonicalize with history replacement so Back does not
bounce through an extra redirect entry. Update internal Progress buttons and
commands to the canonical path. Keep `#/u/<username>`, `#/people`, `#/cubes`, all
course/training routes and their existing meanings. Invalid Account subsections
return to Account Overview; they must never be interpreted as a username or an
account ID. Account URLs always refer to the active local training source.

Keep the `?settings` overlay on every route, including Account and username
profiles. Legacy `#/settings` continues to open Settings over My learning.
Opening/closing Settings preserves the underlying route, training state and
Back/Forward behavior. Moving from Settings to Account closes the overlay and
performs an ordinary page navigation. It follows the existing rule for leaving
practice or an unfinished timer; it must not record an incomplete solve or reveal
a hidden answer. Returning to an Account section through Back/Forward restores
the destination without opening account forms in Settings again.

### Private workspace and progress content

Overview starts with the account identity (or guest/setup state), then a shared
Activity period control, the existing attempt/solve/active-day/confident-case
totals and activity heatmap. Below that, compact learning and solve summaries
link to the corresponding detailed Progress view. The solve summary uses the
existing best-single and average rules. An empty history offers Courses and Timer
links while keeping every Account section reachable.

Extract reusable dashboard presentation from `Progress.svelte` as needed, using
the existing `dashboard.js`, `progress-index.js`, chart and solve-row components.
Render one Account subpage at a time; do not mount a second hidden dashboard or
scan the attempt history once per summary. Overview and Progress share the
existing controller-owned dashboard filters. Preserve those filters and day
selection across Account sections and Settings within the same training source;
reload keeps the existing default filters. Changing guest/account/demo source
clears selections and review/draft state that belong to the previous source.
Statistics and exports always use the full history, regardless of display limits.

The content baseline is the existing deterministic sample at
`2026-10-17T19:00:00Z`: 9,811 solves, 4,360 attempts, four cube records including a
retired cube, and 955 solves with notes. This source/fixture inspection motivates
separating overview, detailed charts and forms. Use that populated dataset, maximum
profile field lengths and long cube names for the later layout checks; this is
not evidence that a rendered layout fits.

### Journeys and permission boundaries

- **Signed-in owner:** Account opens Overview for the active auth identity and its
  isolated training cache. Profile editing lives on Profile; sync/transfer/export
  and session/deletion controls live on Sync and data. Settings links back to
  Account. Visiting the owner's `#/u/<username>` remains a profile view with a
  clearly labeled owner context and a Manage profile link to Account Profile.
- **Guest:** Account Overview and Progress show guest training without a sign-in
  gate. Overview includes optional email sign-in; Profile and Sync and data link
  back to that one sign-in form instead of duplicating it. Guest backup/import is
  available from Progress, Sync and data, Settings and the backup command. A build
  without Supabase configuration explains that sync is unavailable and keeps all
  local training, progress and backup actions usable.
- **Email verification / first username:** use the existing link/code flow and
  token cleanup. Explicit sign-in from Account returns to Overview. Its identity
  area shows loading, retryable load error or the required username form before
  sync can start. Restoring an unfinished account elsewhere shows an Account setup
  link; it must not force a route change over active training or an editor. New
  setup keeps the permanent-username explanation and private default. Claiming a
  username enables the existing account queue, with guest transfer still explicit.
  Signing in selects the account store; it never silently adopts guest history.
- **Another learner:** People remains exact username lookup, with results at
  `#/u/<username>`. Public visitors see username, display name, bio and learning
  goal, plus the existing summary statistics only when public-stat sharing is on.
  Private and missing profiles use the same unavailable state. No visitor profile
  renders email, raw attempts/solves, notes, equipment inventory, full Progress,
  backup/session controls or Account forms. Direct URLs and API permissions must
  enforce the same boundary; a hidden button is not access control.
- **Visitor preview:** Account Profile offers an inline View as a visitor preview
  of the **saved** profile. A private profile previews the unavailable state; a
  public profile with stats off shows no statistics. Use an explicit allowlisted
  visitor projection, not the privileged owner response or the full app model.
  Pending form edits are identified as unsaved and are excluded from the preview
  and share link. The normal owner profile can still show owner-only aggregates,
  clearly labeled, but it is never labeled as the visitor preview.
- **Demo:** the same routes and Account sections use the existing in-memory fake
  account/training source, with a persistent Demo label. Preview tools select
  signed-out, username setup, loading, load error, signed-in, offline and conflict
  scenarios; Profile exercises private/public and stats off/on, and Sync and data
  exercises transfer and typed deletion/cancellation. No real mail, credentials or
  personal storage enters these flows. Exiting Demo restores the real source and
  clears demo dialogs/drafts. Demo changes are never described as cloud-synced.

A sign-out or confirmed deletion returns to guest Account Overview. Retain the
foundation's confirmation, cancellation, failure recovery and per-account cache
rules. Keep the account export reachable before deletion. Cancellation returns
focus to the initiating control, failure keeps the confirmation/draft available,
and only confirmed server deletion clears the deleted account's device cache.

### Grouped Settings overlay

Keep Settings as one grouped, scrollable dialog rather than introducing a new
full-page Settings route. Preferences are short, save immediately and need to be
reachable over hidden practice and the timer. Moving the long account/profile
forms into Account makes this presentation viable without changing preference
storage or adding another settings navigation system.

Use this order, with headings visible without requiring disclosure navigation:

1. **Account cross-link:** a concise identity/guest/Demo summary and Open Account.
   Setup and sync problems link directly to Overview or Sync and data. No sign-in,
   username, profile, transfer, sign-out or deletion forms remain here.
2. **Appearance:** light / dark / system theme using the existing theme control.
3. **Learning and display:** display top color, random display color and PLL
   arrows. Keep practice's existing random last-layer control and semantics.
4. **Timer:** Show minutes and Hide timer while solving.
5. **Equipment:** the existing Cubes destination and default-cube explanation.
   Cubes remains at `#/cubes`, with Back to Settings restoring this dialog.
6. **Data and backups:** Backup & transfer opens the existing validated import /
   export flow for the active source. State that cloud sync is not backup history;
   account-specific export/guest transfer link to Sync and data.
7. **Preview tools:** clearly labeled sample-data/fake-account toggle, demo state
   selector and Reset demo account, retaining the existing busy/timer guards.

Use one Settings dialog instance and one set of preference controls. Opening
Backup & transfer from Settings closes Settings before opening the backup dialog;
closing/cancelling returns to Settings and restores the opener. Account links
change page normally. Keep device preferences device-local in every source.

### Keyboard, mobile and implementation checks

Use source-owned Button/Input/Label/Card/Dialog and other applicable primitives
with shared theme tokens. Main nav and Account section links wrap at 320px;
they must not disappear into clipped rows or require horizontal page scrolling.
Mark the active main destination and section accessibly; use ordinary links for
subpage navigation rather than ARIA tabs requiring a new keyboard contract.

Account pages use a single column on phones. Long usernames, maximum-length
profile text, sync errors and filenames wrap. Settings stays within the dynamic
viewport, with internal scrolling and a reachable close control at 667×375.
Avoid sticky sections that consume the short landscape viewport. Keep 44px
targets, 16px phone fields, visible focus, browser zoom and reduced-motion support.
The existing intentional heatmap scroll region remains local to the heatmap.

Route navigation focuses the destination heading/main landmark. Dialog close
restores its opener, with an Account/Settings heading fallback if that control
disappeared. Background status updates never move focus, reset profile/solve
drafts or navigate. Retain drafts within the same source and defer unsafe incoming
training replacement; moving between Account sections must not upload unsaved
fields or discard a failed-save draft.

BIG-13/BIG-14 must extend route round-trip/legacy-alias checks, owner/guest/setup
and visitor privacy rendering, command/navigation coverage, demo source isolation
and Settings/backup focus regressions. BIG-15 covers queue/source/editor lifecycle;
BIG-16 covers shared persistence status. At the approved browser step, exercise
populated phone/landscape flows in both themes, Back/Forward and keyboard focus,
including opening Settings during hidden practice and an active timer. Browser
execution and screenshot inspection remain deferred; these are implementation
acceptance checks, not executed results.

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

## Owner review and delivery

The owner requested on October 23 that work be pushed in a dedicated branch and
worktree, and reviewed before Linear completion. Use `nic/big-11-account-workspace`
in `/tmp/last-layer-big-11`. BIG-12 was returned to In Review; keep BIG-11 and its
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

## Remaining release and design work

- [x] Define the Account/Progress relationship, route compatibility, navigation
      labels and grouped Settings presentation (BIG-12, October 23).
- [ ] Build Account Overview/Progress/Profile/Sync and data and reorganize Settings
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
