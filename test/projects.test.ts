import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProjectStates } from "../src/projects.js";

test("one failed provider does not hide other project state", async () => {
  const projects = [
    {id: "one", name: "One", path: "/one", lifecycle: "active"},
    {id: "two", name: "Two", path: "/two", lifecycle: "active"},
  ];
  const states = await loadProjectStates(projects, async path => {
    if (path === "/one") throw new Error("failure");
    return {kind: "available", branch: "main", detached: false, staged: false, unstaged: false, untracked: false, clean: true};
  }, async () => ({kind: "unavailable", reason: "No repository."}));
  assert.equal(states[0]?.git.kind, "unavailable");
  assert.equal(states[1]?.git.kind, "available");
});

test("remote failures preserve local Git and other projects", async () => {
  const projects = [
    {id: "one", name: "One", path: "/one", repository: "owner/one", lifecycle: "active"},
    {id: "two", name: "Two", path: "/two", repository: "owner/two", lifecycle: "active"},
  ];
  const states = await loadProjectStates(projects,
    async () => ({kind: "available", branch: "main", detached: false, staged: false, unstaged: false, untracked: false, clean: true}),
    async repository => repository === "owner/one" ? {kind: "unavailable", reason: "Offline."} : {kind: "available", issues: 0, pullRequests: []});
  assert.equal(states[0]?.git.kind, "available");
  assert.equal(states[0]?.github.kind, "unavailable");
  assert.equal(states[1]?.github.kind, "available");
});

test("local Git update is emitted while GitHub is still pending", async () => {
  const project = {id: "one", name: "One", path: "/one", repository: "owner/one", lifecycle: "active"};
  let release: (() => void) | undefined;
  const updates: string[] = [];
  const loading = loadProjectStates([project],
    async () => ({kind: "available", branch: "main", detached: false, staged: false, unstaged: false, untracked: false, clean: true}),
    async () => { await new Promise<void>(resolve => { release = resolve; }); return {kind: "unavailable", reason: "Offline."}; },
    state => { updates.push(`${state.git.kind}/${state.github.kind}`); });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(updates, ["available/loading"]);
  release?.();
  await loading;
  assert.deepEqual(updates, ["available/loading", "available/unavailable"]);
});
