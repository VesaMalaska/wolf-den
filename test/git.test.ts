import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { inspectGit, parsePorcelain } from "../src/git.js";

const exec = promisify(execFile);

test("parses staged, unstaged, untracked and rename records", () => {
  assert.deepEqual(parsePorcelain(""), { staged: false, unstaged: false, untracked: false, clean: true });
  assert.deepEqual(parsePorcelain("M  staged\0 M unstaged\0?? new\0"), { staged: true, unstaged: true, untracked: true, clean: false });
  assert.deepEqual(parsePorcelain("R  new\0old\0"), { staged: true, unstaged: false, untracked: false, clean: false });
});

test("reports missing and non-Git directories without crashing", async () => {
  const root = await mkdtemp(join(tmpdir(), "wolf-den-test-"));
  try {
    assert.match((await inspectGit(join(root, "missing"))).kind, /unavailable/);
    assert.match((await inspectGit(root)).kind, /unavailable/);
    await mkdir(join(root, "nested"));
    assert.match((await inspectGit(join(root, "nested"))).kind, /unavailable/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test("matches Git for branch, clean, dirty and detached HEAD", async () => {
  const root = await mkdtemp(join(tmpdir(), "wolf-den-test-"));
  const git = async (...args: string[]) => (await exec("git", args, {cwd: root})).stdout.trim();
  try {
    await git("init", "-q", "-b", "main");
    await git("config", "user.email", "fixture@example.invalid");
    await git("config", "user.name", "Fixture");
    await writeFile(join(root, "tracked.txt"), "one\n");
    await git("add", "tracked.txt");
    await git("commit", "-qm", "fixture");
    assert.deepEqual(await inspectGit(root), {kind: "available", branch: "main", detached: false, staged: false, unstaged: false, untracked: false, clean: true});
    await writeFile(join(root, "tracked.txt"), "two\n");
    await writeFile(join(root, "new.txt"), "new\n");
    const dirty = await inspectGit(root);
    assert.equal(dirty.kind, "available");
    if (dirty.kind === "available") { assert.equal(dirty.unstaged, true); assert.equal(dirty.untracked, true); assert.equal(dirty.clean, false); }
    await git("add", "tracked.txt");
    const staged = await inspectGit(root);
    assert.equal(staged.kind === "available" && staged.staged, true);
    await git("checkout", "--detach", "-q");
    const detached = await inspectGit(root);
    assert.equal(detached.kind === "available" && detached.detached, true);
  } finally { await rm(root, {recursive: true, force: true}); }
});
