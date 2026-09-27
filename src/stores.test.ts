import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnownLevel, StoreContext, StoreSnapshot, StoreStatus, StoreConfirmPrompt, MouseSeams, InputToken, PlayerIntent, StorePromptAnswer, StoreReplyResult, LoadoutSimulation, LoadoutSlotRef, LoadoutSlotsResult, StoreItemRef, StoreInspectResult, StoreQuantityPrompt } from "./seams.js";
import { adaptStore } from "./view-model/stores.js";
import { installStores, storeAction, storeComparisons, storeInspection, storePromptReply, tradeAllowed } from "./panels/stores.js";
import { clickTile } from "./map-mouse.js";

const token = { epoch: 4, revision: 9 };
const item = (handle: number) => ({ handle, label: "Long Sword", number: 2, inscription: null, tval: 20, sval: 1, artifact: false, ego: false });
const status: StoreStatus = { token, feat: 21, ready: true, noSelling: false, inventory: [{ handle: 7, eligible: true, price: 12 }] };
// A newer engine tags each store row with its location and lists worn gear too.
const located: StoreStatus = { token, feat: 21, ready: true, noSelling: false, inventory: [
  { handle: 7, location: "pack", eligible: true, price: 12 },
  { handle: 8, location: "equipment", eligible: true, price: 30 },
  { handle: 9, location: "quiver", eligible: true, price: 5 },
] };
const snap = (phase: StoreSnapshot["phase"] = "store", prompt: StoreSnapshot["prompt"] = null, storeStatus: StoreStatus | null | "absent" = status): StoreSnapshot => ({
  token, phase, prompt, ...(storeStatus === "absent" ? {} : { storeStatus }),
  core: { player: { grid: { x: 2, y: 3 }, gold: 50 }, inventory: [item(7)], equipment: [],
    stores: [{ feat: 21, featName: "Armoury", isHome: false, owner: { name: "Mira", purse: 300 },
      stock: [{ ...item(0), index: 0, price: 20 }, { ...item(0), index: 1, price: 70 }] }] },
});
// An engine from before storeStatus: no field at all on the snapshot.
const oldSnap = (prompt: StoreSnapshot["prompt"] = null): StoreSnapshot => snap("store", prompt, "absent");
const homeOf = (source: StoreSnapshot): StoreSnapshot => ({ ...source, core: { ...source.core, stores: [{ ...source.core.stores![0]!, isHome: true }] } });
const known: KnownLevel = { token, cells: [{ x: 2, y: 3, remembered: { feat: 21, objects: [] } }] };
const quantity: StoreQuantityPrompt = { kind: "quantity", promptId: 10, label: "Buy how many? (max 3) ", min: 0, max: 3, defaultValue: 1, unitPrice: 20, totalPrice: 20, gold: 50 };
const confirm = { kind: "confirm", promptId: 11, label: "Buy a Long Sword? [ESC, any other key to accept]" } as const;

const autoplayer = { driver: () => ({ kind: "controller" as const, owner: "borg" }) };
const allFlags = Object.fromEntries(["storeWindow", "storePrices", "storeComparison", "storeTransactions", "storePrompts", "itemsLists", "itemsQuantity", "itemsChoice", "clickToWalk", "dungeonActions", "aimPath", "zoom", "mapHoverCards"].map((name) => [`anybandui.${name}`, true]));
function context(snapshot: StoreSnapshot = snap(), result: StoreReplyResult = { accepted: true }) {
  const submit = vi.fn((_token: InputToken, _intent: PlayerIntent) => result);
  const reply = vi.fn((_id: number, _answer: StorePromptAnswer) => result);
  const ctx: StoreContext = { flags: allFlags, snapshot: () => snapshot, knownLevel: () => known,
    intent: { submit }, prompt: { reply }, driver: () => ({ kind: "player" as const }), log: vi.fn() };
  return { ctx, submit, reply };
}

