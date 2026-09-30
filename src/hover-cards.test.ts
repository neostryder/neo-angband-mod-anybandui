import { describe, expect, it, vi } from "vitest";
import { creatureRecall, knownCard, recallLine } from "./hover-cards.js";
import type { EffectMonsterView, RecallSnapshot } from "./seams.js";

const token = { epoch: 1, revision: 2 };
const monster = (over: Partial<EffectMonsterView> = {}): EffectMonsterView => ({
  id: 3, race: "cave spider", raceIndex: 41, grid: { x: 4, y: 4 }, visible: true, hp: 2, maxHp: 4,
  speed: 110, asleep: false, afraid: false, confused: false, stunned: false, poisoned: false, level: 2,
  raceFlags: [], unique: false, questGuardian: false, finalGuardian: false, spellFlags: [], ...over,
});
const snap = (monsters: readonly EffectMonsterView[] | null): RecallSnapshot => ({
  token, phase: "play", messagePending: false, prompt: null, core: { monsters },
});
const recall = (text: string) => ({ token, title: "cave spider", text });

describe("monster recall line", () => {
  it("skips the title and the empty kill record, and keeps one sentence", () => {
    expect(recallLine(recall("The cave spider ('S')\nNo battles to the death are recalled.  It is a black spider that moves in swarms.  It is fast.\n")))
      .toBe("It is a black spider that moves in swarms.");
    expect(recallLine(recall("The cave spider ('S')\nYou have killed at least 12 of these creatures.  It is a black spider.")))
      .toBe("You have killed at least 12 of these creatures.");
  });

  it("cuts a long sentence at a word and answers null for nothing to say", () => {
    const line = recallLine(recall(`Title\n${"A very long description of a creature that goes on ".repeat(4)}.`))!;
    expect(line.length).toBeLessThanOrEqual(90);
    expect(line.endsWith("...")).toBe(true);
    expect(line).not.toMatch(/\s\.\.\.$/);
    expect(recallLine(recall("Only a title"))).toBeNull();
    expect(recallLine(null)).toBeNull();
  });
});

describe("creature recall gate", () => {
  it("looks up only a visible monster on the hovered grid", () => {
    const monsterRecall = vi.fn(() => recall("Title\nIt is a black spider."));
    expect(creatureRecall({ snapshot: () => snap([monster()]), inspect: { monsterRecall } }, { x: 4, y: 4 })).toBe("It is a black spider.");
    expect(monsterRecall).toHaveBeenCalledWith(41);
    expect(creatureRecall({ snapshot: () => snap([monster({ visible: false })]), inspect: { monsterRecall } }, { x: 4, y: 4 })).toBeNull();
    expect(creatureRecall({ snapshot: () => snap([monster()]), inspect: { monsterRecall } }, { x: 5, y: 4 })).toBeNull();
    expect(creatureRecall({ snapshot: () => snap(null), inspect: { monsterRecall } }, { x: 4, y: 4 })).toBeNull();
    expect(monsterRecall).toHaveBeenCalledTimes(1);
  });

  it("gives no line for an unseen race, a missing read, or a refused capability", () => {
    expect(creatureRecall({ snapshot: () => snap([monster()]), inspect: { monsterRecall: () => null } }, { x: 4, y: 4 })).toBeNull();
    expect(creatureRecall({ snapshot: () => snap([monster()]), inspect: {} }, { x: 4, y: 4 })).toBeNull();
    expect(creatureRecall({ snapshot: () => snap([monster()]) }, { x: 4, y: 4 })).toBeNull();
    const refused = () => { throw new Error("state:monsters.read not granted"); };
    expect(creatureRecall({ snapshot: () => snap([monster()]), inspect: { monsterRecall: refused } }, { x: 4, y: 4 })).toBeNull();
  });
});

describe("dungeon card recall", () => {
  const core = { describeLookGrid: () => ({ text: "a cave spider (asleep)", mon: { hp: 2, maxhp: 4 } }), TMD: { IMAGE: 0 } };
  it("adds the line under a described creature only", () => {
    const card = knownCard(core, { actor: { grid: { x: 1, y: 1 }, player: { timed: [0] } } }, { x: 4, y: 4 }, false, "It is a black spider.")!;
    expect(card.split("\n")).toEqual(["Creature", "a cave spider (asleep)", "[#####-----]", "It is a black spider."]);
    const terrain = { describeLookGrid: () => ({ text: "a granite wall" }) };
    expect(knownCard(terrain, {}, { x: 4, y: 4 }, false, "It is a black spider.")).not.toContain("spider.");
    const self = knownCard(core, { actor: { grid: { x: 4, y: 4 }, player: { timed: [0] } } }, { x: 4, y: 4 }, false, "It is a black spider.")!;
    expect(self).not.toContain("black spider");
  });
  it("drops the line while hallucinating", () => {
    const card = knownCard(core, { actor: { grid: { x: 1, y: 1 }, player: { timed: [3] } } }, { x: 4, y: 4 }, false, "It is a black spider.")!;
    expect(card).toContain("Appearance unreliable");
    expect(card).not.toContain("black spider");
  });
});
