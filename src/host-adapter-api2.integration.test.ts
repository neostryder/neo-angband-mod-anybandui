import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import * as core from "@rpgm-tools/neo-angband-core";
import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import * as v1 from "./host-adapter.js";
import * as v2 from "./host-adapter-api2.js";

/* The two adapters over one real game. The API 1 side gets the view and core
 * the plugin context hands this mod today; the API 2 side gets Core's own
 * API 2 host, loaded from a Neo Angband checkout. Set NEO_ANGBAND_REPO to run. */
const checkout = process.env["NEO_ANGBAND_REPO"];
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../manifest.json", import.meta.url)), "utf8")) as { data?: { capabilities?: string[] }; capabilities?: string[] };
const capabilities: readonly string[] = (manifest.data ?? manifest).capabilities ?? [];

function startGame(root: string, depth: number) {
  const json = (name: string): unknown => JSON.parse(readFileSync(join(root, "packages", "content", "pack", `${name}.json`), "utf8"));
  const records = (name: string): unknown => (json(name) as { records: unknown[] }).records;
  const pack = {
    store: records("store"), constants: json("constants"), terrain: records("terrain"),
    roomTemplates: records("room_template"), vaults: records("vault"), dungeonProfiles: records("dungeon_profile"),
    obj: { objectBase: json("object_base"), object: json("object"), egoItem: json("ego_item"),
      artifact: json("artifact"), curse: json("curse"), brand: json("brand"), slay: json("slay"),
      activation: json("activation"), objectProperty: json("object_property"), flavor: json("flavor") },
    mon: { pain: records("pain"), blowMethods: records("blow_methods"), blowEffects: records("blow_effects"),
      monsterSpells: records("monster_spell"), monsterBases: records("monster_base"),
      monsters: records("monster"), summons: records("summon"), pits: records("pit") },
    player: { races: records("p_race"), classes: records("class"), properties: records("player_property"),
      timed: records("player_timed"), shapes: records("shape"), bodies: records("body"),
      history: records("history"), realms: records("realm") },
  };
  return core.startGame(pack as never, { seed: 4242, depth });
}

