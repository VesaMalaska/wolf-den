# Wolf Den 🐺

Local-first project mission control for independent developers.

Wolf Den answers three questions:
1. Where are my projects right now?
2. What needs my attention?
3. Where did I leave off, and what should I do next?

## Status
**v0.2.0 released.** The responsive dashboard, multi-project navigator, selected-project details and safe quick actions have passed human acceptance in Kitty on openSUSE Tumbleweed. See the [v0.2.0 GitHub release](https://github.com/VesaMalaska/wolf-den/releases/tag/v0.2.0) and [QA report](docs/V0.2-RELEASE-QA.md).

## Roadmap — planned v0.3

The next milestone will improve the cockpit's information hierarchy and project overview, introduce a customizable **Wolfy Dark** semantic color theme, add an in-app Settings view, and provide safe Add/Remove Project and direct Next Action editing. These features are **planned, not included in v0.2.0**. See the [v0.3 UX and configuration specification](docs/V0.3-UX-AND-CONFIG-SPEC.md) and [roadmap](docs/ROADMAP.md).

## Open source and portfolio

Wolf Den is a local-first, read-only terminal dashboard built with TypeScript, Node.js and OpenTUI. It combines local Git status, optional GitHub activity and keyboard-driven project shortcuts. See [LICENSE](LICENSE) for the MIT license.

Your own project registry lives at `~/.config/wolf-den/projects.json`, outside the cloned repository. Never commit personal registries, authentication data or screenshots containing private project information. Wolf Den uses `gh` for authenticated GitHub access; no API tokens should be placed in the configuration file.

## Setup

Requires Linux, Git, pnpm 11, and Node.js 26.4 or later with `--experimental-ffi` support. OpenTUI requires ESM and the FFI flag; the launcher and `pnpm start` supply it. Node 26.0 cannot launch the dashboard. See [OpenTUI runtime support](https://opentui.com/docs/getting-started/runtime-support/). A UTF-8 terminal is recommended; the interface is designed for Kitty on openSUSE Tumbleweed and also uses standard terminal escape sequences. Graphical quick actions require a desktop session.

```sh
git clone https://github.com/VesaMalaska/wolf-den.git
cd wolf-den
pnpm install --frozen-lockfile
pnpm build
```

Create the registry directory with `mkdir -p ~/.config/wolf-den`, then save the following as `~/.config/wolf-den/projects.json`. Replace the example path with an existing project directory before launching:

```json
{
  "version": 1,
  "settings": { "terminal": "system" },
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

Run `pnpm start` from the cloned repository, or run `./bin/wolf-den.mjs` after building.

`settings` is optional. Omitting it, or setting `terminal` to `system`, uses the desktop's preferred terminal when supported. To choose a specific terminal, set `"settings": { "terminal": "kitty" }` at the top level. Supported values are `system`, `kitty`, `konsole`, `gnome-terminal`, `xfce4-terminal`, `alacritty`, and `xterm`; an explicit choice must be installed and will not fall back to another application. `repository` is optional. For GitHub data, install and authenticate the GitHub CLI (`gh auth login`), then set `repository` to `owner/name`. Paths must be absolute or start with `~/`. Missing GitHub configuration or CLI, authentication and network failures appear as unavailable; failed refreshes retain the last successful result as stale. Local Git remains visible throughout.

On the v0.3 development branch, optional `settings.theme` (currently `"wolfy-dark"`) and `settings.themeOverrides`, for example `"themeOverrides": { "accent": "#D0A7EA" }`, customize appearance. An omitted theme uses Wolfy Dark; an omitted override map uses the preset unchanged. Overrides accept only the semantic tokens listed in the [v0.3 specification](docs/V0.3-UX-AND-CONFIG-SPEC.md), with `#RRGGBB` values. Unknown themes, tokens, and invalid colors stop startup with a field-specific registry error. This reads the existing version-1 registry without writing defaults or resolved colors.

### Registry persistence service (v0.3 development)

`src/registry-persistence.ts` provides `new RegistryPersistence(path).load()`, `.save(document, expectedRevision)`, and `.initialize(document)`. `load()` returns a persisted version-1 document and an opaque revision. A caller edits a copy of that document and passes the revision to `save()`; success returns a new revision. `initialize()` is the explicit path for creating a registry that does not exist. It refuses to replace an existing file. Settings uses this service; project management and direct Next Action editing remain planned.

The persisted document retains project order, optional fields, `~/` path spelling and only the settings actually configured. `parseConfiguration()` separately supplies runtime defaults and expands project paths. Every save validates the whole document with the registry schema and reports field-specific errors. `RegistryPersistenceError.code` distinguishes `validation`, `conflict`, `missing`, `invalid-target`, `read` and `write`. A conflict means another edit, deletion or replacement occurred: reload, review the latest document, then apply the change again. Malformed JSON or invalid fields require correcting the file before loading; the service will not recreate it from defaults.

Saves create a mode `0600` exclusive temporary file beside the registry, write and sync it, then rename it over the old file. Initialization uses an exclusive hard link from the staged file so another creator cannot be overwritten. The parent directory is synced on a best-effort basis after replacement. A failure before replacement leaves the previous file intact and cleans up the temporary file. The service rejects symbolic links and special files at the target and symbolic links in its parent path. It serializes saves within this process and compares content plus file identity before replacement. Other processes can still race between the final comparison and rename; this is not a cross-process lock or a guarantee against every time-of-check/time-of-use race. Atomic replacement assumes a local filesystem with atomic same-directory rename and hard-link behavior. A failure after replacement cannot roll the save back; reload before retrying. For additional recovery from manual edits or storage failure, keep your own backup of `projects.json` outside the repository.

### Settings (v0.3 development)

Press `s` in the cockpit to open Settings. `↑`/`↓` move through the preset, 18 semantic colors, terminal preference, Save, Reset, Cancel and Reload; `←` jumps to Appearance and `→` to General. `PgUp`/`PgDn` move five controls. Focus has a `▌` marker. `?` shows Settings help. `Esc` returns to the cockpit when the draft is clean; with unsaved changes it asks for Enter to discard or Esc to keep editing. The selected project, PR and detail scroll position are retained.

Enter on the preset cycles installed presets; Wolfy Dark is the only current choice. Enter on a color starts a `#RRGGBB` edit; type six hex digits after the shown `#`, use Backspace to correct, Enter to accept and Esc to cancel. Complete valid colors preview immediately without a disk write; incomplete input leaves the last valid preview in place. Typed shortcut letters do not act on the cockpit while editing. Enter on Terminal cycles `system`, `kitty`, `konsole`, `gnome-terminal`, `xfce4-terminal`, `alacritty` and `xterm`. `system` uses the platform's terminal selection behavior.

Enter on Save writes the selected preset, chosen overrides and terminal preference through the conflict-aware registry service. Reset requires a second Enter and previews Wolfy Dark with no overrides; Save is still required to write it. Cancel restores the last saved appearance without writing. Reload requires confirmation and discards the current draft before reading external registry edits. A conflict or failed write keeps the draft and session available. The control list scrolls to keep focus visible. Settings does not manage projects or fonts.

Keyboard controls: `↑`/`↓` select a project; `Tab` selects the next available PR (the first press selects the first PR); `PgUp`/`PgDn` scroll details and help; `s` opens Settings; `e` opens the project in VS Code; `t` opens a terminal in its directory; `f` opens its directory in the default file manager; `g` opens its configured GitHub repository; `p` opens the selected PR; `r` refreshes GitHub information; `?` toggles help; `q`, `Esc`, or `Ctrl+C` quit. PR selection resets when changing projects or refreshing. On the v0.3 development branch, the project radar shows the registered project count and a compact summary of currently loaded local Git states. Clean and dirty counts include only available Git results; loading, stale and unavailable remain separate, and zero counts are omitted. Navigator entries use two lines where space allows: the project name above its Git branch and right-aligned working-tree status. Long branches retain their beginning and end when clipped. The selected entry has a continuous two-line highlight and a `▌` marker beside its name; very short terminals use single-line entries. `GH…`, `GH~`, and `GH!` indicate loading, stale, and unavailable configured GitHub data when there is room. The selected-project panel emphasizes the registry-authored next action in plum and separates local Git, GitHub and pull requests. Each PR uses one row with its number and open/draft label. Selecting a PR expands its review/check details directly beneath its row and scrolls the selected item into view; previous GitHub data is labeled as previous. Loading, stale and unavailable remote data are labeled explicitly. At 88 columns or wider (and at least 8 rows), the project navigator and selected-project details sit side by side. Narrower or shorter terminals stack a bounded project list above the details. The selected project remains visible as whole entries scroll. The status and context-sensitive shortcut rows stay at the bottom; footer hints are shown whole in priority order, and `?` lists every supported command. Actions and refreshes show attributed, color-coded feedback in the stable status row.

Linux quick actions use `code` and `xdg-open` from `PATH`. The `f` shortcut passes the selected project's validated directory to `xdg-open`, which uses the desktop's default file manager. With `terminal: "system"`, `t` first tries `xdg-terminal-exec --dir=<project directory>` using the selected project as its process working directory. The [xdg-terminal-exec proposal](https://github.com/Vladimir-csp/xdg-terminal-exec#syntax) says `--dir` maps to the terminal's directory option or changes directory before launch when that option is absent. Support varies by installed launcher and terminal entry; Wolf Den cannot verify the new window's working directory after the launcher starts. If `xdg-terminal-exec` is not installed, Wolf Den tries `konsole`, `gnome-terminal`, `xfce4-terminal`, `kitty`, `alacritty`, then `xterm`. Explicit terminal overrides launch only the named emulator. All terminal launches use the selected project as the process working directory and each emulator's directory option where supported. A graphical session (`DISPLAY` or `WAYLAND_DISPLAY`) is required. If no supported emulator is installed, Wolf Den reports an error. A successful launch means the external process started; a later failure inside that application may not be visible to Wolf Den. Opening a terminal does not change the parent shell's directory.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` for verification. After building, `bin/wolf-den.mjs` is also a launcher for the CLI.

On spacious v0.3 layouts, the Git-state summary sits at the bottom of the project radar. The selected-project workbench has a divided identity header, a compact plum Next Action banner, side-by-side Local Git and GitHub zones when the detail pane is wide enough, and a bordered PR section. Narrow detail panes stack the status zones and simplify borders; `PgUp`/`PgDn` keeps lower sections accessible.

## Troubleshooting

- **Registry error:** create `~/.config/wolf-den/projects.json` using the example above. JSON must use `version: 1`; project IDs must be unique, paths absolute or `~/` based, and repository values must be `owner/name`. Unknown fields are rejected. A missing project directory remains listed with an unavailable Git state.
- **Git unavailable:** install Git and check that the configured path is an accessible Git working tree. Local Git does not require GitHub or a network connection.
- **GitHub unavailable:** install `gh`, run `gh auth login`, verify access with `gh repo view owner/name`, and retry with `r`. A failed refresh preserves the last successful GitHub result as stale. Malformed `gh` data is reported as invalid rather than shown as a partial count.
- **Launch error:** install `code` or `xdg-open` on `PATH`, or `xdg-terminal-exec` or one of the supported terminal emulators. An explicit terminal override must name an installed emulator. Terminal launch needs `DISPLAY` or `WAYLAND_DISPLAY`. The dashboard reports immediate process launch errors; failures after a graphical app starts may need to be checked in that app.
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
