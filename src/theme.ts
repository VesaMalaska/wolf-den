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
    background: "#090D14",
    panel: "#161E2B",
    panelAlt: "#202B3C",
    selectionBackground: "#294D70",
    focusBorder: "#76DDF5",
    textPrimary: "#F4F6FD",
    textSecondary: "#D1DEEC",
    textMuted: "#A9BBD0",
    textOnSelection: "#F7FBFF",
    accent: "#D29BF4",
    accentSubtle: "#C0A0DF",
    heading: "#76DDF5",
    divider: "#526D8B",
    success: "#69DCA8",
    attention: "#F5B95F",
    error: "#F18A9B",
    unavailable: "#B9C7D9",
    info: "#85C9F4",
  },
} as const satisfies Record<string, SemanticTheme>;

export type ThemeId = keyof typeof themePresets;
export const defaultThemeId: ThemeId = "wolfy-dark";
export const themeIds = Object.keys(themePresets) as ThemeId[];
export const rgbColorPattern = /^#[0-9A-Fa-f]{6}$/;

export function resolveTheme(theme: ThemeId = defaultThemeId, overrides: Partial<Record<ThemeToken, string>> = {}): SemanticTheme {
  return { ...themePresets[theme], ...overrides };
}
