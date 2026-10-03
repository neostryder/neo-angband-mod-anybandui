import { describe, expect, it, vi } from "vitest";
import type { BirthCatalogue, BirthDraftView, ModBirthSession } from "@rpgm-tools/neo-angband-core";
import { BirthWizard, choiceView, formatStat, nextStep, previewSummary, signed, skillLabel, statKey, statRows, stepChoice, stepNumber, WIZARD_STEPS } from "./birth-model.js";

const catalogue = (previous: BirthCatalogue["previous"] = null): BirthCatalogue => ({
  races: [
    { name: "Human", statAdj: [0, 0, 0, 0, 0], hitDie: 10, expFactor: 100, infravisionFeet: 0, skills: { STEALTH: 0 }, abilities: [] },
    { name: "Dwarf", statAdj: [2, -2, 2, -2, 2], hitDie: 11, expFactor: 120, infravisionFeet: 50, skills: { DISARM_PHYS: 2, TUNNEL_POWER: 4 }, abilities: [{ name: "Rocky", description: "Sees in the dark." }] },
  ],
  classes: [
    { name: "Warrior", statAdj: [3, -2, -2, 2, 2], hitDie: 9, expFactor: 0, skills: {}, magic: [], abilities: [] },
    { name: "Mage", statAdj: [-3, 3, 0, 1, -2], hitDie: 0, expFactor: 0, skills: { DEVICE: 13 }, magic: ["arcane"], abilities: [] },
  ],
  stats: ["STR", "INT", "WIS", "DEX", "CON"], pointBudget: 20, nameMax: 31, previous, namePinned: false,
});

const draft = (patch: Partial<BirthDraftView> = {}): BirthDraftView => ({
  race: "Dwarf", cls: "Mage", method: "point", stats: [10, 17, 10, 12, 18], pointsLeft: 3, pointsSpent: [0, 9, 0, 2, 6],
  canPreviousRoll: false, name: "Ari", history: "Born under a hill.", historyEdited: false, options: [],
  preview: {
    stats: [
      { key: "str", label: "STR: ", natural: "10", raceBonus: " +2", classBonus: " -3", best: "  9" },
      { key: "int", label: "INT: ", natural: "17", raceBonus: " -2", classBonus: " +3", best: " 18" },
      { key: "wis", label: "WIS: ", natural: "10", raceBonus: " +2", classBonus: " +0", best: " 12" },
      { key: "dex", label: "DEX: ", natural: "12", raceBonus: " -2", classBonus: " +1", best: " 11" },
      { key: "con", label: "CON: ", natural: "18", raceBonus: " +2", classBonus: " -2", best: " 18" },
    ],
    panels: [{ key: "topleft", lines: [{ label: "Name", value: "Ari", color: 14 }, { label: "HP", value: "13/13", color: 14 }, { label: "SP", value: "2/2", color: 14 }] }],
    gold: 600,
  },
  ready: true,
  ...patch,
});

