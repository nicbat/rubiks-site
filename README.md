# Last Layer

A static cube-learning app with Beginner and CFOP courses for 3×3. 2×2 Ortega and blindfolded are marked Work in progress / Coming soon. Known algorithm marks are shared across two-look and full CFOP; recognition confidence follows the exercise. No account, backend, database, or paid service is required. Progress lives in the current browser.

## Run locally

Requires Node.js 22.18+ (tested with Node 26).

```sh
npm ci
npm run dev
```

`npm run dev` starts with populated training data and a fake `@demo_learner`
account. No Docker, Supabase project, keys or email setup is needed. Open the Vite
URL to explore every screen; Settings → Demo account state selects sign-in,
username setup and failure previews. Demo code: **123456**. Sample account and
training edits stay in memory. `npm run dev:demo` remains an alias.

For guest development using normal browser storage, use `npm run dev:guest`. For actual authentication,
privacy and sync work, install/start Docker and use:

```sh
npm run dev:backend
```

This starts a separate local Supabase stack, applies migrations and starts Vite at
`http://127.0.0.1:5175`. Sign in as **learner@example.test**; retrieve its actual
8-digit code from the local inbox printed by the command (default
`http://127.0.0.1:55324`). The account is `@local_learner` with 30 sample solves;
`@local_friend` is public and `@local_private` is private. Any new email creates a
fresh account requiring a username. Email is captured locally. No hosted account
or environment file is needed. The first start downloads container images.

