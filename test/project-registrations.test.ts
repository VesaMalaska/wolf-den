import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProjectRegistrations, uniqueProjectId } from "../src/project-registrations.js";
import { RegistryPersistence } from "../src/registry-persistence.js";
import { SettingsSession } from "../src/settings.js";
import { GithubRefresh, reconcileProjectStates, retainedProjectId } from "../src/projects.js";
import type { ProjectState } from "../src/domain.js";

const project = { id: "atlas", name: "Atlas", path: "~/projects/atlas", repository: "example/atlas", lifecycle: "custom state", nextAction: "Review" };
const unavailable = async () => ({ kind: "unavailable" as const, reason: "Directory unavailable." });

test("generated IDs handle collisions and Unicode fallback; edits keep identity and unmodified values", () => {
  const projects = new ProjectRegistrations([project, { ...project, id: "atlas-2" }]);
  assert.equal(uniqueProjectId("Atlas", projects.entries), "atlas-3");
  assert.equal(uniqueProjectId("界🐺", projects.entries), "project");
  projects.openForm();
  projects.form!.values.name = "Renamed";
  const edited = projects.apply();
  assert.deepEqual(edited, { ...project, name: "Renamed" });
  projects.openForm(true);
  projects.form!.values.name = "Atlas";
  projects.form!.values.path = "~/projects/another";
  assert.equal(projects.apply()?.id, "atlas-3");
});

test("field validation preserves bad input and Apply focuses the first invalid field", () => {
  const projects = new ProjectRegistrations([]);
  projects.openForm(true);
  assert.equal(projects.apply(), undefined);
  assert.equal(projects.form?.field, "name");
  projects.form!.values.name = "Project";
  projects.form!.values.path = "relative";
  projects.form!.values.repository = "https://github.com/example/atlas";
  projects.form!.values.lifecycle = " ";
  assert.equal(projects.apply(), undefined);
  assert.equal(projects.form?.field, "path");
  assert.match(projects.form!.errors.repository!, /owner\/name/);
  assert.match(projects.form!.errors.lifecycle!, /blank/);
  projects.startField("path"); projects.input("still relative");
  assert.equal(projects.acceptField(), false);
  assert.equal(projects.form?.values.path, "still relative");
  projects.cancelField();
  assert.equal(projects.form?.values.path, "relative");
  assert.equal(projects.entries.length, 0);
});

test("optional clearing, form cancellation and default-safe removal affect only draft entries", () => {
  const projects = new ProjectRegistrations([project]);
  projects.openForm(); projects.form!.values.repository = ""; projects.form!.values.nextAction = " ";
  assert.equal(projects.closeForm(), false);
  assert.equal(projects.discardingForm, true);
  assert.deepEqual(projects.entries, [project]);
  projects.discardingForm = false;
  const edited = projects.apply();
  assert.deepEqual(edited, { id: "atlas", name: "Atlas", path: project.path, lifecycle: project.lifecycle });
  projects.requestRemoval(); projects.confirmRemoval();
  assert.equal(projects.entries.length, 1, "Enter on default Cancel keeps the registration");
  projects.requestRemoval(); projects.removeFocused = true; projects.confirmRemoval();
  assert.deepEqual(projects.entries, []);
  assert.equal(projects.selectedId, undefined);
});

