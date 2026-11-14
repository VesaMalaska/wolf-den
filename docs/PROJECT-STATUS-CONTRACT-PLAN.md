# Project Status Contract & Discovery — future initiative

**Status:** Agreed direction; **planning only**, not implemented and not part of the approved v0.3 work.
**Related:** [Wolf Den roadmap](ROADMAP.md), [v0.3 UX and configuration spec](V0.3-UX-AND-CONFIG-SPEC.md).

## Problem and intended outcome

Wolf Den currently displays a manually maintained `nextAction` from its own registry. This is useful as a placeholder but requires duplicate maintenance. The intended replacement is a **producer-owned project status snapshot** that a registered project's development workflow keeps current. Wolf Den passively reads that snapshot and shows current work, last completed work, next action, and whether a human needs to act.

A developer should be able to finish a task, have the workflow update one file, and open Wolf Den to see the latest reported handoff. This is **status reporting, not task orchestration**.

**Guiding rule: HandyLab philosophy — the smallest reliable solution that meets the actual need. No TopHat-style expansion.**

## Responsibilities and independence

| Owner | Responsibility |
| --- | --- |
| Producer (HandyLab, TopHat, another agent/workflow, or a human) | Create, update, and validate its own status snapshot at meaningful workflow transitions |
| Shared contract | Define the format independently of any particular producer or consumer |
| Wolf Den | Discover and read an optional status file in *explicitly registered* projects, validate it, show source/freshness/error states, and continue to provide independent Git/GitHub facts |
| Human | Set up the reporting skill/instructions and retain authority for approvals and decisions |

Wolf Den must not require HandyLab, know its internal Phase/Chunk/Task structure, invoke the agent, or write the producer's status file. Producers must not have to import Wolf Den's application code. A project without the status document continues to work in Wolf Den as it does today.

## Minimal v1 contract direction

- **One JSON snapshot file per project**, in a predictable project-relative location. A candidate is `.project-status/status.json`; finalize the path before implementation. Do not introduce filesystem-wide discovery.
- **Versioned structure** with a schema version and an `updatedAt` timestamp.
- Minimal common information: reported workflow state, **current work**, **last completed work**, **next action** (which may be unknown), and **whether human attention is needed**. Optional references to an issue, PR, or commit can support reported facts without imposing producer-specific terminology.
- Keep reporting descriptive and explicit. Do not require HandyLab's Phase/Chunk/Task hierarchy or infer a plan from Git commits.
- Unknown next action must be representable as unknown/null; agents must not invent a next step to satisfy a required field.
- Distinguish “task is in progress” from “an agent is actively running.” A timestamped snapshot is **not** a heartbeat. Display its age and avoid claims of live execution.
- Producer should validate and write a complete snapshot safely (for example via temporary file + same-directory rename). Wolf Den only reads it.
- No activity log or event stream required in v1. Consider recent history only if the snapshot proves insufficient.

The names, enum values, required/optional fields, and path above are **design inputs**, not a frozen schema or a promise of implemented behavior.

## Schema, types, and tiny CLI

- **JSON Schema is the portable source of truth.** Offer generated TypeScript types from the same contract for TS-based producers, while keeping Python, shell, and other producers equally welcome.
- TypeScript checks typed code at compile time; it does **not** validate arbitrary JSON read or written at runtime. Schema-based runtime validation is required.
- Supply a **small, standalone CLI** with just `project-status init` (create a minimal valid example without silently replacing an existing file) and `project-status validate` (validate file/schema and report useful errors; nonzero exit on failure).
- Keep the tool easy to run without adding a framework to the project. Packaging/distribution and exact command names can be settled during implementation.
- Validation confirms **structure**, not factual truth. Producers must report only verified work and actual human decisions.

## Reusable reporter skill and human setup

The **Project Status Reporter** skill belongs in the separate [HandyLab Skills Library](https://github.com/VesaMalaska/handylab-skills-library), not inside Wolf Den's runtime. It teaches any compatible agent:

1. When to update the snapshot: task start, implementation/verification results, blocked work, PR handoff, explicitly observed human approval, and merge/completion.
2. How to preserve accurate, evidence-based current work, last completed work, and next action; never claim approval or success without evidence.
3. How to run the validator before handoff and report failures instead of leaving misleading status.
4. How to maintain the status independently of the consuming dashboard.

**Human setup instructions must explicitly tell the operator to install/enable the skill and to require its use in the project's ordinary agent instructions (for example `AGENTS.md`).** Do not rely on the agent “remembering” an optional skill. A future task verification hook may be considered only if actual omissions show it is necessary.

Wolf Den's roadmap tracks this dependency; it does not implement or own HandyLab's workflow.

## Wolf Den read-only consumer and Next Action transition

- Discover the optional status document only for registered project directories; validate before interpreting.
- Present reported current/last-completed work, next action, human attention and `updatedAt` clearly in wide and compact layouts.
- Handle missing, invalid, unreadable, and old snapshots honestly. Preserve independent Git/GitHub information even if this source fails. Do not equate an old snapshot with live agent activity.
- **Intended precedence:** a valid contract-provided next action should supersede the manually maintained registry next action for that project's display. The current manual feature is **not removed now**. Define fallback/invalid-source UX and eventual migration before implementing the switch.
- Keep the existing Wolf Den registry separate from producer-owned status files. Do not silently copy or overwrite either source.
- No project writes from Wolf Den; keep Git, GitHub, and producer snapshots read-only.

## Suggested small implementation sequence (future, separately approved)

1. Finalize the minimal JSON structure, path and JSON Schema with realistic example fixtures. Derive TypeScript types.
2. Implement and test the tiny `init`/`validate` CLI. No daemon, watchers, or service.
3. Publish the reusable reporter skill and explicit human setup instructions in the Skills Library; prove with one producing project.
4. Add Wolf Den's optional read-only parser/provider and truthful missing/invalid/stale/fresh states.
5. Add concise cockpit presentation and carefully chosen Next Action precedence/fallback. Verify in real Kitty, including compact views.

Each slice gets its own issue/branch/PR and human approval when scheduled. Do **not** start this initiative as part of an unrelated v0.3 task.

## Acceptance criteria

- The same documented contract can be produced by HandyLab **or a different workflow** without special-case code in Wolf Den.
- A valid updated snapshot becomes visible in Wolf Den without manual Next Action editing; absent/invalid data does not break the cockpit.
- Non-TypeScript producers can validate the JSON; TS producers receive useful compile-time types.
- `init` never overwrites an existing file; `validate` correctly accepts/rejects fixtures and provides actionable failures.
- Wolf Den never writes the producer-owned snapshot and never invents approval, next action, task completion, or live agent activity.
- Reporter skill includes explicit human setup steps and validation instructions.
- No database, service, event bus, orchestration, automatic task execution, new project discovery, or heavyweight integration layer.

## Decisions deliberately left open

- Exact file/directory naming and whether an override is actually necessary (prefer one convention).
- Exact minimum fields, status enum and reference representation; avoid premature workflow vocabulary.
- How to distribute the schema/types/CLI with minimal installation friction.
- Whether snapshots should be Git-ignored by default, and how shared/multi-machine workflows affect ownership.
- UI details for age/failure indicators and the manual Next Action retirement path.

Decide only what is required for the first usable slice. **If a proposal adds more machinery than value, leave it out.**
