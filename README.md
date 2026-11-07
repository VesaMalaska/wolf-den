# Wolf Den 🐺

Local-first project mission control for independent developers.

Wolf Den answers three questions:
1. Where are my projects right now?
2. What needs my attention?
3. Where did I leave off, and what should I do next?

## Status
**v0.1 release candidate.** Local Git, optional GitHub issue/PR information and safe project quick actions are available. See [manual QA](docs/ISSUE-4-QA.md) for verification limits.

## Setup

Requires Linux, Git, pnpm 11, and Node.js 26.4 or later with `--experimental-ffi` support. OpenTUI requires ESM and the FFI flag; the launcher and `pnpm start` supply it. Node 26.0 cannot launch the dashboard. See [OpenTUI runtime support](https://opentui.com/docs/getting-started/runtime-support/). A UTF-8 terminal is recommended; the interface is designed for Kitty on openSUSE Tumbleweed and also uses standard terminal escape sequences. Graphical quick actions require a desktop session.

```sh
pnpm install
pnpm build
pnpm start
```

Create `~/.config/wolf-den/projects.json`:

```json
{
  "version": 1,
  "projects": [
    {
      "id": "example",
      "name": "Example",
      "path": "~/projects/example",
      "repository": "owner/example",
      "lifecycle": "active",
      "nextAction": "Review the next task"
    }
  ]
}
```

`repository` is optional. For GitHub data, install and authenticate the GitHub CLI (`gh auth login`), then set `repository` to `owner/name`. Paths must be absolute or start with `~/`. Missing GitHub configuration or CLI, authentication and network failures appear as unavailable; failed refreshes retain the last successful result as stale. Local Git remains visible throughout.

Keyboard controls: `↑`/`↓` select a project; `Tab` selects the next available PR (the first press selects the first PR); `PgUp`/`PgDn` scroll details and help; `e` opens the project in VS Code; `o` opens a terminal in its directory; `g` opens its configured GitHub repository; `p` opens the selected PR; `r` refreshes GitHub information; `?` toggles help; `q`, `Esc`, or `Ctrl+C` quit. PR selection resets when changing projects or refreshing. Navigator entries use two lines where space allows: the project name above its Git branch and right-aligned working-tree status. The selected entry has a continuous two-line highlight and a `▌` marker beside its name; very short terminals use single-line entries. `GH…`, `GH~`, and `GH!` indicate loading, stale, and unavailable configured GitHub data when there is room. The selected-project panel separates the manual next action, local Git, GitHub and pull requests; a selected PR has a `▌` marker and scrolls into view. Loading, stale and unavailable remote data are labeled explicitly. At 88 columns or wider (and at least 8 rows), the project navigator and selected-project details sit side by side. Narrower or shorter terminals stack a bounded project list above the details. The selected project remains visible as whole entries scroll. The status and shortcut rows stay at the bottom; long lines are clipped with `…`. Actions and refreshes show attributed, color-coded feedback in the stable status row.

Linux quick actions use `code` and `xdg-open` from `PATH`. Terminal launch tries `konsole`, `gnome-terminal`, `xfce4-terminal`, `kitty`, `alacritty`, then `xterm`, using the selected project as the process working directory and each emulator's working-directory option where supported. A graphical session (`DISPLAY` or `WAYLAND_DISPLAY`) is required. If no supported emulator is installed, Wolf Den reports an error. A successful launch means the external process started; a later failure inside that application may not be visible to Wolf Den. Opening a terminal does not change the parent shell's directory.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` for verification. After building, `bin/wolf-den.mjs` is also a launcher for the CLI.

## Troubleshooting

- **Registry error:** create `~/.config/wolf-den/projects.json` using the example above. JSON must use `version: 1`; project IDs must be unique, paths absolute or `~/` based, and repository values must be `owner/name`. Unknown fields are rejected. A missing project directory remains listed with an unavailable Git state.
- **Git unavailable:** install Git and check that the configured path is an accessible Git working tree. Local Git does not require GitHub or a network connection.
- **GitHub unavailable:** install `gh`, run `gh auth login`, verify access with `gh repo view owner/name`, and retry with `r`. A failed refresh preserves the last successful GitHub result as stale. Malformed `gh` data is reported as invalid rather than shown as a partial count.
- **Launch error:** install `code` or `xdg-open` on `PATH`, or one of the supported terminal emulators. Terminal launch needs `DISPLAY` or `WAYLAND_DISPLAY`. The dashboard reports immediate process launch errors; failures after a graphical app starts may need to be checked in that app.
- **Terminal does not start:** check `node --version` and confirm `node --experimental-ffi` is supported. If a terminal session is interrupted outside Wolf Den's handled exit path, use `reset` to restore it.

## Known limitations

GitHub information is fetched on startup and manually with `r`; no background synchronization runs. Counts are limited to fewer than 1,000 open issues and PRs per repository; a result at the limit is unavailable rather than shown as complete. PR selection and opening require fresh available GitHub data. Next action is always manually maintained in the registry. Narrow views clip long lines, including project names and messages; use a wider terminal to read the full text. Graphical launch success means the program started, not that it opened a window successfully.

## MVP
- Read a small local project registry.
- Show local Git status and branch for configured projects.
- Show GitHub issues and pull requests through the authenticated GitHub CLI (`gh`).
- Show a manually maintained next action per project.
- Navigate projects and trigger safe quick actions: launch VS Code, open repository, launch a terminal in the project directory, refresh data.
- Remain useful when offline, GitHub is unavailable, or individual project directories are invalid.

## Principles
- Aggregate existing sources of truth; do not duplicate GitHub issues or replace Git/IDE.
- Small, isolated implementation slices with acceptance criteria and human review.
- Core logic independent of the OpenTUI interface.
- Read-only integrations in v0.1; no merges, Git writes, deletions, arbitrary project command execution, or agents.
- Never show invented percent-complete metrics.
- No persistent database, background daemon, or orchestration framework in v0.1.

## Proposed stack
TypeScript (strict), Node.js 26, pnpm, `@opentui/core`, local Git CLI, GitHub CLI (`gh`), JSON config, Zod. Linux/openSUSE first. Validate actual OpenTUI runtime flags and version at implementation time.

## Planned slices
1. Foundation, project registry, local Git, navigable TUI.
2. GitHub issues/PRs and resilient integration.
3. Safe quick actions and refresh.
4. Usability, robustness, tests and documentation.

See [docs/ROADMAP.md](docs/ROADMAP.md) and [AGENTS.md](AGENTS.md).
