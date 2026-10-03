import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemPanelSnapshot } from "../seams.js";
import { installItems } from "./items.js";
import { FIGURE, layoutPortrait, renderEquipmentPortrait, stepSelection } from "./equipment-portrait.js";

class FakeNode {
  children: FakeNode[] = [];
  className = "";
  textContent = "";
  type = "";
  title = "";
  value = "";
  placeholder = "";
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  host?: FakeNode;
  activeElement: FakeNode | null = null;
  rootNode: FakeNode;
  private listeners = new Map<string, Array<(event: { key: string; preventDefault(): void }) => void>>();
  constructor(readonly tag = "div") { this.rootNode = this; }
  get ownerDocument() {
    const root = this.rootNode;
    return { createElement: (tag: string) => { const node = new FakeNode(tag); node.rootNode = root; return node; } };
  }
  getRootNode(): FakeNode { return this.rootNode; }
  appendChild(child: FakeNode): FakeNode { child.rootNode = this.rootNode; this.children.push(child); return child; }
  replaceChildren(): void { this.children = []; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  addEventListener(type: string, listener: (event: { key: string; preventDefault(): void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  fire(type: string, key = ""): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ key, preventDefault() {} });
  }
  contains(node: FakeNode): boolean { return this.walk().includes(node); }
  querySelector(selector: string): FakeNode | null {
    const focus = /\[data-focus="([^"]+)"\]/.exec(selector);
    if (!focus) return null;
    return this.walk().find((node) => node.dataset["focus"] === focus[1]) ?? null;
  }
  get tagName(): string { return this.tag.toUpperCase(); }
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  focus(): void { this.rootNode.activeElement = this; }
  // A button has no text selection. Calling this is the bug under test.
  setSelectionRange(start: number, end: number | null): void {
    if (this.tag !== "input" && this.tag !== "textarea") throw new TypeError("setSelectionRange");
    this.selectionStart = start;
    this.selectionEnd = end;
  }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  byText(label: string): FakeNode | undefined { return this.walk().find((node) => node.tag === "button" && node.textContent === label); }
}

const worn = { slot: 0, slotName: "Weapon", label: "Long Sword", colour: "#00ff00", inscription: null, key: "gear:1" };

