import { FONT_FILES } from "./fonts.js";

export interface Settings {
  theme: "terminal-original" | "dark-graphite" | "light-paper" | "amber-terminal" | "midnight-ice";
  interfaceFont: string;
  dungeonFont: string;
  showHeadings: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: "terminal-original", interfaceFont: "Nouveau_IBM.ttf", dungeonFont: "", showHeadings: true,
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
      ctx.prefs.set(next);
      current = next;
      for (const listener of listeners) listener({ ...current });
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
