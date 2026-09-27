import { FONT_FILES } from "./fonts.js";

export interface Settings {
  theme: "terminal-original" | "dark-graphite" | "light-paper" | "amber-terminal" | "midnight-ice";
  interfaceFont: string;
  dungeonFont: string;
  showHeadings: boolean;
  hoverDelayMs: number;
  zoomIndex: number;
  panelZoom: Readonly<Record<string, number>>;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: "terminal-original", interfaceFont: "Nouveau_IBM.ttf", dungeonFont: "", showHeadings: true,
  hoverDelayMs: 550, zoomIndex: 7, panelZoom: {},
};

interface PrefsCtx { readonly prefs: { get(): unknown; set(value: unknown): void } }
type Listener = (settings: Readonly<Settings>) => void;
const themes = new Set<Settings["theme"]>(["terminal-original", "dark-graphite", "light-paper", "amber-terminal", "midnight-ice"]);
const fonts = new Set<string>(FONT_FILES);

export function validateSettings(value: unknown): Settings {
  const record = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    theme: typeof record["theme"] === "string" && themes.has(record["theme"] as Settings["theme"])
      ? record["theme"] as Settings["theme"] : DEFAULT_SETTINGS.theme,
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
