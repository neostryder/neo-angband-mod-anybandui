import { describe, expect, it, vi } from "vitest";
import { bindMonsters, bindPlayer, blankMonster, blankPlayer, Chunk, createAgentView, deleteMonster, DEFAULT_GAME_CONSTANTS, FeatureRegistry, IgnoreSettings, makeRuneEnv, newGear, newKnownMap, newTargetState, Rng, type AgentView, type GameState, type TargetView } from "@rpgm-tools/neo-angband-core";
import { loadPackRecords } from "@rpgm-tools/neo-angband-content/pack";
import type { KnownMonster, KnownWorldData } from "@rpgm-tools/neo-angband-mod-sdk";
import { FakeNode } from "../menus/fake-dom.js";
import { createSource } from "../view-model/source.js";
import { createPanelContent } from "./panel-host.js";
import { renderTrackedCreature } from "./tracked-creature.js";

const players = bindPlayer({
  races: loadPackRecords("p_race"), classes: loadPackRecords("class"), properties: loadPackRecords("player_property"),
  timed: loadPackRecords("player_timed"), shapes: loadPackRecords("shape"), bodies: loadPackRecords("body"),
  history: loadPackRecords("history"), realms: loadPackRecords("realm"),
});
const monsters = bindMonsters({
  pain: loadPackRecords("pain"), blowMethods: loadPackRecords("blow_methods"), blowEffects: loadPackRecords("blow_effects"),
  monsterSpells: loadPackRecords("monster_spell"), monsterBases: loadPackRecords("monster_base"),
  monsters: loadPackRecords("monster"), summons: loadPackRecords("summon"), pits: loadPackRecords("pit"),
});
const features = new FeatureRegistry(loadPackRecords("terrain"));

function creature(over: Partial<KnownMonster> = {}): KnownMonster {
  return {
    id: 2, race: "Fire drake", raceIndex: 41, glyph: "d", grid: { x: 4, y: 5 }, visible: true,
    health: "wounded", living: true, look: "wounded, afraid", status: ["afraid"],
    raceLevel: 30, raceSpeed: 110, unique: false, questGuardian: false, finalGuardian: false,
    averageHp: null, blows: [{ method: "BITE", effect: "FIRE", damage: { base: 2, dice: 3, sides: 6, mBonus: 0 } },
      { method: "CLAW", effect: "HURT", damage: null }],
    knownSpells: ["BR_FIRE", "BO_ELEC"], spellFrequency: { percent: 20, exact: false },
    innateFrequency: { percent: 10, exact: true }, knownFlags: ["IM_FIRE", "HURT_COLD", "NO_SLEEP", "OPEN_DOOR"],
    ...over,
  };
}

