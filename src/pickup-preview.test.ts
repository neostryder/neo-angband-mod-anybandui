import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameObject } from "@rpgm-tools/neo-angband-core";
import type { ItemPanelSnapshot, ItemsContext, LoadoutSimulation } from "./seams.js";
import { carriedCount, carriedText, floorObjectAt, previewFloorItem, type FloorCore, type FloorState } from "./pickup-preview.js";
import { installItems } from "./panels/items.js";
import { comparisonSummary } from "./panels/item-comparison.js";
import { knownCard } from "./hover-cards.js";

const token = { epoch: 1, revision: 3 };
const grid = { x: 4, y: 5 };
const objects = ["sensed", "helm", "potion"].map((name) => ({ name }) as unknown as GameObject);
// The first object is only sensed, so the snapshot's floorHere lists the helm and the potion.
const floorCore = {
  floorPile: vi.fn(() => objects),
  knownFloorObject: vi.fn((_state: unknown, _grid: unknown, obj: GameObject) => ({ obj, sensed: (obj as unknown as { name: string }).name === "sensed" })),
} as unknown as FloorCore;
const state = {} as FloorState;

const stats = (ac: number) => ({ speed: 110, ac, toH: 0, toD: 0, blows: 100, shots: 10, maxHp: 10, maxSp: 0, totalWeight: 30, statUse: [], resists: [], resistElements: [], objectFlags: [] });
const sim = (placements: number): LoadoutSimulation => ({
  before: { stats: stats(4) }, after: { stats: stats(9) }, unresolved: [],
  placements: Array.from({ length: placements }, () => ({ slot: 5, displaced: { label: "a Hard Leather Cap [2]" } })),
}) as unknown as LoadoutSimulation;

describe("the floor object behind a row", () => {
  it("skips what is only sensed, as the snapshot's list does", () => {
    expect(floorObjectAt(floorCore, state, grid, 0)).toBe(objects[1]);
    expect(floorObjectAt(floorCore, state, grid, 1)).toBe(objects[2]);
    expect(floorObjectAt(floorCore, state, grid, 2)).toBeNull();
    expect(floorObjectAt(floorCore, state, grid, -1)).toBeNull();
    expect(floorObjectAt({ ...floorCore, floorPile: () => { throw new Error("out of bounds"); } }, state, grid, 0)).toBeNull();
    expect(floorObjectAt({ ...floorCore, knownFloorObject: () => { throw new Error("refused"); } }, state, grid, 0)).toBeNull();
  });
});

describe("the pickup comparison", () => {
  const context = (simulateLoadout: (change: unknown) => LoadoutSimulation | null, current = token): ItemsContext => ({
    log: () => {}, state: {}, snapshot: () => ({ token: current, phase: "play", prompt: null, core: {} }),
    core: { createAgentView: () => ({ simulateLoadout }) as never, floorObject: (at, index) => floorObjectAt(floorCore, state, at, index) },
  });

  it("simulates wearing the floor object itself for a current token", () => {
    const simulateLoadout = vi.fn(() => sim(1));
    expect(previewFloorItem(context(simulateLoadout), token, grid, 0)).not.toBeNull();
    expect(simulateLoadout).toHaveBeenCalledWith({ wield: [{ from: "object", object: objects[1] }] });
    expect(previewFloorItem(context(simulateLoadout, { epoch: 1, revision: 4 }), token, grid, 0)).toBeNull();
    expect(simulateLoadout).toHaveBeenCalledTimes(1);
  });

  it("has nothing to show for an item no body slot holds, or a read that fails", () => {
    expect(previewFloorItem(context(() => sim(0)), token, grid, 1)).toBeNull();
    expect(previewFloorItem(context(() => { throw new Error("denied"); }), token, grid, 0)).toBeNull();
    expect(previewFloorItem({ log: () => {}, snapshot: () => ({ token, phase: "play", prompt: null, core: {} }) }, token, grid, 0)).toBeNull();
  });

  it("counts the same kind across the pack, the equipment and the quiver", () => {
    const row = (family: string, quantity: number) => ({ family, quantity });
    const model = { rows: [row("kind:arrow", 12), row("kind:helm", 1)], quiver: [row("kind:arrow", 30)] } as never;
    expect(carriedCount(model, { family: "kind:arrow" })).toBe(42);
    expect(carriedText(0)).toBe("You carry none of these.");
    expect(carriedText(1)).toBe("You already carry one of these.");
    expect(carriedText(42)).toBe("You already carry 42 of these.");
  });
});

class FakeNode {
  children: FakeNode[] = [];
  className = ""; textContent = ""; type = ""; title = ""; value = ""; placeholder = "";
  open = false; checked = false;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  host?: FakeNode;
  activeElement: FakeNode | null = null;
  rootNode: FakeNode;
  private listeners = new Map<string, Array<() => void>>();
  constructor(readonly tag = "div") { this.rootNode = this; }
  get ownerDocument() {
    const root = this.rootNode;
    return { createElement: (tag: string) => { const node = new FakeNode(tag); node.rootNode = root; return node; } };
  }
  getRootNode(): FakeNode { return this.rootNode; }
  appendChild(child: FakeNode): FakeNode { child.rootNode = this.rootNode; this.children.push(child); return child; }
  replaceChildren(): void { this.children = []; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  addEventListener(type: string, listener: () => void): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type: string): void { for (const listener of this.listeners.get(type) ?? []) listener(); }
  contains(node: FakeNode): boolean { return this.walk().includes(node); }
  querySelector(): FakeNode | null { return null; }
  focus(): void { this.rootNode.activeElement = this; }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  button(label: string): FakeNode | undefined { return this.walk().find((node) => node.tag === "button" && node.textContent.startsWith(label)); }
}