describe("store reads", () => {
  it("names the open store from its status and copies stock and one-item quotes", () => {
    const source = snap(); const model = adaptStore(source, null)!;
    expect(model.name).toBe("Armoury"); expect(model.owner).toBe("Mira");
    expect(model.transactionPrompts).toBe(true);
    expect(model.stock.map((row) => row.price)).toEqual([20, 70]);
    expect(model.pack[0]).toMatchObject({ key: 7, price: 12, location: "Pack", eligible: true });
    expect(model.stock[0]).not.toBe(source.core.stores?.[0]?.stock[0]);
    expect(adaptStore(snap("play"), known)).toBeNull();
  });
  it("falls back to the known cell and keeps trades off on an engine without store status", () => {
    const model = adaptStore(oldSnap(), known)!;
    expect(model.name).toBe("Armoury");
    expect(model).toMatchObject({ transactionPrompts: false, ready: true, noSelling: false });
    expect(model.pack[0]).toMatchObject({ key: 7, eligible: true }); expect(model.pack[0]?.price).toBeUndefined();
    expect(adaptStore(oldSnap(), { ...known, token: { epoch: 4, revision: 8 } })).toBeNull();
    // A status from another wait is ignored rather than trusted.
    expect(adaptStore(snap("store", null, { ...status, token: { epoch: 4, revision: 8 } }), known)?.transactionPrompts).toBe(false);
  });
  it("greys out pack items the store will not buy instead of hiding them", () => {
    const model = adaptStore(snap("store", null, { ...status, inventory: [{ handle: 7, eligible: false, price: null }] }), null)!;
    expect(model.pack).toEqual([expect.objectContaining({ key: 7, eligible: false })]);
    expect(model.pack[0]?.price).toBeUndefined();
  });
  it("keeps worn gear selectable, since the status covers the pack only", () => {
    const source = snap(); const worn: StoreSnapshot = { ...source, core: { ...source.core, equipment: [item(8)] } };
    const model = adaptStore(worn, null)!;
    expect(model.pack.map((row) => [row.key, row.location, row.eligible, row.price])).toEqual([[7, "Pack", true, 12], [8, "Equipment", true, undefined]]);
  });
  it("offers every row the store reports, worn gear under Equipment, when rows carry a location", () => {
    const base = snap("store", null, located);
    const source: StoreSnapshot = { ...base, core: { ...base.core, inventory: [item(7), item(9)], equipment: [item(8)] } };
    const model = adaptStore(source, null)!;
    expect(model.pack.map((row) => [row.key, row.location, row.eligible, row.price])).toEqual([
      [7, "Pack", true, 12], [8, "Equipment", true, 30], [9, "Quiver", true, 5],
    ]);
  });
  it("reports readiness, the no-selling option and the Home", () => {
    const model = adaptStore(homeOf(snap("store", null, { ...status, ready: false, noSelling: true })), null)!;
    expect(model).toMatchObject({ name: "Home", owner: "", home: true, ready: false, noSelling: true });
  });
});

