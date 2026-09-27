import { THEMES } from "./theme.js";
import { validateSettings } from "./settings.js";
import type { DisplaySnapshot, Point, ZoomDisplay } from "./zoom.js";
import { clampOrigin, pointInRect } from "./zoom.js";

export function mapProjection(snapshot: DisplaySnapshot): { x: number; y: number; width: number; height: number } | undefined {
  if (snapshot.mode === "map" && typeof document !== "undefined") {
    const graphics = Array.from(document.querySelectorAll<HTMLCanvasElement>('body > canvas[aria-hidden="true"]'))
      .find((canvas) => canvas.style.zIndex === "1");
    if (graphics) {
      const rect = graphics.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    }
  }
  return snapshot.regions.map?.pixels;
}

interface MapDisplay extends ZoomDisplay {
  setMapView(view: { origin: Point; size: { width: number; height: number } } | null): void;
  setFullMapOverview(enabled: boolean): void;
  setTileScaling(mode: "auto" | "crisp"): void;
}
interface Context {
  flags: Readonly<Record<string, boolean>>;
  display?: MapDisplay;
  state?: { actor?: { grid?: Point } };
  prefs?: { get(): unknown };
  log?: (message: string) => void;
  knownLevel?: () => KnownLevel | null;
}
interface KnownLevel { cells: readonly { x: number; y: number; remembered: { feat: number; featCode?: string } }[] }

export function featureCode(cell: KnownLevel["cells"][number]): string | undefined {
  const builtIn = ["NONE", "FLOOR", "CLOSED", "OPEN", "BROKEN", "LESS", "MORE",
    "STORE_GENERAL", "STORE_ARMOR", "STORE_WEAPON", "STORE_BOOK", "STORE_ALCHEMY",
    "STORE_MAGIC", "STORE_BLACK", "HOME", "SECRET", "RUBBLE", "MAGMA", "QUARTZ",
    "MAGMA_K", "QUARTZ_K", "GRANITE", "PERM", "LAVA", "PASS_RUBBLE"];
  return cell.remembered.featCode ?? builtIn[cell.remembered.feat];
}

export function landmarkKind(code: string | undefined): "up" | "down" | "shop" | null {
  if (!code) return null;
  if (/(?:LESS|STAIR_UP|UP_STAIR)/i.test(code)) return "up";
  if (/(?:MORE|STAIR_DOWN|DOWN_STAIR)/i.test(code)) return "down";
  if (/(?:STORE|SHOP)/i.test(code)) return "shop";
  return null;
}

export function schematicColour(code: string | undefined): string {
  if (!code) return "#1b2732";
  if (/(?:WALL|GRANITE|PERM)/i.test(code)) return "#435265";
  if (/DOOR/i.test(code)) return "#a4774a";
  return "#263b48";
}

