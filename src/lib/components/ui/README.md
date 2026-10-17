# UI primitives

Source-owned shadcn-svelte components, using Svelte 5 and Bits UI. Button, Input,
Textarea, Label and Command originate from https://github.com/huntabyte/shadcn-svelte/tree/7e463da6dbf4b9cf086ce3e7d845650bc2a1163b/docs/src/lib/registry/ui
(MIT; see LICENSE.md). Select, Checkbox, Card, Badge, NativeSelect and Dialog follow
the same composition/API pattern with Last Layer's existing CSS and semantics.
`components.json` configures the registry and aliases. Review generated changes when
adding components; do not overwrite the app's responsive styling with registry defaults.

The shared components keep functional behavior in primitives and app actions in
`main.js`, supplied through Svelte context. Existing classes preserve both themes and
44px targets. Tailwind utilities are available without a global preflight reset.

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
512px maximum width, a visually hidden title, and the close icon. Scoped palette aliases
reuse the site theme without changing other views. Adaptations retain 44px targets,
16px phone input text, viewport bounds, and a subtle keyboard-focus cue.
