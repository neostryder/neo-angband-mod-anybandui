import { describe, expect, it } from "vitest";
import { actorGrid, blastCues, chooseEffectMotion, eventCue, effectGrids, actualAura, healthIntensity } from "./effects.js";
import type { EffectSnapshot, KnownLevel } from "./seams.js";
const flags = ["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.presenceHaze", "anybandui.spellEffects"];
describe("phase 7 effects", () => {
  it("selects visible sleeping, unique and known artifact grids", () => {
    const s = { core: { monsters: [{ id: 1, race: "Morgoth, Lord of Darkness", raceIndex: 1, grid: {x:2,y:3}, visible: true, hp: 4, maxHp: 4, asleep: true, level: 100, raceFlags: ["UNIQUE"] }] } } as unknown as EffectSnapshot;
    // An older engine: no unique or finalGuardian flags and no aura, so the race flag, the name and the artifact field decide.
    expect(effectGrids(s, { token: {epoch:1,revision:1}, levelId: 1, depth: 1, width: 10, height: 10, cells: [{x:4,y:5,visible:true,remembered:{feat:1,traps:[],objects:[{sensed:false,aware:true,kindIndex:1,aura:"artifact"}]}}] })).toEqual({ asleep:[{x:2,y:3}], uniques:[{ grid:{x:2,y:3}, final:true }], glows:[{ grid:{x:4,y:5}, aura:"artifact" }] });
  });
  it("reads unique, finalGuardian and aura where the engine has them", () => {
    const monster = (id: number, x: number, extra: object) => ({ id, race: "Grip, Farmer Maggot's Dog", raceIndex: id, grid: {x,y:1}, visible: true, hp: 5, maxHp: 5, asleep: false, level: 2, raceFlags: [], ...extra });
    const s = { core: { monsters: [monster(1, 1, { unique: true, finalGuardian: false }), monster(2, 2, { unique: true, finalGuardian: true }), monster(3, 3, { unique: false, raceFlags: ["UNIQUE"] })] } } as unknown as EffectSnapshot;
    const cells: KnownLevel["cells"] = [
      { x: 7, y: 7, visible: true, remembered: { feat: 1, traps: [], objects: [{ sensed: false, aware: true, kindIndex: 1, aura: "rune" }, { sensed: false, aware: true, kindIndex: 2, aura: "cursed" }] } },
      { x: 8, y: 7, visible: true, remembered: { feat: 1, traps: [], objects: [{ sensed: false, aware: true, kindIndex: 3, aura: "rune" }, { sensed: true, money: false }] } },
      { x: 9, y: 7, visible: true, remembered: { feat: 1, traps: [], objects: [{ sensed: false, aware: true, kindIndex: 4 }] } },
    ];
    const grids = effectGrids(s, { token: {epoch:1,revision:1}, levelId: 1, depth: 1, width: 10, height: 10, cells });
    // The engine's flag wins over the race flag list, in both directions.
    expect(grids.uniques).toEqual([{ grid:{x:1,y:1}, final:false }, { grid:{x:2,y:1}, final:true }]);
    // One glow per cell, cursed before artifact before rune, and no glow without an aura.
    expect(grids.glows).toEqual([{ grid:{x:7,y:7}, aura:"cursed" }, { grid:{x:8,y:7}, aura:"rune" }]);
  });
  it("starts the low-health effect below the game's hit point warning, or 30 percent without one", () => {
    expect(healthIntensity(30,100,30)).toBe(0); expect(healthIntensity(29,100,30)).toBeGreaterThan(0);
    expect(healthIntensity(40,100,50)).toBeGreaterThan(0);
    expect(healthIntensity(29,100,undefined)).toBeGreaterThan(0); expect(healthIntensity(29,100,0)).toBeGreaterThan(0); expect(healthIntensity(31,100,0)).toBe(0);
    expect(healthIntensity(10,100,30)).toBeGreaterThan(healthIntensity(20,100,30)); expect(healthIntensity(1,100,30)).toBeLessThanOrEqual(1);
  });
  it("flashes only the blast grids the player can see, in the element's colour", () => {
    const cues = blastCues({ projType: 0, element: "FIRE", arc: false, radius: 1, numGrids: 3, distanceToGrid: [1, 1, 1], drawing: true, blastGrid: [{x:1,y:1},{x:2,y:1},{x:3,y:1}], playerSeesGrid: [true,false,true], centre: {x:1,y:1} });
    expect(cues.map((c) => c.grid)).toEqual([{x:1,y:1},{x:3,y:1}]);
    expect(new Set(cues.map((c) => c.colour)).size).toBe(1);
    expect(cues[0]!.colour).not.toBe(blastCues({ projType: 0, element: "COLD", arc: false, radius: 1, numGrids: 1, distanceToGrid: [1], drawing: true, blastGrid: [{x:1,y:1}], playerSeesGrid: [true], centre: {x:1,y:1} })[0]!.colour);
    expect(blastCues({ projType: 0, element: "FIRE", arc: false, radius: 1, numGrids: 500, distanceToGrid: Array(500).fill(1), drawing: true, blastGrid: Array.from({ length: 500 }, (_, x) => ({ x, y: 0 })), playerSeesGrid: Array(500).fill(true), centre: {x:0,y:0} })).toHaveLength(200);
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
      expect([...handlers.keys()].sort()).toEqual(["combat-outcome", "explosion", "heal", "motion"]);
      for (const fn of handlers.values()) expect(fn.length).toBe(2);
      expect(() => handlers.get("heal")!("heal", { who: "player", amount: 3 })).not.toThrow();
      stop();
      expect(handlers.size).toBe(0);
    } finally { Object.assign(globalThis, { document: saved.document, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf }); }
  });
});

