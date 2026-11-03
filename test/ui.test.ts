import assert from "node:assert/strict";
import { test } from "node:test";
import { moveSelection, projectLoadNotice } from "../src/ui.js";

test("navigation stays at zero before projects load and with an empty registry", () => {
  assert.equal(moveSelection(0, 0, "down"), 0);
  assert.equal(moveSelection(0, 0, "up"), 0);
});

test("navigation clamps to the available project range", () => {
  assert.equal(moveSelection(0, 2, "up"), 0);
  assert.equal(moveSelection(0, 2, "down"), 1);
  assert.equal(moveSelection(1, 2, "down"), 1);
});

test("startup, loading, ready and empty registry notices match project state", () => {
  assert.equal(projectLoadNotice("registry"), "Loading project registry…");
  assert.equal(projectLoadNotice("loading", 1), "Loading 1 project…");
  assert.equal(projectLoadNotice("ready", 1), "Ready: 1 project.");
  assert.equal(projectLoadNotice("loading", 2), "Loading 2 projects…");
  assert.equal(projectLoadNotice("ready", 2), "Ready: 2 projects.");
  assert.equal(projectLoadNotice("ready", 0), "No projects configured.");
});
