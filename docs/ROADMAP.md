# Wolf Den Roadmap

**Status:** v0.2.0 released following real Kitty acceptance. Implementation issues #9–#12 and release QA issue #13 are complete. See the [v0.2.0 release](https://github.com/VesaMalaska/wolf-den/releases/tag/v0.2.0) and [QA report](V0.2-RELEASE-QA.md).

## Product goal
Make it easier to understand project state, identify attention items, and resume development across several independent repositories. Wolf Den is a hybrid: informative dashboard plus a handful of safe quick actions.

## Sources of truth
| Data | Authority |
| --- | --- |
| Project ID, label, directory, lifecycle, next action | Local JSON registry |
| Branch and working-tree changes | Local Git |
| Issues, PRs, review/check data where available | GitHub via `gh` |
| Detailed development plan | Existing project docs, outside Wolf Den |

The next action is manual, **never inferred from a PR**. GitHub statistics are informational and may be stale if refresh fails.

## Scope — 0.1.0
- Explicitly configured local projects, no filesystem-wide scanning.
- Responsive terminal list + selected-project detail, keyboard navigation.
- Current Git branch and status (clean/dirty, staged/unstaged/untracked when practical).
- GitHub open issues/PR summary and navigable PR links when available.
- Lifecycle status and plain-text next action from registry.
- Manual refresh; clear fetching/stale/unavailable states.
- Quick actions: open folder in new terminal, launch VS Code, open repository/PR URL. No arbitrary shell execution.
- Graceful behavior for missing Git, `gh`, VS Code, network, bad config, non-repo directory and detached HEAD.

### Non-goals
- Project management replacement, issue editing, Git commits/push/pull/merge, PR merging.
- Codex/AI session automation, orchestration, background daemon or notifications.
- SQLite/DB, auto project discovery, cloud synchronization.
- Auth tokens stored in project JSON.
- Progress percentages or AI-generated 'health scores'.
- Cross-platform commitments beyond Linux-first behavior.

## Data model (concept)
```json
{
  "version": 1,
  "projects": [
    {
      "id": "sample-app",
      "name": "Sample App",
      "path": "~/projects/sample-app",
      "repository": "example/sample-app",
      "lifecycle": "active",
      "nextAction": "Review the next task"
    }
  ]
}
```
Configuration defaults to `~/.config/wolf-den/projects.json`. Expand home-directory paths explicitly. Validate JSON; omit `repository` for projects without GitHub. Unknown values must not silently become fabricated state. Never commit real local paths or private project notes as examples.

## Planned UI
Project list, selected-project detail, footer shortcut hints, on-demand help. Wide terminals may use two panes; narrow terminals must remain usable. Per-project load/error indications must not blank the whole screen.

Initial suggested shortcuts:
- `↑/↓`: choose project
- `Enter`: inspect selected project
- `r`: refresh selected project
- `e`: open in VS Code
- `t`: open new terminal in directory (never attempt to mutate parent shell cwd)
- `g`: open repository browser page
- `p`: open selected PR when a PR is selected/available
- `?`: help; `q`: quit

## Implementation slices
### Slice 1 — Foundation and local projects
Build strict TS project/tooling, JSON registry validation, project/domain services, local Git read-only provider and minimal navigable OpenTUI dashboard.
**Acceptance:** launches, lists configured projects; accurate Git state; supports missing/non-Git paths; tests cover parsing and Git result handling. No GitHub dependency required.

### Slice 2 — GitHub integration
Use `gh` for issues and PRs, work with GitHub's authenticated CLI, handle rate limits/offline/auth failures, loading and stale states.
**Acceptance:** data matches `gh` for a test repo; missing `gh` does not break local dashboard; per-project refresh and test coverage for mocked CLI results.

### Slice 3 — Quick actions
Implement safe editor, terminal, browser and refresh actions via explicit subprocess argument arrays and platform-aware adapters.
**Acceptance:** commands target selected project; handle uninstalled programs; tests prevent shell-string interpolation/unsafe execution; no Git mutations.

### Slice 4 — Usability and hardening
Improve keyboard accessibility, small-screen behavior, clean exit/terminal restoration, documentation and regression tests.
**Acceptance:** usable without network; helpful status and errors; no terminal left corrupted after exit; README/setup and keybindings verified.

All slices must be independently reviewable; do not start the next slice before review unless explicitly instructed.

## v0.2 — Usability and interface redesign (released in v0.2.0)
First actual use in Kitty confirmed that VS Code (`e`) and repository browser (`g`) launch the correct targets. Local Git and GitHub data are useful, but the current vertical text layout wastes wide-screen space, repeats status/details, and offers little visual hierarchy. The immediate priority is **workflow usability, not new data integrations**.

### Design direction
- **Wide terminals:** two distinct panels: compact multi-project navigator (left) and selected-project details (right).
- **Narrow terminals:** a designed compact mode, preserving navigation, clear selection, help/quit and necessary project information.
- **Navigator:** short project rows and at-a-glance Git/remote signals; selection remains visible while navigating longer lists.
- **Details:** clear sections for local Git, GitHub/PRs, manual next action and relevant quick actions. Keep PR selection and scrolling usable.
- **Status and shortcuts:** a stable feedback region/footer that does not push content around or display contradictory messages.
- **New quick action:** `f` opens the selected project's directory in the desktop file manager via validated path and `xdg-open` (not Nautilus-specific).
- **Interaction:** preserve existing `↑/↓`, `Tab`, `PgUp/PgDn`, `e`, `t`, `f`, `g`, `p`, `r`, `?`, and `q` conventions. Avoid unnecessary focus modes and added dependencies.

