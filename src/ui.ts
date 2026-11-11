import { BoxRenderable, TextRenderable, StyledText, bg, bold, fg, createCliRenderer, measureEditText, type KeyEvent, type WidthMethod } from "@opentui/core";
import { ProjectActions } from "./actions.js";
import type { GithubPullRequest, ProjectState } from "./domain.js";
import { GithubRefresh, loadProjectStates } from "./projects.js";
import { defaultRegistryPath, loadConfiguration, RegistryError } from "./registry.js";
import { RegistryPersistence } from "./registry-persistence.js";
import { SettingsSession, settingsControls } from "./settings.js";
import { resolveTheme, themeLabels, themeTokens, type SemanticTheme, type ThemeToken } from "./theme.js";

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

export function fitBranch(value: string, width: number, widthMethod: WidthMethod = "unicode"): string {
  const branch = safeText(value);
  const measure = (text: string) => measureEditText(text, { widthMethod });
  if (width <= 0) return "";
  if (measure(branch) <= width || width < 7) return fitLine(branch, width, widthMethod);
  const parts = Array.from(graphemes.segment(branch), part => part.segment);
  const suffixBudget = Math.floor((width - 1) / 2);
  let suffix = "";
  for (let index = parts.length - 1; index >= 0; index--) {
    if (measure(parts[index]! + suffix) > suffixBudget) break;
    suffix = parts[index]! + suffix;
  }
  const prefix = fitLine(branch, width - measure(suffix), widthMethod);
  return prefix.slice(0, -1) + "…" + suffix;
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
  if (branch && branchWidth >= 4) suffix = `  ${fitBranch(branch, branchWidth, widthMethod)} · ${status}${remote}`;
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
  const branchWidth = leftWidth - measure(remoteText);
  const branchText = branch && branchWidth > measure("⎇ ") ? `⎇ ${fitBranch(branch, branchWidth - measure("⎇ "), widthMethod)}`
    : branch ? fitLine("⎇", branchWidth, widthMethod)
    : fitLine(git.kind === "loading" ? "Git…" : git.kind === "unavailable" ? "Git n/a" : "", branchWidth, widthMethod);
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

export function radarSummary(states: ProjectState[]): string {
  let clean = 0, dirty = 0, loading = 0, stale = 0, unavailable = 0;
  for (const { git } of states) {
    if (git.kind === "available") git.clean ? clean++ : dirty++;
    else if (git.kind === "loading") loading++;
    else if (git.kind === "stale") stale++;
    else unavailable++;
  }
  if (states.length === 0) return "No projects configured";
  const items: string[] = [];
  if (dirty) items.push(`${dirty} dirty`);
  if (unavailable) items.push(`${unavailable} unavailable`);
  if (clean) items.push(`${clean} clean`);
  if (loading) items.push(`${loading} loading`);
  if (stale) items.push(`${stale} stale`);
  return items.join(" · ");
}

export function navigatorHeadingHeight(wide: boolean, height: number): number {
  return wide && height > 1 ? 1 : 0;
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

export function navigatorContent(view: ReturnType<typeof navigatorView>, width: number, widthMethod: WidthMethod, heading?: string, headingGap = 0, theme: SemanticTheme = resolveTheme(), summary?: string): StyledText {
  const chunks = [];
  if (heading) {
    chunks.push(fg(theme.heading)(fitLine(heading, width, widthMethod) + "\n"));
    if (headingGap) chunks.push(fg(theme.textSecondary)(fitLine(summary ?? "", width, widthMethod) + "\n"));
  }
  if (view.entries.length === 0) chunks.push(fg(theme.textMuted)(fitLine("No projects configured", width, widthMethod)));
  view.entries.forEach((entry, index) => {
    if (index > 0) chunks.push(fg(theme.textMuted)("\n".repeat(1 + view.gap)));
    const selectedBg = entry.selected ? theme.selectionBackground : undefined;
    const styled = (value: string, color: string, strong = false) => {
      const chunk = fg(color)(strong ? bold(value) : value);
      return selectedBg ? bg(selectedBg)(chunk) : chunk;
    };
    if ("nameLine" in entry) {
      chunks.push(styled(fitLine(entry.marker, width, widthMethod), entry.selected ? theme.focusBorder : theme.textMuted));
      chunks.push(styled(entry.name, entry.selected ? theme.textOnSelection : theme.textPrimary, true));
      chunks.push(styled(entry.namePadding, entry.selected ? theme.textOnSelection : theme.textPrimary));
      chunks.push(styled("\n", theme.textMuted));
      chunks.push(styled(fitLine(entry.metadataMarker, width, widthMethod) + entry.branchText + entry.remoteText + entry.spacing, entry.selected ? theme.textOnSelection : theme.textSecondary));
      const statusColor = entry.status === "clean" ? theme.success : entry.status === "dirty" ? theme.attention
        : entry.status === "loading" ? theme.info : entry.status === "stale" ? theme.attention : theme.unavailable;
      // Selected rows keep a consistently readable foreground; labels and markers retain status meaning.
      chunks.push(styled(entry.statusText + entry.metadataPadding, entry.selected ? theme.textOnSelection : statusColor));
    } else {
      chunks.push(styled(entry.text, entry.selected ? theme.textOnSelection : entry.status === "clean" ? theme.success
        : entry.status === "dirty" || entry.status === "stale" ? theme.attention : entry.status === "loading" ? theme.info : theme.unavailable));
    }
  });
  return new StyledText(chunks);
}

export function radarContent(states: ProjectState[], width: number, widthMethod: WidthMethod, theme: SemanticTheme = resolveTheme()): StyledText {
  const chunks = [fg(theme.divider)("─".repeat(Math.max(0, width)) + "\n"), fg(theme.heading)(fitLine("GIT STATUS · LOADED", width, widthMethod) + "\n")];
  let used = 0;
  for (const label of radarSummary(states).split(" · ")) {
    const part = (used ? "  " : "") + label;
    const size = measureEditText(part, { widthMethod });
    if (used + size > width) break;
    const color = label.includes("dirty") ? theme.attention : label.includes("unavailable") ? theme.unavailable
      : label.includes("clean") ? theme.success : label.includes("stale") ? theme.attention : label.includes("loading") ? theme.info : theme.textMuted;
    chunks.push(fg(color)(part));
    used += size;
  }
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
      navigatorHeight: contentHeight, radarHeight: contentHeight >= 14 ? 3 : 0,
      dividerHeight: contentHeight, detailHeight: contentHeight };
  }
  const navigatorHeight = contentHeight === 0 ? 0 : Math.min(contentHeight, Math.max(1, Math.min(Math.max(2, Math.floor(contentHeight / 3)), Math.max(1, projectCount * 2))));
  const dividerHeight = contentHeight > navigatorHeight + 1 ? 1 : 0;
  return { wide, columns, headerHeight, statusHeight, footerHeight, contentHeight,
    navigatorWidth: columns, dividerWidth: columns, detailWidth: columns,
    navigatorHeight, radarHeight: 0, dividerHeight, detailHeight: contentHeight - navigatorHeight - dividerHeight };
}

