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

async function cockpit(width = 42, height = 18, projectNames: string[] = [], providers: Parameters<typeof runDashboard>[2] = {}) {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-settings-ui-"));
  const path = join(directory, "projects.json");
  const projects = projectNames.map((name, index) => ({ id: `sample-${index}`, name, path: join(directory, `missing-${index}`), lifecycle: "active", ...(providers.github ? { repository: "example/atlas" } : {}) }));
  await writeFile(path, JSON.stringify({ version: 1, settings: { terminal: "kitty" }, projects }));
  const setup = await createTestRenderer({ width, height, screenMode: "alternate-screen" });
  await runDashboard(path, async () => setup.renderer, providers);
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
      app.mockInput.pressArrow("right"); app.mockInput.pressArrow("right");
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
    await app.escape(); app.mockInput.pressArrow("right"); app.mockInput.pressArrow("right");
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
    for (let i = 0; i < 6; i++) await app.mockInput.pressKeys(["\x1b[6~"]);
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

test("Projects add, compact field scrolling, native editor keys, Apply and Save work at all target sizes", async () => {
  for (const [width, height] of [[120, 32], [100, 25], [80, 24], [56, 22], [42, 18]]) {
    const app = await cockpit(width!, height!);
    try {
      const original = await readFile(app.path, "utf8");
      app.mockInput.pressArrow("right");
      assert.match(await app.frame(), /YOUR DEN IS READY/);
      await app.enter(); await app.enter();
      await app.mockInput.typeText("s?q n");
      assert.match(await app.frame(), /s\?q n/);
      app.mockInput.pressArrow("left"); app.mockInput.pressBackspace();
      await app.enter(); app.mockInput.pressTab(); await app.enter();
      await app.mockInput.typeText("relative"); await app.enter();
      assert.match(await app.frame(), /Local path: use an absolute/);
      await app.escape(); await app.enter();
      await app.mockInput.typeText("~/projects/new"); await app.enter();
      app.mockInput.pressTab();
      assert.match(await app.frame(), /GitHub repository/);
      app.mockInput.pressTab();
      assert.match(await app.frame(), /Lifecycle/);
      app.mockInput.pressTab(); await app.enter();
      await app.mockInput.typeText("Review new project");
      app.mockInput.pressTab();
      assert.match(await app.frame(), /> Apply to draft/);
      assert.equal(await readFile(app.path, "utf8"), original);
      await app.enter(); await app.waitFor("[Projects]");
      assert.match(await app.frame(), /Unsaved/);
      assert.equal(await readFile(app.path, "utf8"), original);
      app.mockInput.pressTab(); await app.enter(); await app.waitFor("Settings saved.");
      const saved = JSON.parse(await readFile(app.path, "utf8"));
      assert.equal(saved.projects.length, 1);
      assert.equal(saved.projects[0].path, "~/projects/new");
      assert.equal(saved.projects[0].nextAction, "Review new project");
      await app.escape();
      assert.match(await app.frame(), /s\?qn/);
      assert.match(await app.frame(), /Review new project/);
    } finally { await app.close(); }
  }
});

test("Projects removal defaults to Cancel, stages only after explicit selection, and handles last removal", async () => {
  const app = await cockpit(42, 18, ["Atlas"]);
  try {
    const before = await readFile(app.path, "utf8");
    app.mockInput.pressArrow("right"); app.mockInput.pressArrow("down"); await app.enter();
    const removal = await app.frame();
    assert.match(removal, /Project files remain untouched/);
    assert.match(removal, /Git and GitHub remain untouched/);
    assert.match(removal, /> Cancel/);
    await app.enter();
    assert.match(await app.frame(), /1 registered/);
    app.mockInput.pressArrow("down"); await app.enter();
    app.mockInput.pressTab(); assert.match(await app.frame(), /> Remove from draft/);
    await app.enter(); assert.match(await app.frame(), /YOUR DEN IS READY/);
    assert.equal(await readFile(app.path, "utf8"), before);
    app.mockInput.pressTab(); await app.enter(); await app.waitFor("Settings saved.");
    assert.deepEqual(JSON.parse(await readFile(app.path, "utf8")).projects, []);
    await app.escape(); assert.match(await app.frame(), /No projects registered/);
    app.mockInput.pressKey("e"); assert.match(await app.frame(), /No project is ready/);
    app.mockInput.pressKey("s"); await app.waitFor("COCKPIT PREVIEW");
    app.mockInput.pressArrow("right"); assert.match(await app.frame(), /YOUR DEN IS READY/);
  } finally { await app.close(); }
});

test("editing and canceling a form preserves registrations; conflict and Reload recover safely", async () => {
  const app = await cockpit(42, 18, ["Atlas", "Beacon"]);
  try {
    app.mockInput.pressArrow("right"); await app.enter(); await app.enter();
    await app.mockInput.typeText(" changed"); await app.enter();
    await app.escape(); assert.match(await app.frame(), /Discard this form/);
    await app.escape(); assert.match(await app.frame(), /EDIT PROJECT/);
    await app.escape(); await app.enter(); assert.match(await app.frame(), /\[Projects\]/);
    await app.enter(); await app.enter(); await app.mockInput.typeText(" renamed"); await app.enter();
    for (let i = 0; i < 5; i++) app.mockInput.pressTab();
    await app.enter(); await app.waitFor("[Projects]");
    await writeFile(app.path, JSON.stringify({ version: 1, settings: { terminal: "xterm" }, projects: [] }));
    app.mockInput.pressTab(); await app.enter(); await app.waitFor("Conflict");
    assert.match(await app.frame(), /renamed/);
    app.mockInput.pressTab(); app.mockInput.pressTab(); await app.enter(); await app.enter();
    await app.waitFor("Registry reloaded.");
    assert.match(await app.frame(), /YOUR DEN IS READY/);
    await app.escape(); assert.match(await app.frame(), /No projects registered/);
  } finally { await app.close(); }
});

test("Projects list retains every focused row through long-list navigation and resizing", async () => {
  const names = Array.from({ length: 12 }, (_, index) => `Project ${index + 1} 界`);
  const app = await cockpit(120, 32, names);
  try {
    app.mockInput.pressArrow("right");
    for (let index = 0; index < names.length; index++) {
      const frame = await app.frame();
      assert.ok(frame.includes(`> ${names[index]}`), frame);
      app.mockInput.pressArrow("down");
    }
    app.mockInput.pressArrow("up");
    for (const [width, height] of [[100, 25], [80, 24], [56, 22], [42, 18]]) {
      app.resize(width!, height!);
      const frame = await app.frame();
      assert.match(frame, /> Project 12 界/);
      assert.match(frame, /Save.*Cancel.*Reload/);
      assert.ok(frame.split("\n").every(line => measureEditText(line, { widthMethod: "unicode" }) <= width!));
    }
    await app.enter(); await app.enter();
    app.mockInput.pressKey("a", { ctrl: true });
    await app.mockInput.pasteBracketedText("Renamed 界界");
    assert.match(await app.frame(), /Renamed 界界/);
    app.resize(30, 12); assert.match(await app.frame(), /Resize to at least/);
    await app.mockInput.typeText("ignored"); await app.mockInput.pasteBracketedText("ignored paste");
    app.resize(42, 18); assert.doesNotMatch(await app.frame(), /ignored/);
    app.mockInput.pressArrow("left"); app.mockInput.pressKey("DELETE");
    await app.enter();
    assert.match(await app.frame(), /Renamed 界/);
    app.resize(120, 32);
    assert.match(await app.frame(), /> Name/);
    await app.escape(); await app.enter();
    assert.match(await app.frame(), /> Project 12 界/);
  } finally { await app.close(); }
});

test("saving a rename keeps the selected cockpit ID and preserves other registrations", async () => {
  const app = await cockpit(80, 24, ["Atlas", "Beacon", "Cedar"]);
  try {
    await app.escape(); app.mockInput.pressArrow("down");
    app.mockInput.pressKey("s"); await app.waitFor("COCKPIT PREVIEW");
    app.mockInput.pressArrow("right");
    assert.match(await app.frame(), /> Beacon/);
    await app.enter(); await app.enter(); await app.mockInput.typeText(" renamed"); await app.enter();
    for (let i = 0; i < 5; i++) app.mockInput.pressTab();
    await app.enter(); await app.waitFor("[Projects]");
    app.mockInput.pressTab(); await app.enter(); await app.waitFor("Settings saved.");
    const saved = JSON.parse(await readFile(app.path, "utf8"));
    assert.deepEqual(saved.projects.map((project: { id: string }) => project.id), ["sample-0", "sample-1", "sample-2"]);
    assert.equal(saved.projects[1].name, "Beacon renamed");
    await app.escape();
    assert.match(await app.frame(), /▌ Beacon renamed/);
  } finally { await app.close(); }
});

test("removing a selected project during startup ignores its late result at the reused index", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wolf-den-late-project-"));
  const path = join(directory, "projects.json");
  const projects = ["Atlas", "Beacon"].map(name => ({ id: name.toLowerCase(), name, path: `/demo/${name.toLowerCase()}`, lifecycle: "active" }));
  await writeFile(path, JSON.stringify({ version: 1, projects }));
  const app = await createTestRenderer({ width: 80, height: 24, screenMode: "alternate-screen" });
  let resolveOld!: (value: { kind: "unavailable"; reason: string }) => void;
  const old = new Promise<{ kind: "unavailable"; reason: string }>(resolve => { resolveOld = resolve; });
  const running = runDashboard(path, async () => app.renderer, { git: async path => path.endsWith("atlas") ? old : { kind: "available", branch: "beacon-main", detached: false, clean: true, staged: false, unstaged: false, untracked: false } });
  const frame = async () => { await app.renderOnce(); return app.captureCharFrame(); };
  const waitFor = async (value: string) => {
    for (let i = 0; i < 100; i++) { if ((await frame()).includes(value)) return; await setTimeout(5); }
    assert.fail(await frame());
  };
  try {
    await waitFor("beacon-main"); app.mockInput.pressKey("s"); await waitFor("COCKPIT PREVIEW");
    app.mockInput.pressArrow("right");
    app.mockInput.pressTab({ shift: true }); app.mockInput.pressEnter();
    assert.match(await frame(), /REMOVE FROM WOLF DEN/);
    app.mockInput.pressTab(); app.mockInput.pressEnter();
    app.mockInput.pressTab(); app.mockInput.pressEnter(); await waitFor("Settings saved.");
    app.mockInput.pressEscape(); await setTimeout(125);
    assert.match(await frame(), /▌ Beacon/);
    resolveOld({ kind: "unavailable", reason: "OBSOLETE ATLAS RESULT" }); await running;
    const result = await frame();
    assert.match(result, /beacon-main/); assert.doesNotMatch(result, /OBSOLETE ATLAS RESULT/);
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")).projects.map((project: { id: string }) => project.id), ["beacon"]);
  } finally { resolveOld({ kind: "unavailable", reason: "Stopped" }); await running; await app.dispose(); await rm(directory, { recursive: true }); }
});

