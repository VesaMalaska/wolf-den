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
  });
  assert.equal(states[0]?.git.kind, "unavailable");
  assert.equal(states[1]?.git.kind, "available");
});