type DetailTone = "heading" | "divider" | "accent" | "accentSubtle" | "action" | "title" | "muted" | "normal" | "good" | "warn" | "error" | "unavailable" | "selected";
type DetailSpan = { text: string; tone: DetailTone; strong?: boolean };
type DetailRow = { text: string; tone: DetailTone; spans?: DetailSpan[]; surface?: "alt" };
type DetailView = { lines: string[]; rows: DetailRow[]; selectedLine: number; selectedEndLine?: number };

function boxEdge(label: string, width: number, bottom = false, widthMethod: WidthMethod = "unicode"): string {
  if (width < 4) return fitLine(label, width, widthMethod);
  if (bottom) return `╰${"─".repeat(width - 2)}╯`;
  const caption = fitLine(`─ ${label} `, width - 2, widthMethod);
  return `╭${caption}${"─".repeat(Math.max(0, width - 2 - measureEditText(caption, { widthMethod })))}╮`;
}

function boxBody(value: string, width: number, widthMethod: WidthMethod): string {
  if (width < 4) return fitLine(value, width, widthMethod);
  const content = fitLine(value, width - 4, widthMethod);
  return `│ ${content}${" ".repeat(Math.max(0, width - 4 - measureEditText(content, { widthMethod })))} │`;
}

function boxBodySpans(value: string, width: number, tone: DetailTone, widthMethod: WidthMethod, borderTone: DetailTone = "divider"): { text: string; tone: DetailTone }[] {
  if (width < 4) return [{ text: fitLine(value, width, widthMethod), tone }];
  const content = fitLine(value, width - 4, widthMethod);
  return [
    { text: "│ ", tone: borderTone },
    { text: content, tone },
    { text: " ".repeat(Math.max(0, width - 4 - measureEditText(content, { widthMethod }))) + " │", tone: borderTone },
  ];
}

function boxTopSpans(label: string, width: number, widthMethod: WidthMethod): DetailSpan[] {
  if (width < 4) return [{ text: fitLine(label, width, widthMethod), tone: "heading", strong: true }];
  const caption = fitLine(label, width - 4, widthMethod);
  return [
    { text: "╭─ ", tone: "divider" },
    { text: caption, tone: "heading", strong: true },
    { text: " ".repeat(Math.max(0, width - 4 - measureEditText(caption, { widthMethod }))) + "╮", tone: "divider" },
  ];
}

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

