import { describe, expect, it } from "vitest";
import type { SpellbookView, StoreSnapshot } from "../seams.js";
import { adaptStore, bookForStock, storeName } from "./stores.js";

const token = { epoch: 1, revision: 1 };
const item = (label: string, name?: string) => ({ handle: 0, index: 0, label, ...(name ? { name } : {}), number: 40, inscription: null, tval: 1, sval: 1, artifact: false, ego: false, price: 3 });

function snapshot(stock: ReturnType<typeof item>[], featName = "STORE_GENERAL"): StoreSnapshot {
  return { token, phase: "store", prompt: null,
    storeStatus: { token, feat: 1, ready: true, noSelling: false, inventory: [] },
    core: { player: { grid: { x: 1, y: 1 }, gold: 10 }, inventory: [], equipment: [],
      stores: [{ feat: 1, featName, isHome: false, owner: { name: "Lyar-el", purse: 100 }, stock }] } } as unknown as StoreSnapshot;
}

describe("store model", () => {
  it("names a store as the game does, not by its feature code", () => {
    expect(adaptStore(snapshot([]), null)?.name).toBe("General Store");
    expect(storeName("STORE_BLACK")).toBe("Black Market");
    expect(storeName("STORE_TAVERN_HALL")).toBe("Tavern hall");
  });

  it("lists stock by the game's object name when the engine publishes one", () => {
    expect(adaptStore(snapshot([item("& Ration~ of Food", "40 Rations of Food")]), null)?.stock[0]?.label).toBe("40 Rations of Food");
    expect(adaptStore(snapshot([item("& Ration~ of Food")]), null)?.stock[0]?.label).toBe("& Ration~ of Food");
  });
});

const spell = { name: "Magic Missile", sidx: 4, bidx: 0, level: 1, mana: 2, fail: 20, chance: 35, learned: true, forgotten: false, worked: false, studyEligible: false, infoLine: "dam 2d6" };
const book = (name: string, tval = 30): SpellbookView => ({ tval, name, realm: "arcane", spells: [spell] });

describe("stocked spellbooks", () => {
  it("picks the book whose name the item carries, the longest unique one when several match", () => {
    const shelf = { tval: 30, label: "[Magic for Beginners]", name: "a Book of Magic Spells [Magic for Beginners]" };
    expect(bookForStock(shelf, [book("Magic for Beginners")])?.name).toBe("Magic for Beginners");
    expect(bookForStock({ tval: 30, label: "[Conjurings and Tricks]" }, [book("Magic for Beginners")])).toBeNull();
    expect(bookForStock(shelf, [])).toBeNull();
    expect(bookForStock({ tval: 20, label: "Long Sword" }, [book("Magic for Beginners")])).toBeNull();
    const named = { tval: 30, label: "Magic for Beginners", name: "Magic for Beginners" };
    expect(bookForStock(named, [book("Magic"), book("Magic for Beginners")])?.name).toBe("Magic for Beginners");
    expect(bookForStock({ tval: 30, label: "A Book" }, [book("Magic"), book("Prayers")])).toBeNull();
    expect(bookForStock({ tval: 30, label: "Magic Book Spell Book" }, [book("Magic Book"), book("Spell Book")])).toBeNull();
  });

  it("attaches that book's spells to the stock row", () => {
    const source = snapshot([{ ...item("Magic for Beginners", "Magic for Beginners"), tval: 30 }]);
    const stocked = { ...source, core: { ...source.core, spellbooks: [book("Magic for Beginners")] } };
    expect(adaptStore(stocked, null)?.stock[0]?.spells).toEqual([
      { index: 4, name: "Magic Missile", level: 1, mana: 2, fail: 35, learned: true, infoLine: "dam 2d6" },
    ]);
    const { chance: _chance, ...base } = spell;
    const older = { ...stocked, core: { ...stocked.core, spellbooks: [{ ...book("Magic for Beginners"), spells: [base] }] } };
    expect(adaptStore(older, null)?.stock[0]?.spells?.[0]?.fail).toBe(20);
    const sword = snapshot([item("Long Sword")]);
    expect(adaptStore({ ...sword, core: { ...sword.core, spellbooks: [book("Magic for Beginners")] } }, null)?.stock[0]?.spells).toBeUndefined();
  });
});