describe("effect strength", () => {
  it("reads the Mods screen setting where the engine has one, and the stored strength otherwise", async () => {
    const { effectStrength, STRENGTH_SETTINGS } = await import("./effects.js");
    const values: Record<string, number> = { "anybandui.crtStrength": 40, "anybandui.spellEffectsStrength": 0 };
    const settings = { get: (id: string) => values[id] };
    expect(effectStrength(settings, { crt: 90 }, "crt")).toBe(40);
    // The rings and the blast flashes share one setting.
    expect(effectStrength(settings, {}, "hit")).toBe(0);
    expect(effectStrength(settings, {}, "blast")).toBe(0);
    expect(STRENGTH_SETTINGS["death"]).toBe("anybandui.deathStrength");
    // An engine without numeric settings, or one that has not stored a value: the mod's own prefs, then full strength.
    expect(effectStrength(undefined, { crt: 90 }, "crt")).toBe(90);
    expect(effectStrength(settings, {}, "sleepMarks")).toBe(100);
    expect(effectStrength({ get: () => { throw new Error("gone"); } }, { itemGlow: 30 }, "itemGlow")).toBe(30);
    expect(effectStrength({ get: () => 250 }, {}, "crt")).toBe(100);
  });
});

describe("the hidden-magic glow", () => {
  const plain = { artifact: false, ego: false, curses: [], flags: [], modifiers: [], brands: [], slays: [], resists: [], toH: 0, toD: 0, toA: 0 };
  const cell = (actual: object, extra: object = {}) => ({ x: 1, y: 1, visible: true, remembered: { feat: 1, objects: [{}] }, actual: { monster: 0, objects: [actual] }, ...extra });
  const level = (c: object) => ({ token: { epoch: 1, revision: 1 }, cells: [c] }) as never;

  it("reads the true item only when the switch is on", () => {
    expect(effectGrids(null, level(cell({ ...plain, curses: ["teleportation"] })), false).glows).toEqual([]);
    expect(effectGrids(null, level(cell({ ...plain, curses: ["teleportation"] })), true).glows).toEqual([{ grid: { x: 1, y: 1 }, aura: "cursed" }]);
  });

  it("orders curse over artifact over runes, and leaves mundane items dark", () => {
    expect(actualAura({ ...plain, artifact: true, curses: ["vulnerability"] })).toBe("cursed");
    expect(actualAura({ ...plain, artifact: true, toH: 5 })).toBe("artifact");
    expect(actualAura({ ...plain, toD: 3 })).toBe("rune");
    expect(actualAura(plain)).toBeUndefined();
  });

  it("stays dark on a grid the player cannot see, does not remember, or a creature covers", () => {
    const cursed = { ...plain, curses: ["siphoning"] };
    expect(effectGrids(null, level(cell(cursed, { visible: false })), true).glows).toEqual([]);
    expect(effectGrids(null, level(cell(cursed, { remembered: { feat: 1, objects: [] } })), true).glows).toEqual([]);
    expect(effectGrids(null, level({ ...cell(cursed), actual: { monster: 7, objects: [cursed] } }), true).glows).toEqual([]);
  });
});
