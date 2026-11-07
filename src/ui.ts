import { BoxRenderable, TextRenderable, StyledText, bg, bold, fg, createCliRenderer, measureEditText, type KeyEvent, type WidthMethod } from "@opentui/core";
import { ProjectActions } from "./actions.js";
import type { ProjectState } from "./domain.js";
import { GithubRefresh, loadProjectStates } from "./projects.js";
import { loadConfiguration, RegistryError } from "./registry.js";

function safeText(value: string): string { return value.replace(/[\x00-\x1f\x7f-\x9f]/g, " "); }

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function fitLine(value: string, width: number, widthMethod: WidthMethod = "unicode"): string {
  const text = safeText(value);
  if (width <= 0) return "";
  const measure = (candidate: string) => measureEditText(candidate, { widthMethod });
  if (measure(text) <= width) return text;
  const ellipsis = "…";
  const budget = Math.max(0, width - measure(ellipsis));
  const segments = Array.from(graphemes.segment(text), part => part.segment);
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(segments.slice(0, middle).join("")) <= budget) low = middle;
    else high = middle - 1;
  }
  return segments.slice(0, low).join("") + ellipsis;
}

export function visibleWindow(total: number, selected: number, height: number): number {
  if (total <= 0 || height <= 0) return 0;
  const index = clampSelection(selected, total);
  return Math.max(0, Math.min(index - Math.floor(height / 2), total - height));
}

export function clampSelection(selected: number, count: number): number {
  return count <= 0 ? 0 : Math.max(0, Math.min(count - 1, selected));
}

export function navigatorRow(state: ProjectState, width: number, selected: boolean, widthMethod: WidthMethod = "unicode") {
  const measure = (value: string) => measureEditText(value, { widthMethod });
  const git = state.git;
  const status = git.kind === "available" ? (git.clean ? "clean" : "dirty")
    : git.kind === "loading" ? "git…" : git.kind === "stale" ? "git stale" : "git n/a";
  const branch = git.kind === "available" ? git.branch : git.kind === "stale" ? git.previous.branch : "";
  const remote = state.project.repository && state.github.kind !== "available"
    ? state.github.kind === "loading" ? " GH…" : state.github.kind === "stale" ? " GH~" : " GH!" : "";
  const marker = selected ? "▌ " : "  ";
  const available = Math.max(0, width - measure(marker));
  let suffix = `  ${status}${remote}`;
  const branchWidth = Math.min(12, available - 10 - measure(`   · ${status}${remote}`));
  if (branch && branchWidth >= 4) suffix = `  ${fitLine(branch, branchWidth, widthMethod)} · ${status}${remote}`;
  if (measure(suffix) > available - 8) suffix = `  ${status}`;
  if (measure(suffix) > available - 4) suffix = "";
  const name = fitLine(state.project.name, available - measure(suffix), widthMethod);
  const text = fitLine(marker + name + suffix, width, widthMethod);
  const padding = selected ? " ".repeat(Math.max(0, width - measure(text))) : "";
  return { text: text + padding, status, selected };
}

