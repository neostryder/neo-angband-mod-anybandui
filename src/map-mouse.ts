import { hoverGrid } from "./hover-cards.js";
import { mapProjection } from "./map-overview.js";
import { validateSettings } from "./settings.js";
import { THEMES } from "./theme.js";
import type { Grid, InputSnapshot, MouseSeams, PlayerIntent } from "./seams.js";
import type { ZoomDisplay } from "./zoom.js";
import { playerIsDriving } from "./input-owner.js";

export interface MapMouseContext extends MouseSeams {
  readonly flags: Readonly<Record<string, boolean>>;
  readonly display?: ZoomDisplay;
  readonly prefs?: { get(): unknown };
  readonly log?: (message: string) => void;
}

function ready(snap: InputSnapshot | null): boolean {
  return !!snap && snap.phase === "play" && !snap.messagePending && !snap.prompt && !!snap.core.player;
}

function sameToken(a: InputSnapshot["token"], b: InputSnapshot["token"]): boolean {
  return a.epoch === b.epoch && a.revision === b.revision;
}

export function walkIntent(player: Grid, at: Grid): PlayerIntent | null {
  const dx = at.x - player.x, dy = at.y - player.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
    return { kind: "command", command: { code: "walk", dir: 5 + Math.sign(dx) - 3 * Math.sign(dy) } };
  }
  return { kind: "travel", x: at.x, y: at.y };
}

const TILE_ACTION_LABELS: Readonly<Record<string, string>> = {
  tunnel: "Tunnel", open: "Open", close: "Close", disarm: "Disarm",
  ascend: "Go up the stairs", descend: "Go down the stairs", pickup: "Pick up",
};
const DIRECTED_CODES: ReadonlySet<string> = new Set(["tunnel", "open", "close", "disarm"]);

interface TileMenuAction { label: string; intent?: PlayerIntent; pickup?: true; promptAction?: "select" | "cancel" }
export function tileMenuActions(ctx: MouseSeams, snap: InputSnapshot, at: Grid): readonly TileMenuAction[] {
  if (snap.prompt?.kind === "target") return ctx.prompt ? [{ label: "Select tile", promptAction: "select" }, { label: "Cancel", promptAction: "cancel" }] : [];
  if (!ready(snap)) return [];
  const actions: TileMenuAction[] = [];
  const walk = walkIntent(snap.core.player!.grid, at);
  if (walk) actions.push({ label: "Walk here", intent: walk });
  actions.push({ label: "Look", intent: { kind: "command", command: { code: "look" } } });
  actions.push({ label: "Target", intent: { kind: "target", ...at } });
  const known = ctx.knownLevel?.();
  if (known && sameToken(known.token, snap.token) && known.cells.some((cell) => cell.x === at.x && cell.y === at.y && cell.remembered.objects.length > 0)) {
    actions.push({ label: "Pick up", pickup: true });
  }
  // The engine answers with command codes, checked by the same predicates the
  // commands use. Only codes with a label here are offered, so a code added to
  // the engine later never shows up raw. "walk" is left to "Walk here" above.
  const offered = ctx.inspect?.tileActions?.(at);
  if (offered && sameToken(offered.token, snap.token)) {
    const player = snap.core.player!.grid;
    const dx = at.x - player.x, dy = at.y - player.y;
    const dir = 5 + Math.sign(dx) - 3 * Math.sign(dy);
    for (const code of offered.codes) {
      const label = TILE_ACTION_LABELS[code];
      if (!label || actions.some((action) => action.label === label)) continue;
      if (code === "pickup") actions.push({ label, pickup: true });
      else actions.push({ label, intent: { kind: "command", command: DIRECTED_CODES.has(code) ? { code, dir } : { code } } });
    }
  }
  return actions;
}

export function clickTile(ctx: MouseSeams, at: Grid): boolean {
  if (!playerIsDriving(ctx)) return false;
  const snap = ctx.snapshot?.() ?? null;
  if (snap?.prompt?.kind === "target") return !!ctx.prompt?.reply(snap.prompt.promptId, { action: "move", ...at }).accepted;
  if (!ready(snap) || !snap || !ctx.intent) return false;
  const intent = walkIntent(snap.core.player!.grid, at);
  return !!intent && ctx.intent.submit(snap.token, intent).accepted;
}

