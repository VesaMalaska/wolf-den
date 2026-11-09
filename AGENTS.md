# AGENTS.md — Wolf Den

## Mission
Wolf Den reduces effort required to understand and resume work across software projects. A feature that requires more maintenance than the information it provides should be reconsidered.

## Authority
Read `README.md` and `docs/ROADMAP.md` before changing scope. Follow the currently assigned GitHub issue; its boundaries and acceptance criteria govern that slice. If requirements conflict or expand significantly, flag the conflict rather than silently extending scope.

## Architecture
- TypeScript strict; Node.js 26; pnpm; Linux/openSUSE first; OpenTUI for presentation.
- Keep domain models, state aggregation, providers, actions and UI separate. **No OpenTUI imports in core/domain/provider modules.**
- Treat JSON project registry as minimal user configuration. Validate with explicit schema, report actionable errors; expand `~` correctly.
- Git and GitHub are read-only in 0.1. GitHub uses authenticated `gh`, not copied API tokens.
- Never infer project intent from commits, PR status or issue count. Next action is registry-owned manual data.
- Preserve partial service availability: a failed integration should not hide successfully retrieved local state.

## Safety and subprocesses
- No shell-interpolated commands, untrusted string execution, Git writes, repository mutation or PR merges.
- Prefer spawn/execFile-style APIs with executable + argument arrays and explicit cwd.
- Validate paths and URLs, do not execute scripts from repositories. External opener/editor/terminal must target selected registered project.
- Do not expose secrets, credentials, or private local paths in logs/test fixtures.
- Close resources and restore terminal state on normal exit and errors.

## Engineering workflow
1. Implement **one issue/slice at a time**.
2. First identify existing architecture and tests; avoid unrelated refactors.
3. Write focused automated tests for parsing, provider responses and failure modes.
4. Run typecheck, tests, and build; report exact commands and outcomes.
5. Review against issue acceptance criteria; document gaps honestly.
6. Open a focused PR for human review. Do not merge without approval.

Do not add new dependencies, a framework, database, agents, background services, global hooks or CI complexity without a demonstrated need. Keep docs current when behavior changes.

## v0.3 UX and editable local configuration boundaries
- Read [the approved v0.3 UX/config specification](docs/V0.3-UX-AND-CONFIG-SPEC.md) for theme, cockpit, Settings, project management and next-action work.
- Git/GitHub remain read-only. v0.3 may write **only Wolf Den's own local JSON registry** via a validated, atomic, conflict-aware configuration service; never change project files/repositories.
- Preserve compatibility with existing version-1 registries and the terminal setting; reject invalid values with clear errors, and never silently overwrite external edits.
- Keep semantic theme tokens centralized; avoid scattered hardcoded colors. `Wolfy Dark` is the only initial built-in theme; future themes must be composable.
- Never imply a terminal font selector works; fonts belong to the user's emulator.
- Preserve keyboard accessibility, truthful status and compact layouts. Avoid fabricated urgency/health metrics.
- Each v0.3 issue has its own branch/PR and owner gate; no release tag without explicit approval.

## Definition of done
- Meets the assigned issue's acceptance criteria.
- Correctly distinguishes loading, available, stale and unavailable data.
- Safe error handling and keyboard usability for any affected screen.
- Tests pass and no fabricated state or misleading completion numbers.
- Changes scoped, documented, and submitted for human review.

## Version 0.1 non-goals
No AI summaries, automatic project discovery, cloud sync, SQLite, issue edits, Git mutations, activity daemon, or cross-platform support promises.