export function navigatorEntry(state: ProjectState, width: number, selected: boolean, widthMethod: WidthMethod = "unicode") {
  const measure = (value: string) => measureEditText(value, { widthMethod });
  const marker = selected ? "▌ " : "  ";
  const metadataMarker = "  ";
  const contentWidth = Math.max(0, width - measure(marker));
  const name = fitLine(state.project.name, contentWidth, widthMethod);
  const nameLine = fitLine(marker + name, width, widthMethod);
  const git = state.git;
  const status = git.kind === "available" ? git.clean ? "clean" : "dirty"
    : git.kind === "loading" ? "loading" : git.kind === "stale" ? "stale" : "unavailable";
  const branch = git.kind === "available" ? git.branch : git.kind === "stale" ? git.previous.branch : "";
  const remote = state.project.repository && state.github.kind !== "available"
    ? state.github.kind === "loading" ? " GH…" : state.github.kind === "stale" ? " GH~" : " GH!" : "";
  const statusText = fitLine(git.kind === "available" ? `${selected && git.clean ? "✓" : "●"} ${status}` : status, contentWidth, widthMethod);
  const statusStart = Math.max(measure(marker), width - measure(statusText));
  const leftWidth = Math.max(0, statusStart - measure(metadataMarker) - 2);
  const remoteText = remote && leftWidth >= measure(remote) + 5 ? remote : "";
  const branchText = fitLine(branch ? `⎇ ${branch}` : git.kind === "loading" ? "Git…" : git.kind === "unavailable" ? "Git n/a" : "", leftWidth - measure(remoteText), widthMethod);
  const left = metadataMarker + branchText + remoteText;
  const spacing = " ".repeat(Math.max(0, statusStart - measure(left)));
  const metadataLine = fitLine(left + spacing + statusText, width, widthMethod);
  const pad = (line: string) => line + " ".repeat(Math.max(0, width - measure(line)));
  return { nameLine: pad(nameLine), metadataLine: pad(metadataLine), marker, metadataMarker, name,
    namePadding: " ".repeat(Math.max(0, width - measure(nameLine))),
    branchText, remoteText, spacing, statusText,
    metadataPadding: " ".repeat(Math.max(0, width - measure(metadataLine))),
    status, statusStart, selected };
}

export function navigatorHeadingText(count: number, width: number, widthMethod: WidthMethod = "unicode"): string {
  const label = "PROJECTS";
  const total = `${count} project${count === 1 ? "" : "s"}`;
  const measure = (value: string) => measureEditText(value, { widthMethod });
  if (measure(label + " " + total) > width) return fitLine(label, width, widthMethod);
  return label + " ".repeat(width - measure(label) - measure(total)) + total;
}

export function navigatorHeadingHeight(wide: boolean, height: number): number {
  return wide && height > 1 ? height >= 14 ? 2 : 1 : 0;
}

export function navigatorView(states: ProjectState[], selected: number, height: number, width: number, widthMethod: WidthMethod = "unicode") {
  const index = clampSelection(selected, states.length);
  const twoLine = height >= 2 && width >= 4;
  const gap = twoLine && height >= 12 && states.length > 1 ? 1 : 0;
  const entryHeight = twoLine ? 2 + gap : 1;
  const capacity = Math.max(0, Math.floor((height + gap) / entryHeight));
  const start = visibleWindow(states.length, index, capacity);
  const entries = states.slice(start, start + capacity).map((state, offset) =>
    twoLine ? navigatorEntry(state, width, start + offset === index, widthMethod)
      : navigatorRow(state, width, start + offset === index, widthMethod));
  return { index, start, entries, twoLine, gap, capacity };
}

export function navigatorContent(view: ReturnType<typeof navigatorView>, width: number, widthMethod: WidthMethod, heading?: string, headingGap = 0): StyledText {
  const chunks = [];
  if (heading) chunks.push(fg("#849bab")(fitLine(heading, width, widthMethod) + "\n".repeat(1 + headingGap)));
  if (view.entries.length === 0) chunks.push(fg("#849bab")(fitLine("No projects configured", width, widthMethod)));
  view.entries.forEach((entry, index) => {
    if (index > 0) chunks.push(fg("#849bab")("\n".repeat(1 + view.gap)));
    const selectedBg = entry.selected ? "#29465c" : undefined;
    const styled = (value: string, color: string, strong = false) => {
      const chunk = fg(color)(strong ? bold(value) : value);
      return selectedBg ? bg(selectedBg)(chunk) : chunk;
    };
    if ("nameLine" in entry) {
      chunks.push(styled(fitLine(entry.marker, width, widthMethod), entry.selected ? "#f7fbff" : "#849bab"));
      chunks.push(styled(entry.name, entry.selected ? "#f7fbff" : "#d5e4ee", true));
      chunks.push(styled(entry.namePadding, entry.selected ? "#f7fbff" : "#d5e4ee"));
      chunks.push(styled("\n", "#849bab"));
      chunks.push(styled(fitLine(entry.metadataMarker, width, widthMethod) + entry.branchText + entry.remoteText + entry.spacing, entry.selected ? "#b7d0e0" : "#91a8b8"));
      const statusColor = entry.status === "clean" ? "#9bd6ac" : entry.status === "dirty" ? "#e7bd83" : "#a8b9c7";
      chunks.push(styled(entry.statusText + entry.metadataPadding, statusColor));
    } else {
      chunks.push(styled(entry.text, entry.selected ? "#f7fbff" : entry.status === "dirty" ? "#e4ba78" : "#c6d5df"));
    }
  });
  return new StyledText(chunks);
}

