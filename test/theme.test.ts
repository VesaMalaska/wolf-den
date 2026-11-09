import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultThemeId, resolveTheme, rgbColorPattern, themeIds, themePresets, themeTokens } from "../src/theme.js";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(a: string, b: string): number {
  const brighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (brighter + 0.05) / (darker + 0.05);
}

test("built-in semantic theme has every approved token and valid RGB colors", () => {
  assert.deepEqual(themeIds, ["wolfy-dark"]);
  assert.equal(defaultThemeId, "wolfy-dark");
  assert.equal(themeTokens.length, 18);
  for (const preset of Object.values(themePresets)) {
    assert.deepEqual(Object.keys(preset).sort(), [...themeTokens].sort());
    for (const color of Object.values(preset)) assert.match(color, rgbColorPattern);
  }
});

test("default resolution uses Wolfy Dark and overrides only selected roles", () => {
  assert.deepEqual(resolveTheme(), themePresets["wolfy-dark"]);
  const changed = resolveTheme("wolfy-dark", { accent: "#112233", selectionBackground: "#405060" });
  assert.equal(changed.accent, "#112233");
  assert.equal(changed.selectionBackground, "#405060");
  assert.equal(changed.success, themePresets["wolfy-dark"].success);
  assert.equal(themePresets["wolfy-dark"].accent, "#AE8ACB");
});

test("Wolfy Dark keeps primary, secondary, status and selection text readable", () => {
  const theme = resolveTheme();
  for (const foreground of [theme.textPrimary, theme.textSecondary, theme.textMuted, theme.success, theme.attention, theme.error, theme.unavailable, theme.info]) {
    assert.ok(contrast(foreground, theme.panel) >= 4.5, `${foreground} on panel`);
  }
  assert.ok(contrast(theme.textOnSelection, theme.selectionBackground) >= 4.5);
  assert.ok(contrast(theme.heading, theme.background) >= 4.5);
  assert.ok(contrast(theme.accent, theme.panel) >= 4.5);
  assert.ok(contrast(theme.accentSubtle, theme.panel) >= 4.5);
});
