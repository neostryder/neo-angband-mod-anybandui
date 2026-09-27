import { describe, expect, it, vi } from "vitest";
import type { InputSnapshot, KnownLevel, StoreContext, StoreStatus, MouseSeams, InputToken, PlayerIntent } from "./seams.js";
import { adaptStore } from "./view-model/stores.js";
import { storeAction, storePromptReply } from "./panels/stores.js";
import { clickTile } from "./map-mouse.js";

const token = { epoch: 4, revision: 9 };
const item = (handle: number) => ({ handle, label: "Long Sword", number: 2, inscription: null, tval: 20, sval: 1, artifact: false, ego: false });
const snap = (phase: InputSnapshot["phase"] = "store", prompt: InputSnapshot["prompt"] = null): InputSnapshot => ({
  token, phase, prompt, core: { player: { grid: { x: 2, y: 3 }, gold: 50 }, inventory: [item(7)], equipment: [],
    stores: [{ feat: 21, featName: "Armoury", isHome: false, owner: { name: "Mira", purse: 300 },
      stock: [{ ...item(0), index: 0, price: 20 }, { ...item(0), index: 1, price: 70 }] }] },
});
const known: KnownLevel = { token, cells: [{ x: 2, y: 3, remembered: { feat: 21, objects: [] } }] };
const status: StoreStatus = { feat: 21, ready: true, noSelling: false, transactionPrompts: true, inventory: [{ handle: 7, eligible: true, price: 12 }] };

describe("phase 5 store reads", () => {
  it("chooses the active store from the known player cell and copies rows", () => {
    const source = snap(); const model = adaptStore(source, known, status)!;
    expect(model.name).toBe("Armoury"); expect(model.owner).toBe("Mira");
    expect(model.stock.map((row) => row.price)).toEqual([20, 70]);
    expect(model.pack[0]).toMatchObject({ key: 7, price: 12, location: "Pack" });
    expect(model.stock[0]).not.toBe(source.core.stores?.[0]?.stock[0]);
    expect(adaptStore(snap("play"), known, status)).toBeNull();
    expect(adaptStore(snap(), { ...known, token: { epoch: 4, revision: 8 } }, null)).toBeNull();
  });
  it("shows Home and removes ineligible pack entries", () => {
    const home = snap(); const modified: InputSnapshot = { ...home, core: { ...home.core,
      stores: [{ ...home.core.stores![0]!, isHome: true }] } };
    const model = adaptStore(modified, known, { ...status, inventory: [{ handle: 7, eligible: false }] })!;
    expect(model.name).toBe("Home"); expect(model.owner).toBe(""); expect(model.pack).toEqual([]);
  });
  it("includes eligible worn gear on the inventory side", () => {
    const source = snap();
    const worn: InputSnapshot = { ...source, core: { ...source.core, equipment: [item(8)] } };
    const model = adaptStore(worn, known, { ...status,
      inventory: [{ handle: 7, eligible: false }, { handle: 8, eligible: true }] })!;
    expect(model.pack.map((row) => [row.key, row.location])).toEqual([[8, "Equipment"]]);
  });
});