describe("store trades", () => {
  it("submits each shop command once with its current token", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), known)!;
    expect(storeAction(ctx, model, "stock", 0).accepted).toBe(true);
    expect(storeAction(ctx, model, "pack", 7).accepted).toBe(true);
    expect(storeAction(ctx, model, "leave").accepted).toBe(true);
    expect(submit.mock.calls).toEqual([
      [token, { kind: "command", command: { code: "shop-buy", args: { index: 0 } } }],
      [token, { kind: "command", command: { code: "shop-sell", args: { handle: 7 } } }],
      [token, { kind: "command", command: { code: "shop-exit" } }],
    ]);
    // 70 gold with 50 in hand.
    expect(storeAction(ctx, model, "stock", 1).accepted).toBe(false);
    expect(submit).toHaveBeenCalledTimes(3);
  });
  it("keeps Buy, Sell, Stash and Retrieve off on an older engine, where they would skip the prompts", () => {
    for (const source of [oldSnap(), homeOf(oldSnap())]) {
      const { ctx, submit } = context(source); const model = adaptStore(source, known)!;
      expect(storeAction(ctx, model, "stock", 0).accepted).toBe(false);
      expect(storeAction(ctx, model, "pack", 7).accepted).toBe(false);
      expect(storeAction(ctx, model, "leave").accepted).toBe(true);
      expect(submit).toHaveBeenCalledTimes(1);
    }
  });
  it("waits while the store menu is not ready", () => {
    const source = snap("store", null, { ...status, ready: false });
    const { ctx, submit } = context(source); const model = adaptStore(source, null)!;
    expect(tradeAllowed(model, "stock", model.stock[0])).toBe(false);
    expect(storeAction(ctx, model, "stock", 0).accepted).toBe(false);
    expect(storeAction(ctx, model, "leave").accepted).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
  it("refuses to sell an item the store will not buy", () => {
    const source = snap("store", null, { ...status, inventory: [{ handle: 7, eligible: false, price: null }] });
    const { ctx, submit } = context(source); const model = adaptStore(source, null)!;
    expect(storeAction(ctx, model, "pack", 7).accepted).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
  it("routes Home retrieval and stashing through the same commands, without a price limit", () => {
    const home = homeOf(snap());
    const { ctx, submit } = context(home); const model = adaptStore(home, null)!;
    expect(storeAction(ctx, model, "stock", 1).accepted).toBe(true);
    expect(storeAction(ctx, model, "pack", 7).accepted).toBe(true);
    expect(submit.mock.calls.map((call) => call[1])).toEqual([
      { kind: "command", command: { code: "shop-buy", args: { index: 1 } } },
      { kind: "command", command: { code: "shop-sell", args: { handle: 7 } } },
    ]);
  });
  it("stands down for an autoplayer, an open prompt and another phase", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), null)!;
    const auto: StoreContext = { ...ctx, ...autoplayer };
    expect(storeAction(auto, model, "stock", 0)).toEqual({ accepted: false, quiet: true });
    expect(storeAction({ ...ctx, snapshot: () => snap("play") }, model, "stock", 0).accepted).toBe(false);
    expect(storeAction({ ...ctx, snapshot: () => snap("store", confirm) }, model, "stock", 0).accepted).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
  it("treats a controller-owned refusal as quiet", () => {
    const { ctx } = context(snap(), { accepted: false, reason: "controller borg owns input", code: "controller-owned" });
    expect(storeAction(ctx, adaptStore(snap(), null)!, "stock", 0)).toEqual({ accepted: false, quiet: true });
    const { ctx: other } = context(snap(), { accepted: false, reason: "store is not ready" });
    expect(storeAction(other, adaptStore(snap(), null)!, "stock", 0)).toEqual({ accepted: false, quiet: false });
  });
  it("keeps store clicks separate from map clicks when all flags are on", () => {
    const { ctx, submit } = context(); const model = adaptStore(snap(), known)!;
    expect(clickTile(ctx as unknown as MouseSeams, { x: 4, y: 3 })).toBe(false);
    expect(storeAction(ctx, model, "stock", 0).accepted).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe("store prompts", () => {
  it("answers the quantity prompt with an amount or the typed cancel reply", () => {
    const q = snap("store", quantity); const { ctx, reply } = context(q); const model = adaptStore(q, null)!;
    expect(storePromptReply(ctx, model, 2).accepted).toBe(true);
    expect(storePromptReply(ctx, model, 4).accepted).toBe(false);
    expect(storePromptReply(ctx, model, 1.5).accepted).toBe(false);
    expect(storePromptReply(ctx, model, { action: "cancel" }).accepted).toBe(true);
    expect(reply.mock.calls).toEqual([[10, 2], [10, { action: "cancel" }]]);
    expect(storePromptReply({ ...ctx, ...autoplayer }, model, 1)).toEqual({ accepted: false, quiet: true });
    expect(reply).toHaveBeenCalledTimes(2);
  });
  it("accepts or declines the price confirmation", () => {
    const c = snap("store", confirm); const { ctx, reply } = context(c); const model = adaptStore(c, null)!;
    expect(storePromptReply(ctx, model, true).accepted).toBe(true);
    expect(storePromptReply(ctx, model, false).accepted).toBe(true);
    expect(storePromptReply(ctx, model, 1).accepted).toBe(false);
    expect(reply.mock.calls).toEqual([[11, true], [11, false]]);
  });
  it("takes the typed cancel reply on the confirmation as well", () => {
    const c = snap("store", confirm); const { ctx, reply } = context(c); const model = adaptStore(c, null)!;
    expect(storePromptReply(ctx, model, { action: "cancel" }).accepted).toBe(true);
    expect(reply).toHaveBeenCalledExactlyOnceWith(11, { action: "cancel" });
  });
  it("ignores a prompt that has already closed or changed", () => {
    const { ctx, reply } = context(snap("store", { ...confirm, promptId: 12 }));
    expect(storePromptReply(ctx, adaptStore(snap("store", confirm), null)!, true).accepted).toBe(false);
    expect(storePromptReply({ ...ctx, snapshot: () => snap("store", { kind: "item", promptId: 11, label: "Sell which item?", choices: [], tabs: { floor: false, quiver: false, equipment: false } }) },
      adaptStore(snap("store", confirm), null)!, true).accepted).toBe(false);
    expect(reply).not.toHaveBeenCalled();
  });
});

const stats = (ac: number) => ({ speed: 0, ac, toH: 0, toD: 0, blows: 100, shots: 10, maxHp: 10, maxSp: 0, totalWeight: 100, statUse: [], resists: [], resistElements: [], objectFlags: [] });
const sim = (ac: number): LoadoutSimulation => ({ before: { stats: stats(0) }, after: { stats: stats(ac) }, placements: [{ slot: 2, displaced: null }], unresolved: [] });

describe("store comparison and inspection", () => {
  it("compares stock against every slot it fits, both rings included", () => {
    const { ctx } = context(); const model = adaptStore(snap(), null)!;
    const compareLoadoutSlots = vi.fn((_ref: LoadoutSlotRef): LoadoutSlotsResult => ({ token, slots: [{ slot: 2, name: "right hand", comparison: sim(1) }, { slot: 3, name: "left hand", comparison: sim(2) }] }));
    const inspect = { inspectItem: vi.fn(() => null), itemTester: vi.fn(() => null), compareLoadoutSlots };
    const slots = storeComparisons({ ...ctx, inspect }, model, "stock", 1);
    expect(slots.map((slot) => slot.name)).toEqual(["right hand", "left hand"]);
    expect(storeComparisons({ ...ctx, inspect }, model, "pack", 7)).toHaveLength(2);
    expect(compareLoadoutSlots.mock.calls).toEqual([[{ from: "store", store: 0, index: 1 }], [{ from: "gear", handle: 7 }]]);
    compareLoadoutSlots.mockReturnValueOnce({ token: { epoch: 4, revision: 1 }, slots: [{ slot: 2, name: "right hand", comparison: sim(1) }] });
    expect(storeComparisons({ ...ctx, inspect }, model, "stock", 1)).toEqual([]);
  });
  it("falls back to the simulated loadout on an engine without per-slot comparison", () => {
    const simulateLoadout = vi.fn(() => sim(3));
    const { ctx } = context(); const model = adaptStore(snap(), null)!;
    const legacy: StoreContext = { ...ctx, state: {}, core: { createAgentView: () => ({ simulateLoadout }) } };
    expect(storeComparisons(legacy, model, "stock", 1)).toEqual([{ name: "", sim: sim(3) }]);
    expect(simulateLoadout).toHaveBeenCalledWith({ wield: [{ from: "store", store: 0, index: 1 }] });
    const refused = { inspectItem: vi.fn(() => null), itemTester: vi.fn(() => null), compareLoadoutSlots: () => { throw new Error("capability"); } };
    expect(storeComparisons({ ...legacy, inspect: refused }, model, "stock", 1)).toHaveLength(1);
  });
  it("inspects a shelf item, a spellbook included, by its store reference", () => {
    const { ctx } = context(); const model = adaptStore(snap(), null)!;
    const book: StoreInspectResult = { token, title: "A Magic Book of Magic for Beginners", text: "A book.\n\nYou can learn these spells.",
      sections: [{ kind: "title", text: "A Magic Book of Magic for Beginners" }, { kind: "description", text: "A book." }, { kind: "info", text: "You can learn these spells." }] };
    const inspectItem = vi.fn((_ref: StoreItemRef) => book);
    const inspect = { inspectItem, itemTester: vi.fn(() => null) };
    expect(storeInspection({ ...ctx, inspect }, model, "stock", 1)?.sections).toHaveLength(3);
    expect(inspectItem).toHaveBeenCalledWith({ store: 0, index: 1 });
    expect(storeInspection({ ...ctx, inspect }, model, "pack", 7)?.title).toBe(book.title);
    expect(inspectItem).toHaveBeenLastCalledWith(7);
  });
  it("shows no stock inspection from an engine that reads the reference as a gear handle", () => {
    const { ctx } = context(); const model = adaptStore(snap(), null)!;
    const legacy = { inspectItem: vi.fn(() => ({ token, title: "Something else", text: "Wrong item." })), itemTester: vi.fn(() => null) };
    expect(storeInspection({ ...ctx, inspect: legacy }, model, "stock", 1)).toBeNull();
    expect(storeInspection({ ...ctx, inspect: legacy }, model, "pack", 7)?.text).toBe("Wrong item.");
    const throwing = { inspectItem: vi.fn(() => { throw new Error("capability"); }), itemTester: vi.fn(() => null) };
    expect(storeInspection({ ...ctx, inspect: throwing }, model, "stock", 1)).toBeNull();
  });
});

// A minimal element tree: enough for the store window to paint into.
class FakeNode {
  children: FakeNode[] = []; textContent = ""; className = ""; title = ""; type = ""; value = ""; min = ""; max = ""; disabled = false; open = false;
  style: Record<string, string> = {}; attributes: Record<string, string> = {}; host?: FakeNode;
  private listeners = new Map<string, ((event: { key: string; stopPropagation(): void }) => void)[]>();
  constructor(readonly tag = "root") {}
  readonly ownerDocument = { createElement: (tag: string): FakeNode => new FakeNode(tag) };
  appendChild(child: FakeNode): FakeNode { this.children.push(child); return child; }
  replaceChildren(): void { this.children = []; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  addEventListener(type: string, listener: (event: { key: string; stopPropagation(): void }) => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type: string, key = ""): void { for (const listener of this.listeners.get(type) ?? []) listener({ key, stopPropagation: () => {} }); }
  all(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.all())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  buttons(label: string): FakeNode[] { return this.all().filter((node) => node.tag === "button" && node.textContent === label); }
}

describe("store window", () => {
  const original = globalThis.HTMLElement;
  beforeEach(() => { Object.assign(globalThis, { HTMLElement: class {} }); });
  afterEach(() => { Object.assign(globalThis, { HTMLElement: original }); });
  function open(source: StoreSnapshot, flags: Record<string, boolean> = allFlags) {
    let current = source;
    const { ctx, submit, reply } = context(source);
    const root = new FakeNode(); root.host = new FakeNode();
    const close = vi.fn();
    const store: StoreContext = { ...ctx, flags, snapshot: () => current,
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close }) } };
    const cleanup = installStores(store);
    return { root, submit, reply, close, cleanup, set: (next: StoreSnapshot) => { current = next; } };
  }
  it("asks how many with the price, total and gold, and cancels with the typed reply", () => {
    const view = open(snap("store", quantity));
    const text = view.root.text();
    expect(text).toContain("How many?"); expect(text).toContain("Buy how many? (max 3)");
    expect(text).toContain("Price each: 20 gold"); expect(text).toContain("Total: 20 gold"); expect(text).toContain("Your gold: 50");
    view.root.buttons("All")[0]!.fire("click");
    expect(view.root.text()).toContain("Total: about 60 gold");
    view.root.buttons("Cancel")[0]!.fire("click");
    expect(view.reply).toHaveBeenCalledExactlyOnceWith(10, { action: "cancel" });
    view.cleanup();
  });
  it("sends the chosen amount once", () => {
    const view = open(snap("store", quantity));
    view.root.buttons("Half")[0]!.fire("click");
    view.root.buttons("OK")[0]!.fire("click");
    expect(view.reply).toHaveBeenCalledExactlyOnceWith(10, 1);
    view.cleanup();
  });
  it("shows the engine's exact total for every quantity when it sends totals", () => {
    const priced: StoreQuantityPrompt = { ...quantity, totals: [0, 20, 40, 60] };
    const view = open(snap("store", priced));
    expect(view.root.text()).toContain("Total: 20 gold");
    view.root.buttons("All")[0]!.fire("click");
    expect(view.root.text()).toContain("Total: 60 gold");
    expect(view.root.text()).not.toContain("about 60");
    view.cleanup();
  });
  it("shows the price for a trade it started and gives the confirmation its own buttons", () => {
    const view = open(snap());
    const pick = view.root.buttons("Long Sword")[0]!; pick.fire("click");
    const buy = view.root.buttons("Buy")[0]!; expect(buy.disabled).toBe(false); buy.fire("click");
    expect(view.submit).toHaveBeenCalledExactlyOnceWith(token, { kind: "command", command: { code: "shop-buy", args: { index: 0 } } });
    view.set(snap("store", confirm));
    view.root.buttons("Long Sword")[0]!.fire("click");
    const text = view.root.text();
    expect(text).toContain("Accept this price?"); expect(text).toContain("Buy a Long Sword?"); expect(text).not.toContain("[ESC");
    expect(text).toContain("Price: 20 gold");
    view.root.buttons("Decline")[0]!.fire("click");
    expect(view.reply).toHaveBeenCalledExactlyOnceWith(11, false);
    view.cleanup();
  });
  it("shows the engine's exact price or offer on the confirm step", () => {
    const buy: StoreConfirmPrompt = { kind: "confirm", promptId: 11, label: "Buy a Long Sword?", price: 40 };
    const view = open(snap());
    view.root.buttons("Long Sword")[0]!.fire("click");
    view.root.buttons("Buy")[0]!.fire("click");
    view.set(snap("store", buy));
    view.root.buttons("Long Sword")[0]!.fire("click");
    expect(view.root.text()).toContain("Price: 40 gold");
    view.cleanup();

    const sale: StoreConfirmPrompt = { kind: "confirm", promptId: 12, label: "Sell a Long Sword?", price: 15 };
    const sell = open(snap());
    sell.root.buttons("Long Sword")[2]!.fire("click");
    sell.root.buttons("Sell")[0]!.fire("click");
    sell.set(snap("store", sale));
    sell.root.buttons("Long Sword")[2]!.fire("click");
    expect(sell.root.text()).toContain("You receive: 15 gold");
    sell.cleanup();
  });
  it("cancels from the confirm step with the typed reply", () => {
    const view = open(snap("store", confirm));
    view.root.buttons("Cancel")[0]!.fire("click");
    expect(view.reply).toHaveBeenCalledExactlyOnceWith(11, { action: "cancel" });
    view.cleanup();
  });
  it("shows worn gear under Equipment with its quote", () => {
    const base = snap("store", null, located);
    const source: StoreSnapshot = { ...base, core: { ...base.core, inventory: [item(7), item(9)], equipment: [item(8)] } };
    const view = open(source);
    const text = view.root.text();
    expect(text).toContain("Equipment");
    expect(text).toContain("30");
    view.cleanup();
  });
  it("leaves the questions to the keyboard when store questions are off", () => {
    const view = open(snap("store", confirm), { ...allFlags, "anybandui.storePrompts": false });
    expect(view.root.text()).toContain("Answer it with the keyboard.");
    expect(view.root.buttons("Accept")).toEqual([]); expect(view.root.buttons("OK")).toEqual([]);
    expect(view.reply).not.toHaveBeenCalled();
    view.cleanup();
  });
  it("disables trades on an older engine and greys out items the store will not buy", () => {
    const legacy = open(oldSnap());
    legacy.root.buttons("Long Sword")[0]!.fire("click");
    expect(legacy.root.buttons("Buy")[0]!.disabled).toBe(true);
    expect(legacy.root.buttons("Leave store")[0]!.disabled).toBe(false);
    legacy.cleanup();
    const view = open(snap("store", null, { ...status, inventory: [{ handle: 7, eligible: false, price: null }] }));
    const packRow = view.root.all().filter((node) => node.tag === "tr" && node.className === "muted");
    expect(packRow).toHaveLength(1);
    view.cleanup();
  });
  it("says Give and shows no quote under the no-selling option", () => {
    const view = open(snap("store", null, { ...status, noSelling: true }));
    expect(view.root.buttons("Give")).toHaveLength(1);
    expect(view.root.text()).toContain("pay no gold");
    expect(view.root.text()).not.toContain("Offer each");
    view.cleanup();
  });
  it("paints and answers at most once in every combination of store flags", () => {
    const parts = ["Window", "Prices", "Comparison", "Transactions", "Prompts"];
    for (let mask = 0; mask < 1 << parts.length; mask++) {
      const flags = Object.fromEntries(parts.map((part, bit) => [`anybandui.store${part}`, (mask & (1 << bit)) !== 0]));
      for (const prompt of [quantity, confirm]) {
        const view = open(snap("store", prompt), { ...allFlags, ...flags });
        const answer = [...view.root.buttons("OK"), ...view.root.buttons("Accept")];
        expect(answer).toHaveLength(mask === 0 || !flags["anybandui.storePrompts"] ? 0 : 1);
        for (const node of answer) node.fire("click");
        expect(view.reply).toHaveBeenCalledTimes(answer.length);
        expect(view.submit).not.toHaveBeenCalled();
        view.cleanup();
      }
    }
  });
});
