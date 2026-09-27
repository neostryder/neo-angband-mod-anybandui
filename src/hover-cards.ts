import { validateSettings } from "./settings.js";
import { THEMES } from "./theme.js";
import type { DisplaySnapshot, Point, ZoomDisplay } from "./zoom.js";
import { pointInRect } from "./zoom.js";
import { featureCode, landmarkKind, mapProjection } from "./map-overview.js";
import type { Grid, MonsterRecallResult, RecallSeam, RecallSnapshot } from "./seams.js";

interface LookCore {
  describeLookGrid(state: unknown, grid: Point, mode: number): { text: string; mon?: { hp?: number; maxhp?: number } | null };
  knownPile?(state: unknown, grid: Point): readonly { sensed?: boolean; obj?: unknown }[];
  describeObject?(state: unknown, object: unknown): string;
  squareApparentName?(state: unknown, grid: Point): string;
  squareIsSeen?(chunk: unknown, grid: Point): boolean;
  TMD?: Readonly<Record<string, number>>;
}
interface HoverContext {
  flags: Readonly<Record<string, boolean>>;
  display?: ZoomDisplay;
  core?: LookCore;
  state?: { actor?: { grid?: Point; player?: { timed?: readonly number[]; chp?: number; mhp?: number } }; chunk?: { width: number; height: number } };
  prefs?: { get(): unknown };
  log?: (message: string) => void;
  knownLevel?: () => { cells: readonly { x: number; y: number; remembered: { feat: number; featCode?: string } }[] } | null;
  snapshot?: () => RecallSnapshot | null;
  inspect?: RecallSeam;
}

export function hoverGrid(snapshot: DisplaySnapshot, point: Point): Point | null {
  const rect = mapProjection(snapshot);
  if (!pointInRect(point, rect) || !rect) return null;
  const col = Math.floor((point.x - rect.x) * snapshot.viewport.size.width / rect.width);
  const row = Math.floor((point.y - rect.y) * snapshot.viewport.size.height / rect.height);
  if (col < 0 || row < 0 || col >= snapshot.viewport.size.width || row >= snapshot.viewport.size.height) return null;
  return { x: snapshot.viewport.origin.x + col, y: snapshot.viewport.origin.y + row };
}

export function snapLandmark(snapshot: DisplaySnapshot, point: Point, cells: readonly { x: number; y: number; remembered: { feat: number; featCode?: string } }[]): Point | null {
  const rect = mapProjection(snapshot);
  if (!rect) return null;
  const cellW = rect.width / snapshot.viewport.size.width, cellH = rect.height / snapshot.viewport.size.height;
  let nearest = 64;
  let chosen: Point | null = null;
  for (const cell of cells) {
    if (!landmarkKind(featureCode(cell))) continue;
    const x = rect.x + (cell.x - snapshot.viewport.origin.x + 0.5) * cellW;
    const y = rect.y + (cell.y - snapshot.viewport.origin.y + 0.5) * cellH;
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance < nearest) { nearest = distance; chosen = { x: cell.x, y: cell.y }; }
  }
  return chosen;
}

/* The fixed sentence the game writes for a race with no recorded kills. It
 * tells the player nothing on a card, so the line after it is used instead. */
const NO_BATTLES = "No battles to the death are recalled.";
const RECALL_LIMIT = 90;

/**
 * One short line from the game's own monster recall. The recall's first line
 * is the race's title, which the look text above already names; the next
 * sentence is the kill record or the race's description. Long sentences are
 * cut at a word so the card stays small.
 */
