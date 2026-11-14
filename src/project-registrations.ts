import { RegistryError, validatePersistedRegistry, type PersistedRegistry } from "./registry.js";

export type Registration = PersistedRegistry["projects"][number];
export const projectFields = ["name", "path", "repository", "lifecycle", "nextAction"] as const;
export type ProjectField = typeof projectFields[number];
export type ProjectForm = {
  id?: string;
  values: Record<ProjectField, string>;
  original: Record<ProjectField, string>;
  field: ProjectField;
  editing: { field: ProjectField; original: string } | null;
  errors: Partial<Record<ProjectField, string>>;
};

export const projectLabels: Record<ProjectField, string> = {
  name: "Name *", path: "Local path *", repository: "GitHub repository", lifecycle: "Lifecycle", nextAction: "Next Action",
};

function valuesOf(project?: Registration): Record<ProjectField, string> {
  return { name: project?.name ?? "", path: project?.path ?? "", repository: project?.repository ?? "",
    lifecycle: project?.lifecycle ?? "active", nextAction: project?.nextAction ?? "" };
}

export function uniqueProjectId(name: string, projects: readonly Registration[]): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const used = new Set(projects.map(project => project.id.trim()));
  let id = slug;
  for (let suffix = 2; used.has(id); suffix++) id = `${slug}-${suffix}`;
  return id;
}

function fieldError(field: ProjectField, value: string): string | undefined {
  const candidate: Registration = { id: "project", name: "Project", path: "/project", lifecycle: "active" };
  if ((field === "repository" || field === "nextAction") && !value.trim()) return;
  candidate[field] = value;
  try { validatePersistedRegistry({ version: 1, projects: [candidate] }); }
  catch (error) {
    if (!(error instanceof RegistryError)) throw error;
    if (field === "repository") return "GitHub repository: use owner/name, or leave blank.";
    if (field === "path") return "Local path: use an absolute or ~/ path.";
    return `${projectLabels[field].replace(" *", "")}: cannot be blank.`;
  }
}

/** A copy of registration data; no filesystem writes or UI dependencies. */
export class ProjectRegistrations {
  entries: Registration[];
  selectedId: string | undefined;
  form: ProjectForm | null = null;
  removingId: string | null = null;
  removeFocused = false;
  discardingForm = false;

  constructor(projects: readonly Registration[], selectedId?: string) {
    this.entries = structuredClone([...projects]);
    this.selectedId = this.entries.find(entry => entry.id.trim() === selectedId?.trim())?.id ?? this.entries[0]?.id;
  }

  get selected(): Registration | undefined { return this.entries.find(entry => entry.id === this.selectedId); }
  get removing(): Registration | undefined { return this.entries.find(entry => entry.id === this.removingId); }
  get formDirty(): boolean { return !!this.form && JSON.stringify(this.form.values) !== JSON.stringify(this.form.original); }

  openForm(add = false): void {
    const project = add ? undefined : this.selected;
    if (!add && !project) return;
    const values = valuesOf(project);
    this.form = { id: project?.id, values, original: { ...values }, field: "name", editing: null, errors: {} };
    this.discardingForm = false;
  }

  startField(field: ProjectField): void {
    if (!this.form) return;
    this.form.field = field;
    this.form.editing = { field, original: this.form.values[field] };
  }

  input(value: string): void {
    if (this.form?.editing) this.form.values[this.form.editing.field] = value;
  }

  acceptField(): boolean {
    if (!this.form?.editing) return true;
    const { field } = this.form.editing;
    const error = fieldError(field, this.form.values[field]);
    this.form.errors[field] = error;
    if (error) return false;
    this.form.editing = null;
    return true;
  }

  cancelField(): void {
    if (!this.form?.editing) return;
    const { field, original } = this.form.editing;
    this.form.values[field] = original;
    delete this.form.errors[field];
    this.form.editing = null;
  }

  closeForm(): boolean {
    if (this.formDirty) { this.discardingForm = true; return false; }
    this.form = null;
    return true;
  }

  apply(): Registration | undefined {
    const form = this.form;
    if (!form) return;
    for (const field of projectFields) form.errors[field] = fieldError(field, form.values[field]);
    const invalid = projectFields.find(field => form.errors[field]);
    if (invalid) { form.field = invalid; return; }
    const project: Registration = { id: form.id ?? uniqueProjectId(form.values.name, this.entries),
      name: form.values.name, path: form.values.path, lifecycle: form.values.lifecycle,
      ...(form.values.repository.trim() ? { repository: form.values.repository } : {}),
      ...(form.values.nextAction.trim() ? { nextAction: form.values.nextAction } : {}) };
    const entries = form.id === undefined ? [...this.entries, project] : this.entries.map(entry => entry.id === form.id ? project : entry);
    validatePersistedRegistry({ version: 1, projects: entries });
    this.entries = entries;
    this.selectedId = project.id;
    this.form = null;
    return project;
  }

  requestRemoval(): void { this.removingId = this.selected?.id ?? null; this.removeFocused = false; }
  confirmRemoval(): void {
    if (!this.removingId || !this.removeFocused) { this.removingId = null; return; }
    const index = this.entries.findIndex(entry => entry.id === this.removingId);
    this.entries = this.entries.filter(entry => entry.id !== this.removingId);
    this.selectedId = this.entries[index]?.id ?? this.entries[index - 1]?.id;
    this.removingId = null;
  }
}
