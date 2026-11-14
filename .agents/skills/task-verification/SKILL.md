---
name: task-verification
description: Use when implementing testable behavior, fixing bugs, selecting Vitest or Playwright coverage, validating a completed Task, or preparing a truthful verification report for a PR.
---

# Task verification

Verify the **assigned Task's observable acceptance criteria** with proportionate, reproducible evidence. Tests support confidence but do not replace human product and visual review.

## 1. Choose tests that match the change

- **Pure logic, registry/data contracts and state aggregation:** Prefer focused unit tests with deterministic fixtures.
- **Bug fixes:** Reproduce the defect with a failing regression test when feasible, then fix and keep the test.
- **OpenTUI behavior:** Test meaningful keyboard interaction, focus, state transitions, error/fallback text, and compact geometry; avoid brittle assertions against private implementation details.
- **Terminal end-to-end flows:** Use appropriate PTY and real target-terminal checks for interaction, rendering, resizing and lifecycle behavior.
- **OS/subprocess and persistence boundaries:** Test supported command execution and failure paths, registry validation, and atomic/conflict-aware writes when the Task changes those areas.
- **Documentation-only Tasks:** Verify links, references, scope and internal consistency; do not run or claim irrelevant application tests.

## 2. Tests at stable, observable seams

- Prefer the highest practical public or user-observable interface that can detect the Task's intended behavior; keep private implementation details free to change.
- Derive expected values from requirements, a verified fixture or independent worked examples, **not by repeating the algorithm inside the assertion**.
- Mock external/expensive boundaries when justified, not chains of internal collaborators. A test that stays green when the advertised behavior is broken provides false confidence.
- Choose a small number of meaningful test seams proportionate to risk. No extra approval meeting is needed to select each test.

## 3. Pragmatic TDD, not a ritual

- Prefer a **red → green → refactor** loop for deterministic algorithms, mapping rules, public contracts and regressions where the expected result is understood.
- Write a failing test before the behavior when that helps define the contract; implement the smallest correct change, then refactor while tests stay green.
- Exploratory visual work may need a quick implementation/prototype to establish desired behavior. Once agreed, add appropriate tests before requesting review.
- Do not require test files to precede *every* source edit, a fixed number of edge cases, arbitrary coverage percentages, or tests that merely duplicate the implementation.
- Select important edge conditions based on risk: limits, empty/invalid input, replacement and cancellation races, failures, cleanup, and repeated operations where applicable.

## 4. Wolf Den terminal verification

For changes affecting the cockpit or project data, verify only the relevant properties:

- Actual provider state is represented truthfully; unavailable GitHub must not hide local Git, and stale data must not appear fresh.
- Keyboard selection, contextual hints, scrolling, help, refresh and quit still work for the changed view.
- Normal and compact terminal dimensions remain legible and usable, including long branches, missing data and truncated text.
- For visible UI changes, capture comparable terminal evidence and request real Kitty human acceptance; PTY snapshots and automated checks do not substitute for visual review.
- For registry writes, preserve version-1 compatibility, detect conflicts, and never mutate registered repositories.

## 5. Run relevant gates and report honestly

- For code changes use the existing repository commands (currently `pnpm typecheck`, `pnpm test`, `pnpm build`) when applicable. Use PTY or real Kitty checks when UI behavior requires them; be clear which were actually performed.
- Do not install new runners, add heavy QA infrastructure, or change tests unrelated to the Task merely to satisfy this skill.
- Capture which commands ran, pass/fail outcome, and any useful artifact or reproduction instructions. Report environment limitations and **not run** checks with reasons.
- Do not call a failing test green; do not claim real Kitty visual review, GUI interaction, screenshots, runtime profiling or release readiness unless actually verified.
- If a critical acceptance criterion remains unverified, report it as a blocker or explicit review limitation rather than marking the Task complete.

**Definition of evidence:** What changed, what was actually exercised, what passed/failed, and what still needs human judgment.

**Test-design inspiration:** [Matt Pocock's TDD skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md). HandyLab intentionally keeps test-first conditional rather than mandatory for every edit.

**Wolf Den adaptation:** Project-specific wording adjusted from the source HandyLab Skills Library skill for this repository.
