import { describe, expect, it } from "vitest";
import type { GameState } from "@rpgm-tools/neo-angband-core";
import { hoverCardContent, hoverCardText, hoverCellAt, hoverCaveGrid, hoverCaveGridInView, HOVER_DWELL_MS, TOUCH_HOLD_MS } from "./qol-map-hover.js";
describe("qol.mapHoverCards: pixel/cell/cave geometry", () => {
  it("maps a client point to a cell, centred in a box with room to spare", () => {
    /* 800x480 box: scale = min(800/(16*80), 480/(24*24)) = min(0.625, 0.833) =
     * 0.625 -> cellW = floor(16*0.625) = 10, cellH = floor(24*0.625) = 15.
     * Grid is 80*10=800 wide (offsetX 0) and 24*15=360 tall (offsetY (480-360)/2=60). */
    const rect = { left: 100, top: 200, width: 800, height: 480 };
    expect(hoverCellAt(rect, 100, 260)).toEqual({ col: 0, row: 0 });
    expect(hoverCellAt(rect, 105, 265)).toEqual({ col: 0, row: 0 });
    expect(hoverCellAt(rect, 115, 275)).toEqual({ col: 1, row: 1 });
  });

  it("is null outside the box, including the letterboxed margin", () => {
    const rect = { left: 100, top: 200, width: 800, height: 480 };
    expect(hoverCellAt(rect, 100, 205)).toBeNull(); // inside the top margin
    expect(hoverCellAt(rect, 50, 260)).toBeNull(); // left of the canvas rect
    expect(hoverCellAt(rect, 100 + 800, 260)).toBeNull(); // past the last column
  });

  it("is null for a degenerate (zero-size) rect", () => {
    expect(hoverCellAt({ left: 0, top: 0, width: 0, height: 100 }, 0, 0)).toBeNull();
  });

  it("inverts buildOverview's scaling for a level that fits the box", () => {
    /* width=40,height=20 both fit under TERM_COLS-2=78 / TERM_ROWS-2=22, so the
     * box IS the level 1:1 (mapW=40, mapH=20) - screen cell (c+1, r+1) is
     * exactly cave (c, r). */
    expect(hoverCaveGrid(1, 1, 40, 20)).toEqual({ x: 0, y: 0 });
    expect(hoverCaveGrid(40, 20, 40, 20)).toEqual({ x: 39, y: 19 });
  });

  it("is null on the border or outside the box", () => {
    expect(hoverCaveGrid(0, 1, 40, 20)).toBeNull(); // left border column
    expect(hoverCaveGrid(1, 0, 40, 20)).toBeNull(); // top border row
    expect(hoverCaveGrid(41, 1, 40, 20)).toBeNull(); // past the level's own width
  });

  it("is null off a zero-size level", () => {
    expect(hoverCaveGrid(1, 1, 0, 20)).toBeNull();
  });

  it("picks a representative cave cell when several collapse onto one screen cell", () => {
    /* width=200 > TERM_COLS-2=78, so mapW=78 and several cave columns share a
     * screen column. Screen col 1 (bx=0) covers the bucket floor(x*78/200)=0,
     * i.e. cave x in [0, 2]; this picks the bucket's centre. */
    const grid = hoverCaveGrid(1, 1, 200, 20);
    expect(grid).not.toBeNull();
    expect(grid!.x).toBeGreaterThanOrEqual(0);
    expect(grid!.x).toBeLessThan(3);
  });

  it("inverts buckets inside a zoomed and panned map window", () => {
    expect(
      hoverCaveGridInView(0, 0, 20, 10, { x: 40, y: 12 }, { width: 40, height: 20 }),
    ).toEqual({ x: 41, y: 13 });
    expect(
      hoverCaveGridInView(19, 9, 20, 10, { x: 40, y: 12 }, { width: 40, height: 20 }),
    ).toEqual({ x: 79, y: 31 });
    expect(
      hoverCaveGridInView(20, 9, 20, 10, { x: 40, y: 12 }, { width: 40, height: 20 }),
    ).toBeNull();
  });
});

describe("qol.mapHoverCards: context-sensitive content", () => {
  const grid = { x: 5, y: 5 };

  it("keeps the published dwell and hold timings", () => {
    expect(HOVER_DWELL_MS).toBe(2000);
    expect(TOUCH_HOLD_MS).toBe(1000);
  });

  it("shows terrain for plain ground", () => {
    const core = {
      describeLookGrid: () => ({ text: "You see a granite wall.", mon: null }),
      knownPile: () => [],
    };
    expect(hoverCardContent(core, {} as GameState, grid)).toEqual({
      kind: "terrain",
      title: "Terrain",
      text: "You see a granite wall.",
    });
    expect(hoverCardText(core, {} as GameState, grid)).toBe("You see a granite wall.");
  });

  it("labels an obvious monster as a creature", () => {
    const core = {
      describeLookGrid: () => ({
        text: "You see a wounded jackal, 3 S, 1 W of you.",
        mon: { name: "jackal" },
      }),
      knownPile: () => [],
    };
    expect(hoverCardContent(core, {} as GameState, grid)).toEqual({
      kind: "creature",
      title: "Creature",
      text: "You see a wounded jackal, 3 S, 1 W of you.",
    });
  });

  it("labels a remembered floor object as an item", () => {
    const core = {
      describeLookGrid: () => ({ text: "You see a Dagger, 2 S of you.", mon: null }),
      knownPile: () => [{ kind: "dagger" }],
    };
    expect(hoverCardContent(core, {} as GameState, grid)).toEqual({
      kind: "item",
      title: "Item",
      text: "You see a Dagger, 2 S of you.",
    });
  });

  it("labels the player's own grid as character", () => {
    const core = {
      describeLookGrid: () => ({ text: "You are on an open floor.", mon: null }),
      knownPile: () => [],
    };
    const state = { actor: { grid: { x: 5, y: 5 } } } as unknown as GameState;
    expect(hoverCardContent(core, state, grid)?.kind).toBe("character");
  });

  it("labels a shop entrance when the feature carries a shopnum", () => {
    const core = {
      describeLookGrid: () => ({ text: "You see the General Store.", mon: null }),
      knownPile: () => [],
    };
    const state = {
      chunk: { width: 10, height: 10, feature: () => ({ shopnum: 1 }) },
    } as unknown as GameState;
    expect(hoverCardContent(core, state, grid)?.kind).toBe("shop");
  });

  it("labels a visible trap when the engine exposes the predicate", () => {
    const core = {
      describeLookGrid: () => ({ text: "You see a pit trap.", mon: null }),
      knownPile: () => [],
      squareIsVisibleTrap: () => true,
    };
    expect(hoverCardContent(core, {} as GameState, grid)?.kind).toBe("trap");
  });

  it("returns null when the look API has nothing to say", () => {
    const core = {
      describeLookGrid: () => ({ text: "  ", mon: null }),
      knownPile: () => [],
    };
    expect(hoverCardContent(core, {} as GameState, grid)).toBeNull();
  });
});
