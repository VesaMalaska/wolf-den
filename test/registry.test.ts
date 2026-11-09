import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { expandProjectPath, loadConfiguration, loadRegistry, parseConfiguration, parseRegistry, RegistryError } from "../src/registry.js";

const valid = (path = "~/work/demo") => JSON.stringify({version: 1, projects: [{id: "demo", name: "Demo", path, lifecycle: "active", nextAction: "Review code"}]});

test("validates registry and expands home paths", () => {
  assert.deepEqual(parseRegistry(valid(), "/home/tester"), [{id: "demo", name: "Demo", path: "/home/tester/work/demo", lifecycle: "active", nextAction: "Review code"}]);
  assert.equal(expandProjectPath("~", "/home/tester"), "/home/tester");
});

test("registry terminal settings default to system and accept supported overrides", () => {
  assert.deepEqual(parseConfiguration(valid(), "/home/tester").settings, { terminal: "system", theme: "wolfy-dark", themeOverrides: {} });
  const configured = JSON.parse(valid());
  configured.settings = { terminal: "kitty" };
  assert.deepEqual(parseConfiguration(JSON.stringify(configured), "/home/tester").settings, { terminal: "kitty", theme: "wolfy-dark", themeOverrides: {} });
  configured.settings = {};
  assert.deepEqual(parseConfiguration(JSON.stringify(configured), "/home/tester").settings, { terminal: "system", theme: "wolfy-dark", themeOverrides: {} });
});

test("version-1 theme selection and overrides preserve terminal preference and projects", () => {
  const configured = JSON.parse(valid());
  configured.settings = { terminal: "kitty", theme: "wolfy-dark", themeOverrides: { accent: "#abcdef", selectionBackground: "#304050" } };
  const result = parseConfiguration(JSON.stringify(configured), "/home/tester");
  assert.deepEqual(result.settings, configured.settings);
  assert.equal(result.projects[0]?.path, "/home/tester/work/demo");
});

test("invalid theme names, override keys and colors identify their settings fields", () => {
  const configured = JSON.parse(valid());
  configured.settings = { theme: "unknown" };
  assert.throws(() => parseConfiguration(JSON.stringify(configured)), /settings.theme: Choose a supported theme: wolfy-dark/);
  configured.settings = { themeOverrides: { surprise: "#ABCDEF" } };
  assert.throws(() => parseConfiguration(JSON.stringify(configured)), /settings.themeOverrides/);
  configured.settings = { themeOverrides: { accent: "red" } };
  assert.throws(() => parseConfiguration(JSON.stringify(configured)), /settings.themeOverrides.accent: Use a hexadecimal RGB color in #RRGGBB format/);
  configured.settings = { themeOverrides: { accent: "#1234" } };
  assert.throws(() => parseConfiguration(JSON.stringify(configured)), /settings.themeOverrides.accent/);
});

test("unsupported terminal settings are rejected with an actionable field path", () => {
  const configured = JSON.parse(valid());
  configured.settings = { terminal: "custom-terminal" };
  assert.throws(() => parseConfiguration(JSON.stringify(configured)), /settings.terminal/);
  configured.settings = { terminal: "kitty", command: "sh" };
  assert.throws(() => parseConfiguration(JSON.stringify(configured)), /settings: Unrecognized key: "command"/);
});

test("loaded configuration carries terminal settings to the dashboard", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-registry-"));
  try {
    const path = join(directory, "projects.json");
    const configured = JSON.parse(valid());
    configured.settings = { terminal: "konsole" };
    await writeFile(path, JSON.stringify(configured));
    const result = await loadConfiguration(path);
    assert.equal(result.settings.terminal, "konsole");
    assert.equal(result.projects[0]?.id, "demo");
  } finally { await rm(directory, { recursive: true }); }
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
