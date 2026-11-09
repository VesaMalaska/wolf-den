/** Semantic colors are plain RGB values so resolution needs no terminal or OpenTUI state. */
export const themeTokens = [
  "background", "panel", "panelAlt", "selectionBackground", "focusBorder",
  "textPrimary", "textSecondary", "textMuted", "textOnSelection",
  "accent", "accentSubtle", "heading", "divider",
  "success", "attention", "error", "unavailable", "info",
] as const;

export type ThemeToken = typeof themeTokens[number];
export type SemanticTheme = Readonly<Record<ThemeToken, string>>;

export const themePresets = {
  "wolfy-dark": {
    background: "#171B24",
    panel: "#252B38",
    panelAlt: "#303849",
    selectionBackground: "#355675",
    focusBorder: "#92DCF2",
    textPrimary: "#F1F5FC",
    textSecondary: "#C4CFDE",
    textMuted: "#A1B0C2",
    textOnSelection: "#F7FBFF",
    accent: "#C5A2E5",
    accentSubtle: "#B69AD1",
    heading: "#92DCF2",
    divider: "#74879E",
    success: "#91D4B0",
    attention: "#F2C078",
    error: "#EAA6AE",
    unavailable: "#B8C4D2",
    info: "#A9D5E8",
  },
} as const satisfies Record<string, SemanticTheme>;

export type ThemeId = keyof typeof themePresets;
export const defaultThemeId: ThemeId = "wolfy-dark";
export const themeIds = Object.keys(themePresets) as ThemeId[];
export const rgbColorPattern = /^#[0-9A-Fa-f]{6}$/;

export function resolveTheme(theme: ThemeId = defaultThemeId, overrides: Partial<Record<ThemeToken, string>> = {}): SemanticTheme {
  return { ...themePresets[theme], ...overrides };
}