function prRow(pr: GithubPullRequest, selected: boolean, width: number, widthMethod: WidthMethod): string {
  const available = Math.max(0, width - (width >= 50 ? 4 : 0));
  const prefix = `${selected ? "  ▌" : "   "} #${pr.number} ${pr.draft ? "[draft]" : "[open]"} `;
  const title = fitLine(pr.title, Math.max(0, available - measureEditText(prefix, { widthMethod })), widthMethod);
  const content = fitLine(prefix + title, available, widthMethod);
  return width >= 50 ? boxBody(content, width, widthMethod) : content;
}

export function detailLines(state: ProjectState | undefined, selectedPr: number, width = 80, widthMethod: WidthMethod = "unicode", wide = false): DetailView {
  const rows: DetailRow[] = [];
  const add = (text: string, tone: DetailTone = "normal", surface?: "alt") => rows.push({ text, tone, surface });
  const addSpans = (spans: DetailSpan[], tone: DetailTone = "normal", surface?: "alt") => rows.push({ text: spans.map(span => span.text).join(""), tone, spans, surface });
  if (!state) { add("  No projects configured. Add a project to the registry.", "muted"); return { lines: rows.map(row => row.text), rows, selectedLine: 0 }; }
  const identityMarker = fitLine("  ◇ ", width, widthMethod);
  addSpans([{ text: identityMarker, tone: "accentSubtle" },
    { text: fitLine(state.project.name, Math.max(0, width - measureEditText(identityMarker, { widthMethod })), widthMethod), tone: "title", strong: true }], "title");
  const lifecycle = fitLine(`  ${safeText(state.project.lifecycle).toUpperCase()}`, width, widthMethod);
  addSpans([{ text: lifecycle, tone: "normal" },
    { text: fitLine(`  ·  ${safeText(state.project.path)}`, Math.max(0, width - measureEditText(lifecycle, { widthMethod })), widthMethod), tone: "muted" }]);
  add("  " + "─".repeat(Math.max(0, width - 2)), "divider");
  add(boxEdge("NEXT ACTION", width, false, widthMethod), "accentSubtle", "alt");
  for (const line of wrapped(state.project.nextAction ?? "Not set", Math.max(1, width - 4), widthMethod))
    addSpans(boxBodySpans(line, width, state.project.nextAction ? "action" : "muted", widthMethod, "accentSubtle"), "normal", "alt");
  add(boxEdge("", width, true, widthMethod), "accentSubtle", "alt");
  add("", "muted");
  const git = state.git;
  const local: DetailRow[] = git.kind === "loading" ? [{ text: "Loading Git state…", tone: "muted" }]
    : git.kind === "unavailable" ? [{ text: `Unavailable · ${safeText(git.reason)}`, tone: "unavailable" }]
    : git.kind === "stale" ? [{ text: `Stale · ${safeText(git.previous.branch)}`, tone: "warn" }, { text: safeText(git.reason), tone: "muted" }]
    : [{ text: git.detached ? "Detached HEAD" : `Branch ${safeText(git.branch)}`, tone: "normal" },
      { text: git.clean ? "● Clean" : "● Dirty", tone: git.clean ? "good" : "warn" },
      ...(!git.clean ? [{ text: [git.staged && "staged", git.unstaged && "unstaged", git.untracked && "untracked"].filter(Boolean).join(" · "), tone: "muted" as const }] : [])];
  const remote = state.github;
  const data = remote.kind === "available" ? remote : remote.kind === "stale" || remote.kind === "loading" ? remote.previous : undefined;
  const github: DetailRow[] = remote.kind === "unavailable" ? [{ text: `Unavailable · ${safeText(remote.reason)}`, tone: "unavailable" }] : [];
  if (remote.kind === "loading") github.push({ text: `Loading${data ? " · previous data below" : "…"}`, tone: "muted" });
  if (remote.kind === "stale") github.push({ text: `Stale · ${safeText(remote.reason)}`, tone: "warn" });
  if (remote.kind === "available") github.push({ text: "Available", tone: "good" });
  if (data) github.push({ text: `Issues ${data.issues} open${remote.kind === "available" ? "" : " (previous)"}`, tone: "normal" },
    { text: `PRs ${data.pullRequests.length} open${remote.kind === "available" ? "" : " (previous)"}`, tone: "normal" });
  const paired = wide && width >= 68;
  if (paired) {
    const leftWidth = Math.floor((width - 1) / 2);
    const rightWidth = width - leftWidth - 1;
    addSpans([...boxTopSpans("LOCAL GIT", leftWidth, widthMethod), { text: " ", tone: "muted" }, ...boxTopSpans("GITHUB", rightWidth, widthMethod)], "normal", "alt");
    for (let index = 0; index < Math.max(2, local.length, github.length); index++)
      addSpans([
        ...boxBodySpans(local[index]?.text ?? "", leftWidth, local[index]?.tone ?? "normal", widthMethod),
        { text: " ", tone: "muted" },
        ...boxBodySpans(github[index]?.text ?? "", rightWidth, github[index]?.tone ?? "normal", widthMethod),
      ], "normal", "alt");
    add(`${boxEdge("", leftWidth, true, widthMethod)} ${boxEdge("", rightWidth, true, widthMethod)}`, "divider", "alt");
  } else {
    for (const [label, values] of [["LOCAL GIT", local], ["GITHUB", github]] as const) {
      if (width >= 50) addSpans(boxTopSpans(label, width, widthMethod), "normal", "alt");
      else add(`  ${label}`, "heading");
      for (const value of values) {
        if (width >= 50) addSpans(boxBodySpans(value.text, width, value.tone, widthMethod), "normal", "alt");
        else add(`    ${value.text}`, value.tone);
      }
      if (width >= 50) add(boxEdge("", width, true, widthMethod), "divider", "alt");
      add("", "muted");
    }
  }
  let selectedLine = 0;
  let selectedEndLine: number | undefined;
  if (data?.pullRequests.length) {
    add("", "muted");
    if (width >= 50) addSpans(boxTopSpans(`PULL REQUESTS (${data.pullRequests.length})`, width, widthMethod));
    else add(`  PULL REQUESTS (${data.pullRequests.length})`, "heading");
    data.pullRequests.forEach((pr, index) => {
      if (index === selectedPr) selectedLine = rows.length;
      add(prRow(pr, index === selectedPr, width, widthMethod), index === selectedPr ? "selected" : "normal");
      if (index === selectedPr) {
        const previous = remote.kind === "available" ? "" : " (previous)";
        const detail = (label: string, value: string | null) => {
          const content = fitLine(`      ${label} ${safeText(value ?? "unavailable")}${previous}`, Math.max(0, width - (width >= 50 ? 4 : 0)), widthMethod);
          add(width >= 50 ? boxBody(content, width, widthMethod) : content, value === null ? "unavailable" : "muted", "alt");
        };
        detail("Review", pr.review);
        detail("Checks", pr.checks);
        selectedEndLine = rows.length - 1;
      }
    });
    if (width >= 50) add(boxEdge("", width, true, widthMethod), "divider");
  }
  return { lines: rows.map(row => row.text), rows, selectedLine, selectedEndLine };
}

