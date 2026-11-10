import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { measureEditText } from "@opentui/core";
import { ProjectActions } from "../src/actions.js";
import { clampSelection, dashboardLayout, detailLines, detailToneColor, detailViewport, feedbackColor, feedbackForSelection, fitBranch, fitLine, isProjectActionKey, moveProjectSelection, moveSelection, navigatorContent, navigatorEntry, navigatorHeadingHeight, navigatorHeadingText, navigatorRow, navigatorView, nextPrSelection, projectActionForKey, projectLoadNotice, radarContent, radarSummary, scrollToLine, shortcutFooter, visibleWindow } from "../src/ui.js";
import { resolveTheme } from "../src/theme.js";
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
  assert.match(loading.lines.join("\n"), /Loading · previous data below/);
  assert.match(loading.lines[loading.selectedLine]!, /▌ #9 \[open\] Layout/);
  assert.match(loading.lines.join("\n"), /SELECTED PR #9 · open · previous data/);
  state.github = { kind: "stale", previous, reason: "Offline" };
  assert.match(detailLines(state, 0).lines.join("\n"), /Stale · Offline.*Issues 2 open \(previous\)/s);
  state.github = { kind: "unavailable", reason: "Not configured" };
  assert.match(detailLines(state, -1).lines.join("\n"), /Unavailable · Not configured/);
  assert.match(detailLines(undefined, -1).lines[0]!, /No projects configured/);
});

test("navigation stays at zero before projects load and with an empty registry", () => {
  assert.equal(moveSelection(0, 0, "down"), 0);
  assert.equal(moveSelection(0, 0, "up"), 0);
});

