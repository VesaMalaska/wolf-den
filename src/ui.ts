import { BoxRenderable, TextRenderable, StyledText, bg, bold, fg, createCliRenderer, measureEditText, type KeyEvent, type WidthMethod } from "@opentui/core";
import { ProjectActions } from "./actions.js";
import type { ProjectState } from "./domain.js";
import { GithubRefresh, loadProjectStates } from "./projects.js";
import { loadRegistry, RegistryError } from "./registry.js";

function gitLabel(state: ProjectState): string {
  const git = state.git;
  if (git.kind === "loading") return "Loading Git state…";
  if (git.kind === "unavailable") return `Git unavailable: ${git.reason}`;
  if (git.kind === "stale") return `Git stale: ${git.reason}`;
  return `${git.branch} · ${git.clean ? "clean" : "dirty"}`;
}

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
  const contentWidth = Math.max(0, width - measure(marker));
  const name = fitLine(state.project.name, contentWidth, widthMethod);
  const nameLine = fitLine(marker + name, width, widthMethod);
  const git = state.git;
  const status = git.kind === "available" ? git.clean ? "clean" : "dirty"
    : git.kind === "loading" ? "loading" : git.kind === "stale" ? "stale" : "unavailable";
  const branch = git.kind === "available" ? git.branch : git.kind === "stale" ? git.previous.branch : "";
  const remote = state.project.repository && state.github.kind !== "available"
    ? state.github.kind === "loading" ? " GH…" : state.github.kind === "stale" ? " GH~" : " GH!" : "";
  const statusText = fitLine(status, contentWidth, widthMethod);
  const statusStart = Math.max(measure(marker), width - measure(statusText));
  const leftWidth = Math.max(0, statusStart - measure(marker) - 2);
  const remoteText = remote && leftWidth >= measure(remote) + 5 ? remote : "";
  const branchText = fitLine(branch || (git.kind === "loading" ? "Git…" : git.kind === "unavailable" ? "Git n/a" : ""), leftWidth - measure(remoteText), widthMethod);
  const left = marker + branchText + remoteText;
  const spacing = " ".repeat(Math.max(0, statusStart - measure(left)));
  const metadataLine = fitLine(left + spacing + statusText, width, widthMethod);
  const pad = (line: string) => line + " ".repeat(Math.max(0, width - measure(line)));
  return { nameLine: pad(nameLine), metadataLine: pad(metadataLine), marker, name,
    namePadding: " ".repeat(Math.max(0, width - measure(nameLine))),
    branchText, remoteText, spacing, statusText,
    metadataPadding: " ".repeat(Math.max(0, width - measure(metadataLine))),
    status, statusStart, selected };
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

