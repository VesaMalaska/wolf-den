# Wolf Den 🐺

Local-first project mission control for independent developers.

Wolf Den answers three questions:
1. Where are my projects right now?
2. What needs my attention?
3. Where did I leave off, and what should I do next?

## Status
**Slice 1 implemented.** Local registry and Git dashboard are available. GitHub and quick actions belong to later slices.

## Setup

Requires Linux, Git, pnpm 11, and Node.js 26.4 or later. OpenTUI requires ESM and Node's `--experimental-ffi` flag; the launcher and `pnpm start` supply the flag. See [OpenTUI runtime support](https://opentui.com/docs/getting-started/runtime-support/).

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
      "lifecycle": "active",
      "nextAction": "Review the next task"
    }
  ]
}
```

`repository` is optional and unused in Slice 1. Paths must be absolute or start with `~/`. The dashboard uses `↑` and `↓` to select a project and `q`, `Esc`, or `Ctrl+C` to exit. A missing registry, invalid JSON, missing directory, non-Git directory, or missing Git CLI appears as an informational state.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` for verification. After building, `bin/wolf-den.mjs` is also a launcher for the CLI.

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
