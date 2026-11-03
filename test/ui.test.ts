import assert from "node:assert/strict";
import { test } from "node:test";
import { fitLine, moveSelection, projectLoadNotice, visibleWindow } from "../src/ui.js";

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

test("narrow views keep selection visible and clip untrusted text to one line", () => {
  assert.equal(visibleWindow(20, 0, 3), 0);
  assert.equal(visibleWindow(20, 10, 3), 9);
  assert.equal(visibleWindow(20, 19, 3), 17);
  assert.equal(fitLine("Long\nproject name", 8), "Long pr…");
  assert.equal(fitLine("abc", 2), "a…");
});
