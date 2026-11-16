# Issue #27 — Settings Project Manager verification

**Design approved by WOLFY in the owner conversation. Implementation awaits WOLFY UX approval.**

The implementation adds Projects to the approved full-size Settings UI. Add/Edit applies to the shared Settings draft; Save persists Appearance, Projects and General together. Remove from Den starts on Cancel, explicitly protects files/Git/GitHub, and stages registration removal only after selecting Remove from draft. Settings Cancel and confirmed Reload retain their established roles. No schema migration, new dependency, project discovery or Issue #28 cockpit editor.

## Responsibilities and behavior

- `ProjectRegistrations` owns copied entries, generated unique IDs, form/field cancellation, schema-based validation and removal staging. It has no OpenTUI or filesystem dependency. Existing IDs, custom lifecycle text, project order, optional data and configured path spelling survive edits.
- `SettingsSession` owns the shared draft, directory warnings, busy state and existing atomic/conflict-aware persistence. Missing/non-Git paths remain registerable. Apply does not write; only Save calls persistence. A failed write/conflict keeps the draft; canceled/failed Reload preserves it.
- `ProjectSettingsView` uses retained Box/Text groups and native InputRenderable editors. Normal forms group optional repository/lifecycle side by side; compact forms scroll whole field groups. Actions and feedback remain outside the body viewport. Long removal identities scroll independently with PgUp/PgDn while the safety explanation remains visible.
- The cockpit resolves selected project IDs after successful Save/Reload, retains unaffected provider/PR context, resets PR selection when its project/source disappears, and ignores obsolete provider callbacks. Temporary test providers exercise a removal during initial loading and a repository change with selected PR context.

Keyboard: Enter a registration to edit; Add creates a new form. Enter edits/accepts a field; Tab/Shift+Tab accepts valid input and moves between fields/actions. Ctrl+A selects field text; cursor movement, Delete/Backspace and bracketed paste use the native editor. Esc cancels the active field, then backs out; changed forms confirm their own discard. Tab from an overview row reaches Save; Shift+Tab reaches Remove without changing the selected registration. Removal still needs explicit confirmation and a later Save.

## Actual OpenTUI render captures

**These PNGs rasterize actual headless OpenTUI captured spans, colors and attributes. They are not wireframes, PTY screenshots or real Kitty screenshots.** Native terminal cursors are not part of the span rasterization. Source Code Pro is used for these artifacts; terminal font/cursor rendering still needs human Kitty review.

Comparable baseline: `f014b25` (merged full-size Settings). The later `8350939` base adds only the approved design document. Before/after Appearance captures use the same three fictional registrations, terminal preference `kitty`, no overrides and identical dimensions. The miniature cockpit is the existing labeled SAMPLE fixture. New screen captures use Atlas, Beacon and Cedar with `~/demo/...` paths and “Review the next task”; no personal registry or private project data was captured. Empty captures follow staged removal of all three entries, so Unsaved is intentional.

| State | 120×32 | 42×18 |
| --- | --- | --- |
| Existing Settings before/after | [Comparison](project-manager-design/captures/settings-comparison-120x32.png) | [Comparison](project-manager-design/captures/settings-comparison-42x18.png) |
| Projects overview | [Render](project-manager-design/captures/overview-120x32.png) | [Render](project-manager-design/captures/overview-42x18.png) |
| Edit, path focused | [Render](project-manager-design/captures/form-120x32.png) | [Render](project-manager-design/captures/form-42x18.png) |
| Edit, Next Action focused | [Render](project-manager-design/captures/form-end-120x32.png) | [Render](project-manager-design/captures/form-end-42x18.png) |
| Add form | [Render](project-manager-design/captures/add-120x32.png) | [Render](project-manager-design/captures/add-42x18.png) |
| Removal confirmation | [Render](project-manager-design/captures/remove-120x32.png) | [Render](project-manager-design/captures/remove-42x18.png) |
| Empty registration list | [Render](project-manager-design/captures/empty-120x32.png) | [Render](project-manager-design/captures/empty-42x18.png) |