export function runMenuAction(ctx: MouseSeams, at: Grid, label: string): boolean {
  if (!playerIsDriving(ctx)) return false;
  const snap = ctx.snapshot?.() ?? null;
  if (!snap) return false;
  const action = tileMenuActions(ctx, snap, at).find((item) => item.label === label);
  if (!action) return false;
  if (action.promptAction) return !!ctx.prompt?.reply(snap.prompt!.promptId, { action: action.promptAction }).accepted;
  if (!ctx.intent) return false;
  if (action.pickup) {
    const grid = snap.core.player!.grid;
    if (grid.x === at.x && grid.y === at.y) return ctx.intent.submit(snap.token, { kind: "command", command: { code: "pickup" } }).accepted;
    const travel = { kind: "travel", ...at } as const;
    return ctx.intent.submit(snap.token, travel).accepted;
  }
  return !!action.intent && ctx.intent.submit(snap.token, action.intent).accepted;
}

export function finishPickup(ctx: MouseSeams, at: Grid, previous: InputSnapshot): boolean {
  if (!playerIsDriving(ctx)) return false;
  const next = ctx.snapshot?.() ?? null;
  if (!ready(next) || !next || sameToken(previous.token, next.token) || !ctx.intent) return false;
  const grid = next.core.player!.grid;
  if (grid.x !== at.x || grid.y !== at.y) return false;
  const level = ctx.knownLevel?.();
  if (!level || !sameToken(level.token, next.token) || !level.cells.some((cell) => cell.x === at.x && cell.y === at.y && cell.remembered.objects.length > 0)) return false;
  return ctx.intent.submit(next.token, { kind: "command", command: { code: "pickup" } }).accepted;
}

export function aimingPath(ctx: MouseSeams, snap: InputSnapshot | null, hovered?: Grid | null): readonly Grid[] {
  if (snap?.prompt?.kind !== "target" && snap?.prompt?.kind !== "direction") return [];
  if (snap.prompt.path) return snap.prompt.path;
  const cursor = snap.prompt.cursor ?? hovered;
  const path = cursor ? ctx.inspect?.projectionPath?.(cursor) : null;
  return path && sameToken(path.token, snap.token) ? path.grids : [];
}

export function walkingPath(ctx: MouseSeams, snap: InputSnapshot | null, hovered: Grid | null): readonly Grid[] {
  if (!ready(snap) || !snap || !hovered) return [];
  const path = ctx.inspect?.travelPath?.(hovered);
  return path && sameToken(path.token, snap.token) ? path.grids : [];
}

