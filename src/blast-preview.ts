import { hoverGrid } from "./hover-cards.js";
import { mapProjection } from "./map-overview.js";
import { sameToken } from "./view-model/spells.js";
import type { Grid, Phase4Context, Phase4Snapshot } from "./seams.js";

/** Fill and edge colours per projection element, so a fire ball and a frost
 * ball read differently. Anything unlisted uses the gold of the aiming path. */
const ELEMENT_COLORS: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  FIRE: ["rgba(245,110,40,.12)", "rgba(250,130,60,.8)"], PLASMA: ["rgba(245,110,40,.12)", "rgba(250,130,60,.8)"],
  COLD: ["rgba(120,190,245,.12)", "rgba(140,205,250,.8)"], ICE: ["rgba(120,190,245,.12)", "rgba(140,205,250,.8)"],
  ACID: ["rgba(150,220,70,.12)", "rgba(165,230,90,.8)"], POIS: ["rgba(110,200,110,.12)", "rgba(125,215,125,.8)"],
  ELEC: ["rgba(140,150,250,.12)", "rgba(160,170,255,.85)"], DARK: ["rgba(150,110,200,.12)", "rgba(170,130,220,.8)"],
});
const DEFAULT_COLORS = ["rgba(245,185,70,.095)", "rgba(245,190,80,.745)"] as const;
/** The edge colour for a projection element, shared with the impact flashes in effects.ts. */
export const elementEdgeColour = (element: string | null | undefined): string => (element ? ELEMENT_COLORS[element]?.[1] : undefined) ?? DEFAULT_COLORS[1];

/** The grids a pending ball or breath would reach, or null. Core reports
 * activeBlast only while a ball or breath waits for a direction or a target, so
 * bolts draw nothing. A target prompt aims at its cursor, like the aiming path.
 * A direction prompt has no cursor, so the grid under the pointer stands in. */
export function blastGrids(ctx: Phase4Context, snap: Phase4Snapshot | null | undefined, hovered: Grid | null): { readonly grids: readonly Grid[]; readonly element: string | null } | null {
  const blast = snap?.activeBlast, prompt = snap?.prompt;
  if (!snap || !blast || !sameToken(blast.token, snap.token) || blast.radius < 1) return null;
  if (prompt?.kind !== "target" && prompt?.kind !== "direction") return null;
  const at = (prompt.kind === "target" ? (prompt as { cursor?: Grid }).cursor : null) ?? hovered;
  if (!at) return null;
  let area: ReturnType<NonNullable<NonNullable<Phase4Context["inspect"]>["blastArea"]>> = null;
  try { area = ctx.inspect?.blastArea?.(at, blast.radius, blast.arc) ?? null; } catch { area = null; }
  if (!area || !sameToken(area.token, snap.token) || !area.grids.length) return null;
  return { grids: area.grids, element: area.element ?? blast.element ?? null };
}

export function installBlastPreview(ctx: Phase4Context): () => void {
  if (!ctx.snapshot || !ctx.inspect?.blastArea || !ctx.display?.snapshot) {
    ctx.log("blast preview: snapshot, blast inspection or display seam unavailable"); return () => {};
  }
  const display = ctx.display;
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;z-index:50;pointer-events:none"; document.body.append(canvas);
  let hovered: Grid | null = null;
  // Only reads the pointer; the map's own click and menu handlers stay in charge of input.
  const onMove = (event: MouseEvent): void => {
    const view = display.snapshot();
    const grid = view.mode === "play" || view.mode === "modal" ? hoverGrid(view, { x: event.clientX, y: event.clientY }) : null;
    hovered = grid && grid.x < view.level.width && grid.y < view.level.height ? grid : null;
  };
  const render = (): void => {
    const scale = window.devicePixelRatio || 1; canvas.width = Math.ceil(window.innerWidth * scale); canvas.height = Math.ceil(window.innerHeight * scale);
    const paint = canvas.getContext("2d"); if (!paint) return; paint.scale(scale, scale);
    const snap = ctx.snapshot?.();
    const blast = blastGrids(ctx, snap, hovered); if (!blast) return;
    const view = display.snapshot(); const rect = mapProjection(view); if (!rect) return;
    const width = rect.width / view.viewport.size.width, height = rect.height / view.viewport.size.height;
    const [fill, edge] = (blast.element && ELEMENT_COLORS[blast.element]) || DEFAULT_COLORS;
    paint.beginPath(); paint.rect(rect.x, rect.y, rect.width, rect.height); paint.clip();
    const cells = new Set(blast.grids.map((grid) => `${grid.x},${grid.y}`));
    for (const grid of blast.grids) {
      const x = rect.x + (grid.x - view.viewport.origin.x) * width, y = rect.y + (grid.y - view.viewport.origin.y) * height;
      paint.fillStyle = fill; paint.fillRect(x, y, width, height);
      paint.strokeStyle = edge; paint.lineWidth = 1;
      paint.beginPath(); if (!cells.has(`${grid.x-1},${grid.y}`)) { paint.moveTo(x,y); paint.lineTo(x,y+height); }
      if (!cells.has(`${grid.x+1},${grid.y}`)) { paint.moveTo(x+width,y); paint.lineTo(x+width,y+height); }
      if (!cells.has(`${grid.x},${grid.y-1}`)) { paint.moveTo(x,y); paint.lineTo(x+width,y); }
      if (!cells.has(`${grid.x},${grid.y+1}`)) { paint.moveTo(x,y+height); paint.lineTo(x+width,y+height); } paint.stroke();
    }
  };
  window.addEventListener("mousemove", onMove, true);
  const timer = window.setInterval(render, 50);
  return () => { window.clearInterval(timer); window.removeEventListener("mousemove", onMove, true); canvas.remove(); };
}