describe.skipIf(!checkout)("API 2 host adapter over a real game", () => {
  for (const depth of [0, 3]) it(`gives the API 1 adapter's answers on a level at depth ${depth}`, async () => {
    const hostModule = await import(/* @vite-ignore */ pathToFileURL(join(checkout!, "packages", "web", "src", "mod-api2-host.ts")).href);
    const game = startGame(checkout!, depth);
    const state = game.state;
    core.wizLightLevel(state, true, true);
    /* That lights the level and learns every pile, but leaves plain floor
     * unremembered. Remember every other floor square that holds a pile, so
     * both kinds of square get compared below. */
    let alternate = false;
    for (let y = 0; y < state.chunk.height; y++) for (let x = 0; x < state.chunk.width; x++) {
      if (core.knownPile(state, { x, y }).length && (alternate = !alternate)) core.squareMemorize(state, { x, y });
    }
    state.actor.player.timed[core.TMD.OPP_FIRE] = 5;
    /* Core numbers a level only from the first level change on. Before that,
     * API 1's levelKey falls back to the depth and levelId reads 0, so the
     * comparison is made as it stands after a few changes. */
    state.levelSerial = 4;
    const grants = { has: (capability: string) => capabilities.includes(capability) };
    const input = { token: core.inputToken(state), driver: { kind: "player" }, phase: "play", messagePending: false, prompt: null };

    // API 1: the snapshot, the remembered map and the live core and state.
    const view = core.createAgentView(state, undefined, {}, grants);
    const seam = { snapshot: () => ({ ...input, core: view.capture!() }), knownLevel: () => view.knownLevel!() };
    const live = { core, state };

    // API 2: Core's host, with the truth domain it builds once the player grants state:map-actual.read.
    const ctx = { id: "anybandui", engine: "test", flags: {}, newCharacter: false, log: () => {}, state, snapshot: () => input, prefs: { get: () => null, set: () => {} } };
    const api: ModApi2 = hostModule.createApi2Host(ctx, { grants, firstParty: { manage: true, truth: true } });
    const frame = await v2.readFrame(api, { revealHidden: true });
    expect(frame.world).not.toBeNull();
    expect(frame.truth).not.toBeNull();

    const in1 = v1.viewInput(seam), in2 = v2.viewInput(frame);
    /* API 2's status names grades where API 1 counts turns, and its recall and descent are booleans. */
    const shared = (p: object | undefined) => { const { status: _s, recall: _r, descent: _d, ...rest } = p as Record<string, unknown>; return rest; };
    const player1 = v1.viewPlayer(in1) as unknown as { status: Record<string, number>; recall: number; descent: number }, player2 = v2.viewPlayer(in2)!;
    expect(shared(player2)).toEqual(shared(player1));
    for (const [field, grade] of Object.entries(player2.status)) {
      if (field === "food" || field === "foodGrade" || field === "fearful") continue;
      expect(grade !== null).toBe(player1.status[field]! > 0);
    }
    expect(player2.status.fearful).toBe(player1.status["fearful"]);
    expect([player2.recall, player2.descent]).toEqual([player1.recall > 0, player1.descent > 0]);
    /* A known item carries what its name says about recharging (charging, unknownRunes) where API 1's carries the turns left (timeout). */
    const sharedItem = (item: object) => { const { timeout: _t, charging: _c, unknownRunes: _u, ...rest } = item as Record<string, unknown>; return rest; };
    expect(v2.viewWorld(in2)?.inventory?.map(sharedItem)).toEqual(v1.viewWorld(in1)?.inventory?.map(sharedItem));
    /* A known monster's id is a handle given in the order the character first perceives monsters on the level, not API 1's monster index, so ids are left out. */
    const seen = <M extends { race: string; grid: unknown; visible: boolean; asleep: boolean; afraid: boolean; unique?: boolean; finalGuardian?: boolean }>(list: readonly M[] | null | undefined) =>
      (list ?? []).filter((m) => m.visible).map((m) => ({ race: m.race, grid: m.grid, asleep: m.asleep, afraid: m.afraid, unique: m.unique, finalGuardian: m.finalGuardian }));
    expect(seen(v2.viewMonsters(in2))).toEqual(seen(v1.viewMonsters(in1)));
    const known1 = v1.viewLevel(seam)!;
    expect(v2.viewLevel(frame)?.cells).toEqual(known1.cells.map(({ x, y, visible, remembered }) => ({ x, y, visible, remembered })));
    expect(v2.truthLevel(frame).cells).toEqual(v1.truthLevel(known1).cells);
    expect(v2.truthLevel(frame).cells.length).toBeGreaterThan(0);

    expect(v2.hasLiveState(frame)).toBe(v1.hasLiveState(live));
    expect(v2.playerGrid(frame)).toEqual(v1.playerGrid(live));
    expect(v2.playerHitPoints(frame)).toEqual(v1.playerHitPoints(live));
    expect(v2.playerHallucinating(frame)).toBe(v1.playerHallucinating(live));
    expect(v2.playerTimedEffects(frame)).toEqual(v1.playerTimedEffects(live));
    expect(v2.playerTimedEffects(frame)).toContain("OPP_FIRE");
    expect(v2.carriedGear(frame).length).toBe([...v1.carriedGear(live)].length);
    expect(v2.levelKey(frame)).toBe(v1.levelKey(live));
    expect(v2.levelDepth(frame)).toBe(v1.levelDepth(live));
    expect(v2.levelSize(frame)).toEqual(v1.levelSize(live));

    const { width, height } = v2.levelSize(frame)!;
    /* The remembered map lists only squares whose terrain the character
     * knows, so an object remembered on an unknown square (a detected object,
     * say) has no API 2 cell to sit on. API 1's pile read still returns it.
     * docs/API2-MIGRATION.md carries this as a Core request. */
    const listed = new Set(known1.cells.map((cell) => cell.y * width + cell.x));
    let shops = 0, piles = 0, unlisted = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const grid = { x, y };
      expect(v2.gridHasVisibleTrap(frame, grid)).toBe(v1.gridHasVisibleTrap(live, grid));
      const shop = v2.gridIsShop(frame, grid);
      expect(shop).toBe(v1.gridIsShop(live, grid));
      const pile2 = v2.rememberedPile(frame, grid).map((entry) => entry.sensed);
      if (listed.has(y * width + x)) expect(pile2).toEqual(v1.rememberedPile(live, grid).map((entry) => !!entry.sensed));
      else if (v1.rememberedPile(live, grid).length) { expect(pile2).toEqual([]); unlisted++; }
      if (shop) shops++;
      if (pile2.length) piles++;
    }
    if (depth === 0) expect(shops).toBeGreaterThan(0);
    else expect(Math.min(piles, unlisted)).toBeGreaterThan(0);
  });
});
