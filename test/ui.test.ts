import assert from "node:assert/strict";
import { test } from "node:test";
import { measureEditText } from "@opentui/core";
import { clampSelection, dashboardLayout, detailLines, fitLine, moveProjectSelection, moveSelection, navigatorContent, navigatorEntry, navigatorHeadingHeight, navigatorHeadingText, navigatorRow, navigatorView, projectLoadNotice, visibleWindow } from "../src/ui.js";
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
  assert.equal(dashboardLayout(40, 15, 1).navigatorHeight, 2);
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
  assert.equal(clampSelection(12, 5), 4);
  assert.equal(clampSelection(-2, 1), 0);
  assert.equal(moveSelection(12, 5, "up"), 3);
  assert.deepEqual(moveProjectSelection(1, 2, 3, "down"), { selected: 2, selectedPr: -1 });
  assert.deepEqual(moveProjectSelection(2, 2, 3, "down"), { selected: 2, selectedPr: 2 });
  assert.deepEqual(moveProjectSelection(0, -1, 0, "down"), { selected: 0, selectedPr: -1 });
});

function projectState(index: number): ProjectState {
  return {
    project: { id: `p${index}`, name: index === 11 ? "Pitkä projekti 界界 🐺" : `Project ${index}`, path: `/tmp/p${index}`, lifecycle: "active" },
    git: { kind: "available", branch: "feature/nav", detached: false, staged: false, unstaged: false, untracked: false, clean: index % 2 === 0 },
    github: { kind: "unavailable", reason: "Not configured" },
  };
}

test("navigator presents local branch and clean or dirty status without remote counts", () => {
  const clean = navigatorRow(projectState(0), 42, false, "unicode-wide");
  const dirty = navigatorRow(projectState(1), 42, true, "unicode-wide");
  assert.match(clean.text, /Project 0.*feature\/nav · clean/);
  assert.match(dirty.text, /▌ Project 1.*feature\/nav · dirty/);
  assert.equal(dirty.text.length, 42);
  const loading = projectState(2);
  loading.git = { kind: "loading" };
  loading.project.repository = "example/p2";
  loading.github = { kind: "loading" };
  assert.match(navigatorRow(loading, 42, false).text, /git… GH…/);
  loading.git = { kind: "unavailable", reason: "Missing" };
  loading.github = { kind: "stale", previous: { kind: "available", issues: 3, pullRequests: [] }, reason: "Offline" };
  assert.match(navigatorRow(loading, 42, false).text, /git n\/a GH~/);
  loading.github = { kind: "unavailable", reason: "Offline" };
  assert.match(navigatorRow(loading, 42, false).text, /GH!/);
});

test("twelve project viewport retains selected row across navigation and resizing", () => {
  const states = Array.from({ length: 12 }, (_, index) => projectState(index));
  for (const [width, height] of [[120, 24], [40, 15], [30, 9], [88, 8]]) {
    const layout = dashboardLayout(width!, height!, states.length);
    const rows = layout.navigatorHeight - navigatorHeadingHeight(layout.wide, layout.navigatorHeight);
    for (let selected = 0; selected < states.length; selected++) {
      const view = navigatorView(states, selected, rows, layout.navigatorWidth, "unicode-wide");
      assert.ok(view.start <= selected && selected < view.start + view.capacity);
      assert.equal(view.entries.filter(entry => entry.selected).length, 1);
      assert.ok(view.entries.every(entry => "nameLine" in entry && measureEditText(entry.nameLine, { widthMethod: "unicode-wide" }) === layout.navigatorWidth));
      assert.ok(view.entries.length * (view.twoLine ? 2 : 1) + Math.max(0, view.entries.length - 1) * view.gap <= rows);
      assert.match(detailLines(states[view.index], -1).lines[0]!, new RegExp(states[selected]!.project.name));
    }
  }
  assert.equal(navigatorView([], 99, 3, 40).index, 0);
  assert.equal(navigatorView(states.slice(0, 1), 99, 3, 40).index, 0);
  assert.equal(navigatorView(states.slice(0, 5), 99, 3, 40).index, 4);
  assert.equal(visibleWindow(12, 99, 3), 9);
  assert.equal(visibleWindow(12, 11, 0), 0);
});

