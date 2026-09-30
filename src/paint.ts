/**
 * Angband with a new coat of paint.
 *
 * Every card this mod draws takes the game's own dialog font and a palette
 * close to its terminal, then adds AnybandUI's decorations on top: the
 * section band under a heading, the corner ticks and the soft wash at the top
 * of a panel (ui_theme.h section() and panel()). The window chrome around the
 * cards is repainted to match through the host's chrome theme, so a card, its
 * frame and the game's own subwindows read as one program.
 */
import { BITMAP_FALLBACK_STACK } from "./bitmap-text.js";
import type { ChromeThemeRequest, ModDisplay } from "@rpgm-tools/neo-angband-core";
import type { ThemeTokens } from "./theme.js";

/** The host ships Angband's 8x13 dialog font under this family name. An engine
 * without it falls back to the same monospace stack the game's terminal uses. */
export const PAINT_FONT = `"Angband 8x13", ${BITMAP_FALLBACK_STACK}`;
/** The bitmap font's own size, so glyphs land on whole pixels. */
export const PAINT_FONT_SIZE = 13;
export const PAINT_LINE_HEIGHT = 16;

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function hex([r, g, b]: readonly number[]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v!))).toString(16).padStart(2, "0")).join("")}`;
}
/** ui_theme.h mix(a, b, t): t of the way from a to b. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i]! - v) * t));
}
/** The accent at an opacity, as #rrggbbaa. */
export function tint(colour: string, alpha: number): string {
  return `${hex(rgb(colour))}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

/** The derived colours every card and the chrome share. */
export function paintColours(theme: Readonly<ThemeTokens>): {
  border: string; muted: string; textStrong: string; floatBorder: string;
  tick: string; wash: string; band: string; hover: string; press: string;
} {
  const off = "#00000000";
  const strong = theme.light_styling ? mix(theme.text, "#000000", 0.5) : mix(theme.text, "#ffffff", 0.5);
  return {
    border: mix(theme.surface, theme.text, 0.28),
    muted: mix(theme.surface, theme.text, 0.55),
    textStrong: strong,
    floatBorder: mix(theme.surface, theme.text, 0.45),
    tick: theme.decorations ? tint(theme.accent, 0.35) : off,
    wash: theme.decorations ? tint(theme.accent, 0.06) : off,
    band: theme.decorations ? tint(theme.accent, 0.12) : off,
    hover: tint(theme.accent, 0.12),
    press: tint(theme.accent, 0.25),
  };
}

/** Custom properties the paint stylesheet reads, set on each card's host. */
export function paintProperties(theme: Readonly<ThemeTokens>): Record<string, string> {
  const c = paintColours(theme);
  return {
    "--anyband-font": PAINT_FONT,
    "--anyband-font-size": `${PAINT_FONT_SIZE}px`,
    "--anyband-line": `${PAINT_LINE_HEIGHT}px`,
    "--anyband-border": c.border,
    "--anyband-muted": c.muted,
    "--anyband-text-strong": c.textStrong,
    "--anyband-tick": c.tick,
    "--anyband-wash": c.wash,
    "--anyband-band": c.band,
    "--anyband-hover": c.hover,
    "--anyband-press": c.press,
    "--anyband-rounding-child": `${Math.round(theme.rounding * 0.6)}px`,
    "--anyband-rounding-frame": `${Math.round(theme.rounding * 0.4)}px`,
  };
}

const FRAMES = [".surface", ".items", ".phase4", ".store"].map((s) => `:host ${s}`).join(",");
const TICK = "linear-gradient(var(--anyband-tick),var(--anyband-tick))";
const CORNERS = ["left 2px top 2px", "right 2px top 2px", "left 2px bottom 2px", "right 2px bottom 2px"];

/**
 * The shared stylesheet. Each selector starts at :host so it outranks a card's
 * own class rules, and it is added to every card root after the card's CSS.
 * Rows drawn as buttons (.row) keep the card's flat look.
 */
