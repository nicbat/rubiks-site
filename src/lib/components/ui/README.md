# UI primitives

Source-owned shadcn-svelte components, using Svelte 5 and Bits UI. Button, Input,
Textarea, Label and Command originate from https://github.com/huntabyte/shadcn-svelte/tree/7e463da6dbf4b9cf086ce3e7d845650bc2a1163b/docs/src/lib/registry/ui
(MIT; see LICENSE.md). Select, RadioGroup, Checkbox, Card, Badge, NativeSelect and Dialog follow
the same composition/API pattern with Last Layer's existing CSS and semantics.
`components.json` configures the registry and aliases. Review generated changes when
adding components; do not overwrite the app's responsive styling with registry defaults.

The shared components keep functional behavior in primitives and app actions in
`main.js`, supplied through Svelte context. Existing classes preserve both themes and
44px targets. Tailwind utilities are available without a global preflight reset.
Input, Textarea and Label also have shared field styles in `shadcn.css`, so
standalone account/profile fields retain the same theme tokens, 44px targets and
16px editable text as cube forms. The Input file variant keeps its native layout.

Dialog Content deliberately uses Bits UI's `child` snippet to render a native dialog:
this preserves the browser top layer, inert background and backdrop. Bits UI traps
focus; main.js opens the dialog, handles closing and restores the originating control.
Select content stays inside that dialog rather than portalling outside its top layer.
Cube geometry, sticker SVGs and timed animation remain specialised local renderers.

Command uses upstream Root, List, Empty and Item wrappers. Its Input keeps the Bits UI
combobox and uses the existing bundled search SVG; Item omits the unused checkmark.
List includes the viewport required by Bits UI 2.19 for filtering and ARIA links.
Input accepts an explicit aria-controls target so it references the named listbox,
rather than the generic inner viewport used by that Bits UI version.
The palette composes Command.Root inside our native Dialog adaptation. Selection uses
`aria-activedescendant` while input focus remains available for typing. A custom filter
preserves order-independent word matching, and application actions stay in main.js.

Command appearance follows the [default registry](https://www.shadcn-svelte.com/registry/command.json):
a border-bottom search row, compact items and a 300px scrolling list. Popover/accent
tokens map to the shared surface/ink/highlight colors and typography, so both themes
match the other dialogs. The native dialog host supplies zero padding, a
512px maximum width, a visually hidden title, and the close icon. Global semantic aliases in `theme.css` map the shared surface, ink, and blue tokens
to background/foreground, primary, popover, and accent roles. RadioGroup uses the
same tokens, so theme changes apply consistently to existing and new primitives. Adaptations retain 44px targets,
16px phone input text, viewport bounds, and a subtle keyboard-focus cue.

Theme selection uses the shadcn RadioGroup composition over Bits UI with a 44px
neutral target around each circular indicator. `theme.js` is the single preference
source, exposing external storage updates through Svelte 5 `createSubscriber`;
Svelte owns the radios rather than a document-wide checked-state mutation. The
subscriber tears down when no mounted control reads it. App context forwards the
explicit setter; system appearance changes and cross-tab storage changes keep
working while Settings is mounted or closed.

Backup file selection uses the shared Input file variant. Cube playback keeps its
native range input because the specialized player owns continuous scrubbing,
keyboard input, and animation updates; ordinary form fields use shared primitives.

Button variants use `tailwind-variants/lite`: their semantic class names need no
intermediate Tailwind merge. The shared `cn()` still merges the resulting classes
with caller overrides once. This avoids shipping the second merge implementation
embedded in the full variants entry point (139.65 → 136.21 kB gzip JS in the
same production build), without changing the variant API or build budgets.

Chart Container, Style and context are adapted from the official
[chart registry](https://www.shadcn-svelte.com/registry/chart.json) (MIT), retrieved
2026-10-17. The container retains the upstream config/context and scoped series
variables; its responsive CSS replaces LayerChart-specific selectors. The dark
selector follows our existing `data-theme` attribute. Legend is a local extension
reading the same config, with wrapping labels and dashed-series indicators.
Timeline and histogram use these primitives and shared `--chart-*` tokens.
Their SVG geometry deliberately remains local to preserve DNF gaps/markers,
representative sampling, keyboard solve links and dialog focus restoration.
LayerChart and its tooltip are not installed; native SVG titles and the selected
solve panel remain available. The compact activity heatmap and cube case map are
specialized controls, not LayerChart plots.
