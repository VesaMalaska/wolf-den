import { terminalPreferences, type TerminalPreference } from "./domain.js";
import { RegistryPersistence, RegistryPersistenceError, type RegistrySnapshot } from "./registry-persistence.js";
import { defaultThemeId, resolveTheme, rgbColorPattern, themeIds, themeTokens, type SemanticTheme, type ThemeId, type ThemeToken } from "./theme.js";

export const settingsControls = ["preset", ...themeTokens, "terminal", "save", "reset", "cancel", "reload"] as const;
export type SettingsControl = typeof settingsControls[number];
type Draft = { theme: ThemeId; overrides: Partial<Record<ThemeToken, string>>; terminal: TerminalPreference };
type Confirmation = "reset" | "discard" | "reload" | null;

function draftFrom(snapshot: RegistrySnapshot): Draft {
  return { theme: snapshot.document.settings?.theme ?? defaultThemeId,
    overrides: { ...snapshot.document.settings?.themeOverrides }, terminal: snapshot.document.settings?.terminal ?? "system" };
}

function equalDraft(a: Draft, b: Draft): boolean {
  return a.theme === b.theme && a.terminal === b.terminal && JSON.stringify(a.overrides) === JSON.stringify(b.overrides);
}

export class SettingsSession {
  focus = 0;
  editing: { token: ThemeToken; value: string; original: string | undefined } | null = null;
  confirmation: Confirmation = null;
  message = "Choose a control with arrows; Enter edits or activates.";
  error = false;
  busy = false;
  private saved: Draft;
  private draft: Draft;

  constructor(private snapshot: RegistrySnapshot, private readonly persistence: RegistryPersistence) {
    this.saved = draftFrom(snapshot);
    this.draft = draftFrom(snapshot);
  }

  get dirty(): boolean { return !equalDraft(this.draft, this.saved); }
  get theme(): SemanticTheme { return resolveTheme(this.draft.theme, this.draft.overrides); }
  get themeId(): ThemeId { return this.draft.theme; }
  get terminal(): TerminalPreference { return this.draft.terminal; }
  get overrides(): Readonly<Partial<Record<ThemeToken, string>>> { return this.draft.overrides; }
  get control(): SettingsControl { return settingsControls[this.focus]!; }

  move(direction: "up" | "down" | "left" | "right"): void {
    if (this.editing || this.busy) return;
    this.confirmation = null;
    this.focus = direction === "left" ? 0 : direction === "right" ? 19
      : Math.max(0, Math.min(settingsControls.length - 1, this.focus + (direction === "up" ? -1 : 1)));
    this.message = "Enter edits or activates the selected control.";
    this.error = false;
  }

  startEdit(): void {
    const token = this.control;
    if (!themeTokens.includes(token as ThemeToken)) return;
    const selected = token as ThemeToken;
    this.editing = { token: selected, value: "#", original: this.draft.overrides[selected] };
    this.message = "Type #RRGGBB; Backspace removes a character; Enter accepts; Esc cancels.";
    this.error = false;
  }

