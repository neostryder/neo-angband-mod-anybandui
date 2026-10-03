import { PAINT_CSS, paintProperties } from "./paint.js";

/** Values from AnybandUI .port-notes/theme.json, sourced from ui_theme.h. */
export interface ThemeTokens {
  background: string;
  surface: string;
  text: string;
  accent: string;
  rounding: number;
  decorations: boolean;
  invert_dungeon: boolean;
  light_styling: boolean;
}

export const THEMES: Readonly<Record<string, Readonly<ThemeTokens>>> = {
  "terminal-original": { background: "#070b0dff", surface: "#111a1dff", text: "#d9e3dbff", accent: "#80b891ff", rounding: 5, decorations: true, invert_dungeon: false, light_styling: false },
  "dark-graphite": { background: "#0e0f13ff", surface: "#1f2129ff", text: "#d9e3dbff", accent: "#9cadd9ff", rounding: 5, decorations: true, invert_dungeon: false, light_styling: false },
  "light-paper": { background: "#e6e8e3ff", surface: "#fafaf2ff", text: "#1f2b2eff", accent: "#215c52ff", rounding: 8, decorations: true, invert_dungeon: false, light_styling: true },
  "amber-terminal": { background: "#110b06ff", surface: "#241910ff", text: "#f0d9a6ff", accent: "#e89e42ff", rounding: 0, decorations: true, invert_dungeon: false, light_styling: false },
  "midnight-ice": { background: "#060b17ff", surface: "#0e1b2bff", text: "#cfe6f5ff", accent: "#59c2e0ff", rounding: 7, decorations: true, invert_dungeon: false, light_styling: false },
};

/** A saved edit of the current theme. Absent means the named preset is in force. */
export interface CustomTheme {
  background: string;
  surface: string;
  text: string;
  accent: string;
  rounding: number;
  invert_dungeon: boolean;
}

const COLOUR = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;

/** #rrggbb or #rrggbbaa, stored as #rrggbbaa. Anything else is refused. */
export function normalizeColour(value: string): string | null {
  const match = COLOUR.exec(value.trim());
  if (!match) return null;
  const hex = match[1]!.toLowerCase();
  return `#${hex.length === 6 ? `${hex}ff` : hex}`;
}

export function normalizeRounding(value: number): number | null {
  return Number.isInteger(value) && value >= 0 && value <= 16 ? value : null;
}

export function parseCustomTheme(value: unknown): CustomTheme | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const background = typeof record["background"] === "string" ? normalizeColour(record["background"]) : null;
  const surface = typeof record["surface"] === "string" ? normalizeColour(record["surface"]) : null;
  const text = typeof record["text"] === "string" ? normalizeColour(record["text"]) : null;
  const accent = typeof record["accent"] === "string" ? normalizeColour(record["accent"]) : null;
  const rounding = typeof record["rounding"] === "number" ? normalizeRounding(record["rounding"]) : null;
  if (!background || !surface || !text || !accent || rounding === null || typeof record["invert_dungeon"] !== "boolean") return null;
  return { background, surface, text, accent, rounding, invert_dungeon: record["invert_dungeon"] };
}

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

/** ui_theme.h: a custom background lighter than half is drawn as a light theme. */
export function lightFromBackground(hex: string): boolean {
  const r = channel(hex, 0);
  const g = channel(hex, 1);
  const b = channel(hex, 2);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
}

/** The tokens to draw: a saved custom theme, otherwise the named preset. */
export function resolveTheme(name: string, custom: CustomTheme | null): ThemeTokens {
  const base = THEMES[name] ?? THEMES["terminal-original"]!;
  if (!custom) return base;
  return {
    ...base,
    background: custom.background,
    surface: custom.surface,
    text: custom.text,
    accent: custom.accent,
    rounding: custom.rounding,
    invert_dungeon: custom.invert_dungeon,
    light_styling: lightFromBackground(custom.background),
  };
}

export const THEME_CHOICES = [
  ["terminal-original", "Terminal (original)"],
  ["dark-graphite", "Dark / Graphite"],
  ["light-paper", "Light / Paper"],
  ["amber-terminal", "Amber terminal"],
  ["midnight-ice", "Midnight / Ice"],
] as const;

export const CHROME = {
  padding: { window: [8, 8], frame: [7, 3], separator_text: [8, 3], cell: [6, 2] },
  spacing: { item: [7, 4], item_inner: [5, 4] },
  border: { window: 1, child: 1, frame: 1, tab: 0, separator_text: 1 },
  rounding: { child_factor: 0.6, frame_factor: 0.4, popup_factor: 0.8, scrollbar_size: 12 },
} as const;

type ThemeChange = (theme: Readonly<ThemeTokens>) => void;

const themeChanges = new Set<ThemeChange>();

/** Cards copy their colours once, when they are created. Save and Drop tell them here. */
export function onThemeChange(listener: ThemeChange): () => void {
  themeChanges.add(listener);
  return () => { themeChanges.delete(listener); };
}

export function notifyThemeChange(theme: Readonly<ThemeTokens>): void {
  for (const listener of [...themeChanges]) listener(theme);
}

const painted = new WeakSet<ShadowRoot>();

export function applyTheme(root: ShadowRoot, theme: Readonly<ThemeTokens> = THEMES["terminal-original"]!): void {
  const style = root.host instanceof HTMLElement ? root.host.style : undefined;
  if (style === undefined) return;
  for (const [key, value] of Object.entries(theme)) {
    style.setProperty(`--anyband-${key.replaceAll("_", "-")}`, typeof value === "boolean" ? Number(value).toString() : key === "rounding" ? `${value}px` : String(value));
  }
  for (const [group, fields] of Object.entries(CHROME)) {
    for (const [key, value] of Object.entries(fields)) {
      style.setProperty(`--anyband-${group}-${key.replaceAll("_", "-")}`,
        Array.isArray(value) ? value.map((part) => `${part}px`).join(" ") : `${value}px`);
    }
  }
  for (const [name, value] of Object.entries(paintProperties(theme))) style.setProperty(name, value);
  /* The paint goes in once per root. Its :host-prefixed selectors outrank the
   * card's own class rules, whichever style element comes first. */
  const doc = (root as { ownerDocument?: Document }).ownerDocument;
  if (!painted.has(root) && doc && typeof root.appendChild === "function") {
    const paint = doc.createElement("style");
    paint.textContent = PAINT_CSS;
    root.appendChild(paint);
    painted.add(root);
  }
}
