import { BoxRenderable, TextRenderable, createCliRenderer, type KeyEvent } from "@opentui/core";
import { ProjectActions } from "./actions.js";
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

function details(state: ProjectState | undefined, selectedPr: number): string {
  if (!state) return "No projects configured. Add a project to the registry.";
  const git = state.git;
  const changes = git.kind === "available"
    ? `Changes: ${git.clean ? "none" : [git.staged && "staged", git.unstaged && "unstaged", git.untracked && "untracked"].filter(Boolean).join(", ")}`
    : "";
  const remote = state.github;
  const data = remote.kind === "available" ? remote : remote.kind === "stale" || remote.kind === "loading" ? remote.previous : undefined;
  const prs = data?.pullRequests.map((pr, index) => `${index === selectedPr ? "❯" : " "} #${pr.number} ${safeText(pr.title)}${pr.draft ? " [draft]" : ""}\n  ${pr.url}\n  Review: ${pr.review ?? "unavailable"} · Checks: ${pr.checks ?? "unavailable"}`) ?? [];
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
  let selectedPr = -1;
  let showingHelp = false;
  let notice = "Loading project registry…";
  let initialLoadPending = true;
  const refresh = new GithubRefresh();
  const actions = new ProjectActions();
  const layout = new BoxRenderable(renderer, { flexDirection: "column", padding: 1, gap: 1, width: "100%", height: "100%" });
  const title = new TextRenderable(renderer, { content: "Wolf Den", fg: "#9fd4ff" });
  const list = new TextRenderable(renderer, { content: "", fg: "#ffffff" });
  const detail = new TextRenderable(renderer, { content: "", fg: "#d6e4ee" });
  const message = new TextRenderable(renderer, { content: "", fg: "#ffd58a" });
  const footer = new TextRenderable(renderer, { content: "↑/↓ project · Tab PR · e editor · o terminal · g repo · p PR · r refresh · ? help · q quit", fg: "#9aa9b7" });
  layout.add(title);
  layout.add(list);
  layout.add(detail);
  layout.add(message);
  layout.add(footer);
  renderer.root.add(layout);

  const render = () => {
    if (destroyed) return;
    list.content = states.length ? states.map((state, index) => `${index === selected ? "❯" : " "} ${safeText(state.project.name)}  ${gitLabel(state)}  ·  ${githubLabel(state)}`).join("\n") : notice;
    detail.content = showingHelp
      ? "Keyboard shortcuts\n↑/↓  Select project\nTab  Select next PR (first press selects the first PR)\ne  Open project in VS Code\no  Open terminal in project\ng  Open GitHub repository\np  Open selected PR\nr  Refresh selected project's GitHub data\n?  Close help\nq / Esc / Ctrl+C  Quit"
      : details(states[selected], selectedPr);
    message.content = notice;
  };
  const onKey = (key: KeyEvent) => {
    if (key.name === "q" || key.name === "escape") { renderer.destroy(); return; }
    if (key.name === "?") { showingHelp = !showingHelp; render(); return; }
    if (showingHelp) return;
    const state = states[selected];
    if (key.name === "tab") {
      const data = state?.github.kind === "available" ? state.github : undefined;
      if (!data?.pullRequests.length) { notice = "No available PRs to select for this project."; render(); return; }
      selectedPr = (selectedPr + 1) % data.pullRequests.length;
      notice = `Selected PR #${data.pullRequests[selectedPr]!.number}.`;
      render(); return;
    }
    if (key.name === "r") {
      if (state && !initialLoadPending) {
        if (!state.project.repository) { notice = "No GitHub repository configured for this project."; render(); return; }
        selectedPr = -1;
        notice = `Refreshing GitHub for ${safeText(state.project.name)}…`;
        void refresh.refresh(state, github => { if (!destroyed) { state.github = github; notice = github.kind === "unavailable" || github.kind === "stale" ? github.reason : github.kind === "available" ? "GitHub refreshed." : notice; render(); } });
      }
      return;
    }
    if (["e", "o", "g", "p"].includes(key.name)) {
      if (!state || initialLoadPending) { notice = "No project is ready for actions."; render(); return; }
      const pr = state.github.kind === "available" ? state.github.pullRequests[selectedPr] : undefined;
      const action = key.name === "e" ? actions.editor(state.project)
        : key.name === "o" ? actions.terminal(state.project)
        : key.name === "g" ? actions.repository(state.project)
        : pr ? actions.pullRequest(state.project, pr) : Promise.reject(new Error("Select an available PR with Tab first."));
      void action.then(() => { if (!destroyed) { notice = `${key.name.toUpperCase()} action launched for ${safeText(state.project.name)}.`; render(); } })
        .catch((error: unknown) => { if (!destroyed) { notice = error instanceof Error ? error.message : "Action failed."; render(); } });
      return;
    }
    if (key.name === "up" || key.name === "down") { selected = moveSelection(selected, states.length, key.name); selectedPr = -1; notice = "↑/↓ project · Tab PR · e editor · o terminal · g repo · p PR · r refresh · ? help · q quit"; }
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