export type MarkerKind = "player" | "up" | "down" | "shop";
export function drawMarker(g: CanvasRenderingContext2D, x: number, y: number, r: number, kind: MarkerKind): void {
  const color = kind === "up" ? "#5fcdff" : kind === "down" ? "#ffc155" : kind === "shop" ? "#da8dff" : "#f5faff";
  g.fillStyle = "rgba(8,13,20,0.92)";
  g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath();
  if (kind === "shop") g.rect(x - r, y - r, 2 * r, 2 * r);
  else if (kind === "player") { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
  else if (kind === "up") { g.moveTo(x, y - r); g.lineTo(x - r, y + r); g.lineTo(x + r, y + r); g.closePath(); }
  else { g.moveTo(x, y + r); g.lineTo(x - r, y - r); g.lineTo(x + r, y - r); g.closePath(); }
  g.fill();
}

export function fitView(snapshot: DisplaySnapshot): { origin: Point; size: { width: number; height: number } } {
  return { origin: { x: 0, y: 0 }, size: { width: snapshot.level.width, height: snapshot.level.height } };
}

export function zoomMapAt(snapshot: DisplaySnapshot, direction: number, pointer: Point): { origin: Point; size: { width: number; height: number } } {
  const rect = mapProjection(snapshot);
  const old = snapshot.viewport.size;
  const width = Math.max(2, Math.min(snapshot.level.width, Math.round(old.width * (direction > 0 ? 0.8 : 1.25))));
  const height = Math.max(2, Math.min(snapshot.level.height, Math.round(old.height * (direction > 0 ? 0.8 : 1.25))));
  if (!rect || !pointInRect(pointer, rect)) return { origin: clampOrigin({ ...snapshot, viewport: { ...snapshot.viewport, size: { width, height } } }, snapshot.viewport.origin), size: { width, height } };
  const fx = (pointer.x - rect.x) / rect.width, fy = (pointer.y - rect.y) / rect.height;
  const caveX = snapshot.viewport.origin.x + fx * old.width;
  const caveY = snapshot.viewport.origin.y + fy * old.height;
  const resized = { ...snapshot, viewport: { ...snapshot.viewport, size: { width, height } } };
  return { origin: clampOrigin(resized, { x: caveX - fx * width, y: caveY - fy * height }), size: { width, height } };
}

export function installMapOverview(ctx: Context): () => void {
  const display = ctx.display;
  if (!display || (!ctx.flags["anybandui.mapOverview"] && !ctx.flags["anybandui.mapSchematic"] && !ctx.flags["anybandui.crispTiles"])) return () => {};
  let appliedMapView = false;
  const setMapView: typeof display.setMapView = (view) => {
    display.setMapView(view);
    appliedMapView = view !== null;
  };
  display.setFullMapOverview(true);
  const appliedTileScaling = ctx.flags["anybandui.crispTiles"] === true;
  if (appliedTileScaling) display.setTileScaling("crisp");
  const restoreDisplay = (): void => {
    if (appliedMapView) display.setMapView(null);
    display.setFullMapOverview(false);
    if (appliedTileScaling) display.setTileScaling("auto");
  };
  if ((!ctx.flags["anybandui.mapOverview"] && !ctx.flags["anybandui.mapSchematic"]) || typeof document === "undefined" || typeof window === "undefined") {
    return restoreDisplay;
  }
  const theme = THEMES[validateSettings(ctx.prefs?.get()).theme]!;
  const strip = document.createElement("div");
  strip.style.cssText = `position:fixed;z-index:900;display:none;height:24px;align-items:center;gap:8px;padding:0 6px;background:${theme.surface};color:${theme.text};font:12px sans-serif`;
  const fit = document.createElement("button"); fit.textContent = "Fit floor";
  const center = document.createElement("button"); center.textContent = "Centre on player";
  const readout = document.createElement("span");
  strip.append(fit, center, readout);
  const legend = document.createElement("span");
  legend.style.cssText = "display:inline-flex;align-items:center;gap:8px";
  for (const [kind, label] of [["player", "You"], ["up", "Up"], ["down", "Down"], ["shop", "Shop"]] as const) {
    const item = document.createElement("span");
    item.style.cssText = "display:inline-flex;align-items:center;gap:3px";
    const swatch = document.createElement("canvas"); swatch.width = 16; swatch.height = 16;
    const ink = swatch.getContext("2d"); if (ink) drawMarker(ink, 8, 8, 4, kind);
    item.append(swatch, document.createTextNode(label)); legend.appendChild(item);
  }
  strip.appendChild(legend);
  document.body.appendChild(strip);
  const toggle = document.createElement("button");
  toggle.type = "button"; toggle.textContent = "Map controls";
  toggle.setAttribute("aria-label", "Show map controls");
  toggle.style.cssText = `position:fixed;z-index:901;display:none;background:${theme.surface};color:${theme.text}`;
  document.body.appendChild(toggle);
  let controlsOpen = false;
  toggle.addEventListener("click", () => { controlsOpen = !controlsOpen; update(); });
  const overlay = document.createElement("canvas");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = "position:fixed;z-index:899;display:none;pointer-events:none";
  document.body.appendChild(overlay);
  let known: KnownLevel | null = null;
  let playView: { origin: Point; size: { width: number; height: number } } | null = null;
  let marginReported = false;
  let lastMode = "";
  let drag: Point | null = null;
  const update = (): void => {
    const snap = display.snapshot();
    if (snap.mode !== "map") { strip.style.display = "none"; toggle.style.display = "none"; controlsOpen = false; overlay.style.display = "none";
      if (snap.mode === "play") playView = snap.viewport; lastMode = snap.mode; return; }
    if (lastMode !== "map") {
      if (!ctx.flags["anybandui.zoom"] && !ctx.flags["anybandui.enlargedDisplay"]) setMapView(fitView(snap));
      try { known = ctx.knownLevel?.() ?? null; } catch { known = null; }
    }
    lastMode = "map";
    const rect = mapProjection(snap);
    if (rect && known) {
      overlay.style.display = "block";
      overlay.style.left = `${rect.x}px`; overlay.style.top = `${rect.y}px`;
      overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
      overlay.width = Math.max(1, Math.round(rect.width)); overlay.height = Math.max(1, Math.round(rect.height));
      const g = overlay.getContext("2d");
      if (g) {
        const cw = rect.width / snap.viewport.size.width, ch = rect.height / snap.viewport.size.height;
        for (const cell of known.cells) {
          const x = (cell.x - snap.viewport.origin.x) * cw, y = (cell.y - snap.viewport.origin.y) * ch;
          if (x + cw < 0 || y + ch < 0 || x >= rect.width || y >= rect.height) continue;
          if (ctx.flags["anybandui.mapSchematic"]) { g.fillStyle = schematicColour(featureCode(cell)); g.fillRect(x, y, Math.ceil(cw), Math.ceil(ch)); }
          const kind = landmarkKind(featureCode(cell));
          if (kind) drawMarker(g, x + cw / 2, y + ch / 2, Math.max(3, Math.min(7, Math.min(cw, ch) * 0.4)), kind);
        }
        if (playView) { g.strokeStyle = "#7aacd4"; g.lineWidth = 2;
          g.strokeRect((playView.origin.x - snap.viewport.origin.x) * cw, (playView.origin.y - snap.viewport.origin.y) * ch,
            playView.size.width * cw, playView.size.height * ch); }
        const player = ctx.state?.actor?.grid;
        if (player) drawMarker(g, (player.x + 0.5 - snap.viewport.origin.x) * cw,
          (player.y + 0.5 - snap.viewport.origin.y) * ch, Math.max(4, Math.min(8, Math.min(cw, ch) * 0.45)), "player");
      }
    } else overlay.style.display = "none";
    /* A core-provided margin seam would give controls a stable place outside
     * the map at every size; until then, small views use an on-demand overlay. */
    if (!rect || rect.y < 24 || rect.width < 480) {
      toggle.style.display = rect ? "block" : "none";
      if (rect) { toggle.style.left = `${rect.x + 4}px`; toggle.style.top = `${rect.y + 4}px`; }
      strip.style.display = controlsOpen && rect ? "flex" : "none";
      if (controlsOpen && rect) { strip.style.left = `${rect.x}px`; strip.style.top = `${rect.y + 30}px`; }
      if (!marginReported) { marginReported = true; ctx.log?.("map controls: host provides no clear margin above this map size"); }
      return;
    }
    toggle.style.display = "none";
    strip.style.display = "flex";
    strip.style.left = `${rect.x}px`;
    strip.style.top = `${rect.y - 24}px`;
    const zoom = Math.round(100 * snap.level.width / Math.max(1, snap.viewport.size.width));
    readout.textContent = `${zoom}%`;
  };
  fit.addEventListener("click", () => setMapView(fitView(display.snapshot())));
  center.addEventListener("click", () => {
    const player = ctx.state?.actor?.grid;
    if (!player) return;
    const snap = display.snapshot();
    setMapView({ origin: clampOrigin(snap, { x: player.x - snap.viewport.size.width / 2, y: player.y - snap.viewport.size.height / 2 }), size: snap.viewport.size });
  });
  const wheel = (event: WheelEvent): void => {
    if (ctx.flags["anybandui.zoom"] || ctx.flags["anybandui.enlargedDisplay"]) return;
    const snap = display.snapshot();
    const point = { x: event.clientX, y: event.clientY };
    if (snap.mode !== "map" || !pointInRect(point, mapProjection(snap))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    setMapView(zoomMapAt(snap, event.deltaY < 0 ? 1 : -1, point));
  };
  const down = (event: PointerEvent): void => {
    if (event.button === 0 && display.snapshot().mode === "map" && pointInRect({ x: event.clientX, y: event.clientY }, mapProjection(display.snapshot()))) drag = { x: event.clientX, y: event.clientY };
  };
  const move = (event: PointerEvent): void => {
    if (!drag) return;
    const snap = display.snapshot();
    if (snap.mode !== "map") { drag = null; return; }
    const rect = mapProjection(snap);
    if (!rect) return;
    const dx = Math.trunc((event.clientX - drag.x) * snap.viewport.size.width / rect.width);
    const dy = Math.trunc((event.clientY - drag.y) * snap.viewport.size.height / rect.height);
    if (!dx && !dy) return;
    setMapView({ origin: clampOrigin(snap, { x: snap.viewport.origin.x - dx, y: snap.viewport.origin.y - dy }), size: snap.viewport.size });
    drag = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  };
  const up = (): void => { drag = null; };
  const offKey = display.onKey((event) => {
    const snap = display.snapshot();
    if (snap.mode === "play" && event.key === "M" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      playView = snap.viewport;
      return;
    }
    if (ctx.flags["anybandui.zoom"] || ctx.flags["anybandui.enlargedDisplay"]) return;
    if (snap.mode !== "map" || !event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key;
    const dx = key === "ArrowLeft" ? -2 : key === "ArrowRight" ? 2 : 0;
    const dy = key === "ArrowUp" ? -2 : key === "ArrowDown" ? 2 : 0;
    if (dx || dy) setMapView({ origin: clampOrigin(snap, { x: snap.viewport.origin.x + dx, y: snap.viewport.origin.y + dy }), size: snap.viewport.size });
    else if (key === "=" || key === "+" || key === "-" || key === "_") {
      const rect = mapProjection(snap);
      const at = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: 0, y: 0 };
      setMapView(zoomMapAt(snap, key === "-" || key === "_" ? -1 : 1, at));
    } else return;
    event.preventDefault(); event.stopImmediatePropagation();
  });
  window.addEventListener("wheel", wheel, { capture: true, passive: false });
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  const timer = setInterval(update, 150);
  return () => { clearInterval(timer); offKey(); strip.remove(); toggle.remove(); overlay.remove(); restoreDisplay();
    window.removeEventListener("wheel", wheel, true); window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); };
}
