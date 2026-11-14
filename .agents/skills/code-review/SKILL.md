---
name: code-review
description: Use when the owner requests review of a branch or PR, or when the coding agent performs a final self-check against Task acceptance criteria before opening its PR.
---

# Code review — requirements and engineering quality

A review is an evidence-based assessment of a **specific diff**, not permission to merge. This skill works in one agent session; separate reviewer agents are optional and never required.

## Pin the candidate

- Identify the actual repository, head commit, selected integration base and resulting diff. Check for unrelated changes and committed versus uncommitted work.
- Read the originating Task/acceptance criteria, approved decisions and applicable `AGENTS.md` / project standards. An entire Roadmap Phase is not the review scope.
- Review what the candidate **actually changes**, not what the author claims was changed.

## Two independent questions

**1. Fidelity to the Task:** Does the Slice implement the approved outcome? Are edge cases, non-goals, user-facing states and architecture constraints respected? Are required tests genuinely demonstrated? Is any feature silently missing or unapproved?

**2. Engineering quality:** Is the implementation understandable, localized and safe? Consider error handling, stale async behavior, resource cleanup, trust boundaries, testability, accessibility, risky dependencies and possible structural smells such as duplication, hidden coupling or speculative abstractions. Prefer findings grounded in a specific change over generic style opinions.

Avoid duplicating static checker output unless it explains a real concern. A self-review can identify problems but **cannot substitute for human acceptance**.

## Findings and decision

- Report actionable findings first, ordered by severity, with file/area, observable impact and a suggested correction.
- Separate blocking correctness/security issues from smaller maintainability suggestions and optional improvements.
- Distinguish verified defects from concerns requiring evidence. If no issues are found, say what was reviewed and what remains unverified; don't claim a clean diff proves visual or photographic quality.
- Include affected tests and missing verification. For image processing, consider immutable originals, byte-level export, preview parity and real-photo quality review.

The coding agent may revise its **own authorized Task** and rerun checks before PR. It must not self-approve, silently expand scope, merge, or open new Tasks based solely on review findings.

**Inspired by:** [Matt Pocock's two-axis code-review approach](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md). Adapted without mandatory parallel subagents.