describe("the item panel's pickup preview", () => {
  const originalHtml = globalThis.HTMLElement;
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Object.assign(globalThis, { HTMLElement: originalHtml }); });

  const view = { handle: 0, kindKey: "kind:helm", label: "Metal Cap", number: 1, inscription: null, kindId: "helm", tval: 1, sval: 2, artifact: false, ego: false };
  const open = (flags: Record<string, boolean>, simulateLoadout = vi.fn(() => sim(1))) => {
    vi.useFakeTimers();
    Object.assign(globalThis, { HTMLElement: class {} });
    vi.stubGlobal("document", { createElement: () => new FakeNode("section") });
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    const snap = { token, phase: "play", prompt: null, core: { inventory: [{ ...view, handle: 3 }], equipment: [], floorHere: [{ ...view, itemKey: "floor:4,5:0" }], player: { grid } } } as unknown as ItemPanelSnapshot;
    const cleanup = installItems({ flags, log: () => {}, snapshot: () => snap, state: {},
      core: { createAgentView: () => ({ simulateLoadout }) as never, floorObject: (at, index) => floorObjectAt(floorCore, state, at, index) },
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close: () => {} }) } });
    return { root, cleanup, simulateLoadout };
  };

  it("lists the pile underfoot and compares a floor item before it is picked up", () => {
    const { root, cleanup, simulateLoadout } = open({ "anybandui.itemsPickupPreview": true });
    expect(root.text()).toContain("On this tile");
    expect(root.walk().some((node) => node.placeholder === "Search items")).toBe(false);
    root.button("Metal Cap")!.fire("click");
    expect(simulateLoadout).toHaveBeenCalledWith({ wield: [{ from: "object", object: objects[1] }] });
    expect(root.text()).toContain("You already carry one of these.");
    expect(root.text()).toContain("Equipment comparison");
    expect(root.text()).toContain("Replacing: a Hard Leather Cap [2]");
    expect(root.text()).toContain("+5");
    cleanup();
  });

  it("leaves the floor rows as they were with the switch off", () => {
    const { root, cleanup, simulateLoadout } = open({ "anybandui.itemsLists": true });
    root.button("Metal Cap")!.fire("click");
    expect(root.text()).not.toContain("You already carry");
    expect(root.text()).not.toContain("Equipment comparison");
    expect(simulateLoadout).not.toHaveBeenCalled();
    cleanup();
  });
});

describe("the short comparison", () => {
  it("names the known stats that change, leaving out weight", () => {
    expect(comparisonSummary(sim(1))).toBe("If worn: Armour +5");
    expect(comparisonSummary({ ...sim(1), after: { stats: stats(4) } } as unknown as LoadoutSimulation)).toBe("If worn: no change to known stats");
    expect(comparisonSummary(sim(0))).toBeNull();
    expect(comparisonSummary(null)).toBeNull();
  });

  it("adds a line under an item in view on the dungeon hover card", () => {
    const simulateLoadout = vi.fn(() => sim(1));
    const helm = { name: "helm" };
    const core = { describeLookGrid: () => ({ text: "You see a Metal Cap", mon: null }), knownPile: () => [{ obj: helm }, { sensed: true, obj: {} }],
      describeObject: () => "a Metal Cap", squareIsSeen: () => true, createAgentView: () => ({ simulateLoadout }) };
    const card = knownCard(core, { actor: { grid: { x: 9, y: 9 } } }, grid, false, null, true)!;
    expect(card).toContain("Ground: a Metal Cap\n  If worn: Armour +5");
    expect(simulateLoadout).toHaveBeenCalledTimes(1);
    expect(simulateLoadout).toHaveBeenCalledWith({ wield: [{ from: "object", object: helm }] });
    expect(knownCard(core, { actor: { grid: { x: 9, y: 9 } } }, grid, false, null, false)).not.toContain("If worn");
    // A remembered item out of view may have changed since, so it gets no line.
    expect(knownCard({ ...core, squareIsSeen: () => false }, { actor: { grid: { x: 9, y: 9 } } }, grid, false, null, true)).not.toContain("If worn");
  });

  it("puts the short comparison on a floor row's tooltip", () => {
    const { root, cleanup } = (() => {
      vi.useFakeTimers();
      Object.assign(globalThis, { HTMLElement: class {} });
      vi.stubGlobal("document", { createElement: () => new FakeNode("section") });
      const root = new FakeNode("root");
      root.host = new FakeNode("host");
      const view = { handle: 0, kindKey: "kind:helm", label: "Metal Cap", number: 1, inscription: null, kindId: "helm", tval: 1, sval: 2, artifact: false, ego: false };
      const snap = { token, phase: "play", prompt: null, core: { inventory: [], equipment: [], floorHere: [view], player: { grid } } } as unknown as ItemPanelSnapshot;
      const cleanup = installItems({ flags: { "anybandui.itemsPickupPreview": true }, log: () => {}, snapshot: () => snap, state: {},
        core: { createAgentView: () => ({ simulateLoadout: () => sim(1) }) as never, floorObject: (at, index) => floorObjectAt(floorCore, state, at, index) },
        ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close: () => {} }) } });
      return { root, cleanup };
    })();
    expect(root.button("Metal Cap")!.title).toBe("If worn: Armour +5");
    cleanup();
    vi.useRealTimers(); vi.unstubAllGlobals();
  });
});
