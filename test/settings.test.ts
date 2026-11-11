import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RegistryPersistence } from "../src/registry-persistence.js";
import { SettingsSession, settingsControls } from "../src/settings.js";
import { defaultThemeId, themePresets, themeTokens } from "../src/theme.js";
import { settingsLayout, settingsRows, scrollToLine } from "../src/ui.js";

async function fixture(settings: object = {}) {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-settings-"));
  const path = join(directory, "projects.json");
  const document = { version: 1, settings, projects: [{ id: "sample", name: "Sample", path: "~/projects/sample", lifecycle: "active" }] };
  await writeFile(path, `${JSON.stringify(document)}\n`);
  const persistence = new RegistryPersistence(path);
  const session = new SettingsSession(await persistence.load(), persistence);
  return { directory, path, persistence, session, document };
}

async function editColor(session: SettingsSession, tokenIndex: number, color: string) {
  session.focus = tokenIndex;
  session.startEdit();
  for (const character of color) session.input(character);
  session.acceptEdit();
}

test("Settings controls cover the typed preset, all 18 colors, terminal, and actions", async () => {
  const f = await fixture();
  try {
    assert.equal(settingsControls[0], "preset");
    assert.deepEqual(settingsControls.slice(1, 19), themeTokens);
    assert.equal(settingsControls[19], "terminal");
    f.session.cyclePreset();
    assert.equal(f.session.themeId, defaultThemeId);
    assert.match(f.session.message, /only installed preset/);
    assert.equal(f.session.dirty, false);
    f.session.focus = 18;
    f.session.move("right");
    assert.equal(f.session.control, "terminal");
    f.session.move("left");
    assert.equal(f.session.control, "preset");
  } finally { await rm(f.directory, { recursive: true }); }
});

test("valid color previews without a write; canceling an edit restores the previous color", async () => {
  const f = await fixture({ themeOverrides: { accent: "#ABCDEF" } });
  try {
    const before = await readFile(f.path, "utf8");
    f.session.focus = 10;
    f.session.startEdit();
    for (const character of "#123456") f.session.input(character);
    assert.equal(f.session.theme.accent, "#123456");
    assert.equal(await readFile(f.path, "utf8"), before);
    f.session.input("backspace");
    assert.equal(f.session.theme.accent, "#123456");
    f.session.acceptEdit();
    assert.equal(f.session.error, true);
    f.session.cancelEdit();
    assert.equal(f.session.theme.accent, "#ABCDEF");
    assert.equal(f.session.dirty, false);
  } finally { await rm(f.directory, { recursive: true }); }
});

test("typed dashboard shortcuts remain inside the color editor and report invalid input", async () => {
  const f = await fixture();
  try {
    f.session.focus = 10;
    f.session.startEdit();
    for (const key of ["s", "q", "n", "r", "e", "t"]) f.session.input(key);
    assert.equal(f.session.editing?.value, "#e");
    assert.equal(f.session.error, true);
    assert.match(f.session.message, /hexadecimal/);
    assert.equal(f.session.dirty, false);
  } finally { await rm(f.directory, { recursive: true }); }
});

test("save validates and persists only chosen settings while preserving projects and explicit terminal", async () => {
  const f = await fixture({ terminal: "kitty" });
  try {
    await editColor(f.session, 10, "#123456");
    assert.equal(f.session.dirty, true);
    assert.equal(await f.session.save(), true);
    const saved = JSON.parse(await readFile(f.path, "utf8"));
    assert.deepEqual(saved.projects, f.document.projects);
    assert.deepEqual(saved.settings, { terminal: "kitty", themeOverrides: { accent: "#123456" } });
    assert.equal(f.session.dirty, false);
  } finally { await rm(f.directory, { recursive: true }); }
});