export function recallLine(recall: Pick<MonsterRecallResult, "text"> | null | undefined): string | null {
  const body = recall?.text.split("\n").slice(1).join(" ").replace(/\s+/g, " ").trim();
  if (!body) return null;
  const sentences = body.split(/(?<=[.!?])\s+/).filter((sentence) => sentence && sentence !== NO_BATTLES);
  const first = sentences[0];
  if (!first) return null;
  if (first.length <= RECALL_LIMIT) return first;
  const cut = first.slice(0, RECALL_LIMIT - 3);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[,;:]$/, "")}...`;
}

/**
 * The recall line for a creature at a grid, or null.
 *
 * Two gates keep it to what the character knows. The snapshot must list a
 * visible monster on that grid, so an unseen or camouflaged creature is
 * never looked up, and monsterRecall itself returns null for a race the
 * character has not seen. The read throws when state:monsters.read is not
 * granted, which counts as no line.
 */
export function creatureRecall(ctx: Pick<HoverContext, "snapshot" | "inspect">, grid: Grid): string | null {
  if (!ctx.inspect?.monsterRecall || !ctx.snapshot) return null;
  try {
    const monster = ctx.snapshot()?.core.monsters?.find((entry) => entry.visible && entry.grid.x === grid.x && entry.grid.y === grid.y);
    return monster ? recallLine(ctx.inspect.monsterRecall(monster.raceIndex)) : null;
  } catch { return null; }
}

/* describeLookGrid is the game's own knowledge-gated formatter. Reading the
 * actual chunk or a renderer tile here could disclose an unseen monster. */
export function knownCard(core: LookCore, state: NonNullable<HoverContext["state"]>, grid: Point, map: boolean, recall?: string | null): string | null {
  const look = core.describeLookGrid(state, grid, 0);
  const text = look?.text?.trim();
  if (!text) return null;
  const self = state.actor?.grid?.x === grid.x && state.actor?.grid?.y === grid.y;
  const hallucinating = core.TMD?.IMAGE !== undefined && (state.actor?.player?.timed?.[core.TMD.IMAGE] ?? 0) > 0;
  const pile = hallucinating ? [] : core.knownPile?.(state, grid) ?? [];
  const kind = self ? "You are here" : look.mon ? "Creature" : pile.length > 0 ? "Items" : "Terrain";
  const lines = [`${map ? `(${grid.x}, ${grid.y}) - ` : ""}${kind}`, text];
  if (hallucinating) { lines.push("Appearance unreliable (hallucinating)"); return lines.join("\n"); }
  const hp = self ? state.actor?.player?.chp : look.mon?.hp;
  const max = self ? state.actor?.player?.mhp : look.mon?.maxhp;
  if (typeof hp === "number" && typeof max === "number" && max > 0) {
    const count = Math.max(0, Math.min(10, Math.round(10 * hp / max)));
    lines.push(`[${"#".repeat(count)}${"-".repeat(10 - count)}]`);
  }
  // Only a creature the look text itself describes gets a recall line.
  if (!self && look.mon && recall) lines.push(recall);
  if (self && core.TMD && state.actor?.player?.timed) {
    const statuses = Object.entries(core.TMD).filter(([, index]) => (state.actor?.player?.timed?.[index] ?? 0) > 0)
      .map(([name]) => name.toLowerCase().replaceAll("_", " "));
    if (statuses.length) lines.push(`Statuses: ${statuses.join(", ")}`);
  }
  const terrain = core.squareApparentName?.(state, grid);
  if (terrain) lines.push(`Terrain: ${terrain}`);
  const visible = core.squareIsSeen?.(state.chunk, grid) ?? false;
  for (const entry of pile.slice(0, 5)) {
    lines.push(entry.sensed || !entry.obj || !core.describeObject ? "Remembered item" : `${visible ? "Ground" : "Remembered"}: ${core.describeObject(state, entry.obj)}`);
  }
  if (pile.length > 5) lines.push("More items; use Look");
  return lines.join("\n");
}

export function installHoverCards(ctx: HoverContext): () => void {
  if (!ctx.flags["anybandui.mapHoverCards"] && !ctx.flags["anybandui.dungeonHoverCards"]) return () => {};
  if (!ctx.core?.describeLookGrid || !ctx.display || typeof document === "undefined" || typeof window === "undefined") {
    ctx.log?.("hover cards: look or display API unavailable"); return () => {};
  }
  const core = ctx.core, display = ctx.display;
  const settings = validateSettings(ctx.prefs?.get());
  const theme = THEMES[settings.theme]!;
  const card = document.createElement("div");
  card.setAttribute("role", "tooltip");
  card.style.cssText = `position:fixed;z-index:1000;display:none;pointer-events:none;white-space:pre-wrap;max-width:320px;padding:8px 10px;border:1px solid ${theme.accent};border-radius:${theme.rounding}px;background:${theme.surface};color:${theme.text};font:13px/1.35 sans-serif;box-shadow:0 4px 16px #0008`;
  const preview = document.createElement("canvas");
  preview.width = 64; preview.height = 64;
  preview.style.cssText = "display:none;width:64px;height:64px;float:right;margin:0 0 4px 8px;image-rendering:pixelated";
  const body = document.createElement("span");
  card.append(preview, body);
  document.body.appendChild(card);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let key = "";
  let pinned = false;
  let holdId: number | null = null;
  let down: Point | null = null;
  let known: ReturnType<NonNullable<HoverContext["knownLevel"]>> = null;
  let mapWasOpen = false;
  const cancel = (): void => { if (timer) clearTimeout(timer); timer = null; };
  const hide = (): void => { cancel(); card.style.display = "none"; key = ""; pinned = false; };
  const resolve = (point: Point): { grid: Point; map: boolean } | null => {
    const input = ctx.snapshot?.();
    if (ctx.snapshot && (!input || input.phase !== "play" || input.messagePending || input.prompt)) return null;
    const snap = display.snapshot();
    const map = snap.mode === "map";
    if (!pointInRect(point, mapProjection(snap))) return null;
    if (!map) { known = null; mapWasOpen = false; }
    else if (!mapWasOpen) { mapWasOpen = true; try { known = ctx.knownLevel?.() ?? null; } catch { known = null; } }
    if (map ? !ctx.flags["anybandui.mapHoverCards"] : snap.mode !== "play" || !ctx.flags["anybandui.dungeonHoverCards"]) return null;
    const grid = map && known ? snapLandmark(snap, point, known.cells) ?? hoverGrid(snap, point) : hoverGrid(snap, point);
    if (!grid || grid.x >= snap.level.width || grid.y >= snap.level.height) return null;
    return { grid, map };
  };
  const show = (point: Point, grid: Point, map: boolean): void => {
    const current = resolve(point);
    if (!current || current.grid.x !== grid.x || current.grid.y !== grid.y || current.map !== map) { hide(); return; }
    if (!ctx.state) return;
    const content = knownCard(core, ctx.state, grid, map, map ? null : creatureRecall(ctx, grid));
    if (!content) return;
    body.textContent = content;
    preview.style.display = paintPreview(display.snapshot(), grid, map, preview) ? "block" : "none";
    card.style.display = "block";
    card.style.left = `${Math.max(0, Math.min(window.innerWidth - card.offsetWidth, point.x + 14))}px`;
    card.style.top = `${Math.max(0, Math.min(window.innerHeight - card.offsetHeight, point.y + 14))}px`;
  };
  const onMove = (event: PointerEvent): void => {
    const point = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse" && event.buttons) { if (!pinned) hide(); return; }
    if (holdId === event.pointerId && down && Math.hypot(point.x - down.x, point.y - down.y) > 8) { holdId = null; cancel(); }
    if (event.pointerType === "touch" || pinned) return;
    const resolved = resolve(point);
    const next = resolved ? `${resolved.map}:${resolved.grid.x},${resolved.grid.y}` : "";
    if (next === key) return;
    hide();
    if (!resolved) return;
    key = next;
    timer = setTimeout(() => { if (key === next) show(point, resolved.grid, resolved.map); }, settings.hoverDelayMs);
  };
  const onDown = (event: PointerEvent): void => {
    hide();
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const point = { x: event.clientX, y: event.clientY };
    const resolved = resolve(point);
    if (!resolved) return;
    if (resolved.map) { event.preventDefault(); event.stopImmediatePropagation(); }
    down = point; holdId = event.pointerId;
    timer = setTimeout(() => { if (holdId === event.pointerId) { show(point, resolved.grid, resolved.map); pinned = true; } }, 1000);
  };
  const onUp = (event: PointerEvent): void => { if (holdId === event.pointerId) { holdId = null; cancel(); } };
  const onKey = (): void => hide();
  const onBlur = (): void => hide();
  document.addEventListener("pointermove", onMove);
  window.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
  document.addEventListener("keydown", onKey);
  window.addEventListener("blur", onBlur);
  return () => { hide(); card.remove(); document.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown, true); document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp); document.removeEventListener("keydown", onKey);
    window.removeEventListener("blur", onBlur); };
}