export function detailViewport(view: DetailView, offset: number, height: number): { rows: DetailRow[]; offset: number } {
  const start = Math.max(0, Math.min(offset, Math.max(0, view.rows.length - height)));
  return { rows: view.rows.slice(start, start + height), offset: start };
}

export function scrollToSelectedPr(view: DetailView, offset: number, height: number): number {
  if (view.selectedEndLine === undefined) return offset;
  const last = Math.min(view.selectedEndLine, view.selectedLine + Math.max(0, height - 1));
  if (view.selectedLine < offset) return view.selectedLine;
  if (last >= offset + height) return last - height + 1;
  return offset;
}

export function shortcutFooter(width: number, help: boolean, state: ProjectState | undefined, selectedPr: number, widthMethod: WidthMethod = "unicode"): string {
  const available = state?.github.kind === "available" ? state.github : undefined;
  const hasPrs = !!available?.pullRequests.length;
  const selected = !!available && selectedPr >= 0 && selectedPr < available.pullRequests.length;
  const hints = help ? ["? close help", "q quit", "PgUp/PgDn scroll", "↑/↓ project"]
    : !state ? ["? help", "q quit", "s settings"]
    : selected ? ["? help", "q quit", "s settings", "p open PR", "Tab next PR", "↑/↓ project", "PgUp/PgDn scroll", "f files", "e editor", "t terminal", "g repo", "r refresh"]
      : ["? help", "q quit", "s settings", "↑/↓ project", ...(hasPrs ? ["Tab select PR"] : []), "f files", "e editor", "t terminal", ...(state?.project.repository ? ["g repo", "r refresh"] : []), "PgUp/PgDn scroll"];
  const measure = (value: string) => measureEditText(value, { widthMethod });
  if (width < measure("? help · q quit")) return width >= measure("? q") ? "? q" : fitLine("?", width, widthMethod);
  const shown: string[] = [];
  for (const hint of hints) {
    const candidate = [...shown, hint].join(" · ");
    if (measure(candidate) <= width) shown.push(hint);
  }
  return shown.join(" · ");
}

export function scrollToLine(offset: number, line: number, height: number): number {
  if (height <= 0) return Math.max(0, line);
  return line < offset ? line : line >= offset + height ? line - height + 1 : offset;
}

export type Feedback = { kind: "loading" | "success" | "error" | "unavailable" | "info"; text: string; projectId?: string };
export function feedbackColor(kind: Feedback["kind"], theme: SemanticTheme): string {
  return { loading: theme.info, success: theme.success, error: theme.error, unavailable: theme.unavailable, info: theme.info }[kind];
}

