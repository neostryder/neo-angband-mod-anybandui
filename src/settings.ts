import { FONT_FILES } from "./fonts.js";
import { parseCustomTheme, resolveTheme, type CustomTheme, type ThemeId, type ThemeTokens } from "./theme.js";

export interface Settings {
  theme: ThemeId;
  customTheme: CustomTheme | null;
  interfaceFont: string;
  dungeonFont: string;
  showHeadings: boolean;
  hoverDelayMs: number;
  zoomIndex: number;
  panelZoom: Readonly<Record<string, number>>;
  effects: Readonly<Record<string, number>>;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: "terminal-original", customTheme: null, interfaceFont: "Nouveau_IBM.ttf", dungeonFont: "", showHeadings: true,
  hoverDelayMs: 550, zoomIndex: 7, panelZoom: {}, effects: {},
};

/** The theme a panel should draw, including a custom theme saved over the preset. */
export function themeFromPrefs(raw: unknown): ThemeTokens {
  const settings = validateSettings(raw);
  return resolveTheme(settings.theme, settings.customTheme);
}

interface PrefsCtx { readonly prefs: { get(): unknown; set(value: unknown): void } }
type Listener = (settings: Readonly<Settings>) => void;
// A pack theme stays saved while the packs are off, so turning them back on restores it.
const themes = new Set<Settings["theme"]>(["terminal-original", "dark-graphite", "light-paper", "amber-terminal", "midnight-ice", "linoleum", "plain-terminal"]);
const fonts = new Set<string>(FONT_FILES);

export function validateSettings(value: unknown): Settings {
  const record = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    theme: typeof record["theme"] === "string" && themes.has(record["theme"] as Settings["theme"])
      ? record["theme"] as Settings["theme"] : DEFAULT_SETTINGS.theme,
    customTheme: parseCustomTheme(record["customTheme"]),
    interfaceFont: typeof record["interfaceFont"] === "string" && fonts.has(record["interfaceFont"])
      ? record["interfaceFont"] : DEFAULT_SETTINGS.interfaceFont,
    dungeonFont: typeof record["dungeonFont"] === "string" && (record["dungeonFont"] === "" || fonts.has(record["dungeonFont"]))
      ? record["dungeonFont"] : DEFAULT_SETTINGS.dungeonFont,
    showHeadings: typeof record["showHeadings"] === "boolean" ? record["showHeadings"] : DEFAULT_SETTINGS.showHeadings,
    hoverDelayMs: typeof record["hoverDelayMs"] === "number" && Number.isInteger(record["hoverDelayMs"])
      ? Math.max(0, Math.min(5000, record["hoverDelayMs"])) : DEFAULT_SETTINGS.hoverDelayMs,
    zoomIndex: typeof record["zoomIndex"] === "number" && Number.isInteger(record["zoomIndex"])
      ? Math.max(0, Math.min(18, record["zoomIndex"])) : DEFAULT_SETTINGS.zoomIndex,
    panelZoom: record["panelZoom"] && typeof record["panelZoom"] === "object" && !Array.isArray(record["panelZoom"])
      ? Object.fromEntries(Object.entries(record["panelZoom"] as Record<string, unknown>)
        .filter(([id, step]) => id.length > 0 && typeof step === "number" && Number.isInteger(step) && step >= 0 && step <= 6)) as Record<string, number>
      : DEFAULT_SETTINGS.panelZoom,
    effects: record["effects"] && typeof record["effects"] === "object" && !Array.isArray(record["effects"])
      ? Object.fromEntries(Object.entries(record["effects"] as Record<string, unknown>)
        .filter(([id, value]) => id.length > 0 && typeof value === "number" && Number.isFinite(value))
        .map(([id, value]) => [id, Math.max(0, Math.min(100, Math.round(value as number)))]))
      : DEFAULT_SETTINGS.effects,
  };
}

export function createSettingsStore(ctx: PrefsCtx): {
  get(): Readonly<Settings>;
  set(patch: Partial<Settings>): void;
  subscribe(listener: Listener): () => void;
} {
  let current = validateSettings(ctx.prefs.get());
  const listeners = new Set<Listener>();
  return {
    get: () => ({ ...current }),
    set(patch): void {
      const next = validateSettings({ ...current, ...patch });
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      // Keep the per-character encounter notebook when the player changes a theme.
      const stored = ctx.prefs.get();
      const preserved = stored !== null && typeof stored === "object" && !Array.isArray(stored)
        ? stored as Record<string, unknown> : {};
      ctx.prefs.set({ ...preserved, ...next });
      current = next;
      for (const listener of listeners) listener({ ...current });
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
