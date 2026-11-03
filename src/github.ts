import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { GithubAvailable, GithubPullRequest, GithubState } from "./domain.js";

const execFileAsync = promisify(execFile);
export type RunGh = (args: string[]) => Promise<string>;
const runGh: RunGh = async args => {
  const { stdout } = await execFileAsync("gh", args, {
    cwd: process.cwd(), encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 15000,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout;
};

const issueSchema = z.array(z.object({ number: z.number().int().positive() }));
const prSchema = z.array(z.object({
  number: z.number().int().positive(), title: z.string(), url: z.url(),
  isDraft: z.boolean(), reviewDecision: z.string().nullable(),
  statusCheckRollup: z.array(z.unknown()).nullable(),
}));
const limit = 1000;

function checksLabel(value: unknown[] | null): string | null {
  if (value === null) return null;
  if (value.length === 0) return "no checks";
  let passed = 0, failed = 0, pending = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const check = item as Record<string, unknown>;
    const result = check.conclusion ?? check.state;
    if (result === "SUCCESS" || result === "NEUTRAL" || result === "SKIPPED" || result === "EXPECTED") passed++;
    else if (result === "FAILURE" || result === "ERROR" || result === "TIMED_OUT" || result === "CANCELLED" || result === "ACTION_REQUIRED") failed++;
    else pending++;
  }
  return `${passed} passed, ${failed} failed, ${pending} pending`;
}

export function parseGithub(issuesJson: string, prsJson: string, repository: string): GithubAvailable {
  const issues = issueSchema.parse(JSON.parse(issuesJson) as unknown);
  const prs = prSchema.parse(JSON.parse(prsJson) as unknown);
  if (issues.length >= limit || prs.length >= limit) throw new Error("GitHub result limit reached; counts may be incomplete.");
  const pullRequests: GithubPullRequest[] = prs.map(pr => {
    const url = new URL(pr.url);
    if (url.origin !== "https://github.com" || url.pathname !== `/${repository}/pull/${pr.number}` || url.search || url.hash)
      throw new Error("Unexpected GitHub pull request URL.");
    return { number: pr.number, title: pr.title, url: pr.url, draft: pr.isDraft,
      review: pr.reviewDecision || null, checks: checksLabel(pr.statusCheckRollup) };
  });
  return { kind: "available", issues: issues.length, pullRequests };
}

export function githubError(error: unknown): string {
  if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return "GitHub CLI (gh) is not installed.";
  if (error instanceof SyntaxError || error instanceof z.ZodError || (error instanceof Error && /Unexpected GitHub pull request URL/.test(error.message)))
    return "GitHub returned invalid data. Check the repository and update gh, then refresh.";
  const message = error instanceof Error ? messageText(error) : "";
  if (/authentication|not logged in|gh auth login|unauthorized|HTTP 401/i.test(message)) return "GitHub CLI is not authenticated. Run gh auth login.";
  if (/rate limit|secondary rate limit|HTTP 429/i.test(message)) return "GitHub rate limit reached. Try again later.";
  if (/network|connection|connecting|offline|timed out|timeout|could not resolve|HTTP 502|HTTP 503/i.test(message)) return "GitHub network request failed. Try again later.";
  if (/result limit reached/i.test(message)) return "GitHub result limit reached; counts may be incomplete.";
  return "GitHub data could not be read. Check repository access and gh status.";
}

function messageText(error: Error): string {
  const stderr = (error as Error & { stderr?: unknown }).stderr;
  return `${error.message} ${typeof stderr === "string" ? stderr : ""}`;
}

export async function inspectGithub(repository: string | undefined, gh: RunGh = runGh): Promise<GithubState> {
  if (!repository) return { kind: "unavailable", reason: "No GitHub repository configured." };
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))
    return { kind: "unavailable", reason: "Invalid GitHub repository configuration." };
  try {
    const issues = await gh(["issue", "list", "--repo", repository, "--state", "open", "--json", "number", "--limit", String(limit)]);
    const prs = await gh(["pr", "list", "--repo", repository, "--state", "open", "--json", "number,title,url,isDraft,reviewDecision,statusCheckRollup", "--limit", String(limit)]);
    return parseGithub(issues, prs, repository);
  } catch (error) { return { kind: "unavailable", reason: githubError(error) }; }
}
