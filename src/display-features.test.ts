import { describe, expect, it, vi } from "vitest";
import { anchoredOrigin, centerOn, clampOrigin, fitCellHeight, panelAutoFit, type DisplaySnapshot } from "./zoom.js";
import { drawMarker, fitView, landmarkKind, schematicColour, zoomMapAt } from "./map-overview.js";
import { hoverGrid, knownCard, snapLandmark } from "./hover-cards.js";

const snapshot: DisplaySnapshot = {
  mode: "play", grid: { cols: 80, rows: 24, cellWidth: 12, cellHeight: 18 },
  layout: "left",
  viewport: { origin: { x: 20, y: 10 }, size: { width: 60, height: 20 } },
  level: { width: 120, height: 80 }, surface: { x: 0, y: 0, width: 1200, height: 700 },
  regions: { map: { pixels: { x: 200, y: 100, width: 600, height: 400 } } },
};

describe("display geometry", () => {
  it("fits whole cells and clamps camera positions", () => {
    expect(Number.isInteger(fitCellHeight({ width: 1200, height: 700 }, 12))).toBe(true);
    expect(clampOrigin(snapshot, { x: -5.4, y: 1000 })).toEqual({ x: 0, y: 60 });
    expect(centerOn(snapshot, { x: 50, y: 30 })).toEqual({ x: 20, y: 20 });
    expect(panelAutoFit({ width: 500, height: 100 })).toBe(6);
  });

  it("keeps the same cave cell under a zoom pointer", () => {
    const after = { ...snapshot, grid: { ...snapshot.grid, cellWidth: 15, cellHeight: 22 } };
    expect(anchoredOrigin(snapshot, after, { x: 320, y: 188 })).toEqual({ x: 22, y: 10 });
    const map = zoomMapAt({ ...snapshot, mode: "map" }, 1, { x: 500, y: 300 });
    expect(map.size).toEqual({ width: 48, height: 16 });
    expect(map.origin).toEqual({ x: 26, y: 12 });
  });

  it("fits the whole floor and recognizes known landmarks", () => {
    expect(fitView(snapshot)).toEqual({ origin: { x: 0, y: 0 }, size: { width: 120, height: 80 } });
    expect(landmarkKind("LESS")).toBe("up");
    expect(landmarkKind("MORE")).toBe("down");
    expect(landmarkKind("STORE_GENERAL")).toBe("shop");
    expect(schematicColour("GRANITE")).not.toBe(schematicColour("FLOOR"));
  });

  it("draws each map marker as a filled vector path", () => {
    const g = { beginPath: vi.fn(), arc: vi.fn(), rect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      closePath: vi.fn(), fill: vi.fn(), fillText: vi.fn(), fillStyle: "" };
    for (const kind of ["player", "up", "down", "shop"] as const) drawMarker(g as unknown as CanvasRenderingContext2D, 8, 8, 4, kind);
    expect(g.arc).toHaveBeenCalledTimes(4);
    expect(g.rect).toHaveBeenCalledTimes(1);
    expect(g.fill).toHaveBeenCalledTimes(8);
    expect(g.fillText).not.toHaveBeenCalled();
  });

  it("maps pointer positions to whole cave cells", () => {
    expect(hoverGrid(snapshot, { x: 300, y: 200 })).toEqual({ x: 30, y: 15 });
    expect(hoverGrid(snapshot, { x: 100, y: 200 })).toBeNull();
    expect(snapLandmark(snapshot, { x: 305, y: 210 }, [{ x: 30, y: 15, remembered: { feat: 5 } }])).toEqual({ x: 30, y: 15 });
  });

  it("uses only the knowledge-gated look result", () => {
    const describeLookGrid = vi.fn(() => ({ text: "You recall a wall", mon: null }));
    const knownPile = vi.fn(() => []);
    expect(knownCard({ describeLookGrid, knownPile }, {}, { x: 5, y: 6 }, true)).toBe("(5, 6) - Terrain\nYou recall a wall");
    expect(describeLookGrid).toHaveBeenCalledWith({}, { x: 5, y: 6 }, 0);
  });

  it("labels hallucination and limits known items", () => {
    const core = { describeLookGrid: () => ({ text: "You see a creature", mon: { hp: 5, maxhp: 10 } }),
      knownPile: () => Array.from({ length: 7 }, () => ({ obj: {} })), describeObject: () => "a potion",
      squareApparentName: () => "floor", TMD: { IMAGE: 1, FAST: 2 } };
    const state = { actor: { player: { timed: [0, 0, 2] } } };
    const card = knownCard(core, state, { x: 1, y: 2 }, false)!;
    expect(card).toContain("[#####-----]");
    expect(card).toContain("Terrain: floor");
    expect(card.match(/Remembered: a potion/g)).toHaveLength(5);
    expect(card).toContain("More items; use Look");
    expect(knownCard(core, { actor: { player: { timed: [0, 1, 0] } } }, { x: 1, y: 2 }, false)).toContain("Appearance unreliable");
  });

});
