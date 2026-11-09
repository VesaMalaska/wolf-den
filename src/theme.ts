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
    background: "#20242E",
    panel: "#2C3140",
    panelAlt: "#343A4A",
    selectionBackground: "#35516A",
    focusBorder: "#82CBE1",
    textPrimary: "#F0F3F7",
    textSecondary: "#C8D3DE",
    textMuted: "#A4B2C0",
    textOnSelection: "#F7FBFF",
    accent: "#AE8ACB",
    accentSubtle: "#C9B3DC",
    heading: "#82CBE1",
    divider: "#74889C",
    success: "#82BFA0",
    attention: "#E6B46A",
    error: "#F0A3A3",
    unavailable: "#B9C1CC",
    info: "#A9CEE1",
  },
} as const satisfies Record<string, SemanticTheme>;

export type ThemeId = keyof typeof themePresets;
export const defaultThemeId: ThemeId = "wolfy-dark";
export const themeIds = Object.keys(themePresets) as ThemeId[];
export const rgbColorPattern = /^#[0-9A-Fa-f]{6}$/;

export function resolveTheme(theme: ThemeId = defaultThemeId, overrides: Partial<Record<ThemeToken, string>> = {}): SemanticTheme {
  return { ...themePresets[theme], ...overrides };
}
