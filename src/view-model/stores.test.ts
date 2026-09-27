import { describe, expect, it } from "vitest";
import type { StoreSnapshot } from "../seams.js";
import { adaptStore, storeName } from "./stores.js";

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
