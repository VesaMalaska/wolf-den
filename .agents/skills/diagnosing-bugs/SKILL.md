---
name: diagnosing-bugs
description: Use when an authorized Task involves a hard-to-reproduce bug, test failure, race condition, performance regression, terminal layout defect, or an explicit request to investigate a defect.
---

# Diagnosing bugs — evidence before guesses

Use within the assigned Task. For a newly discovered out-of-scope defect, report and propose a separate Task instead of silently expanding implementation.

## 1. Establish the observable failure

- State actual versus expected behavior, scope, environment and reproduction conditions.
- Prefer a fast signal that fails on **the reported symptom**: a focused unit regression, PTY/terminal-size reproduction, CLI check, profiling probe, or minimal repeatable manual sequence.
- Reproduce on the current relevant commit before claiming a root cause. If reproduction is impossible, record what was attempted and what evidence is missing; instrumentation or investigation may be the honest deliverable.
- Protect secrets, credentials, local paths, private repository names and environment data in reports and fixtures.

## 2. Isolate and explain

- Reduce the failing input and moving parts without masking the bug; distinguish a true regression from a preexisting limitation.
- Form a small number of competing, falsifiable explanations. Inspect logs, boundaries and code only as needed to discriminate them; do not scatter speculative changes.
- For intermittent behavior, use repeated runs or controlled timing, track reproduction rate and reject tests that always pass regardless of the defect.
- For Wolf Den, check terminal dimensions/cell width, focus and keyboard routing, stale or unavailable provider states, process cleanup, and registry read/write boundaries where relevant.

## 3. Repair the smallest cause

- Change the minimum responsible code, not adjacent features or unrelated architecture.
- Confirm the specific failure signal turns green and run proportionate regression tests for neighboring behavior.
- Preserve a regression test when it would actually catch a future recurrence. Report any known unverified conditions and whether an observed symptom may have multiple causes.
- Do not declare a defect fixed based solely on silence in logs, the disappearance of an exception, or a CSS-only visual workaround.

## 4. Report clearly

Include reproduction evidence, likely cause and confidence, exact changed behavior, tests performed, and remaining risk. If blocked, stop with a reproducible report or honest investigation notes; never invent a diagnosis.

**Inspired by:** [Matt Pocock's diagnosing-bugs](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md). Simplified to fit one HandyLab Task without mandatory phases or extra agents.

**Wolf Den adaptation:** Project-specific wording adjusted from the source HandyLab Skills Library skill for this repository.