const WIDE_MIN_WIDTH = 88;
const WIDE_MIN_HEIGHT = 8;

export function dashboardLayout(width: number, height: number, projectCount: number) {
  const columns = Math.max(1, width);
  const rows = Math.max(1, height);
  const footerHeight = 1;
  const headerHeight = rows >= 2 ? 1 : 0;
  const statusHeight = rows >= 3 ? 1 : 0;
  const contentHeight = Math.max(0, rows - headerHeight - statusHeight - footerHeight);
  const wide = columns >= WIDE_MIN_WIDTH && rows >= WIDE_MIN_HEIGHT;
  if (wide) {
    const navigatorWidth = Math.min(42, Math.max(26, Math.floor(columns * 0.34)));
    return { wide, columns, headerHeight, statusHeight, footerHeight, contentHeight,
      navigatorWidth, dividerWidth: 1, detailWidth: columns - navigatorWidth - 1,
      navigatorHeight: contentHeight, dividerHeight: contentHeight, detailHeight: contentHeight };
  }
  const navigatorHeight = contentHeight === 0 ? 0 : Math.min(contentHeight, Math.max(1, Math.min(Math.max(2, Math.floor(contentHeight / 3)), Math.max(1, projectCount * 2))));
  const dividerHeight = contentHeight > navigatorHeight + 1 ? 1 : 0;
  return { wide, columns, headerHeight, statusHeight, footerHeight, contentHeight,
    navigatorWidth: columns, dividerWidth: columns, detailWidth: columns,
    navigatorHeight, dividerHeight, detailHeight: contentHeight - navigatorHeight - dividerHeight };
}

type DetailTone = "heading" | "title" | "muted" | "normal" | "good" | "warn" | "error" | "selected";
type DetailRow = { text: string; tone: DetailTone };

function wrapped(value: string, width: number, widthMethod: WidthMethod): string[] {
  const available = Math.max(1, width);
  const parts = Array.from(graphemes.segment(safeText(value)), part => part.segment);
  const lines: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current && measureEditText(current + part, { widthMethod }) > available) {
      lines.push(current); current = "";
    }
    current += part;
  }
  lines.push(current);
  return lines;
}

