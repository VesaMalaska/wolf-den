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
  assert.equal(fitLine("Long\nproject name", 8, "unicode-wide"), "Long pr…");
  assert.equal(fitLine("abc", 2, "unicode-wide"), "a…");
});

test("line clipping uses OpenTUI cell widths and preserves whole graphemes", () => {
  assert.equal(fitLine("ASCII text", 6, "unicode-wide"), "ASCII…");
  assert.equal(fitLine("äöå", 3, "unicode-wide"), "äöå");
  assert.equal(fitLine("äöåx", 3, "unicode-wide"), "äö…");
  assert.equal(fitLine("界界x", 3, "unicode-wide"), "界…");
  assert.equal(fitLine("e\u0301abc", 2, "unicode-wide"), "e\u0301…");
  assert.equal(fitLine("😀abc", 3, "unicode-wide"), "😀…");
  assert.equal(fitLine("👩‍💻abc", 3, "unicode-wide"), "👩‍💻…");
});

test("control characters are replaced before measuring or clipping", () => {
  assert.equal(fitLine("a\nb\u001b", 5, "unicode-wide"), "a b ");
});
