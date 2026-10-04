/**
 * Minimap travel: a left click on a remembered square of the level map sends
 * the character there with the game's own travel command, which finds the path
 * and stops on a disturbance the way running does.
 *
 * The shell closes the level map on any pointer press, and the game takes no
 * command while the map is up. So the press only records the square, and the
 * travel goes in once the map has closed and the game is waiting for a command
 * again. A square the character has never seen is ignored, and so is a click
 * while an autoplayer holds the keyboard.
 */
import { hoverGrid, snapLandmark } from "./hover-cards.js";
import { clickTile } from "./map-mouse.js";
import { playerIsDriving } from "./input-owner.js";
import type { Grid, InputDriver, KnownLevel, MouseSeams } from "./seams.js";
import type { DisplaySnapshot } from "./zoom.js";
import { viewInput, viewLevel, viewPlayer } from "./host-adapter.js";

/** How long the travel waits for the map to close and the game to be ready, in milliseconds. */
export const TRAVEL_WAIT_MS = 2000;
export const TRAVEL_POLL_MS = 50;

export interface MinimapTravelContext extends MouseSeams {
  readonly flags: Readonly<Record<string, boolean>>;
  readonly display?: { snapshot(): DisplaySnapshot };
  readonly driver?: (() => InputDriver | null | undefined) | undefined;
  readonly log?: (message: string) => void;
}

/** The remembered square under a point on the open level map, or null. */
export function mapTarget(snap: DisplaySnapshot, point: { x: number; y: number }, known: KnownLevel | null, player: Grid | null | undefined): Grid | null {
  if (snap.mode !== "map" || !known) return null;
  // Snap to a nearby staircase or shop as the map's hover card does, so the click goes where the card points.
  const grid = snapLandmark(snap, point, known.cells) ?? hoverGrid(snap, point);
  if (!grid || grid.x >= snap.level.width || grid.y >= snap.level.height) return null;
  if (player && player.x === grid.x && player.y === grid.y) return null;
  const cell = known.cells.find((entry) => entry.x === grid.x && entry.y === grid.y);
  return cell && cell.remembered.feat > 0 && cell.remembered.featCode !== "NONE" ? { x: grid.x, y: grid.y } : null;
}

export function installMinimapTravel(ctx: MinimapTravelContext): () => void {
  if (ctx.flags["anybandui.minimapTravel"] !== true) return () => {};
  if (!ctx.display || !ctx.snapshot || !ctx.knownLevel || !ctx.intent || typeof window === "undefined") {
    ctx.log?.("minimap travel: display, map or intent seam unavailable"); return () => {};
  }
  const display = ctx.display;
  let poll: ReturnType<typeof setInterval> | null = null;
  const stop = (): void => { if (poll) clearInterval(poll); poll = null; };
  const onDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !playerIsDriving(ctx)) return;
    const snap = display.snapshot();
    if (snap.mode !== "map") return;
    let known: KnownLevel | null = null;
    try { known = viewLevel(ctx); } catch { known = null; }
    const target = mapTarget(snap, { x: event.clientX, y: event.clientY }, known, viewPlayer(viewInput(ctx))?.grid);
    stop();
    if (!target) return;
    const deadline = Date.now() + TRAVEL_WAIT_MS;
    poll = setInterval(() => {
      if (Date.now() > deadline || !playerIsDriving(ctx)) { stop(); return; }
      const input = viewInput(ctx);
      if (display.snapshot().mode === "map" || !input || input.phase !== "play" || input.messagePending || input.prompt) return;
      stop();
      if (!clickTile(ctx, target)) ctx.log?.(`minimap travel: the game refused travel to ${target.x},${target.y}`);
    }, TRAVEL_POLL_MS);
  };
  // Capture, so the press is seen before the shell's own handler closes the map.
  window.addEventListener("pointerdown", onDown, true);
  return () => { stop(); window.removeEventListener("pointerdown", onDown, true); };
}
