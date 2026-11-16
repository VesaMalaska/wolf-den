import { BoxRenderable, TextRenderable, StyledText, fg, bg, bold, measureEditText, type CliRenderer, type WidthMethod } from "@opentui/core";
import { settingsControls, type SettingsControl, type SettingsSession } from "./settings.js";
import { themeLabels, type SemanticTheme, type ThemeToken } from "./theme.js";
import { projectFields, type ProjectField, type ProjectRegistrations } from "./project-registrations.js";
import { ProjectSettingsView } from "./project-settings-view.js";

export const colorGroups = [
  { label: "Surfaces", tokens: ["background", "panel", "panelAlt"] },
  { label: "Selection & focus", tokens: ["selectionBackground", "textOnSelection", "focusBorder"] },
  { label: "Text", tokens: ["textPrimary", "textSecondary", "textMuted"] },
  { label: "Identity & structure", tokens: ["accent", "accentSubtle", "heading", "divider"] },
  { label: "Status", tokens: ["success", "attention", "error", "unavailable", "info"] },
] as const satisfies readonly { label: string; tokens: readonly ThemeToken[] }[];

const colorLabels: Record<ThemeToken, string> = {
  background: "Background", panel: "Panel", panelAlt: "Secondary panel",
  selectionBackground: "Selection background", textOnSelection: "Selected text", focusBorder: "Focus outline",
  textPrimary: "Primary text", textSecondary: "Secondary text", textMuted: "Muted text",
  accent: "Accent", accentSubtle: "Subtle accent", heading: "Heading", divider: "Divider",
  success: "Success", attention: "Attention", error: "Error", unavailable: "Unavailable", info: "Information",
};

export type ViewControl = SettingsControl | "customize" | "add-project" | "remove-project" | `project:${string}` | ProjectField | "apply-project" | "cancel-project" | "cancel-removal" | "confirm-removal";
export class SettingsNavigation {
  section: "appearance" | "projects" | "general" | "colors" | "project-form" | "project-remove" = "appearance";
  control: ViewControl = "preset";
  help = false;
  helpOffset = 0;
  identityOffset = 0;
  private returnControl: ViewControl = "preset";
  projects: ProjectRegistrations | null = null;
  get fields(): ViewControl[] {
    if (this.section === "project-form") return [...projectFields];
    if (this.section === "project-remove") return [];
    if (this.section === "projects") return ["add-project", ...(this.projects?.entries.map(entry => `project:${entry.id}` as const) ?? []), ...(this.projects?.selected ? ["remove-project"] as const : [])];
    return this.section === "colors" ? colorGroups.flatMap(group => [...group.tokens])
      : this.section === "general" ? ["terminal"] : ["preset", "customize"];
  }
  get actions(): ViewControl[] {
    if (this.section === "project-form") return ["apply-project", "cancel-project"];
    if (this.section === "project-remove") return ["cancel-removal", "confirm-removal"];
    if (this.section === "projects") return ["save", "cancel", "reload", ...(this.projects?.selected ? ["remove-project"] as const : [])];
    return ["save", "cancel", ...(this.section === "general" ? [] : ["reset"] as const), "reload"];
  }
  get controls(): ViewControl[] { return [...new Set([...this.fields, ...this.actions])]; }
  sync(session: SettingsSession): void {
    this.projects = session.projects;
    if (this.control.startsWith("project:")) session.projects.selectedId = this.control.slice(8);
    if (session.projects.form && projectFields.includes(this.control as ProjectField)) session.projects.form.field = this.control as ProjectField;
    if (this.section === "project-remove") session.projects.removeFocused = this.control === "confirm-removal";
    const index = settingsControls.indexOf(this.control as SettingsControl);
    if (index >= 0) session.focus = index;
  }
  move(direction: "up" | "down" | "left" | "right", session: SettingsSession): void {
    if (direction === "left" || direction === "right") {
      if (this.section === "colors" || this.section === "project-form" || this.section === "project-remove") return;
      const sections = ["appearance", "projects", "general"] as const;
      const index = sections.indexOf(this.section);
      this.section = sections[Math.max(0, Math.min(2, index + (direction === "left" ? -1 : 1)))]!;
      this.control = this.section === "projects" ? this.projectControl(session) : this.fields[0]!;
      if (this.section === "projects" && !session.error) session.message = "Enter to edit. Save writes draft.";
    } else {
      const index = this.controls.indexOf(this.control);
      this.control = this.controls[Math.max(0, Math.min(this.controls.length - 1, index + (direction === "up" ? -1 : 1)))]!;
    }
    this.sync(session);
  }
  tab(backwards: boolean, session: SettingsSession): void {
    const index = this.actions.indexOf(this.control);
    if (index < 0) this.returnControl = this.control;
    const field = this.fields.includes(this.returnControl) ? this.returnControl : this.section === "projects" ? this.projectControl(session) : this.fields[0]!;
    this.control = index < 0 ? this.actions[backwards ? this.actions.length - 1 : 0]!
      : backwards ? index === 0 ? field : this.actions[index - 1]!
      : index === this.actions.length - 1 ? field : this.actions[index + 1]!;
    this.sync(session);
  }
  openColors(session: SettingsSession): void { this.section = "colors"; this.control = "background"; this.sync(session); }
  projectControl(session: SettingsSession): ViewControl { return session.projects.selected ? `project:${session.projects.selected.id}` : "add-project"; }
  showProjects(session: SettingsSession): void { this.section = "projects"; this.control = this.projectControl(session); this.sync(session); }
  moveForm(direction: number, session: SettingsSession): void {
    const index = this.controls.indexOf(this.control);
    this.control = this.controls[(index + direction + this.controls.length) % this.controls.length]!;
    this.sync(session);
  }
  back(session: SettingsSession): boolean {
    if (this.help) { this.help = false; return true; }
    if (this.section !== "colors") return false;
    this.section = "appearance"; this.control = "customize"; this.sync(session); return true;
  }
}

