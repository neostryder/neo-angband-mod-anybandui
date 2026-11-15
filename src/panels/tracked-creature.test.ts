import { describe, expect, it, vi } from "vitest";
import type { AgentView, GameState, TargetView } from "@rpgm-tools/neo-angband-core";
import type { KnownMonster, KnownWorldData } from "@rpgm-tools/neo-angband-mod-sdk";
import { FakeNode } from "../menus/fake-dom.js";
import { createSource } from "../view-model/source.js";
import { createPanelContent } from "./panel-host.js";
import { renderTrackedCreature } from "./tracked-creature.js";

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
  let world: Pick<KnownWorldData, "monsters" | "target" | "token"> = { monsters: [monster], target: { monster: monster.id, grid: monster.grid }, token: { epoch: 1, revision: 1 } };
  const recall = vi.fn(() => text === null ? null : { token: world.token, title: monster.race, text });
  const view = {
    player: () => ({ race: "Human", cls: "Mage", hp: 30, maxHp: 40, sp: 5, maxSp: 10,
      exp: 0, maxExp: 0, level: 1, maxLevel: 1, stats: [], gold: 0, ac: 0, speed: 110, depth: 1, light: 1, status: { food: 100 } }),
    target: () => target,
    knownWorld: () => world,
    monsterRecall: recall,
    monsters: () => [{ id: 37, race: "Secret creature", raceFlags: ["SECRET_FLAG"], spellFlags: ["SECRET_SPELL"], hp: 999, maxHp: 999 }],
  } as unknown as AgentView;
  const state = { chunk: {}, actor: { player: { fullName: "Ari", upkeep: { newSpells: 0 } } } } as unknown as GameState;
  const source = createSource({ state, core: { createAgentView: () => view } });
  const root = new FakeNode();
  const mount = root as unknown as HTMLElement;
  const model = () => source.snapshot()!;
  return { root, mount, model, recall, state,
    setTarget: (next: TargetView | null) => { target = next; },
    setWorld: (monsters: KnownMonster[], id: number | null = monsters[0]?.id ?? null) => {
      world = { ...world, monsters, target: id === null ? null : { monster: id, grid: monster.grid }, token: { ...world.token, revision: world.token.revision + 1 } };
    },
  };
}

describe("tracked creature recall", () => {
  it("renders learned blows, spells, frequencies, flags, glyph and look health without reading actual facts", () => {
    const f = fixture();
    renderTrackedCreature(f.mount, f.model());
    expect(f.root.text()).toContain("d  Fire drake");
    expect(f.root.text()).toContain("Wounded Afraid");
    expect(f.root.text()).toContain("Bite - fire (3d6+2)");
    expect(f.root.text()).toContain("Claw - hurt");
    expect(f.root.text()).toContain("Breathe fire");
    expect(f.root.text()).toContain("Lightning bolt");
    expect(f.root.text()).toContain("Spell frequency: about 20%");
    expect(f.root.text()).toContain("Innate frequency: 10%");
    expect(f.root.text()).toContain("Resistances Fire Sleep");
    expect(f.root.text()).toContain("Vulnerabilities Cold");
    expect(f.root.text()).toContain("Known traits Open door");
    expect(f.root.text()).toContain("Recall It may carry one or two objects.");
    expect(f.root.text()).not.toMatch(/Secret|SECRET|999/);
    expect(f.root.walk().find((n) => n.className === "creature-glyph")?.attributes["aria-hidden"]).toBe("true");
    expect(f.root.all("summary").map((n) => n.textContent)).toEqual(["Melee", "Spells seen", "Resistances", "Vulnerabilities", "Known traits", "Recall"]);
    expect(f.root.walk().filter((n) => n.attributes["role"] === "region").every((n) => n.attributes["aria-label"]?.endsWith(" details"))).toBe(true);
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
    const seen = f.model().player.tracked_creature;
    f.setWorld([]);
    const hidden = f.model();
    expect(hidden.player.tracked_creature).toEqual({ ...seen, visible: false });
    renderTrackedCreature(f.mount, hidden);
    expect(f.root.text()).toContain("Fire drake Out of sight Wounded Afraid");
    expect(f.root.text()).toContain("Bite - fire (3d6+2)");
    expect(f.recall).toHaveBeenCalledTimes(1);
    f.setWorld([creature({ visible: false, knownSpells: ["SECRET_SPELL"], look: "unhurt" })]);
    expect(f.model().player.tracked_creature).toEqual(hidden.player.tracked_creature);
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
    f.state.chunk = {} as GameState["chunk"];
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
    const details = f.root.all("details")[2]! as FakeNode & { open: boolean };
    details.open = true;
    details.fire("toggle");
    details.all("summary")[0]!.focus();
    f.setWorld([creature({ knownFlags: ["IM_FIRE", "IM_COLD"] })]);
    content.render(f.model());
    expect(render).toHaveBeenCalledTimes(2);
    expect((f.root.all("details")[2] as FakeNode & { open: boolean }).open).toBe(true);
    expect(f.root.activeElement?.textContent).toBe("Resistances");
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
