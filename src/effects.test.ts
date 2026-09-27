import { describe, expect, it } from "vitest";
import { actorGrid, chooseEffectMotion, eventCue, effectGrids, healthIntensity } from "./effects.js";
import type { EffectSnapshot } from "./seams.js";
const flags = ["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.presenceHaze", "anybandui.spellEffects"];
describe("phase 7 effects", () => {
  it("selects visible sleeping, unique and known artifact grids", () => {
    const s = { core: { monsters: [{ id: 1, race: "Morgoth, Lord of Darkness", raceIndex: 1, grid: {x:2,y:3}, visible: true, hp: 4, maxHp: 4, asleep: true, level: 100, raceFlags: ["UNIQUE"] }] } } as unknown as EffectSnapshot;
    expect(effectGrids(s, { token: {epoch:1,revision:1}, cells: [{x:4,y:5,remembered:{feat:1,objects:[{artifact:true}]}}] })).toEqual({ asleep:[{x:2,y:3}], uniques:[{x:2,y:3}], artifacts:[{x:4,y:5}] });
  });
  it("uses warning tenths and the 30 percent fallback", () => {
    expect(healthIntensity(30,100,3)).toBeCloseTo(.12); expect(healthIntensity(30,100,undefined)).toBeCloseTo(.12);
    expect(healthIntensity(80,100,3)).toBe(0); expect(healthIntensity(10,100,3)).toBeGreaterThan(healthIntensity(20,100,3));
  });
  it("maps seen combat, heal and teleport events, and ignores unseen events", () => {
    const here = () => ({ x: 0, y: 2 });
    expect(eventCue({event:"combat-outcome",attacker:"player",kind:"spell",hit:true,died:false,grid:{x:1,y:2},seen:true}, here).map(c=>c.kind)).toEqual(["cast","hit"]);
    expect(eventCue({event:"combat-outcome",attacker:null,kind:"spell",hit:true,died:false,grid:{x:1,y:2},seen:true}, () => null).map(c=>c.kind)).toEqual(["hit"]);
    expect(eventCue({event:"combat-outcome",attacker:"player",kind:"melee",hit:false,died:false,grid:{x:1,y:2},seen:true})[0]?.kind).toBe("miss");
    expect(eventCue({event:"combat-outcome",attacker:"player",kind:"spell",hit:true,died:true,grid:{x:1,y:2},seen:true}, () => ({ x: 0, y: 2 })).map(c=>c.kind)).toEqual(["cast","death"]);
    expect(eventCue({event:"motion",kind:"teleport",from:{x:1,y:1},to:{x:2,y:2},seen:true})).toHaveLength(2);
    expect(eventCue({event:"heal",grid:{x:1,y:1},seen:false})).toEqual([]);
  });
  it("finds an event's creature on the current snapshot", () => {
    const s = { core: { player: { grid: { x: 1, y: 1 } }, monsters: [{ id: 7, grid: { x: 9, y: 4 }, visible: true }, { id: 9, grid: { x: 3, y: 3 }, visible: false }] } } as unknown as EffectSnapshot;
    expect(actorGrid(s, "player")).toEqual({ x: 1, y: 1 }); expect(actorGrid(s, 7)).toEqual({ x: 9, y: 4 });
    expect(actorGrid(s, 8)).toBeNull(); expect(actorGrid(s, null)).toBeNull();
    // An unseen monster never places a cue, so no effect gives its position away.
    expect(actorGrid(s, 9)).toBeNull();
  });
  it("uses static reduced-motion cues and declares every flag in combination coverage", () => {
    expect(chooseEffectMotion(true)).toBe("static"); expect(chooseEffectMotion(false)).toBe("motion"); expect(flags).toHaveLength(7);
  });
});

describe("effect event subscription", () => {
  it("subscribes handlers that take the event name first and the payload second, as core calls them", async () => {
    const { installEffects } = await import("./effects.js");
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const g = new Proxy({}, { get: () => () => {}, set: () => true });
    const canvas = { style: {}, setAttribute: () => {}, getContext: () => g, remove: () => {} };
    const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
    Object.assign(globalThis, { document: { createElement: () => canvas, body: { append: () => {} } }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
    try {
      const stop = installEffects({ flags: { "anybandui.spellEffects": true }, display: { snapshot: () => ({}) as never },
        events: { on: (name, fn) => { handlers.set(name, fn as (...args: unknown[]) => void); }, off: (name) => { handlers.delete(name); } } });
      expect([...handlers.keys()].sort()).toEqual(["combat-outcome", "heal", "motion"]);
      for (const fn of handlers.values()) expect(fn.length).toBe(2);
      expect(() => handlers.get("heal")!("heal", { who: "player", amount: 3 })).not.toThrow();
      stop();
      expect(handlers.size).toBe(0);
    } finally { Object.assign(globalThis, { document: saved.document, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf }); }
  });
});
