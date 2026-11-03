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

export type GithubPullRequest = { number: number; title: string; url: string; review: string | null; checks: string | null; draft: boolean };
export type GithubAvailable = { kind: "available"; issues: number; pullRequests: GithubPullRequest[] };
export type GithubState =
  | { kind: "loading"; previous?: GithubAvailable }
  | GithubAvailable
  | { kind: "stale"; previous: GithubAvailable; reason: string }
  | { kind: "unavailable"; reason: string };

export type ProjectState = { project: Project; git: GitState; github: GithubState };
