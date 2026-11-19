---
name: chunk-planning
description: Use when the human asks to plan an approved Phase or Chunk, break a Chunk into proposed GitHub Tasks, or examine Task ordering and dependencies. Planning only; never create issues without explicit approval.
disable-model-invocation: true
---

# Chunk planning — deliver outcomes, not ticket volume

Run only for a human-requested planning activity. A Phase outlines a major objective; a Chunk describes a coherent, demonstrable outcome; a Task is a bounded coding-agent assignment. A Slice is the reviewable implementation result.

## 1. Establish the current boundary

- Read the approved `ROADMAP.md`, the specific Phase/Chunk under discussion, applicable decisions and relevant current code/PRs.
- Separate facts already verified from proposed design choices. Identify what can reasonably be demonstrated at the Chunk gate.
- Do **not** plan Tasks for the entire product. Plan the active approved Chunk in detail; future Chunks remain outlines.
- If the Chunk itself is unapproved, propose its outcome and boundaries first, without creating Tasks.

## 2. Propose small, verifiable Tasks

- Prefer a **thin end-to-end working Slice** when useful: exercise the smallest path needed to demonstrate real behavior, not just an isolated mock UI.
- Some enabling Tasks legitimately deliver contracts, infrastructure or investigative findings rather than a visible feature. Give those an independently verifiable outcome; don't force every Task to touch all layers.
- Each Task should fit a focused agent session and one reviewable PR, with purpose, allowed scope, observable acceptance criteria, meaningful tests, and explicit out-of-scope boundaries.
- List **true blockers** between Tasks; avoid artificial sequential ordering when work is independent. A prerequisite is satisfied only when its relevant work is integrated or explicitly available by an approved alternative.
- Identify high-risk assumptions early and place a research/proof Task before dependent implementation when needed.
- Keep broad mechanical migrations incremental and green where possible; prefer compatibility steps over a giant rewrite.

## 3. Present for owner approval

Present the Chunk outcome and a compact proposal for each Task: name, result, acceptance gate, dependencies, and reason for the chosen order. Flag uncertain estimates or decisions without inventing completion dates or arbitrary Task counts.

**Do not create, update, assign or close GitHub Issues, start implementation, or advance a Chunk based on this skill alone.** Obtain specific human approval for the proposed Task creation. A `chunk` tracking Issue, if used, is not executable.

At Chunk completion, demonstrate the integrated result, identify open risks and request human acceptance before preparing the next Chunk.

**Inspired by:** [Matt Pocock's to-tickets](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md). Adapted to HandyLab Phases/Chunks and owner-controlled GitHub Issues.
