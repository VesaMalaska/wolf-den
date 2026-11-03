import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import type { GitState } from "./domain.js";

const execFileAsync = promisify(execFile);
type RunGit = (cwd: string, args: string[]) => Promise<string>;

const runGit: RunGit = async (cwd, args) => {
  const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 5000, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  return stdout;
};

export function parsePorcelain(output: string): Pick<Extract<GitState, {kind: "available"}>, "staged" | "unstaged" | "untracked" | "clean"> {
  let staged = false, unstaged = false, untracked = false;
  const records = output.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.length < 3 || record[2] !== " ") throw new Error("Unexpected Git status output.");
    const x = record[0], y = record[1];
    if (x === "?" && y === "?") untracked = true;
    else {
      if (x !== " " && x !== "!") staged = true;
      if (y !== " " && y !== "!") unstaged = true;
      if (x === "R" || x === "C" || y === "R" || y === "C") i++;
    }
  }
  return { staged, unstaged, untracked, clean: !staged && !unstaged && !untracked };
}

export async function inspectGit(path: string, git: RunGit = runGit): Promise<GitState> {
  try {
    if (!(await stat(path)).isDirectory()) return { kind: "unavailable", reason: "Project path is not a directory." };
  } catch { return { kind: "unavailable", reason: "Project directory is missing or inaccessible." }; }
  try {
    if ((await git(path, ["rev-parse", "--is-inside-work-tree"])).trim() !== "true")
      return { kind: "unavailable", reason: "Not a Git working tree." };
    let detached = false;
    let branch: string;
    try { branch = (await git(path, ["symbolic-ref", "--quiet", "--short", "HEAD"])).trim(); }
    catch { detached = true; branch = `detached at ${(await git(path, ["rev-parse", "--short", "HEAD"])).trim()}`; }
    const status = parsePorcelain(await git(path, ["status", "--porcelain=v1", "-z", "--untracked-files=normal"]));
    return { kind: "available", branch, detached, ...status };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { kind: "unavailable", reason: code === "ENOENT" ? "Git is not installed." : "Not a Git repository or Git status could not be read." };
  }
}