describe("equipment portrait", () => {
  const originalHtml = globalThis.HTMLElement;
  const originalDocument = globalThis.document;
  afterEach(() => {
    vi.useRealTimers();
    Object.assign(globalThis, { HTMLElement: originalHtml, document: originalDocument });
  });

  it("hangs known slots on the figure and lists the rest", () => {
    const cards = layoutPortrait([{ name: "weapon" }, { name: "Head" }, { name: "tail" }], [worn]);
    expect(cards[0]).toMatchObject({ key: "gear:1", label: "Weapon", item: "Long Sword", x: 3, y: 8, row: 3 });
    expect(cards[1]).toMatchObject({ key: "empty:1", label: "Head", item: null, row: 0 });
    expect(cards[2]).toMatchObject({ key: "empty:2", label: "Tail", item: null, row: null, right: null });
    const fromWorn = layoutPortrait(null, [worn]);
    expect(fromWorn[0]).toMatchObject({ label: "Weapon", x: 3, y: 8 });
    expect(layoutPortrait(null, [{ slot: 4, label: "Ring", colour: "#fff", inscription: null, key: "gear:3" }])[0]).toMatchObject({ label: "Slot 5", row: null, key: "gear:3" });
    expect(stepSelection(3, -1, "ArrowDown")).toBe(0);
    expect(stepSelection(3, 0, "ArrowUp")).toBe(2);
    expect(FIGURE).toHaveLength(17);
    for (const line of FIGURE) {
      expect(line).toHaveLength(21);
      expect([...line].every((glyph) => glyph.charCodeAt(0) < 128)).toBe(true);
    }
  });

  it("draws the ASCII figure and no image", () => {
    const parent = new FakeNode();
    const onSelect = vi.fn();
    renderEquipmentPortrait(parent as unknown as HTMLElement, [{ name: "weapon" }, { name: "head" }, { name: "tail" }], [worn], null, onSelect);
    expect(parent.text()).toContain("1 / 3 slots occupied");
    expect(parent.text()).toContain("Long Sword");
    expect(parent.text()).toContain("Empty");
    expect(parent.walk().some((node) => node.tag === "img")).toBe(false);
    expect(parent.walk().find((node) => node.tag === "pre")?.textContent).toBe(FIGURE.join("\n"));
    parent.children[0]?.fire("keydown", "ArrowDown");
    expect(onSelect).toHaveBeenCalledWith("gear:1");
    parent.walk().find((node) => node.tag === "button" && node.text().includes("Head"))?.fire("click");
    expect(onSelect).toHaveBeenCalledWith("empty:1");
  });

  it("opens the figure from the equipment tab and keeps the list one button away", () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { HTMLElement: class {} });
    const gear = { handle: 8, kindKey: "kind:sword", label: "Long Sword", number: 1, inscription: null, kindId: "sword", tval: 1, sval: 2, artifact: false, ego: false };
    const snap = { token: { epoch: 1, revision: 1 }, phase: "play", prompt: null, core: {
      inventory: [], equipment: [gear, null],
      equipmentSlots: [{ type: "WEAPON", name: "weapon" }, { type: "HEAD", name: "head" }],
    } } as ItemPanelSnapshot;
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    vi.stubGlobal("document", { createElement: () => new FakeNode("section") });
    const close = vi.fn();
    const open = (flags: Record<string, boolean>) => installItems({
      flags, log: () => {}, snapshot: () => snap,
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close }) },
    });
    const portraitOnly = open({ "anybandui.equipmentPortrait": true });
    expect(root.text()).toContain("1 / 2 slots occupied");
    expect(root.text()).toContain(".---.");
    expect(root.walk().some((node) => node.placeholder === "Search items")).toBe(false);
    expect(root.walk().some((node) => node.tag === "h3" && node.textContent === "Inspection")).toBe(false);
    root.walk().find((node) => node.tag === "button" && node.text().includes("Long Sword"))?.fire("click");
    expect(root.walk().some((node) => node.tag === "h3" && node.textContent === "Inspection")).toBe(true);
    root.walk().find((node) => node.tag === "button" && node.text().includes("Head"))?.fire("click");
    expect(root.walk().some((node) => node.tag === "p" && node.textContent === "Empty")).toBe(true);
    portraitOnly();
    root.replaceChildren();
    const both = open({ "anybandui.equipmentPortrait": true, "anybandui.itemsLists": true });
    expect(root.walk().some((node) => node.placeholder === "Search items")).toBe(true);
    root.byText("Equipment")?.fire("click");
    expect(root.byText("Figure")?.attributes["aria-pressed"]).toBe("true");
    expect(root.text()).toContain("1 / 2 slots occupied");
    root.byText("List")?.fire("click");
    expect(root.walk().some((node) => node.placeholder === "Search items")).toBe(true);
    expect(root.walk().some((node) => node.tag === "pre")).toBe(false);
    expect(root.text()).toContain("Slot");
    both();
    expect(close).toHaveBeenCalled();
  });

  it("restores a slot button's focus without a text selection, and keeps a search caret", () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { HTMLElement: class {} });
    const gear = { handle: 8, kindKey: "kind:sword", label: "Long Sword", number: 1, inscription: null, kindId: "sword", tval: 1, sval: 2, artifact: false, ego: false };
    const source = { token: { epoch: 1, revision: 1 }, phase: "play" as const, prompt: null, core: {
      inventory: [gear], equipment: [gear, null],
      equipmentSlots: [{ type: "WEAPON", name: "weapon" }, { type: "HEAD", name: "head" }],
    } };
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    vi.stubGlobal("document", { createElement: () => new FakeNode("section") });
    const cleanup = installItems({
      flags: { "anybandui.equipmentPortrait": true, "anybandui.itemsLists": true }, log: () => {},
      snapshot: () => source as unknown as ItemPanelSnapshot,
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close: () => {} }) },
    });
    const search = root.walk().find((node) => node.dataset["focus"] === "item-search");
    expect(search?.tag).toBe("input");
    search!.selectionStart = 1;
    search!.selectionEnd = 4;
    search!.focus();
    gear.label = "Broad Sword";
    vi.advanceTimersByTime(200);
    const field = root.walk().find((node) => node.dataset["focus"] === "item-search");
    expect(field?.selectionStart).toBe(1);
    expect(field?.selectionEnd).toBe(4);
    expect(root.activeElement).toBe(field);
    expect(root.text()).toContain("Broad Sword");
    root.byText("Equipment")?.fire("click");
    const slot = root.walk().find((node) => node.dataset["focus"] === "portrait-slot");
    expect(slot?.tag).toBe("button");
    slot?.focus();
    gear.label = "Short Sword";
    expect(() => { vi.advanceTimersByTime(200); }).not.toThrow();
    expect(root.text()).toContain("Short Sword");
    expect(root.activeElement?.tag).toBe("button");
    expect(root.activeElement?.dataset["focus"]).toBe("portrait-slot");
    cleanup();
  });
});