export function navigatorContent(view: ReturnType<typeof navigatorView>, width: number, widthMethod: WidthMethod, heading?: string): StyledText {
  const chunks = [];
  if (heading) chunks.push(fg("#849bab")(fitLine(heading, width, widthMethod) + "\n"));
  if (view.entries.length === 0) chunks.push(fg("#849bab")(fitLine("No projects configured", width, widthMethod)));
  view.entries.forEach((entry, index) => {
    if (index > 0) chunks.push(fg("#849bab")("\n".repeat(1 + view.gap)));
    const selectedBg = entry.selected ? "#29465c" : undefined;
    const styled = (value: string, color: string, strong = false) => {
      const chunk = fg(color)(strong ? bold(value) : value);
      return selectedBg ? bg(selectedBg)(chunk) : chunk;
    };
    if ("nameLine" in entry) {
      chunks.push(styled(fitLine(entry.marker, width, widthMethod), entry.selected ? "#8ac4eb" : "#849bab"));
      chunks.push(styled(entry.name, entry.selected ? "#f7fbff" : "#d5e4ee", true));
      chunks.push(styled(entry.namePadding, entry.selected ? "#f7fbff" : "#d5e4ee"));
      chunks.push(styled("\n", "#849bab"));
      chunks.push(styled(fitLine(entry.marker, width, widthMethod) + entry.branchText + entry.remoteText + entry.spacing, entry.selected ? "#b7d0e0" : "#91a8b8"));
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

function githubLabel(state: ProjectState): string {
  const remote = state.github;
  if (remote.kind === "unavailable") return `GitHub unavailable: ${remote.reason}`;
  if (remote.kind === "loading") return `GitHub loading…${remote.previous ? " (previous data shown below)" : ""}`;
  const data = remote.kind === "stale" ? remote.previous : remote;
  const counts = `${data.issues} open issues · ${data.pullRequests.length} open PRs`;
  return remote.kind === "stale" ? `GitHub stale: ${counts} · ${remote.reason}` : `GitHub: ${counts}`;
}

export function detailLines(state: ProjectState | undefined, selectedPr: number): { lines: string[]; selectedLine: number } {
  if (!state) return { lines: ["No projects configured. Add a project to the registry."], selectedLine: 0 };
  const git = state.git;
  const changes = git.kind === "available"
    ? `Changes: ${git.clean ? "none" : [git.staged && "staged", git.unstaged && "unstaged", git.untracked && "untracked"].filter(Boolean).join(", ")}`
    : "";
  const remote = state.github;
  const data = remote.kind === "available" ? remote : remote.kind === "stale" || remote.kind === "loading" ? remote.previous : undefined;
  const lines = [safeText(state.project.name), `Lifecycle: ${safeText(state.project.lifecycle)}`, `Next action: ${safeText(state.project.nextAction ?? "Not set")}`, `Directory: ${safeText(state.project.path)}`, gitLabel(state), changes, githubLabel(state)].filter(Boolean);
  let selectedLine = 0;
  data?.pullRequests.forEach((pr, index) => {
    if (index === selectedPr) selectedLine = lines.length;
    lines.push(`${index === selectedPr ? ">" : " "} #${pr.number} ${safeText(pr.title)}${pr.draft ? " [draft]" : ""}`);
    lines.push(`  Review: ${safeText(pr.review ?? "unavailable")} · Checks: ${safeText(pr.checks ?? "unavailable")}`);
    lines.push(`  ${pr.url}`);
  });
  return { lines, selectedLine };
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

export async function runDashboard(): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let destroyed = false;
  let states: ProjectState[] = [];
  let selected = 0;
  let selectedPr = -1;
  let showingHelp = false;
  let notice = projectLoadNotice("registry");
  let registryLoaded = false;
  let initialLoadPending = true;
  let actionPending = false;
  let detailOffset = 0;
  const refresh = new GithubRefresh();
  const actions = new ProjectActions();
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
    const navigatorHeading = dimensions.wide && dimensions.navigatorHeight > 1 ? 1 : 0;
    const navigatorRows = dimensions.navigatorHeight - navigatorHeading;
    const navigator = navigatorView(states, selected, navigatorRows, dimensions.navigatorWidth, renderer.widthMethod);
    selected = navigator.index;
    list.content = navigatorContent(navigator, dimensions.navigatorWidth, renderer.widthMethod,
      navigatorHeading ? `Projects ${states.length ? `${selected + 1}/${states.length}` : ""}` : undefined);
    divider.content = dimensions.wide ? Array(dimensions.dividerHeight).fill("│").join("\n") : "─".repeat(dimensions.dividerWidth);
    const view = showingHelp
      ? { lines: ["Keyboard shortcuts", "↑/↓  Select project", "Tab  Select next PR", "e  Open project in VS Code", "o  Open terminal in project", "g  Open GitHub repository", "p  Open selected PR", "r  Refresh selected project's GitHub data", "PgUp/PgDn  Scroll details", "?  Close help", "q / Esc / Ctrl+C  Quit"], selectedLine: 0 }
      : registryLoaded ? detailLines(states[selected], selectedPr) : { lines: [notice], selectedLine: 0 };
    detailOffset = Math.min(detailOffset, Math.max(0, view.lines.length - dimensions.detailHeight));
    detail.content = view.lines.slice(detailOffset, detailOffset + dimensions.detailHeight).map(line => fitLine(line, dimensions.detailWidth, renderer.widthMethod)).join("\n");
    message.content = fitLine(notice, dimensions.columns, renderer.widthMethod);
    const shortcuts = dimensions.columns < 18 ? "? q" : dimensions.columns < 45
      ? "? help · q quit · ↑/↓ project · Tab PR"
      : "? help · q quit · ↑/↓ project · Tab PR · PgUp/PgDn scroll · e editor · o terminal · g repo · p PR · r refresh";
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
      if (!data?.pullRequests.length) { notice = "No available PRs to select for this project."; render(); return; }
      selectedPr = (selectedPr + 1) % data.pullRequests.length;
      detailOffset = Math.max(0, detailLines(state, selectedPr).selectedLine - 2);
      notice = `Selected PR #${data.pullRequests[selectedPr]!.number}.`;
      render(); return;
    }
    if (key.name === "r") {
      if (!state || initialLoadPending) { notice = "No project is ready for refresh."; render(); return; }
      if (!state.project.repository) { notice = "No GitHub repository configured for this project."; render(); return; }
      if (state.github.kind === "loading") { notice = "GitHub refresh is already in progress."; render(); return; }
      selectedPr = -1;
      notice = `Refreshing GitHub for ${safeText(state.project.name)}…`;
      void refresh.refresh(state, github => { if (!destroyed) { state.github = github; notice = github.kind === "unavailable" || github.kind === "stale" ? github.reason : github.kind === "available" ? "GitHub refreshed." : notice; render(); } });
      return;
    }
    if (["e", "o", "g", "p"].includes(key.name)) {
      if (!state || initialLoadPending) { notice = "No project is ready for actions."; render(); return; }
      if (actionPending) { notice = "An action is already launching."; render(); return; }
      actionPending = true;
      notice = "Launching action…"; render();
      const pr = state.github.kind === "available" ? state.github.pullRequests[selectedPr] : undefined;
      const action = key.name === "e" ? actions.editor(state.project)
        : key.name === "o" ? actions.terminal(state.project)
        : key.name === "g" ? actions.repository(state.project)
        : pr ? actions.pullRequest(state.project, pr) : Promise.reject(new Error("Select an available PR with Tab first."));
      const launched = key.name === "e" ? "VS Code" : key.name === "o" ? "Terminal" : key.name === "g" ? "Repository opener" : `PR #${pr?.number} opener`;
      void action.then(() => { if (!destroyed) { notice = `${launched} launched for ${safeText(state.project.name)}.`; render(); } })
        .catch((error: unknown) => { if (!destroyed) { notice = error instanceof Error ? safeText(error.message) : "Action failed."; render(); } })
        .finally(() => { actionPending = false; });
      return;
    }
    if (key.name === "up" || key.name === "down") {
      const next = moveProjectSelection(selected, selectedPr, states.length, key.name);
      if (next.selected !== selected) detailOffset = 0;
      selected = next.selected; selectedPr = next.selectedPr;
      notice = states[selected] ? `Selected ${safeText(states[selected]!.project.name)}.` : projectLoadNotice("ready");
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
    const projects = await loadRegistry();
    if (destroyed) return;
    registryLoaded = true;
    states = projects.map(project => ({ project, git: { kind: "loading" }, github: project.repository ? { kind: "loading" } : { kind: "unavailable", reason: "No GitHub repository configured." } }));
    notice = projectLoadNotice("loading", projects.length);
    render();
    states = await loadProjectStates(projects, undefined, undefined, (state, index) => {
      if (!destroyed) { states[index] = state; render(); }
    });
    if (destroyed) return;
    initialLoadPending = false;
    notice = projectLoadNotice("ready", states.length);
    render();
  } catch (error) {
    if (destroyed) return;
    notice = error instanceof RegistryError ? error.message : "Could not load project data.";
    render();
  }
}
