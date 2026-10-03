import { describe, expect, it } from "vitest";
import { actorGrid, blastCues, blinkCues, boltCue, boltGlyph, chooseEffectMotion, coneCues, eventCue, effectGrids, actualAura, healthIntensity, markGrids, nextBoltDelay, numberCues, rippleAlpha, rippleCells, slidePlace, walkCues } from "./effects.js";
import type { EffectSnapshot, KnownLevel } from "./seams.js";
const flags = ["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.fearMarks", "anybandui.presenceHaze", "anybandui.damageNumbers", "anybandui.walkSlide", "anybandui.blinkRipple", "anybandui.boltGlyphs", "anybandui.coneWash", "anybandui.spellEffects"];
describe("phase 7 effects", () => {
  it("selects visible sleeping, unique and known artifact grids", () => {
    const s = { core: { monsters: [{ id: 1, race: "Morgoth, Lord of Darkness", raceIndex: 1, grid: {x:2,y:3}, visible: true, hp: 4, maxHp: 4, asleep: true, level: 100, raceFlags: ["UNIQUE"] }] } } as unknown as EffectSnapshot;
    // An older engine: no unique or finalGuardian flags and no aura, so the race flag, the name and the artifact field decide.
    expect(effectGrids(s, { token: {epoch:1,revision:1}, levelId: 1, depth: 1, width: 10, height: 10, cells: [{x:4,y:5,visible:true,remembered:{feat:1,traps:[],objects:[{sensed:false,aware:true,kindIndex:1,aura:"artifact"}]}}] })).toEqual({ asleep:[{x:2,y:3}], afraid:[], uniques:[{ grid:{x:2,y:3}, final:true }], glows:[{ grid:{x:4,y:5}, aura:"artifact" }] });
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
    expect(eventCue({event:"motion",kind:"walk",from:{x:1,y:1},to:{x:1,y:2},seen:true})).toEqual([]);
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
    expect(chooseEffectMotion(true)).toBe("static"); expect(chooseEffectMotion(false)).toBe("motion"); expect(flags).toHaveLength(13);
  });
  it("marks a visible frightened creature, and lets the exclamation mark replace the sleep mark", () => {
    const monster = (id: number, x: number, extra: object) => ({ id, race: "White worm", raceIndex: id, grid: { x, y: 1 }, visible: true, hp: 5, maxHp: 5, asleep: false, afraid: false, level: 2, raceFlags: [], ...extra });
    const s = { core: { monsters: [monster(1, 1, { afraid: true }), monster(2, 2, { asleep: true, afraid: true }), monster(3, 3, { afraid: true, visible: false }), monster(4, 4, { asleep: true })] } } as unknown as EffectSnapshot;
    const grids = effectGrids(s, null);
    expect(grids.afraid).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(grids.asleep).toEqual([{ x: 2, y: 1 }, { x: 4, y: 1 }]);
    expect(markGrids(grids.asleep, grids.afraid, true)).toEqual({ sleep: [{ x: 4, y: 1 }], fear: [{ x: 1, y: 1 }, { x: 2, y: 1 }] });
    expect(markGrids(grids.asleep, grids.afraid, false).fear).toEqual([]);
    expect(markGrids(grids.asleep, grids.afraid, false).sleep).toEqual(grids.asleep);
  });
  it("floats a seen damage or healing amount over that square", () => {
    expect(numberCues({ event: "combat-outcome", hit: true, damage: 12, grid: { x: 3, y: 4 }, seen: true, target: 7 })).toEqual([{ grid: { x: 3, y: 4 }, kind: "number", text: "-12", colour: "#ffce63", life: 720 }]);
    expect(numberCues({ event: "combat-outcome", hit: true, damage: 4, grid: { x: 1, y: 1 }, seen: true, target: "player" })[0]).toMatchObject({ text: "-4", colour: "#ff6152" });
    expect(numberCues({ event: "heal", amount: 8, grid: { x: 1, y: 1 }, seen: true })[0]).toMatchObject({ text: "+8", colour: "#64ffa0" });
    expect(numberCues({ event: "combat-outcome", hit: false, damage: 0, grid: { x: 1, y: 1 }, seen: true, target: 2 })).toEqual([]);
    expect(numberCues({ event: "combat-outcome", hit: true, damage: 5, grid: { x: 1, y: 1 }, seen: false, target: 2 })).toEqual([]);
    expect(numberCues({ event: "heal", amount: 0, grid: { x: 1, y: 1 }, seen: true })).toEqual([]);
  });
  it("slides one adjacent step and ripples a seen teleport", () => {
    expect(walkCues({ who: 4, from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, kind: "walk", seen: true })).toEqual([{ grid: { x: 3, y: 2 }, from: { x: 2, y: 2 }, kind: "slide", life: 100 }]);
    expect(walkCues({ who: "player", from: { x: 2, y: 2 }, to: { x: 3, y: 3 }, kind: "walk", seen: true })).toHaveLength(1);
    expect(walkCues({ who: 4, from: { x: 2, y: 2 }, to: { x: 4, y: 2 }, kind: "walk", seen: true })).toEqual([]);
    expect(walkCues({ who: 4, from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, kind: "walk", seen: false })).toEqual([]);
    expect(walkCues({ who: 4, from: { x: 2, y: 2 }, to: { x: 8, y: 8 }, kind: "teleport", seen: true })).toEqual([]);
    expect(walkCues({ who: 4, from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, kind: "walk", seen: true }, (p) => p.x !== 2)).toEqual([]);
    expect(slidePlace({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
    expect(slidePlace({ x: 0, y: 0 }, { x: 1, y: 0 }, 1)).toEqual({ x: 1, y: 0 });
    expect(slidePlace({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5).x).toBeCloseTo(0.75);
    expect(blinkCues({ who: "player", from: { x: 1, y: 1 }, to: { x: 6, y: 4 }, kind: "teleport", seen: true })).toEqual([{ grid: { x: 6, y: 4 }, kind: "ripple", life: 340, span: 3.8 }]);
    expect(blinkCues({ who: 2, from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, kind: "walk", seen: true })).toEqual([]);
    expect(blinkCues({ who: 2, from: { x: 1, y: 1 }, to: { x: 6, y: 4 }, kind: "teleport", seen: false })).toEqual([]);
    expect(rippleAlpha(0, 0, 0)).toBeCloseTo(0.3);
    expect(rippleAlpha(2, 0, 0)).toBe(0);
    const cells = rippleCells({ x: 1, y: 1 }, { cells: [{ x: 1, y: 1, visible: true }, { x: 2, y: 1, visible: true }, { x: 8, y: 8, visible: true }, { x: 1, y: 2, visible: false }] }, 1);
    expect(cells).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(rippleCells({ x: 1, y: 1 }, { cells: [{ x: 1, y: 1, visible: false }] }, 1)).toEqual([]);
  });
  it("follows each bolt step's direction and washes a breath outward", () => {
    expect(boltGlyph(1, 0, "FIRE", 4, 1)).toBe("-");
    expect(boltGlyph(0, 1, "FIRE", 4, 1)).toBe("|");
    expect(boltGlyph(1, 1, "FIRE", 4, 1)).toBe("\\");
    expect(boltGlyph(-1, 1, "FIRE", 4, 1)).toBe("/");
    expect(boltGlyph(1, 0, "ELEC", 1, 1)).toBe("*");
    expect(boltGlyph(1, 0, "ELEC", 2, 1)).toBe("~");
    const step = boltCue({ projType: 0, element: "FIRE", drawing: false, seen: true, beam: false, ox: 3, oy: 1, x: 4, y: 1 }, 40);
    expect(step).toMatchObject({ grid: { x: 4, y: 1 }, from: { x: 3, y: 1 }, kind: "bolt", glyph: "-", delay: 40, life: 200 });
    expect(step?.colour).toBeTruthy();
    expect(boltCue({ projType: 0, element: "FIRE", drawing: false, seen: false, beam: false, ox: 3, oy: 1, x: 4, y: 1 })).toBeNull();
    const state = { count: 0, at: 0 };
    expect(nextBoltDelay(100, false, state)).toBe(0);
    expect(nextBoltDelay(110, false, state)).toBe(40);
    expect(nextBoltDelay(120, true, state)).toBe(0);
    expect(nextBoltDelay(200, false, state)).toBe(0);
    const breath = coneCues({ projType: 0, element: "COLD", arc: true, radius: 3, numGrids: 3, distanceToGrid: [0, 1, 3], drawing: false, blastGrid: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 1 }], playerSeesGrid: [true, false, true], centre: { x: 1, y: 1 } });
    expect(breath.map((c) => c.grid)).toEqual([{ x: 1, y: 1 }, { x: 4, y: 1 }]);
    expect(breath[0]).toMatchObject({ kind: "cone", glyph: "+", distance: 0, delay: 0 });
    expect(breath[1]!.delay ?? -1).toBeGreaterThan(breath[0]!.delay ?? 0);
    expect(breath[0]!.colour).not.toBe(coneCues({ projType: 0, element: "FIRE", arc: true, radius: 1, numGrids: 1, distanceToGrid: [0], drawing: false, blastGrid: [{ x: 1, y: 1 }], playerSeesGrid: [true], centre: { x: 1, y: 1 } })[0]!.colour);
    expect(coneCues({ projType: 0, element: "FIRE", arc: true, radius: 1, numGrids: 1, distanceToGrid: [0], drawing: false, blastGrid: [{ x: 1, y: 1 }], playerSeesGrid: [true], centre: { x: 1, y: 1 } })[0]!.glyph).toBe("^");
    expect(coneCues({ projType: 0, element: "FIRE", arc: false, radius: 2, numGrids: 1, distanceToGrid: [1], drawing: false, blastGrid: [{ x: 1, y: 1 }], playerSeesGrid: [true], centre: { x: 1, y: 1 } })).toEqual([]);
    expect(coneCues({ projType: 0, element: "ACID", arc: true, radius: 1, numGrids: 500, distanceToGrid: Array(500).fill(1), drawing: false, blastGrid: Array.from({ length: 500 }, (_, x) => ({ x, y: 0 })), playerSeesGrid: Array(500).fill(true), centre: { x: 0, y: 0 } })).toHaveLength(200);
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

  it("subscribes a switch only to the events that switch draws", async () => {
    const { installEffects } = await import("./effects.js");
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const g = new Proxy({}, { get: () => () => {}, set: () => true });
    const canvas = { style: {}, setAttribute: () => {}, getContext: () => g, remove: () => {} };
    const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
    Object.assign(globalThis, { document: { createElement: () => canvas, body: { append: () => {} } }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
    try {
      const stopNumbers = installEffects({ flags: { "anybandui.damageNumbers": true }, display: { snapshot: () => ({}) as never },
        events: { on: (name, fn) => { handlers.set(name, fn as (...args: unknown[]) => void); }, off: (name) => { handlers.delete(name); } } });
      expect([...handlers.keys()].sort()).toEqual(["combat-outcome", "heal"]);
      stopNumbers();
      const stopBolt = installEffects({ flags: { "anybandui.boltGlyphs": true, "anybandui.coneWash": true }, display: { snapshot: () => ({}) as never },
        events: { on: (name, fn) => { handlers.set(name, fn as (...args: unknown[]) => void); }, off: (name) => { handlers.delete(name); } } });
      expect([...handlers.keys()].sort()).toEqual(["bolt", "explosion"]);
      expect(() => handlers.get("bolt")!("bolt", { projType: 0, element: "FIRE", drawing: false, seen: false, beam: false, ox: 0, oy: 0, x: 1, y: 0 })).not.toThrow();
      expect(() => handlers.get("explosion")!("explosion", { arc: false, element: "FIRE", blastGrid: [{ x: 1, y: 1 }], playerSeesGrid: [true], distanceToGrid: [0], centre: { x: 1, y: 1 }, projType: 0, radius: 1, numGrids: 1, drawing: false })).not.toThrow();
      stopBolt();
      expect(handlers.size).toBe(0);
    } finally { Object.assign(globalThis, { document: saved.document, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf }); }
  });
});

describe("effects in text mode", () => {
  it("draws the fear mark and the bolt glyph as text on their cells", async () => {
    const { installEffects } = await import("./effects.js");
    const texts: { text: string; x: number; y: number }[] = [];
    const ops: string[] = [];
    const g = new Proxy({}, {
      get: (_target, prop) => (...args: unknown[]) => {
        ops.push(String(prop));
        if (prop === "fillText") texts.push({ text: String(args[0]), x: Number(args[1]), y: Number(args[2]) });
      },
      set: () => true,
    });
    const frames: FrameRequestCallback[] = [];
    const canvas = { style: {} as Record<string, string>, width: 0, height: 0, setAttribute() {}, getContext: () => g, remove() {} };
    const view = {
      mode: "play" as const, grid: { cols: 80, rows: 24, cellWidth: 8, cellHeight: 16 }, layout: "left" as const,
      viewport: { origin: { x: 0, y: 0 }, size: { width: 10, height: 10 } }, level: { width: 20, height: 20 },
      regions: { map: { pixels: { x: 0, y: 0, width: 100, height: 100 } } },
    };
    const snap = { phase: "play", core: { monsters: [{ id: 1, race: "White worm", raceIndex: 1, grid: { x: 2, y: 3 }, visible: true, hp: 4, maxHp: 4, asleep: true, afraid: true, level: 2, raceFlags: [] }] } };
    const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame, matchMedia: globalThis.matchMedia, devicePixelRatio: globalThis.devicePixelRatio };
    Object.assign(globalThis, {
      document: { createElement: () => canvas, body: { append: () => {} } },
      requestAnimationFrame: (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; },
      cancelAnimationFrame: () => {},
      matchMedia: () => ({ matches: true }),
      devicePixelRatio: 1,
    });
    try {
      const handlers = new Map<string, (...args: unknown[]) => void>();
      const stop = installEffects({
        flags: { "anybandui.fearMarks": true, "anybandui.sleepMarks": true, "anybandui.boltGlyphs": true },
        display: { snapshot: () => view as never }, snapshot: () => snap as never,
        events: { on: (name, fn) => { handlers.set(name, fn as (...args: unknown[]) => void); }, off: (name) => { handlers.delete(name); } },
      });
      handlers.get("bolt")!("bolt", { projType: 0, element: "FIRE", drawing: false, seen: true, beam: false, ox: 3, oy: 1, x: 4, y: 1 });
      const started = performance.now();
      frames[0]!(started);
      frames[0]!(started + 300);
      const fear = texts.filter((t) => t.text === "!");
      const bolt = texts.filter((t) => t.text === "-");
      expect(fear.length).toBeGreaterThan(0);
      expect(bolt.length).toBeGreaterThan(0);
      expect(fear[0]!.x).toBeCloseTo(25);
      expect(fear[0]!.y).toBeCloseTo(30.8);
      expect(fear[1]!.y).toBeCloseTo(fear[0]!.y);
      expect(bolt[0]!.x).toBeCloseTo(45);
      expect(bolt[0]!.y).toBeCloseTo(15);
      expect(ops).not.toContain("drawImage");
      expect(ops).not.toContain("moveTo");
      stop();
    } finally {
      Object.assign(globalThis, { document: saved.document, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf, matchMedia: saved.matchMedia, devicePixelRatio: saved.devicePixelRatio });
    }
  });

  it("bobs the fear mark unless reduced motion is on", async () => {
    const { installEffects } = await import("./effects.js");
    const ys = async (reduced: boolean): Promise<number[]> => {
      const found: number[] = [];
      const g = new Proxy({}, {
        get: (_target, prop) => (...args: unknown[]) => { if (prop === "fillText" && args[0] === "!") found.push(Number(args[2])); },
        set: () => true,
      });
      const frames: FrameRequestCallback[] = [];
      const canvas = { style: {} as Record<string, string>, width: 0, height: 0, setAttribute() {}, getContext: () => g, remove() {} };
      const view = {
        mode: "play" as const, grid: { cols: 80, rows: 24, cellWidth: 8, cellHeight: 16 }, layout: "left" as const,
        viewport: { origin: { x: 0, y: 0 }, size: { width: 10, height: 10 } }, level: { width: 20, height: 20 },
        regions: { map: { pixels: { x: 0, y: 0, width: 100, height: 100 } } },
      };
      const snap = { core: { monsters: [{ id: 1, grid: { x: 2, y: 3 }, visible: true, afraid: true, asleep: false, raceFlags: [] }] } };
      Object.assign(globalThis, {
        document: { createElement: () => canvas, body: { append: () => {} } },
        requestAnimationFrame: (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; },
        cancelAnimationFrame: () => {},
        matchMedia: () => ({ matches: reduced }),
        devicePixelRatio: 1,
      });
      const stop = installEffects({ flags: { "anybandui.fearMarks": true }, display: { snapshot: () => view as never }, snapshot: () => snap as never });
      frames[0]!(0);
      const next = frames[frames.length - 1]!;
      next(300);
      stop();
      return found;
    };
    const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame, matchMedia: globalThis.matchMedia, devicePixelRatio: globalThis.devicePixelRatio };
    try {
      const still = await ys(true);
      const moving = await ys(false);
      expect(still[0]).toBeCloseTo(still[1]!);
      expect(moving[0]).not.toBeCloseTo(moving[1]!);
    } finally {
      Object.assign(globalThis, { document: saved.document, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf, matchMedia: saved.matchMedia, devicePixelRatio: saved.devicePixelRatio });
    }
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
    expect(STRENGTH_SETTINGS["fearMarks"]).toBe("anybandui.fearMarksStrength");
    expect(STRENGTH_SETTINGS["number"]).toBe("anybandui.damageNumbersStrength");
    expect(STRENGTH_SETTINGS["slide"]).toBe("anybandui.walkSlideStrength");
    expect(STRENGTH_SETTINGS["ripple"]).toBe("anybandui.blinkRippleStrength");
    expect(STRENGTH_SETTINGS["bolt"]).toBe("anybandui.boltGlyphsStrength");
    expect(STRENGTH_SETTINGS["cone"]).toBe("anybandui.coneWashStrength");
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
