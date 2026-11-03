import type { GithubState, Project, ProjectState } from "./domain.js";
import { inspectGit } from "./git.js";
import { inspectGithub } from "./github.js";

export async function loadProjectStates(projects: Project[], inspect = inspectGit, inspectRemote = inspectGithub): Promise<ProjectState[]> {
  return Promise.all(projects.map(async project => {
    const [git, github] = await Promise.all([
      inspect(project.path).catch(() => ({ kind: "unavailable" as const, reason: "Git inspection failed." })),
      inspectRemote(project.repository).catch(() => ({ kind: "unavailable" as const, reason: "GitHub inspection failed." })),
    ]);
    return { project, git, github };
  }));
}

export class GithubRefresh {
  private readonly pending = new Set<string>();
  constructor(private readonly inspectRemote: typeof inspectGithub = inspectGithub) {}

  async refresh(state: ProjectState, update: (github: GithubState) => void): Promise<void> {
    if (this.pending.has(state.project.id) || !state.project.repository) return;
    this.pending.add(state.project.id);
    const previous = state.github.kind === "available" ? state.github
      : state.github.kind === "stale" || state.github.kind === "loading" ? state.github.previous : undefined;
    update(previous ? { kind: "loading", previous } : { kind: "loading" });
    try {
      const result = await this.inspectRemote(state.project.repository);
      update(result.kind === "unavailable" && previous ? { kind: "stale", previous, reason: result.reason } : result);
    } catch {
      const reason = "GitHub inspection failed.";
      update(previous ? { kind: "stale", previous, reason } : { kind: "unavailable", reason });
    } finally { this.pending.delete(state.project.id); }
  }
}