Local backend data persists between sessions. `npm run backend:reset` replaces
only this worktree's local backend data with the fixtures; `npm run backend:stop`
stops it while preserving data. Neither command targets the hosted project.
Frontend defaults and query overrides are development-only and do not change
production behavior. See [the testing workflow](docs/testing.md#local-backend-and-integration-workflow).

Open the URL printed by Vite. For full verification (install test browsers once with `npx playwright install chromium firefox`):

```sh
npm run verify
npm run preview
```

Publish the `dist/` directory to any static host. Relative asset URLs support hosting under a subdirectory. No environment variables are needed for guest use. Fonts and cube diagrams are bundled locally. Optional Supabase accounts and sync use the configuration below.

## Contributing and agent guidance

Read [AGENTS.md](AGENTS.md) for shared repository practices. [CLAUDE.md](CLAUDE.md) imports the same instructions for Claude Code. [Testing and performance](docs/testing.md) documents the test matrix, failure reproduction, benchmark scope, and build budgets.

[Accounts, Settings and sync plans](docs/backend-plan.md) records the current branch,
the planned Account/Progress/Settings restructure, terminology, and release work.

`npm run verify` runs Svelte diagnostics, domain/oracle tests, isolated browser tests (desktop Chromium, mobile Chromium, Firefox), and compressed bundle checks. Account browser tests in this suite mock Supabase. `npm run test:integration` separately runs database security checks and real Auth/Data API sync tests in a disposable local stack; `npm run test:integration:e2e` adds real browser flows. PRs and main pushes run `npm run verify:pr`: all domain tests and Chromium scenarios, plus focused mobile/Firefox coverage. Nightly and manual CI retain the full browser matrix. CI also runs real-backend integration tests and uploads browser failure traces. Use `npm run verify:fast` for non-browser checks. `npm run benchmark` measures repeatable rendering CPU workloads.

Compressed asset budgets are 320 KiB JavaScript and 32 KiB CSS across all emitted
chunks. These track transfer-size growth; they do not measure browser responsiveness.

## What you can do

- Learn your first 3×3 solve in eight Beginner lessons, with before/after diagrams, paused playable examples, and reversible completion marks. Courses are grouped by cube; Continue lists every started, unfinished course and Finished retains completed courses for review. Each course remembers its own place. Lesson completion means reviewed, not algorithm mastery.
- Open one CFOP workspace with Cross, F2L, OLL, and PLL sections. Switch Two-look / Full inside OLL and PLL, practise there, and resume from My learning.
- See upcoming 2×2 Ortega and blindfolded courses. The Ortega reference is prepared in the source (first face, seven OLL and five PBL algorithms), but both courses remain unavailable while work continues.
- Train two-sided PLL recognition in CFOP by matching six side stickers to one of four arrow diagrams with neutral side stickers. Names are secondary labels. The quiz covers all 21 PLL cases with varied AUF/viewpoints; session scores do not grant mastery.
- Choose a default display top color in Settings, optionally randomize it per case opening/question, or use Change color while studying. Case diagrams and algorithm previews use the same proper color scheme; timer and guide examples retain their stated orientation.
- The site opens on the Dashboard; the Last Layer brand link returns there. It suggests a next step (a choice between Beginner and CFOP for new learners, or the course in progress), shows today's practice attempts, day streak and best solve, offers quick actions, and features an OLL or PLL case of the day. Main navigation has Dashboard, My learning, Courses, Progress, Timer, and About; About briefly explains what Last Layer is. The highlighted navigation button, underlined in its own color, names these six pages, so they show no visible title (each keeps a screen-reader heading); course, guide, practice, Cubes, and account pages keep their titles. The account icon beside Settings opens My profile directly, with Find a learner for username lookup. Algorithm library and Guides remain available in the footer. Open Settings as a popup over the current page; manage Cubes from there. Escape, the close button, or the backdrop returns to your page.
- Carry recognition progress automatically between identical full/two-look objectives. Known marks carry across both views for the same case and variant; partial-pattern recognition stays separate.

- Open Guides for a visual cross-planning guide and all 41 standard F2L cases grouped for lookup. Cross diagrams show relative alignment, moves that help two edges, preserving a pair, and an X-cross, with above/underneath views and short captions. Open one example at a time to load its 3D cube; closing it or leaving releases the player. F2L cards keep their grid layout while the selected case opens in a separate preview below its group, keeping your scroll position while you browse cases. Cards show static pair diagrams and algorithms; their case numbers follow the CubeSkills sheet, not other sites. Examples start paused and do not affect learning progress.
- Explore face, wide, slice, and rotation moves in Guides → Notation, with labeled before/after nets and a CSS 3D cube shown by default. Play/pause controls continuous turns: each repetition starts from the previous result.
- Open a case for a 3D algorithm player in a side panel (stacked on phones), with touch-sized icon controls for play/pause and stepping, clickable move highlighting, and drag or arrow-key viewing. Home and practice screens keep their compact diagrams. Reduced motion disables notation autoplay; playback stays local.
- Show setup moves in any case popup to build that case from a solved cube. Start yellow-up and green-front, then use U turns or rotate the cube to match the diagram.
- Choose any of the 57 OLL and 21 PLL cases for your learning set.
- Switch to 2-look OLL/PLL for a smaller, step-by-step curriculum.
- Collapse library groups and practice any filtered set without changing your learning set.
- Mark algorithms you already know, independently for each variant.
- Preview the current timer scramble with the cube icon beside Scramble; drag or use arrow keys to inspect its final state.
- Use the scramble timer with Space or touch controls. After finishing, choose +2 sec, DNF, or No penalty; edit penalties in history too. Averages trim the fastest and slowest result: one DNF is dropped, two produce DNF. Raw elapsed time is preserved.
- Browse OLL and PLL by group and view top-down diagrams. PLL permutation arrows are on by default; an explicitly saved off preference is respected.
- Switch algorithm variants; hover or focus common move chunks for a tooltip, or click to keep their names visible.
- Click the main learning diagram to open its case, or rehearse a chosen algorithm throughout the day.
- Practice hidden cases from your selected set, using varied setup sequences and optional random last-layer color.
- Set a light, dark, or system theme and PLL arrows on the Settings page.
- Record recognition and execution results, and review local progress. Inspect solve timeline tooltips by hover, touch, or keyboard (Left/Right, Home/End; Escape dismisses).
- Export/import JSON backups to transfer progress between devices manually.

Each person can use their own browser, or optionally sign in through Account to sync their own training data across devices. Public profiles share an all-time progress summary; detailed histories stay private. Clearing browser storage deletes guest progress and unsynced account changes, so export backups periodically. Changing the site's origin (including its port) uses a different browser storage area.

## Command palette

Press **Escape** or **Ctrl/Cmd+K**, or tap the **⌘ Commands** button in the header. Type words to filter destinations, use **↑/↓** to choose a result, and press **Enter** to open it. The search field keeps focus while arrow keys highlight a result; Enter opens that result (initially the first match). Escape or the close button dismisses the palette and restores focus.

Commands cover navigation, CFOP sections, reference guides, Settings, and backups. Existing dialogs and open selectors handle Escape first. Opening and closing Commands preserves hidden practice; commands are unavailable during a running solve.

## Navigation and links

Pages use hash-based URLs, so direct links and reloads work on static hosts without server rewrites. For example: `#/dashboard`, `#/courses`, `#/cfop/pll/two-look`, `#/cfop/oll/full`, `#/library/pll/full`, `#/guides/f2l`, `#/timer`, and `#/cubes`. Browser Back/Forward restores the destination. Unknown links return to the Dashboard.

The header account icon opens `#/account/profile` directly. It shows your saved
profile, with **Edit profile** at `#/account/profile/edit` and **Account settings**
at `#/account`. Guests can sign in or finish username setup there, while Progress
remains available without an account at `#/progress`. Older `#/account/progress`
links canonicalize to Progress; `#/account/sync` links lead to Account settings.
The separate Overview and Sync and data pages have been removed.

Settings groups appearance, learning/display, timer, equipment, **Data & backups**
and preview tools. Backup/import, account export and explicit guest transfer are in
Data & backups. Sign-out and confirmed deletion are in Account settings; deletion
sits inside a disclosure. Preferences remain device-local and save immediately.

The small header refresh icon checks training sync without reloading or leaving
the current page. Only a server acknowledgement produces a success toast; Demo
feedback explicitly says that no cloud request occurred. Waiting/error states
retain a badge and a **Review sync** link after the toast disappears. The Sync
status dialog explains failures and conflicts; incoming updates wait during active
solves, practice and editing. Profile fields still use **Save profile**; drafts
survive navigation and the collapsed visitor preview uses saved public fields only.

Settings adds `?settings` to the current hash route, such as `#/timer?settings`. Opening it preserves the current page and active practice session; closing it restores focus. Preferences save immediately. Practice sessions and running timers remain temporary: reloading a practice route returns to My learning, and reloading the timer does not resume a running solve. Filters, case popups, and playback positions are not encoded in URLs.

## Practice rules

In **My learning → Hidden practice**, choose **Learning set** or **Review known**,
then **Both**, **OLL**, or **PLL**. Review known includes cases marked Known and
cases that earned Confident status for the current Full/Two-look method and chosen
algorithm variant, even outside your learning set. The card shows the matching
count and disables Start when none match. These choices remain selected when you
end a session and reset on reload.

Review uses the normal hidden setup, reveal, ratings, and progress tracking.
After revealing a case, **Relearn this case** records “Needed help”, removes the
current variant's Known mark, and adds the case to your learning set. The attempt
resets earned confidence for that recognition objective using the usual rules;
earlier history and other variants remain intact. It also removes the case from
the current review session. Other ratings and skips keep the session's starting
pool fixed; removing its final case returns to My learning. A failed relearning
save preserves the previous progress and revealed case so you can retry.

Start every hidden setup from a solved cube, yellow on top and green in front. In this grip, the standard color scheme has orange on the right, red on the left, blue at the back, and white underneath. This is the default display scheme. Display colors can change independently of physical setup instructions. Follow the setup while keeping the cube out of view, then bring it out to recognize and solve. Set up and solve on the same screen; Hide setup moves is optional and does not reveal the answer. Choose Reveal answer after solving, or Need help to see the solution. The case and diagram remain hidden until reveal. Help requires the “Needed help” result. Rating saves and immediately opens the next setup; a failed save keeps the answer and rating available for retry.

Hidden practice always randomizes the final layer adjustment. Adjacent turns of the same face are combined and cancellations removed, so setup length can vary. With **Randomize last-layer color** enabled, the setup places the case on any of the six colors, with a random orientation around that face. Face turns are remapped, including the final adjustment; no cube rotations are shown. Start yellow-up and green-front as usual, then find the last layer and bring it to the top to solve. Choices are independent, so colors can repeat. The setting and PLL arrow visibility are saved on the device; an existing enabled side-color preference carries over to the new setting.

A reveal shows your chosen display color and algorithm, not necessarily the colors or orientation produced by the setup. Match the pattern regardless of color, with the last layer on top; adjust that face or rotate the cube as needed. OLL setups may leave a PLL case after orientation; finish solving the whole cube before the next setup.

Imported attempts are validated for real calendar dates and timezone-qualified timestamps, then ordered chronologically before replacing any progress.

A case becomes **Confident** after confident recognition and execution on three distinct local calendar dates since the most recent difficult recognition attempt. “Needed help” and “Solved with effort” reset that sequence. Rehearsals add to practice totals but do not earn confident days. Each algorithm variant has its own history.

## Two-look learning and timer

Open **Courses → CFOP → OLL or PLL → Two-look**. OLL has three yellow-cross cases followed by seven corner-orientation cases; PLL has two corner-position cases followed by four edge-position cases. Diagrams show the complete case, including pieces not involved in the current learning step. Skip a step when its pieces are already solved. Saved algorithm choices take priority over two-look recommendations. Corner-orientation OLL cases with an oriented cross and edge-only PLL cases share recognition progress automatically for matching variants. Two-look line/L/dot and corner-positioning PLL have separate recognition objectives: the same moves can be familiar without full-pattern recognition. Known marks apply to the same algorithm variant in both views, including T/Y PLL and line/L/dot OLL. Marking or unmarking it updates both views without copying attempts. Different variants remain independent.

**Practice shown (N)** starts the cases matching the current section, method, group, search, and learning-status filters directly. **Choose cases…** opens an optional temporary picker for a custom subset. Click individual diagrams or a group heading to select cases, then choose **Practice selected**. **Practice all** starts every case shown in the picker, regardless of the selection. Closing the picker discards the selection without changing your learning set. Learned includes “Already known” and earned “Confident” status for the currently chosen variant. With all learning statuses shown, the library and each group display learned/total counts. Skipping and recording a result stay within that set. Collapsing a group only changes its display; it does not remove cases from the practice set. End practice returns to the originating My learning or library/CFOP page with its filters, scroll position and opener focus restored when available.

**Learning set** and **Known** in a case's detail are toggles; a checkmark and highlighted button indicate an active status. **Known** records a reversible declaration for the chosen case and variant across both two-look and full CFOP. It does not add practice attempts or confident days. Reviewed Cross/F2L guides share their mark across courses; reviews remain distinct from practice confidence.

Choose **Select cases** in OLL/PLL or the Algorithm library to edit several cases together.
Select individual cases, groups, or **Select all matching** the current filters, including
collapsed groups. Set **Known** and/or **Learning set**, then choose **Apply** to save both
properties together. Known uses each case's chosen algorithm variant; removing a known
mark preserves earned confidence and practice history. Applying successfully clears the
selection; failed saves preserve the original progress and your choices for retry.
Changing filters, section, or learning method clears the selection and property choices.
**Clear selection** resets the choices; **Done** or leaving the page discards unapplied edits.

The Cubes page keeps a simple list of names and optional descriptions. The first cube becomes the default; **Make default** changes it. The timer starts with that default after a reload and keeps your chosen cube during the session. Choose a cube before starting a solve, or open a row in **Solve history** and change **Cube for this solve** afterward. Renaming a cube updates its name in history. Delete removes a cube from the list and future choices while retaining its name on past solves. Deleting the default selects the next remaining cube, or no cube if the list is empty. Older solves remain “Not specified” until assigned. Cube records and timer history are stored locally and included in new training backups.

In Timer → Solve history, choose **Select solves** to select multiple rows.
**Select shown solves (N)** affects only the currently shown rows; **Show more**
keeps the selection and reveals older solves unchecked. Choose a cube (or
**Not specified**) and **Apply cube**, or **Delete selected** and confirm the
count. Successful actions clear the selection; failed saves preserve history,
selection and cube choice for retry. **Clear selection** resets the choices;
**Done**, leaving Timer or changing datasets discards unapplied choices. Bulk
controls are disabled while timing. Opening a solve still reviews it normally.

The Timer page generates 20 random face turns locally. These are not competition random-state scrambles. Hold Space for half a second until the “Release to start” cue, then release to begin. Tap Space to stop. A short early release does not start a solve. While starting and running, the scramble bar keeps its place but shows a decorative Ready… / Set… / SOLVE! countdown in step with the start lights (SOLVE! burns over a pixel flame in the logo fireball’s colors while running), so the clock does not move. After you stop, confetti bursts from the bar’s sides and a checkered flag covers the finished scramble and its preview until Next scramble; Review solve still shows it. After finishing, press Tab or tap Next scramble before starting another solve; further Space presses leave the result unchanged. Tab keeps its normal focus behavior in other controls, and Shift+Tab always moves focus backward. Hold the start button for the same half-second, then release when the cue appears; tap Stop to finish. The two decorative start lights show red at rest or while holding, yellow when ready to release, and green while running, even with the timer hidden. New scramble (Tab) refreshes the scramble before starting; Next scramble (Tab) advances after a solve. Navigating away stops the timer. Completed solves save locally with their date and scramble. Open Solve history and select a result to review or delete it; Backspace deletes the just-finished solve. Recent averages of 5 and 12 exclude one fastest and one slowest time, and each window shows its best solve. Turn off Show minutes on timer in Settings for total seconds. Enable Hide timer while solving to conceal the running time until you stop; this is off by default. Navigating away freezes an unfinished timer without saving it as a completed solve. Timer history is separate from learning progress and is included in new training backups.

Timer history initially shows the latest 50 solves, newest first. **Show more** adds
50 older solves at a time. Reviewing, editing, deleting, and recording solves keep
the expanded limit; leaving Timer, replacing a backup, or switching test data resets
it to 50. Statistics and exports always use the full history.

## Course progress and backups

After sign-in, accounts with guest training on the device offer **Add guest progress**
or **Keep separate**. Review guest/account counts first; transfer waits for account
sync, adds history and learning marks, and retains the local guest copy. The same
transfer is available later in Settings → Data & backups.

File imports show **Merge with current data** alongside **Replace with this backup**.
Merge previews added attempts, solves, cubes, selected cases and reviewed lessons.
Records with matching IDs count once; the current complete record wins if they
differ (including notes, penalties and retired cubes). Current algorithm choices,
course positions and default cube are retained. Learning sets, known marks, reviewed
lessons and recognition links are combined. A learning-only file keeps timer history
and cubes unchanged. Signed-in imports update account training and sync normally.

Older files without attempt IDs receive stable IDs for that learning backup, so
retrying the same import does not duplicate practice. Distinct identical attempts
within it remain distinct. Overlapping history in different legacy backups cannot
be identified safely and may be added again; the preview explains this before import.
Cancellation and failed saves preserve existing data.

Course learning starts fresh in `last-layer.progress.v2`. Version-1 browser storage is left untouched. Version-1 export files can be explicitly imported: the preview converts them to version 2 while retaining selected cases, algorithm variants, known marks, and original practice dates. Attempts without a recognition method use full recognition. Timer solves, cubes, and device settings keep their existing storage. New exports contain version-2 learning data, including shared known marks, legacy two-look marks and recognition links, reviewed lessons, the active course, and each course’s last opened module.

Legacy two-look known marks count as shared algorithm knowledge. Updating a mark consolidates that variant into the shared field; old recognition links remain supported in backups but are no longer exposed in the interface.

Attempts record the method and a snapshot of the variant being practised. In version-2 files, an omitted method means full recognition. Imports validate course/module/lesson references and sharing links before replacing anything. Imported progress can restore course selection and resume positions, but never an in-progress practice session. New training backups wrap version-2 learning progress together with timer history and cubes, including deleted cubes referenced by history. Older learning-only backups are still accepted and leave solves and cubes untouched. Display settings remain device-local.

Courses live in `content/courses/<id>/`, with JSON identities/order, Markdown lessons,
and JSON cube examples. Markdown compiles to validated Svelte-rendered nodes during
development/build; the parser is excluded from browser assets. See
[Course authoring](docs/course-authoring.md) for the supported Markdown and cube
blocks. All six CFOP modules also have Markdown files: Cross/F2L prose is shared
with footer Guides, and typed blocks retain the existing cross sequences, F2L
grid, and full/two-look algorithm library. Existing CFOP routes and saved IDs
remain compatible; Beginner links use
`#/courses/beginner/beginner-white-cross`. The inactive 2×2 reference has its own
JSON catalog and independently checked algorithms. It does not use the 3×3 renderer
or grant 3×3 recognition mastery. Interactive puzzle support still requires its
own mechanics, diagrams, and practice rules.

## Local tracking dashboard

Progress combines hidden practice, rehearsals, and timer solves in a selectable activity heatmap. Weeks run across and weekdays run down;
color intensity shows daily activity, and selecting a square shows the day’s breakdown. Time solving appears alongside Practice attempts, Active days and Confident cases as `hh:mm:ss` (raw elapsed time, with hours continuing beyond 24). The other timer statistics sit above the heatmap. A single full-width graph shows dimmed individual-solve dots and ao5/ao12 lines, without a line connecting individual solves or a bar chart. Below it, a full-width toolbar groups **Last day**, **Last week**, **Last month**, **Last 3 months**, and **All time**, followed by a vertical separator and the cube filter; controls wrap on phones. Presets include today and cover 1, 7, 30, or 90 local calendar dates; Last month is the default. Custom dates are not offered. The heatmap always shows the latest 365 days with month labels.
The compact contribution grid uses 12px day squares and scrolls horizontally on phones. Confidence is all-time and follows the
current recognition method and algorithm variant. The OLL/PLL case map opens the existing
case details without changing confidence rules. OLL and PLL can be collapsed independently.
Select a heatmap day and choose **Delete day’s activity** to review and remove all practice attempts and timer solves for that local date, across all cubes. Confirmation is required; other dates, selected cases, known marks, and cubes are kept. Deletion recalculates confidence and statistics and cannot be undone without a backup. Failed writes preserve the previous data.

Selected days show solve count, best single, median, best ao5/ao12, recorded solving time,
mean and middle 50% excluding DNF, +2 counts, and DNF rate. Selecting a heatmap date drills
into that day; choosing a date preset clears the day selection. The shared date/cube filters
apply to the graph, statistics and both solve lists.

Click or tap a dot (or select a history row) to open that solve’s full details inline below
the graph toolbar. Hover and keyboard focus only inspect the chart tooltip; they do not
select a solve. Inline controls support penalties, cube assignment, notes, copy, confirmed
deletion and save retry. Previous/Next traverse all filtered solves, including ones omitted
from the bounded graph sample. **Show cube** / **Hide cube** stays set as you browse solves,
and the visible preview updates to each selected scramble. Clearing filters or selecting a
different day clears the selected solve. Timer reviews continue using the existing dialog.

Learning content is always visible below the tracking section; there is no Learning/Solves
switch or repeated solve-statistics panel. Up to 50 individual results appear below the
graph. Bests and summary statistics use the entire selection. Averages include penalties
and drop one fastest and one slowest result. DNF points appear above the time axis. These
are personal training statistics using the app's random-turn scrambles.

New attempts get permanent IDs; existing attempts receive IDs once when loaded and saved.
New solves retain a local calendar date alongside their timestamp. Older solves have no
original local date and are grouped using the current device's timezone. Missing measurements
are not invented. Quiz history, timed algorithm drills, and session summaries
are not part of this dashboard release. Optional cloud sync is described below.

New exports use `{ format: "last-layer-training", version: 1, progress, solves,
cubeCollection }`. Import previews distinguish full training replacement from learning-only
replacement. All records and cube references are validated before confirmation. A restore
journal preserves the previous stored bytes until all writes succeed; interrupted restores
roll back before training data is read on the next load. Storage failures retain the prior
records and show an error. Keep a backup before clearing browser data.

`dashboard.js` contains DOM-independent activity and solve summaries. Daily learning counts
come from `progress-index.js`'s existing single history scan. `training-backup.js` owns the
versioned backup envelope, validation, and recoverable storage replacement. Views remain
declarative, and `main.js` owns interactions. No backend or runtime service is used.

## Test data

Enable **Settings → Preview tools → Enable test data** to explore a populated app without
changing your personal training data. It also signs into a fake account,
`@demo_learner`, with profile editing, private/public visibility, statistics,
guest-transfer previews, export and deletion. These actions use only in-memory
demo state. Find a learner can look up `demo_friend` (public), `demo_private` (unavailable),
or the current demo username. Settings → **Demo account state** previews sign-in,
username setup, loading, account errors, offline saves and conflicting edits.
Demo sign-in accepts an email and code **123456**; it never sends email. **Reset
demo account** restores the account fixture without replacing sample training.

The seeded dataset backfills 18 months (roughly
9,800 solves and 4,300 practice attempts), including rest days, improving solve times,
+2/DNF penalties, notes, active/retired/unassigned cubes, algorithm variants, known
marks, reviewed guides, and varied OLL/PLL confidence. Dates follow the local calendar
and end today. Progress, Timer, courses, and the library use the same active dataset.

The Settings toggle is the only indicator of test mode; no banner is shown. Sample edits, new solves, imports, and day deletions
stay in memory and survive toggling within the tab. Turning test data off restores
your personal data, including unsaved changes in that tab. The toggle is saved as a
device preference; reloading while enabled regenerates the sample dataset and fake
account. Exports use the active dataset and sample files are labeled `test-data` or
`demo`. The normal dev command starts in demo mode on each reload; `?demo=0` overrides it for that tab. `?demo=1` also enables the demo in other development modes.
Starting directly in demo mode skips Supabase initialization. Entering from a real
session pauses its sync/refresh; leaving restores the real account and training
data. Demo account forms, lookups and actions do not call Supabase or modify stored
personal progress.
Display preferences and themes remain device settings. Switching datasets ends
temporary practice and clears the timer result; switching is disabled during a solve.

`test-data.js` generates the DOM-independent fixture with a fixed seed.
`demo-account.js` provides the network-free fake account and state previews. It
reuses real profile validation, training backups, and statistics rules. Its flows
are UI previews; use the local integration suite or staging to verify actual auth,
database ownership and cross-device behavior.
`training-storage.js` routes normal writes and restore journals to either browser
storage or an isolated in-memory store. Sample data never replaces stored personal
training records.

## Configure algorithms

`data/algorithms.json` is the source of truth. A case looks like:

```json
{
  "id": "pll-T",
  "section": "PLL",
  "name": "T perm",
  "group": "Adjacent Corner Swap",
  "source": "https://jperm.net/algs/pll",
  "preferredVariant": 0,
  "algorithms": [
    { "label": "Default", "moves": "R U R' U' R' F R2 U' R' U' R U R' F'" }
  ],
  "setups": ["A verified setup sequence goes here"]
}
```

The setup placeholder above is explanatory, not valid cube notation. Keep the verified setups already in the catalog when changing your preferred algorithm. Append alternative algorithms to the `algorithms` array and change `preferredVariant` if desired. Keep case IDs and existing variant positions stable: saved progress refers to them. A browser's selected variant overrides `preferredVariant`.

OLL/PLL algorithms omit initial `y` regrips: the diagram starts in the grip used by the first remaining move. Internal rotations remain part of the algorithm. PLL sequences include the finishing layer adjustment so the displayed permutation solves completely; arrows show its actual piece destinations. G perms show a three-corner cycle and a three-edge cycle with the matching two-piece block fixed. Light outlines separate overlapping arrows.

Diagrams are computed directly from the selected algorithm, including slice moves, wide moves, and rotations. Different variants can still use different starting grips; removing a leading regrip does not force unrelated finger tricks into the same orientation. Randomized physical practice may still require a final adjustment relative to your cube’s centers. All variants for a case must solve the same case (up to cube/top-layer orientation). Run `npm test` after catalog changes; it checks every variant and every setup. The parser supports standard space-separated move notation and parentheses for grouping, not commutator syntax.

`data/triggers.json` defines named move chunks. The longest matching chunk wins; file order breaks ties. Patterns are parsed once when the app starts. Unmatched moves remain readable in plain notation. Change this file to use your own chunk names.

## Sources and maintenance

The 41-case F2L reference comes from [CubeSkills’ F2L sheet](https://www.cubeskills.com/uploads/pdf/tutorials/f2l.pdf) by Feliks Zemdegs and Andy Klise. Local case numbers follow the sheet’s reading order. `data/f2l.json` is separate from the last-layer importer; static pair diagrams are generated locally.

Algorithm sequences, case classifications, and setup sequences come from [J Perm's OLL](https://jperm.net/algs/oll) and [PLL](https://jperm.net/algs/pll) trainers. The catalog contains 16 setup sequences per case, with a randomly chosen final U adjustment during practice. The UI and generated SVG diagrams are original to this app.

`node scripts/import-jperm.mjs` regenerates the catalog from upstream literal data. **This overwrites catalog customizations**; review the Git diff before committing. It parses the source with Acorn and does not execute downloaded JavaScript. It requires network access only when explicitly run. Preserve the local leading-regrip and PLL finishing-adjustment corrections when reviewing an import; the normalization and completion tests guard them. `scripts/normalize-algorithms.mjs` exports an offline leading-`y` cleanup helper and is not runtime code.

Tests validate case coverage, variant equivalence, setup equivalence, progress rules, and backup validation. An independent cubing.js check verifies that every setup preserves F2L and that PLL setups keep the top oriented. Cubing.js is a development dependency only, not part of the app bundle.

## Svelte UI

The entire UI uses Svelte 5 on Vite. Shared Button, Input, Textarea, Label, Checkbox,
Select, NativeSelect, RadioGroup, Card, Badge, Chart, Command and Dialog components live in `src/lib/components/ui`
and follow shadcn-svelte's source-owned model. The command palette uses the default
shadcn layout with Last Layer's shared colors and typography. All controls support
light/dark/system themes and phone touch targets. `components.json` configures
registry additions; see the UI directory's README and MIT license before changing them.

Application state and actions stay in `main.js`. It publishes reactive render inputs
through `app-model.svelte.js`; `view-state.js` refreshes mutable UI boundaries without
copying the attempt history. Svelte owns the page DOM. The specialised cube renderer
owns its scene and animation controls, and AbortController releases handlers when
players change. Only locally generated SVG/icon markup uses `@html`.

The app remains statically hosted with local guest use. Hash URLs, guest storage keys,
backups, catalog IDs and variant indices remain stable. Optional account storage uses
separate per-user keys; signing in does not migrate guest progress automatically.

Physical 3D stickers use retained child elements with literal inline `!important`
background colors, preserving white and the other puzzle colors against dark-mode
extension stylesheet overrides. The renderer retains that priority when recoloring
after moves. Sticker colors also remain identifiable in forced-colors mode; the
surrounding player and controls continue to use the shared theme.

## Code layout

- `src/main.js`: application state, persistence orchestration, DOM events, and focus management.
- `content/courses/` / `scripts/compile-courses.mjs`: editable course manifests, Markdown lessons, JSON examples, and a shared build/test compiler with source validation.
- `src/courses.js` / `src/components/Courses.svelte` / `src/components/CourseLesson.svelte` / `src/courses.css`: reusable definitions, scoped case pools, course summaries, progress, declarative lessons, course pages and availability.
- `src/two-by-two.js` / `src/components/TwoByTwo.svelte` / `data/two-by-two.json`: Ortega reference and reviewable lessons.
- `src/display-colors.js`: proper color relabeling shared by diagrams and algorithm players.
- `src/pll-quiz.js` / `src/components/PllQuiz.svelte`: independent question generation and visual PLL choices.
- `scripts/pack-catalog.mjs`: lossless production-only catalog field/setup encoding, preserving the editable JSON and every setup; tested by a complete round trip.
- `src/commands.js`: command definitions and word filtering; `src/components/CommandPalette.svelte` composes shadcn Command primitives. Bits UI manages search/selection keyboard behavior; `main.js` owns application actions and opening/closing focus.
- `src/profile-summary.js` / `src/components/ProgressSummary.svelte`: fixed public summary rules for demo/parity checks and the shared two-row presentation. The database derives real public summaries from private snapshots; its catalog metadata is checked against the JSON catalog.
- `src/components/Account.svelte` / `AccountIdentity.svelte` / `AccountProfile.svelte` / `AccountData.svelte`: private workspace, sign-in/setup, profile editing/visitor preview, and sync/transfer/session controls; actions remain in `main.js`.
- `src/sync-status.js` / `src/components/SyncDialog.svelte`: shared training-sync presentation, manual confirmation and contextual recovery.
- `src/account-workspace.js` / `src/components/DashboardActivity.svelte`: shared Progress summaries and activity controls using the existing progress index and dashboard rules.
- `src/components/AppView.svelte` / `src/icons.js`: page and dialog markup, shared UI components, and icons.
- `src/cube.js`: facelet mechanics, move parsing, case construction, and case equivalence.
- `src/cube-player.js`: public 3D player API. Pages use `src/components/CubePlayer.svelte` with `id`, `mode`, and `algorithm` props with a stable instance ID and `notation`, `algorithm`, `scramble`, or `lesson` mode. Lesson mode additionally accepts an explicit `setup` and starts paused from that state; mode determines controls, starting state, and autoplay; algorithm playback holds 100 ms between 650 ms turns, while notation holds 450 ms; `main.js` mounts playback with `createPlayerPlayback` and a `createCubeRenderer` per DOM root.
- `src/cube-playback.js` / `src/cube-player-view.js` / `src/cube-player-renderer.js` / `src/cube-player.css`: private timeline, geometry, DOM projection, and styling. Event handling and scheduling stay in `main.js`; the renderer owns only its per-mount draw cache, has no listeners or timers, and writes only changed values. Cube elements persist across moves; only colors, layer membership, and exposed inner faces change. Full cube snapshots remain defensive copies.
- `src/f2l.js` / `src/components/F2L.svelte` / `src/f2l-diagram.js` / `data/f2l.json`: full F2L reference, center-normalized setups, and local static pair previews.
- `src/components/CourseContent.svelte` / `src/components/Guides.svelte` / `src/guides.css`: shared Markdown rendering and reference navigation for authored Cross/F2L content. `CrossExample.svelte` retains the sequence diagrams and on-demand playback; CFOP setups and solutions live in `content/courses/cfop/examples.json`, separately from the OLL/PLL catalog.
- `src/components/Notation.svelte` / `src/notation.css`: interactive 3×3 notation reference; demonstration state and events live in `main.js`.
- `src/diagram.js` / `src/pll-arrows.js`: SVG diagrams and PLL piece movement.
- `src/case-diagram.js`: shared 2D case-preview API for learning, library, progress, practice, detail, and the practice picker. It caches immutable SVG strings from `diagram.js`; previews have no visible orientation caption and retain orientation in their accessible labels.
- `src/progress-index.js`: one history scan per render for shared, separate, and explicitly linked recognition summaries. Activity totals count each attempt once.
- `src/algorithm.js` / `src/html.js`: DOM-independent trigger tokenization and trusted SVG HTML escaping; `Algorithm.svelte` renders text and disclosures.
- `src/practice.js`: random setup selection and last-layer color/orientation remapping.
- `src/learning-methods.js` / `data/learning-methods.json`: full and two-look curricula and recommended variants.
- `src/library.js`: shared library filtering and filtered practice pools.
- `src/components/PracticePicker.svelte` / `src/practice-picker.css`: grouped temporary practice selection; selection and session events live in `main.js`.
- `src/components/SelectControl.svelte`: shared shadcn/Bits UI selector with keyboard navigation.
- `src/cubes.js` / `src/components/Cubes.svelte`: validated local cube records, default selection, and cube management/pickers. Timer solves optionally reference a stable cube ID; old solve records remain compatible.
- `src/solve-timer.js` / `src/solve-history.js` / `src/components/Timer.svelte` / `src/timer.css`: scramble generation, stopwatch state, validated local solve history, recent statistics, and timer UI.
- `src/progress.js` / `src/dates.js`: progress validation, shared calendar/timestamp validation, and confidence rules.
- `src/preferences.js` / `src/theme.js`: device preferences and theme behavior.
- `src/tokens.css` / `src/style.css` / `src/theme.css`: design tokens (light/dark palettes, cube colors, and the self-hosted Silkscreen, Martian Mono, Saira, and DSEG7 fonts), layout, and theme controls. Components read token variables; themes change only the values in `tokens.css`.

Views receive current state and read-only helpers; they do not mutate progress. UI primitives forward actions to the controller through Svelte context. Cube mechanics and practice generation have no DOM dependency. Tests also compare side rotation with cubing.js and verify PLL arrow destinations.

## Deliberately left for later

Cross/F2L practice, interactive blindfolded drills, 2×2 players/practice, automatic learning recommendations, an in-app algorithm editor.

## Future ideas

See [docs/ideas.md](docs/ideas.md) for deferred ideas, including shared progress, learning recommendations, trigger drills, cross, and F2L.

Timer history retains `last-layer.solves.v1`: optional `penalty` is `"+2"` or `"dnf"`; absence means no penalty. `elapsed` always stores the raw milliseconds. Device preferences add validated `displayTop` (U/D/F/B/R/L) and boolean `randomDisplay`.

Progress opens with no heatmap day selected and shows all-time timer charts. Click a day
to inspect it; click it again or choose All days to return to all-time. The activity-period
selector only controls the summary totals and does not restrict these all-time charts.
The full-history timeline retains endpoints and each bucket’s fastest, slowest and DNF
results in a bounded overview; averages are sampled at those points. All statistics and
the histogram use every matching solve. Day charts retain the latest-200 display limit.

## Reviewing timer solves

After stopping, **Review solve** opens the just-finished result without advancing the
scramble. History rows show time, cube, date, and penalty/note indicators; select any
row to open the same details dialog. Cube assignment and penalties update that solve
only. Deleted cubes retain their historical names and can be replaced or cleared.

The dialog shows the exact saved scramble, with **Copy scramble** and an on-demand
interactive **Preview cube**. The preview shows the scrambled starting state, not a
replay of the solve. Closing it releases the player and returns focus to the opener.

Optional plain-text notes save as you type (up to 5,000 characters), including line
breaks. A failed save keeps the draft in the current tab, reports the failure in the
dialog, and offers **Retry saving**. Keep that tab open or export a backup before
reloading. Delete is confirmed inside details; failed deletion preserves the solve.
The Backspace shortcut still deletes the just-finished solve outside dialogs and
editable controls.

Solve storage remains `last-layer.solves.v1` with an optional string `notes`; older
records and training backups without notes remain compatible. New full training
backups include notes, and import validation rejects invalid or oversized notes
before replacing data. Learning-only backups continue to leave solves untouched.

Progress's **Individual solves** list and graph dots open the full review inline below
the graph toolbar, with Previous/Next and retained Show/Hide cube state. Timer uses the
native review dialog. Notes and penalty badges appear in the history rows. Edits and
deletions refresh the graph, statistics and cube filter; a deleted final solve or cube
reassignment outside the filter returns focus to the graph filter.

`SolveHistoryRow.svelte` owns the shared declarative row presentation;
`SolveDetails.svelte` owns shared review fields, and `SolveDialog.svelte` hosts them for Timer. Their actions and persistence
remain in `main.js`.

## Optional Supabase accounts and sync

The header account icon provides email sign-in links and optional codes for guests. Guest use requires no
account or network. Configured builds load the bundled Supabase Auth SDK; network calls
start when signing in, restoring a saved account session, or explicitly looking up
a profile. The app remains static:
Supabase Auth and the Data API are the only optional backend services.

After email verification, new accounts must claim a unique username before sync
is enabled. Usernames are case-insensitive, start with a letter and contain 3–24
letters, numbers or underscores. Reserved names are unavailable. Usernames set
permanent page addresses in this version; renaming is not yet supported. Account
ownership always uses the permanent auth ID, never the username.

Every completed account has a page at `/#/u/<username>`. Profiles start private:
only their owner can view them. Edit profile allows making the profile public or
private. Public profiles are readable without signing in; private and nonexistent
profiles return the same unavailable state. **My profile → Find a learner** supports
exact username lookup; `#/people` links and the command palette still work.
Profiles can include a display name (60 characters), bio (280), and learning goal
(120). Making a profile public also shares the first two Progress summary rows:
practice attempts, active days, confident cases, total solving time, solve count,
best single, median, best ao5 and best ao12. There is no separate statistics toggle.
The public summary covers all time and all cubes, using Full CFOP confidence over
the 78 OLL/PLL cases and current saved variants. Declared-known marks remain
separate from earned confidence, matching Progress. Best times/averages include
penalties; median excludes DNF; duration includes raw DNF time without +2 additions.
Recorded local activity dates are retained; legacy solves without a local date use
UTC in the public summary. Private Progress continues to use the device timezone
for those legacy solves and retains its existing filters.

One permission-checked API request returns only profile fields and the stored
summary. It never downloads a visitor's raw history. Summaries refresh when training
syncs; unsynced local changes appear on private Progress first. Empty accounts show
zero totals and absent times. Owners can see their own summary while private.
Email, individual solves, notes, charts and the case map remain private.
Profile links have a copy action. The public/private control governs all public
fields immediately, including summary access for existing public profiles.
The migration retains the deprecated `share_stats` column and legacy statistics
RPC for older clients; the flag no longer controls sharing. Deploy the new database
migration before the frontend that uses `profile_for_username`.

If that RPC is missing during a rollout (`404 / PGRST202`), profile pages fall
back to the existing RLS-protected profile fields and show a temporary summary
notice. They do not substitute the older statistics or download raw training.
**Try again** checks the new API each time, so the full summary returns once
`20261023120000_public_progress_summary.sql` is applied. Other API errors retain
the normal error state. Deploying the static site does not apply SQL migrations.

Account sessions use separate device data. A fresh account cache downloads existing
cloud progress automatically. **Bring guest progress into my account** previews a
transfer before adding guest records and learning marks. Account edits win when
the same record differs; the original guest data stays on the device. Transfers
require the account to sync successfully first and are blocked during active work.
Ambiguous guest practice without stable record IDs stops the transfer and asks
you to export both backups, sign out and reload for the existing guest ID upgrade;
neither copy is replaced.
Signing out restores guest data. Each account keeps its own device storage and
restore journal under `last-layer.account.<user-id>.*`. Sign-out retains that local
cache, so this is not a substitute for clearing site data on a shared computer.
Themes and preferences remain device-local. Test data never syncs.

Successful saves start syncing immediately after the controller commits its state.
Same-turn saves are combined, requests run serially, and edits made during an
upload get another pass. Stale writes get up to two automatic retries; persistent
errors and real conflicts wait for another interaction or explicit resolution.
Returning to the tab,
reconnecting, or using **Check sync** checks for remote changes. There is no
Realtime subscription or background polling. Completed saves can upload during
active work. Applying incoming data waits while practice,
solve review, bulk edits, imports, a running or just-completed timer, or unsaved storage failures
need attention; finishing the activity retries pending sync. Account changes stop an
unfinished timer without recording a completed solve.

Other tabs' training changes use the same activity/draft guard. After cancelling
or finishing an untouched draft, the latest stored copy loads and sync resumes.
If you tried to save against another tab's changed bytes, export your tab's
unsaved work before reloading; automatic cross-tab draft merging is not supported.

The server stores one full training backup per user, with an integer revision.
The client validates domain data; SQL enforces its envelope and size limits.
Matching revisions upload atomically; stale writes are rejected. Each
device keeps its acknowledged local baseline alongside the revision and fingerprint. A
three-way merge combines independent solves, attempts, cubes and progress edits.
When incoming data is deferred, this baseline records the local version that
contributed to the acknowledged upload, rather than changes not yet seen here.
Absence relative to the baseline preserves deletions instead of resurrecting
records from an older device. Different fields can merge within the same record.
Conflicting edits to the same field, or deletion versus editing the same record,
require **Use device edits** or **Use cloud edits**; unrelated changes from both
devices are retained. Sync problems are also shown outside Account.
Cloud snapshots have a 20 MB database limit; the local import limit is 100 MB.
An accepted local backup may therefore be too large to sync. Rejected uploads
preserve local data and the previous server revision and direct you to export.
An existing device copy without a sync baseline also requires a choice if it
differs from the cloud. This recovery choice replaces a whole copy, so export
backups first if both matter. A deliberately saved empty copy counts as existing data.
Damaged sync bookkeeping is treated as an unknown baseline: identical copies
repair it automatically, while different copies require a choice.
Offline edits stay local until a successful retry. Cloud sync is not a versioned
backup service; continue exporting backups for recovery.

**Export account backup** includes current training data and saved profile settings
in a normal training backup with an extra `account` object. Existing import restores
training data and leaves profile settings unchanged. **Delete account** requires
typing the username (or `DELETE` for unfinished setup). A narrowly scoped server
function deletes the signed-in auth user and cascades their profile, snapshots and
summary. It accepts no target user ID and needs no browser admin credentials.
Only after confirmation of deletion does the app remove this account's local
cache; guest data and other accounts are preserved. Other devices may retain
previously downloaded offline data. Old access tokens can remain valid until
expiry, but missing auth-user foreign keys prevent recreating deleted account
records. There are no uploaded storage objects in this feature.

Setup:

1. Apply all files in `supabase/migrations` in order (Supabase SQL Editor, or
   `supabase db push`). They create owner-only `training_snapshots`, a revision
   compare-and-swap RPC, and private-by-default `profiles`. Training writes require
   a claimed username. Stats are server-maintained. Clients cannot directly delete
   rows or change a username; account deletion goes through the confirmed owner RPC.
2. Enable Email authentication and set the site URL to your app's origin.
   Supabase's default email templates work: the app captures the sign-in token
   fragment before hash routing and removes it from URL history. Add specific
   local/preview URLs to Supabase's redirect allowlist when testing real email
   sign-in outside the production origin. Public signup uses configured SMTP.
   The owner confirmed on October 22 that `lastlayer.net` is verified, DNS and the
   Supabase email connection are configured, and confirmation/reset messages were
   delivered. Verify the app's actual passwordless sign-in/callback flow on the
   intended deployment URLs before release. Both Magic Link and Confirm Signup
   must use `supabase/templates/sign-in-code.html`, which includes `{{ .Token }}`
   for code entry and `{{ .ConfirmationURL }}` for the link. Local development
   loads it automatically. On October 23, both hosted templates and their subjects
   were updated through the Management API and read back successfully; other
   production auth settings were retained. Email delivery/code redemption still
   needs a real inbox check. Deploying the static site alone does not update
   hosted email templates.
3. For an explicitly configured hosted build, copy `.env.example` to `.env.local`
   and fill in the publishable key. Everyday development does not need this file;
   `npm run dev:backend` supplies its own local public configuration. Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (legacy
   `VITE_SUPABASE_ANON_KEY` is also accepted). Never put secret/service-role keys
   or database credentials in a `VITE_` variable.
4. Vercel's Supabase integration already supplies `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY`. Vite maps only those exact public
   values into the browser build. Keep all other Supabase and Postgres variables
   private. Configure each desired Vercel environment and rebuild after changes;
   a Production-only integration does not configure Preview or Development.

The current project URL is `https://qdiekemamzzqzaivutse.supabase.co`. No project
keys or database credentials are committed. Local env files and `.vercel` are
ignored. Public keys identify a project; database authorization relies on JWTs and
RLS, never a browser-provided owner ID. See the official
[passwordless auth guide](https://supabase.com/docs/guides/auth/auth-email-passwordless)
and [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

`supabase/config.toml` configures **local development only**: localhost redirects,
local email templates and a short email cooldown. Do not run `supabase config
push` with this file. Hosted auth settings are configured separately; retain the
production site URL, reviewed redirect allowlist, email confirmations, TOTP MFA,
eight-digit OTPs and production email limits. After `npx supabase login` and
`npx supabase link --project-ref <ref>`, migration deployment uses
`npx supabase db push --dry-run` followed by `npx supabase db push`. Do not deploy
local seed data. The local workflow captures mail in Mailpit and does not manage
hosted SMTP credentials. The owner-reported hosted email setup is recorded in
[the current plan](docs/backend-plan.md#hosted-infrastructure-and-verification-status).

`src/supabase.js` owns configuration/client creation, auth-fragment parsing and the API adapter;
`src/cloud-sync.js` owns DOM-independent validation, fingerprints, revisions and
sync coordination. `src/training-merge.js` owns baseline-based merges, and
`src/profiles.js` owns username validation and the profile adapter. Account UI,
profile requests and source changes are orchestrated by `main.js`.
`src/sync-queue.js` coalesces saved-change notifications and serializes immediate
sync attempts. Profile summaries and account deletion are implemented by the
profile-details migration. See Supabase's [user management guidance](https://supabase.com/docs/guides/auth/managing-user-data)
and [function security guidance](https://supabase.com/docs/guides/database/functions).
