# Wolf Den Roadmap

**Status:** v0.1 implementation merged; real desktop QA pending before the v0.1 release tag. **Next planned milestone:** v0.2 usability and interface redesign, based on first Kitty hands-on testing (2026-11-06).

## Product goal
Make it easier to understand project state, identify attention items, and resume development across several independent repositories. Wolf Den is a hybrid: informative dashboard plus a handful of safe quick actions.

## Sources of truth
| Data | Authority |
| --- | --- |
| Project ID, label, directory, lifecycle, next action | Local JSON registry |
| Branch and working-tree changes | Local Git |
| Issues, PRs, review/check data where available | GitHub via `gh` |
| Detailed development plan | Existing project docs, outside Wolf Den |

The v0.1 next action is manual, **never inferred from a PR**. GitHub statistics are informational and may be stale if refresh fails.

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
      "id": "twinkledoo",
      "name": "TwinkleDoo",
      "path": "~/projects/twinkledoo",
      "repository": "VesaMalaska/twinkledoo",
      "lifecycle": "active",
      "nextAction": "Review Slice 4 PR"
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
- `o`: open new terminal in directory (never attempt to mutate parent shell cwd)
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

## v0.2 — Usability and interface redesign (approved direction; implementation pending review)
First actual use in Kitty confirmed that VS Code (`e`) and repository browser (`g`) launch the correct targets. Local Git and GitHub data are useful, but the current vertical text layout wastes wide-screen space, repeats status/details, and offers little visual hierarchy. The immediate priority is **workflow usability, not new data integrations**.

### Design direction
- **Wide terminals:** two distinct panels: compact multi-project navigator (left) and selected-project details (right).
- **Narrow terminals:** a designed compact mode, preserving navigation, clear selection, help/quit and necessary project information.
- **Navigator:** short project rows and at-a-glance Git/remote signals; selection remains visible while navigating longer lists.
- **Details:** clear sections for local Git, GitHub/PRs, manual next action and relevant quick actions. Keep PR selection and scrolling usable.
- **Status and shortcuts:** a stable feedback region/footer that does not push content around or display contradictory messages.
- **New quick action:** `f` opens the selected project's directory in the desktop file manager via validated path and `xdg-open` (not Nautilus-specific).
- **Interaction:** preserve existing `↑/↓`, `Tab`, `PgUp/PgDn`, `e`, `o`, `g`, `p`, `r`, `?`, and `q` conventions. Avoid unnecessary focus modes and added dependencies.

**Open UX decision:** whether navigator rows should be maximally compact or show more per-project context. Validate with multiple actual projects and narrow Kitty windows; do not lock this down prematurely.

### v0.2 implementation issues (review individually)
1. [#9 — Responsive two-panel layout](https://github.com/VesaMalaska/wolf-den/issues/9) — establish wide/compact presentation and layout foundations.
2. [#10 — Multi-project navigator UX](https://github.com/VesaMalaska/wolf-den/issues/10) — visible selection, scrolling, information density and navigation.
3. [#11 — Selected-project details and feedback](https://github.com/VesaMalaska/wolf-den/issues/11) — meaningful information hierarchy, PR views and consistent status.
4. [#12 — File-manager quick action](https://github.com/VesaMalaska/wolf-den/issues/12) — safe `f` launch; may be implemented independently.
5. [#13 — Real Kitty QA and release gate](https://github.com/VesaMalaska/wolf-den/issues/13) — verify desktop behavior and multi-project usability before release.

### Milestone boundaries
- Preserve the v0.1 read-only providers and safe launch architecture; no project mutations, AI/orchestration, daemon, database or auto-discovery.
- Implement as focused, reviewable PRs; require human approval before merging.
- **v0.1 release gate remains separate:** actual Kitty rendering and graphical quick-action verification still need human sign-off before tagging `v0.1.0`. The v0.2 plan does not imply v0.1 is released.
- Do not tag v0.2 before visual/manual QA and explicit human approval.

## Later candidates (not approved for implementation)
'Where Was I?' resume summary, recent commits, filters/search, cross-repo review queue, optional doc extraction and project discovery. Later ideas: Codex integration, session handovers and notifications. Add only to solve observed needs.

## Success condition
Launching `wolf-den` gives the developer a dependable local overview and a direct path back to the next task, without opening every repo or maintaining duplicate task records.