function fixture(monster = creature(), text: string | null = "Fire drake ('d')\nIt may carry one or two objects.") {
  let target: TargetView | null = { midx: 37, grid: { x: 4, y: 5 } };
  let world: ReturnType<NonNullable<AgentView["knownWorld"]>> & KnownWorldData = {
    version: 1, monsters: [monster], target: { monster: monster.id, grid: monster.grid }, token: { epoch: 1, revision: 1 },
    turn: 0, player: null, inventory: null, equipment: null, equipmentSlots: null, quiver: null, floorHere: null,
    monstersHidden: null, targetReadable: true, stores: null, spellbooks: null, level: null,
  };
  const player = blankPlayer(players.races[0]!, players.classes[0]!, players.bodies[0]!);
  player.fullName = "Ari";
  const combat = { toH: 0, toD: 0, ac: 0, toA: 0, skills: [], numBlows: 100, ammoMult: 1, numShots: 0, ammoTval: 0, blessWield: false };
  const state: GameState = {
    rng: new Rng(1), chunk: new Chunk(features, 10, 10),
    actor: { player, grid: { x: 1, y: 1 }, energy: 0, speed: 110, totalEnergy: 0, combat, knownCombat: combat,
      defense: { ac: 0, toA: 0 }, weapon: null, stealth: 0, light: 1, unlight: false },
    gear: newGear(), monsters: [null], groups: [null], floor: new Map(), traps: new Map(), known: newKnownMap(10, 10),
    target: newTargetState(), ignore: new IgnoreSettings(), lore: new Map(), turn: 0, z: { ...DEFAULT_GAME_CONSTANTS },
    brands: [null], slays: [null], tempBrandSlay: { hasBrand: () => false, hasSlay: () => false }, curses: [],
    runeEnv: makeRuneEnv(() => null, () => false), playing: true, isDead: false, generateLevel: false, nextCommand: () => null,
  };
  state.chunk.depth = 1;
  const liveCreature = blankMonster(monsters.races[1]!);
  liveCreature.midx = 37;
  liveCreature.grid = { x: 4, y: 5 };
  liveCreature.hp = 999;
  liveCreature.maxhp = 999;
  state.monsters[37] = liveCreature;
  const recall = vi.fn(() => text === null ? null : { token: world.token, title: monster.race, text });
  const view: AgentView = {
    ...createAgentView(state), target: () => target, knownWorld: () => world, monsterRecall: recall,
  };
  const source = createSource({ state, core: { createAgentView: () => view } });
  const root = new FakeNode();
  const mount = root as unknown as HTMLElement;
  const model = () => source.snapshot()!;
  return { root, mount, model, recall, state, view, liveCreature,
    setTarget: (next: TargetView | null) => { target = next; },
    setWorld: (monsters: KnownMonster[], id: number | null = monsters[0]?.id ?? null) => {
      world = { ...world, monsters, target: id === null ? null : { monster: id, grid: monster.grid }, token: { ...world.token, revision: world.token.revision + 1 } };
    },
  };
}