test("reset requires confirmation, previews the preset, and cancel discards without writing", async () => {
  const f = await fixture({ theme: "wolfy-dark", themeOverrides: { accent: "#ABCDEF" } });
  try {
    const before = await readFile(f.path, "utf8");
    f.session.requestReset();
    f.session.cancelConfirmation();
    assert.equal(f.session.theme.accent, "#ABCDEF");
    f.session.requestReset();
    assert.equal(await f.session.confirm(), "stay");
    assert.equal(f.session.theme.accent, themePresets["wolfy-dark"].accent);
    assert.equal(f.session.dirty, true);
    assert.equal(f.session.requestExit(), false);
    f.session.cancelConfirmation();
    assert.equal(f.session.dirty, true);
    assert.equal(f.session.requestExit(), false);
    assert.equal(await f.session.confirm(), "exit");
    assert.equal(await readFile(f.path, "utf8"), before);
  } finally { await rm(f.directory, { recursive: true }); }
});

test("confirmed reset writes only the selected preset after Save", async () => {
  const f = await fixture({ theme: "wolfy-dark", themeOverrides: { accent: "#ABCDEF" }, terminal: "xterm" });
  try {
    f.session.requestReset();
    await f.session.confirm();
    assert.equal(await f.session.save(), true);
    const saved = JSON.parse(await readFile(f.path, "utf8"));
    assert.deepEqual(saved.settings, { theme: "wolfy-dark", terminal: "xterm" });
  } finally { await rm(f.directory, { recursive: true }); }
});

test("terminal choices cycle through supported values and save without injecting theme fields", async () => {
  const f = await fixture();
  try {
    f.session.cycleTerminal();
    assert.equal(f.session.terminal, "kitty");
    assert.equal(await f.session.save(), true);
    const saved = JSON.parse(await readFile(f.path, "utf8"));
    assert.deepEqual(saved.settings, { terminal: "kitty" });
  } finally { await rm(f.directory, { recursive: true }); }
});

test("save preserves an explicitly configured empty override map", async () => {
  const f = await fixture({ themeOverrides: {} });
  try {
    f.session.cycleTerminal();
    assert.equal(await f.session.save(), true);
    const saved = JSON.parse(await readFile(f.path, "utf8"));
    assert.deepEqual(saved.settings, { themeOverrides: {}, terminal: "kitty" });
  } finally { await rm(f.directory, { recursive: true }); }
});

test("external edit conflict preserves the draft and reload requires confirmation", async () => {
  const f = await fixture();
  try {
    await editColor(f.session, 10, "#123456");
    await writeFile(f.path, `${JSON.stringify({ ...f.document, settings: { terminal: "xterm" } })}\n`);
    assert.equal(await f.session.save(), false);
    assert.match(f.session.message, /Reload/);
    assert.equal(f.session.theme.accent, "#123456");
    f.session.requestReload();
    f.session.cancelConfirmation();
    assert.equal(f.session.theme.accent, "#123456");
    f.session.requestReload();
    await f.session.confirm();
    assert.equal(f.session.terminal, "xterm");
    assert.equal(f.session.dirty, false);
  } finally { await rm(f.directory, { recursive: true }); }
});

test("failed write keeps the draft and original registry for retry", async () => {
  const f = await fixture();
  try {
    const before = await readFile(f.path, "utf8");
    const failing = new RegistryPersistence(f.path, { writeTemporary: async () => { throw new Error("fixture write failure"); } });
    const session = new SettingsSession(await failing.load(), failing);
    await editColor(session, 10, "#123456");
    assert.equal(await session.save(), false);
    assert.equal(session.dirty, true);
    assert.equal(await readFile(f.path, "utf8"), before);
    assert.match(session.message, /Could not save registry/);
  } finally { await rm(f.directory, { recursive: true }); }
});

test("compact and wide Settings layouts keep a focusable scrolling list", async () => {
  const f = await fixture();
  try {
    for (const [width, height] of [[120, 32], [100, 25], [80, 24], [56, 22], [42, 18]]) {
      const layout = settingsLayout(width!, height!);
      assert.equal(layout.contentHeight + 3, height);
      assert.ok(layout.detailHeight >= 10);
      assert.ok(layout.detailWidth >= 42 || layout.wide);
      const visible = layout.detailHeight - 2;
      const offset = scrollToLine(0, 23, visible);
      assert.ok(23 >= offset && 23 < offset + visible);
      assert.equal(settingsRows(f.session).length, settingsControls.length);
    }
  } finally { await rm(f.directory, { recursive: true }); }
});
