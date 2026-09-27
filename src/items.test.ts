import { describe, expect, it, vi } from "vitest";
import type { InputSnapshot, InputToken, InspectSeam, IntentSeam, ItemInspectResult, ItemIntentResult, ItemPanelContext, ItemPanelSnapshot, ItemPrompt, ItemView, LoadoutSimulation, PanelItemView, PromptSeam, QuantityPrompt } from "./seams.js";
import { adaptItems, AcquisitionChanges, compareItem, compareSlots, defaultSlot, itemColour, panelRows } from "./view-model/items.js";
import { answerItem, answerQuantity, buildItemCommand, floorChoiceIndex, quantityShortcut, submitIgnore, submitItem } from "./item-interactions.js";
import { inspectionBlocks } from "./item-inspection.js";
import { slotOptionLabel } from "./panels/item-comparison.js";

const token = { epoch: 1, revision: 3 };
const item = (handle: number, number = 1) => ({ handle, label: "Sword", number, inscription: null, kindId: "sword", tval: 1, sval: 2, artifact: false, ego: true });
const snapshot = (inventory = [item(7)], equipment = [item(8)]): InputSnapshot => ({ token, phase: "play", prompt: null, core: { inventory, equipment } });

describe("phase 3 item reads", () => {
  it("adapts pack and equipped items without returning engine objects", () => {
    const source = snapshot(); const model = adaptItems(source)!;
    expect(model.rows.map((row) => [row.location, row.handle, row.slot, row.colour])).toEqual([["pack", 7, undefined, "#80b891"], ["equipment", 8, 0, "#80b891"]]);
    expect(model.rows[0]).not.toBe(source.core.inventory?.[0]);
    expect(adaptItems({ ...source, core: { inventory: null, equipment: [] } })).toBeNull();
  });
  it("tracks gains and acknowledgement without marking equipment moves", () => {
    const changes = new AcquisitionChanges();
    changes.update(adaptItems(snapshot([], []))!);
    const added = adaptItems(snapshot([item(7, 2)], []))!; changes.update(added);
    expect(changes.badge(added.rows[0]!)).toBe("NEW");
    changes.acknowledge(added.rows[0]!); expect(changes.badge(added.rows[0]!)).toBeNull();
    const moved = adaptItems(snapshot([], [item(7, 2)]))!; changes.update(moved);
    expect(changes.badge(moved.rows[0]!)).toBeNull();
    const grown = adaptItems(snapshot([], [item(7, 3)]))!; changes.update(grown);
    expect(changes.badge(grown.rows[0]!)).toBe("+1");
    changes.update({ ...grown, phase: "modal" }); expect(changes.badge(grown.rows[0]!)).toBeNull();
  });
  it("calls the core loadout simulator only for a current token", () => {
    const simulateLoadout = vi.fn(() => null);
    const ctx = { state: {}, snapshot: () => snapshot(), core: { createAgentView: () => ({ simulateLoadout }) }, log: vi.fn() };
    compareItem(ctx, token, 7); expect(simulateLoadout).toHaveBeenCalledWith({ wield: [{ from: "gear", handle: 7 }] });
    compareItem(ctx, { epoch: 1, revision: 2 }, 7); expect(simulateLoadout).toHaveBeenCalledTimes(1);
  });
});

describe("phase 3 interactions", () => {
  const quantity: QuantityPrompt = { kind: "quantity", promptId: 9, label: "How many?", min: 1, max: 7, defaultValue: 1 };
  const choice: ItemPrompt = { kind: "item", promptId: 10, label: "Choose", choices: [{ handle: 7, label: "Sword", letter: "a" }], tabs: { floor: false, quiver: false, equipment: true } };
  it("answers quantity shortcuts and rejects out of range amounts", () => {
    const reply = vi.fn(() => ({ accepted: true })); const seam: PromptSeam = { reply };
    expect(["One", "Half", "All"].map((name) => quantityShortcut(quantity, name as "One" | "Half" | "All"))).toEqual([1, 3, 7]);
    expect(answerQuantity(seam, quantity, 3).accepted).toBe(true); expect(reply).toHaveBeenCalledWith(9, 3);
    expect(answerQuantity(seam, quantity, 8).accepted).toBe(false); expect(reply).toHaveBeenCalledTimes(1);
  });
  it("answers only listed item handles", () => {
    const reply = vi.fn(() => ({ accepted: true })); const seam: PromptSeam = { reply };
    expect(answerItem(seam, choice, 7).accepted).toBe(true); expect(reply).toHaveBeenCalledWith(10, 7);
    expect(answerItem(seam, choice, 8).accepted).toBe(false); expect(reply).toHaveBeenCalledTimes(1);
  });
  it("submits only eligible commands with the current token", () => {
    const submit = vi.fn(() => ({ accepted: true })); const intent: IntentSeam = { submit };
    const tester = vi.fn(() => ({ token, items: [{ handle: 7 }] }));
    const inspect = { itemTester: tester } as unknown as InspectSeam;
    for (const [code, expected] of [["wield", "wield"], ["takeoff", "takeoff"], ["drop", "drop"], ["inscribe", "inscribe"], ["ignore", "ignore"], ["use", "use"]]) {
      const command = buildItemCommand(undefined, code!, 7, code === "inscribe" ? "@a" : undefined);
      expect(command.code).toBe(expected);
      expect(submitItem(intent, inspect, token, code!, 7, command).accepted).toBe(true);
      expect(submit).toHaveBeenLastCalledWith(token, { kind: "command", command });
    }
    expect(submitItem(intent, inspect, token, "drop", 8, buildItemCommand(undefined, "drop", 8)).accepted).toBe(false);
    expect(submit).toHaveBeenCalledTimes(6);
  });
});

