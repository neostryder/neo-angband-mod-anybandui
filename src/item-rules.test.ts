import { describe, expect, it } from "vitest";
import { itemRuleLines } from "./item-rules.js";

const token = { epoch: 1, revision: 1 };

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