test("t routes to terminal and o is no longer an action key", async () => {
  const path = await mkdtemp(join(tmpdir(), "wolf-den-ui-actions-"));
  try {
    const calls: { executable: string; args: string[]; cwd: unknown }[] = [];
    const actions = new ProjectActions(async (executable, args, options) => {
      calls.push({ executable, args, cwd: options.cwd });
    }, { DISPLAY: ":0" });
    const state: ProjectState = {
      project: { id: "selected", name: "Selected", path, lifecycle: "active" },
      git: { kind: "loading" },
      github: { kind: "unavailable", reason: "Not configured" },
    };
    assert.equal(isProjectActionKey("t"), true);
    assert.equal(isProjectActionKey("o"), false);
    const hints = shortcutFooter(80, false, state, -1);
    assert.match(hints, /t terminal/);
    assert.doesNotMatch(hints, /o terminal/);
    const result = projectActionForKey("t", actions, state, -1);
    await result.action;
    assert.equal(result.launched, "Terminal");
    assert.deepEqual(calls, [{ executable: "xdg-terminal-exec", args: [`--dir=${path}`], cwd: path }]);
  } finally { await rm(path, { recursive: true }); }
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

test("PR selection starts at the first entry, cycles, and handles zero or one PR", () => {
  assert.equal(nextPrSelection(-1, 3), 0);
  assert.equal(nextPrSelection(0, 3), 1);
  assert.equal(nextPrSelection(2, 3), 0);
  assert.equal(nextPrSelection(-1, 1), 0);
  assert.equal(nextPrSelection(0, 1), 0);
  assert.equal(nextPrSelection(-1, 0), -1);
});

test("p requires a selected live PR and never substitutes a cached URL", async () => {
  const state = projectState(0);
  state.project.repository = "example/repo";
  const pr = { number: 7, title: "Selected", url: "https://github.com/example/repo/pull/7", review: null, checks: null, draft: false };
  state.github = { kind: "available", issues: 0, pullRequests: [pr] };
  const opened: string[] = [];
  const actions = new ProjectActions(async (_executable, args) => { opened.push(args[0]!); }, { DISPLAY: ":0" });
  await assert.rejects(projectActionForKey("p", actions, state, -1).action, /Select an available PR/);
  assert.deepEqual(opened, []);
  await projectActionForKey("p", actions, state, 0).action;
  assert.deepEqual(opened, [pr.url]);
  state.github = { kind: "stale", previous: { kind: "available", issues: 0, pullRequests: [pr] }, reason: "Offline" };
  await assert.rejects(projectActionForKey("p", actions, state, 0).action, /Select an available PR/);
  assert.deepEqual(opened, [pr.url]);
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
    const rows = layout.navigatorHeight - navigatorHeadingHeight(layout.wide, layout.navigatorHeight) - layout.radarHeight;
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
  assert.equal(navigatorHeadingHeight(true, 17), 1);
  assert.equal(navigatorHeadingHeight(true, 5), 1);
  assert.equal(navigatorHeadingHeight(false, 17), 0);
});

test("radar uses only loaded Git states and keeps unknown states distinct", () => {
  assert.equal(radarSummary([]), "No projects configured");
  assert.equal(radarSummary([projectState(0)]), "1 clean");
  const states = Array.from({ length: 5 }, (_, index) => projectState(index));
  states[2]!.git = { kind: "loading" };
  states[3]!.git = { kind: "stale", previous: states[0]!.git as Extract<ProjectState["git"], { kind: "available" }>, reason: "Offline" };
  states[4]!.git = { kind: "unavailable", reason: "Missing" };
  assert.equal(radarSummary(states), "1 dirty · 1 unavailable · 1 clean · 1 loading · 1 stale");
  assert.equal(radarSummary(states.slice(2)), "1 unavailable · 1 loading · 1 stale");
});

test("wide radar reserves a bottom summary and keeps its counts within the panel", () => {
  const states = [projectState(0), projectState(1)];
  states[1]!.git = { kind: "unavailable", reason: "Missing" };
  const layout = dashboardLayout(120, 32, states.length);
  assert.equal(layout.radarHeight, 3);
  assert.ok(layout.navigatorHeight - navigatorHeadingHeight(layout.wide, layout.navigatorHeight) - layout.radarHeight >= 1);
  const content = radarContent(states, layout.navigatorWidth, "unicode-wide");
  assert.match(content.chunks.map(chunk => chunk.text).join(""), /GIT STATUS · LOADED.*1 unavailable.*1 clean/s);
  assert.ok(content.chunks.some(chunk => chunk.text.includes("unavailable") && chunk.fg?.toInts().slice(0, 3).join() === "185,199,217"));
  assert.equal(dashboardLayout(42, 18, 2).radarHeight, 0);
});

test("middle branch clipping retains its prefix and final identifier", () => {
  const branch = "feature/navigation/issue-23";
  const clipped = fitBranch(branch, 17, "unicode-wide");
  assert.match(clipped, /^feature.*….*-23$/);
  assert.equal(measureEditText(clipped, { widthMethod: "unicode-wide" }), 17);
  assert.equal(fitBranch(branch, 5, "unicode-wide"), "feat…");
  const state = projectState(0);
  state.git = { ...state.git as Extract<ProjectState["git"], { kind: "available" }>, branch };
  const entry = navigatorEntry(state, 30, true, "unicode-wide");
  assert.match(entry.metadataLine, /⎇ feature.*….*-23.*clean$/);
});

test("five target terminal sizes retain selected entry, bounded text and workbench hierarchy", () => {
  const states = Array.from({ length: 18 }, (_, index) => projectState(index));
  states[17]!.project.nextAction = "Review the current change";
  for (const [width, height] of [[120, 32], [100, 25], [80, 24], [56, 22], [42, 18]]) {
    const layout = dashboardLayout(width!, height!, states.length);
    const headingRows = navigatorHeadingHeight(layout.wide, layout.navigatorHeight);
    const rows = layout.navigatorHeight - headingRows - layout.radarHeight;
    const view = navigatorView(states, 17, rows, layout.navigatorWidth, "unicode-wide");
    assert.ok(view.start <= 17 && 17 < view.start + view.capacity);
    assert.equal(view.entries.filter(entry => entry.selected).length, 1);
    assert.ok(view.entries.every(entry => "nameLine" in entry
      ? measureEditText(entry.nameLine, { widthMethod: "unicode-wide" }) === layout.navigatorWidth && measureEditText(entry.metadataLine, { widthMethod: "unicode-wide" }) === layout.navigatorWidth
      : measureEditText(entry.text, { widthMethod: "unicode-wide" }) <= layout.navigatorWidth));
    const detail = detailLines(states[17], -1, layout.detailWidth, "unicode-wide");
    assert.equal(detail.rows[0]!.tone, "title");
    assert.ok(detail.rows.findIndex(row => row.text.includes("NEXT ACTION")) < detail.rows.findIndex(row => row.text.includes("LOCAL GIT")));
    assert.ok(detail.rows.findIndex(row => row.text.includes("LOCAL GIT")) < detail.rows.findIndex(row => row.text.includes("GITHUB")));
    assert.ok(detail.rows.some(row => row.surface === "alt" && row.spans?.some(span => span.tone === "action" && span.text.includes("Review the current change"))));
    assert.ok(detail.lines.map(line => fitLine(line, layout.detailWidth, "unicode-wide")).every(line => measureEditText(line, { widthMethod: "unicode-wide" }) <= layout.detailWidth));
    assert.ok(layout.detailHeight > 0);
  }
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
  const selected = content.chunks.filter(chunk => chunk.bg?.toInts().slice(0, 3).join() === "41,77,112");
  assert.equal(selected.map(chunk => chunk.text).join(""), (view.entries[0] as ReturnType<typeof navigatorEntry>).nameLine + "\n" + (view.entries[0] as ReturnType<typeof navigatorEntry>).metadataLine);
  assert.ok(content.chunks.some(chunk => chunk.text.includes("Project 1") && !chunk.bg));
  assert.ok(content.chunks.some(chunk => chunk.text.includes("Project 0") && ((chunk.attributes ?? 0) & 1) !== 0));
});

test("semantic overrides reach navigator selection, statuses and detail feedback", () => {
  const theme = resolveTheme("wolfy-dark", { selectionBackground: "#405060", success: "#AABBCC", error: "#DDEEFF", heading: "#ABCDEF", divider: "#445566", panelAlt: "#223344" });
  const view = navigatorView([projectState(0), projectState(2)], 1, 4, 32, "unicode-wide");
  const content = navigatorContent(view, 32, "unicode-wide", "PROJECTS", 0, theme);
  assert.ok(content.chunks.some(chunk => chunk.bg?.toInts().slice(0, 3).join() === "64,80,96"));
  assert.ok(content.chunks.some(chunk => chunk.text.includes("clean") && chunk.fg?.toInts().slice(0, 3).join() === "170,187,204"));
  assert.ok(content.chunks.some(chunk => chunk.text.includes("PROJECTS") && chunk.fg?.toInts().slice(0, 3).join() === "171,205,239"));
  assert.equal(detailToneColor("good", theme), theme.success);
  assert.equal(detailToneColor("error", theme), theme.error);
  assert.equal(detailToneColor("unavailable", theme), theme.unavailable);
  assert.equal(detailToneColor("accent", theme), theme.accent);
  assert.equal(detailToneColor("accentSubtle", theme), theme.accentSubtle);
  assert.equal(detailToneColor("divider", theme), theme.divider);
  assert.equal(detailToneColor("action", theme), theme.textPrimary);
  assert.equal(feedbackColor("error", theme), theme.error);
  assert.equal(feedbackColor("loading", theme), theme.info);
  const dirty = projectState(1);
  const detail = detailLines(dirty, -1);
  assert.ok(detail.rows[0]!.spans?.some(span => span.tone === "title" && span.strong));
  assert.ok(detail.rows.some(row => row.surface === "alt" && row.spans?.some(span => span.tone === "divider")));
  assert.ok(detail.rows.some(row => row.text.includes("Dirty") && row.spans?.some(span => span.tone === "warn")));
  dirty.project.nextAction = "Review PR";
  assert.ok(detailLines(dirty, -1).rows.some(row => row.spans?.some(span => span.tone === "action" && span.text.includes("Review PR"))));
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

test("detail hierarchy preserves manual action and separates local and remote states", () => {
  const state = projectState(0);
  state.project.nextAction = "Review  界界  this exact task";
  state.git = { kind: "available", branch: "feature/details", detached: false, staged: true, unstaged: false, untracked: true, clean: false };
  state.github = { kind: "unavailable", reason: "Offline" };
  const view = detailLines(state, -1, 48, "unicode-wide");
  assert.deepEqual(view.lines.filter(line => /NEXT ACTION|LOCAL GIT|GITHUB/.test(line)).map(line => line.includes("NEXT ACTION") ? "NEXT ACTION" : line.trim()), ["NEXT ACTION", "LOCAL GIT", "GITHUB"]);
  assert.ok(view.lines.some(line => line.includes("Review  界界  this exact task")));
  assert.match(view.lines.join("\n"), /Branch feature\/details.*● Dirty.*staged · untracked.*GITHUB.*Unavailable · Offline/s);
  assert.ok(view.rows.some(row => row.tone === "unavailable"));
  state.git = { kind: "available", branch: "abc123", detached: true, staged: false, unstaged: false, untracked: false, clean: true };
  assert.match(detailLines(state, -1).lines.join("\n"), /Detached HEAD.*● Clean/s);
});

test("wide workbench pairs local and GitHub zones with bounded rows", () => {
  const state = projectState(0);
  state.project.nextAction = "Review the current task";
  state.github = { kind: "available", issues: 2, pullRequests: [] };
  const detail = detailLines(state, -1, 77, "unicode-wide", true);
  assert.ok(detail.lines.some(line => line.includes("LOCAL GIT") && line.includes("GITHUB")));
  assert.ok(detail.lines.some(line => line.includes("Branch feature/nav") && line.includes("Available")));
  assert.ok(detail.lines.some(line => line.includes("● Clean") && line.includes("Issues 2 open")));
  assert.ok(detail.lines.every(line => measureEditText(line, { widthMethod: "unicode-wide" }) <= 77));
  assert.ok(detail.rows.some(row => row.spans?.some(span => span.tone === "good")));
  const compact = detailLines(state, -1, 42, "unicode-wide", false);
  assert.ok(compact.lines.findIndex(line => line.includes("LOCAL GIT")) < compact.lines.findIndex(line => line.includes("GITHUB")));
  state.project.name = "A very long project identity with 界界 and a final identifier";
  assert.ok(measureEditText(detailLines(state, -1, 42, "unicode-wide").lines[0]!, { widthMethod: "unicode-wide" }) <= 42);
});

test("compact PR rows and pinned selected details stay bounded at target sizes", () => {
  const state = projectState(11);
  state.project.nextAction = "Open the very long task with 界界 and 👩‍💻 today";
  state.github = { kind: "available", issues: 4, pullRequests: Array.from({ length: 12 }, (_, index) => ({
    number: index + 1, title: `Long pull request title ${index} 界界 👩‍💻 with more words`, url: `https://github.com/example/pull/${index + 1}`,
    review: "Changes requested", checks: "Pending", draft: index === 11,
  })) };
  for (const [width, height] of [[120, 32], [100, 25], [80, 24], [56, 22], [42, 18]]) {
    const layout = dashboardLayout(width!, height!, 1);
    const view = detailLines(state, 11, layout.detailWidth, "unicode-wide", layout.wide);
    assert.ok(view.lines.every(line => measureEditText(fitLine(line, layout.detailWidth, "unicode-wide"), { widthMethod: "unicode-wide" }) <= layout.detailWidth));
    assert.match(view.lines[view.selectedLine]!, /▌ #12 \[draft\]/);
    assert.equal(view.lines.filter(line => /Review Changes requested/.test(line)).length, 1);
    const capacity = detailViewport(view, 0, layout.detailHeight).scrollHeight;
    const offset = scrollToLine(0, view.selectedLine, capacity);
    const visible = detailViewport(view, offset, layout.detailHeight).rows.map(row => row.text);
    assert.ok(visible.some(line => /▌ #12 \[draft\]/.test(line)));
    assert.ok(visible.some(line => /SELECTED PR #12 · draft/.test(line)));
    assert.ok(visible.some(line => /Checks Pending/.test(line)));
    assert.ok(visible.every(line => measureEditText(line, { widthMethod: "unicode-wide" }) <= layout.detailWidth));
  }
});

test("PR list shows one row per PR and distinguishes open, draft, no checks and unavailable details", () => {
  const state = projectState(0);
  state.github = { kind: "available", issues: 1, pullRequests: [
    { number: 1, title: "Open  PR", url: "https://github.com/example/pull/1", review: null, checks: "no checks", draft: false },
    { number: 2, title: "Draft 界界 👩‍💻 e\u0301", url: "https://github.com/example/pull/2", review: "REVIEW_REQUIRED", checks: null, draft: true },
  ] };
  const open = detailLines(state, 0, 42, "unicode-wide");
  assert.match(open.lines.join("\n"), /#1 \[open\] Open  PR.*#2 \[draft\] Draft 界界 👩‍💻 e\u0301/s);
  assert.match(open.lines.join("\n"), /SELECTED PR #1 · open.*Review unavailable.*Checks no checks/s);
  assert.equal(open.lines.filter(line => /Review /.test(line)).length, 1);
  const draft = detailLines(state, 1, 42, "unicode-wide");
  assert.match(draft.lines.join("\n"), /SELECTED PR #2 · draft.*Review REVIEW_REQUIRED.*Checks unavailable/s);
  const tiny = detailViewport(draft, draft.selectedContextStart!, 2);
  assert.equal(tiny.scrollHeight, 2);
  assert.ok(tiny.rows.some(row => row.text.includes("SELECTED PR #2")));
  assert.ok(detailViewport(draft, draft.selectedContextStart! + 1, 2).rows.some(row => row.text.includes("Checks unavailable")));
  assert.equal(detailLines(state, -1, 42).selectedContextStart, undefined);
  state.github = { kind: "available", issues: 1, pullRequests: [] };
  assert.doesNotMatch(detailLines(state, -1, 42).lines.join("\n"), /SELECTED PR|PULL REQUESTS/);
});

test("PR title clipping preserves graphemes and markers without overflow", () => {
  const state = projectState(0);
  state.github = { kind: "available", issues: 0, pullRequests: [
    { number: 123, title: "Supercalifragilistic 界界 👩‍💻 e\u0301 end", url: "https://github.com/example/pull/123", review: null, checks: null, draft: true },
  ] };
  for (const width of [24, 42, 56, 80]) {
    const view = detailLines(state, 0, width, "unicode-wide");
    const row = view.lines[view.selectedLine]!;
    assert.match(row, /#123 \[draft\]/);
    assert.ok(measureEditText(row, { widthMethod: "unicode-wide" }) <= width);
    assert.equal(view.lines.filter(line => line.includes("#123 [draft]")).length, 1);
  }
});

test("footer uses complete relevant hints at each target width", () => {
  const state = projectState(0);
  state.project.repository = "example/repo";
  state.github = { kind: "available", issues: 0, pullRequests: [
    { number: 1, title: "A", url: "https://github.com/example/repo/pull/1", review: null, checks: null, draft: false },
  ] };
  for (const width of [120, 100, 80, 56, 42]) {
    const normal = shortcutFooter(width, false, state, -1, "unicode-wide");
    const selected = shortcutFooter(width, false, state, 0, "unicode-wide");
    const help = shortcutFooter(width, true, state, 0, "unicode-wide");
    for (const line of [normal, selected, help]) {
      assert.ok(measureEditText(line, { widthMethod: "unicode-wide" }) <= width);
      assert.match(line, /q quit/);
      assert.match(line, /\? (help|close help)/);
      assert.doesNotMatch(line, /…/);
    }
    assert.match(selected, /p open PR/);
    assert.doesNotMatch(normal, /p open PR/);
  }
  state.github = { kind: "available", issues: 0, pullRequests: [] };
  assert.doesNotMatch(shortcutFooter(120, false, state, -1), /PR/);
  state.github = { kind: "stale", previous: { kind: "available", issues: 0, pullRequests: [{ number: 1, title: "A", url: "https://github.com/example/repo/pull/1", review: null, checks: null, draft: false }] }, reason: "Offline" };
  assert.doesNotMatch(shortcutFooter(120, false, state, 0), /p open PR|Tab select PR/);
  assert.equal(shortcutFooter(3, false, state, -1), "? q");
  assert.equal(shortcutFooter(120, false, undefined, -1), "? help · q quit");
});

test("delayed feedback is attributed to its project", () => {
  const result = { kind: "error" as const, text: "Editor failed for Project 1.", projectId: "p1" };
  assert.deepEqual(feedbackForSelection(result, "p1"), result);
  assert.deepEqual(feedbackForSelection(result, "p2"), { kind: "info", text: "Select a project to view its current status." });
});