test("two-line entry gives name its own line and right-aligns status without collisions", () => {
  const state = projectState(11);
  state.git = { kind: "available", branch: "long/界界/feature/navigation", detached: false, staged: false, unstaged: false, untracked: true, clean: false };
  for (const width of [26, 42, 80]) {
    const entry = navigatorEntry(state, width, true, "unicode-wide");
    assert.ok(entry.nameLine.startsWith("▌ "));
    assert.ok(entry.metadataLine.startsWith("  ⎇ "));
    assert.ok(entry.nameLine.includes("Pitkä"));
    assert.ok(!entry.nameLine.includes("dirty"));
    assert.ok(entry.metadataLine.trimEnd().endsWith("dirty"));
    assert.equal(measureEditText(entry.nameLine, { widthMethod: "unicode-wide" }), width);
    assert.equal(measureEditText(entry.metadataLine, { widthMethod: "unicode-wide" }), width);
    assert.equal(entry.statusStart, width - 7);
    assert.ok(measureEditText(entry.metadataMarker + entry.branchText + entry.remoteText, { widthMethod: "unicode-wide" }) <= entry.statusStart - 2);
  }
  const narrow = navigatorEntry(state, 12, true, "unicode-wide");
  assert.ok(narrow.nameLine.includes("…"));
  assert.ok(narrow.metadataLine.trimEnd().endsWith("dirty"));
});

test("navigator heading keeps project count at the right edge", () => {
  const heading = navigatorHeadingText(4, 42, "unicode-wide");
  assert.ok(heading.startsWith("PROJECTS"));
  assert.ok(heading.endsWith("4 projects"));
  assert.equal(measureEditText(heading, { widthMethod: "unicode-wide" }), 42);
  assert.equal(navigatorHeadingText(1, 42).trimEnd().endsWith("1 project"), true);
  assert.equal(navigatorHeadingText(20, 8), "PROJECTS");
  assert.equal(navigatorHeadingHeight(true, 17), 2);
  assert.equal(navigatorHeadingHeight(true, 5), 1);
  assert.equal(navigatorHeadingHeight(false, 17), 0);
});

test("viewport keeps complete two-line entries and uses single-line fallback for short windows", () => {
  const states = Array.from({ length: 20 }, (_, index) => projectState(index));
  const wide = navigatorView(states, 19, 17, 42, "unicode-wide");
  assert.equal(wide.gap, 1);
  assert.ok(wide.start <= 19 && 19 < wide.start + wide.capacity);
  assert.ok(wide.entries.every(entry => "nameLine" in entry));
  const compact = navigatorView(states, 19, 4, 40, "unicode-wide");
  assert.equal(compact.capacity, 2);
  assert.equal(compact.entries.length, 2);
  assert.ok(compact.entries.every(entry => "metadataLine" in entry));
  const short = navigatorView(states, 19, 1, 40, "unicode-wide");
  assert.equal(short.twoLine, false);
  assert.equal(short.entries.length, 1);
  assert.equal(short.start, 19);
});

test("selected project highlight covers both lines and stops before the next entry", () => {
  const view = navigatorView([projectState(0), projectState(1)], 0, 6, 32, "unicode-wide");
  const content = navigatorContent(view, 32, "unicode-wide");
  const selected = content.chunks.filter(chunk => chunk.bg?.toInts().slice(0, 3).join() === "41,70,92");
  assert.equal(selected.map(chunk => chunk.text).join(""), (view.entries[0] as ReturnType<typeof navigatorEntry>).nameLine + "\n" + (view.entries[0] as ReturnType<typeof navigatorEntry>).metadataLine);
  assert.ok(content.chunks.some(chunk => chunk.text.includes("Project 1") && !chunk.bg));
  assert.ok(content.chunks.some(chunk => chunk.text.includes("Project 0") && ((chunk.attributes ?? 0) & 1) !== 0));
});

test("long Unicode names clip safely in narrow navigator rows", () => {
  const state = projectState(11);
  const selected = navigatorRow(state, 16, true, "unicode-wide");
  assert.ok(selected.text.startsWith("▌ "));
  assert.ok(selected.text.includes("…"));
  assert.ok(!selected.text.includes("feature/nav"));
  assert.ok(navigatorRow(state, 2, true, "unicode-wide").text.length <= 2);
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
