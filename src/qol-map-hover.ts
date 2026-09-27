import type { GameState } from "@rpgm-tools/neo-angband-core";
import { bitmapTextBlock, wrapBitmapParagraphs, wrapBitmapText } from "./bitmap-text.js";
import { twoFingerGestureActive, type DisplayLike } from "./zoom.js";

interface HoverContext {
  readonly flags: Readonly<Record<string, boolean>>;
  readonly core: unknown;
  readonly state?: GameState;
  readonly display?: DisplayLike;
}
/*
 * "Hover cards on the Map overview" (anybandui.mapHoverCards): inspect one cell of
 * the (M)ap overview without leaving it.
 *
 * WHAT IT SHOWS. Every resolvable cave cell: terrain, creature, item, trap,
 * shop entrance, or the player's own grid. Text comes from describeLookGrid
 * (the same knowledge gate as the main-screen look command). The card also
 * tries to show a magnified tile snapshot cropped from the graphics overview
 * overlay when one is mounted, otherwise a magnified sample of the terminal
 * cell on #game.
 *
 * INPUT. Mouse: dwell on one grid for HOVER_DWELL_MS, then show; leaving that
 * grid closes the card. Touch/pen: hold one grid for TOUCH_HOLD_MS, then show;
 * the card stays until a tap elsewhere. Both paths stop the overview's own
 * window-capture pointerdown dismiss while the pointer is over a map cell, so
 * a click or hold inspects instead of closing the map (keys still dismiss).
 *
 * WHY THIS IS RAW DOM RATHER THAN A `regions()` DECLARATION. A mod's own
 * declared region only paints while the shell's main render loop runs, and
 * the (M)ap overview holds the terminal without going through it - core
 * draws the box once (paintLevelMapOnTerminal, overlay.ts) and does not
 * repaint on mouse movement, so a region's `paint()` never fires while the
 * overview is open. The overview's own dismiss handlers are raw
 * `window`/`document` listeners for the same reason - this mirrors that, the
 * way neo-angband-mod-forge's own overlay does for the same class of problem.
 * No manifest capability gates this: none exists for it, by that same mod's
 * own reasoning ("a ui:dom.overlay capability would add a consent string and
 * no containment").
 *
 * WHY "IS THE OVERVIEW OPEN" IS A GUESS. Nothing in the mod ABI publishes
 * which screen is currently on top - only `frontend()` (a full renderer
 * replacement, wildly disproportionate to a hover card) ever sees that. This
 * arms on an 'M' keydown and disarms on any other key (the overview's key
 * dismiss) or on a pointerdown outside the map box. A player who types a
 * capital M elsewhere (naming a character) can arm this briefly; nothing is
 * drawn unless the pointer also resolves to a cave grid.
 *
 * WHY THE PIXEL<->CELL MATH IS REPLICATED RATHER THAN IMPORTED. A mod
 * cannot import packages/web (only packages/core, and only for types) - the
 * game's own `GlyphTerm.cellAt` (term.ts) is unreachable. The formula below
 * mirrors its FIXED-mode branch (term.ts `fitFixed`/`cellAt`): the terminal
 * is TERM_COLS x TERM_ROWS and the default bitmap glyph is GLYPH_W x GLYPH_H.
 */

/** term.ts FIXED_COLS/FIXED_ROWS - the game's terminal grid. */
const TERM_COLS = 80;
const TERM_ROWS = 24;
/** font-16x24.ts FONT_16X24 - the default bitmap glyph's native pixel size. */
const GLYPH_W = 16;
const GLYPH_H = 24;
/** Mouse dwell before a card opens (ms). */
export const HOVER_DWELL_MS = 2000;
/** Touch/pen hold before a card opens (ms). */
export const TOUCH_HOLD_MS = 1000;
/** Magnified tile preview edge length inside the card (CSS px). */
const TILE_PREVIEW_PX = 64;

/** A plain rectangle, the shape `Element.getBoundingClientRect()` answers -
 * spelled out so this stays testable without a real DOM element. */
