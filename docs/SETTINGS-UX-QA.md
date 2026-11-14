# PR #35 — Settings redesign evidence

Status: WOLFY approved the design proposal. Implementation is ready for human UX acceptance; **not merged and not visually accepted in Kitty**.

## Design and scope

Replace the permanent sidebar and combined configuration list with a centered workspace (maximum 88 columns), Appearance/General tabs, and a focused Colors subview. Appearance has a miniature Wolf Den cockpit: project radar, selection, Next action banner, independent Git/GitHub summary, and a compact PR row. The preview is labeled SAMPLE and uses fixed fictional content. Compact mode retains project identity, Next action and Git/GitHub summary; it omits the miniature radar and PR row, not any Settings controls.

Colors groups all 18 semantic tokens into Surfaces, Selection & focus, Text, Identity & structure, and Status. Rows use readable labels, framed swatches, resolved hex values and textual custom markers. Actions and feedback remain outside the scrolling body. Save/Cancel apply to the shared draft; confirmed Reset changes appearance only and needs Save. General contains the existing terminal preference. No dependencies, persistence contract changes, project management or new presets.

The Settings renderable tree is separate from the dashboard tree. Both share the existing theme/session; dashboard navigation state stays intact. Retained BoxRenderable groups own layout, preview, palette rows and action controls. The existing persistence, validation, cancel, reset and conflict behavior stays in SettingsSession. A renderer factory argument lets interaction tests exercise the real app key routing with OpenTUI's test renderer.

## Comparable before/after captures

**These are headless OpenTUI render captures, rasterized from the actual renderer's captured spans and colors. They are not Kitty screenshots, PTY screenshots, or hand-drawn UI mockups.** Each comparison contains the complete BEFORE frame above the complete AFTER frame at the same cell dimensions. Source Code Pro is used for rasterization; actual Kitty font, glyph and contrast behavior still needs owner review.

Baseline: `babfa79` (the existing feature branch after development was merged). Both versions use the same temporary version-1 registry: terminal `kitty`, no color overrides, no projects, Settings open with the preset focused. The preview itself supplies labeled sample cockpit content. No personal registry, private project names or private paths were captured.

| Cells | Before/after |
| --- | --- |
| 120×32 | [Comparison](settings-ux/comparison-120x32.png) |
| 100×25 | [Comparison](settings-ux/comparison-100x25.png) |
| 80×24 | [Comparison](settings-ux/comparison-80x24.png) |
| 56×22 | [Comparison](settings-ux/comparison-56x22.png) |
| 42×18 | [Comparison](settings-ux/comparison-42x18.png) |

Additional revised captures: [Colors 120×32](settings-ux/colors-120x32.png), [Colors 42×18](settings-ux/colors-42x18.png), [last color focused at 42×18](settings-ux/colors-end-42x18.png), [General 42×18](settings-ux/general-42x18.png).

Capture method: build the app, create an `@opentui/core/testing` renderer at the specified dimensions, pass its renderer to `runDashboard` with a temporary registry, send `s` using mock input, wait for the registry snapshot, then capture the character frame and `captureSpans()`. For Colors send Down/Enter; send Down 17 times for the last token. Return with Esc before selecting General. Baseline used the same method with the pre-redesign compiled UI and session. PNGs retain the captured foreground/background values and cell positions; labels outside each frame identify the capture type and dimensions.

## Automated and terminal verification

- `pnpm typecheck` — passed.
- `pnpm test` — passed, all 10 test files.
- `pnpm build` — passed. (`pnpm test` also builds.)
- `git diff --check` — passed.
- Rendered app interaction tests cover separate sections at all five sizes; every focused color visible at 42×18; resize to 120×32 and back with the last token selected; swatch color preview; invalid/incomplete input; cancellation restoring the previous color; Save; Reset confirmation; unsaved indicators; external-edit conflict and confirmed Reload; discard confirmation; Help scrolling; below-minimum recovery; and retaining the selected project's dashboard frame on return.
- Existing session/persistence tests retain failure-path coverage, including failed writes, no-write previews/cancel, terminal choices, preserving project records and explicit settings, atomic writes, and external-edit conflict detection.
- Actual PTY smoke checks ran at **120×32, 100×25, 80×24, 56×22 and 42×18** with temporary registries. At every size: opened Settings; entered Colors; edited Background to `#123456`; verified no registry write before Save; saved and checked the persisted override; returned to Appearance, then cockpit; quit. Every process exited 0 and restored terminal echo/canonical input flags. Raw PTY output was inspected for successful screen transitions; geometry and visual comparison use the separately identified headless renderer captures.
- **Real Kitty testing unavailable:** isolated launch attempts failed with `X11: Failed to open display :0` and `Wayland: Failed to connect to display`. No claim of actual Kitty rendering, GUI interaction or owner acceptance.

## Visual self-review

Headless captures support improved hierarchy, composition, bounded proportions, alignment, density, grouped labels, explicit status/focus markers and compact reachability. The normal preview now resembles the cockpit instead of a palette legend. At 42×18, the preview simplifies deliberately while all controls remain reachable and the action/keyboard rows stay visible. Long feedback wraps and borrows body space; exceptionally long diagnostics indicate truncation with an ellipsis. The error recovery actions remain available.

Target-terminal contrast, font/glyph appearance and the owner's judgment of polish remain **unverified**. This self-review is not UX acceptance.

## Human gate and merge risk

Owner: review the same five sizes in real Kitty, especially 42×18; check Appearance/General navigation, Colors scrolling/editing, focus, Save/Cancel/Reset, conflicts, and returning to the prior cockpit context. Approve or request visual corrections on PR #35. Do not merge without explicit approval.

This is a reversible Settings presentation/navigation change. The blast radius is Settings, theme preview and return to the cockpit. There is no schema migration or persistence-service change; saved settings retain the existing version-1 format.
