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

export const CHROME = {
  padding: { window: [8, 8], frame: [7, 3], separator_text: [8, 3], cell: [6, 2] },
  spacing: { item: [7, 4], item_inner: [5, 4] },
  border: { window: 1, child: 1, frame: 1, tab: 0, separator_text: 1 },
  rounding: { child_factor: 0.6, frame_factor: 0.4, popup_factor: 0.8, scrollbar_size: 12 },
} as const;

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