export const PAINT_CSS = [
  ":host{font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font);font-synthesis:none;-webkit-font-smoothing:none}",
  ":host b,:host strong,:host th,:host summary,:host .heading,:host h2,:host h3,:host h4{font-weight:normal}",
  ":host b,:host strong{color:var(--anyband-text-strong)}",
  ":host h2,:host h3,:host h4,:host .hint{font-size:inherit}",
  ":host .muted,:host .hint{opacity:1;color:var(--anyband-muted)}",
  `${FRAMES}{border-color:var(--anyband-border);border-radius:var(--anyband-rounding-child);background-color:var(--anyband-surface);`
    + `background-image:${Array(8).fill(TICK).join(",")},linear-gradient(to bottom,var(--anyband-wash),transparent);`
    + `background-position:${CORNERS.flatMap((p) => [p, p]).join(",")},0 0;`
    + `background-size:${Array(4).fill("9px 1px,1px 9px").join(",")},100% 7em;background-repeat:no-repeat}`,
  ":host .heading,:host h2,:host h3{color:var(--anyband-accent);background:linear-gradient(to right,var(--anyband-band),transparent);border-bottom:1px solid var(--anyband-border);padding:2px 6px;margin:0 0 4px}",
  ":host summary{color:var(--anyband-accent)}",
  ":host button:not(.row),:host input:not([type=checkbox]):not([type=radio]),:host select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-border);border-radius:var(--anyband-rounding-frame);padding:1px 6px}",
  ":host input[type=checkbox],:host input[type=radio]{accent-color:var(--anyband-accent)}",
  ":host button:not(.row):hover:not(:disabled),:host select:hover{border-color:var(--anyband-accent);color:var(--anyband-text-strong)}",
  ":host button:not(.row):active:not(:disabled),:host button:not(.row)[aria-pressed=true]{background:var(--anyband-press)}",
  ":host .row:hover:not([aria-pressed=true]):not(:disabled){background:var(--anyband-hover)}",
  ":host button:disabled{opacity:.45}",
  ":host :focus-visible{outline:1px solid var(--anyband-accent);outline-offset:1px}",
  ":host td,:host th{border-bottom-color:var(--anyband-border)}",
  ":host th{color:var(--anyband-muted)}",
  ":host .metric,:host .tip,:host .prompt,:host .menu,:host .rule,:host .bar{border-color:var(--anyband-border)}",
  ":host .metric,:host .badge,:host .tip{border-radius:var(--anyband-rounding-frame)}",
  ":host .bar{border-radius:0}",
  ":host *{scrollbar-width:thin;scrollbar-color:var(--anyband-border) transparent}",
].join("\n");

/** The host's window chrome, repainted to match the cards. */
export function chromeThemeFor(theme: Readonly<ThemeTokens>): ChromeThemeRequest {
  const c = paintColours(theme);
  return {
    font: "Angband 8x13", fontSize: PAINT_FONT_SIZE,
    page: hex(rgb(theme.background)), titleBackground: hex(rgb(theme.surface)),
    text: hex(rgb(theme.text)), textStrong: c.textStrong, muted: c.muted,
    border: c.border, divider: c.border, dividerHover: hex(rgb(theme.accent)),
    accent: hex(rgb(theme.accent)), floatBorder: c.floatBorder,
    radius: Math.round(theme.rounding * 0.6), shadow: false,
  };
}

/** The switches whose cards sit in the game's window, so the chrome is repainted
 * only while at least one of them is on. */
export const PAINTED_FEATURES = [
  "anybandui.sidebar", "anybandui.status", "anybandui.messages", "anybandui.itemsLists",
  "anybandui.spells", "anybandui.quickbar", "anybandui.restDialog", "anybandui.storeWindow",
] as const;

export type ChromeDisplay = Pick<ModDisplay, "setChromeTheme">;

/** Repaint the chrome while any card is on, and give the game its own look back
 * on teardown. An engine without the seam keeps its chrome, and says so once. */
export function installChromePaint(display: ChromeDisplay | undefined, flags: Readonly<Record<string, boolean>>, theme: Readonly<ThemeTokens>, log: (message: string) => void): () => void {
  if (!PAINTED_FEATURES.some((flag) => flags[flag] === true)) return () => {};
  if (!display?.setChromeTheme) { log("This version of the game cannot repaint its window frames, so they keep their usual look."); return () => {}; }
  try {
    display.setChromeTheme(chromeThemeFor(theme));
  } catch (err) {
    log(`Could not repaint the window frames: ${err instanceof Error ? err.message : String(err)}`);
    return () => {};
  }
  return () => { try { display.setChromeTheme?.(null); } catch { /* the host already restored its look */ } };
}