describe("character creation steps", () => {
  it("numbers AnybandUI's five steps and walks them in order", () => {
    expect(WIZARD_STEPS).toEqual(["race", "class", "attributes", "identity", "review"]);
    expect(stepNumber("race")).toBe(1);
    expect(stepNumber("review")).toBe(5);
    expect(stepNumber("previous")).toBe(0);
    expect(nextStep("race")).toBe("class");
    expect(nextStep("identity")).toBe("review");
    expect(nextStep("review")).toBeNull();
    expect(nextStep("previous")).toBe("identity");
  });

  it("prints modifiers and skill names as upstream does", () => {
    expect(signed(2)).toBe("+2");
    expect(signed(0)).toBe("+0");
    expect(signed(-3)).toBe("-3");
    expect(skillLabel("DISARM_PHYS")).toBe("Disarm (physical)");
    expect(skillLabel("TUNNEL_POWER")).toBe("Tunnel power");
    expect(formatStat(17)).toBe("17");
    expect(formatStat(28)).toBe("18/10");
    expect(formatStat(18 + 5)).toBe("18/05");
    expect(formatStat(18 + 220)).toBe("18/***");
  });

  it("describes a race with infravision and a class with its magic", () => {
    const dwarf = choiceView(catalogue().races[1]!);
    expect(dwarf.modifiers).toEqual([2, -2, 2, -2, 2]);
    expect(dwarf.traits).toEqual([{ label: "Hit die", value: "11" }, { label: "XP modifier", value: "120%" }, { label: "Infravision", value: "50 ft" }]);
    expect(choiceView(catalogue().races[0]!).traits.slice(0, 2)).toEqual([{ label: "Hit die", value: "10" }, { label: "XP modifier", value: "100%" }]);
    expect(dwarf.abilities).toEqual([{ name: "Rocky", description: "Sees in the dark." }]);
    expect(dwarf.skills).toEqual([{ label: "Disarm (physical)", value: "+2" }, { label: "Tunnel power", value: "+4" }]);
    const mage = choiceView(catalogue().classes[1]!);
    expect(mage.traits.at(-1)).toEqual({ label: "Magic", value: "Yes", note: "Can learn spells: arcane." });
    expect(choiceView(catalogue().classes[0]!).traits.at(-1)).toEqual({ label: "Magic", value: "No", note: "Does not cast spells." });
  });

  it("gives a class's hit die and XP modifier with the chosen race's added, as the game's own class list does", () => {
    const [human, dwarf] = catalogue().races;
    const [warrior, mage] = catalogue().classes;
    const withRace = { note: "Includes your race." };
    expect(choiceView(warrior!, dwarf!).traits.slice(0, 2)).toEqual([{ label: "Hit die", value: "20", ...withRace }, { label: "XP modifier", value: "120%", ...withRace }]);
    expect(choiceView(mage!, human!).traits.slice(0, 2)).toEqual([{ label: "Hit die", value: "10", ...withRace }, { label: "XP modifier", value: "100%", ...withRace }]);
    expect(choiceView(warrior!).traits.slice(0, 2)).toEqual([{ label: "Hit die", value: "9" }, { label: "XP modifier", value: "0%" }]);
    expect(choiceView(dwarf!, human!).traits[0]).toEqual({ label: "Hit die", value: "11" });
  });

  it("builds stat rows from the game's preview, with spent points and limits", () => {
    const rows = statRows(draft(), catalogue());
    expect(rows[0]).toEqual({ index: 0, name: "STR", base: "10", race: "+2", cls: "-3", total: "9", spent: 0, canSell: false, atMaximum: false });
    expect(rows[1]!.canSell).toBe(true);
    expect(rows[4]!.atMaximum).toBe(true);
    const bare = statRows(draft({ preview: null, method: "roller", pointsSpent: [0, 0, 0, 0, 0] }), catalogue());
    expect(bare[1]).toMatchObject({ base: "17", race: "-", cls: "-", total: "-", canSell: false });
  });

  it("reads hit points, spell points and gold from the preview sheet", () => {
    expect(previewSummary(draft())).toEqual({ hp: "13", sp: "2", gold: 600 });
    expect(previewSummary(draft({ preview: null }))).toEqual({ hp: "-", sp: "-", gold: null });
  });

  it("maps the list and stat keys", () => {
    const names = ["Human", "Dwarf", "Elf"];
    expect(stepChoice(names, "Human", "ArrowDown")).toBe("Dwarf");
    expect(stepChoice(names, "Elf", "ArrowDown")).toBe("Elf");
    expect(stepChoice(names, "Human", "ArrowUp")).toBe("Human");
    expect(stepChoice(names, "Dwarf", "End")).toBe("Elf");
    expect(stepChoice(names, null, "Home")).toBe("Human");
    expect(stepChoice(names, "Dwarf", "a")).toBeNull();
    expect(stepChoice([], null, "ArrowDown")).toBeNull();
    expect(statKey("ArrowRight")).toBe("buy");
    expect(statKey("+")).toBe("buy");
    expect(statKey("-")).toBe("sell");
    expect(statKey("ArrowLeft")).toBe("sell");
    expect(statKey("ArrowUp")).toBe("up");
    expect(statKey("ArrowDown")).toBe("down");
    expect(statKey("Enter")).toBeNull();
  });
});

