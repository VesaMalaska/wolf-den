import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ProjectActions, type Launch } from "../src/actions.js";
import type { Project } from "../src/domain.js";

test("editor, terminal, repository and PR use explicit arguments for the selected target", async () => {
  const path = await mkdtemp(join(tmpdir(), "wolf-den-actions-"));
  try {
    const project: Project = { id: "one", name: "One", path, repository: "owner/repo", lifecycle: "active" };
    const calls: { executable: string; args: string[]; cwd: unknown; shell: unknown }[] = [];
    const run: Launch = async (executable, args, options) => { calls.push({ executable, args, cwd: options.cwd, shell: options.shell }); };
    const actions = new ProjectActions(run, { DISPLAY: ":0" });
    await actions.editor(project);
    await actions.terminal(project);
    await actions.repository(project);
    await actions.pullRequest(project, { number: 7, title: "PR", url: "https://github.com/owner/repo/pull/7", draft: false, checks: null, review: null });
    assert.deepEqual(calls.map(({ executable, args }) => [executable, args]), [
      ["code", ["--new-window", path]], ["konsole", ["--workdir", path]],
      ["xdg-open", ["https://github.com/owner/repo"]], ["xdg-open", ["https://github.com/owner/repo/pull/7"]],
    ]);
    assert.equal(calls[0]?.cwd, path);
    assert.equal(calls[1]?.cwd, path);
    assert.ok(calls.every(call => call.shell !== true));
  } finally { await rm(path, { recursive: true }); }
});

test("missing terminal candidates fall back; launch failures stop with an error", async () => {
  const path = await mkdtemp(join(tmpdir(), "wolf-den-actions-"));
  try {
    const project: Project = { id: "one", name: "One", path, lifecycle: "active" };
    const tried: string[] = [];
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
    const actions = new ProjectActions(async executable => {
      tried.push(executable);
      if (executable !== "kitty") throw missing;
    }, { DISPLAY: ":0" });
    await actions.terminal(project);
    assert.deepEqual(tried, ["konsole", "gnome-terminal", "xfce4-terminal", "kitty"]);
    await assert.rejects(new ProjectActions(async () => { throw missing; }, { DISPLAY: ":0" }).terminal(project), /No supported terminal/);
    await assert.rejects(new ProjectActions(async () => { throw new Error("failed"); }, { DISPLAY: ":0" }).terminal(project), /konsole could not be launched/);
    await assert.rejects(new ProjectActions(async () => { throw missing; }).editor(project), /VS Code.*not installed/);
    await assert.rejects(new ProjectActions(async () => { throw missing; }).repository({ ...project, repository: "owner/repo" }), /xdg-open.*not installed/);
  } finally { await rm(path, { recursive: true }); }
});

test("unavailable paths and invalid or absent GitHub targets never launch a program", async () => {
  let calls = 0;
  const run: Launch = async () => { calls++; };
  const project: Project = { id: "one", name: "One", path: "/missing-wolf-den-test-path", lifecycle: "active" };
  const actions = new ProjectActions(run, { DISPLAY: ":0" });
  await assert.rejects(actions.editor(project), /directory is unavailable/);
  await assert.rejects(actions.terminal({ ...project, path: "relative" }), /absolute directory/);
  await assert.rejects(actions.repository(project), /no valid GitHub repository/);
  await assert.rejects(actions.repository({ ...project, repository: "owner/repo;touch bad" }), /no valid GitHub repository/);
  await assert.rejects(actions.pullRequest({ ...project, repository: "owner/repo" },
    { number: 2, title: "Bad", url: "https://evil.example/pull/2", draft: false, checks: null, review: null }), /invalid GitHub URL/);
  assert.equal(calls, 0);
});
