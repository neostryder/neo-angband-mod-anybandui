import { setPanelHostVisualFilter } from "./panels/panel-host.js";

export const COLORBLIND_FILTER_ID = "anybandui-accessibility-colorblind";
const HIGH_CONTRAST_FILTER = "contrast(1.55) saturate(1.2)";
/* A deuteranopia-oriented daltonization matrix. It carries green-channel error
 * into red and blue, giving common red/green collisions a second visible cue. */
const COLORBLIND_MATRIX = "0.812 0.199 -0.011 0 0 0 1 0 0 0 -0.188 0.199 0.989 0 0 0 0 0 1 0";

interface VisualFilterDisplay {
  setVisualFilter(filter: string | null, options?: { scope: "canvas" | "game" }): void;
  /** Present on engines that keep each mod's filter request apart (MOD_SEAMS 4q). */
  getVisualFilter?(): { readonly filter: string; readonly scope: "canvas" | "game" } | null;
}

/* Engines with getVisualFilter keep a filter request per mod and always take
 * the scope option, so a clear removes only this mod's filter. Older engines
 * hold one global filter and are told apart by the setter's arity, because
 * the first filter seam took no options. Canvas is that older scope, and it
 * is still the dungeon view on a current engine. */
function setFilter(display: VisualFilterDisplay, filter: string | null, scope: "canvas" | "game"): void {
  if (typeof display.getVisualFilter === "function" || display.setVisualFilter.length >= 2) display.setVisualFilter(filter, { scope });
  else display.setVisualFilter(filter);
}

export interface AccessibilityContext {
  readonly flags: Readonly<Record<string, boolean>>;
  /** Theme token. CSS invert(1) is ui_theme.h's XOR of the dungeon ink, alpha kept. */
  readonly invertDungeon?: boolean;
  readonly display?: VisualFilterDisplay;
  readonly log?: (message: string) => void;
}

/**
 * One filter for the host, which keeps a single request.
 * Invert alone stays on the canvas, so panels keep their own colours. An
 * accessibility filter already uses the game scope, and invert follows it
 * so that filter still runs on the original colours.
 */
export function visualTreatment(flags: Readonly<Record<string, boolean>>, invertDungeon = false): { filter: string; scope: "canvas" | "game" } | null {
  const access = accessibilityFilter(flags);
  if (invertDungeon && access) return { filter: `${access} invert(1)`, scope: "game" };
  if (invertDungeon) return { filter: "invert(1)", scope: "canvas" };
  if (access) return { filter: access, scope: "game" };
  return null;
}

/**
 * The accommodations do not compose. Stacking the contrast boost on the
 * colourblind matrix amplifies distortion. Colourblind correction takes
 * priority because it closes an information-access gap (#209).
 */
export function accessibilityFilter(flags: Readonly<Record<string, boolean>>): string | null {
  const filters: string[] = [];
  if (flags["anybandui.colourblind"] === true) filters.push(`url("#${COLORBLIND_FILTER_ID}")`);
  else if (flags["anybandui.highContrast"] === true) filters.push(HIGH_CONTRAST_FILTER);
  // CSS filters compose in order; the accessibility transform runs first so
  // the CRT finish cannot replace the selected accessibility accommodation.
  if (flags["anybandui.crt"] === true) filters.push("contrast(1.08) saturate(1.25) brightness(1.02)");
  return filters.length ? filters.join(" ") : null;
}

/** SVG is required because CSS contrast cannot express a non-diagonal color matrix. */
function ensureColorblindFilter(): void {
  if (typeof document === "undefined" || document.getElementById(COLORBLIND_FILTER_ID)) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", COLORBLIND_FILTER_ID);
  const matrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
  matrix.setAttribute("type", "matrix");
  matrix.setAttribute("values", COLORBLIND_MATRIX);
  filter.appendChild(matrix);
  svg.appendChild(filter);
  document.body?.appendChild(svg);
}

let configuredDisplay: VisualFilterDisplay | null = null;
let configuredScope: "canvas" | "game" = "game";

/** Apply the selected filter after the complete frame in text or tiles mode. */
export function installAccessibilityAccommodations(ctx: AccessibilityContext): void {
  uninstallAccessibilityAccommodations();
  const treatment = visualTreatment(ctx.flags, ctx.invertDungeon === true);
  if (!treatment) return;
  if (!ctx.display) {
    ctx.log?.(ctx.invertDungeon === true && !accessibilityFilter(ctx.flags) ? "this game is too old to invert the dungeon view" : "this game is too old for visual accessibility filters");
    return;
  }
  if (ctx.flags["anybandui.colourblind"] === true) ensureColorblindFilter();
  configuredDisplay = ctx.display;
  configuredScope = treatment.scope;
  // The game scope covers host-owned panels; our HUD hosts mount directly in the page.
  // A canvas-only invert does not, so those hosts keep the colours the theme set.
  setFilter(ctx.display, treatment.filter, treatment.scope);
  setPanelHostVisualFilter(treatment.scope === "game" ? treatment.filter : null);
}

export function uninstallAccessibilityAccommodations(): void {
  const display = configuredDisplay;
  const scope = configuredScope;
  configuredDisplay = null;
  if (display) setFilter(display, null, scope);
  setPanelHostVisualFilter(null);
}
