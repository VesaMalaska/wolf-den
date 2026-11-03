import assert from "node:assert/strict";
import { test } from "node:test";
import { githubError, inspectGithub, parseGithub } from "../src/github.js";
import { GithubRefresh } from "../src/projects.js";
import type { GithubState, ProjectState } from "../src/domain.js";

const pr = { number: 5, title: "Review this", url: "https://github.com/owner/repo/pull/5", isDraft: false,
  reviewDecision: "REVIEW_REQUIRED", statusCheckRollup: [{ conclusion: "SUCCESS" }, { status: "IN_PROGRESS" }] };

test("parses open issues separately from PRs and reports review/check data", async () => {
  const calls: string[][] = [];
  const result = await inspectGithub("owner/repo", async args => {
    calls.push(args);
    return args[0] === "issue" ? '[{"number":2},{"number":3}]' : JSON.stringify([pr]);
  });
  assert.deepEqual(result, {kind: "available", issues: 2, pullRequests: [
    {number: 5, title: "Review this", url: pr.url, draft: false, review: "REVIEW_REQUIRED", checks: "1 passed, 0 failed, 1 pending"},
  ]});
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.slice(0, 4)), [["issue", "list", "--repo", "owner/repo"], ["pr", "list", "--repo", "owner/repo"]]);
});

test("empty results are available with zero counts", () => {
  assert.deepEqual(parseGithub("[]", "[]", "owner/repo"), {kind: "available", issues: 0, pullRequests: []});
});

test("missing, auth, offline, rate limit and malformed results are unavailable", async () => {
  const cases: [unknown, RegExp][] = [
    [Object.assign(new Error("spawn gh"), {code: "ENOENT"}), /not installed/],
    [new Error("gh auth login required"), /not authenticated/],
    [new Error("error connecting to api.github.com"), /network/],
    [new Error("API rate limit exceeded"), /rate limit/],
  ];
  for (const [error, expected] of cases) {
    assert.match(githubError(error), expected);
    const state = await inspectGithub("owner/repo", async () => { throw error; });
    assert.equal(state.kind, "unavailable");
  }
  const malformed = await inspectGithub("owner/repo", async () => "not json");
  assert.equal(malformed.kind, "unavailable");
  if (malformed.kind === "unavailable") assert.match(malformed.reason, /invalid data.*update gh/);
  assert.equal((await inspectGithub(undefined, async () => { throw new Error("should not call"); })).kind, "unavailable");
});

test("refresh keeps previous data as stale and deduplicates overlapping requests", async () => {
  let calls = 0;
  let release: ((value: GithubState) => void) | undefined;
  const previous = {kind: "available" as const, issues: 2, pullRequests: []};
  const state: ProjectState = {project: {id: "one", name: "One", path: "/one", repository: "owner/one", lifecycle: "active"},
    git: {kind: "unavailable", reason: "missing"}, github: previous};
  const refresh = new GithubRefresh(async () => { calls++; return await new Promise<GithubState>(resolve => { release = resolve; }); });
  const updates: GithubState[] = [];
  const update = (github: GithubState) => { state.github = github; updates.push(github); };
  const first = refresh.refresh(state, update);
  await refresh.refresh(state, update);
  assert.equal(calls, 1);
  assert.equal(state.github.kind, "loading");
  release?.({kind: "unavailable", reason: "Offline."});
  await first;
  assert.deepEqual(state.github, {kind: "stale", previous, reason: "Offline."});
  assert.equal(updates.length, 2);
  const second = refresh.refresh(state, update);
  assert.equal(calls, 2);
  release?.({kind: "available", issues: 3, pullRequests: []});
  await second;
  assert.deepEqual(state.github, {kind: "available", issues: 3, pullRequests: []});
});
