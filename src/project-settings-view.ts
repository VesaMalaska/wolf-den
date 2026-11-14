import { BoxRenderable, InputRenderable, TextRenderable, StyledText, bold, fg, measureEditText, type CliRenderer } from "@opentui/core";
import { projectFields, projectLabels, type ProjectField, type ProjectForm } from "./project-registrations.js";
import type { SettingsSession } from "./settings.js";
import type { SettingsNavigation, settingsGeometry } from "./settings-view.js";

/** Retained project sections and native single-line inputs. Settings owns persistence. */
export class ProjectSettingsView {
  readonly root: BoxRenderable;
  private overview: BoxRenderable;
  private heading: TextRenderable;
  private empty: TextRenderable;
  private add: TextRenderable;
  private list: BoxRenderable;
  private rows: { box: BoxRenderable; name: TextRenderable; path: TextRenderable }[] = [];
  private path: TextRenderable;
  private remove: TextRenderable;
  private formRoot: BoxRenderable;
  private formHeading: TextRenderable;
  private optionalHeading: TextRenderable;
  private fields = new Map<ProjectField, { box: BoxRenderable; label: TextRenderable; value: TextRenderable; input: InputRenderable }>();
  private optionalRow: BoxRenderable;
  private id: TextRenderable;
  private more: TextRenderable;
  private confirmation: BoxRenderable;
  private confirmTitle: TextRenderable;
  private confirmIdentity: TextRenderable;
  private confirmSafety: TextRenderable;
  private listOffset = 0;
  private formOffset = 0;
  private activeEdit: ProjectForm["editing"] = null;
  private session: SettingsSession | null = null;
  private settingInput = false;

  suspendInput(): void {
    for (const nodes of this.fields.values()) nodes.input.blur();
    this.activeEdit = null;
  }

  constructor(private renderer: CliRenderer, onInput: () => void) {
    const box = () => new BoxRenderable(renderer, { flexDirection: "column", flexShrink: 0, width: "100%" });
    const text = () => new TextRenderable(renderer, { height: 1, flexShrink: 0, wrapMode: "none" });
    this.root = box();
    this.overview = box(); this.root.add(this.overview);
    this.heading = text(); this.empty = text(); this.add = text(); this.list = box(); this.path = text(); this.remove = text();
    for (const node of [this.heading, this.empty, this.add, this.list, this.path, this.remove]) this.overview.add(node);
    this.formRoot = box(); this.root.add(this.formRoot);
    this.formHeading = text(); this.optionalHeading = text(); this.optionalRow = box();
    this.formRoot.add(this.formHeading);
    for (const field of projectFields) {
      const group = box(), label = text(), value = text();
      const input = new InputRenderable(renderer, { width: "100%", value: "", maxLength: Number.MAX_SAFE_INTEGER,
        keyBindings: [{ name: "a", ctrl: true, action: "select-all" }] });
      input.on("input", (value: string) => {
        if (!this.settingInput && this.session?.projects.form?.editing?.field === field) {
          this.session.projects.input(value);
          onInput();
        }
      });
      group.add(label); group.add(value); group.add(input);
      this.fields.set(field, { box: group, label, value, input });
      if (field === "repository") { this.formRoot.add(this.optionalHeading); this.formRoot.add(this.optionalRow); }
      if (field === "repository" || field === "lifecycle") this.optionalRow.add(group);
      else this.formRoot.add(group);
    }
    this.id = text(); this.more = text(); this.formRoot.add(this.id); this.formRoot.add(this.more);
    this.confirmation = box(); this.root.add(this.confirmation);
    this.confirmTitle = text(); this.confirmIdentity = text(); this.confirmSafety = text();
    this.confirmation.add(this.confirmTitle); this.confirmation.add(this.confirmIdentity); this.confirmation.add(this.confirmSafety);
  }

