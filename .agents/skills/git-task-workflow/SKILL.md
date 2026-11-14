---
name: git-task-workflow
description: Use when beginning an authorized coding Task, preparing a branch, staging or committing changes, pushing a branch, or opening a pull request for human review.
---

# Git Task workflow

Use the repository's AGENTS.md and the explicitly assigned GitHub Task (or bounded human assignment). A Phase or Chunk is planning context, **not** an implementation authorization. A Slice is the tested deliverable, usually represented by one focused PR.

This adapts TopHat's safety principles without requiring Linear, a Git preflight framework, special hooks, role routing, or external orchestration state.

## 1. Inspect before modifying

- Confirm the repository, current branch and HEAD, worktree/index status, relevant remote, and approved integration branch. Inspect existing branches/PRs when a collision is possible.
- Read the assigned Task's intent, acceptance criteria, constraints, prerequisites, and allowed files. Identify whether prerequisite work is actually integrated, rather than assuming an open PR is enough.
- Preserve other people's or previous session's work. Do not silently stash, reset, clean, checkout over local changes, discard files, or overwrite an existing branch.
- Use the owner's declared base branch. **Wolf Den currently targets `development`** for feature and documentation PRs unless the owner explicitly changes this. Do not infer another project's branching policy.
- If local and remote history diverge or a prerequisite is ambiguous, stop and report the situation instead of choosing a destructive recovery method.

## 2. Implement only the approved Task

- Create a focused branch using the project's existing naming convention, or an obvious Task-scoped name.
- Keep the diff within Task scope. Record important unexpected findings; do not fold separate features, dependency upgrades, or formatting sweeps into the same PR.
- Stage only intended paths after inspecting the diff and untracked files. Avoid indiscriminate staging (`git add -A`, `git add .`) when it could capture unrelated work.
- Check for sensitive data, credentials, client assets, generated output and accidental changes before committing.
- Use clear commit messages and preserve a reviewable history. No force-push, history rewrite, unapproved hook bypass, or destructive conflict resolution.

## 3. Validate, publish and stop

- Run the Task's appropriate checks and review the actual diff against the chosen base before publication. A failed check must be reported, not hidden.
- An explicitly assigned implementation Task normally permits committing, pushing its feature branch and opening a PR for review. Do **not** interpret that as approval to merge.
- Verify the push and PR point at the intended repository, head, base and files. Do not claim publication until it is confirmed.
- PR/handoff should include: Task/Chunk references where available, a brief explanation of behavior and affected architecture, **before/after evidence when observable**, actual test commands/results, limitations, and decisions requiring review.
- Add a proportionate **merge-risk snapshot**: can the change be reverted easily, or does it involve a costly/irreversible migration? What is its likely blast radius (affected files, UI journeys, user data, other consumers, or OS boundaries)? State a low-risk reversible change plainly rather than inventing drama.
- **Never self-approve or merge.** Do not start another Task merely because the current PR has been opened.
- If blocked, preserve actual state and explain the blocker and safe next options. Do not silently retry through a different branch, force operation, or broad reset.

## Proportionality

This is a practical checklist, not a mandatory script/receipt schema. Use existing project automation when available; do not install the TopHat orchestration stack or invent extra Git approval gates.

**PR guidance inspired by:** [Matt Pocock's PR skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md), which credits Dex Horthy / Humanlayer. Adapted here in original wording.

**Wolf Den adaptation:** Project-specific wording adjusted from the source HandyLab Skills Library skill for this repository.
