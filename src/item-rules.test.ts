import { describe, expect, it, vi } from "vitest";
import { intentAvailable, itemRuleLines, qualityChoices, ruleEditorRows, ruleIntent, rulesEditable, submitItemIntent, NOTE_LIMIT } from "./item-rules.js";
import type { InputToken, ItemIntentResult, ItemRulesResult } from "./seams.js";

const token = { epoch: 1, revision: 1 };
const rules: ItemRulesResult = {
  token,
  quality: [{ itype: 1, name: "Sharp Melee Weapons", threshold: 2, thresholdName: "average" }, { itype: 24, name: "Rings", threshold: 0, thresholdName: "no ignore" }],
  kinds: [
    { kidx: 1, name: "Potion of Salt Water", ignoreAware: true, ignoreUnaware: false, noteAware: null, noteUnaware: null },
    { kidx: 2, name: "Flask of Oil", ignoreAware: false, ignoreUnaware: false, noteAware: "@v1", noteUnaware: null },
    { kidx: 3, name: "Ration of Food", ignoreAware: false, ignoreUnaware: false, noteAware: null, noteUnaware: null },
    { kidx: 4, name: "Potion of Cure Light Wounds", ignoreAware: false, ignoreUnaware: false, noteAware: null, noteUnaware: null },
  ],
  egos: [{ eidx: 1, name: "of Slay Animal", itype: 1, ignored: true }, { eidx: 2, name: "of Westernesse", itype: 1, ignored: false }],
};
const catalogue = (kinds: string[]) => () => ({ token, intents: kinds.map((kind) => ({ kind, args: "" })) });

describe("item rule lines", () => {
  it("lists only the rules the player has set", () => {
    expect(itemRuleLines({
      token,
      quality: [{ itype: 1, name: "Swords", threshold: 2, thresholdName: "average" }, { itype: 2, name: "Bows", threshold: 0, thresholdName: "no ignore" }],
      kinds: [
        { kidx: 1, name: "Potion of Salt Water", ignoreAware: true, ignoreUnaware: false, noteAware: null, noteUnaware: null },
        { kidx: 2, name: "Flask of Oil", ignoreAware: false, ignoreUnaware: false, noteAware: "@v1", noteUnaware: null },
        { kidx: 3, name: "Ration of Food", ignoreAware: false, ignoreUnaware: false, noteAware: null, noteUnaware: null },
      ],
      egos: [{ eidx: 1, name: "of Slay Animal", itype: 1, ignored: true }, { eidx: 2, name: "of Westernesse", itype: 1, ignored: false }],
    })).toEqual(["Swords: average", "Potion of Salt Water: ignored", "Flask of Oil: inscribed @v1", "of Slay Animal: ignored"]);
  });

  it("is empty when nothing is set", () => {
    expect(itemRuleLines({ token, quality: [], kinds: [], egos: [] })).toEqual([]);
  });
});