describe("tracked creature recall", () => {
  it("renders learned blows, spells, frequencies, flags, glyph and look health without reading actual facts", () => {
    const record: KnownMonster & { hp: number; maxHp: number; raceFlags: string[]; spellFlags: string[] } = {
      ...creature({ raceLevel: 999, raceSpeed: 999, averageHp: 999, unique: true, questGuardian: true, finalGuardian: true,
        knownFlags: ["IM_FIRE", "HURT_COLD", "NO_SLEEP", "OPEN_DOOR", "UNIQUE", "QUESTOR", "FINAL_GUARDIAN", "SECRET_FLAG"] }),
      hp: 999, maxHp: 999, raceFlags: ["SECRET_RACE_FLAG"], spellFlags: ["SECRET_SPELL"],
    };
    const f = fixture(record);
    const actualRead = vi.spyOn(f.view, "monsters");
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("d  Fire drake");
    expect(f.root.text()).toContain("Wounded Afraid");
    expect(f.root.text()).toContain("Bite - fire (3d6+2)");
    expect(f.root.text()).toContain("Claw - hurt");
    expect(f.root.text()).toContain("Breathe fire");
    expect(f.root.text()).toContain("Lightning bolt");
    expect(f.root.text()).toContain("Spell frequency: about 20%");
    expect(f.root.text()).toContain("Innate frequency: 10%");
    expect(f.root.text()).toContain("Resistances Fire");
    expect(f.root.text()).toContain("Status protections Cannot be put to sleep");
    expect(f.root.text()).toContain("Vulnerabilities Cold");
    expect(f.root.text()).toContain("Known traits Open door");
    expect(f.root.text()).toContain("Recall It may carry one or two objects.");
    expect(f.root.text()).not.toMatch(/secret|999|unique|questor|guardian/i);
    expect(actualRead).not.toHaveBeenCalled();
    expect(f.root.walk().find((n) => n.className === "creature-glyph")?.attributes["aria-hidden"]).toBe("true");
    expect(f.root.all("summary").map((n) => n.textContent)).toEqual(["Melee", "Spells seen", "Casting frequency", "Resistances", "Status protections", "Vulnerabilities", "Known traits", "Recall"]);
    expect(f.root.walk().filter((n) => n.attributes["role"] === "region")).toHaveLength(0);
    expect(f.root.walk().filter((n) => n.className === "creature-facts").every((n) => (n as unknown as HTMLElement).tabIndex === 0)).toBe(true);
    expect(f.recall).toHaveBeenCalledWith(41);
  });

  it("omits unlearned facts and unknown frequencies and damage", () => {
    const f = fixture(creature({ blows: [], knownSpells: [], knownFlags: [], spellFrequency: null, innateFrequency: null }), null);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.all("details")).toHaveLength(0);
    expect(f.root.text()).toBe("Tracked creature d  Fire drake Wounded Afraid");
    expect(f.root.text()).not.toMatch(/Secret|SECRET|999|3d6|frequency|Recall/);
    f.setWorld([creature({ blows: [{ method: "CLAW", effect: "HURT", damage: null }], spellFrequency: null, innateFrequency: null })]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Claw - hurt");
    expect(f.root.text()).not.toMatch(/3d6|frequency/);
  });

  it("keeps the last visible facts out of sight and refreshes them when seen again", () => {
    const f = fixture();
    expect(f.model().player.tracked_creature?.id).toBe(2);
    f.setWorld([]);
    const hidden = f.model();
    expect(hidden.player.tracked_creature?.id).toBe(2);
    expect(hidden.player.tracked_creature?.visible).toBe(false);
    renderTrackedCreature(f.mount, hidden);
    expect(f.root.text()).toContain("Fire drake Out of sight Wounded Afraid");
    expect(f.root.text()).toContain("Bite - fire (3d6+2)");
    expect(f.recall).toHaveBeenCalledTimes(1);
    f.setWorld([creature({ visible: false, knownSpells: ["SECRET_SPELL"], look: "SECRET_LOOK", status: [] })]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Fire drake Out of sight Wounded Afraid");
    expect(f.root.text()).not.toMatch(/SECRET|Secret/);
    expect(f.recall).toHaveBeenCalledTimes(1);
    f.setWorld([creature({ knownSpells: ["HEAL"], look: "unhurt", status: [] })]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Unhurt");
    expect(f.root.text()).toContain("Heal");
    expect(f.root.text()).not.toMatch(/Out of sight|Afraid|Breathe fire|Secret/);
  });

  it("does not retain another target's facts or facts from another level", () => {
    const f = fixture();
    f.model();
    f.setTarget({ midx: 38, grid: { x: 5, y: 5 } });
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toBe("Tracked creature Out of sight");
    f.setTarget({ midx: 37, grid: { x: 4, y: 5 } });
    f.setWorld([creature()]);
    f.model();
    f.state.chunk.depth = 2;
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toBe("Tracked creature Out of sight");
    f.setTarget(null);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("No creature tracked");
    f.setTarget({ midx: 0, grid: { x: 5, y: 5 } });
    expect(f.model().player.tracked_creature).toBeUndefined();
  });

  it("skips unchanged facts and preserves expanded sections and keyboard focus on a fact update", () => {
    const f = fixture();
    const render = vi.fn(renderTrackedCreature);
    const content = createPanelContent(f.mount, [{ key: "tracked", select: (m) => m.player.tracked_creature, render }]);
    content.render(f.model());
    f.setWorld([creature({ grid: { x: 8, y: 5 } })]);
    const unrelated = f.model();
    unrelated.player.hp = 1;
    content.render(unrelated);
    expect(render).toHaveBeenCalledTimes(1);
    const details = f.root.all("details").find((n) => n.all("summary")[0]?.textContent === "Resistances")! as FakeNode & { open: boolean };
    details.open = true;
    details.fire("toggle");
    details.all("summary")[0]!.focus();
    f.setWorld([creature({ knownFlags: ["IM_FIRE", "IM_COLD"] })]);
    content.render(f.model());
    expect(render).toHaveBeenCalledTimes(2);
    expect((f.root.all("details").find((n) => n.all("summary")[0]?.textContent === "Resistances") as FakeNode & { open: boolean }).open).toBe(true);
    expect(f.root.activeElement?.textContent).toBe("Resistances");
    expect(f.root.all("details").find((n) => n.all("summary")[0]?.textContent === "Resistances")).toBe(details);
  });

  it("keeps each creature's visible facts when targets change or are cleared", () => {
    const f = fixture();
    f.model();
    const other = blankMonster(monsters.races[1]!);
    other.midx = 38;
    f.state.monsters[38] = other;
    f.setTarget({ midx: 38, grid: { x: 5, y: 5 } });
    f.setWorld([creature({ id: 3, race: "Cold drake", knownSpells: ["BR_COLD"] })]);
    f.model();
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Cold drake Out of sight");
    f.setTarget(null);
    expect(f.model().player.tracked_creature).toBeUndefined();
    f.setTarget({ midx: 37, grid: { x: 4, y: 5 } });
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Fire drake Out of sight");
    expect(f.root.text()).toContain("Breathe fire");
    expect(f.root.text()).not.toContain("Cold drake");
    expect(f.recall).toHaveBeenCalledTimes(2);
  });

  it("does not give a new creature facts from a reused monster slot", () => {
    const f = fixture();
    f.model();
    const replacement = blankMonster(monsters.races[1]!);
    replacement.midx = 37;
    f.state.monsters[37] = replacement;
    f.setWorld([creature({ id: 3, race: "SECRET_CREATURE", visible: false, knownSpells: ["SECRET_SPELL"] })]);
    const model = f.model();
    expect(model.player.tracked_creature?.id).toBe(3);
    renderTrackedCreature(f.mount, model);
    expect(f.root.text()).toBe("Tracked creature Out of sight");
    expect(f.recall).toHaveBeenCalledTimes(1);
  });

  it("keeps the creature identity when compaction moves its monster index", () => {
    const f = fixture();
    f.model();
    f.state.monsters[37] = null;
    f.liveCreature.midx = 9;
    f.state.monsters[9] = f.liveCreature;
    f.setTarget({ midx: 9, grid: { x: 4, y: 5 } });
    f.setWorld([]);
    const model = f.model();
    expect(model.player.tracked_creature?.id).toBe(2);
    renderTrackedCreature(f.mount, model);
    expect(f.root.text()).toContain("Fire drake Out of sight");
    expect(f.root.text()).toContain("Bite - fire (3d6+2)");
  });

  it("drops retained facts when the tracked creature dies", () => {
    const f = fixture();
    f.model();
    deleteMonster(f.state, 37);
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toBe("Tracked creature Out of sight");
    expect(f.root.all("details")).toHaveLength(0);
  });

  it("resets on a new level serial at the same depth and keeps a refreshed chunk on the same level", () => {
    const f = fixture();
    f.state.levelSerial = 10;
    f.model();
    f.state.chunk = new Chunk(features, 10, 10);
    f.state.chunk.depth = 1;
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Fire drake Out of sight");
    f.state.levelSerial = 11;
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toBe("Tracked creature Out of sight");
  });

  it("clears the previous character's facts on player death and character replacement", () => {
    const f = fixture();
    f.model();
    f.state.isDead = true;
    expect(f.model().player.tracked_creature).toBeUndefined();
    f.state.isDead = false;
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toBe("Tracked creature Out of sight");
    f.setWorld([creature()]);
    f.model();
    f.state.actor.player = blankPlayer(players.races[0]!, players.classes[0]!, players.bodies[0]!);
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toBe("Tracked creature Out of sight");
  });

  it.each([[0, null], [0.4, null], [12.4, "12%"], [12.6, "13%"]] as const)("rounds frequency %s and hides zero without requiring a learned spell", (percent, expected) => {
    const f = fixture(creature({ knownSpells: [], spellFrequency: { percent, exact: false }, innateFrequency: { percent: 0, exact: true } }));
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.all("summary").map((n) => n.textContent)).not.toContain("Spells seen");
    expect(f.root.text()).not.toContain("Innate frequency");
    if (expected) expect(f.root.text()).toContain(`Casting frequency Spell frequency: about ${expected}`);
    else expect(f.root.text()).not.toContain("frequency");
  });

  it("uses the hover recall sentence limit and skips an empty battle record", () => {
    const f = fixture(creature(), `Fire drake\nNo battles to the death are recalled. ${"A very long learned description ".repeat(15)}. A second sentence.`);
    renderTrackedCreature(f.mount, f.model());
    const recall = f.root.all("details").find((n) => n.all("summary")[0]?.textContent === "Recall")!;
    const text = recall.walk().find((n) => n.className === "creature-facts")!.text();
    expect(text.length).toBeLessThanOrEqual(90);
    expect(text).toMatch(/^A very long learned description .*\.\.\.$/);
    expect(text).not.toMatch(/No battles|second sentence/);
    const empty = fixture(creature(), "Fire drake\nNo battles to the death are recalled.");
    renderTrackedCreature(empty.mount, empty.model());
    expect(empty.root.all("summary").map((n) => n.textContent)).not.toContain("Recall");
  });

  it("preserves sections during health changes and announces the muted sight state", () => {
    const f = fixture();
    renderTrackedCreature(f.mount, f.model());
    const sections = f.root.all("details");
    const sight = f.root.walk().find((n) => n.attributes["role"] === "status")!;
    f.setWorld([creature({ look: "almost dead", status: [] })]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.all("details").every((section, index) => section === sections[index])).toBe(true);
    f.setWorld([]);
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.walk()).toContain(sight);
    expect(sight.textContent).toBe("Out of sight");
    expect(sight.className).toBe("muted");
    expect(sight.attributes["aria-atomic"]).toBe("true");
  });

  it("uses the shadow root's focus and falls back to the heading when a focused section disappears", () => {
    const f = fixture();
    const document = new FakeNode("document");
    const host = document.appendChild(new FakeNode());
    const shadow = new FakeNode("shadow-root");
    shadow.host = host;
    shadow.appendChild(f.root);
    document.activeElement = host;
    renderTrackedCreature(f.mount, f.model());
    const resistance = f.root.all("details").find((n) => n.all("summary")[0]?.textContent === "Resistances")!;
    resistance.all("summary")[0]!.focus();
    f.setWorld([creature({ look: "unhurt" })]);
    renderTrackedCreature(f.mount, f.model());
    expect(shadow.activeElement).toBe(resistance.all("summary")[0]);
    expect(document.activeElement).toBe(host);
    f.setWorld([creature({ knownFlags: [] })]);
    renderTrackedCreature(f.mount, f.model());
    expect(shadow.activeElement?.textContent).toBe("Tracked creature");
    expect(shadow.activeElement?.attributes["role"]).toBe("heading");
    expect(document.activeElement).toBe(host);
  });

  it("keeps learned structured facts when recall is refused", () => {
    const f = fixture();
    f.recall.mockImplementation(() => { throw new Error("not granted"); });
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Bite - fire (3d6+2)");
    expect(f.root.all("summary").map((n) => n.textContent)).not.toContain("Recall");
  });

  it("formats known fixed, dice and level-dependent damage without calculating unknown values", () => {
    const f = fixture(creature({ blows: [
      { method: "HIT", effect: "HURT", damage: { base: 5, dice: 0, sides: 0, mBonus: 0 } },
      { method: "HIT", effect: "HURT", damage: { base: -1, dice: 2, sides: 4, mBonus: 3 } },
    ] }));
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("Hit - hurt (5)");
    expect(f.root.text()).toContain("Hit - hurt (2d4-1+M3)");
  });
});