describe("item panel seam adoption", () => {
  const gear = (handle: number, extra: Partial<PanelItemView> = {}): PanelItemView => ({ ...item(handle), kindKey: `kind:${handle}`, itemKey: `gear:${handle}`, nameColor: "light umber", ...extra });
  const panelSnap = (core: Partial<ItemPanelSnapshot["core"]>): ItemPanelSnapshot => ({ token, phase: "play", prompt: null, core: { inventory: [], equipment: [], ...core } });
  const sim = (slot: number, displaced: ItemView | null): LoadoutSimulation => ({ before: { stats: {} as never }, after: { stats: {} as never }, placements: [{ slot, displaced }], unresolved: [] });
  it("reads the quiver, the floor pile and real slot names, coloured by nameColor", () => {
    const model = adaptItems(panelSnap({
      inventory: [gear(7)], equipment: [null, null, gear(8, { nameColor: "w" }), gear(9, { nameColor: "Light-Blue" })],
      equipmentSlots: [{ type: "WEAPON", name: "weapon" }, { type: "BOW", name: "shooting" }, { type: "RING", name: "right hand" }, { type: "RING", name: "left hand" }],
      quiver: [gear(11, { nameColor: "slate" })], floorHere: [{ ...item(0), kindKey: "kind:40", nameColor: "U" }],
      player: { grid: { x: 4, y: 5 } },
    }))!;
    expect(model.rows.map((row) => [row.key, row.slotName, row.colour])).toEqual([["gear:7", undefined, "#c08040"], ["gear:8", "Right hand", "inherit"], ["gear:9", "Left hand", "#00ffff"]]);
    expect(model.quiver?.map((row) => [row.location, row.key, row.colour])).toEqual([["quiver", "gear:11", "#808080"]]);
    expect(model.floor?.map((row) => [row.location, row.key, row.floorIndex, row.colour])).toEqual([["floor", "floor:0:kind:40", 0, "#c08040"]]);
    expect(model.player).toEqual({ x: 4, y: 5 });
    expect(panelRows(model).map((row) => row.key)).toEqual(["gear:7", "gear:8", "gear:9", "gear:11", "floor:0:kind:40"]);
  });
  it("keeps the older engine's shape when the new parts are absent", () => {
    const model = adaptItems(snapshot())!;
    expect(model.quiver).toBeNull(); expect(model.floor).toBeNull();
    expect(model.rows[1]).toMatchObject({ key: "gear:8", slot: 0, colour: "#80b891" });
    expect(model.rows[1]!.slotName).toBeUndefined();
    expect(itemColour({ ...item(1), nameColor: "no such colour", artifact: true })).toBe("#e89e42");
  });
  it("marks arrows picked up into the quiver but not ammunition moved from the pack", () => {
    const changes = new AcquisitionChanges();
    const first = adaptItems(panelSnap({ inventory: [gear(5, { number: 10 })], quiver: [] }))!; changes.update(first);
    expect(changes.badge(first.rows[0]!)).toBeNull();
    const moved = adaptItems(panelSnap({ inventory: [], quiver: [gear(5, { number: 10 })] }))!; changes.update(moved);
    expect(changes.badge(moved.quiver![0]!)).toBeNull();
    const picked = adaptItems(panelSnap({ inventory: [], quiver: [gear(5, { number: 14 })] }))!; changes.update(picked);
    expect(changes.badge(picked.quiver![0]!)).toBe("+4");
  });
  it("compares every compatible slot and starts on the slot the game would fill", () => {
    const compareLoadoutSlots = vi.fn(() => ({ token, slots: [{ slot: 2, name: "right hand", comparison: sim(2, item(8)) }, { slot: 3, name: "left hand", comparison: sim(3, null) }] }));
    const ctx = { snapshot: () => panelSnap({}), inspect: { compareLoadoutSlots } as unknown as NonNullable<ItemPanelContext["inspect"]>, log: vi.fn() } as ItemPanelContext;
    const slots = compareSlots(ctx, token, 7)!;
    expect(compareLoadoutSlots).toHaveBeenCalledWith({ from: "gear", handle: 7 });
    expect(slots.map((entry) => entry.slot)).toEqual([2, 3]);
    expect(defaultSlot(slots)).toBe(3);
    expect(defaultSlot([slots[0]!])).toBe(2);
    expect(compareSlots(ctx, { epoch: 1, revision: 2 }, 7)).toBeNull();
    expect(slotOptionLabel("right hand", "Ring of Protection")).toBe("Right hand: Ring of Protection");
    expect(slotOptionLabel("left hand", null)).toBe("Left hand: empty");
  });
  it("falls back to simulateLoadout when the slot read is absent or refused", () => {
    const simulateLoadout = vi.fn((): LoadoutSimulation => sim(0, null));
    const refuse = vi.fn(() => { throw new Error("capability"); });
    const ctx = { state: {}, snapshot: () => panelSnap({ equipmentSlots: [{ type: "WEAPON", name: "weapon" }] }), core: { createAgentView: () => ({ simulateLoadout }) },
      inspect: { compareLoadoutSlots: refuse } as unknown as NonNullable<ItemPanelContext["inspect"]>, log: vi.fn() } as ItemPanelContext;
    const slots = compareSlots(ctx, token, 7)!;
    expect(slots.map((entry) => [entry.slot, entry.name])).toEqual([[0, "weapon"]]);
    expect(simulateLoadout).toHaveBeenCalledWith({ wield: [{ from: "gear", handle: 7 }] });
    simulateLoadout.mockReturnValueOnce({ ...sim(0, null), placements: [] });
    expect(compareSlots(ctx, token, 7)).toEqual([]);
  });
  it("ignores and unignores through the item intents, gated by the ignore tester", () => {
    const submit = vi.fn((_token: InputToken, _intent: unknown): ItemIntentResult => ({ accepted: true }));
    const itemTester = vi.fn(() => ({ token, items: [{ handle: 7 }, { floor: { x: 1, y: 1, index: 0 } }] }));
    const ctx = { intent: { submit }, inspect: { itemTester } as unknown as NonNullable<ItemPanelContext["inspect"]> };
    expect(submitIgnore(ctx, token, "ignore", 7).accepted).toBe(true);
    expect(itemTester).toHaveBeenCalledWith("ignore");
    expect(submit).toHaveBeenLastCalledWith(token, { kind: "ignore", handle: 7 });
    expect(submitIgnore(ctx, token, "unignore", 8).accepted).toBe(false);
    expect(submit).toHaveBeenCalledTimes(1);
    submit.mockReturnValueOnce({ accepted: false, reason: "Borg holds input", code: "controller-owned" });
    expect(submitIgnore(ctx, token, "unignore", 7)).toMatchObject({ accepted: false, quiet: true });
  });
  it("reads a floor choice's pile index from its negative handle", () => {
    expect(floorChoiceIndex(-1)).toBe(0); expect(floorChoiceIndex(-3)).toBe(2); expect(floorChoiceIndex(4)).toBeNull();
  });
  it("splits an inspection into its title, description and info blocks", () => {
    const result: ItemInspectResult = { token, title: "A Dagger (1d4)", text: "whole text", sections: [
      { kind: "title", text: "A Dagger (1d4)" }, { kind: "description", text: "A short blade." },
      { kind: "info", text: "Combat info:\n2.0 blows/round.\nAverage damage/round: 5." }, { kind: "info", text: "Weighs 1.2 lbs." },
      { kind: "info", text: "Provides resistance to fire.\nIt cannot be harmed by acid." },
    ] };
    expect(inspectionBlocks(result)).toEqual([
      { heading: "A Dagger (1d4)", body: "A short blade.", open: true },
      { heading: "Combat info", body: "2.0 blows/round.\nAverage damage/round: 5.", open: true },
      { heading: "", body: "Weighs 1.2 lbs.", open: true },
      { heading: "Provides resistance to fire.", body: "It cannot be harmed by acid.", open: true, lead: true },
    ]);
    expect(inspectionBlocks({ token, title: "Old", text: "Old text" })).toEqual([{ heading: "Old", body: "Old text", open: true }]);
  });
});
