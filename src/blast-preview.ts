import { mapProjection } from "./map-overview.js";
import { sameToken } from "./view-model/spells.js";
import type { Phase4Context } from "./seams.js";

export function installBlastPreview(ctx: Phase4Context): () => void {
  if (!ctx.snapshot || !ctx.inspect?.blastArea || !ctx.inspect.projectionPath || !ctx.display?.snapshot || !ctx.targeting?.blastRadius) {
    ctx.log("blast preview: targeting radius or inspection seam unavailable"); return () => {};
  }
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;z-index:50;pointer-events:none"; document.body.append(canvas);
  const render = (): void => {
    const scale = window.devicePixelRatio || 1; canvas.width = Math.ceil(window.innerWidth * scale); canvas.height = Math.ceil(window.innerHeight * scale);
    const paint = canvas.getContext("2d"); if (!paint) return; paint.scale(scale, scale);
    const snap = ctx.snapshot?.(); const prompt = snap?.prompt;
    if (!snap || prompt?.kind !== "target" || !prompt.cursor) return;
    const radius = ctx.targeting?.blastRadius(); if (!radius || radius <= 0) return;
    const blast = ctx.inspect?.blastArea?.(prompt.cursor, radius); const path = ctx.inspect?.projectionPath?.(prompt.cursor);
    if (!blast || !path || !sameToken(blast.token, snap.token) || !sameToken(path.token, snap.token)) return;
    const view = ctx.display!.snapshot(); const rect = mapProjection(view); if (!rect) return;
    const width = rect.width / view.viewport.size.width, height = rect.height / view.viewport.size.height;
    paint.beginPath(); paint.rect(rect.x, rect.y, rect.width, rect.height); paint.clip();
    const cells = new Set(blast.grids.map((grid) => `${grid.x},${grid.y}`));
    for (const grid of blast.grids) {
      const x = rect.x + (grid.x - view.viewport.origin.x) * width, y = rect.y + (grid.y - view.viewport.origin.y) * height;
      paint.fillStyle = "rgba(245,185,70,.095)"; paint.fillRect(x, y, width, height);
      paint.strokeStyle = "rgba(245,190,80,.745)"; paint.lineWidth = 1;
      paint.beginPath(); if (!cells.has(`${grid.x-1},${grid.y}`)) { paint.moveTo(x,y); paint.lineTo(x,y+height); }
      if (!cells.has(`${grid.x+1},${grid.y}`)) { paint.moveTo(x+width,y); paint.lineTo(x+width,y+height); }
      if (!cells.has(`${grid.x},${grid.y-1}`)) { paint.moveTo(x,y); paint.lineTo(x+width,y); }
      if (!cells.has(`${grid.x},${grid.y+1}`)) { paint.moveTo(x,y+height); paint.lineTo(x+width,y+height); } paint.stroke();
    }
  };
  const timer = window.setInterval(render, 50); return () => { window.clearInterval(timer); canvas.remove(); };
}