export function detailToneColor(tone: DetailTone, theme: SemanticTheme): string {
  return { heading: theme.heading, divider: theme.divider, accent: theme.accent, accentSubtle: theme.accentSubtle,
    action: theme.textPrimary,
    title: theme.textPrimary, muted: theme.textMuted, normal: theme.textSecondary,
    good: theme.success, warn: theme.attention, error: theme.error, unavailable: theme.unavailable,
    selected: theme.textOnSelection }[tone];
}
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

export function nextPrSelection(selectedPr: number, count: number): number {
  return count > 0 ? (selectedPr + 1) % count : -1;
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
      return { action: pr ? actions.pullRequest(project, pr) : Promise.reject(new Error("Select an available PR with Tab first.")), launched: pr ? `PR #${pr.number} opener` : "PR opener" };
    }
  }
}

export function settingsLayout(width: number, height: number) {
  const columns = Math.max(1, width);
  const rows = Math.max(3, height);
  const wide = columns >= 88;
  const contentHeight = rows - 3;
  const navigatorWidth = wide ? 19 : columns;
  const navigatorHeight = wide ? contentHeight : Math.min(2, contentHeight);
  const dividerWidth = wide ? 1 : columns;
  const dividerHeight = wide ? contentHeight : Math.min(1, contentHeight - navigatorHeight);
  const detailWidth = wide ? columns - navigatorWidth - dividerWidth : columns;
  const detailHeight = contentHeight - (wide ? 0 : navigatorHeight + dividerHeight);
  return { columns, wide, contentHeight, navigatorWidth, navigatorHeight, dividerWidth, dividerHeight, detailWidth, detailHeight };
}

export function settingsRows(session: SettingsSession): { text: string; color: string }[] {
  return settingsControls.map(control => {
    if (control === "preset") return { text: `Theme preset  ${themeLabels[session.themeId]}`, color: session.theme.heading };
    if (themeTokens.includes(control as ThemeToken)) {
      const token = control as ThemeToken;
      const current = session.editing?.token === token ? session.editing.value : session.theme[token];
      const source = session.overrides[token] === undefined ? "preset" : "override";
      return { text: `${token}  ${current}  ${source}`, color: session.theme.textPrimary };
    }
    if (control === "terminal") return { text: `Terminal  ${session.terminal}${session.terminal === "system" ? " (platform selection)" : ""}`, color: session.theme.info };
    const actions: Record<"save" | "reset" | "cancel" | "reload", string> = { save: "Save settings", reset: "Reset appearance to preset", cancel: "Cancel / return to cockpit", reload: "Reload registry from disk" };
    return { text: actions[control as keyof typeof actions], color: session.theme.textSecondary };
  });
}