export function settingsGeometry(width: number, height: number) {
  const tight = height < 22;
  const roomy = height >= 28;
  const padding = width >= 80 ? 2 : 1;
  const headingHeight = tight ? 1 : 2;
  const tabsHeight = tight ? 2 : 1;
  const dividerHeight = roomy ? 2 : 1;
  const actionHeight = roomy ? 2 : 1;
  const hintsHeight = tight ? 2 : 3;
  const feedbackMinimum = width >= 80 ? 1 : 2;
  const bodyHeight = height - headingHeight - tabsHeight - dividerHeight - actionHeight - feedbackMinimum - hintsHeight;
  return { columns: width, rows: height, padding, innerWidth: width - padding * 2,
    bodyHeight, headingHeight, tabsHeight, dividerHeight, actionHeight, hintsHeight, feedbackMinimum,
    bodyPadding: tight ? 0 : 1, sectionGap: roomy ? 2 : tight ? 0 : 1,
    groupHeadingHeight: tight ? 1 : 2, groupSpacing: !tight, compact: width < 80 || height < 24 };
}

function clip(text: string, width: number, widthMethod: WidthMethod): string {
  const clean = text.replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
  if (measureEditText(clean, { widthMethod }) <= width) return clean;
  let result = "";
  for (const { segment } of new Intl.Segmenter().segment(clean)) {
    if (measureEditText(result + segment + "…", { widthMethod }) > width) break;
    result += segment;
  }
  return result + "…";
}