  update(session: SettingsSession, navigation: SettingsNavigation, width: number, height: number,
    geometry: ReturnType<typeof settingsGeometry>, fit: (value: string, columns?: number) => string,
    wrap: (value: string) => string[]): void {
    this.session = session;
    const { theme, projects } = session;
    const { compact, sectionGap } = geometry;
    this.root.height = height;
    this.overview.visible = navigation.section === "projects";
    this.formRoot.visible = navigation.section === "project-form";
    this.confirmation.visible = navigation.section === "project-remove";
    const styled = (value: string, focused: boolean) => new StyledText([fg(focused ? theme.textOnSelection : theme.textPrimary)(fit(`${focused ? "> " : "  "}${value}`))]);
    this.heading.content = new StyledText([bold(fg(theme.heading)(`PROJECTS · ${projects.entries.length} registered`))]);
    const headingHeight = 1 + (compact ? 0 : sectionGap);
    const addMargin = compact ? 1 : sectionGap;
    this.heading.height = headingHeight;
    this.empty.visible = projects.entries.length === 0;
    this.empty.height = compact ? 5 : 8;
    this.empty.content = new StyledText([bold(fg(theme.heading)(compact ? "\nYOUR DEN IS READY\n" : "\nYOUR DEN IS READY FOR ITS FIRST PROJECT\n\n")),
      fg(theme.textSecondary)(compact ? "Add a name and local directory.\nGitHub is optional." : "Add a name and a local directory to get started.\n\nA GitHub repository is optional.")]);
    this.add.content = styled("Add project >", navigation.control === "add-project");
    this.add.bg = navigation.control === "add-project" ? theme.selectionBackground : theme.background;
    this.add.marginBottom = addMargin;
    this.list.visible = this.path.visible = this.remove.visible = projects.entries.length > 0;
    this.path.visible = this.path.visible && compact;
    this.path.content = fit(projects.selected?.path ?? ""); this.path.fg = theme.textMuted;
    this.remove.content = styled(`Remove from Den… (${projects.selected?.name ?? ""})`, navigation.control === "remove-project");
    this.remove.bg = navigation.control === "remove-project" ? theme.selectionBackground : theme.background;
    const removeGap = compact || sectionGap < 2 ? 0 : 1;
    this.remove.marginTop = removeGap;
    const rowHeight = compact ? 1 : 2 + sectionGap;
    const listHeight = Math.max(rowHeight, height - headingHeight - 1 - addMargin - (compact ? 2 : 1 + removeGap));
    const count = Math.max(1, Math.floor(listHeight / rowHeight));
    const selectedIndex = Math.max(0, projects.entries.findIndex(entry => entry.id === projects.selectedId));
    this.listOffset = Math.max(0, Math.min(this.listOffset, selectedIndex, Math.max(0, projects.entries.length - count)));
    if (selectedIndex >= this.listOffset + count) this.listOffset = selectedIndex - count + 1;
    if (projects.entries.length > count) this.heading.content = new StyledText([bold(fg(theme.heading)(`PROJECTS · ${projects.entries.length} registered · ${this.listOffset + 1}–${Math.min(projects.entries.length, this.listOffset + count)} shown`))]);
    this.list.height = Math.min(projects.entries.length, count) * rowHeight;
    while (this.rows.length < count) {
      const row = new BoxRenderable(this.renderer, { flexDirection: "column", width: "100%", flexShrink: 0 });
      const name = new TextRenderable(this.renderer, { height: 1, wrapMode: "none" });
      const path = new TextRenderable(this.renderer, { height: 1, wrapMode: "none" });
      row.add(name); row.add(path); this.list.add(row); this.rows.push({ box: row, name, path });
    }
    for (const [index, row] of this.rows.entries()) {
      const entry = index < count ? projects.entries[this.listOffset + index] : undefined;
      row.box.visible = !!entry;
      if (!entry) continue;
      const focused = navigation.control === `project:${entry.id}`;
      row.box.height = rowHeight; row.path.visible = !compact;
      row.box.backgroundColor = focused ? theme.selectionBackground : theme.background;
      const nameWidth = compact ? Math.max(8, width - 16) : Math.min(48, width - 24);
      const name = fit(entry.name, nameWidth);
      row.name.content = styled(name + " ".repeat(Math.max(0, nameWidth - measureEditText(name, { widthMethod: this.renderer.widthMethod }))) + "  " + fit(entry.lifecycle, width - nameWidth - 4), focused);
      row.path.content = fit(`  ${entry.path}`); row.path.fg = focused ? theme.textOnSelection : theme.textMuted;
    }

    const form = projects.form;
    const editing = this.root.visible && this.formRoot.visible && !navigation.help ? form?.editing : null;
    for (const [field, nodes] of this.fields) {
      const focused = navigation.control === field;
      nodes.box.backgroundColor = focused ? theme.selectionBackground : theme.background;
      nodes.label.content = new StyledText([fg(form?.errors[field] ? theme.error : focused ? theme.textOnSelection : theme.textSecondary)(`${focused ? "> " : "  "}${projectLabels[field]}`)]);
      nodes.value.content = fit(`  [${form?.values[field] || (field === "repository" || field === "nextAction" ? "optional" : "")}]`);
      nodes.value.fg = focused ? theme.textOnSelection : theme.textPrimary;
      nodes.input.visible = editing?.field === field;
      nodes.value.visible = !nodes.input.visible;
      nodes.input.backgroundColor = theme.selectionBackground;
      nodes.input.focusedBackgroundColor = theme.selectionBackground;
      nodes.input.textColor = theme.textOnSelection; nodes.input.focusedTextColor = theme.textOnSelection;
      nodes.input.cursorColor = theme.focusBorder;
      if (editing?.field === field && editing !== this.activeEdit) {
        this.settingInput = true;
        nodes.input.value = form!.values[field];
        this.settingInput = false;
      }
      if (!nodes.input.visible) nodes.input.blur();
    }
    this.activeEdit = editing ?? null;
    const gap = compact ? 1 : sectionGap;
    this.optionalRow.flexDirection = compact ? "column" : "row";
    for (const field of ["repository", "lifecycle"] as const) this.fields.get(field)!.box.width = compact ? "100%" : "50%";
    const groups = compact ? projectFields.map(field => [field]) : [["name"], ["path"], ["repository", "lifecycle"], ["nextAction"]];
    const focusedGroup = groups.findIndex(group => group.includes(form?.field ?? "name"));
    const groupHeight = 2 + gap;
    const available = Math.max(1, Math.floor((height - (compact ? 2 : 4)) / groupHeight));
    this.formOffset = Math.max(0, Math.min(this.formOffset, focusedGroup, Math.max(0, groups.length - available)));
    if (focusedGroup >= this.formOffset + available) this.formOffset = focusedGroup - available + 1;
    const visibleFields = groups.slice(this.formOffset, this.formOffset + available).flat();
    this.formHeading.content = new StyledText([bold(fg(theme.heading)(this.formOffset >= 2 ? "OPTIONAL DETAILS" : "PROJECT DETAILS"))]);
    this.formHeading.height = 1 + (compact ? 0 : 1);
    this.optionalHeading.visible = this.formOffset < 2 && visibleFields.includes("repository");
    this.optionalHeading.content = new StyledText([bold(fg(theme.heading)("OPTIONAL DETAILS"))]);
    this.optionalRow.visible = visibleFields.includes("repository") || visibleFields.includes("lifecycle");
    this.optionalRow.height = compact ? ["repository", "lifecycle"].filter(field => visibleFields.includes(field)).length * groupHeight : groupHeight;
    for (const [field, nodes] of this.fields) { nodes.box.visible = visibleFields.includes(field); nodes.box.height = groupHeight; }
    const atEnd = this.formOffset + available >= groups.length;
    this.more.height = !compact && atEnd ? 0 : 1;
    this.id.visible = atEnd;
    this.id.content = fit(form?.id ? `Project ID: ${form.id} · fixed` : "Project ID: generated on Apply");
    this.id.fg = theme.textMuted;
    this.more.content = fit(`${this.formOffset > 0 ? "↑ Earlier fields  " : ""}${!atEnd ? "More fields below ↓" : ""}`); this.more.fg = theme.textMuted;
    if (editing) this.fields.get(editing.field)!.input.focus();

    const removed = projects.removing;
    this.confirmTitle.content = new StyledText([bold(fg(theme.heading)("REMOVE FROM WOLF DEN?"))]);
    this.confirmTitle.height = compact ? 1 : 3;
    const identityLines = [...wrap(removed?.name ?? ""), ...wrap(removed?.path ?? "")];
    const identityHeight = compact ? 3 : 5;
    navigation.identityOffset = Math.min(navigation.identityOffset, Math.max(0, identityLines.length - identityHeight));
    this.confirmIdentity.content = identityLines.slice(navigation.identityOffset, navigation.identityOffset + identityHeight).join("\n");
    this.confirmIdentity.fg = theme.textPrimary; this.confirmIdentity.height = identityHeight;
    this.confirmSafety.content = new StyledText([fg(theme.textPrimary)("Only the registration will be removed.\n"),
      bold(fg(theme.textPrimary)("Project files remain untouched.\n")), fg(theme.textSecondary)("Git and GitHub remain untouched.\nSave in Projects makes this permanent.")]);
    this.confirmSafety.height = 4;
    this.confirmation.paddingTop = compact ? 0 : sectionGap;
  }
}
