import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { createTestRenderer } from "@opentui/core/testing";
import { measureEditText } from "@opentui/core";
import { runDashboard } from "../src/ui.js";
import { settingsFeedbackLines } from "../src/settings-view.js";
import { themePresets } from "../src/theme.js";

async function cockpit(width = 42, height = 18, projectNames: string[] = []) {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-settings-ui-"));
  const path = join(directory, "projects.json");
  const projects = projectNames.map((name, index) => ({ id: `sample-${index}`, name, path: join(directory, `missing-${index}`), lifecycle: "active" }));
  await writeFile(path, JSON.stringify({ version: 1, settings: { terminal: "kitty" }, projects }));
  const setup = await createTestRenderer({ width, height, screenMode: "alternate-screen" });
  await runDashboard(path, async () => setup.renderer);
  const frame = async () => { await setup.renderOnce(); return setup.captureCharFrame(); };
  const waitFor = async (text: string) => {
    for (let i = 0; i < 100; i++) {
      const result = await frame();
      if (result.includes(text)) return result;
      await setTimeout(5);
    }
    assert.fail(`Expected ${text}\n${await frame()}`);
  };
  setup.mockInput.pressKey("s");
  await waitFor("COCKPIT PREVIEW");
  return { ...setup, path, frame, waitFor, enter: async () => { setup.mockInput.pressEnter(); await setTimeout(10); }, escape: async () => { setup.mockInput.pressEscape(); await setTimeout(125); }, close: async () => { await setup.dispose(); await rm(directory, { recursive: true }); } };
}

test("Appearance and General render as separate focused views at all five target sizes", async () => {
  for (const [width, height] of [[120, 32], [100, 25], [80, 24], [56, 22], [42, 18]]) {
    const app = await cockpit(width!, height!);
    try {
      const appearance = await app.frame();
      for (const text of ["Wolfy Dark / Deep Forest", "SAMPLE", "Next action", "Review the next task", "Clean", "1 open PR", "Customize colors", "Save", "Cancel", "Reset", "Esc Back"]) assert.ok(appearance.includes(text), text);
      assert.doesNotMatch(appearance, /Terminal preference|selectionBackground|textPrimary/);
      app.mockInput.pressArrow("right");
      const general = await app.frame();
      assert.match(general, /\[General\]/);
      assert.match(general, /> kitty/);
      assert.doesNotMatch(general, /COCKPIT PREVIEW|Reset/);
      await app.enter();
      assert.match(await app.frame(), /Unsaved/);
      app.mockInput.pressTab();
      assert.match(await app.frame(), /> Save/);
      app.mockInput.pressTab({ shift: true });
      assert.match(await app.frame(), /> konsole/);
    } finally { await app.close(); }
  }
});