// Wrap feedback by terminal cells, preserving words and graphemes.
export function settingsFeedbackLines(text: string, width: number, widthMethod: WidthMethod): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/[\x00-\x1f\x7f-\x9f]/g, " ").split(/\s+/).filter(Boolean)) {
    const next = line ? line + " " + word : word;
    if (measureEditText(next, { widthMethod }) <= width) { line = next; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const { segment } of new Intl.Segmenter().segment(word)) {
      if (measureEditText(line + segment, { widthMethod }) > width) { lines.push(line); line = ""; }
      line += segment;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** A retained Settings tree; draft/persistence ownership stays in SettingsSession. */
export class SettingsView {
  readonly root: BoxRenderable;
  private content: BoxRenderable;
  private heading: TextRenderable;
  private tabs: TextRenderable;
  private body: BoxRenderable;
  private appearance: BoxRenderable;
  private preset: TextRenderable;
  private previewLabel: TextRenderable;
  private preview: BoxRenderable;
  private radar: TextRenderable;
  private workbench: BoxRenderable;
  private sampleHeading: TextRenderable;
  private nextAction: TextRenderable;
  private sampleStatus: TextRenderable;
  private samplePr: TextRenderable;
  private customize: TextRenderable;
  private general: TextRenderable;
  private colors: BoxRenderable;
  private groupHeading: TextRenderable;
  private colorRows: { box: BoxRenderable; swatch: TextRenderable; label: TextRenderable; value: TextRenderable }[];
  private scrollHint: TextRenderable;
  private help: TextRenderable;
  private actionDivider: TextRenderable;
  private actionRow: BoxRenderable;
  private actionNodes: Map<ViewControl, TextRenderable>;
  private feedback: TextRenderable;
  private hints: TextRenderable;
  private offset = 0;
  private projectsView: ProjectSettingsView;

  constructor(private renderer: CliRenderer, onProjectInput: () => void = () => {}) {
    const box = (options: ConstructorParameters<typeof BoxRenderable>[1] = {}) => new BoxRenderable(renderer, { flexDirection: "column", flexShrink: 0, ...options });
    const text = (height = 1) => new TextRenderable(renderer, { height, flexShrink: 0, wrapMode: "none" });
    this.root = box({ width: "100%", height: "100%", visible: false });
    this.content = box({ width: "100%" }); this.root.add(this.content);
    this.heading = text(); this.tabs = text(2);
    this.body = box({ overflow: "hidden" });
    this.content.add(this.heading); this.content.add(this.tabs); this.content.add(this.body);
    this.appearance = box(); this.body.add(this.appearance);
    this.preset = text(3); this.previewLabel = text();
    this.preview = box({ flexDirection: "row", border: true });
    this.radar = text(); this.workbench = box({ flexGrow: 1 });
    this.sampleHeading = text(); this.nextAction = text(2); this.sampleStatus = text(); this.samplePr = text();
    for (const node of [this.sampleHeading, this.nextAction, this.sampleStatus, this.samplePr]) node.width = "100%";
    this.preview.add(this.radar); this.preview.add(this.workbench);
    this.workbench.add(this.sampleHeading); this.workbench.add(this.nextAction); this.workbench.add(this.sampleStatus); this.workbench.add(this.samplePr);
    this.customize = text(3);
    this.appearance.add(this.preset); this.appearance.add(this.previewLabel); this.appearance.add(this.preview); this.appearance.add(this.customize);
    this.general = text(6); this.body.add(this.general);
    this.colors = box(); this.body.add(this.colors);
    this.groupHeading = text(); this.colors.add(this.groupHeading);
    this.colorRows = Array.from({ length: 28 }, () => {
      const row = box({ flexDirection: "row", height: 1 });
      const swatch = text(); swatch.width = 6;
      const label = text();
      const value = text(); value.width = 9;
      row.add(swatch); row.add(label); row.add(value); this.colors.add(row);
      return { box: row, swatch, label, value };
    });
    this.scrollHint = text(); this.colors.add(this.scrollHint);
    this.help = text(); this.body.add(this.help);
    this.projectsView = new ProjectSettingsView(renderer, onProjectInput);
    this.body.add(this.projectsView.root);
    this.actionDivider = text(); this.actionRow = box({ flexDirection: "row", height: 1 });
    this.actionNodes = new Map(["save", "cancel", "reset", "reload", "apply-project", "cancel-project", "cancel-removal", "confirm-removal"].map(control => {
      const node = text(); this.actionRow.add(node); return [control as ViewControl, node];
    }));
    this.feedback = text(2); this.hints = text(2);
    this.content.add(this.actionDivider); this.content.add(this.actionRow); this.content.add(this.feedback); this.content.add(this.hints);
  }

  update(session: SettingsSession | null, navigation: SettingsNavigation): void {
    const width = this.renderer.terminalWidth, height = this.renderer.terminalHeight;
    const g = settingsGeometry(width, height), theme = session?.theme;
    this.root.visible = true;
    this.content.width = Math.max(1, g.columns); this.content.height = g.rows;
    this.content.paddingX = g.padding;
    this.heading.height = g.headingHeight; this.tabs.height = g.tabsHeight;
    if (!session || !theme || width < 42 || height < 18) {
      this.projectsView.suspendInput();
      this.heading.content = "WOLF DEN / SETTINGS";
      this.tabs.content = !theme ? "Loading Settings…\nEsc Back" : "Resize to at least 42 × 18.\nEsc Back · Ctrl+C Quit";
      this.body.visible = this.actionRow.visible = this.actionDivider.visible = this.feedback.visible = this.hints.visible = false;
      return;
    }
    this.body.visible = this.actionRow.visible = this.actionDivider.visible = this.feedback.visible = this.hints.visible = true;
    this.root.backgroundColor = theme.background; this.content.backgroundColor = theme.background;
    this.body.paddingTop = g.bodyPadding;
    this.actionDivider.height = g.dividerHeight; this.actionRow.height = g.actionHeight;
    this.hints.height = g.hintsHeight;
    this.heading.fg = theme.heading; this.tabs.fg = theme.textSecondary;
    const w = g.innerWidth, wm = this.renderer.widthMethod;
    navigation.projects = session.projects;
    if (!navigation.controls.includes(navigation.control)) {
      navigation.control = navigation.section === "projects" ? navigation.projectControl(session) : navigation.fields[0] ?? navigation.actions[0]!;
      navigation.sync(session);
    }
    const fit = (value: string, columns = w) => clip(value, columns, wm);
    const status = session.busy ? session.checkingProject ? "Checking…" : "Saving…" : session.dirty || session.projects.formDirty ? "Unsaved" : "Saved";
    const title = navigation.section === "colors" ? "APPEARANCE / COLORS" : navigation.section === "project-form" ? `PROJECTS / ${session.projects.form?.id === undefined ? "ADD" : "EDIT"} PROJECT` : navigation.section === "project-remove" ? "PROJECTS / REMOVE FROM DEN" : "WOLF DEN / SETTINGS";
    this.heading.content = new StyledText([bold(fg(theme.heading)(title)), fg(session.dirty || session.projects.formDirty ? theme.attention : theme.success)(" ".repeat(Math.max(1, w - title.length - status.length)) + status)]);
    this.tabs.content = navigation.section === "colors" ? "Esc Back to Appearance" : navigation.section === "project-form" || navigation.section === "project-remove" ? "Esc Back to Projects" : new StyledText([
      navigation.section === "appearance" ? bold(fg(theme.accent)("[Appearance]")) : fg(theme.textMuted)(" Appearance "),
      navigation.section === "projects" ? bold(fg(theme.accent)(" [Projects]")) : fg(theme.textMuted)("  Projects "),
      navigation.section === "general" ? bold(fg(theme.accent)(" [General]")) : fg(theme.textMuted)("  General"),
    ]);
    const form = session.projects.form;
    const fieldError = form?.errors[form.field];
    const feedback = session.projects.discardingForm ? "Discard this form? Enter discards; Esc keeps editing."
      : session.confirmation === "reset" ? "Reset all appearance colors? Enter confirms; Esc keeps draft. Save keeps the reset."
      : session.confirmation === "discard" ? "Discard unsaved changes and return? Enter discards; Esc keeps editing."
      : session.confirmation === "reload" ? "Discard draft and reload registry? Enter confirms; Esc keeps editing."
      : session.busy ? session.checkingProject ? "Checking directory…" : "Saving settings…"
      : navigation.section === "project-form" ? fieldError ?? (form?.editing ? "Enter accepts; Esc cancels field. Tab moves to the next field." : "Apply to draft; Save in Projects writes it.")
      : navigation.section === "project-remove" ? "Cancel keeps this registration."
      : session.editing ? session.error ? "Use six hex digits after #. Enter accepts; Esc restores the previous color." : "Live preview. Enter accepts; Esc restores the previous color."
      : session.message;
    const feedbackLines = settingsFeedbackLines(feedback, w, wm);
    // Long persistence/conflict messages borrow body rows, never the action/hint rows.
    const feedbackHeight = Math.min(Math.max(g.feedbackMinimum, feedbackLines.length), Math.max(g.feedbackMinimum, g.bodyHeight - (navigation.section.startsWith("project") ? 7 : 3)));
    const bodyHeight = g.bodyHeight - (feedbackHeight - g.feedbackMinimum);
    this.body.height = bodyHeight;
    this.feedback.height = feedbackHeight;
    this.feedback.fg = session.error || fieldError ? theme.error : session.confirmation || session.projects.discardingForm ? theme.attention : theme.textSecondary;
    const visibleFeedback = feedbackLines.slice(0, feedbackHeight);
    if (feedbackLines.length > feedbackHeight) visibleFeedback[feedbackHeight - 1] = fit(visibleFeedback[feedbackHeight - 1]! + " …");
    this.feedback.content = visibleFeedback.join("\n");
    const selected = (value: string, active: boolean) => active ? fg(theme.textOnSelection)(bg(theme.selectionBackground)(value)) : fg(theme.textPrimary)(value);
    const line = (value: string, active: boolean) => selected(fit((active ? "> " : "  ") + value).padEnd(w), active);
    this.appearance.visible = !navigation.help && navigation.section === "appearance";
    this.general.visible = !navigation.help && navigation.section === "general";
    this.colors.visible = !navigation.help && navigation.section === "colors";
    this.help.visible = navigation.help;
    this.projectsView.root.visible = !navigation.help && navigation.section.startsWith("project");
    this.projectsView.update(session, navigation, w, Math.max(1, bodyHeight - g.bodyPadding), g, fit, value => settingsFeedbackLines(value, w, wm));
    this.preset.height = 2 + g.sectionGap;
    this.preset.content = new StyledText([bold(fg(theme.heading)("THEME PRESET\n")), line(themeLabels[session.themeId], navigation.control === "preset")]);
    this.previewLabel.content = new StyledText([bold(fg(theme.heading)("COCKPIT PREVIEW")), fg(theme.textMuted)(" · SAMPLE")]);
    this.updatePreview(theme, w, g.compact, fit);
    this.customize.marginTop = g.sectionGap; this.customize.height = 2;
    this.customize.content = new StyledText([bold(line("Customize colors >", navigation.control === "customize")), fg(theme.textMuted)("\n" + fit("  Surfaces, text, focus and status"))]);
    this.general.height = 6 + g.sectionGap;
    this.general.content = new StyledText([bold(fg(theme.heading)("TERMINAL PREFERENCE\n" + "\n".repeat(g.sectionGap))), line(session.terminal === "system" ? "System default" : session.terminal, navigation.control === "terminal"), fg(theme.textSecondary)("\n\n" + fit("Used when opening a project terminal.") + "\nTakes effect after Save.")]);
    this.groupHeading.height = g.groupHeadingHeight;
    this.updateColors(session, navigation, Math.max(1, bodyHeight - g.bodyPadding - g.groupHeadingHeight - 1), w, g.groupSpacing, fit);
    const help = ["SETTINGS HELP", "←/→ Appearance / Projects / General", "↑/↓ Move · Enter edits or activates", "Tab / Shift+Tab: actions / return", "Projects: Enter registration to edit", "Shift+Tab from row: Remove from Den", "Forms: Enter edits/accepts a field", "Tab accepts field and moves forward", "Esc cancels field; then backs out", "Apply/removal updates draft only", "Save writes all Settings sections", "Remove: Cancel is selected first", "PgUp/PgDn: long removal identity", "Files, Git, GitHub remain untouched", "Colors: type six hex digits after #", "Esc Colors: back, draft retained", "* marks a custom color override", "Cancel exits; confirms draft discard", "Reset: confirm, preview, then Save", "Reload: confirm discard, read disk", ...settingsFeedbackLines(session.message, w, wm), "PgUp/PgDn scroll · ? closes help", "Esc returns · Ctrl+C quits"];
    const helpHeight = bodyHeight - g.bodyPadding;
    navigation.helpOffset = Math.min(navigation.helpOffset, Math.max(0, help.length - helpHeight));
    this.help.height = helpHeight; this.help.fg = theme.textSecondary;
    this.help.content = help.slice(navigation.helpOffset, navigation.helpOffset + helpHeight).map(value => fit(value)).join("\n");
    this.actionDivider.fg = theme.divider; this.actionDivider.content = "\n".repeat(g.dividerHeight - 1) + "─".repeat(w);
    const actionLabels = { save: g.compact ? "Save" : "Save changes", cancel: "Cancel", reset: g.compact ? "Reset" : "Reset appearance", reload: "Reload", "apply-project": "Apply to draft", "cancel-project": "Cancel edit", "cancel-removal": "Cancel", "confirm-removal": "Remove from draft" };
    for (const [control, node] of this.actionNodes) {
      node.visible = navigation.actions.includes(control);
      const label = actionLabels[control as keyof typeof actionLabels];
      node.width = label.length + 4;
      node.content = new StyledText([navigation.control === control ? selected(`> ${label} `, true) : fg(control === "save" ? theme.accent : theme.textSecondary)(`  ${label}  `)]);
    }
    this.hints.fg = theme.textMuted;
    const hints = navigation.help ? "PgUp/PgDn Scroll\n? Close help · Esc Back" : navigation.section === "project-form" ? "Tab Next · Shift+Tab Previous\nEnter Accept/Edit · Esc Back/Cancel"
      : navigation.section === "project-remove" ? "Tab Choose · Enter · PgUp/PgDn Identity\nEsc Cancel · ? Help"
      : session.editing ? "Type #RRGGBB · Backspace corrects\nEnter Accept · Esc Cancel edit" : navigation.section === "colors"
      ? "↑↓ Move · Enter Edit · Tab Actions\nPgUp/PgDn Scroll · Esc Back · ? Help"
      : "↑↓ Move · Enter Choose · Tab Actions\n←→ Section · Esc Back · ? Help";
    this.hints.content = (g.hintsHeight > 2 ? "\n" : "") + hints;
  }

  private updatePreview(theme: SemanticTheme, width: number, compact: boolean, fit: (text: string, width?: number) => string): void {
    this.preview.height = compact ? 4 : 7;
    this.preview.borderColor = theme.divider; this.preview.border = compact ? [] : true;
    this.preview.backgroundColor = theme.panel;
    this.preview.paddingX = compact ? 0 : 1;
    this.radar.visible = !compact;
    this.radar.width = 24; this.radar.height = 5;
    this.radar.content = new StyledText([fg(theme.heading)("PROJECT RADAR\n"), fg(theme.textOnSelection)(bg(theme.selectionBackground)("> Sample project      ")), fg(theme.success)("\n  main · Clean"), fg(theme.textMuted)("\n\n1 project · 1 clean")]);
    const inner = compact ? width : width - 28;
    this.workbench.width = inner;
    this.sampleHeading.bg = compact ? theme.selectionBackground : theme.panel;
    this.sampleHeading.content = new StyledText([fg(compact ? theme.textOnSelection : theme.heading)(compact ? "> Sample project · main · Clean".padEnd(inner) : "PROJECT WORKBENCH")]);
    this.nextAction.bg = theme.panelAlt;
    this.nextAction.content = new StyledText([bold(fg(theme.accent)("Next action".padEnd(inner) + "\n")), fg(theme.textPrimary)(fit("Review the next task", inner).padEnd(inner))]);
    this.sampleStatus.content = new StyledText([fg(theme.success)("Git: Clean"), fg(theme.info)(compact ? " · GH: 1 open PR" : "     GitHub: 1 open PR")]);
    this.samplePr.visible = !compact;
    this.samplePr.content = new StyledText([fg(theme.textSecondary)("PR "), fg(theme.accentSubtle)("#35"), fg(theme.success)(" · Open"), fg(theme.textSecondary)(" · Settings polish")]);
  }

  private updateColors(session: SettingsSession, navigation: SettingsNavigation, capacity: number, width: number, groupSpacing: boolean, fit: (text: string, width?: number) => string): void {
    const theme = session.theme;
    const entries: { token?: ThemeToken; group: string; spacer?: boolean }[] = colorGroups.flatMap((group, index) => [
      ...(groupSpacing && index > 0 ? [{ group: group.label, spacer: true }] : []),
      { group: group.label }, ...group.tokens.map(token => ({ token, group: group.label })),
    ]);
    const selected = entries.findIndex(entry => entry.token === navigation.control);
    if (selected >= 0) this.offset = Math.max(0, Math.min(this.offset, selected));
    if (selected >= this.offset + capacity) this.offset = selected - capacity + 1;
    this.offset = Math.min(this.offset, Math.max(0, entries.length - capacity));
    let start = this.offset;
    while (start < entries.length && !entries[start]!.token) start++;
    let end = Math.min(entries.length, start + capacity);
    // Keep a group title with at least one color instead of orphaning it above the footer.
    while (end > start && !entries[end - 1]!.token) end--;
    this.groupHeading.content = new StyledText([bold(fg(theme.heading)(entries[start]!.group.toUpperCase()))]);
    this.colorRows.forEach((row, index) => {
      const entry = entries[start + index];
      row.box.visible = start + index < end;
      if (!row.box.visible || !entry) return;
      const token = entry.token;
      const active = navigation.control === token;
      row.box.backgroundColor = active ? theme.selectionBackground : theme.background;
      row.label.width = Math.min(34, width - 15);
      if (!token) {
        row.swatch.width = 0; row.value.width = 0; row.label.width = width;
        row.swatch.content = ""; row.value.content = "";
        row.label.content = entry.spacer ? "" : new StyledText([bold(fg(theme.heading)(entry.group.toUpperCase()))]);
        return;
      }
      row.swatch.width = 6; row.value.width = 9;
      const custom = session.overrides[token] !== undefined;
      const value = session.editing?.token === token ? session.editing.value + "_" : theme[token];
      row.swatch.content = new StyledText([fg(active ? theme.textOnSelection : theme.textSecondary)(active ? "> " : "  "), fg(theme.textMuted)("["), bg(theme[token])(" "), fg(theme.textMuted)("] ")]);
      row.label.fg = active ? theme.textOnSelection : theme.textPrimary;
      row.label.content = fit(colorLabels[token] + (custom ? " *" : ""), Math.min(34, width - 15));
      row.value.fg = active ? theme.textOnSelection : theme.textMuted;
      row.value.content = value;
    });
    this.scrollHint.fg = theme.textMuted;
    const current = entries[selected >= 0 ? selected : start]!;
    this.scrollHint.content = fit(`${current.group}${current.token && session.overrides[current.token] !== undefined ? " · * custom" : ""}${end < entries.length ? " · More below ↓" : " · End"}`);
  }
}
