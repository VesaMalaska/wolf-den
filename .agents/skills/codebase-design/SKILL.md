---
name: codebase-design
description: Use when designing or changing module boundaries, contracts, adapters, dependencies, and test seams; especially when assessing architectural changes in Wolf Den's providers, registry, state aggregation, and terminal UI.
---

# Codebase design — small interfaces, meaningful capabilities

Use this for design decisions within an **authorized Task** or an explicitly requested design investigation. The goal is code that is easy to navigate and change, **not** an excuse for a new framework.

## Find the meaningful boundary

- Start with the behavior the Task requires and trace its current path through the code. Identify what a caller genuinely needs to know.
- Prefer a cohesive module that hides substantial behavior behind a small, stable interface over many thin pass-through wrappers.
- Keep input/output types, errors, lifecycle, invariants and performance constraints understandable at the boundary. A short method signature alone does not make an interface simple.
- Favor local, named concepts over ambiguous primitives only when they remove repeated interpretation or invalid states.
- Keep changes local to the owning module. If one feature forces edits across unrelated layers, consider whether the responsibility belongs behind a better boundary.
- Make dependencies explicit enough to test without requiring the entire application, but **do not invent extension points, plugin systems or multiple adapters for hypothetical futures**.

## Wolf Den application

- Keep Git/GitHub and future project-status providers read-only, independent, and useful when another source is unavailable.
- Keep OpenTUI renderables and keyboard handling outside domain, provider and configuration modules.
- Keep versioned registry parsing, persistence, and runtime defaults explicit; do not rewrite configured paths or silently discard fields.
- Any future project-status contract must remain producer-independent; do not introduce a HandyLab-specific adapter or orchestration layer.
- Test public provider and state-aggregation behavior without spinning up the full terminal UI.

## Check whether an abstraction earns its place

Ask: What complexity does this interface hide? How many callers must understand it? Could we delete this layer and make the code *simpler*? Would a future change stay localized? Use answers grounded in current code, not a speculative architecture diagram.

When a substantial design choice is ambiguous, present the smallest viable alternatives and trade-offs to the owner rather than implementing a unilateral architecture pivot. Keep routine refactoring inside Task scope.

**Inspired by:** [Matt Pocock's codebase-design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md). Adapted for HandyLab; no TopHat or external orchestration dependency.

**Wolf Den adaptation:** Project-specific wording adjusted from the source HandyLab Skills Library skill for this repository.
