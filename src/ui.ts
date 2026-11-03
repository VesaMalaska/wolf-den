import { BoxRenderable, TextRenderable, createCliRenderer, type KeyEvent } from "@opentui/core";
import type { ProjectState } from "./domain.js";
import { loadProjectStates } from "./projects.js";
import { loadRegistry, RegistryError } from "./registry.js";

function gitLabel(state: ProjectState): string {
  const git = state.git;
  if (git.kind === "loading") return "Loading Git state…";
  if (git.kind === "unavailable") return `Git unavailable: ${git.reason}`;
  if (git.kind === "stale") return `Git stale: ${git.reason}`;
  return `${git.branch} · ${git.clean ? "clean" : "dirty"}`;
}

function details(state: ProjectState | undefined): string {
  if (!state) return "No projects configured. Add a project to the registry.";
  const git = state.git;
  const changes = git.kind === "available"
    ? `Changes: ${git.clean ? "none" : [git.staged && "staged", git.unstaged && "unstaged", git.untracked && "untracked"].filter(Boolean).join(", ")}`
    : "";
  return [state.project.name, `Lifecycle: ${state.project.lifecycle}`, `Next action: ${state.project.nextAction ?? "Not set"}`, `Directory: ${state.project.path}`, gitLabel(state), changes].filter(Boolean).join("\n");
}

export async function runDashboard(): Promise<void> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true });
  let states: ProjectState[] = [];
  let selected = 0;
  let notice = "Loading project registry…";
  const layout = new BoxRenderable(renderer, { flexDirection: "column", padding: 1, gap: 1, width: "100%", height: "100%" });
  const title = new TextRenderable(renderer, { content: "Wolf Den", fg: "#9fd4ff" });
  const list = new TextRenderable(renderer, { content: "", fg: "#ffffff" });
  const detail = new TextRenderable(renderer, { content: "", fg: "#d6e4ee" });
  const footer = new TextRenderable(renderer, { content: "↑/↓ select · q quit", fg: "#9aa9b7" });
  layout.add(title);
  layout.add(list);
  layout.add(detail);
  layout.add(footer);
  renderer.root.add(layout);

  const render = () => {
    list.content = states.length ? states.map((state, index) => `${index === selected ? "❯" : " "} ${state.project.name}  ${gitLabel(state)}`).join("\n") : notice;
    detail.content = details(states[selected]);
  };
  const onKey = (key: KeyEvent) => {
    if (key.name === "q" || key.name === "escape") { renderer.destroy(); return; }
    if (key.name === "up") selected = Math.max(0, selected - 1);
    else if (key.name === "down") selected = Math.min(states.length - 1, selected + 1);
    else return;
    render();
  };
  renderer.keyInput.on("keypress", onKey);
  renderer.once("destroy", () => renderer.keyInput.off("keypress", onKey));
  render();

  try {
    const projects = await loadRegistry();
    states = projects.map(project => ({ project, git: { kind: "loading" } }));
    notice = "No projects configured.";
    render();
    states = await loadProjectStates(projects);
    render();
  } catch (error) {
    notice = error instanceof RegistryError ? error.message : "Could not load project data.";
    render();
  }
}
