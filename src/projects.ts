import type { Project, ProjectState } from "./domain.js";
import { inspectGit } from "./git.js";

export async function loadProjectStates(projects: Project[], inspect = inspectGit): Promise<ProjectState[]> {
  return Promise.all(projects.map(async project => {
    try { return { project, git: await inspect(project.path) }; }
    catch { return { project, git: { kind: "unavailable" as const, reason: "Git inspection failed." } }; }
  }));
}