test("metadata edit preserves selected PR; repository change refreshes sources and clears stale PR selection", async () => {
  const app = await cockpit(120, 32, ["Atlas"], { github: async repository => ({ kind: "available", issues: 1,
    pullRequests: [{ number: 1, title: repository === "example/atlas" ? "Original PR" : "Replacement PR", url: `https://github.com/${repository}/pull/1`, draft: false, review: "APPROVED", checks: "SUCCESS" }] }) });
  try {
    await app.escape(); app.mockInput.pressTab();
    assert.match(await app.frame(), /Review.*APPROVED/);
    app.mockInput.pressKey("s"); await app.waitFor("COCKPIT PREVIEW"); app.mockInput.pressArrow("right");
    await app.enter(); await app.enter(); await app.mockInput.typeText(" renamed"); await app.enter();
    for (let i = 0; i < 5; i++) app.mockInput.pressTab();
    await app.enter(); await app.waitFor("[Projects]"); app.mockInput.pressTab(); await app.enter(); await app.waitFor("Settings saved.");
    await app.escape(); assert.match(await app.frame(), /Review.*APPROVED/);
    app.mockInput.pressKey("s"); await app.waitFor("COCKPIT PREVIEW"); app.mockInput.pressArrow("right"); await app.enter();
    app.mockInput.pressArrow("down"); app.mockInput.pressArrow("down"); await app.enter();
    app.mockInput.pressKey("a", { ctrl: true }); await app.mockInput.typeText("example/new"); await app.enter();
    for (let i = 0; i < 3; i++) app.mockInput.pressTab();
    await app.enter(); await app.waitFor("[Projects]"); app.mockInput.pressTab(); await app.enter(); await app.waitFor("Settings saved.");
    await app.escape(); await app.waitFor("Replacement PR");
    assert.doesNotMatch(await app.frame(), /Review.*APPROVED|Original PR/);
    app.mockInput.pressTab(); assert.match(await app.frame(), /Review.*APPROVED/);
  } finally { await app.close(); }
});