function paintPreview(snapshot: DisplaySnapshot, grid: Point, map: boolean, preview: HTMLCanvasElement): boolean {
  const graphics = map ? Array.from(document.querySelectorAll<HTMLCanvasElement>('body > canvas[aria-hidden="true"]'))
    .find((canvas) => canvas.style.zIndex === "1") : null;
  const source = graphics ?? document.getElementById("game");
  if (!(source instanceof HTMLCanvasElement)) return false;
  const projection = mapProjection(snapshot);
  if (!projection || !projection.width || !projection.height) return false;
  const cellW = projection.width / snapshot.viewport.size.width;
  const cellH = projection.height / snapshot.viewport.size.height;
  const x = projection.x + (grid.x - snapshot.viewport.origin.x) * cellW;
  const y = projection.y + (grid.y - snapshot.viewport.origin.y) * cellH;
  const sourceRect = source.getBoundingClientRect();
  if (!sourceRect.width || !sourceRect.height) return false;
  const ctx = preview.getContext("2d");
  if (!ctx) return false;
  try {
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source,
      (x - sourceRect.left) * source.width / sourceRect.width,
      (y - sourceRect.top) * source.height / sourceRect.height,
      cellW * source.width / sourceRect.width, cellH * source.height / sourceRect.height,
      0, 0, 64, 64);
    return true;
  } catch { return false; }
}
