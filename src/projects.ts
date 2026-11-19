import type { GithubState, Project, ProjectState } from "./domain.js";
import { inspectGit } from "./git.js";
import { inspectGithub } from "./github.js";

/** Preserve identity and cached sources only when their configured targets still match. */
export function reconcileProjectStates(previous: ProjectState[], projects: Project[]): ProjectState[] {
  return projects.map(project => {
    const existing = previous.find(state => state.project.id === project.id && state.project.path === project.path && state.project.repository === project.repository);
    if (existing) { existing.project = project; return existing; }
    return { project, git: { kind: "loading" }, github: project.repository ? { kind: "loading" } : { kind: "unavailable", reason: "No GitHub repository configured." } };
  });
}

export function retainedProjectId(previousIds: string[], nextIds: string[], selectedId?: string): string | undefined {
  if (selectedId && nextIds.includes(selectedId)) return selectedId;
  const index = selectedId === undefined ? -1 : previousIds.indexOf(selectedId);
  return previousIds.slice(index + 1).find(id => nextIds.includes(id))
    ?? previousIds.slice(0, Math.max(0, index)).reverse().find(id => nextIds.includes(id)) ?? nextIds[0];
}

export async function loadProjectStates(projects: Project[], inspect = inspectGit, inspectRemote = inspectGithub,
  onUpdate?: (state: ProjectState, index: number) => void): Promise<ProjectState[]> {
  return Promise.all(projects.map(async (project, index) => {
    const state: ProjectState = { project, git: { kind: "loading" }, github: project.repository
      ? { kind: "loading" } : { kind: "unavailable", reason: "No GitHub repository configured." } };
    const local = inspect(project.path).catch(() => ({ kind: "unavailable" as const, reason: "Git inspection failed." }))
      .then(git => { state.git = git; onUpdate?.(state, index); });
    const remote = project.repository ? inspectRemote(project.repository).catch(() => ({ kind: "unavailable" as const, reason: "GitHub inspection failed." }))
      .then(github => { state.github = github; onUpdate?.(state, index); }) : Promise.resolve();
    await Promise.all([local, remote]);
    return state;
  }));
}

export class GithubRefresh {
  private readonly pending = new Set<string>();
  constructor(private readonly inspectRemote: typeof inspectGithub = inspectGithub) {}

  async refresh(state: ProjectState, update: (github: GithubState) => void): Promise<void> {
    const key = JSON.stringify([state.project.id, state.project.repository]);
    if (this.pending.has(key) || !state.project.repository) return;
    this.pending.add(key);
    const previous = state.github.kind === "available" ? state.github
      : state.github.kind === "stale" || state.github.kind === "loading" ? state.github.previous : undefined;
    update(previous ? { kind: "loading", previous } : { kind: "loading" });
    try {
      const result = await this.inspectRemote(state.project.repository);
      update(result.kind === "unavailable" && previous ? { kind: "stale", previous, reason: result.reason } : result);
    } catch {
      const reason = "GitHub inspection failed.";
      update(previous ? { kind: "stale", previous, reason } : { kind: "unavailable", reason });
    } finally { this.pending.delete(key); }
  }
}
