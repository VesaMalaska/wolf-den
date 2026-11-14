# PR #35 — Settings redesign evidence

Status: WOLFY rejected the centered layout after real Kitty testing and requested this full-size visual refinement. **UX approval remains pending; PR #35 is unmerged.** The adjustment was described in the PR discussion before implementation.

## Design and scope

Settings fills the available terminal width and height with ordinary edge padding and the cockpit background. The centered card and 88-column cap are removed. The existing Appearance/General tabs and focused Colors subview are retained. Bold semantic headings, blank space between groups, separated actions/feedback/hints, and responsive section spacing strengthen top-to-bottom scanning. Appearance has a miniature Wolf Den cockpit: project radar, selection, Next action banner, independent Git/GitHub summary, and a compact PR row. The preview is labeled SAMPLE and uses fixed fictional content. Compact mode retains project identity, Next action and Git/GitHub summary; it omits the miniature radar and PR row, not any Settings controls.

Colors retains all 18 semantic tokens in Surfaces, Selection & focus, Text, Identity & structure, and Status. Group headings align on the same left edge, use bold heading color, and gain blank space between groups when height permits. Values stay near their labels instead of drifting to the right edge. Group titles are kept with at least one color row rather than orphaned above the footer. Rows use readable labels, framed swatches, resolved hex values and textual custom markers. Actions and feedback remain outside the scrolling body. Save/Cancel apply to the shared draft; confirmed Reset changes appearance only and needs Save. General contains the existing terminal preference. No dependencies, persistence contract changes, project management or new presets.

The Settings renderable tree is separate from the dashboard tree. Both share the existing theme/session; dashboard navigation state stays intact. Retained BoxRenderable groups own layout, preview, palette rows and action controls. The existing persistence, validation, cancel, reset and conflict behavior stays in SettingsSession. A renderer factory argument lets interaction tests exercise the real app key routing with OpenTUI's test renderer.

## Comparable before/after captures

**These are headless OpenTUI render captures, rasterized from the actual renderer's captured spans and colors. They are not Kitty screenshots, PTY screenshots, or hand-drawn UI mockups.** Each comparison contains the complete BEFORE frame above the complete AFTER frame at the same cell dimensions. Source Code Pro is used for rasterization; actual Kitty font, glyph and contrast behavior still needs owner review.

Baseline: `973b409` (the previous PR #35 revision that received the latest human Kitty feedback). These comparisons show the full-size refinement against the centered layout. Both versions use the same temporary version-1 registry: terminal `kitty`, no color overrides, no projects, Settings open with the preset focused. The preview itself supplies labeled sample cockpit content. No personal registry, private project names or private paths were captured.

| Cells | Before/after |
| --- | --- |
| 120×32 | [Comparison](settings-ux/comparison-120x32.png) |
| 100×25 | [Comparison](settings-ux/comparison-100x25.png) |
| 80×24 | [Comparison](settings-ux/comparison-80x24.png) |
| 56×22 | [Comparison](settings-ux/comparison-56x22.png) |
| 42×18 | [Comparison](settings-ux/comparison-42x18.png) |

Colors comparisons: [120×32](settings-ux/colors-comparison-120x32.png), [42×18](settings-ux/colors-comparison-42x18.png).

Additional revised captures: [Colors 120×32](settings-ux/colors-120x32.png), [Colors 42×18](settings-ux/colors-42x18.png), [last color focused at 42×18](settings-ux/colors-end-42x18.png), [General 42×18](settings-ux/general-42x18.png).

Capture method: build the app, create an `@opentui/core/testing` renderer at the specified dimensions, pass its renderer to `runDashboard` with a temporary registry, send `s` using mock input, wait for the registry snapshot, then capture the character frame and `captureSpans()`. For Colors send Down/Enter; send Down 17 times for the last token. Return with Esc before selecting General. Baseline used the same method before this refinement, with the previous compiled Settings view. PNGs retain the captured foreground/background values and cell positions; labels outside each frame identify the capture type and dimensions.

## Automated and terminal verification

- `pnpm typecheck` — passed.
- `pnpm test` — passed, all 10 test files.
- `pnpm build` — passed. (`pnpm test` also builds.)
- `git diff --check` — passed.
- Rendered app interaction tests cover separate sections at all five sizes; every focused color visible at 42×18; resize to 120×32 and back with the last token selected; swatch color preview; invalid/incomplete input; cancellation restoring the previous color; Save; Reset confirmation; unsaved indicators; external-edit conflict and confirmed Reload; discard confirmation; Help scrolling; below-minimum recovery; and retaining the selected project's dashboard frame on return.
- Existing session/persistence tests retain failure-path coverage, including failed writes, no-write previews/cancel, terminal choices, preserving project records and explicit settings, atomic writes, and external-edit conflict detection.
- Actual PTY smoke checks ran at **120×32, 100×25, 80×24, 56×22 and 42×18** with temporary registries. At every size: opened Settings; entered Colors; edited Background to `#123456`; verified no registry write before Save; saved and checked the persisted override; returned to Appearance, then cockpit; quit. Every process exited 0 and restored terminal echo/canonical input flags. Raw PTY output was inspected for successful screen transitions; geometry and visual comparison use the separately identified headless renderer captures.
- **This refinement was not tested in real Kitty by the agent.** Earlier isolated launch attempts in this environment failed with `X11: Failed to open display :0` and `Wayland: Failed to connect to display`. The owner supplied real Kitty feedback on the previous revision; that does not establish acceptance of this revision.

## Visual self-review

The visual self-review is against `973b409`, not the original raw configuration list. The structure and behavior from that revision remain in place. Optional gaps reduce at 42×18; the view continues to use the full terminal, with stronger headings and no floating card. Long feedback still wraps and borrows body space; exceptionally long diagnostics indicate truncation with an ellipsis while recovery actions remain available.

| Criterion | Headless review |
| --- | --- |
| Hierarchy | Pass: bold page, tab and section headings distinguish controls from supporting text. |
| Composition | Pass: full terminal surface, aligned sections, preview, actions and footer. |
| Proportion | Pass: capped card removed; preview and focus use available width. |
| Alignment | Pass: Colors group headings align; values stay near labels. |
| Density | Pass: extra section/group gaps at normal sizes; optional gaps reduce at minimum size. |
| Contrast | Unverified in Kitty; captured semantic foreground/background colors inspected. |
| Data honesty | Pass: cockpit preview explicitly labeled SAMPLE; settings remain a draft until Save. |
| Responsiveness | Pass in headless/PTY checks at all five required sizes. |
| Accessibility | Pass for exercised keyboard navigation and textual focus/status; actual Kitty glyph appearance remains unverified. |
| Distinctiveness | Pending WOLFY judgment: full-size presentation uses the existing Deep Forest palette and cockpit hierarchy. |

This self-review and green tests do not grant UX acceptance.

## Human gate and merge risk

Owner: review the same five sizes in real Kitty, especially 42×18; check Appearance/General navigation, Colors scrolling/editing, focus, Save/Cancel/Reset, conflicts, and returning to the prior cockpit context. Approve or request visual corrections on PR #35. Do not merge without explicit approval.

This refinement is a reversible Settings rendering/layout change. Navigation and SettingsSession validation/persistence logic are unchanged. The blast radius is Settings geometry, preview, palette scrolling and help/footer layout. There is no schema migration or persistence-service change; saved settings retain the existing version-1 format.