export async function runDashboard(registryPath = defaultRegistryPath()): Promise<void> {
  let theme = resolveTheme();
  const renderer = await createCliRenderer({ exitOnCtrlC: true, backgroundColor: theme.background });
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
  const persistence = new RegistryPersistence(registryPath);
  let settings: SettingsSession | null = null;
  let settingsLoading = false;
  let settingsOpeningId = 0;
  let settingsHelp = false;
  let settingsOffset = 0;
  let activeTheme = theme;
  const layout = new BoxRenderable(renderer, { flexDirection: "column", gap: 0, width: "100%", height: "100%", backgroundColor: theme.background });
  const title = new TextRenderable(renderer, { content: "Wolf Den", fg: theme.heading });
  const panels = new BoxRenderable(renderer, { flexDirection: "row", gap: 0, width: "100%", backgroundColor: theme.panel });
  const listPanel = new BoxRenderable(renderer, { flexDirection: "column", gap: 0, backgroundColor: theme.panel });
  const listHeading = new TextRenderable(renderer, { content: "", fg: theme.heading });
  const list = new TextRenderable(renderer, { content: "", fg: theme.textPrimary });
  const listSummary = new TextRenderable(renderer, { content: "", fg: theme.textSecondary });
  const divider = new TextRenderable(renderer, { content: "", fg: theme.divider });
  const detail = new TextRenderable(renderer, { content: "", fg: theme.textSecondary });
  const message = new TextRenderable(renderer, { content: "", fg: theme.attention, bg: theme.panelAlt });
  const footer = new TextRenderable(renderer, { content: "", fg: theme.textMuted });
  layout.add(title);
  listPanel.add(listHeading);
  listPanel.add(list);
  listPanel.add(listSummary);
  panels.add(listPanel);
  panels.add(divider);
  panels.add(detail);
  layout.add(panels);
  layout.add(message);
  layout.add(footer);
  renderer.root.add(layout);

  const applyTheme = (next: SemanticTheme) => {
    theme = next;
    renderer.setBackgroundColor(theme.background);
    layout.backgroundColor = theme.background;
    panels.backgroundColor = theme.panel;
    title.fg = theme.heading;
    listPanel.backgroundColor = theme.panel;
    listHeading.fg = theme.heading;
    list.fg = theme.textPrimary;
    listSummary.fg = theme.textSecondary;
    divider.fg = theme.divider;
    detail.fg = theme.textSecondary;
    message.bg = theme.panelAlt;
    footer.fg = theme.textMuted;
  };

  const renderSettings = () => {
    const dimensions = settingsLayout(renderer.terminalWidth, renderer.terminalHeight);
    panels.flexDirection = dimensions.wide ? "row" : "column";
    title.height = 1; panels.height = dimensions.contentHeight;
    listPanel.width = dimensions.navigatorWidth; listPanel.height = dimensions.navigatorHeight;
    listHeading.width = dimensions.navigatorWidth; listHeading.height = dimensions.wide ? 2 : 1;
    list.width = dimensions.navigatorWidth; list.height = Math.max(0, dimensions.navigatorHeight - (dimensions.wide ? 2 : 1));
    listSummary.width = dimensions.navigatorWidth; listSummary.height = 0;
    divider.width = dimensions.dividerWidth; divider.height = dimensions.dividerHeight;
    detail.width = dimensions.detailWidth; detail.height = dimensions.detailHeight;
    message.height = 1; footer.height = 1;
    const session = settings;
    title.content = fitLine(`🐺 Wolf Den / Settings${session?.dirty ? " · Unsaved" : ""}`, dimensions.columns, renderer.widthMethod);
    const section = session && session.focus >= 19 ? "General" : "Appearance";
    listHeading.content = dimensions.wide ? "SECTIONS\n" : `SECTIONS · ${section}`;
    list.content = dimensions.wide ? `  ${section === "Appearance" ? "▌" : " "} Appearance\n  ${section === "General" ? "▌" : " "} General` : `← Appearance   General →`;
    listSummary.content = "";
    divider.content = dimensions.wide ? Array(dimensions.dividerHeight).fill("│").join("\n") : "─".repeat(dimensions.dividerWidth);
    if (!session) {
      detail.content = settingsLoading ? "Loading Settings…" : "Settings unavailable. Esc returns to the cockpit.";
      message.fg = theme.info; message.content = "· Opening registry snapshot…";
    } else {
      const sample = [
        fg(theme.heading)("PREVIEW  "),
        fg(theme.textOnSelection)(bg(theme.selectionBackground)("▌focus")),
        fg(theme.success)("  ✓ clean"),
        fg(theme.attention)("  ! alert"),
      ];
      const intro = session.editing ? `EDIT ${session.editing.token}: ${session.editing.value}█` : session.confirmation ? `CONFIRM ${session.confirmation.toUpperCase()} · Enter yes · Esc no` : `APPEARANCE · GENERAL  ${session.dirty ? "● Unsaved changes" : "Saved"}`;
      const available = Math.max(0, dimensions.detailHeight - 2);
      const rows = settingsHelp
        ? ["SETTINGS HELP", "↑/↓ controls · ←/→ sections", "Enter edit/select/confirm", "Color: type #RRGGBB · Backspace", "Enter accept · Esc cancel edit", "Esc with changes: confirm discard", "Save writes registry · Reset previews", "Reload reads external edits", "? close help · Ctrl+C quit"]
        : settingsRows(session).map(row => row.text);
      if (!settingsHelp) settingsOffset = scrollToLine(settingsOffset, session.focus, available);
      else settingsOffset = Math.min(settingsOffset, Math.max(0, rows.length - available));
      const visibleRows = rows.slice(settingsOffset, settingsOffset + available);
      const paletteRows = settingsHelp ? [] : settingsRows(session);
      detail.content = new StyledText([
        fg(theme.heading)(fitLine(intro, dimensions.detailWidth, renderer.widthMethod) + "\n"),
        ...sample, ...(visibleRows.length ? [fg(theme.textMuted)("\n")] : []),
        ...visibleRows.flatMap((line, index) => {
          const focused = !settingsHelp && settingsOffset + index === session.focus;
          const content = fitLine((focused ? "▌ " : "  ") + line, dimensions.detailWidth, renderer.widthMethod);
          const color = focused ? theme.textOnSelection : paletteRows[settingsOffset + index]?.color ?? theme.textSecondary;
          const styled = fg(color)(focused ? bg(theme.selectionBackground)(content) : content);
          return index === visibleRows.length - 1 ? [styled] : [styled, fg(theme.textMuted)("\n")];
        }),
      ]);
      message.fg = session.error ? theme.error : theme.info;
      message.content = fitLine(`${session.error ? "!" : "·"} ${session.message}`, dimensions.columns, renderer.widthMethod);
    }
    footer.content = fitLine(settingsHelp ? "? close help · Esc back" : "↑↓ controls · ←→ sections · Enter choose · ? help · Esc back", dimensions.columns, renderer.widthMethod);
  };

  const render = () => {
    if (destroyed) return;
    if (settings || settingsLoading) { renderSettings(); return; }
    const dimensions = dashboardLayout(renderer.terminalWidth, renderer.terminalHeight, states.length);
    panels.flexDirection = dimensions.wide ? "row" : "column";
    title.height = dimensions.headerHeight;
    panels.height = dimensions.contentHeight;
    listPanel.width = dimensions.navigatorWidth; listPanel.height = dimensions.navigatorHeight;
    const navigatorHeadingRows = navigatorHeadingHeight(dimensions.wide, dimensions.navigatorHeight);
    const navigatorRows = Math.max(0, dimensions.navigatorHeight - navigatorHeadingRows - dimensions.radarHeight);
    listHeading.width = dimensions.navigatorWidth; listHeading.height = navigatorHeadingRows;
    list.width = dimensions.navigatorWidth; list.height = navigatorRows;
    listSummary.width = dimensions.navigatorWidth; listSummary.height = dimensions.radarHeight;
    divider.width = dimensions.dividerWidth; divider.height = dimensions.dividerHeight;
    detail.width = dimensions.detailWidth; detail.height = dimensions.detailHeight;
    message.height = dimensions.statusHeight; footer.height = dimensions.footerHeight;
    const overview = `${states.length} project${states.length === 1 ? "" : "s"} · ${radarSummary(states)}`;
    title.content = fitLine(dimensions.wide ? "🐺 Wolf Den" : `🐺 Wolf Den · ${overview}`, dimensions.columns, renderer.widthMethod);
    const navigator = navigatorView(states, selected, navigatorRows, dimensions.navigatorWidth, renderer.widthMethod);
    selected = navigator.index;
    listHeading.content = navigatorHeadingRows ? navigatorHeadingText(states.length, dimensions.navigatorWidth, renderer.widthMethod) : "";
    list.content = navigatorContent(navigator, dimensions.navigatorWidth, renderer.widthMethod, undefined, 0, theme);
    listSummary.content = dimensions.radarHeight ? radarContent(states, dimensions.navigatorWidth, renderer.widthMethod, theme) : "";
    divider.content = dimensions.wide ? Array(dimensions.dividerHeight).fill("│").join("\n") : "─".repeat(dimensions.dividerWidth);
    const view = showingHelp
      ? { lines: ["Keyboard shortcuts", "↑/↓  Select project", "Tab  Select next PR", "s  Open Settings", "e  Open project in VS Code", "t  Open terminal in project", "f  Open project in file manager", "g  Open GitHub repository", "p  Open selected PR", "r  Refresh selected project's GitHub data", "PgUp/PgDn  Scroll details", "?  Close help", "q / Esc / Ctrl+C  Quit"], selectedLine: 0 }
      : registryLoaded ? detailLines(states[selected], selectedPr, dimensions.detailWidth, renderer.widthMethod, dimensions.wide) : { lines: [feedback.text], selectedLine: 0 };
    const visible = "rows" in view && view.rows ? detailViewport(view, detailOffset, dimensions.detailHeight) : undefined;
    detailOffset = visible?.offset ?? Math.min(detailOffset, Math.max(0, view.lines.length - dimensions.detailHeight));
    detail.content = visible
      ? new StyledText(visible.rows.flatMap((row, index, shownRows) => {
          const line = fitLine(row.text, dimensions.detailWidth, renderer.widthMethod);
          const styled = row.spans ? row.spans.map(span => {
            const content = span.strong ? bold(span.text) : span.text;
            return fg(detailToneColor(span.tone, theme))(row.surface === "alt" ? bg(theme.panelAlt)(content) : content);
          }) : (() => {
            const content = row.tone === "title" || row.tone === "heading" || row.tone === "accent" || row.tone === "action" || row.tone === "selected" ? bold(line) : line;
            const surface = row.tone === "selected" ? bg(theme.selectionBackground)(content)
              : row.surface === "alt" ? bg(theme.panelAlt)(content) : content;
            return [fg(detailToneColor(row.tone, theme))(surface)];
          })();
          return index === shownRows.length - 1 ? styled : [...styled, fg(theme.textMuted)("\n")];
        }))
      : view.lines.slice(detailOffset, detailOffset + dimensions.detailHeight).map(line => fitLine(line, dimensions.detailWidth, renderer.widthMethod)).join("\n");
    const shown = feedbackForSelection(feedback, states[selected]?.project.id);
    const labels = { loading: "…", success: "✓", error: "!", unavailable: "!", info: "·" };
    message.fg = feedbackColor(shown.kind, theme);
    message.content = fitLine(`${labels[shown.kind]} ${shown.text}`, dimensions.columns, renderer.widthMethod);
    footer.content = shortcutFooter(dimensions.columns, showingHelp, states[selected], selectedPr, renderer.widthMethod);
  };
  const onKey = (key: KeyEvent) => {
    if (settingsLoading) {
      if (key.name === "escape") { settingsOpeningId++; settingsLoading = false; render(); }
      return;
    }
    if (settings) {
      const session = settings;
      if (session.busy) return;
      if (session.editing) {
        if (key.name === "escape") session.cancelEdit();
        else if (key.name === "return" || key.name === "enter") session.acceptEdit();
        else session.input(key.name);
        applyTheme(session.theme); render(); return;
      }
      if (session.confirmation) {
        if (key.name === "escape") { session.cancelConfirmation(); render(); return; }
        if (key.name === "return" || key.name === "enter") {
          void session.confirm().then(result => {
            if (destroyed || settings !== session) return;
            if (result === "exit") { settings = null; settingsHelp = false; applyTheme(activeTheme); }
            else applyTheme(session.theme);
            render();
          });
        }
        return;
      }
      if (key.name === "?") { settingsHelp = !settingsHelp; settingsOffset = 0; render(); return; }
      if (settingsHelp) {
        if (key.name === "escape") { settingsHelp = false; render(); }
        else if (key.name === "pageup" || key.name === "pagedown") { settingsOffset = Math.max(0, settingsOffset + (key.name === "pageup" ? -5 : 5)); render(); }
        return;
      }
      if (key.name === "escape") {
        if (session.requestExit()) { settings = null; applyTheme(activeTheme); }
        render(); return;
      }
      if (key.name === "up" || key.name === "down" || key.name === "left" || key.name === "right") {
        session.move(key.name); render(); return;
      }
      if (key.name === "pageup" || key.name === "pagedown") {
        for (let index = 0; index < 5; index++) session.move(key.name === "pageup" ? "up" : "down");
        render(); return;
      }
      if (key.name !== "return" && key.name !== "enter") return;
      if (session.control === "preset") session.cyclePreset();
      else if (themeTokens.includes(session.control as ThemeToken)) session.startEdit();
      else if (session.control === "terminal") session.cycleTerminal();
      else if (session.control === "reset") session.requestReset();
      else if (session.control === "reload") session.requestReload();
      else if (session.control === "cancel") {
        if (session.requestExit()) { settings = null; applyTheme(activeTheme); }
      } else if (session.control === "save") {
        void session.save().then(saved => {
          if (destroyed || settings !== session) return;
          if (saved) { activeTheme = session.theme; actions = new ProjectActions(undefined, undefined, session.terminal); }
          applyTheme(session.theme); render();
        });
      }
      applyTheme(settings?.theme ?? activeTheme); render(); return;
    }
    if (key.name === "s" && registryLoaded) {
      const openingId = ++settingsOpeningId;
      settingsLoading = true; render();
      void persistence.load().then(snapshot => {
        if (destroyed || !settingsLoading || settingsOpeningId !== openingId) return;
        settings = new SettingsSession(snapshot, persistence);
        settingsLoading = false; settingsOffset = 0; settingsHelp = false;
        applyTheme(settings.theme);
        render();
      }).catch((error: unknown) => {
        if (destroyed || !settingsLoading || settingsOpeningId !== openingId) return;
        settingsLoading = false;
        feedback = { kind: "error", text: error instanceof Error ? safeText(error.message) : "Could not open Settings." };
        render();
      });
      return;
    }
    if (key.name === "q" || key.name === "escape") { renderer.destroy(); return; }
    if (key.name === "?") { showingHelp = !showingHelp; detailOffset = 0; render(); return; }
    if (key.name === "pageup" || key.name === "pagedown") { detailOffset = Math.max(0, detailOffset + (key.name === "pageup" ? -5 : 5)); render(); return; }
    if (showingHelp) return;
    const state = states[selected];
    if (key.name === "tab") {
      const data = state?.github.kind === "available" ? state.github : undefined;
      if (!data?.pullRequests.length) { feedback = { kind: "unavailable", text: "No available PRs to select for this project.", projectId: state?.project.id }; render(); return; }
      selectedPr = nextPrSelection(selectedPr, data.pullRequests.length);
      const dimensions = dashboardLayout(renderer.terminalWidth, renderer.terminalHeight, states.length);
      const selectedView = detailLines(state, selectedPr, dimensions.detailWidth, renderer.widthMethod, dimensions.wide);
      detailOffset = scrollToSelectedPr(selectedView, detailOffset, dimensions.detailHeight);
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
  const onResize = () => {
    if (!settings && !settingsLoading && !showingHelp && selectedPr >= 0) {
      const dimensions = dashboardLayout(renderer.terminalWidth, renderer.terminalHeight, states.length);
      detailOffset = scrollToSelectedPr(detailLines(states[selected], selectedPr, dimensions.detailWidth, renderer.widthMethod, dimensions.wide), detailOffset, dimensions.detailHeight);
    }
    render();
  };
  renderer.on("resize", onResize);
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
    renderer.off("resize", onResize);
    renderer.off("render:error", onRendererError);
    renderer.off("handler:error", onRendererError);
  });
  render();

  try {
    const configuration = await loadConfiguration(registryPath);
    if (destroyed) return;
    activeTheme = resolveTheme(configuration.settings.theme, configuration.settings.themeOverrides);
    applyTheme(activeTheme);
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
