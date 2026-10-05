import { describe, expect, it, vi } from "vitest";
import { TMD } from "@rpgm-tools/neo-angband-core";
import { api2NotGranted, api2Ok, api2Refused, type Api2InputState, type Api2TrueLevel, type Api2Truth, type KnownItem, type KnownLevel, type KnownMonster, type KnownPlayer, type KnownPlayerStatus, type KnownWorldData, type ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import * as v1 from "./host-adapter.js";
import * as v2 from "./host-adapter-api2.js";

/* One set of game facts, handed to the API 1 adapter in API 1's shapes and to
 * the API 2 adapter through a fake ModApi2. Every pair of functions must give
 * the same answer. */
const token = { epoch: 2, revision: 9 };
const status: KnownPlayerStatus = {
  blind: 0, confused: 3, afraid: 0, poisoned: 0, cut: 0, stun: 0, paralyzed: 0, food: 9000, fast: 12, sprint: 0,
  protEvil: 0, hero: 0, shero: 0, shield: 0, stoneskin: 0, blessed: 0, fastcast: 0,
  resAcid: 0, resElec: 0, resFire: 7, resCold: 0, resPois: 0, terror: 0, amnesia: 0, image: 4,
};
const player = { race: "Dwarf", cls: "Priest", hp: 13, maxHp: 21, grid: { x: 3, y: 2 }, status, depth: 2 } as unknown as KnownPlayer;
const item = (handle: number, artifact = false): KnownItem => ({ handle, kindKey: `k${handle}`, label: "a", artifact } as unknown as KnownItem);
const inventory = [item(1), item(2, true)];
const equipment = [item(10), null, item(11, true)];
const quiver = [item(20)];
const monsters: KnownMonster[] = [
  { id: 1, race: "Grip, Farmer Maggot's Dog", raceIndex: 5, grid: { x: 1, y: 2 }, visible: true, health: "unhurt", living: true, status: ["asleep"], look: "asleep", raceLevel: 2, raceSpeed: 120, knownFlags: ["UNIQUE"], knownSpells: [], unique: true, questGuardian: false, finalGuardian: false },
  { id: 4, race: "Cave spider", raceIndex: 60, grid: { x: 4, y: 3 }, visible: true, health: "wounded", living: true, status: ["afraid", "stunned"], look: "wounded, afraid", raceLevel: 2, raceSpeed: 120, knownFlags: [], knownSpells: [], unique: false, questGuardian: false, finalGuardian: false },
  { id: 6, race: "Clear worm", raceIndex: 33, grid: { x: 0, y: 0 }, visible: false, health: "unhurt", living: true, status: [], look: "", raceLevel: 3, raceSpeed: 100, knownFlags: ["INVISIBLE"], knownSpells: [], unique: false, questGuardian: false, finalGuardian: false },
];
/* API 1's MonsterView.raceFlags is the race's full flag list; API 2's row
 * holds only the learned flags (knownFlags above). */
const fullRaceFlags: Record<number, string[]> = {
  1: ["UNIQUE", "MALE", "RAND_25", "ANIMAL"],
  4: ["ANIMAL", "WEIRD_MIND", "FRIENDS", "HURT_LIGHT"],
  6: ["INVISIBLE", "ANIMAL", "STUPID", "MULTIPLY"],
};
const SHOP_FEAT = 8;
const width = 5, height = 4;
const trapAt = (x: number, y: number) => x === 1 && y === 1;
/* (2, 1) is a shop the character remembers; (0, 3) is a shop in the real map
 * that the character has never seen, so the remembered map has no cell there. */
const shopAt = (x: number, y: number) => (x === 2 && y === 1) || (x === 0 && y === 3);
const unseen = (x: number, y: number) => x === 0 && y === 3;
const pileAt = (x: number, y: number) => (x === 3 && y === 1
  ? [{ sensed: true as const, money: false }, { sensed: false as const, aware: true as const, kindIndex: 40 }]
  : []);
const realAt = (x: number, y: number) => (x === 4 && y === 1 ? { feat: 1, traps: [{ index: 3, name: "trap door" }], objects: [item(0)], monster: 0 } : null);
const cells = Array.from({ length: width * height }, (_, i) => {
  const x = i % width, y = Math.floor(i / width);
  return {
    x, y, visible: y < 2,
    remembered: { feat: shopAt(x, y) ? SHOP_FEAT : 1, traps: trapAt(x, y) ? [{ index: 1, name: "pit" }] : [], objects: pileAt(x, y) },
  };
}).filter(({ x, y }) => !unseen(x, y));
const level: KnownLevel = { token, levelId: 77, depth: 2, width, height, cells };
const stores = [{ feat: SHOP_FEAT, featName: "General Store", isHome: false, owner: { name: "Bilbo", purse: 5000 }, stock: [] }];
const world = { version: 1, token, turn: 100, player, inventory, equipment, quiver, floorHere: [], monsters, target: null, targetReadable: true, stores, spellbooks: [], level } as unknown as KnownWorldData;
const input: Api2InputState = { token, driver: { kind: "player" }, phase: "play", messagePending: false, prompt: null };
const trueLevel: Api2TrueLevel = {
  token, levelId: 77, depth: 2, width, height,
  cells: cells.flatMap(({ x, y }) => { const real = realAt(x, y); return real ? [{ x, y, ...real }] : []; }),
};

/* API 1: the snapshot and remembered map seams, and the live core and state. */
const monsterView = (m: KnownMonster) => ({ id: m.id, race: m.race, raceIndex: m.raceIndex, grid: m.grid, visible: m.visible, asleep: m.status.includes("asleep"), afraid: m.status.includes("afraid"), confused: false, stunned: m.status.includes("stunned"), unique: m.unique, questGuardian: m.questGuardian, finalGuardian: m.finalGuardian, raceFlags: fullRaceFlags[m.id] ?? [], hp: 5, maxHp: 9 });
const snapshot = { ...input, core: { ...world, monsters: monsters.map(monsterView) } };
const seam = {
  snapshot: () => snapshot,
  knownLevel: () => ({ ...level, cells: cells.map((cell) => { const real = realAt(cell.x, cell.y); return real ? { ...cell, actual: real } : cell; }) }),
};
const timed = Object.values(TMD).map(() => 0);
for (const [name, field] of [["CONFUSED", "confused"], ["FOOD", "food"], ["FAST", "fast"], ["OPP_FIRE", "resFire"], ["IMAGE", "image"]] as const) timed[TMD[name]] = status[field] ?? 0;
const game = {
  core: {
    TMD,
    squareIsVisibleTrap: (_state: unknown, grid: { x: number; y: number }) => trapAt(grid.x, grid.y),
    knownPile: (_state: unknown, grid: { x: number; y: number }) => pileAt(grid.x, grid.y).map((entry) => ({ sensed: entry.sensed, obj: entry })),
  },
  state: {
    actor: { grid: player.grid, player: { chp: player.hp, mhp: player.maxHp, timed } },
    levelSerial: 77,
    chunk: { depth: 2, width, height, feature: (grid: { x: number; y: number }) => ({ shopnum: shopAt(grid.x, grid.y) ? 1 : 0 }) },
    gear: { store: new Map([...inventory, ...equipment.filter((x) => x !== null), ...quiver].map((x) => [x.handle, x])) },
  },
};

/* API 2: a fake ModApi2 that answers from the same facts. */
function fakeApi(options: { truth?: boolean; grants?: boolean } = {}): Pick<ModApi2, "view" | "truth"> & { truthCalls: () => number } {
  const level = vi.fn(async () => api2Ok(trueLevel));
  const view = {
    input: async () => (options.grants === false ? api2NotGranted("state:interaction.read") : api2Ok(input)),
    world: async () => api2Ok(world),
  } as unknown as ModApi2["view"];
  return { view, ...(options.truth ? { truth: { level, monsters: vi.fn() } as unknown as Api2Truth } : {}), truthCalls: () => level.mock.calls.length };
}
const consent = (confirmed: boolean): v2.TruthConsent => ({
  status: vi.fn(async () => api2Ok({ confirmed })),
  request: vi.fn(async () => api2Ok({ confirmed })),
});

describe("API 2 host adapter parity", () => {
  it("reads the input, world, player, monsters and remembered map the API 1 adapter reads", async () => {
    const frame = await v2.readFrame(fakeApi());
    const in1 = v1.viewInput(seam), in2 = v2.viewInput(frame);
    expect(in2?.token).toEqual(in1?.token);
    expect(in2?.phase).toBe(in1?.phase);
    expect(in2?.prompt).toEqual(in1?.prompt);
    expect(v2.viewWorld(in2)?.inventory).toEqual(v1.viewWorld(in1)?.inventory);
    expect(v2.viewPlayer(in2)).toEqual(v1.viewPlayer(in1));
    const rows1 = v1.viewMonsters(in1)!, rows2 = v2.viewMonsters(in2)!;
    expect(rows2.map(({ raceFlags: _, ...rest }) => rest)).toEqual(rows1.map(({ raceFlags: _, hp: _hp, maxHp: _maxHp, ...rest }) => rest));
    /* The documented difference: API 1 lists the race's full flags, API 2 only the learned ones. */
    expect(rows1.map((m) => m.raceFlags)).toEqual(monsters.map((m) => fullRaceFlags[m.id]));
    expect(rows2.map((m) => m.raceFlags)).toEqual(monsters.map((m) => m.knownFlags));
    for (const [index, row] of rows2.entries()) {
      expect(row.raceFlags.length).toBeLessThan(rows1[index]!.raceFlags.length);
      for (const flag of row.raceFlags) expect(rows1[index]!.raceFlags).toContain(flag);
    }
    const known1 = v1.viewLevel(seam)!;
    expect(v2.viewLevel(frame)?.cells).toEqual(known1.cells.map(({ x, y, visible, remembered }) => ({ x, y, visible, remembered })));
  });

  it("answers the character reads the same way", async () => {
    const frame = await v2.readFrame(fakeApi());
    expect(v2.hasLiveState(frame)).toBe(v1.hasLiveState(game));
    expect(v2.playerGrid(frame)).toEqual(v1.playerGrid(game));
    expect(v2.playerHitPoints(frame)).toEqual(v1.playerHitPoints(game));
    expect(v2.playerHallucinating(frame)).toBe(v1.playerHallucinating(game));
    expect(v2.playerTimedEffects(frame)).toEqual(v1.playerTimedEffects(game));
    expect(v2.playerTimedEffects(frame)).toEqual(["FAST", "CONFUSED", "IMAGE", "FOOD", "OPP_FIRE"]);
    expect(v2.carriedGear(frame).map((x) => x.handle).sort()).toEqual([...v1.carriedGear(game)].map((x) => x.handle).sort());
    const test1 = v1.knownArtifactTest({ core: { liveObjectIsKnownArtifact: (x: KnownItem) => x.artifact } }), test2 = v2.knownArtifactTest();
    for (const carried of v2.carriedGear(frame)) expect(test2(carried)).toBe(test1(carried));
  });

  it("answers the level and grid reads the same way", async () => {
    const frame = await v2.readFrame(fakeApi());
    expect(v2.levelKey(frame)).toBe(v1.levelKey(game));
    expect(v2.levelDepth(frame)).toBe(v1.levelDepth(game));
    expect(v2.levelSize(frame)).toEqual(v1.levelSize(game));
    for (let y = -1; y <= height; y++) for (let x = -1; x <= width; x++) {
      const grid = { x, y };
      const inside = x >= 0 && y >= 0 && x < width && y < height;
      if (inside) expect(v2.gridHasVisibleTrap(frame, grid)).toBe(v1.gridHasVisibleTrap(game, grid));
      if (inside && !unseen(x, y)) expect(v2.gridIsShop(frame, grid)).toBe(v1.gridIsShop(game, grid));
      expect(v2.rememberedPile(frame, grid).map((entry) => entry.sensed)).toEqual(inside ? v1.rememberedPile(game, grid).map((entry) => entry.sensed) : []);
    }
    expect(v2.gridIsShop(frame, { x: 2, y: 1 })).toBe(true);
    /* The documented difference: on a shop square the character has never
     * seen, API 1 reads the real terrain and API 2 the remembered map. */
    expect(v2.viewLevel(frame)?.cells.some((cell) => unseen(cell.x, cell.y))).toBe(false);
    expect(v1.gridIsShop(game, { x: 0, y: 3 })).toBe(true);
    expect(v2.gridIsShop(frame, { x: 0, y: 3 })).toBe(false);
  });

  it("reads the real map only with the glow on and the player's confirmation", async () => {
    const api = fakeApi({ truth: true });
    expect(v2.truthLevel(await v2.readFrame(api)).cells).toEqual([]);
    expect(v2.truthLevel(await v2.readFrame(api, { revealHidden: true })).cells).toEqual([]);
    expect(v2.truthLevel(await v2.readFrame(api, { revealHidden: true, consent: consent(false) })).cells).toEqual([]);
    expect(v2.truthLevel(await v2.readFrame(api, { revealHidden: false, consent: consent(true) })).cells).toEqual([]);
    expect(api.truthCalls()).toBe(0);
    const frame = await v2.readFrame(api, { revealHidden: true, consent: consent(true) });
    expect(api.truthCalls()).toBe(1);
    expect(v2.truthLevel(frame).cells).toEqual(v1.truthLevel(seam.knownLevel() as Parameters<typeof v1.truthLevel>[0]).cells);
    expect(v2.truthLevel(frame).cells).toHaveLength(1);
  });

  it("reads no real map without a truth domain, and none when truth refuses", async () => {
    expect((await v2.readFrame(fakeApi(), { revealHidden: true, consent: consent(true) })).truth).toBeNull();
    const refusing = { ...fakeApi(), truth: { level: async () => api2Refused("not-confirmed", "the player has not confirmed this"), monsters: vi.fn() } as unknown as Api2Truth };
    expect((await v2.readFrame(refusing, { revealHidden: true, consent: consent(true) })).truth).toBeNull();
  });

  it("answers as API 1 does with no game: nothing to read", async () => {
    const frame = await v2.readFrame(fakeApi({ grants: false }));
    expect(v2.viewInput(frame)).toBeNull();
    const empty: v2.Api2Frame = { input: null, world: null, truth: null };
    const none = { core: undefined, state: undefined };
    expect(v2.hasLiveState(empty)).toBe(v1.hasLiveState(none));
    expect(v2.playerGrid(empty)).toBe(v1.playerGrid(none));
    expect(v2.playerHitPoints(empty)).toEqual(v1.playerHitPoints(none));
    expect(v2.playerHallucinating(empty)).toBe(v1.playerHallucinating(none));
    expect(v2.playerTimedEffects(empty)).toBe(v1.playerTimedEffects(none));
    expect(v2.levelKey(empty)).toBe(v1.levelKey(none));
    expect(v2.levelSize(empty)).toBe(v1.levelSize(none));
    expect(v2.gridHasVisibleTrap(empty, { x: 0, y: 0 })).toBe(v1.gridHasVisibleTrap(none, { x: 0, y: 0 }));
    expect(v2.gridIsShop(empty, { x: 0, y: 0 })).toBe(v1.gridIsShop(none, { x: 0, y: 0 }));
    expect(v2.rememberedPile(empty, { x: 0, y: 0 })).toEqual(v1.rememberedPile(none, { x: 0, y: 0 }));
    expect(v2.viewLevel(empty)).toBe(v1.viewLevel({}));
    expect(v2.truthLevel(empty)).toEqual(v1.truthLevel(null));
  });
});
