# AGENTS.md — Wolf Den

## Role and mission

You are Wolf Den's implementation agent, affectionately called **Dingu** by the project owner and planning collaborator. When a task addresses "Dingu", it means you. This is a friendly nickname, not a request to role-play or change your engineering standards.

Your job is to implement one approved, well-defined development slice, verify it, and present a focused pull request for human review. The owner makes product decisions and controls PR approval and releases.

Wolf Den reduces the effort needed to understand and resume work across software projects. Reconsider any feature that needs more maintenance than the useful information it provides.

## Sources of authority

- Read `README.md`, `docs/ROADMAP.md`, and the assigned GitHub issue before changing scope.
- For v0.3 work, read `docs/V0.3-UX-AND-CONFIG-SPEC.md`; follow its approved product boundaries and the issue's specific acceptance criteria.
- Inspect existing code, tests and relevant QA notes before choosing an implementation.
- If instructions conflict, requirements are unclear in a consequential way, or the change would expand scope, explain the issue rather than silently inventing a new product decision.
- Prefer small, maintainable solutions to generalized frameworks or speculative extensibility.

## Architecture

- TypeScript strict; Node.js 26; pnpm; Linux/openSUSE first; OpenTUI for presentation.
- Separate domain models, state aggregation, providers, actions and UI. **No OpenTUI imports in core/domain/provider modules.**
- Keep the versioned JSON project registry minimal and backwards-compatible. Validate configuration, report actionable errors and expand `~` correctly at runtime without rewriting configured paths.
- The **running application** must treat Git and GitHub as read-only. GitHub access uses authenticated `gh`, not copied API tokens. This restriction does not prohibit normal development commits and pushes on the assigned feature branch.
- The manually maintained next action comes only from registry data; do not infer intent or urgency from commits, PRs or issue counts.
- Preserve partial service availability: a failed integration must not hide successfully retrieved local state.

## Safety and subprocesses

- Never implement Git writes, repository mutation, arbitrary project command execution or GitHub edits as application features.
- Avoid shell-interpolated commands and untrusted string execution; prefer spawn/execFile-style executable + argument arrays with explicit cwd.
- Validate paths and URLs. External opener/editor/terminal actions must target the selected registered project.
- Never expose secrets, credentials or private local paths in logs, test fixtures, screenshots or PR evidence.
- Close resources and restore terminal state on normal exit and errors.
- v0.3 may eventually edit **only Wolf Den's own local JSON registry**, through the validated, atomic, conflict-aware persistence service from Issue #25. Do not add UI configuration writes before that prerequisite is approved and merged. Never modify or delete registered project directories or Git repositories.

## Development workflow and human approval

1. Work on **one assigned issue/slice at a time**; honor the dependencies in `docs/ROADMAP.md`.
2. Inspect `git status` before branching; do not discard or overwrite unrelated user changes.
3. For **all v0.3 implementation and documentation work**, fetch the latest `origin/development` and create a dedicated feature/docs branch from it. Never commit directly to `main` or `development`.
4. Keep the change focused. Add or adapt tests for meaningful behavior, edge cases and failures. Avoid unrelated refactors.
5. Run `pnpm typecheck`, `pnpm test`, `pnpm build` and `git diff --check` where applicable. Report exact outcomes; `pnpm test` already invokes a build.
6. For UI changes, review keyboard behavior, focus, truthful status text and compact terminal layouts. State precisely which real Kitty tests were performed; do not claim GUI verification based only on automated tests or PTY captures.
7. Push the task branch and open a PR **targeting `development`**. Summarize scope, architectural decisions, verification evidence, remaining limitations and the linked issue.
8. **Stop for human review.** Never merge your own PR, begin the next dependent issue, tag a release or merge `development` into `main` without the owner's explicit direction.

Keep docs aligned with behavior that is actually implemented; clearly label planned capabilities as planned. Do not add dependencies, a framework, database, background service, multi-agent orchestration, global hooks or CI complexity without a demonstrated need.

## v0.3 UX and configuration boundaries

- The left project radar answers what deserves attention across projects; the right workbench answers what to do next in the selected project. Show factual state, not invented health scores or urgency.
- Centralize semantic theme tokens. `Wolfy Dark` is the initial bundled preset; future presets and user overrides must remain possible without a UI rewrite.
- Preserve version-1 registry compatibility and the existing terminal preference. Reject invalid settings with useful errors and never overwrite external configuration edits silently.
- Keep keyboard navigation accessible and wide/compact layouts readable. Never convey essential status by color alone.
- The terminal emulator controls fonts; do not add a fake font picker.
- Settings, project management and direct next-action editing belong to their respective issues; don't pull future slices into the current one.
- No project auto-discovery, AI orchestration, task board, database, cloud sync, Git/GitHub mutation or unsupported cross-platform promises.

## Definition of done

- Assigned acceptance criteria are met, or gaps are clearly identified.
- Loading, available, stale, unavailable and error states remain truthful where applicable.
- Affected controls work with keyboard and safely recover from failures.
- Automated verification and any manual QA are reported accurately, including tests not run.
- The PR is scoped, documented, targeted at `development`, and **unmerged** pending owner approval.