test("42×18 Colors keeps every focused token visible through scrolling, edits, and resizing", async () => {
  const app = await cockpit();
  try {
    const before = await readFile(app.path, "utf8");
    app.mockInput.pressArrow("down"); await app.enter();
    assert.match(await app.frame(), /SURFACES/);
    const labels = ["Background", "Panel", "Secondary panel", "Selection background", "Selected text", "Focus outline", "Primary text", "Secondary text", "Muted text", "Accent", "Subtle accent", "Heading", "Divider", "Success", "Attention", "Error", "Unavailable", "Information"];
    for (const label of labels) {
      const rendered = await app.frame();
      assert.ok(rendered.split("\n").some(line => line.includes("> [") && line.includes(label)), `${label}\n${rendered}`);
      assert.match(rendered, /Save.*Cancel.*Reset.*Reload/);
      app.mockInput.pressArrow("down");
    }
    app.mockInput.pressArrow("up");
    app.resize(120, 32);
    assert.match(await app.frame(), /> \[ \] Information/);
    app.resize(42, 18);
    assert.match(await app.frame(), /> \[ \] Information/);
    await app.enter();
    await app.mockInput.typeText("123456");
    assert.match(await app.frame(), /#123456_/);
    const spans = app.captureSpans().lines.flatMap(line => line.spans);
    assert.ok(spans.some(span => span.text.includes(" ") && span.bg.toInts().slice(0, 3).join() === "18,52,86"), "swatch previews the actual entered color");
    assert.equal(await readFile(app.path, "utf8"), before);
    await app.escape();
    assert.match(await app.frame(), new RegExp(themePresets["wolfy-dark"].info));
    await app.escape();
    assert.match(await app.frame(), /COCKPIT PREVIEW/);
    assert.match(await app.frame(), /> Customize colors/);
  } finally { await app.close(); }
});

test("compact keyboard flow preserves valid previews, save, reset, cancellation, conflict and reload", async () => {
  const app = await cockpit();
  try {
    const original = await readFile(app.path, "utf8");
    app.mockInput.pressArrow("down"); await app.enter(); await app.enter();
    await app.mockInput.typeText("123456");
    app.mockInput.pressBackspace(); await app.enter();
    assert.match(await app.frame(), /six hex digits/);
    assert.equal(await readFile(app.path, "utf8"), original);
    await app.mockInput.typeText("6"); await app.enter();
    app.mockInput.pressTab(); await app.enter();
    await app.waitFor("Settings saved.");
    assert.equal(JSON.parse(await readFile(app.path, "utf8")).settings.themeOverrides.background, "#123456");
    app.mockInput.pressTab(); app.mockInput.pressTab(); await app.enter();
    assert.match(await app.frame(), /Reset all appearance colors/);
    await app.escape();
    assert.match(await app.frame(), /#123456/);
    await app.enter(); await app.enter();
    assert.match(await app.frame(), /#090D14/);
    assert.match(await app.frame(), /Unsaved/);
    app.mockInput.pressTab(); app.mockInput.pressTab();
    assert.match(await app.frame(), /> \[ \] Background/);
    await app.enter(); await app.mockInput.typeText("ABCDEF"); await app.enter();
    await writeFile(app.path, JSON.stringify({ version: 1, settings: { terminal: "xterm" }, projects: [] }));
    app.mockInput.pressTab(); await app.enter();
    await app.waitFor("Conflict");
    assert.match(await app.frame(), /#ABCDEF/);
    assert.equal(JSON.parse(await readFile(app.path, "utf8")).settings.terminal, "xterm");
    app.mockInput.pressTab(); app.mockInput.pressTab(); app.mockInput.pressTab(); await app.enter();
    assert.match(await app.frame(), /Discard draft and reload/);
    await app.enter(); await app.waitFor("Registry reloaded.");
    await app.escape(); app.mockInput.pressArrow("right");
    assert.match(await app.frame(), /> xterm/);
    await app.enter();
    await app.escape();
    assert.match(await app.frame(), /Discard unsaved changes/);
    await app.escape(); assert.match(await app.frame(), /\[General\]/);
    await app.escape(); await app.enter();
    assert.doesNotMatch(await app.frame(), /WOLF DEN \/ SETTINGS/);
    assert.equal(JSON.parse(await readFile(app.path, "utf8")).settings.terminal, "xterm");
  } finally { await app.close(); }
});

test("compact Help scrolls and below-minimum layouts keep a back path", async () => {
  const app = await cockpit();
  try {
    app.mockInput.pressKey("?"); assert.match(await app.frame(), /SETTINGS HELP/);
    // Use the actual terminal sequence, as a terminal sends it.
    await app.mockInput.pressKeys(["\x1b[6~"]);
    assert.match(await app.frame(), /Ctrl\+C quits/);
    await app.escape();
    app.resize(30, 12); assert.match(await app.frame(), /Resize to at least/);
    app.resize(42, 18); assert.match(await app.frame(), /COCKPIT PREVIEW/);
    await app.escape(); assert.doesNotMatch(await app.frame(), /COCKPIT PREVIEW/);
  } finally { await app.close(); }
});

test("feedback wraps words and wide graphemes within the cell budget", () => {
  const message = "Conflict: Reload registry, review the latest settings, then reapply. 界界界界界界界界界界界界界界界界界界界界界界";
  const lines = settingsFeedbackLines(message, 40, "unicode");
  assert.ok(lines.every(line => measureEditText(line, { widthMethod: "unicode" }) <= 40));
  assert.ok(lines.some(line => line.includes("settings,")));
  assert.equal(lines.join("").replaceAll(" ", ""), message.replaceAll(" ", ""));
});

test("returning from Settings preserves the selected project and dashboard frame", async () => {
  const app = await cockpit(80, 24, ["First sample", "Second sample"]);
  try {
    await app.escape();
    app.mockInput.pressArrow("down");
    const before = await app.frame();
    assert.match(before, /Second sample/);
    app.mockInput.pressKey("s"); await app.waitFor("COCKPIT PREVIEW");
    app.mockInput.pressTab(); app.mockInput.pressTab(); await app.enter();
    assert.equal(await app.frame(), before);
  } finally { await app.close(); }
});
