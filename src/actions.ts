import { spawn, type SpawnOptions } from "node:child_process";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { GithubPullRequest, Project } from "./domain.js";

export type Launch = (executable: string, args: string[], options: SpawnOptions) => Promise<void>;

const launch: Launch = (executable, args, options) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { ...options, shell: false, detached: true, stdio: "ignore" });
  child.once("error", reject);
  child.once("spawn", () => { child.unref(); resolve(); });
});

const terminals = [
  { executable: "konsole", args: (path: string) => ["--workdir", path] },
  { executable: "gnome-terminal", args: (path: string) => ["--working-directory", path] },
  { executable: "xfce4-terminal", args: (path: string) => ["--working-directory", path] },
  { executable: "kitty", args: (path: string) => ["--directory", path] },
  { executable: "alacritty", args: (path: string) => ["--working-directory", path] },
  { executable: "xterm", args: (_path: string) => [] },
] as const;

function missingExecutable(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

function failed(action: string, error: unknown): Error {
  if (missingExecutable(error)) return new Error(`${action} is not installed or not on PATH.`);
  return new Error(`${action} could not be launched: ${error instanceof Error ? error.message : "unknown error"}`);
}

async function directory(project: Project): Promise<string> {
  if (!isAbsolute(project.path) || project.path.includes("\0")) throw new Error("Configured project path must be an absolute directory.");
  try {
    if (!(await stat(project.path)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error("Selected project directory is unavailable. Check its configured path.");
  }
  return project.path;
}

function repositoryUrl(project: Project): string {
  if (!project.repository || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(project.repository))
    throw new Error("Selected project has no valid GitHub repository configured.");
  return `https://github.com/${project.repository}`;
}

function pullRequestUrl(project: Project, pr: GithubPullRequest): string {
  const expected = `${repositoryUrl(project)}/pull/${pr.number}`;
  if (!Number.isSafeInteger(pr.number) || pr.number < 1 || pr.url !== expected)
    throw new Error("Selected pull request has an invalid GitHub URL.");
  return expected;
}

export class ProjectActions {
  constructor(private readonly run: Launch = launch, private readonly env: NodeJS.ProcessEnv = process.env) {}

  async editor(project: Project): Promise<void> {
    const path = await directory(project);
    try { await this.run("code", ["--new-window", path], { cwd: path }); }
    catch (error) { throw failed("VS Code (code)", error); }
  }

  async terminal(project: Project): Promise<void> {
    const path = await directory(project);
    if (!this.env.DISPLAY && !this.env.WAYLAND_DISPLAY) throw new Error("No graphical session is available to open a new terminal.");
    for (const terminal of terminals) {
      try { await this.run(terminal.executable, terminal.args(path), { cwd: path }); return; }
      catch (error) { if (!missingExecutable(error)) throw failed(terminal.executable, error); }
    }
    throw new Error("No supported terminal found. Install konsole, gnome-terminal, xfce4-terminal, kitty, alacritty or xterm.");
  }

  async repository(project: Project): Promise<void> {
    const url = repositoryUrl(project);
    try { await this.run("xdg-open", [url], { cwd: process.cwd() }); }
    catch (error) { throw failed("Browser opener (xdg-open)", error); }
  }

  async pullRequest(project: Project, pr: GithubPullRequest): Promise<void> {
    const url = pullRequestUrl(project, pr);
    try { await this.run("xdg-open", [url], { cwd: process.cwd() }); }
    catch (error) { throw failed("Browser opener (xdg-open)", error); }
  }
}
