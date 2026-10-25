import { afterEach, describe, expect, it, vi } from "vitest";
import { installMinimapTravel, mapTarget, TRAVEL_WAIT_MS } from "./minimap-travel.js";
import type { InputDriver, InputSnapshot, KnownLevel, PlayerIntent } from "./seams.js";
import type { DisplaySnapshot } from "./zoom.js";

const token = { epoch: 1, revision: 1 };
// A 20 by 20 level drawn ten pixels to the square, so the point (85, 85) is the square (8, 8).
const display = (mode: DisplaySnapshot["mode"]): DisplaySnapshot => ({
  mode, grid: { cols: 80, rows: 24, cellWidth: 10, cellHeight: 10 }, viewport: { origin: { x: 0, y: 0 }, size: { width: 20, height: 20 } },
  level: { width: 20, height: 20 }, layout: "left", regions: { map: { pixels: { x: 0, y: 0, width: 200, height: 200 } } },
}) as unknown as DisplaySnapshot;
const level = (feat = 1): KnownLevel => ({ token, levelId: 1, depth: 1, width: 20, height: 20,
  cells: [{ x: 8, y: 8, visible: false, remembered: { feat, traps: [], objects: [] } }] }) as unknown as KnownLevel;
const input = (phase: InputSnapshot["phase"] = "play"): InputSnapshot => ({ token, phase, messagePending: false, prompt: null, core: { player: { grid: { x: 2, y: 2 } } } });

describe("the map square under a click", () => {
  it("is a remembered square other than the character's own", () => {
    expect(mapTarget(display("map"), { x: 85, y: 85 }, level(), { x: 2, y: 2 })).toEqual({ x: 8, y: 8 });
    expect(mapTarget(display("map"), { x: 85, y: 85 }, level(), { x: 8, y: 8 })).toBeNull();
    expect(mapTarget(display("map"), { x: 85, y: 85 }, level(0), { x: 2, y: 2 })).toBeNull();
    expect(mapTarget(display("map"), { x: 15, y: 85 }, level(), { x: 2, y: 2 })).toBeNull();
    expect(mapTarget(display("play"), { x: 85, y: 85 }, level(), { x: 2, y: 2 })).toBeNull();
    expect(mapTarget(display("map"), { x: 85, y: 85 }, null, { x: 2, y: 2 })).toBeNull();
  });
});

describe("minimap travel", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  function setup(flags: Record<string, boolean> = { "anybandui.minimapTravel": true }) {
    vi.useFakeTimers();
    let onDown: ((event: PointerEvent) => void) | null = null;
    const removed = vi.fn();
    vi.stubGlobal("window", { addEventListener: (_type: string, fn: (event: PointerEvent) => void) => { onDown = fn; }, removeEventListener: removed });
    const state = { mode: "map" as DisplaySnapshot["mode"], phase: "modal" as InputSnapshot["phase"], driver: { kind: "player" } as InputDriver };
    const submitted: PlayerIntent[] = [];
    const cleanup = installMinimapTravel({ flags, display: { snapshot: () => display(state.mode) }, snapshot: () => input(state.phase), knownLevel: () => level(),
      intent: { submit: (_wait, intent) => { submitted.push(intent); return { accepted: true }; } }, driver: () => state.driver, log: () => {} });
    const press = (x = 85, y = 85, button = 0) => onDown?.({ button, clientX: x, clientY: y } as PointerEvent);
    const close = () => { state.mode = "play"; state.phase = "play"; };
    return { state, submitted, cleanup, press, close, removed, listening: () => onDown !== null };
  }

  it("travels to the clicked square once the map has closed", () => {
    const { submitted, press, close, cleanup, removed } = setup();
    press();
    vi.advanceTimersByTime(200);
    expect(submitted).toEqual([]);
    close();
    vi.advanceTimersByTime(60);
    expect(submitted).toEqual([{ kind: "travel", x: 8, y: 8 }]);
    vi.advanceTimersByTime(500);
    expect(submitted).toHaveLength(1);
    cleanup();
    expect(removed).toHaveBeenCalled();
  });

  it("does nothing for a right click, an unseen square, or a map left open too long", () => {
    const { submitted, press, close } = setup();
    press(85, 85, 2);
    press(15, 85);
    close();
    vi.advanceTimersByTime(500);
    expect(submitted).toEqual([]);
    const second = setup();
    second.press();
    vi.advanceTimersByTime(TRAVEL_WAIT_MS + 100);
    second.close();
    vi.advanceTimersByTime(500);
    expect(second.submitted).toEqual([]);
  });

  it("stands down while an autoplayer holds the keyboard", () => {
    const { state, submitted, press, close } = setup();
    state.driver = { kind: "controller", owner: "squire" };
    press();
    close();
    vi.advanceTimersByTime(500);
    expect(submitted).toEqual([]);
    state.driver = { kind: "player" };
    state.mode = "map"; state.phase = "modal";
    press();
    state.driver = { kind: "controller", owner: "borg" };
    close();
    vi.advanceTimersByTime(500);
    expect(submitted).toEqual([]);
  });

  it("listens to nothing with its switch off", () => {
    const { listening } = setup({});
    expect(listening()).toBe(false);
  });
});
