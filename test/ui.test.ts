import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardLayout, detailLines, fitLine, moveSelection, projectLoadNotice, visibleWindow } from "../src/ui.js";
import type { ProjectState } from "../src/domain.js";

test("wide layout keeps separate panels and fixed feedback rows", () => {
  const layout = dashboardLayout(120, 30, 20);
  assert.equal(layout.wide, true);
  assert.equal(layout.navigatorWidth + layout.dividerWidth + layout.detailWidth, 120);
  assert.equal(layout.navigatorHeight, 27);
  assert.equal(layout.detailHeight, 27);
  assert.equal(layout.headerHeight + layout.contentHeight + layout.statusHeight + layout.footerHeight, 30);
  assert.equal(visibleWindow(20, 19, layout.navigatorHeight), 0);
});

test("compact layout allocates selection, details and footer without overflow", () => {
  for (const width of [1, 30, 87, 88]) {
    for (const height of [1, 2, 3, 4, 7, 20]) {
      const layout = dashboardLayout(width, height, 20);
      assert.equal(layout.wide, width >= 88 && height >= 8);
      assert.equal(layout.headerHeight + layout.contentHeight + layout.statusHeight + layout.footerHeight, height);
      if (!layout.wide) assert.equal(layout.navigatorHeight + layout.dividerHeight + layout.detailHeight, layout.contentHeight);
      assert.equal(layout.footerHeight, 1);
    }
  }
  const compact = dashboardLayout(40, 15, 20);
  assert.ok(compact.navigatorHeight > 0);
  assert.ok(compact.detailHeight > 0);
  assert.equal(visibleWindow(20, 19, compact.navigatorHeight) + compact.navigatorHeight, 20);
});

test("empty and single-project layouts retain a navigator row", () => {
  assert.equal(dashboardLayout(40, 15, 0).navigatorHeight, 1);
  assert.equal(dashboardLayout(40, 15, 1).navigatorHeight, 1);
});

test("selected PR stays in details while loading and stale remote state remains explicit", () => {
  const previous = { kind: "available" as const, issues: 2, pullRequests: [
    { number: 9, title: "Layout", url: "https://github.com/example/sample/pull/9", review: null, checks: null, draft: false },
  ] };
  const state: ProjectState = {
    project: { id: "sample", name: "Sample", path: "/tmp/sample", lifecycle: "active", nextAction: "Review" },
    git: { kind: "available", branch: "main", detached: false, staged: false, unstaged: false, untracked: false, clean: true },
    github: { kind: "loading", previous },
  };
  const loading = detailLines(state, 0);
  assert.match(loading.lines.join("\n"), /GitHub loading/);
  assert.match(loading.lines[loading.selectedLine]!, /^> #9 Layout/);
  state.github = { kind: "stale", previous, reason: "Offline" };
  assert.match(detailLines(state, 0).lines.join("\n"), /GitHub stale:.*Offline/);
  state.github = { kind: "unavailable", reason: "Not configured" };
  assert.match(detailLines(state, -1).lines.join("\n"), /GitHub unavailable: Not configured/);
  assert.match(detailLines(undefined, -1).lines[0]!, /No projects configured/);
});

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
