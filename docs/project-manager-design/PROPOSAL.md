# Issue #27 — Settings Project Manager design proposal

**Proposed. Awaiting WOLFY DESIGN APPROVAL; no UI implementation.**

Branch: `feat/issue-27-settings-project-manager`, created from freshly fetched `origin/development` at `f014b25` (merged PR #35). Reviewed [#27](https://github.com/VesaMalaska/wolf-den/issues/27), dependencies [#25](https://github.com/VesaMalaska/wolf-den/issues/25)/[#26](https://github.com/VesaMalaska/wolf-den/issues/26), AGENTS, README, roadmap/spec, existing Settings captures, session/view/tests and registry validation/persistence. Both prerequisite implementations are integrated.

## Design brief

**Purpose:** see registrations and choose Add, Edit or Remove within two seconds. The project list is the focal region. **Character:** calm, spacious, precise, reassuring.

Preserve approved full-size Settings: Deep Forest background, ordinary edge padding, bold moonlight headings, plum actions, blue focus with a textual `>` marker. Reuse semantic tokens and user overrides. Add Projects between Appearance and General. Keep title/tabs, body, fixed actions, feedback and keyboard hints in their existing order. Use whitespace and alignment rather than more boxes.

Target Kitty/Linux at 120×32, 100×25, 80×24, 56×22 and 42×18. Normal layouts use two-cell horizontal padding; compact uses one. Compact scrolls the body, keeping focused controls visible and actions/feedback/hints fixed. Below minimum retains resize guidance and Back/quit. Required states include populated/empty, Add/Edit, validation, directory warning, confirmation, unsaved/discard, saving/saved, failed write, conflict/reload, help, long/Unicode text and resize.

## Draft and keyboard model

**One shared Settings draft; Settings Save is the only disk write.** Add/Edit uses **Apply to draft** and **Cancel edit**. Apply validates and returns to Projects with Unsaved and “Project updated in draft. Save to keep it.” Settings **Save changes** (compact: Save) saves Appearance + Projects + General together and stays open. Switching sections retains the draft; Reset remains appearance-only and is absent from Projects.

**Remove from Den** opens a dedicated confirmation. Cancel starts focused. Only Enter on **Remove from draft** stages removal; Settings Save makes it permanent. Cancel/Esc preserves the registration. The confirmation always states that project files, Git and GitHub remain untouched. This two-stage behavior follows the existing Colors/Reset model and is explicitly proposed for approval.

Overview: ↑/↓ moves between Add, registrations and Remove; Enter on a registration opens Edit. Initial focus follows the selected project ID, or Add when empty. Tab/Shift+Tab reaches fixed Save/Cancel/Reload actions and returns to the prior body control. PgUp/PgDn traverses long lists; ←/→ selects adjacent Settings sections. No redundant Edit button is needed.

Forms: ↑/↓ moves fields when idle; Enter edits. Tab/Shift+Tab accepts valid field input and advances through fields/actions; Enter accepts the field; Esc restores its pre-edit value. Cursor movement, Backspace/Delete and paste work normally. Typed letters and `?` stay inside the editor. Invalid input remains visible with field feedback and focus; Apply focuses the first invalid field. Help is available outside active text editing.

Esc from an idle changed form confirms discarding that form only, preserving earlier Settings draft changes. Cancel edit does the same; clean forms return immediately. Settings Cancel/Esc from main sections confirms discarding the shared unsaved draft. Confirmation buttons use Tab/Shift+Tab and Enter; no destructive single-key shortcut.

## Wireframes

These are **design wireframes, not OpenTUI renders, PTY captures or Kitty screenshots**. Blocks have the stated dimensions/row counts; blank space is intentional. `>` marks focus, `_` the input cursor, brackets an input surface. All example projects and paths are fictional.

### 1. Projects overview

Normal: two-line entries with generous spacing. Compact: one-line name/lifecycle and the selected path. Remove always names its target; longer lists scroll with focus. Long text uses terminal-cell-aware ellipsis; editing exposes the complete value through horizontal input scrolling.

**Projects overview — 120×32**

```text
  WOLF DEN / SETTINGS                                                                                            Saved

  Appearance     [Projects]     General


  PROJECTS · 3 registered

    Add project >


  > Atlas                                              active
    ~/projects/atlas


    Beacon                                             paused
    ~/projects/beacon


    Cedar                                              active
    ~/projects/cedar


    Remove from Den…  (Atlas)


  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    Save changes     Cancel     Reload

  Enter a project to edit its registration. Changes stay in the draft until Save.

  ↑↓ Move · Enter Open · Tab Actions · ←→ Section · Esc Back · ? Help
```

**Projects overview — 42×18**

```text
 WOLF DEN / SETTINGS                Saved
 Appearance  [Projects]  General

 PROJECTS · 3 registered
   Add project >

 > Atlas                  active
   Beacon                 paused
   Cedar                  active
 ~/projects/atlas
   Remove from Den… (Atlas)

 ────────────────────────────────────────
   Save     Cancel     Reload
 Enter to edit. Save writes the draft.

 ↑↓ Move · Enter Open · Tab Actions
 ←→ Section · Esc Back · ? Help
```

### 2. Add / Edit project

One full-size form; optional repository and lifecycle share a row at normal width and stack in compact. The compact example is the path-edit viewport; Tab reaches every field below.

**Add / Edit project — 120×32**

```text
  PROJECTS / EDIT PROJECT                                                                                      Unsaved

  Esc Back to Projects

  PROJECT DETAILS

    Name *
    [Atlas]

  > Local path *
    [~/projects/atlas_]

  OPTIONAL DETAILS

    GitHub repository                    Lifecycle
    [example/atlas]                      [active]


    Next Action
    [Review the next task]


  Project ID: atlas · fixed when editing


  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    Apply to draft     Cancel edit

  Absolute or ~/ path. Missing/non-Git directories can be registered with a warning.

  Tab Next · Shift+Tab Previous · Enter Accept field · Esc Cancel field · Ctrl+C Quit
```

**Add / Edit project · path viewport — 42×18**

```text
 PROJECTS / EDIT PROJECT
 Esc Back to Projects

 PROJECT DETAILS
   Name *
   [Atlas]

 > Local path *
   [~/projects/atlas_]

 More fields below ↓

 ────────────────────────────────────────
   Apply to draft     Cancel edit
 Absolute or ~/ path.
 Draft only; Save in Projects writes it.
 Tab Next · Shift+Tab Previous
 Enter Accept · Esc Cancel field
```

### 3. Remove confirmation

Identity, consequences, file safety and safe default remain explicit at minimum size.

**Remove confirmation — 120×32**

```text
  PROJECTS / REMOVE FROM DEN

  Esc Back to Projects



  REMOVE ATLAS FROM WOLF DEN?


  Atlas
  ~/projects/atlas



  Only the registration will be removed.

  Project files remain untouched.
  Git and GitHub remain untouched.


  Confirming updates the draft. Save in Projects makes it permanent.




  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  > Cancel     Remove from draft

  Cancel keeps this registration and returns to Projects.

  Tab Choose · Enter Activate · Esc Cancel · ? Help
```

**Remove confirmation — 42×18**

```text
 PROJECTS / REMOVE FROM DEN
 Esc Back to Projects

 REMOVE FROM WOLF DEN?
 Atlas
 ~/projects/atlas

 Only the registration will be removed.
 Project files remain untouched.
 Git and GitHub remain untouched.
 Save in Projects makes this permanent.

 ────────────────────────────────────────
 > Cancel     Remove from draft
 Cancel keeps this registration.

 Tab Choose · Enter Activate
 Esc Cancel · ? Help
```

### 4. Empty project list

A quiet invitation to register the first project. After staged last removal, show Unsaved and “Last removal is in the draft. Save to keep it.”

**Empty project list — 120×32**

```text
  WOLF DEN / SETTINGS                                                                                            Saved

  Appearance     [Projects]     General


  PROJECTS · 0 registered




  YOUR DEN IS READY FOR ITS FIRST PROJECT


  Add a name and a local directory to get started.

  A GitHub repository is optional.


  > Add project >


  Registration only. Your project files remain untouched.



  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

    Save changes     Cancel     Reload

  No projects registered. Add your first project above.

  ↑↓ Move · Enter Open · Tab Actions · ←→ Section · Esc Back · ? Help
```

**Empty project list — 42×18**

```text
 WOLF DEN / SETTINGS                Saved
 Appearance  [Projects]  General

 PROJECTS · 0 registered

 YOUR DEN IS READY
 Add your first project with a name
 and local directory.
 GitHub is optional.

 > Add project >

 ────────────────────────────────────────
   Save     Cancel     Reload
 Your project files remain untouched.

 Enter Add · Tab Actions
 ←→ Section · Esc Back · ? Help
```

## Fields and validation

| Field | Proposed behavior |
| --- | --- |
| Name | Required; reject whitespace-only text. |
| Local path | Required; absolute or `~/`, using current validation (including existing `~` compatibility). Preserve configured spelling; expand only at runtime. |
| GitHub repository | Optional `owner/name`; blank omits it. Syntax validation without network checks. |
| Lifecycle | Free text; Add defaults to `active`. Preserve custom values. Optional to customize, but blank is invalid under the existing v1 schema. |
| Next Action | Optional manual text; blank omits/clears it. Settings form only; direct cockpit editing remains #28. |
| Project ID | Read-only metadata. Generate once on successful Add-to-draft: valid ASCII name slug, fallback `project`, collision suffixes `-2`, `-3`, etc. Validate uniqueness against the draft. Never regenerate on edit/rename. |

Add uses the same form with an Add title, blank fields and default lifecycle. Edit pre-fills existing values. Mark required fields `*`; show corrective field errors on acceptance/Apply, e.g. “Local path: use an absolute or ~/ path.” Preserve unchanged field data.

After valid Apply, reuse existing read-only local inspection for missing/inaccessible/non-directory/non-Git warnings; registration remains allowed. Say Checking directory while pending, then e.g. “Directory unavailable; registration can still be saved.” No discovery, directory creation, Git writes or project command execution; no per-keystroke network/provider calls.

At 42×18, optional fields and ID metadata remain reachable by scrolling. Long confirmation identity text may scroll/wrap while the registration-only explanation and actions remain visible. Concise fixed feedback names the affected field; Help exposes full diagnostics when needed.

## Persistence, recovery and selection

- Reuse `RegistryPersistence.load/save` and revision checks; validate the complete v1 document. Preserve other registrations, order, optional fields, configured paths and terminal/theme settings. Append additions; edits retain position; remove only the matching registration.
- Saving blocks repeated mutations and shows Saving. Commit runtime changes only after successful persistence. Write failure retains draft/input and offers retry/reload guidance; avoid claiming nothing changed after a possible post-replacement failure.
- Conflict: “Registry changed elsewhere. Draft kept. Reload, review, then reapply.” Reload explicitly confirms discarding the shared draft; Cancel or failed Reload keeps it. Never auto-overwrite/merge external edits.
- Successful Save or confirmed Reload reconciles cockpit projects by **ID**, not stale indices. Keep the current ID when adding/editing another registration. If removed, choose the next surviving project in the old order, otherwise the previous; empty means no selection. Settings tracks its own selected ID, including newly added projects.
- Preserve PR/detail context for unaffected selected-project sources. Reset PR/detail context if that project disappears or its path/repository changes; reload affected providers. Ignore late callbacks from obsolete registrations/source targets.
- After last removal, Settings and cockpit remain usable. Cockpit says “No projects registered. Press s to add your first project.” Help/quit stay available; project actions safely do nothing. Missing/malformed registry startup recovery is outside #27.

## Verification after approval

Temporary-registry tests will cover validation, ID collisions/stability, optional clearing, data preservation, Apply versus Save, field/form/Settings cancellation, default-safe removal, last-project removal, failed writes, conflicts, Reload success/failure/cancel, ID selection and stale callbacks. Removal tests assert project files survive and no Git/GitHub writes or project commands run.

Run `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`. Exercise actual OpenTUI keyboard/focus/error/resize behavior at all five sizes. Provide comparable before/after Settings captures, new-state renders, and normal/compact PTY flows; label these separately from real Kitty testing. Open one focused PR targeting development and stop for WOLFY UX approval. No #28, status contract, dependencies or new infrastructure.

**Current evidence:** text wireframe geometry checked. No #27 application tests, OpenTUI renders, PTY flows or real Kitty checks performed; no application/test code changed.

**Await WOLFY DESIGN APPROVAL before implementation.**
