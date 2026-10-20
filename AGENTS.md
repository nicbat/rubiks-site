# Last Layer: repository instructions

Applies to Codex, Claude, and other agents working anywhere in this repository.
Read `README.md` for setup and architecture; read `docs/testing.md` before changing behavior.

## Product and architecture

- Keep this a static, browser-local app. Do not add accounts, analytics, a backend, or runtime third-party requests without a user request.
- Keep copy short and functional. Support phone and laptop, keyboard navigation, and light/dark/system themes.
- Keep cube mechanics, setup generation, progress rules, and import validation independent of the DOM.
- Keep views declarative; put state changes and event handling in `main.js`. Reuse existing modules instead of duplicating pattern or diagram logic.
- Keep algorithm data in JSON. Case IDs and existing variant indices identify saved history; preserve them or provide an explicit, tested migration.
- Do not regenerate the upstream catalog casually: the importer overwrites local algorithm customizations.
- Treat imported files as untrusted data. Validate before replacing progress, retain local calendar dates, and preserve existing data on failures/cancellation.

## Svelte and shared components

- Use the source-owned shadcn-svelte components in `src/lib/components/ui` wherever applicable. Extend shared primitives before creating one-off buttons, inputs, selection controls, cards, badges, or dialogs; review registry additions against the existing accessibility and mobile contracts.
- Keep components consistent through shared semantic theme tokens in `theme.css` and `shadcn.css`. Support light, dark, and system themes without isolated component palettes or duplicated theme state.
- Use Svelte 5 runes (`$props`, `$state`, `$derived`, and `$bindable` where needed), snippets, and event callback props. Use effects for external synchronization with cleanup, not to copy derived state. Let Svelte own declarative DOM; bridge external state reactively instead of mutating Svelte-owned controls.
- Retain specialized cube geometry, animation, and native playback controls where their measured behavior requires it. Document exceptions instead of forcing generic primitives onto them.

## Mobile UI

- Treat 320px portrait and 667×375 landscape as supported layouts, alongside tablet and laptop. Keep every navigation destination visible; wrap content and shrink grid children instead of hiding page overflow.
- Give buttons, disclosure summaries, and tappable form labels at least 44px of target height; icon and move buttons also need 44px width. Keep editable fields at least 16px on phones to avoid focus zoom, and never disable browser zoom.
- Dialogs must fit the dynamic viewport, scroll internally, retain a reachable close control, and restore opener focus. Long algorithms, filenames, variant labels, and populated history must not create horizontal scrolling outside intentional scroll regions.
- Keep cube dragging confined to the cube stage; provide buttons/keyboard alternatives and ordinary page scrolling around it. Check short landscape heights before using sticky panels.
- Preserve readable light/dark themes, visible keyboard focus, reduced-motion behavior, and hidden practice answers at every size.
- For UI changes, extend mobile browser regressions for affected flows. When browser testing is approved, inspect phone screenshots covering narrow portrait and short landscape, real actions and content bounds—not only the document's scroll width. Use the isolated Playwright server.

## Tests and correctness

- During interactive iteration, do not automatically run browser tests, browser automation, or screenshot capture after each change. Complete implementation and fast non-browser checks first, then ask before starting browser verification; briefly state its scope. An explicit request to run a specified browser check is approval for that check, not standing approval for future iterations.
- This approval requirement includes `npm run test:e2e`, direct Playwright commands, and `npm run verify` because it runs browser tests. If the user defers testing, keep it deferred until requested or approved; do not repeatedly ask after every edit. Continue updating relevant regressions and clearly report browser verification as pending.
- Run appropriate non-browser checks (domain/unit tests, Svelte diagnostics, formatting, and build checks) without asking. CI keeps its full verification workflow.

- For behavior changes and bug fixes, add a regression that would fail without the change. Do not add tests that merely repeat implementation logic.
- Preserve independent cubing.js checks, exact sticker-state assertions, seeded property tests, and full catalog/setup coverage. An algorithm followed by its own inverse is not sufficient evidence.
- Keep randomness deterministic in tests via injected choices or documented seeds. Compare invariants and outcomes, not incidental scramble strings or motivational copy.
- Test meaningful failure paths: malformed imports, storage failures, chronology, variant changes, hidden answers, hint grading, keyboard focus, and narrow layouts.
- Browser tests use accessible roles/labels and observable waits. No fixed sleeps, shared browser profiles, live-site dependencies, `.only`, or silent skips/retries to hide failures.
- For cube/catalog changes, run `npm test`; UI/storage/theme changes also need `npm run test:e2e` at the approved browser-verification step.
- Full validation of executable changes uses `npm run verify`, subject to the browser-testing approval requirement above. When approval is pending, report completed fast checks and remaining verification instead of launching it automatically. Pure documentation/copy edits need proportionate checks rather than new redundant tests.
- Never weaken assertions, remove oracle coverage, or raise build budgets merely to make a failing change pass. Explain intentional contract changes and update their tests together.

## Performance and maintenance

- Measure with `npm run benchmark` before and after performance work. Report environment, workload, and what the metric measures; Node HTML-generation time is not browser paint time.
- Keep caches bounded and keyed by every output-affecting input. Test eviction and stale-data scenarios; do not expose shared mutable cube state.
- Preserve one history scan per render; avoid per-case scans of the full history. Use deterministic operation-count tests rather than CI wall-clock limits.
- Run `npm run test:build` for dependency/bundle changes. Keep cubing.js, test tools, and import tooling out of runtime code.
- Add dependencies only for a concrete need; update the lockfile. Format changed files with the repo's Prettier version.
- Update README/testing docs when commands, schemas, module boundaries, or behavior change.

## Working safely

- Inspect `git status` first. Preserve user edits and other agents' work; coordinate file ownership before parallel edits.
- Do not commit credentials, personal progress exports, generated `dist`, test reports, or browser profiles.
- Use the test runner's isolated port/context; do not kill or reuse the user's preview server or browser storage.
- Keep commits focused. Report changes, test results, measured performance, and any verification limits. Never claim a check passed without running it.