describe("phase 5 input", () => {
  const allFlags = Object.fromEntries(["storeWindow", "storePrices", "storeComparison", "storeTransactions", "storePrompts", "itemsLists", "itemsQuantity", "itemsChoice", "clickToWalk", "dungeonActions", "aimPath", "zoom", "mapHoverCards"].map((name) => [`anybandui.${name}`, true]));
  function context(snapshot: InputSnapshot = snap()) {
    const submit = vi.fn((_token: InputToken, _intent: PlayerIntent) => ({ accepted: true })); const reply = vi.fn((_id: number, _value: number | boolean) => ({ accepted: true }));
    const ctx: StoreContext = { flags: allFlags, snapshot: () => snapshot, knownLevel: () => known,
      intent: { submit }, prompt: { reply }, controller: { driver: () => ({ kind: "player" }) }, log: vi.fn() };
    return { ctx, submit, reply };
  }
  it("submits each shop command once with its current token", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), known, status)!;
    expect(storeAction(ctx, model, "stock", 0)).toBe(true);
    expect(storeAction(ctx, model, "pack", 7)).toBe(true);
    expect(storeAction(ctx, model, "leave")).toBe(true);
    expect(submit.mock.calls).toEqual([
      [token, { kind: "command", command: { code: "shop-buy", args: { index: 0 } } }],
      [token, { kind: "command", command: { code: "shop-sell", args: { handle: 7 } } }],
      [token, { kind: "command", command: { code: "shop-exit" } }],
    ]);
    expect(storeAction(ctx, model, "stock", 1)).toBe(false);
    expect(submit).toHaveBeenCalledTimes(3);
  });
  it("does not bypass quantity and price confirmations on the current engine", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), known, null)!;
    expect(storeAction(ctx, model, "stock", 0)).toBe(false);
    expect(storeAction(ctx, model, "pack", 7)).toBe(false);
    expect(storeAction(ctx, model, "leave")).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("answers the game's quantity and confirmation prompts once", () => {
    const quantity = { kind: "quantity", promptId: 10, label: "How many?", min: 1, max: 3, defaultValue: 1 } as const;
    const q = snap("store", quantity); const { ctx, reply } = context(q);
    expect(storePromptReply(ctx, adaptStore(q, known, status)!, 2)).toBe(true);
    expect(storePromptReply(ctx, adaptStore(q, known, status)!, 4)).toBe(false);
    expect(reply).toHaveBeenCalledExactlyOnceWith(10, 2);
    expect(storePromptReply({ ...ctx, controller: { driver: () => ({ kind: "autoplayer" }) } }, adaptStore(q, known, status)!, 1)).toBe(false);
    expect(reply).toHaveBeenCalledTimes(1);
    const confirm = { kind: "confirm", promptId: 11, label: "Pay 40 gold?" } as const;
    const c = snap("store", confirm); const second = context(c);
    expect(storePromptReply(second.ctx, adaptStore(c, known, status)!, true)).toBe(true);
    expect(storePromptReply(second.ctx, adaptStore(c, known, status)!, false)).toBe(true);
    expect(second.reply.mock.calls).toEqual([[11, true], [11, false]]);
  });
  it("stands down for an autoplayer, a prompt, and another phase", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), known, status)!;
    const auto = { ...ctx, controller: { driver: () => ({ kind: "autoplayer" as const }) } };
    expect(storeAction(auto, model, "stock", 0)).toBe(false);
    expect(storeAction({ ...ctx, snapshot: () => snap("play") }, model, "stock", 0)).toBe(false);
    expect(storeAction({ ...ctx, snapshot: () => snap("store", { kind: "confirm", promptId: 1 }) }, model, "stock", 0)).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
  it("keeps store clicks separate from map clicks when all flags are on", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), known, status)!;
    expect(clickTile(ctx as unknown as MouseSeams, { x: 4, y: 3 })).toBe(false);
    expect(storeAction(ctx, model, "stock", 0)).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("routes Home retrieval and stashing through the same engine commands", () => {
    const home: InputSnapshot = { ...snap(), core: { ...snap().core,
      stores: [{ ...snap().core.stores![0]!, isHome: true }] } };
    const { ctx, submit } = context(home); const model = adaptStore(home, known, status)!;
    expect(storeAction(ctx, model, "stock", 1)).toBe(true);
    expect(storeAction(ctx, model, "pack", 7)).toBe(true);
    expect(submit.mock.calls.map((call) => call[1])).toEqual([
      { kind: "command", command: { code: "shop-buy", args: { index: 1 } } },
      { kind: "command", command: { code: "shop-sell", args: { handle: 7 } } },
    ]);
  });
});
