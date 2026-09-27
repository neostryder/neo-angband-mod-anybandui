import { describe, expect, it, vi } from "vitest";
import { aimingPath, clickTile, finishPickup, runMenuAction, tileMenuActions, walkIntent, walkingPath } from "./map-mouse.js";
import type { InputSnapshot, KnownLevel, MouseSeams, PlayerIntent } from "./seams.js";

const token = (revision: number) => ({ epoch: 1, revision });
const snap = (revision = 1, grid = { x: 5, y: 5 }): InputSnapshot => ({
  token: token(revision), phase: "play", messagePending: false, prompt: null, core: { player: { grid } },
});
const level = (revision = 1, at = { x: 8, y: 8 }): KnownLevel => ({
  token: token(revision), cells: [{ ...at, remembered: { feat: 1, objects: [{}] } }],
});
function fixture(snapshot: InputSnapshot = snap(), known: KnownLevel | null = null) {
  const submitted: { token: InputSnapshot["token"]; intent: PlayerIntent }[] = [];
  const ctx: MouseSeams = {
    snapshot: () => snapshot,
    knownLevel: () => known,
    intent: { submit(wait, intent) { submitted.push({ token: wait, intent }); return { accepted: true }; } },
  };
  return { ctx, submitted };
}

describe("map mouse intents", () => {
  it("walks or attacks adjacent cells through the walk command", () => {
    expect(walkIntent({ x: 5, y: 5 }, { x: 6, y: 5 })).toEqual({ kind: "command", command: { code: "walk", dir: 6 } });
    const { ctx, submitted } = fixture();
    expect(clickTile(ctx, { x: 6, y: 5 })).toBe(true);
    expect(submitted).toEqual([{ token: token(1), intent: { kind: "command", command: { code: "walk", dir: 6 } } }]);
  });

  it("travels to distant cells and declines missing or blocked input", () => {
    const { ctx, submitted } = fixture();
    expect(clickTile(ctx, { x: 8, y: 8 })).toBe(true);
    expect(submitted[0]?.intent).toEqual({ kind: "travel", x: 8, y: 8 });
    expect(clickTile({ ...ctx, snapshot: () => ({ ...snap(), phase: "more" }) }, { x: 8, y: 8 })).toBe(false);
    expect(clickTile({ snapshot: () => snap() }, { x: 8, y: 8 })).toBe(false);
  });

  it("moves a target prompt through its typed reply", () => {
    const reply = vi.fn(() => ({ accepted: true }));
    const ctx: MouseSeams = { snapshot: () => ({ ...snap(), prompt: { kind: "target", promptId: 7 } }), prompt: { reply } };
    expect(clickTile(ctx, { x: 8, y: 8 })).toBe(true);
    expect(reply).toHaveBeenCalledWith(7, { action: "move", x: 8, y: 8 });
  });

  it("offers target prompt selection and cancellation", () => {
    const reply = vi.fn(() => ({ accepted: true }));
    const active = { ...snap(), prompt: { kind: "target", promptId: 7, cursor: { x: 8, y: 8 } } };
    const ctx: MouseSeams = { snapshot: () => active, prompt: { reply } };
    expect(tileMenuActions(ctx, active, { x: 8, y: 8 }).map((a) => a.label)).toEqual(["Select tile", "Cancel"]);
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Cancel")).toBe(true);
    expect(reply).toHaveBeenCalledWith(7, { action: "cancel" });
  });

  it("offers only remembered pickup and safe base actions without tileActions", () => {
    const { ctx } = fixture(snap(), level());
    expect(tileMenuActions(ctx, snap(), { x: 8, y: 8 }).map((a) => a.label)).toEqual(["Walk here", "Look", "Target", "Pick up"]);
    expect(tileMenuActions({ knownLevel: () => level(2) }, snap(), { x: 8, y: 8 }).map((a) => a.label)).toEqual(["Walk here", "Look", "Target"]);
  });

  it("adds engine supplied tile actions when the optional seam is present", () => {
    const extra: PlayerIntent = { kind: "command", command: { code: "open", dir: 6 } };
    const { ctx, submitted } = fixture();
    const withActions: MouseSeams = { ...ctx, inspect: { tileActions: () => [{ label: "Open", intent: extra }] } };
    expect(tileMenuActions(withActions, snap(), { x: 8, y: 8 }).map((a) => a.label)).toContain("Open");
    expect(runMenuAction(withActions, { x: 8, y: 8 }, "Open")).toBe(true);
    expect(submitted[0]?.intent).toEqual(extra);
  });

  it("submits menu target and look through the current token", () => {
    const { ctx, submitted } = fixture();
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Target")).toBe(true);
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Look")).toBe(true);
    expect(submitted.map((s) => s.intent)).toEqual([
      { kind: "target", x: 8, y: 8 }, { kind: "command", command: { code: "look" } },
    ]);
  });

  it("travels for pickup, then checks a fresh wait, position and remembered object", () => {
    const first = snap();
    const { ctx, submitted } = fixture(first, level());
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Pick up")).toBe(true);
    expect(submitted[0]?.intent).toEqual({ kind: "travel", x: 8, y: 8 });
    expect(finishPickup(ctx, { x: 8, y: 8 }, first)).toBe(false);
    const arrived = fixture(snap(2, { x: 8, y: 8 }), level(2));
    expect(finishPickup(arrived.ctx, { x: 8, y: 8 }, first)).toBe(true);
    expect(arrived.submitted[0]).toEqual({ token: token(2), intent: { kind: "command", command: { code: "pickup" } } });
    expect(finishPickup(fixture(snap(2), level(2)).ctx, { x: 8, y: 8 }, first)).toBe(false);
  });

  it("uses prompt projection grids or an inspected path with the same token", () => {
    const prompt = { kind: "target", promptId: 3, cursor: { x: 8, y: 8 }, path: [{ x: 6, y: 6 }] };
    expect(aimingPath({}, { ...snap(), prompt })).toEqual([{ x: 6, y: 6 }]);
    const inspected: MouseSeams = { inspect: { projectionPath: () => ({ token: token(1), grids: [{ x: 7, y: 7 }] }) } };
    expect(aimingPath(inspected, { ...snap(), prompt: { kind: "target", promptId: 3, cursor: { x: 8, y: 8 } } })).toEqual([{ x: 7, y: 7 }]);
    expect(aimingPath(inspected, { ...snap(), prompt: { kind: "direction", promptId: 3 } }, { x: 8, y: 8 })).toEqual([{ x: 7, y: 7 }]);
    expect(aimingPath(inspected, snap())).toEqual([]);
  });

  it("omits walking route until its read seam exists and rejects stale results", () => {
    const at = { x: 8, y: 8 };
    expect(walkingPath({}, snap(), at)).toEqual([]);
    const route = vi.fn(() => ({ token: token(1), grids: [at] }));
    expect(walkingPath({ inspect: { travelPath: route } }, snap(), at)).toEqual([at]);
    expect(route).toHaveBeenCalledWith(at);
    expect(walkingPath({ inspect: { travelPath: route } }, snap(2), at)).toEqual([]);
  });
});
