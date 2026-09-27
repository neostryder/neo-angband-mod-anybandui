import { describe, expect, it, vi } from "vitest";
import type { InputSnapshot, InspectSeam, IntentSeam, ItemPrompt, PromptSeam, QuantityPrompt } from "./seams.js";
import { adaptItems, AcquisitionChanges, compareItem } from "./view-model/items.js";
import { answerItem, answerQuantity, buildItemCommand, quantityShortcut, submitItem } from "./item-interactions.js";

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