async function fixture(run: (session: SettingsSession, path: string, directory: string) => Promise<void>, failing = false) {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-projects-"));
  const path = join(directory, "projects.json");
  await writeFile(path, JSON.stringify({ version: 1, settings: { terminal: "kitty", themeOverrides: { accent: "#ABCDEF" } }, projects: [project] }));
  const persistence = new RegistryPersistence(path, failing ? { replace: async () => { throw new Error("write denied"); } } : {});
  try { await run(new SettingsSession(await persistence.load(), persistence), path, directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("Apply warns but does not write; shared Save preserves v1 settings and registration fields", async () => fixture(async (session, path) => {
  const before = await readFile(path, "utf8");
  session.projects.openForm(true);
  Object.assign(session.projects.form!.values, { name: "New", path: "~/missing/new" });
  assert.equal(await session.applyProject(unavailable), true);
  assert.match(session.message, /Directory unavailable.*Save/);
  assert.equal(await readFile(path, "utf8"), before);
  session.cycleTerminal();
  assert.equal(await session.save(), true);
  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(saved.projects[0], project);
  assert.deepEqual(saved.projects[1], { id: "new", name: "New", path: "~/missing/new", lifecycle: "active" });
  assert.deepEqual(saved.settings, { terminal: "konsole", themeOverrides: { accent: "#ABCDEF" } });
  assert.equal(session.dirty, false);
}));

test("confirmed last removal only saves registry; project files and Git metadata survive", async () => fixture(async (session, path, directory) => {
  const target = join(directory, "registered-project");
  await mkdir(join(target, ".git"), { recursive: true });
  await writeFile(join(target, "file.txt"), "keep files");
  await writeFile(join(target, ".git", "config"), "keep git");
  session.projects.openForm(); session.projects.form!.values.path = target;
  await session.applyProject(unavailable); await session.save();
  session.projects.requestRemoval(); session.projects.removeFocused = true; session.projects.confirmRemoval();
  assert.equal(await session.save(), true);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")).projects, []);
  assert.equal(await readFile(join(target, "file.txt"), "utf8"), "keep files");
  assert.equal(await readFile(join(target, ".git", "config"), "utf8"), "keep git");
  assert.deepEqual((await new RegistryPersistence(path).load()).document.projects, []);
}));

test("failed write retains draft and previous registry; Settings discard does not save", async () => fixture(async (session, path) => {
  const before = await readFile(path, "utf8");
  session.projects.openForm(); session.projects.form!.values.name = "Draft"; await session.applyProject(unavailable);
  assert.equal(await session.save(), false);
  assert.equal(session.projects.selected?.name, "Draft");
  assert.equal(await readFile(path, "utf8"), before);
  assert.equal(session.requestExit(), false);
  session.cancelConfirmation(); assert.equal(session.dirty, true);
  session.requestExit(); assert.equal(await session.confirm(), "exit");
  assert.equal(await readFile(path, "utf8"), before);
}, true));

test("conflicts preserve draft; canceled/failed Reload preserves it; successful Reload reads current document", async () => fixture(async (session, path) => {
  session.projects.openForm(); session.projects.form!.values.name = "Draft"; await session.applyProject(unavailable);
  const external = { version: 1, settings: { terminal: "xterm" }, projects: [] };
  await writeFile(path, JSON.stringify(external));
  assert.equal(await session.save(), false); assert.match(session.message, /Conflict/);
  assert.equal(session.projects.selected?.name, "Draft");
  session.requestReload(); session.cancelConfirmation(); assert.equal(session.dirty, true);
  await writeFile(path, "malformed"); session.requestReload(); await session.confirm();
  assert.equal(session.projects.selected?.name, "Draft");
  await writeFile(path, JSON.stringify(external)); session.requestReload(); await session.confirm();
  assert.equal(session.terminal, "xterm"); assert.deepEqual(session.projects.entries, []); assert.equal(session.dirty, false);
}));

test("ID selection survives insertions/reordering; removed selection chooses next then previous", () => {
  assert.equal(retainedProjectId(["a", "b", "c"], ["c", "b", "a", "d"], "b"), "b");
  assert.equal(retainedProjectId(["a", "b", "c"], ["a", "c"], "b"), "c");
  assert.equal(retainedProjectId(["a", "b", "c"], ["a"], "c"), "a");
  assert.equal(retainedProjectId(["a"], [], "a"), undefined);
});

test("reconciliation keeps unrelated provider state but detaches obsolete source objects", () => {
  const state: ProjectState = { project, git: { kind: "unavailable", reason: "Local unavailable" }, github: { kind: "available", issues: 1, pullRequests: [] } };
  const renamed = reconcileProjectStates([state], [{ ...project, name: "Renamed" }]);
  assert.equal(renamed[0], state);
  const moved = reconcileProjectStates(renamed, [{ ...project, path: "/new" }]);
  assert.notEqual(moved[0], state);
  state.github = { kind: "unavailable", reason: "Late obsolete callback" };
  assert.equal(moved[0]?.github.kind, "loading");
  assert.deepEqual(reconcileProjectStates(moved, []), []);
});

test("an old GitHub request does not block refresh of a changed repository under the same ID", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const refresh = new GithubRefresh(async repository => {
    if (repository === "example/atlas") await pending;
    return { kind: "available", issues: repository === "example/new" ? 2 : 1, pullRequests: [] };
  });
  const old: ProjectState = { project, git: { kind: "loading" }, github: { kind: "loading" } };
  const changed: ProjectState = { ...old, project: { ...project, repository: "example/new" } };
  const oldRequest = refresh.refresh(old, () => {});
  await refresh.refresh(changed, state => { changed.github = state; });
  assert.equal(changed.github.kind === "available" && changed.github.issues, 2);
  release(); await oldRequest;
});