interface ClientRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function pointInRect(
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

/**
 * Client-space pixel -> character-grid cell, mirroring `GlyphTerm.cellAt`'s
 * fixed-mode formula (term.ts): the largest uniformly-scaled glyph that fits
 * the box, centred (letterboxed). Null outside the grid.
 */
export function hoverCellAt(
  rect: ClientRectLike,
  clientX: number,
  clientY: number,
): { readonly col: number; readonly row: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scale = Math.min(rect.width / (GLYPH_W * TERM_COLS), rect.height / (GLYPH_H * TERM_ROWS));
  const cellW = Math.max(4, Math.floor(GLYPH_W * scale));
  const cellH = Math.max(6, Math.floor(GLYPH_H * scale));
  const offsetX = Math.max(0, Math.floor((rect.width - cellW * TERM_COLS) / 2));
  const offsetY = Math.max(0, Math.floor((rect.height - cellH * TERM_ROWS) / 2));
  const col = Math.floor((clientX - rect.left - offsetX) / cellW);
  const row = Math.floor((clientY - rect.top - offsetY) / cellH);
  if (col < 0 || col >= TERM_COLS || row < 0 || row >= TERM_ROWS) return null;
  return { col, row };
}

/**
 * The (M)ap overview's own box: a 1-cell '+'-cornered border (window_make,
 * ui-output.c) around min(TERM_COLS-2, width) x min(TERM_ROWS-2, height)
 * content cells (see this game's overlay.ts paintLevelMapOnTerminal and
 * mapview.ts buildOverview, whose scaling this inverts). Screen cell
 * (col, row) -> the cave grid it stands for; null on the border, outside the
 * box, or off a level too small to fill it.
 */
export function hoverCaveGrid(
  col: number,
  row: number,
  width: number,
  height: number,
): { readonly x: number; readonly y: number } | null {
  if (width < 1 || height < 1) return null;
  const mapW = Math.min(TERM_COLS - 2, width);
  const mapH = Math.min(TERM_ROWS - 2, height);
  if (mapW < 1 || mapH < 1) return null;
  const bx = col - 1;
  const by = row - 1;
  if (bx < 0 || bx >= mapW || by < 0 || by >= mapH) return null;
  /* buildOverview scales cave (x,y) to floor(x*mapW/width), floor(y*mapH/height)
   * - several cave cells can land on one screen cell. This inverts it by
   * taking the CENTRE of the bucket that would have scaled here, which is
   * exact when the level fits the box and a representative pick otherwise. */
  return hoverCaveGridInView(
    bx,
    by,
    mapW,
    mapH,
    { x: 0, y: 0 },
    { width, height },
  );
}

/** Invert one visible map bucket into its current cave-space window. */
export function hoverCaveGridInView(
  bucketX: number,
  bucketY: number,
  mapCols: number,
  mapRows: number,
  origin: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } | null {
  if (
    mapCols < 1 ||
    mapRows < 1 ||
    size.width < 1 ||
    size.height < 1 ||
    bucketX < 0 ||
    bucketY < 0 ||
    bucketX >= mapCols ||
    bucketY >= mapRows
  ) return null;
  return {
    x: origin.x + Math.min(size.width - 1, Math.floor(((bucketX + 0.5) * size.width) / mapCols)),
    y: origin.y + Math.min(size.height - 1, Math.floor(((bucketY + 0.5) * size.height) / mapRows)),
  };
}

/** What kind of content the card is describing. */
export type HoverCardKind =
  | "character"
  | "creature"
  | "item"
  | "trap"
  | "shop"
  | "terrain";

export interface HoverCardContent {
  readonly kind: HoverCardKind;
  readonly text: string;
  readonly title: string;
}

/** The subset of ctx.core this feature calls, structurally - see this file's
 * header on why a mod names what it touches rather than importing the whole
 * shape for a cast. Public exports of the engine (game/target-loop.ts,
 * game/known.ts); trap/feature helpers are optional so an older engine still
 * gets text, just with coarser kind labels. */
interface LookApi {
  describeLookGrid(
    state: GameState,
    grid: { x: number; y: number },
    mode: number,
  ): { text: string; mon: unknown };
  knownPile(state: GameState, grid: { x: number; y: number }): readonly unknown[];
  squareIsVisibleTrap?(state: GameState, grid: { x: number; y: number }): boolean;
}

/** Live state fields the card classifier reads beyond describeLookGrid. */
interface HoverState {
  readonly actor?: { readonly grid?: { readonly x: number; readonly y: number } };
  readonly chunk?: {
    readonly width: number;
    readonly height: number;
    feature?(grid: { x: number; y: number }): { shopnum?: number };
  };
}

const KIND_TITLE: Readonly<Record<HoverCardKind, string>> = {
  character: "Character",
  creature: "Creature",
  item: "Item",
  trap: "Trap",
  shop: "Shop",
  terrain: "Terrain",
};

/**
 * Context-sensitive card content for one cave grid. Always knowledge-gated
 * through describeLookGrid. Returns null only when the look API answers with
 * an empty string (nothing known / nothing to say).
 */
export function hoverCardContent(
  core: LookApi,
  state: HoverState & GameState,
  grid: { x: number; y: number },
): HoverCardContent | null {
  const result = core.describeLookGrid(state, grid, 0);
  const text = result?.text?.trim() ?? "";
  if (!text) return null;

  const player = state.actor?.grid;
  let kind: HoverCardKind;
  if (player && player.x === grid.x && player.y === grid.y) {
    kind = "character";
  } else if (result.mon) {
    kind = "creature";
  } else if (core.knownPile(state, grid).length > 0) {
    kind = "item";
  } else if (core.squareIsVisibleTrap?.(state, grid)) {
    kind = "trap";
  } else if ((state.chunk?.feature?.(grid)?.shopnum ?? 0) > 0) {
    kind = "shop";
  } else {
    kind = "terrain";
  }
  return { kind, text, title: KIND_TITLE[kind] };
}

/**
 * Back-compat text helper: the card body string, or null when there is none.
 * Prefer hoverCardContent when the kind label matters.
 */
export function hoverCardText(
  core: LookApi,
  state: GameState,
  grid: { x: number; y: number },
): string | null {
  return hoverCardContent(core, state, grid)?.text ?? null;
}

let hoverCardsWired = false;

/** Style + position the card element, clamped to the viewport, near the
 * cursor rather than exactly under it (so the cursor is not hidden by it). */
function positionHoverCard(el: HTMLElement, clientX: number, clientY: number): void {
  const GAP = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = clientX + GAP;
  let top = clientY + GAP;
  if (left + w > vw) left = clientX - GAP - w;
  if (top + h > vh) top = clientY - GAP - h;
  el.style.left = `${String(Math.max(0, left))}px`;
  el.style.top = `${String(Math.max(0, top))}px`;
}

const HOVER_CARD_CELL_HEIGHT = 14;
const HOVER_CARD_CELL_WIDTH = HOVER_CARD_CELL_HEIGHT * (16 / 24);
/* The card's own maxWidth (360px) less its padding (2*10px), the tile
 * preview column (TILE_PREVIEW_PX) and the row gap (10px) - a rough budget
 * for wrapping the body text next to the preview image. The title runs the
 * full card width instead, above that row. */
const HOVER_CARD_BODY_MAX_CHARS = Math.max(
  10,
  Math.floor((360 - 20 - TILE_PREVIEW_PX - 10) / HOVER_CARD_CELL_WIDTH),
);
const HOVER_CARD_TITLE_MAX_CHARS = Math.max(10, Math.floor((360 - 20) / HOVER_CARD_CELL_WIDTH));

/** Repaint one hover-card container (title or body) with bitmap-blitted
 * text, replacing whatever it held from the last cell the player hovered. */
function paintHoverCardText(
  container: HTMLElement,
  text: string,
  css: string,
  maxChars: number,
  multiParagraph: boolean,
): void {
  const lines = multiParagraph ? wrapBitmapParagraphs(text, maxChars) : wrapBitmapText(text, maxChars);
  container.replaceChildren(
    bitmapTextBlock(
      lines.map((line) => [{ text: line, css }]),
      HOVER_CARD_CELL_WIDTH,
      HOVER_CARD_CELL_HEIGHT,
      window.devicePixelRatio || 1,
    ),
  );
}

function buildHoverCardElement(): {
  root: HTMLDivElement;
  title: HTMLDivElement;
  img: HTMLCanvasElement;
  body: HTMLDivElement;
} {
  const root = document.createElement("div");
  root.setAttribute("data-anybandui-map-hover-card", "");
  Object.assign(root.style, {
    position: "fixed",
    zIndex: "2100",
    pointerEvents: "none",
    display: "none",
    maxWidth: "360px",
    padding: "8px 10px",
    borderRadius: "6px",
    background: "rgba(12,12,16,0.94)",
    border: "1px solid #777",
    boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
  });

  /* No `font`/colour rules on title/body any more: their content is now a
   * bitmap-blitted canvas (see bitmap-text.ts and paintHoverCardText below),
   * matching the font the game itself draws with instead of a system one
   * (#197, #199). Each is a plain container repainted on every hover move. */
  const title = document.createElement("div");
  title.style.marginBottom = "6px";

  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  });

  const img = document.createElement("canvas");
  img.width = TILE_PREVIEW_PX;
  img.height = TILE_PREVIEW_PX;
  Object.assign(img.style, {
    width: `${String(TILE_PREVIEW_PX)}px`,
    height: `${String(TILE_PREVIEW_PX)}px`,
    imageRendering: "pixelated",
    flex: "0 0 auto",
    background: "#000",
    border: "1px solid #555",
  });

  const body = document.createElement("div");
  Object.assign(body.style, {
    flex: "1 1 auto",
    minWidth: "0",
  });

  row.appendChild(img);
  row.appendChild(body);
  root.appendChild(title);
  root.appendChild(row);
  document.body.appendChild(root);
  return { root, title, img, body };
}

