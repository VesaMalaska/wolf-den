import assert from "node:assert/strict";
import { test } from "node:test";
import { expandProjectPath, loadRegistry, parseRegistry, RegistryError } from "../src/registry.js";

const valid = (path = "~/work/demo") => JSON.stringify({version: 1, projects: [{id: "demo", name: "Demo", path, lifecycle: "active", nextAction: "Review code"}]});

test("validates registry and expands home paths", () => {
  assert.deepEqual(parseRegistry(valid(), "/home/tester"), [{id: "demo", name: "Demo", path: "/home/tester/work/demo", lifecycle: "active", nextAction: "Review code"}]);
  assert.equal(expandProjectPath("~", "/home/tester"), "/home/tester");
});

test("rejects malformed JSON, unsupported versions, relative paths and duplicate IDs", () => {
  assert.throws(() => parseRegistry("{"), /Malformed JSON/);
  assert.throws(() => parseRegistry('{"version":2,"projects":[]}'), /version/);
  assert.throws(() => parseRegistry(valid("relative")), /projects.0.path/);
  const one = JSON.parse(valid());
  one.projects.push(one.projects[0]);
  assert.throws(() => parseRegistry(JSON.stringify(one)), /duplicate ID/);
  assert.throws(() => parseRegistry('{"version":1,"projects":[{"id":"x","name":"X","path":"/tmp/x","lifecycle":"active","unknown":true}]}'), RegistryError);
});

test("missing registry has a setup instruction", async () => {
  await assert.rejects(loadRegistry("/missing-wolf-den-registry/projects.json"), /Create ~\/\.config\/wolf-den\/projects.json/);
});