Intermediate overview captures: [100×25](project-manager-design/captures/overview-100x25.png), [80×24](project-manager-design/captures/overview-80x24.png), [56×22](project-manager-design/captures/overview-56x22.png).

Visual self-review: hierarchy, grouping, alignment, density, data honesty, keyboard focus and all five target geometries pass the agent's headless review. Appearance retains its approved structure; Projects uses the same background, headings, spacing and semantic colors. Compact optional fields remain accessible and focused list entries stay visible during scrolling/resizing. Long diagnostics are bounded with an ellipsis and available in Help. Real Kitty font/contrast/cursor behavior remains **unverified**. This is not human UX acceptance.

## Automated verification

- `pnpm typecheck` — passed.
- `pnpm test` — passed, all 11 test files. The command includes a build.
- `pnpm build` — passed separately.
- `git diff --check` — passed.

New/extended tests exercise required/optional fields, path/repository errors, ID collisions/Unicode fallback and immutable identity, optional clearing, field/form/Settings cancellation, Apply without writing, shared Save/data preservation, failed replacement, external-edit conflicts, canceled/failed/successful Reload, default-safe removal and removing the final registration. Temporary project files and fake Git metadata remain intact after removal. Existing persistence tests cover validation, atomic staging/replacement and failures.

Actual app key-routing tests cover all five sizes, every focused row through a 12-project list and resizing, optional-field scrolling, Unicode paste/cursor deletion, suspension of editor keys/paste below the minimum size, Save/Cancel, empty-state recovery, rename selection, removal during a pending initial provider request, and preserving/resetting selected PR context across metadata/source changes. Provider failure remains independent of other data. Existing Settings colors, theme rollback, terminal preference, contextual help and prior cockpit-context tests still pass.

The local pnpm executable prints an engine warning identifying its embedded runtime as v26.0.0. `node --version` and `pnpm exec node --version` report v26.13.1; OpenTUI runtime tests and PTY processes ran with `node --experimental-ffi`. All listed commands exited zero.

## Actual PTY checks

At **120×32, 100×25, 80×24, 56×22 and 42×18**, a real PTY running the application against a temporary registry exercised:

1. Open Settings → Projects; edit an existing name while preserving its ID.
2. Reject a relative path; correct it and accept the field.
3. Edit Next Action; Apply and verify registry bytes are unchanged.
4. Save; verify the persisted name, path, ID and Next Action.
5. Open removal confirmation; activate its default Cancel and verify no removal.
6. Explicitly stage and Save removal of both registrations, reaching a usable empty cockpit.
7. Add a project from empty Settings; verify Apply does not write, then Save the generated ID and preserved terminal preference.
8. Return to the cockpit and quit. Each process exited **0**, with **echo and canonical input restored**.

A separate PTY check entered the native name editor at 42×18, resized to 30×12, then exited with Ctrl+C: exit 0 and echo/canonical input restored.

These PTY checks are separate from the PNG captures. Temporary ANSI recordings were inspected locally; they are not presented as Kitty evidence. Automated tests additionally cover conflicts, failed writes and resize behavior.

## Real Kitty and review gate

Kitty 0.49.2 was invoked against the temporary QA registry. It could not connect to the Wayland display and exited with `GLFW initialization failed`. **No real Kitty interaction, screenshot or UX acceptance is claimed.**

Self-review against #27 found no remaining blocking code issue. The change is reversible application/UI work with a version-1 registry and no migration. Its blast radius is Settings drafts, registration persistence and cockpit reconciliation; user-initiated Save intentionally changes registrations, so verify Add/Edit/Remove and conflict recovery in Kitty before approval.

**Stop for WOLFY UX approval. PR targets development and remains unmerged. Do not start #28.**