describe("item rule editing", () => {
  it("shows set rules without a filter and searches every kind and ego with one", () => {
    const plain = ruleEditorRows(rules, "");
    expect(plain.quality.map((row) => row.itype)).toEqual([1, 24]);
    expect(plain.kinds.map((row) => row.kidx)).toEqual([1, 2]);
    expect(plain.egos.map((row) => [row.eidx, row.typeName])).toEqual([[1, "Sharp Melee Weapons"]]);
    const potions = ruleEditorRows(rules, " potion ");
    expect(potions.kinds.map((row) => row.kidx)).toEqual([1, 4]);
    expect(potions.quality).toEqual([]);
    expect(ruleEditorRows(rules, "sharp").egos.map((row) => row.eidx)).toEqual([1, 2]);
    const capped = ruleEditorRows(rules, "o", 2);
    expect(capped.kinds.length + capped.egos.length).toBe(2);
    expect(capped.hidden).toBe(4);
  });

  it("offers rings and amulets only the two quality levels the game's menu does", () => {
    expect(qualityChoices(1)).toHaveLength(5);
    expect(qualityChoices(24)).toEqual(["no ignore", "bad"]);
    expect(qualityChoices(25)).toEqual(["no ignore", "bad"]);
  });

  it("builds only rule intents the host will accept", () => {
    expect(ruleIntent(rules, "quality", 1, 3)).toEqual({ intent: { kind: "item-rule", rule: "quality", index: 1, value: 3 } });
    expect(ruleIntent(rules, "quality", 24, 2)).toHaveProperty("reason");
    expect(ruleIntent(rules, "quality", 9, 1)).toHaveProperty("reason");
    expect(ruleIntent(rules, "ego", 2, true, 1)).toEqual({ intent: { kind: "item-rule", rule: "ego", index: 2, itype: 1, value: true } });
    expect(ruleIntent(rules, "ego", 2, true)).toHaveProperty("reason");
    expect(ruleIntent(rules, "kind-aware", 3, true)).toEqual({ intent: { kind: "item-rule", rule: "kind-aware", index: 3, value: true } });
    expect(ruleIntent(rules, "kind-aware", 99, true)).toHaveProperty("reason");
    expect(ruleIntent(rules, "kind-unaware", 3, "yes")).toHaveProperty("reason");
    expect(ruleIntent(rules, "note-aware", 2, "  @q1 ")).toEqual({ intent: { kind: "item-rule", rule: "note-aware", index: 2, value: "@q1" } });
    expect(ruleIntent(rules, "note-aware", 2, "")).toEqual({ intent: { kind: "item-rule", rule: "note-aware", index: 2, value: "" } });
    expect(ruleIntent(rules, "note-aware", 2, "x".repeat(NOTE_LIMIT + 1))).toHaveProperty("reason");
  });

  it("detects the intents from the engine's catalogue and declines without one", () => {
    expect(intentAvailable({}, "item-rule")).toBe(false);
    expect(intentAvailable({ intent: { submit: vi.fn() } }, "item-rule")).toBe(false);
    expect(intentAvailable({ intent: { submit: vi.fn(), catalogue: catalogue(["ignore", "unignore", "item-rule"]) } }, "item-rule")).toBe(true);
    expect(intentAvailable({ intent: { submit: vi.fn(), catalogue: catalogue(["ignore"]) } }, "item-rule")).toBe(false);
    expect(intentAvailable({ intent: { submit: vi.fn(), catalogue: () => { throw new Error("no"); } } }, "ignore")).toBe(false);
  });

  it("edits only at an ordinary command wait while the player drives", () => {
    const intent = { submit: vi.fn(), catalogue: catalogue(["item-rule"]) };
    expect(rulesEditable({ intent }, "play", false)).toBe(true);
    // A question belongs to the item choice and quantity panels, and a store visit to the store window.
    expect(rulesEditable({ intent }, "play", true)).toBe(false);
    expect(rulesEditable({ intent }, "store", false)).toBe(false);
    const autoplayed = { intent, driver: () => ({ kind: "controller" as const, owner: "core:borg" }) };
    expect(rulesEditable(autoplayed, "play", false)).toBe(false);
    expect(rulesEditable({ intent: { submit: vi.fn() } }, "play", false)).toBe(false);
  });

  it("treats a controller holding input as a quiet refusal", () => {
    const submit = vi.fn((_token: InputToken, _intent: unknown): ItemIntentResult => ({ accepted: false, reason: "controller core:borg holds input", code: "controller-owned" }));
    const built = ruleIntent(rules, "kind-aware", 3, true);
    if (!("intent" in built)) throw new Error("expected an intent");
    expect(submitItemIntent({ intent: { submit } }, token, built.intent)).toMatchObject({ accepted: false, quiet: true });
    expect(submit).toHaveBeenCalledWith(token, { kind: "item-rule", rule: "kind-aware", index: 3, value: true });
    submit.mockReturnValueOnce({ accepted: false, reason: "invalid item action" });
    expect(submitItemIntent({ intent: { submit } }, token, built.intent).quiet).toBeUndefined();
  });
});