/**
 * Crop one cave cell from the graphics overview overlay (overlay.ts
 * mountGraphicsOverview) when present; otherwise sample the matching
 * terminal cell from #game. Returns false when neither source has pixels.
 */
function paintTilePreview(
  canvas: HTMLCanvasElement,
  grid: { x: number; y: number },
  termCell: { col: number; row: number } | null,
  view: {
    origin: { readonly x: number; readonly y: number };
    size: { readonly width: number; readonly height: number };
  },
  termSize: { readonly cols: number; readonly rows: number },
): boolean {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return false;
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  const overlays = Array.from(
    document.querySelectorAll<HTMLCanvasElement>('body > canvas[aria-hidden="true"]'),
  );
  for (const src of overlays) {
    if (src === canvas || src.id === "game") continue;
    if (src.width < 1 || src.height < 1) continue;
    if (view.size.width < 1 || view.size.height < 1) continue;
    const cellW = src.width / view.size.width;
    const cellH = src.height / view.size.height;
    if (cellW < 1 || cellH < 1) continue;
    const sourceX = grid.x - view.origin.x;
    const sourceY = grid.y - view.origin.y;
    if (sourceX < 0 || sourceY < 0 || sourceX >= view.size.width || sourceY >= view.size.height) {
      continue;
    }
    try {
      ctx2d.drawImage(
        src,
        sourceX * cellW,
        sourceY * cellH,
        cellW,
        cellH,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      return true;
    } catch {
      /* Cross-origin or zero-size draw - try the next source. */
    }
  }

  const game = document.getElementById("game");
  if (!(game instanceof HTMLCanvasElement) || !termCell) return false;
  if (game.width < 1 || game.height < 1) return false;
  const cellW = game.width / termSize.cols;
  const cellH = game.height / termSize.rows;
  if (cellW < 1 || cellH < 1) return false;
  try {
    ctx2d.drawImage(
      game,
      termCell.col * cellW,
      termCell.row * cellH,
      cellW,
      cellH,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Wire the feature up, once, for the lifetime of this page - see this
 * section's header for why register() (which sees ctx.state) rather than
 * hooks() (which never does).
 */
export function installMapHoverCards(ctx: HoverContext): () => void {
  if (ctx.flags["anybandui.mapHoverCards"] !== true) return () => {};
  if (hoverCardsWired) return () => {};
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  if (!ctx.core || typeof (ctx.core as Partial<LookApi>).describeLookGrid !== "function" ||
      typeof (ctx.core as Partial<LookApi>).knownPile !== "function") return () => {};
  hoverCardsWired = true;
  const abort = new AbortController();

  const core = ctx.core as unknown as LookApi;
  const card = buildHoverCardElement();
  let mapOpenGuess = false;
  let touchPinned = false;
  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let dwellGridKey: string | null = null;
  let holdPointerId: number | null = null;
  let shownGridKey: string | null = null;
  let lastClientX = 0;
  let lastClientY = 0;

  const gridKey = (g: { x: number; y: number }): string => `${String(g.x)},${String(g.y)}`;

  const clearDwell = (): void => {
    if (dwellTimer !== null) clearTimeout(dwellTimer);
    dwellTimer = null;
    dwellGridKey = null;
  };

  const clearHold = (): void => {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    holdPointerId = null;
  };

  const hide = (): void => {
    card.root.style.display = "none";
    shownGridKey = null;
    touchPinned = false;
  };

  const resolveCaveGrid = (
    clientX: number,
    clientY: number,
  ): {
    grid: { x: number; y: number };
    cell: { col: number; row: number };
    view: {
      origin: { x: number; y: number };
      size: { width: number; height: number };
    };
    termSize: { cols: number; rows: number };
  } | null => {
    const game = document.getElementById("game");
    if (!game) return null;
    const state = ctx.state as unknown as (HoverState & GameState) | undefined;
    const chunk = state?.chunk;
    if (!chunk || chunk.width < 1 || chunk.height < 1) return null;
    const snapshot = ctx.display?.snapshot();
    if (snapshot?.mode === "map") {
      const region = snapshot.regions.map;
      const pixels = region?.pixels;
      const cells = region?.cells;
      if (!pixels || !cells) return null;

      const view = {
        origin: { x: snapshot.viewport.origin.x, y: snapshot.viewport.origin.y },
        size: { width: snapshot.viewport.size.width, height: snapshot.viewport.size.height },
      };
      let projection = pixels;
      let mapCols = cells.cols;
      let mapRows = cells.rows;
      const graphics = Array.from(
        document.querySelectorAll<HTMLCanvasElement>('body > canvas[aria-hidden="true"]'),
      ).filter((candidate) => candidate !== card.img && candidate.id !== "game");
      if (graphics.length > 0) {
        const rect = graphics[graphics.length - 1]!.getBoundingClientRect();
        projection = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
        mapCols = view.size.width;
        mapRows = view.size.height;
      }
      if (!pointInRect(projection, clientX, clientY) || projection.width <= 0 || projection.height <= 0) {
        return null;
      }
      const bucketX = Math.floor(((clientX - projection.x) * mapCols) / projection.width);
      const bucketY = Math.floor(((clientY - projection.y) * mapRows) / projection.height);
      const grid = hoverCaveGridInView(
        bucketX,
        bucketY,
        mapCols,
        mapRows,
        view.origin,
        view.size,
      );
      if (!grid) return null;
      const regionCol = Math.max(0, Math.min(cells.cols - 1,
        Math.floor(((clientX - pixels.x) * cells.cols) / pixels.width)));
      const regionRow = Math.max(0, Math.min(cells.rows - 1,
        Math.floor(((clientY - pixels.y) * cells.rows) / pixels.height)));
      return {
        grid,
        cell: { col: cells.col + regionCol, row: cells.row + regionRow },
        view,
        termSize: { cols: snapshot.grid.cols, rows: snapshot.grid.rows },
      };
    }

    const cell = hoverCellAt(game.getBoundingClientRect(), clientX, clientY);
    if (!cell) return null;
    const grid = hoverCaveGrid(cell.col, cell.row, chunk.width, chunk.height);
    if (!grid) return null;
    return {
      grid,
      cell,
      view: { origin: { x: 0, y: 0 }, size: { width: chunk.width, height: chunk.height } },
      termSize: { cols: TERM_COLS, rows: TERM_ROWS },
    };
  };

  const showAt = (
    clientX: number,
    clientY: number,
    resolved: {
      grid: { x: number; y: number };
      cell: { col: number; row: number };
      view: {
        origin: { x: number; y: number };
        size: { width: number; height: number };
      };
      termSize: { cols: number; rows: number };
    },
  ): boolean => {
    const state = ctx.state as unknown as (HoverState & GameState) | undefined;
    if (!state) return false;
    const content = hoverCardContent(core, state, resolved.grid);
    if (!content) return false;
    paintHoverCardText(card.title, content.title, "#f0d878", HOVER_CARD_TITLE_MAX_CHARS, false);
    paintHoverCardText(card.body, content.text, "#e8e8e8", HOVER_CARD_BODY_MAX_CHARS, true);
    const painted = paintTilePreview(
      card.img,
      resolved.grid,
      resolved.cell,
      resolved.view,
      resolved.termSize,
    );
    card.img.style.display = painted ? "block" : "none";
    card.root.style.display = "block";
    positionHoverCard(card.root, clientX, clientY);
    shownGridKey = gridKey(resolved.grid);
    return true;
  };

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "M") {
      mapOpenGuess = true;
      return;
    }
    mapOpenGuess = false;
    clearDwell();
    clearHold();
    hide();
  }, { signal: abort.signal });

  /*
   * Capture-phase, registered at boot: runs BEFORE the overview's own
   * window-capture pointerdown dismiss (which is added when M opens). Stopping
   * that dismiss while the pointer is over a map cell is what makes hover/hold
   * usable; a tap outside the box still closes the map.
   */
  window.addEventListener(
    "pointerdown",
    (ev: PointerEvent) => {
      if (ctx.display?.snapshot().mode !== "map" && !mapOpenGuess) return;
      const resolved = resolveCaveGrid(ev.clientX, ev.clientY);

      if (touchPinned) {
        const same =
          resolved !== null && shownGridKey !== null && gridKey(resolved.grid) === shownGridKey;
        if (same) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          return;
        }
        hide();
        clearHold();
        if (!resolved) {
          mapOpenGuess = false;
          return;
        }
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (ev.pointerType === "touch" || ev.pointerType === "pen") {
          holdPointerId = ev.pointerId;
          const atDown = resolved;
          holdTimer = setTimeout(() => {
            holdTimer = null;
            if (twoFingerGestureActive()) return;
            if (showAt(ev.clientX, ev.clientY, atDown)) touchPinned = true;
          }, TOUCH_HOLD_MS);
        }
        return;
      }

      if (!resolved) {
        mapOpenGuess = false;
        clearDwell();
        clearHold();
        hide();
        return;
      }

      ev.preventDefault();
      ev.stopImmediatePropagation();
      clearDwell();

      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        clearHold();
        holdPointerId = ev.pointerId;
        const atDown = resolved;
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (twoFingerGestureActive()) return;
          if (showAt(ev.clientX, ev.clientY, atDown)) touchPinned = true;
        }, TOUCH_HOLD_MS);
      }
    },
    { capture: true, signal: abort.signal },
  );

  window.addEventListener("pointerup", (ev: PointerEvent) => {
    if (holdPointerId !== null && ev.pointerId === holdPointerId && holdTimer !== null) {
      clearHold();
    }
  }, { signal: abort.signal });
  window.addEventListener("pointercancel", (ev: PointerEvent) => {
    if (holdPointerId !== null && ev.pointerId === holdPointerId) clearHold();
  }, { signal: abort.signal });

  document.addEventListener("pointermove", (ev: PointerEvent) => {
    if (ctx.display?.snapshot().mode !== "map" && !mapOpenGuess) return;
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    if (ev.pointerType === "touch" || ev.pointerType === "pen") {
      if (holdTimer !== null && holdPointerId === ev.pointerId) {
        const resolved = resolveCaveGrid(ev.clientX, ev.clientY);
        if (!resolved) clearHold();
      }
      return;
    }
    if (touchPinned) return;

    const resolved = resolveCaveGrid(ev.clientX, ev.clientY);
    if (!resolved) {
      clearDwell();
      if (shownGridKey !== null) hide();
      return;
    }
    const key = gridKey(resolved.grid);
    if (shownGridKey === key) {
      positionHoverCard(card.root, ev.clientX, ev.clientY);
      return;
    }
    if (shownGridKey !== null) hide();
    if (dwellGridKey === key) return;
    clearDwell();
    dwellGridKey = key;
    dwellTimer = setTimeout(() => {
      dwellTimer = null;
      const still = resolveCaveGrid(lastClientX, lastClientY);
      if (!still || gridKey(still.grid) !== key) return;
      showAt(lastClientX, lastClientY, still);
    }, HOVER_DWELL_MS);
  }, { signal: abort.signal });
  return () => {
    abort.abort();
    clearDwell();
    clearHold();
    card.root.remove();
    hoverCardsWired = false;
  };
}