describe("the wizard over a birth session", () => {
  const session = (previous: BirthCatalogue["previous"] = null): ModBirthSession & Record<string, ReturnType<typeof vi.fn>> => {
    let current = draft({ race: null, cls: null, preview: null });
    const ok = { ok: true } as const;
    return {
      catalogue: vi.fn(() => catalogue(previous)),
      draft: vi.fn(() => current),
      chooseRace: vi.fn((name: string) => { current = { ...current, race: name }; return ok; }),
      chooseClass: vi.fn((name: string) => { current = { ...current, cls: name }; return ok; }),
      usePointBuy: vi.fn(() => ok), buy: vi.fn(() => ({ ok: false, reason: "That stat cannot go higher with the points left." })),
      sell: vi.fn(() => { throw new Error("broken"); }), suggest: vi.fn(() => ok), reset: vi.fn(() => ok), roll: vi.fn(() => ok),
      previousRoll: vi.fn(() => ok), setName: vi.fn(() => ok), randomName: vi.fn(() => ok),
      setHistory: vi.fn((text: string) => { current = { ...current, history: text, historyEdited: true }; return ok; }),
      regenerateHistory: vi.fn(() => ok), setOption: vi.fn(() => ok), usePrevious: vi.fn(() => ok),
      accept: vi.fn(() => ok), cancel: vi.fn(),
    } as unknown as ModBirthSession & Record<string, ReturnType<typeof vi.fn>>;
  };

  it("chooses the first race and class through the session when none is set", () => {
    const s = session();
    const wizard = new BirthWizard(s);
    wizard.start();
    expect(s.chooseRace).toHaveBeenCalledWith("Human");
    expect(s.chooseClass).toHaveBeenCalledWith("Warrior");
    expect(wizard.draft().race).toBe("Human");
    wizard.start();
    expect(s.chooseRace).toHaveBeenCalledTimes(1);
  });

  it("keeps the game's refusal, and a thrown error, as the message to show", () => {
    const wizard = new BirthWizard(session());
    expect(wizard.run((s) => s.buy(0))).toBe(false);
    expect(wizard.error).toBe("That stat cannot go higher with the points left.");
    expect(wizard.run((s) => s.sell(0))).toBe(false);
    expect(wizard.error).toBe("broken");
    expect(wizard.run((s) => s.reset())).toBe(true);
    expect(wizard.error).toBe("");
  });

  it("remembers the generated background so an edit can be taken back", () => {
    const wizard = new BirthWizard(session());
    expect(wizard.generatedHistory).toBe("Born under a hill.");
    wizard.run((s) => s.setHistory("Mine."), false);
    expect(wizard.generatedHistory).toBe("Born under a hill.");
  });

  it("applies the previous character once until the build changes", () => {
    const s = session({ race: "Dwarf", cls: "Mage", name: "Ari" });
    const wizard = new BirthWizard(s);
    expect(wizard.usePrevious()).toBe(true);
    expect(wizard.usePrevious()).toBe(true);
    expect(s.usePrevious).toHaveBeenCalledTimes(1);
    wizard.run((x) => x.setName("Bo"), false);
    wizard.usePrevious();
    expect(s.usePrevious).toHaveBeenCalledTimes(1);
    wizard.run((x) => x.suggest());
    wizard.usePrevious();
    expect(s.usePrevious).toHaveBeenCalledTimes(2);
    expect(new BirthWizard(session()).usePrevious()).toBe(false);
  });

  it("finishes once, by accepting or by cancelling", () => {
    const s = session();
    const wizard = new BirthWizard(s);
    expect(wizard.accept()).toBe(true);
    expect(wizard.finished).toBe(true);
    expect(wizard.run((x) => x.reset())).toBe(false);
    wizard.cancel();
    expect(s.cancel).not.toHaveBeenCalled();
    const other = session();
    const leaving = new BirthWizard(other);
    leaving.cancel();
    leaving.cancel();
    expect(other.cancel).toHaveBeenCalledTimes(1);
  });
});