export function installMapMouse(ctx: MapMouseContext): () => void {
  const flags = ctx.flags;
  if (!flags["anybandui.clickToWalk"] && !flags["anybandui.dungeonActions"] && !flags["anybandui.aimPath"] && !flags["anybandui.walkRoutePreview"]) return () => {};
  if (!ctx.display || !ctx.snapshot || typeof document === "undefined" || typeof window === "undefined") { ctx.log?.("map mouse: display or snapshot unavailable"); return () => {}; }
  const display = ctx.display;
  const theme = THEMES[validateSettings(ctx.prefs?.get()).theme]!;
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Dungeon actions");
  menu.style.cssText = `display:none;position:fixed;z-index:1002;background:${theme.surface};color:${theme.text};border:1px solid ${theme.accent};border-radius:${theme.rounding}px;padding:4px`;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:49";
  document.body.append(menu, canvas);
  let menuAt: Grid | null = null;
  let menuToken: InputSnapshot["token"] | null = null;
  let menuPromptId: number | null = null;
  let pickupAt: Grid | null = null;
  let pickupSnap: InputSnapshot | null = null;
  let targetAt: Grid | null = null;
  let targetPromptId: number | null = null;
  let hovered: Grid | null = null;
  const hide = (): void => { menu.style.display = "none"; menu.replaceChildren(); menuAt = null; };
  const locate = (event: MouseEvent): Grid | null => {
    const snap = display.snapshot();
    const input = ctx.snapshot?.() ?? null;
    if (snap.mode !== "play" && !(snap.mode === "modal" && (input?.prompt?.kind === "target" || input?.prompt?.kind === "direction"))) return null;
    const grid = hoverGrid(snap, { x: event.clientX, y: event.clientY });
    return grid && grid.x < snap.level.width && grid.y < snap.level.height ? grid : null;
  };
  const onClick = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    if (menu.contains(event.target as Node)) return;
    hide();
    if (!flags["anybandui.clickToWalk"]) return;
    const at = locate(event);
    const prompt = ctx.snapshot?.()?.prompt;
    if (at && clickTile(ctx, at)) {
      if (prompt?.kind === "target") { targetAt = at; targetPromptId = prompt.promptId; }
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  const onContext = (event: MouseEvent): void => {
    hide();
    if (!flags["anybandui.dungeonActions"]) return;
    const at = locate(event), snap = ctx.snapshot?.() ?? null;
    if (!at || !snap || !playerIsDriving(ctx) || !(ready(snap) || snap.prompt?.kind === "target")) return;
    const actions = tileMenuActions(ctx, snap, at);
    if (!actions.length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    menuAt = at; menuToken = snap.token; menuPromptId = snap.prompt?.promptId ?? null;
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button"; button.setAttribute("role", "menuitem"); button.textContent = action.label;
      button.style.cssText = `display:block;width:100%;text-align:left;background:${theme.surface};color:${theme.text};border:0;padding:5px 9px;cursor:pointer`;
      button.addEventListener("click", () => {
        const current = ctx.snapshot?.() ?? null;
        if (!menuAt || !current || !menuToken || !sameToken(menuToken, current.token) || menuPromptId !== (current.prompt?.promptId ?? null)) { hide(); return; }
        const selected = menuAt;
        if (action.promptAction === "select" && current.prompt?.kind === "target") {
          if (ctx.prompt?.reply(current.prompt.promptId, { action: "move", ...selected }).accepted) {
            targetAt = selected; targetPromptId = current.prompt.promptId;
          }
        } else if (action.pickup && current.core.player && (current.core.player.grid.x !== selected.x || current.core.player.grid.y !== selected.y)) {
          if (runMenuAction(ctx, selected, action.label)) { pickupAt = selected; pickupSnap = current; }
        } else runMenuAction(ctx, selected, action.label);
        hide();
      });
      menu.appendChild(button);
    }
    menu.style.display = "block";
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - menu.offsetWidth)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - menu.offsetHeight)}px`;
    (menu.firstElementChild as HTMLElement | null)?.focus();
  };
  const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") hide(); };
  const onMove = (event: MouseEvent): void => { hovered = locate(event); };
  const render = (): void => {
    if (pickupAt && pickupSnap) {
      const next = ctx.snapshot?.() ?? null;
      if (next && !sameToken(next.token, pickupSnap.token)) { finishPickup(ctx, pickupAt, pickupSnap); pickupAt = null; pickupSnap = null; }
    }
    if (targetAt && targetPromptId !== null) {
      const next = ctx.snapshot?.()?.prompt;
      if (!next || next.kind !== "target") { targetAt = null; targetPromptId = null; }
      else if (next.promptId !== targetPromptId && next.cursor?.x === targetAt.x && next.cursor.y === targetAt.y) {
        if (playerIsDriving(ctx)) ctx.prompt?.reply(next.promptId, { action: "select" }); targetAt = null; targetPromptId = null;
      }
    }
    if (!flags["anybandui.aimPath"] && !flags["anybandui.walkRoutePreview"]) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.ceil(window.innerWidth * ratio), height = Math.ceil(window.innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
    }
    const paint = canvas.getContext("2d");
    if (!paint) return;
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.clearRect(0, 0, width, height);
    const snap = ctx.snapshot?.() ?? null;
    const path = snap?.prompt ? flags["anybandui.aimPath"] ? aimingPath(ctx, snap, hovered) : []
      : flags["anybandui.walkRoutePreview"] ? walkingPath(ctx, snap, hovered) : [];
    const view = display.snapshot();
    const rect = view.mode === "play" || (view.mode === "modal" && (snap?.prompt?.kind === "target" || snap?.prompt?.kind === "direction")) ? mapProjection(view) : null;
    if (!rect || !path.length) return;
    paint.scale(ratio, ratio); paint.beginPath(); paint.rect(rect.x, rect.y, rect.width, rect.height); paint.clip();
    paint.strokeStyle = "#f0cd64"; paint.lineWidth = 2; paint.beginPath();
    path.forEach((grid, index) => {
      const x = rect.x + (grid.x - view.viewport.origin.x + 0.5) * rect.width / view.viewport.size.width;
      const y = rect.y + (grid.y - view.viewport.origin.y + 0.5) * rect.height / view.viewport.size.height;
      if (index === 0) paint.moveTo(x, y); else paint.lineTo(x, y);
    });
    paint.stroke();
  };
  window.addEventListener("click", onClick, true);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("contextmenu", onContext, true);
  window.addEventListener("keydown", onKey);
  const timer = window.setInterval(render, 100);
  return () => { window.clearInterval(timer); window.removeEventListener("click", onClick, true); window.removeEventListener("mousemove", onMove, true); window.removeEventListener("contextmenu", onContext, true); window.removeEventListener("keydown", onKey); hide(); menu.remove(); canvas.remove(); };
}
