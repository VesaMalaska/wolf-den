import { BoxRenderable, TextRenderable, createCliRenderer, type KeyEvent } from "@opentui/core";
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

function githubLabel(state: ProjectState): string {
  const remote = state.github;
  if (remote.kind === "unavailable") return `GitHub unavailable: ${remote.reason}`;
  if (remote.kind === "loading") return `GitHub loading…${remote.previous ? " (previous data shown below)" : ""}`;
  const data = remote.kind === "stale" ? remote.previous : remote;
  const counts = `${data.issues} open issues · ${data.pullRequests.length} open PRs`;
  return remote.kind === "stale" ? `GitHub stale: ${counts} · ${remote.reason}` : `GitHub: ${counts}`;
}

function details(state: ProjectState | undefined): string {
  if (!state) return "No projects configured. Add a project to the registry.";
  const git = state.git;
  const changes = git.kind === "available"
    ? `Changes: ${git.clean ? "none" : [git.staged && "staged", git.unstaged && "unstaged", git.untracked && "untracked"].filter(Boolean).join(", ")}`
    : "";
  const remote = state.github;
  const data = remote.kind === "available" ? remote : remote.kind === "stale" || remote.kind === "loading" ? remote.previous : undefined;
  const prs = data?.pullRequests.map(pr => `#${pr.number} ${safeText(pr.title)}${pr.draft ? " [draft]" : ""}\n  ${pr.url}\n  Review: ${pr.review ?? "unavailable"} · Checks: ${pr.checks ?? "unavailable"}`) ?? [];
  return [safeText(state.project.name), `Lifecycle: ${safeText(state.project.lifecycle)}`, `Next action: ${safeText(state.project.nextAction ?? "Not set")}`, `Directory: ${state.project.path}`, gitLabel(state), changes, githubLabel(state), ...prs].filter(Boolean).join("\n");
}

export function moveSelection(selected: number, count: number, direction: "up" | "down"): number {
  if (count === 0) return 0;
  return Math.max(0, Math.min(count - 1, selected + (direction === "up" ? -1 : 1)));
}

export async function runDashboard(): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let destroyed = false;
  let states: ProjectState[] = [];
  let selected = 0;
  let notice = "Loading project registry…";
  let initialLoadPending = true;
  const refresh = new GithubRefresh();
  const layout = new BoxRenderable(renderer, { flexDirection: "column", padding: 1, gap: 1, width: "100%", height: "100%" });
  const title = new TextRenderable(renderer, { content: "Wolf Den", fg: "#9fd4ff" });
  const list = new TextRenderable(renderer, { content: "", fg: "#ffffff" });
  const detail = new TextRenderable(renderer, { content: "", fg: "#d6e4ee" });
  const footer = new TextRenderable(renderer, { content: "↑/↓ select · r refresh GitHub · q quit", fg: "#9aa9b7" });
  layout.add(title);
  layout.add(list);
  layout.add(detail);
  layout.add(footer);
  renderer.root.add(layout);

  const render = () => {
    if (destroyed) return;
    list.content = states.length ? states.map((state, index) => `${index === selected ? "❯" : " "} ${safeText(state.project.name)}  ${gitLabel(state)}  ·  ${githubLabel(state)}`).join("\n") : notice;
    detail.content = details(states[selected]);
  };
  const onKey = (key: KeyEvent) => {
    if (key.name === "q" || key.name === "escape") { renderer.destroy(); return; }
    if (key.name === "r") {
      const state = states[selected];
      if (state && !initialLoadPending) void refresh.refresh(state, github => { if (!destroyed) { state.github = github; render(); } });
      return;
    }
    if (key.name === "up" || key.name === "down") selected = moveSelection(selected, states.length, key.name);
    else return;
    render();
  };
  renderer.keyInput.on("keypress", onKey);
  renderer.once("destroy", () => {
    destroyed = true;
    renderer.keyInput.off("keypress", onKey);
  });
  render();

  try {
    const projects = await loadRegistry();
    if (destroyed) return;
    states = projects.map(project => ({ project, git: { kind: "loading" }, github: project.repository ? { kind: "loading" } : { kind: "unavailable", reason: "No GitHub repository configured." } }));
    notice = "No projects configured.";
    render();
    states = await loadProjectStates(projects);
    if (destroyed) return;
    initialLoadPending = false;
    render();
  } catch (error) {
    if (destroyed) return;
    notice = error instanceof RegistryError ? error.message : "Could not load project data.";
    render();
  }
}