  input(character: string): void {
    if (!this.editing || this.busy) return;
    if (character === "backspace") this.editing.value = this.editing.value.slice(0, -1);
    else if (character === "#" && this.editing.value === "#") return;
    else if (character.length === 1 && /^[#0-9a-fA-F]$/.test(character) && this.editing.value.length < 7) this.editing.value += character;
    else {
      if (character.length === 1) { this.message = "Use exactly six hexadecimal digits after #; Esc cancels this edit."; this.error = true; }
      return;
    }
    if (rgbColorPattern.test(this.editing.value)) {
      this.draft.overrides[this.editing.token] = this.editing.value.toUpperCase();
      this.message = "Valid color preview. Enter accepts; Esc restores the previous value.";
      this.error = false;
    } else {
      this.message = "Enter a complete #RRGGBB color; the last valid preview remains active.";
      this.error = true;
    }
  }

  acceptEdit(): void {
    if (!this.editing) return;
    if (!rgbColorPattern.test(this.editing.value)) {
      this.message = "Invalid color. Use exactly #RRGGBB or Esc to cancel this edit.";
      this.error = true;
      return;
    }
    this.draft.overrides[this.editing.token] = this.editing.value.toUpperCase();
    this.editing = null;
    this.message = "Color accepted in the draft. Save to write it.";
    this.error = false;
  }

  cancelEdit(): void {
    if (!this.editing) return;
    if (this.editing.original === undefined) delete this.draft.overrides[this.editing.token];
    else this.draft.overrides[this.editing.token] = this.editing.original;
    this.editing = null;
    this.message = "Color edit canceled.";
    this.error = false;
  }

  cyclePreset(): void {
    const index = themeIds.indexOf(this.draft.theme);
    this.draft.theme = themeIds[(index + 1) % themeIds.length]!;
    this.message = themeIds.length === 1 ? "Wolfy Dark is the only installed preset." : "Preset preview updated. Save to keep it.";
    this.error = false;
  }

  cycleTerminal(): void {
    const index = terminalPreferences.indexOf(this.draft.terminal);
    this.draft.terminal = terminalPreferences[(index + 1) % terminalPreferences.length]!;
    this.message = "Terminal choice is a draft. Save to keep it.";
    this.error = false;
  }

  requestReset(): void { this.confirmation = "reset"; this.message = "Reset clears all draft colors and selects Wolfy Dark. Enter confirms; Esc keeps the draft."; this.error = false; }
  requestExit(): boolean {
    if (!this.dirty) return true;
    this.confirmation = "discard";
    this.message = "Unsaved changes. Enter discards and returns; Esc keeps editing.";
    this.error = false;
    return false;
  }
  requestReload(): void { this.confirmation = "reload"; this.message = "Reload discards this draft and reads the current registry. Enter confirms; Esc keeps editing."; this.error = false; }
  cancelConfirmation(): void { this.confirmation = null; this.message = "Confirmation canceled; draft preserved."; this.error = false; }

  async confirm(): Promise<"exit" | "stay"> {
    const action = this.confirmation;
    this.confirmation = null;
    if (action === "discard") return "exit";
    if (action === "reset") {
      this.draft.theme = defaultThemeId;
      this.draft.overrides = {};
      this.message = "Preset preview restored. Save to keep it, or Cancel to return.";
      this.error = false;
    }
    if (action === "reload") await this.reload();
    return "stay";
  }

  async save(): Promise<boolean> {
    if (this.busy) return false;
    if (this.editing) { this.message = "Finish the color edit before saving."; this.error = true; return false; }
    this.busy = true;
    try {
      const settings = { ...this.snapshot.document.settings };
      // Keep explicit existing settings. Remove only overrides the user reset to the preset.
      if (this.draft.theme !== this.saved.theme || settings.theme !== undefined) settings.theme = this.draft.theme;
      if (this.draft.terminal !== this.saved.terminal || settings.terminal !== undefined) settings.terminal = this.draft.terminal;
      if (Object.keys(this.draft.overrides).length) settings.themeOverrides = { ...this.draft.overrides };
      else if (JSON.stringify(this.draft.overrides) !== JSON.stringify(this.saved.overrides)) delete settings.themeOverrides;
      const document = { ...this.snapshot.document, ...(Object.keys(settings).length ? { settings } : { settings: undefined }) };
      if (document.settings === undefined) delete document.settings;
      const saved = await this.persistence.save(document, this.snapshot.revision);
      this.snapshot = saved;
      this.saved = draftFrom(saved);
      this.draft = draftFrom(saved);
      this.message = "Settings saved.";
      this.error = false;
      return true;
    } catch (error) {
      this.message = error instanceof RegistryPersistenceError
        ? error.code === "conflict" ? `Conflict: choose Reload, review, then reapply. ${error.message}` : error.message
        : "Settings save failed. Check the registry and retry.";
      this.error = true;
      return false;
    } finally { this.busy = false; }
  }

  private async reload(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const snapshot = await this.persistence.load();
      this.snapshot = snapshot;
      this.saved = draftFrom(snapshot);
      this.draft = draftFrom(snapshot);
      this.message = "Registry reloaded. Review settings before saving.";
      this.error = false;
    } catch (error) {
      this.message = error instanceof Error ? error.message : "Could not reload the registry.";
      this.error = true;
    } finally { this.busy = false; }
  }
}