The implemented navigator uses two-line entries when space allows and one-line entries in short terminals. The owner reviewed wide and compact Kitty layouts and confirmed the v0.2.0 release gate.

### v0.2 implementation issues (completed)
1. [#9 — Responsive two-panel layout](https://github.com/VesaMalaska/wolf-den/issues/9) — establish wide/compact presentation and layout foundations.
2. [#10 — Multi-project navigator UX](https://github.com/VesaMalaska/wolf-den/issues/10) — visible selection, scrolling, information density and navigation.
3. [#11 — Selected-project details and feedback](https://github.com/VesaMalaska/wolf-den/issues/11) — meaningful information hierarchy, PR views and consistent status.
4. [#12 — File-manager quick action](https://github.com/VesaMalaska/wolf-den/issues/12) — safe `f` launch; may be implemented independently.
5. [#13 — Real Kitty QA and release gate](https://github.com/VesaMalaska/wolf-den/issues/13) — verify desktop behavior and multi-project usability before release.

### Milestone boundaries
- Preserve the v0.1 read-only providers and safe launch architecture; no project mutations, AI/orchestration, daemon, database or auto-discovery.
- Implement as focused, reviewable PRs; require human approval before merging.
- Any v0.1 release gate is separate from v0.2 acceptance; this roadmap does not imply a v0.1 release was tagged.
- Do not tag v0.2 before visual/manual QA and explicit human approval.

## v0.3 — The Wolf's cockpit and configurable den (approved; implementation pending)

**Goal:** A professional, distinctive developer cockpit that answers both *what needs attention across projects* and *what should I do next in the selected project*. Add editable local configuration without mutating Git or GitHub.

The approved direction and architecture are specified in [v0.3 Cockpit UX, themes and editable configuration](V0.3-UX-AND-CONFIG-SPEC.md). This is planned work, not shipped v0.2 behavior.

### Experience goals
- **Project radar (left):** factual multi-project overview, readable states, aggregate Git signals and optional available GitHub counts. No invented project-health or urgency metric.
- **Selected project (right):** clear identity, highly visible editable manual next action, distinct Git and GitHub zones, and less repetitive PR summaries.
- **PRs and footer:** compact open/draft rows, selected PR detail, useful truncation, contextual keyboard hints and accessible compact modes.
- **Wolf Den identity:** semantic color tokens; a first built-in, customizable *Wolfy Dark* theme (moonlight, plum, forest, amber). Future presets possible without UI rewrites.
- **Settings (`s` proposed):** separate Appearance, Projects, General views; safe preview/save/cancel/reset. Existing terminal preference becomes editable. Terminal font selection is **not supported** by the app.
- **Projects:** add, edit basic metadata, and *Remove from Den* (registry entry only; never delete directories or Git repositories).
- **Next action (`n` proposed):** edit/clear manual next action directly from the dashboard without using JSON editor.

### Architecture and scope rules
- Extend existing version-1 JSON registry with optional theme fields; preserve existing user configs and the read-only Git/GitHub boundary.
- Implement validated, atomic, conflict-aware local configuration writes **before** building any feature that saves settings/projects/next actions.
- Keep Dingu's work small, issue-based and independently reviewable with human PR approval.
- No database, background sync, auto-discovery, AI agent, task manager, arbitrary repository commands or font picker.

### Implementation issues (in review/dependency order)
1. [#22 — Theme foundation and Wolfy Dark](https://github.com/VesaMalaska/wolf-den/issues/22) — semantic tokens, preset, backward-compatible read-only config.
2. [#23 — Cockpit hierarchy and project radar](https://github.com/VesaMalaska/wolf-den/issues/23) — factual multi-project glanceability, next action and status hierarchy; depends on #22.
3. [#24 — Compact PRs and contextual footer](https://github.com/VesaMalaska/wolf-den/issues/24) — draft/open distinctions, selected PR detail and meaningful help; depends on #23.
4. [#25 — Safe registry persistence](https://github.com/VesaMalaska/wolf-den/issues/25) — atomic validated writes, conflict detection and non-destructive saves; depends on #22.
5. [#26 — Settings view](https://github.com/VesaMalaska/wolf-den/issues/26) — Appearance/General, live theme preview/save/reset, terminal setting; depends on #22, #24 and #25.
6. [#27 — Project manager](https://github.com/VesaMalaska/wolf-den/issues/27) — explicit Add/Edit/Remove from Den; depends on #25 and #26.
7. [#28 — Direct next-action editor](https://github.com/VesaMalaska/wolf-den/issues/28) — quick manual edit/clear; depends on #23, #25 and #27.
8. [#29 — Real Kitty QA and v0.3 release gate](https://github.com/VesaMalaska/wolf-den/issues/29) — end-to-end acceptance and safe release readiness; depends on #22–#28.

**Release gate:** accessible keyboard navigation and readable 120×32, 100×25, 80×24, 56×22 and 42×18 displays; verified safe configuration mutations, failure recovery and real Kitty usability. Tag/release only with explicit owner approval.

## Later candidates (not approved for implementation)
'Where Was I?' resume summary, recent commits, filters/search, cross-repo review queue, optional doc extraction and project discovery. Later ideas: Codex integration, session handovers and notifications. Add only to solve observed needs.

## Success condition
Launching `wolf-den` gives the developer a dependable local overview and a direct path back to the next task, without opening every repo or maintaining duplicate task records.