export function detailLines(state: ProjectState | undefined, selectedPr: number, width = 80, widthMethod: WidthMethod = "unicode"): { lines: string[]; rows: DetailRow[]; selectedLine: number } {
  const rows: DetailRow[] = [];
  const add = (text: string, tone: DetailTone = "normal") => rows.push({ text, tone });
  const section = (label: string) => { if (rows.length) add("", "muted"); add(`  ${label}`, "heading"); };
  if (!state) { add("  No projects configured. Add a project to the registry.", "muted"); return { lines: rows.map(row => row.text), rows, selectedLine: 0 }; }
  add(`  ${safeText(state.project.name)}`, "title");
  add(`  ${safeText(state.project.lifecycle)}  ·  ${safeText(state.project.path)}`, "muted");
  section("NEXT ACTION");
  for (const line of wrapped(state.project.nextAction ?? "Not set", Math.max(1, width - 4), widthMethod)) add(`    ${line}`, state.project.nextAction ? "normal" : "muted");
  section("LOCAL GIT");
  const git = state.git;
  if (git.kind === "loading") add("    Loading Git state…", "muted");
  else if (git.kind === "unavailable") add(`    Unavailable · ${safeText(git.reason)}`, "error");
  else if (git.kind === "stale") add(`    Stale · ${safeText(git.previous.branch)} · ${safeText(git.reason)}`, "warn");
  else {
    add(`    ${git.detached ? "Detached HEAD" : `Branch ${safeText(git.branch)}`}  ·  ${git.clean ? "Clean" : "Dirty"}`, git.clean ? "good" : "warn");
    if (!git.clean) add(`    ${[git.staged && "staged", git.unstaged && "unstaged", git.untracked && "untracked"].filter(Boolean).join(" · ")}`, "muted");
  }
  section("GITHUB");
  const remote = state.github;
  const data = remote.kind === "available" ? remote : remote.kind === "stale" || remote.kind === "loading" ? remote.previous : undefined;
  if (remote.kind === "unavailable") add(`    Unavailable · ${safeText(remote.reason)}`, "error");
  else {
    if (remote.kind === "loading") add(`    Loading${data ? " · previous data below" : "…"}`, "muted");
    if (remote.kind === "stale") add(`    Stale · ${safeText(remote.reason)}`, "warn");
    if (data) add(`    ${data.issues} open issues  ·  ${data.pullRequests.length} open PRs${remote.kind === "available" ? "" : " (previous)"}`, remote.kind === "available" ? "normal" : "warn");
  }
  let selectedLine = 0;
  if (data?.pullRequests.length) {
    section("PULL REQUESTS");
    data.pullRequests.forEach((pr, index) => {
      if (index > 0) add("", "muted");
      if (index === selectedPr) selectedLine = rows.length;
      const prefix = `${index === selectedPr ? "  ▌" : "   "} #${pr.number} `;
      const suffix = pr.draft ? " [draft]" : "";
      const titleWidth = Math.max(1, width - measureEditText(prefix + suffix, { widthMethod }));
      const titleLines = wrapped(pr.title, titleWidth, widthMethod);
      titleLines.forEach((line, lineIndex) => add(`${lineIndex === 0 ? prefix : "      "}${line}${lineIndex === 0 ? suffix : ""}`, index === selectedPr ? "selected" : "normal"));
      add(`      Review ${safeText(pr.review ?? "unavailable")}  ·  Checks ${safeText(pr.checks ?? "unavailable")}`, "muted");
    });
  }
  if (width >= 38) { section("QUICK ACTIONS"); add("    f files  ·  e editor  ·  t terminal  ·  g repo  ·  p PR", "muted"); }
  return { lines: rows.map(row => row.text), rows, selectedLine };
}

export function scrollToLine(offset: number, line: number, height: number): number {
  if (height <= 0) return Math.max(0, line);
  return line < offset ? line : line >= offset + height ? line - height + 1 : offset;
}

export type Feedback = { kind: "loading" | "success" | "error" | "unavailable" | "info"; text: string; projectId?: string };
export function feedbackForSelection(feedback: Feedback, projectId?: string): Feedback {
  return feedback.projectId && feedback.projectId !== projectId ? { kind: "info", text: "Select a project to view its current status." } : feedback;
}

export function moveSelection(selected: number, count: number, direction: "up" | "down"): number {
  return clampSelection(clampSelection(selected, count) + (direction === "up" ? -1 : 1), count);
}

export function moveProjectSelection(selected: number, selectedPr: number, count: number, direction: "up" | "down") {
  const next = moveSelection(selected, count, direction);
  return { selected: next, selectedPr: next === selected ? selectedPr : -1 };
}

export function projectLoadNotice(phase: "registry" | "loading" | "ready", count = 0): string {
  if (phase === "registry") return "Loading project registry…";
  if (count === 0) return "No projects configured.";
  return `${phase === "loading" ? "Loading" : "Ready:"} ${count} project${count === 1 ? "" : "s"}${phase === "loading" ? "…" : "."}`;
}

type ProjectActionKey = "e" | "t" | "f" | "g" | "p";

export function isProjectActionKey(key: string): key is ProjectActionKey {
  return key === "e" || key === "t" || key === "f" || key === "g" || key === "p";
}

