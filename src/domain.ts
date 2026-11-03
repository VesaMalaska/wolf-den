export type Project = {
  id: string;
  name: string;
  path: string;
  repository?: string;
  lifecycle: string;
  nextAction?: string;
};

export type GitState =
  | { kind: "loading" }
  | { kind: "available"; branch: string; detached: boolean; staged: boolean; unstaged: boolean; untracked: boolean; clean: boolean }
  | { kind: "unavailable"; reason: string }
  | { kind: "stale"; previous: Extract<GitState, { kind: "available" }>; reason: string };

export type ProjectState = { project: Project; git: GitState };
