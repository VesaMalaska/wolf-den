import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import type { Project, TerminalPreference } from "./domain.js";
import { defaultThemeId, rgbColorPattern, themeIds, themeTokens, type ThemeId, type ThemeToken } from "./theme.js";

const projectSchema = z.strictObject({
  id: z.string().trim().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
  name: z.string().trim().min(1),
  path: z.string().trim().min(1),
  repository: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/).optional(),
  lifecycle: z.string().trim().min(1),
  nextAction: z.string().trim().min(1).optional(),
});
const registrySchema = z.strictObject({
  version: z.literal(1),
  settings: z.strictObject({
    terminal: z.enum(["system", "kitty", "konsole", "gnome-terminal", "xfce4-terminal", "alacritty", "xterm"]).default("system"),
    theme: z.enum(themeIds, { error: `Choose a supported theme: ${themeIds.join(", ")}.` }).default(defaultThemeId),
    themeOverrides: z.partialRecord(z.enum(themeTokens), z.string().regex(rgbColorPattern, "Use a hexadecimal RGB color in #RRGGBB format.")).default({}),
  }).prefault({}),
  projects: z.array(projectSchema),
});

export type RegistryConfiguration = { projects: Project[]; settings: { terminal: TerminalPreference; theme: ThemeId; themeOverrides: Partial<Record<ThemeToken, string>> } };

export class RegistryError extends Error {}

export function expandProjectPath(input: string, home = homedir()): string {
  const expanded = input === "~" ? home : input.startsWith("~/") ? join(home, input.slice(2)) : input;
  if (!isAbsolute(expanded)) throw new RegistryError(`Project path must be absolute or start with ~/`);
  return resolve(expanded);
}

export function parseConfiguration(json: string, home = homedir()): RegistryConfiguration {
  let raw: unknown;
  try { raw = JSON.parse(json); }
  catch { throw new RegistryError("Malformed JSON in project registry."); }
  const result = registrySchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(issue => `${issue.path.join(".") || "registry"}: ${issue.message}`);
    throw new RegistryError(`Invalid project registry: ${issues.join("; ")}`);
  }
  const ids = new Set<string>();
  const projects = result.data.projects.map((entry, index) => {
    if (ids.has(entry.id)) throw new RegistryError(`projects.${index}.id: duplicate ID '${entry.id}'.`);
    ids.add(entry.id);
    try { return { ...entry, path: expandProjectPath(entry.path, home) }; }
    catch (error) { throw new RegistryError(`projects.${index}.path: ${(error as Error).message}`); }
  });
  return { projects, settings: result.data.settings };
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
