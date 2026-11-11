import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { terminalPreferences, type Project, type TerminalPreference } from "./domain.js";
import { defaultThemeId, rgbColorPattern, themeIds, themeTokens, type ThemeId, type ThemeToken } from "./theme.js";

const projectSchema = z.strictObject({
  id: z.string().refine(value => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value.trim()), "Use letters, digits, hyphens or underscores, starting with a letter or digit."),
  name: z.string().refine(value => value.trim().length > 0, "Project name cannot be blank."),
  path: z.string().min(1).refine(value => value.trim().length > 0, "Project path cannot be blank."),
  repository: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/).optional(),
  lifecycle: z.string().refine(value => value.trim().length > 0, "Lifecycle cannot be blank."),
  nextAction: z.string().refine(value => value.trim().length > 0, "Next action cannot be blank.").optional(),
});
const settingsSchema = z.strictObject({
  terminal: z.enum(terminalPreferences).optional(),
  theme: z.enum(themeIds, { error: `Choose a supported theme: ${themeIds.join(", ")}.` }).optional(),
  themeOverrides: z.partialRecord(z.enum(themeTokens), z.string().regex(rgbColorPattern, "Use a hexadecimal RGB color in #RRGGBB format.")).optional(),
});
const registrySchema = z.strictObject({
  version: z.literal(1),
  settings: settingsSchema.optional(),
  projects: z.array(projectSchema),
});

export type RegistryConfiguration = { projects: Project[]; settings: { terminal: TerminalPreference; theme: ThemeId; themeOverrides: Partial<Record<ThemeToken, string>> } };
export type PersistedRegistry = z.infer<typeof registrySchema>;

export class RegistryError extends Error {}

export function expandProjectPath(input: string, home = homedir()): string {
  const expanded = input === "~" ? home : input.startsWith("~/") ? join(home, input.slice(2)) : input;
  if (!isAbsolute(expanded)) throw new RegistryError(`Project path must be absolute or start with ~/`);
  return resolve(expanded);
}

export function validatePersistedRegistry(raw: unknown, home = homedir()): PersistedRegistry {
  const result = registrySchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(issue => `${issue.path.join(".") || "registry"}: ${issue.message}`);
    throw new RegistryError(`Invalid project registry: ${issues.join("; ")}`);
  }
  const ids = new Set<string>();
  result.data.projects.forEach((entry, index) => {
    const id = entry.id.trim();
    if (ids.has(id)) throw new RegistryError(`projects.${index}.id: duplicate ID '${id}'.`);
    ids.add(id);
    try { expandProjectPath(entry.path.trim(), home); }
    catch (error) { throw new RegistryError(`projects.${index}.path: ${(error as Error).message}`); }
  });
  return result.data;
}

export function parsePersistedRegistry(json: string, home = homedir()): PersistedRegistry {
  let raw: unknown;
  try { raw = JSON.parse(json); }
  catch { throw new RegistryError("Malformed JSON in project registry."); }
  return validatePersistedRegistry(raw, home);
}

export function parseConfiguration(json: string, home = homedir()): RegistryConfiguration {
  const persisted = parsePersistedRegistry(json, home);
  return {
    projects: persisted.projects.map(entry => ({
      ...entry,
      id: entry.id.trim(),
      name: entry.name.trim(),
      path: expandProjectPath(entry.path.trim(), home),
      lifecycle: entry.lifecycle.trim(),
      ...(entry.nextAction === undefined ? {} : { nextAction: entry.nextAction.trim() }),
    })),
    settings: {
      terminal: persisted.settings?.terminal ?? "system",
      theme: persisted.settings?.theme ?? defaultThemeId,
      themeOverrides: persisted.settings?.themeOverrides ?? {},
    },
  };
}

export function parseRegistry(json: string, home = homedir()): Project[] {
  return parseConfiguration(json, home).projects;
}

export function defaultRegistryPath(home = homedir()): string {
  return join(home, ".config", "wolf-den", "projects.json");
}

export async function loadConfiguration(path = defaultRegistryPath()): Promise<RegistryConfiguration> {
  let json: string;
  try { json = await readFile(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new RegistryError("Project registry is missing. Create ~/.config/wolf-den/projects.json (see README).");
    throw new RegistryError("Could not read project registry. Check file permissions.");
  }
  return parseConfiguration(json);
}

export async function loadRegistry(path = defaultRegistryPath()): Promise<Project[]> {
  return (await loadConfiguration(path)).projects;
}
