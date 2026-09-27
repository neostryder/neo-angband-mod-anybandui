import { describe, expect, it, vi } from "vitest";
import { aimingPath, clickIntent, clickTile, finishPickup, runMenuAction, tileMenuActions, walkIntent, walkingPath } from "./map-mouse.js";
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
  const ctx = {
    driver: () => ({ kind: "player" as const }),
    snapshot: () => snapshot,
    knownLevel: () => known,
    intent: { submit(wait, intent) { submitted.push({ token: wait, intent }); return { accepted: true }; } },
  } satisfies MouseSeams & { driver(): { kind: "player" } };
  return { ctx, submitted };
}

describe("map mouse intents", () => {
  it("walks or attacks adjacent cells through the walk command", () => {
    expect(walkIntent({ x: 5, y: 5 }, { x: 6, y: 5 })).toEqual({ kind: "command", command: { code: "walk", dir: 6 } });
    const { ctx, submitted } = fixture();
    expect(clickTile(ctx, { x: 6, y: 5 })).toBe(true);
    expect(submitted).toEqual([{ token: token(1), intent: { kind: "command", command: { code: "walk", dir: 6 } } }]);
  });
  it("stands down only when the driver read names an autoplayer", () => {
    const { ctx, submitted } = fixture();
    const autoplay = { ...ctx, driver: () => ({ kind: "controller" as const, owner: "borg" }) };
    expect(clickTile(autoplay, { x: 6, y: 5 })).toBe(false);
    expect(submitted).toEqual([]);
    const { driver: _driver, ...withoutDriver } = ctx;
    expect(clickTile(withoutDriver, { x: 6, y: 5 })).toBe(true);
    expect(submitted).toHaveLength(1);
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
    const ctx = { driver: () => ({ kind: "player" as const }), snapshot: () => ({ ...snap(), prompt: { kind: "target", promptId: 7 } }), prompt: { reply } };
    expect(clickTile(ctx, { x: 8, y: 8 })).toBe(true);
    expect(reply).toHaveBeenCalledWith(7, { action: "move", x: 8, y: 8 });
  });

  it("offers target prompt selection and cancellation", () => {
    const reply = vi.fn(() => ({ accepted: true }));
    const active = { ...snap(), prompt: { kind: "target", promptId: 7, cursor: { x: 8, y: 8 } } };
    const ctx = { driver: () => ({ kind: "player" as const }), snapshot: () => active, prompt: { reply } };
    expect(tileMenuActions(ctx, active, { x: 8, y: 8 }).map((a) => a.label)).toEqual(["Select tile", "Cancel"]);
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Cancel")).toBe(true);
    expect(reply).toHaveBeenCalledWith(7, { action: "cancel" });
  });

  it("offers only remembered pickup and safe base actions without tileActions", () => {
    const { ctx } = fixture(snap(), level());
    expect(tileMenuActions(ctx, snap(), { x: 8, y: 8 }).map((a) => a.label)).toEqual(["Walk here", "Look", "Target", "Pick up"]);
    expect(tileMenuActions({ knownLevel: () => level(2) }, snap(), { x: 8, y: 8 }).map((a) => a.label)).toEqual(["Walk here", "Look", "Target"]);
  });

  it("offers labelled engine tile actions with a direction, and never a raw code", () => {
    const { ctx, submitted } = fixture();
    const withActions: MouseSeams = { ...ctx, inspect: { tileActions: () => ({ token: token(1), codes: ["walk", "open", "fly"] }) } };
    const labels = tileMenuActions(withActions, snap(), { x: 6, y: 5 }).map((a) => a.label);
    expect(labels).toEqual(["Walk here", "Look", "Target", "Open"]);
    expect(runMenuAction(withActions, { x: 6, y: 5 }, "Open")).toBe(true);
    expect(submitted[0]?.intent).toEqual({ kind: "command", command: { code: "open", dir: 6 } });
    const onStairs: MouseSeams = { ...ctx, inspect: { tileActions: () => ({ token: token(1), codes: ["descend"] }) } };
    expect(runMenuAction(onStairs, { x: 5, y: 5 }, "Go down the stairs")).toBe(true);
    expect(submitted[1]?.intent).toEqual({ kind: "command", command: { code: "descend" } });
    const stale: MouseSeams = { ...ctx, inspect: { tileActions: () => ({ token: token(0), codes: ["open"] }) } };
    expect(tileMenuActions(stale, snap(), { x: 6, y: 5 }).map((a) => a.label)).not.toContain("Open");
  });

  it("submits menu target and look through the current token", () => {
    const { ctx, submitted } = fixture();
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Target")).toBe(true);
    expect(runMenuAction(ctx, { x: 8, y: 8 }, "Look")).toBe(true);
    expect(submitted.map((s) => s.intent)).toEqual([
      { kind: "target", x: 8, y: 8 }, { kind: "command", command: { code: "look", args: { x: 8, y: 8 } } },
    ]);
  });

  it("opens Look at the clicked grid, including the player's own grid", () => {
    const { ctx, submitted } = fixture();
    expect(runMenuAction(ctx, { x: 5, y: 5 }, "Look")).toBe(true);
    expect(submitted[0]?.intent).toEqual({ kind: "command", command: { code: "look", args: { x: 5, y: 5 } } });
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

  it("builds Shift, Ctrl and plain click intents and declines what the engine refuses", () => {
    const player = { x: 5, y: 5 };
    expect(clickIntent(player, { x: 6, y: 4 }, { shift: true })).toEqual({ kind: "travel", x: 6, y: 4, modifiers: { shift: true } });
    expect(clickIntent(player, { x: 8, y: 8 }, { shift: true })).toBeNull();
    expect(clickIntent(player, { x: 8, y: 8 }, { ctrl: true })).toEqual({ kind: "travel", x: 8, y: 8, modifiers: { ctrl: true } });
    expect(clickIntent(player, { x: 6, y: 5 }, { shift: true, ctrl: true })).toBeNull();
    expect(clickIntent(player, { x: 6, y: 5 }, { shift: false, ctrl: false })).toEqual({ kind: "command", command: { code: "walk", dir: 6 } });
    expect(clickIntent(player, { x: 8, y: 8 })).toEqual({ kind: "travel", x: 8, y: 8 });
  });

  it("runs on Shift-click and targets on Ctrl-click through the travel intent", () => {
    const { ctx, submitted } = fixture();
    expect(clickTile(ctx, { x: 4, y: 5 }, { shift: true })).toBe(true);
    expect(clickTile(ctx, { x: 9, y: 9 }, { ctrl: true })).toBe(true);
    expect(submitted.map((s) => s.intent)).toEqual([
      { kind: "travel", x: 4, y: 5, modifiers: { shift: true } },
      { kind: "travel", x: 9, y: 9, modifiers: { ctrl: true } },
    ]);
    expect(clickTile(ctx, { x: 9, y: 9 }, { shift: true })).toBe(false);
    expect(submitted).toHaveLength(2);
  });

  it("falls back to a plain click only on an engine without travel modifiers", () => {
    const seen: PlayerIntent[] = [];
    const engine = (reason: string, code?: string): MouseSeams => ({
      snapshot: () => snap(),
      intent: { submit(_wait, intent) { seen.push(intent); return intent.kind === "travel" && intent.modifiers ? { accepted: false, reason, ...(code ? { code } : {}) } : { accepted: true }; } },
    });
    expect(clickTile(engine("malformed travel destination"), { x: 6, y: 5 }, { shift: true })).toBe(true);
    expect(seen.at(-1)).toEqual({ kind: "command", command: { code: "walk", dir: 6 } });
    expect(clickTile(engine("malformed travel destination"), { x: 9, y: 9 }, { ctrl: true })).toBe(true);
    expect(seen.at(-1)).toEqual({ kind: "travel", x: 9, y: 9 });
    seen.length = 0;
    expect(clickTile(engine("run needs an adjacent grid"), { x: 6, y: 5 }, { shift: true })).toBe(false);
    expect(clickTile(engine("malformed modifiers"), { x: 9, y: 9 }, { ctrl: true })).toBe(false);
    expect(clickTile(engine("another controller holds input", "controller-owned"), { x: 9, y: 9 }, { ctrl: true })).toBe(false);
    expect(seen).toHaveLength(3);
  });

  it("treats the engine's 'not in play phase' refusal as quiet and never falls back to a plain click", () => {
    /* Engine #294 returns "input is not in play phase" for a ctrl travel
     * intent submitted outside the play phase. It is a new refusal, distinct
     * from the older "malformed travel destination" the pre-modifier engine
     * used, and the click handler must not fall back to a plain walk: doing
     * so would carry a non-play-phase intent through. */
    const seen: PlayerIntent[] = [];
    const engine: MouseSeams = {
      snapshot: () => snap(),
      intent: { submit(_wait, intent) { seen.push(intent); return { accepted: false, reason: "input is not in play phase" }; } },
    };
    expect(clickTile(engine, { x: 9, y: 9 }, { ctrl: true })).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({ kind: "travel", x: 9, y: 9, modifiers: { ctrl: true } });
  });

  it("lets an open target prompt own a modified click", () => {
    const reply = vi.fn(() => ({ accepted: true }));
    const submit = vi.fn(() => ({ accepted: true }));
    const ctx: MouseSeams = { snapshot: () => ({ ...snap(), prompt: { kind: "target", promptId: 4 } }), prompt: { reply }, intent: { submit } };
    expect(clickTile(ctx, { x: 6, y: 5 }, { shift: true })).toBe(true);
    expect(reply).toHaveBeenCalledWith(4, { action: "move", x: 6, y: 5 });
    expect(submit).not.toHaveBeenCalled();
  });
});
