import { describe, expect, it } from "vitest";
import { actorGrid, blastCues, chooseEffectMotion, eventCue, effectGrids, actualAura, healthIntensity, EFFECT_FLAGS, STRENGTH_SETTINGS, sceneTerrain, sceneCells, playerOnStairs, recallGrid, driftingEmbers, IDLE_LEVEL, observeLevel, levelFlashIntensity, IDLE_SCENE, sceneDuration, observeScene, sceneOpacity, phosphorKeep, fringeOffset, sweepTrail, glowFigure, sunburstAngles, cellAnchor, blinkCues, boltCue, boltGlyph, coneCues, markGrids, nextBoltDelay, numberCues, rippleAlpha, rippleCells, slidePlace, walkCues } from "./effects.js";
import type { EffectSnapshot, KnownLevel } from "./seams.js";
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
    expect(chooseEffectMotion(true)).toBe("static"); expect(chooseEffectMotion(false)).toBe("motion");
    expect(EFFECT_FLAGS).toEqual(["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.fearMarks", "anybandui.presenceHaze", "anybandui.damageNumbers", "anybandui.walkSlide", "anybandui.blinkRipple", "anybandui.boltGlyphs", "anybandui.coneWash", "anybandui.spellEffects", "anybandui.lavaEmbers", "anybandui.stairEmbers", "anybandui.recallRing", "anybandui.levelFlash", "anybandui.sceneFade", "anybandui.crtGlow", "anybandui.crtFringe", "anybandui.crtSweep"]);
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
    Object.assign(globalThis, { document: { createElement: () => canvas, body: { append: () => {} }, getElementById: () => null }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
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
    Object.assign(globalThis, { document: { createElement: () => canvas, body: { append: () => {} }, getElementById: () => null }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
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
      document: { createElement: () => canvas, body: { append: () => {} }, getElementById: () => null },
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
        document: { createElement: () => canvas, body: { append: () => {} }, getElementById: () => null },
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

describe("scene terrain", () => {
  it("names lava and stairs from the terrain code, and ignores a glyph", () => {
    expect(sceneTerrain("LAVA")).toBe("lava");
    expect(sceneTerrain("core:lava")).toBe("lava");
    expect(sceneTerrain("lava-pool")).toBe("lava");
    expect(sceneTerrain("core:old-lava")).toBe("lava");
    expect(sceneTerrain("LESS")).toBe("up");
    expect(sceneTerrain("core:less")).toBe("up");
    expect(sceneTerrain("core:stair-up")).toBe("up");
    expect(sceneTerrain("UP_STAIR")).toBe("up");
    expect(sceneTerrain("MORE")).toBe("down");
    expect(sceneTerrain("core:more")).toBe("down");
    expect(sceneTerrain("STAIR_DOWN")).toBe("down");
    expect(sceneTerrain("FLOOR")).toBeNull();
    expect(sceneTerrain("core:lesser-vault")).toBeNull();
    expect(sceneTerrain(undefined)).toBeNull();
    const lava = { x: 1, y: 2, remembered: { feat: 23 }, glyph: "@" };
    const cells = sceneCells({ cells: [
      lava,
      { x: 3, y: 4, remembered: { feat: 5 } },
      { x: 5, y: 6, remembered: { feat: 6 } },
      { x: 7, y: 8, remembered: { feat: 1, featCode: "core:floor" } },
      { x: 9, y: 1, remembered: { feat: 1, featCode: "core:lava" } },
    ] });
    expect(cells).toEqual([
      { grid: { x: 1, y: 2 }, kind: "lava" },
      { grid: { x: 3, y: 4 }, kind: "up" },
      { grid: { x: 5, y: 6 }, kind: "down" },
      { grid: { x: 9, y: 1 }, kind: "lava" },
    ]);
    expect("glyph" in lava).toBe(true);
  });

  it("knows when the player is standing on stairs", () => {
    const known = { cells: [{ x: 2, y: 2, remembered: { feat: 5 } }, { x: 3, y: 3, remembered: { feat: 23 } }] };
    expect(playerOnStairs(known, { x: 2, y: 2 })).toBe(true);
    expect(playerOnStairs(known, { x: 3, y: 3 })).toBe(false);
    expect(playerOnStairs(known, { x: 0, y: 0 })).toBe(false);
    expect(playerOnStairs(known, null)).toBe(false);
    expect(playerOnStairs(null, { x: 2, y: 2 })).toBe(false);
  });
});

describe("recall ring and embers", () => {
  it("places the ring only while recall has turns left", () => {
    expect(recallGrid({ grid: { x: 4, y: 5 }, recall: 3 })).toEqual({ x: 4, y: 5 });
    expect(recallGrid({ grid: { x: 4, y: 5 }, recall: 0 })).toBeNull();
    expect(recallGrid({ recall: 4 })).toBeNull();
    expect(recallGrid({ grid: { x: 4, y: 5 } })).toBeNull();
    expect(recallGrid(null)).toBeNull();
  });

  it("holds the sparks still when motion is reduced", () => {
    const still = driftingEmbers(500, 1, 4, true);
    expect(still).toHaveLength(4);
    expect(driftingEmbers(9000, 1, 4, true)).toEqual(still);
    const dots = driftingEmbers(500, 1, 4, false);
    expect(dots).toHaveLength(4);
    expect(dots[0]!.alpha).toBeGreaterThan(0);
    expect(dots[0]!.alpha).toBeLessThanOrEqual(1);
  });
});

describe("level flash", () => {
  const play = (level: number, maxLevel = level, dead = false) => ({ phase: "play", level, maxLevel, dead });

  it("stays quiet on the first reading, on a repeat, and while climbing back to max level", () => {
    const loaded = observeLevel(IDLE_LEVEL, play(10, 10), 1000);
    expect(loaded.started).toBe(-1);
    expect(loaded.highest).toBe(10);
    const climbed = observeLevel(loaded, play(11, 11), 2000);
    expect(climbed.flashedLevel).toBe(11);
    expect(climbed.started).toBe(2000);
    expect(climbed.highest).toBe(11);
    expect(observeLevel(climbed, play(11, 11), 2500).started).toBe(2000);
    const drained = observeLevel(observeLevel(IDLE_LEVEL, play(7, 7), 0), play(4, 7), 100);
    expect(drained.started).toBe(-1);
    expect(drained.highest).toBe(7);
    expect(observeLevel(drained, play(7, 7), 200).started).toBe(-1);
  });

  it("does not flash a dead character, and a pause keeps the baseline", () => {
    const base = observeLevel(IDLE_LEVEL, play(5, 5), 0);
    const dead = observeLevel(base, play(6, 6, true), 100);
    expect(dead.started).toBe(-1);
    expect(dead.highest).toBe(6);
    const paused = observeLevel(base, { phase: "more", level: 5, maxLevel: 5 }, 50);
    expect(paused.highest).toBe(5);
    expect(paused.started).toBe(-1);
    const modal = observeLevel(paused, { phase: "modal", level: 6, maxLevel: 6 }, 80);
    expect(modal.flashedLevel).toBe(6);
    expect(modal.started).toBe(80);
  });

  it("drops the baseline outside a live session and keeps it when the phase is missing", () => {
    const base = observeLevel(IDLE_LEVEL, play(2, 2), 0);
    expect(observeLevel(base, { phase: "pregame", level: 9, maxLevel: 9 }, 5)).toBe(IDLE_LEVEL);
    expect(observeLevel(base, { phase: "dead", level: 9, maxLevel: 9 }, 5)).toBe(IDLE_LEVEL);
    expect(observeLevel(base, {}, 9)).toBe(base);
    expect(observeLevel(base, { phase: null }, 9)).toBe(base);
  });

  it("front-loads the flash and holds a short mark when motion is reduced", () => {
    expect(levelFlashIntensity(-1, 0)).toBe(0);
    expect(levelFlashIntensity(0, 0)).toBe(0);
    expect(levelFlashIntensity(0, 100)).toBeGreaterThan(0);
    expect(levelFlashIntensity(0, 2199)).toBeGreaterThan(0);
    expect(levelFlashIntensity(0, 2200)).toBe(0);
    expect(levelFlashIntensity(0, 100, true)).toBe(0.7);
    expect(levelFlashIntensity(0, 200, true)).toBe(0);
  });
});

describe("scene fades", () => {
  const floor = (levelId: number, onStairs = false, phase = "play") => ({ phase, levelId, depth: levelId, onStairs });

  it("fades once on the first level, and on stairs only after a stair square", () => {
    const loaded = observeScene(IDLE_SCENE, floor(1), 10);
    expect(loaded.kind).toBe("load");
    expect(loaded.started).toBe(10);
    expect(observeScene(loaded, floor(1), 20).started).toBe(10);
    const fromStairs = observeScene(observeScene(IDLE_SCENE, floor(1, true), 0), floor(2), 100);
    expect(fromStairs.kind).toBe("stairs");
    expect(fromStairs.started).toBe(100);
    const teleported = observeScene(observeScene(IDLE_SCENE, floor(1, false), 0), floor(9, true), 50);
    expect(teleported.kind).toBe("load");
    expect(teleported.levelId).toBe(9);
    expect(teleported.onStairs).toBe(true);
  });

  it("fades when a shop opens, and not when it closes", () => {
    const playing = observeScene(IDLE_SCENE, floor(1), 0);
    const entered = observeScene(playing, floor(1, false, "store"), 40);
    expect(entered.kind).toBe("shop");
    expect(entered.started).toBe(40);
    expect(entered.inShop).toBe(true);
    const left = observeScene(entered, floor(1), 80);
    expect(left.kind).toBe("shop");
    expect(left.started).toBe(40);
    expect(left.inShop).toBe(false);
    const firstIsStore = observeScene(IDLE_SCENE, floor(3, false, "store"), 5);
    expect(firstIsStore.kind).toBe("load");
    expect(firstIsStore.inShop).toBe(true);
  });

  it("fades on death once, resets at the title, and keeps a gap in snapshots", () => {
    const playing = observeScene(IDLE_SCENE, floor(1), 0);
    const died = observeScene(playing, { phase: "play", dead: true, levelId: 1, depth: 1 }, 10);
    expect(died.kind).toBe("death");
    expect(died.started).toBe(10);
    expect(observeScene(died, { phase: "dead", dead: true, levelId: 1, depth: 1 }, 99)).toBe(died);
    expect(observeScene(playing, { phase: "pregame" }, 5)).toBe(IDLE_SCENE);
    expect(observeScene(playing, {}, 5)).toBe(playing);
    expect(observeScene(playing, { phase: null }, 5)).toBe(playing);
  });

  it("uses a short fade, shorter still when motion is reduced", () => {
    expect(sceneDuration("death")).toBe(900);
    expect(sceneDuration("load")).toBe(420);
    expect(sceneDuration("shop")).toBe(300);
    expect(sceneDuration("stairs")).toBe(340);
    const death = { ...IDLE_SCENE, established: true, kind: "death" as const, started: 1000 };
    expect(sceneOpacity(death, 1000)).toBe(1);
    expect(sceneOpacity(death, 1900)).toBe(0);
    expect(sceneOpacity(death, 1000, true)).toBe(1);
    expect(sceneOpacity(death, 1040, true)).toBeGreaterThan(0);
    expect(sceneOpacity(death, 1080, true)).toBe(0);
    expect(sceneOpacity(IDLE_SCENE, 1000)).toBe(0);
  });
});

describe("crt parts and the artifact sunburst", () => {
  it("keeps bright pixels, shifts the fringe, and trails the sweep", () => {
    expect(phosphorKeep(0, 0, 0)).toBe(0);
    expect(phosphorKeep(255, 255, 255)).toBe(1);
    const mid = phosphorKeep(51, 51, 51);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(fringeOffset(0, 800)).toBe(0);
    expect(fringeOffset(1, 0)).toBe(0);
    expect(fringeOffset(1, 1000)).toBe(6);
    expect(fringeOffset(1, 100)).toBe(1);
    expect(sweepTrail(10, 10, 100)).toBe(1);
    expect(sweepTrail(10 - 24, 10, 100)).toBe(0);
    expect(sweepTrail(0, 0, 0)).toBe(0);
    expect(sweepTrail(-2, 10, 100)).toBeGreaterThan(0);
    expect(sweepTrail(-2, 10, 100)).toBeLessThan(1);
  });

  it("draws an artifact as a six-ray sunburst on the cell, and a curse or rune as a disc", () => {
    expect(glowFigure("artifact")).toBe("sunburst");
    expect(glowFigure("cursed")).toBe("disc");
    expect(glowFigure("rune")).toBe("disc");
    const rays = sunburstAngles(0);
    expect(rays).toHaveLength(6);
    expect(rays[1]! - rays[0]!).toBeCloseTo(Math.PI / 3);
    expect(sunburstAngles(0.5)[0]).toBeCloseTo(0.5);
    const origin = { x: 10, y: 20 };
    const size = { width: 40, height: 20 };
    const rect = { width: 400, height: 200 };
    expect(cellAnchor(origin, size, rect, { x: 10, y: 20 })).toEqual({ x: 5, y: 5 });
    expect(cellAnchor(origin, size, rect, { x: 11, y: 20 })).toEqual({ x: 15, y: 5 });
  });

  it("names a strength setting for each new part", () => {
    expect(STRENGTH_SETTINGS["lava"]).toBe("anybandui.lavaEmbersStrength");
    expect(STRENGTH_SETTINGS["stairs"]).toBe("anybandui.stairEmbersStrength");
    expect(STRENGTH_SETTINGS["recall"]).toBe("anybandui.recallRingStrength");
    expect(STRENGTH_SETTINGS["level"]).toBe("anybandui.levelFlashStrength");
    expect(STRENGTH_SETTINGS["scene"]).toBe("anybandui.sceneFadeStrength");
    expect(STRENGTH_SETTINGS["crtGlow"]).toBe("anybandui.crtGlowStrength");
    expect(STRENGTH_SETTINGS["crtFringe"]).toBe("anybandui.crtFringeStrength");
    expect(STRENGTH_SETTINGS["crtSweep"]).toBe("anybandui.crtSweepStrength");
  });
});

describe("a scene flag on its own", () => {
  it("installs the overlay without the spell-effect events", async () => {
    const { installEffects } = await import("./effects.js");
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const g = new Proxy({}, { get: () => () => {}, set: () => true });
    const canvas = { style: {}, setAttribute: () => {}, getContext: () => g, remove: () => {} };
    const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
    Object.assign(globalThis, { document: { createElement: () => canvas, body: { append: () => {} }, getElementById: () => null }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} });
    try {
      const stop = installEffects({ flags: { "anybandui.lavaEmbers": true }, display: { snapshot: () => ({}) as never },
        events: { on: (name, fn) => { handlers.set(name, fn as (...args: unknown[]) => void); }, off: (name) => { handlers.delete(name); } } });
      expect(handlers.size).toBe(0);
      stop();
    } finally { Object.assign(globalThis, { document: saved.document, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf }); }
  });
});