export function projectActionForKey(key: ProjectActionKey, actions: ProjectActions, state: ProjectState, selectedPr: number): { action: Promise<void>; launched: string } {
  const project = state.project;
  switch (key) {
    case "e": return { action: actions.editor(project), launched: "VS Code" };
    case "t": return { action: actions.terminal(project), launched: "Terminal" };
    case "f": return { action: actions.fileManager(project), launched: "File manager opener" };
    case "g": return { action: actions.repository(project), launched: "Repository opener" };
    case "p": {
      const pr = state.github.kind === "available" ? state.github.pullRequests[selectedPr] : undefined;
      return { action: pr ? actions.pullRequest(project, pr) : Promise.reject(new Error("Select an available PR with Tab first.")), launched: `PR #${pr?.number} opener` };
    }
  }
}

export async function runDashboard(): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let destroyed = false;
  let states: ProjectState[] = [];
  let selected = 0;
  let selectedPr = -1;
  let showingHelp = false;
  let feedback: Feedback = { kind: "loading", text: projectLoadNotice("registry") };
  let registryLoaded = false;
  let initialLoadPending = true;
  let actionPending = false;
  let detailOffset = 0;
  const refresh = new GithubRefresh();
  let actions: ProjectActions | undefined;
  const layout = new BoxRenderable(renderer, { flexDirection: "column", gap: 0, width: "100%", height: "100%" });
  const title = new TextRenderable(renderer, { content: "Wolf Den", fg: "#9fd4ff" });
  const panels = new BoxRenderable(renderer, { flexDirection: "row", gap: 0, width: "100%" });
  const list = new TextRenderable(renderer, { content: "", fg: "#ffffff" });
  const divider = new TextRenderable(renderer, { content: "", fg: "#668198" });
  const detail = new TextRenderable(renderer, { content: "", fg: "#d6e4ee" });
  const message = new TextRenderable(renderer, { content: "", fg: "#ffd58a" });
  const footer = new TextRenderable(renderer, { content: "", fg: "#9aa9b7" });
  layout.add(title);
  panels.add(list);
  panels.add(divider);
  panels.add(detail);
  layout.add(panels);
  layout.add(message);
  layout.add(footer);
  renderer.root.add(layout);

  const render = () => {
    if (destroyed) return;
    const dimensions = dashboardLayout(renderer.terminalWidth, renderer.terminalHeight, states.length);
    panels.flexDirection = dimensions.wide ? "row" : "column";
    title.height = dimensions.headerHeight;
    panels.height = dimensions.contentHeight;
    list.width = dimensions.navigatorWidth; list.height = dimensions.navigatorHeight;
    divider.width = dimensions.dividerWidth; divider.height = dimensions.dividerHeight;
    detail.width = dimensions.detailWidth; detail.height = dimensions.detailHeight;
    message.height = dimensions.statusHeight; footer.height = dimensions.footerHeight;
    title.content = fitLine("🐺 Wolf Den", dimensions.columns, renderer.widthMethod);
    const navigatorHeadingRows = navigatorHeadingHeight(dimensions.wide, dimensions.navigatorHeight);
    const navigatorRows = dimensions.navigatorHeight - navigatorHeadingRows;
    const navigator = navigatorView(states, selected, navigatorRows, dimensions.navigatorWidth, renderer.widthMethod);
    selected = navigator.index;
    list.content = navigatorContent(navigator, dimensions.navigatorWidth, renderer.widthMethod,
      navigatorHeadingRows ? navigatorHeadingText(states.length, dimensions.navigatorWidth, renderer.widthMethod) : undefined,
      navigatorHeadingRows - 1);
    divider.content = dimensions.wide ? Array(dimensions.dividerHeight).fill("│").join("\n") : "─".repeat(dimensions.dividerWidth);
    const view = showingHelp
      ? { lines: ["Keyboard shortcuts", "↑/↓  Select project", "Tab  Select next PR", "e  Open project in VS Code", "t  Open terminal in project", "f  Open project in file manager", "g  Open GitHub repository", "p  Open selected PR", "r  Refresh selected project's GitHub data", "PgUp/PgDn  Scroll details", "?  Close help", "q / Esc / Ctrl+C  Quit"], selectedLine: 0 }
      : registryLoaded ? detailLines(states[selected], selectedPr, dimensions.detailWidth, renderer.widthMethod) : { lines: [feedback.text], selectedLine: 0 };
    detailOffset = Math.min(detailOffset, Math.max(0, view.lines.length - dimensions.detailHeight));
    const tones: Record<DetailTone, string> = { heading: "#849bab", title: "#f0f7fc", muted: "#91a8b8", normal: "#d6e4ee", good: "#9bd6ac", warn: "#e7bd83", error: "#ed9a9a", selected: "#f7fbff" };
    detail.content = "rows" in view && view.rows
      ? new StyledText(view.rows.slice(detailOffset, detailOffset + dimensions.detailHeight).flatMap((row, index, visible) => {
          const line = fitLine(row.text, dimensions.detailWidth, renderer.widthMethod);
          const content = row.tone === "title" || row.tone === "heading" || row.tone === "selected" ? bold(line) : line;
          const styled = fg(tones[row.tone])(row.tone === "selected" ? bg("#29465c")(content) : content);
          return index === visible.length - 1 ? [styled] : [styled, fg(tones.muted)("\n")];
        }))
      : view.lines.slice(detailOffset, detailOffset + dimensions.detailHeight).map(line => fitLine(line, dimensions.detailWidth, renderer.widthMethod)).join("\n");
    const shown = feedbackForSelection(feedback, states[selected]?.project.id);
    const labels = { loading: "…", success: "✓", error: "!", unavailable: "!", info: "·" };
    const colors = { loading: "#9fc8de", success: "#9bd6ac", error: "#ed9a9a", unavailable: "#e7bd83", info: "#a8b9c7" };
    message.fg = colors[shown.kind];
    message.content = fitLine(`${labels[shown.kind]} ${shown.text}`, dimensions.columns, renderer.widthMethod);
    const shortcuts = dimensions.columns < 18 ? "? q" : dimensions.columns < 45
      ? "? help · q quit · ↑/↓ project · Tab PR"
      : "? help · q quit · ↑/↓ project · f files · e editor · t terminal · Tab PR · PgUp/PgDn scroll · g repo · p PR · r refresh";
    footer.content = fitLine(shortcuts, dimensions.columns, renderer.widthMethod);
  };
  const onKey = (key: KeyEvent) => {
    if (key.name === "q" || key.name === "escape") { renderer.destroy(); return; }
    if (key.name === "?") { showingHelp = !showingHelp; detailOffset = 0; render(); return; }
    if (key.name === "pageup" || key.name === "pagedown") { detailOffset = Math.max(0, detailOffset + (key.name === "pageup" ? -5 : 5)); render(); return; }
    if (showingHelp) return;
    const state = states[selected];
    if (key.name === "tab") {
      const data = state?.github.kind === "available" ? state.github : undefined;
      if (!data?.pullRequests.length) { feedback = { kind: "unavailable", text: "No available PRs to select for this project.", projectId: state?.project.id }; render(); return; }
      selectedPr = (selectedPr + 1) % data.pullRequests.length;
      detailOffset = scrollToLine(detailOffset, detailLines(state, selectedPr, dashboardLayout(renderer.terminalWidth, renderer.terminalHeight, states.length).detailWidth, renderer.widthMethod).selectedLine, dashboardLayout(renderer.terminalWidth, renderer.terminalHeight, states.length).detailHeight);
      feedback = { kind: "info", text: `Selected PR #${data.pullRequests[selectedPr]!.number}.`, projectId: state!.project.id };
      render(); return;
    }
    if (key.name === "r") {
      if (!state || initialLoadPending) { feedback = { kind: "unavailable", text: "No project is ready for refresh." }; render(); return; }
      if (!state.project.repository) { feedback = { kind: "unavailable", text: "No GitHub repository configured for this project.", projectId: state.project.id }; render(); return; }
      if (state.github.kind === "loading") { feedback = { kind: "loading", text: `GitHub refresh is already in progress for ${safeText(state.project.name)}.`, projectId: state.project.id }; render(); return; }
      selectedPr = -1;
      feedback = { kind: "loading", text: `Refreshing GitHub for ${safeText(state.project.name)}…`, projectId: state.project.id }; render();
      void refresh.refresh(state, github => { if (!destroyed) { state.github = github; if (github.kind !== "loading" && states[selected]?.project.id === state.project.id) feedback = { kind: github.kind === "available" ? "success" : "unavailable", text: github.kind === "available" ? `GitHub refreshed for ${safeText(state.project.name)}.` : `GitHub ${github.kind} for ${safeText(state.project.name)}: ${safeText(github.reason)}`, projectId: state.project.id }; render(); } });
      return;
    }
    if (isProjectActionKey(key.name)) {
      if (!state || initialLoadPending || !actions) { feedback = { kind: "unavailable", text: "No project is ready for actions." }; render(); return; }
      if (actionPending) { feedback = { kind: "loading", text: "An action is already launching." }; render(); return; }
      actionPending = true;
      feedback = { kind: "loading", text: `Launching action for ${safeText(state.project.name)}…`, projectId: state.project.id }; render();
      const { action, launched } = projectActionForKey(key.name, actions, state, selectedPr);
      void action.then(() => { if (!destroyed && states[selected]?.project.id === state.project.id) { feedback = { kind: "success", text: `${launched} launched for ${safeText(state.project.name)}.`, projectId: state.project.id }; render(); } })
        .catch((error: unknown) => { if (!destroyed && states[selected]?.project.id === state.project.id) { feedback = { kind: "error", text: `${launched} for ${safeText(state.project.name)} failed: ${error instanceof Error ? safeText(error.message) : "Action failed."}`, projectId: state.project.id }; render(); } })
        .finally(() => { actionPending = false; });
      return;
    }
    if (key.name === "up" || key.name === "down") {
      const next = moveProjectSelection(selected, selectedPr, states.length, key.name);
      if (next.selected !== selected) detailOffset = 0;
      selected = next.selected; selectedPr = next.selectedPr;
      feedback = states[selected] ? { kind: "info", text: `Selected ${safeText(states[selected]!.project.name)}.`, projectId: states[selected]!.project.id } : { kind: "info", text: projectLoadNotice("ready") };
    }
    else return;
    render();
  };
  renderer.keyInput.on("keypress", onKey);
  renderer.on("resize", render);
  const onRendererError = () => {
    if (!destroyed) {
      renderer.destroy();
      process.stderr.write("Wolf Den stopped after a terminal rendering error.\n");
      process.exitCode = 1;
    }
  };
  renderer.on("render:error", onRendererError);
  renderer.on("handler:error", onRendererError);
  renderer.once("destroy", () => {
    destroyed = true;
    renderer.keyInput.off("keypress", onKey);
    renderer.off("resize", render);
    renderer.off("render:error", onRendererError);
    renderer.off("handler:error", onRendererError);
  });
  render();

  try {
    const configuration = await loadConfiguration();
    if (destroyed) return;
    actions = new ProjectActions(undefined, undefined, configuration.settings.terminal);
    const projects = configuration.projects;
    registryLoaded = true;
    states = projects.map(project => ({ project, git: { kind: "loading" }, github: project.repository ? { kind: "loading" } : { kind: "unavailable", reason: "No GitHub repository configured." } }));
    feedback = { kind: "loading", text: projectLoadNotice("loading", projects.length) };
    render();
    states = await loadProjectStates(projects, undefined, undefined, (state, index) => {
      if (!destroyed) { states[index] = state; render(); }
    });
    if (destroyed) return;
    initialLoadPending = false;
    feedback = { kind: "success", text: projectLoadNotice("ready", states.length) };
    render();
  } catch (error) {
    if (destroyed) return;
    feedback = { kind: "error", text: error instanceof RegistryError ? error.message : "Could not load project data." };
    render();
  }
}
