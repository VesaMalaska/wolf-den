import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RegistryPersistence, RegistryPersistenceError } from "../src/registry-persistence.js";
import { parseConfiguration } from "../src/registry.js";

const document = () => ({
  version: 1,
  settings: { terminal: "kitty", themeOverrides: { accent: "#AABBCC" } },
  projects: [
    { id: "first", name: "First", path: "~/work/first", repository: "owner/first", lifecycle: "active", nextAction: "Review" },
    { id: "second", name: "Second", path: "/tmp/second", lifecycle: "paused" },
  ],
});

async function fixture(run: (path: string, directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-persistence-"));
  try { await run(join(directory, "projects.json"), directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

function errorCode(code: RegistryPersistenceError["code"]): (error: unknown) => boolean {
  return error => error instanceof RegistryPersistenceError && error.code === code;
}

test("explicit initialization and subsequent save preserve persisted fields and runtime loading", async () => fixture(async (path) => {
  const service = new RegistryPersistence(path);
  await assert.rejects(service.load(), errorCode("missing"));
  const initial = await service.initialize(document());
  assert.deepEqual(initial.document, document());
  assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.equal((await readFile(path, "utf8")).includes('"theme":'), false);
  assert.deepEqual((await service.load()).document, document());
  const edited = structuredClone(initial.document);
  edited.projects[0]!.nextAction = "Ship";
  const saved = await service.save(edited, initial.revision);
  assert.notEqual(saved.revision, initial.revision);
  assert.equal((await lstat(path)).mode & 0o777, 0o600);
  assert.deepEqual((await service.load()).document, edited);
  assert.equal(saved.document.projects[0]?.path, "~/work/first");
  assert.equal(parseConfiguration(await readFile(path, "utf8"), "/home/tester").projects[0]?.path, "/home/tester/work/first");
}));

test("persisted path spelling survives save while runtime paths remain normalized", async () => fixture(async (path) => {
  const configured = document();
  configured.projects[0]!.id = " first ";
  configured.projects[0]!.name = " First ";
  configured.projects[0]!.path = "  ~/work/first  ";
  configured.projects[0]!.nextAction = " Review ";
  const service = new RegistryPersistence(path);
  const snapshot = await service.initialize(configured);
  assert.equal(snapshot.document.projects[0]?.name, " First ");
  assert.equal(snapshot.document.projects[0]?.path, "  ~/work/first  ");
  assert.equal(snapshot.document.projects[0]?.nextAction, " Review ");
  assert.equal((await service.load()).document.projects[0]?.path, "  ~/work/first  ");
  const runtime = parseConfiguration(await readFile(path, "utf8"), "/home/tester").projects[0];
  assert.equal(runtime?.id, "first");
  assert.equal(runtime?.name, "First");
  assert.equal(runtime?.path, "/home/tester/work/first");
  assert.equal(runtime?.nextAction, "Review");
}));

test("invalid documents never replace an existing registry", async () => fixture(async (path) => {
  const service = new RegistryPersistence(path);
  const initial = await service.initialize(document());
  const original = await readFile(path, "utf8");
  const invalid: Array<[unknown, RegExp]> = [
    [{ ...document(), extra: true }, /registry: Unrecognized key/],
    [{ ...document(), version: 2 }, /version/],
    [{ ...document(), settings: { terminal: "shell" } }, /settings.terminal/],
    [{ ...document(), settings: { theme: "unknown" } }, /settings.theme/],
    [{ ...document(), settings: { themeOverrides: { accent: "red" } } }, /settings.themeOverrides.accent/],
    [{ ...document(), projects: [{ ...document().projects[0], id: "bad id" }] }, /projects.0.id/],
    [{ ...document(), projects: [document().projects[0], document().projects[0]] }, /projects.1.id: duplicate/],
    [{ ...document(), projects: [{ ...document().projects[0], path: "relative" }] }, /projects.0.path/],
    [{ ...document(), projects: [{ ...document().projects[0], extra: true }] }, /projects.0: Unrecognized key/],
  ];
  for (const [bad, field] of invalid) {
    await assert.rejects(service.save(bad, initial.revision), error => errorCode("validation")(error) && field.test((error as Error).message));
    assert.equal(await readFile(path, "utf8"), original);
  }
}));

test("external content edit, replacement, deletion and stale in-app revisions conflict", async () => fixture(async (path, directory) => {
  const service = new RegistryPersistence(path);
  let snapshot = await service.initialize(document());
  await writeFile(path, `${await readFile(path, "utf8")} `);
  await assert.rejects(service.save(document(), snapshot.revision), errorCode("conflict"));
  snapshot = await service.load();
  const replacement = join(directory, "replacement");
  await writeFile(replacement, await readFile(path, "utf8"));
  await rename(replacement, path);
  await assert.rejects(service.save(document(), snapshot.revision), errorCode("conflict"));
  snapshot = await service.load();
  await rm(path);
  await assert.rejects(service.save(document(), snapshot.revision), errorCode("conflict"));
  snapshot = await service.initialize(document());
  const edit = structuredClone(snapshot.document);
  edit.projects[0]!.nextAction = "First edit";
  await service.save(edit, snapshot.revision);
  await assert.rejects(service.save(document(), snapshot.revision), errorCode("conflict"));
}));

test("concurrent callers are serialized and only one stale revision succeeds", async () => fixture(async (path) => {
  const service = new RegistryPersistence(path);
  const snapshot = await service.initialize(document());
  const outcomes = await Promise.allSettled([
    service.save(document(), snapshot.revision),
    service.save(document(), snapshot.revision),
  ]);
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(result => result.status === "rejected" && errorCode("conflict")(result.reason)).length, 1);
}));

test("failed stage and rename leave prior bytes intact and remove temporary files", async () => fixture(async (path, directory) => {
  const baseline = new RegistryPersistence(path);
  const snapshot = await baseline.initialize(document());
  const original = await readFile(path, "utf8");
  for (const hooks of [
    { writeTemporary: async (handle: import("node:fs/promises").FileHandle) => {
      await handle.writeFile("partial", "utf8");
      throw Object.assign(new Error("injected write failure"), { code: "EACCES" });
    } },
    { replace: async () => { throw Object.assign(new Error("injected rename failure"), { code: "EACCES" }); } },
  ]) {
    await assert.rejects(new RegistryPersistence(path, hooks).save(document(), snapshot.revision), errorCode("write"));
    assert.equal(await readFile(path, "utf8"), original);
    assert.deepEqual(await readdir(directory), ["projects.json"]);
  }
}));

test("an edit during staging conflicts and leaves the external content intact", async () => fixture(async (path, directory) => {
  const service = new RegistryPersistence(path);
  const snapshot = await service.initialize(document());
  const external = `${await readFile(path, "utf8")} `;
  await assert.rejects(new RegistryPersistence(path, {
    beforeReplace: async () => { await writeFile(path, external); },
  }).save(document(), snapshot.revision), errorCode("conflict"));
  assert.equal(await readFile(path, "utf8"), external);
  assert.deepEqual(await readdir(directory), ["projects.json"]);
}));

test("initialization does not overwrite a registry created during staging", async () => fixture(async (path, directory) => {
  const external = "external";
  await assert.rejects(new RegistryPersistence(path, {
    beforeReplace: async () => { await writeFile(path, external); },
  }).initialize(document()), errorCode("conflict"));
  assert.equal(await readFile(path, "utf8"), external);
  assert.deepEqual(await readdir(directory), ["projects.json"]);
}));

test("missing directory, unsafe targets and explicit initialization race fail safely", async () => fixture(async (path, directory) => {
  await assert.rejects(new RegistryPersistence(join(directory, "absent", "projects.json")).initialize(document()), errorCode("missing"));
  const service = new RegistryPersistence(path);
  await writeFile(path, "{}");
  await assert.rejects(service.initialize(document()), errorCode("conflict"));
  await assert.rejects(service.load(), errorCode("validation"));
  await writeFile(path, "{");
  await assert.rejects(service.load(), error => errorCode("validation")(error) && /Malformed JSON/.test((error as Error).message));
  await rm(path);
  const outside = join(directory, "outside.json");
  await writeFile(outside, "keep");
  await symlink(outside, path);
  await assert.rejects(service.initialize(document()), errorCode("invalid-target"));
  assert.equal(await readFile(outside, "utf8"), "keep");
  await rm(path);
  const linkedDir = join(directory, "linked");
  await symlink(directory, linkedDir);
  await assert.rejects(new RegistryPersistence(join(linkedDir, "projects.json")).initialize(document()), errorCode("invalid-target"));
}));

test("unexpected file types are rejected without using chmod assumptions", async () => fixture(async (path, directory) => {
  const service = new RegistryPersistence(path);
  const snapshot = await service.initialize(document());
  const original = await readFile(path, "utf8");
  await mkdir(join(directory, "projects.json.tmp"));
  // A directory in place of a registry is rejected before any attempt to write.
  await rm(path);
  await rename(join(directory, "projects.json.tmp"), path);
  await assert.rejects(service.save(document(), snapshot.revision), errorCode("invalid-target"));
  await rm(path, { recursive: true });
  await writeFile(path, original);
  assert.deepEqual((await service.load()).document, document());
}));
