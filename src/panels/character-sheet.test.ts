import { afterEach, describe, expect, it, vi } from "vitest";
import type { CharacterSheetData } from "@rpgm-tools/neo-angband-core";
import type { PanelKindSpec } from "../seams.js";
import { installCharacterSheet, renderCharacterSheet, SHEET_PAGES, statCells, statLabel, STAT_HEADERS, stepSheetPage } from "./character-sheet.js";

class FakeNode {
  children: FakeNode[] = [];
  className = "";
  textContent = "";
  type = "";
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
    if (focus) return this.walk().find((node) => node.dataset["focus"] === focus[1]) ?? null;
    return this.walk().find((node) => node.tag === selector) ?? null;
  }
  focus(): void { this.rootNode.activeElement = this; }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  byText(label: string): FakeNode | undefined { return this.walk().find((node) => node.tag === "button" && node.textContent === label); }
}

const colour = { color: 1, css: "#80b891" };
const sheet = (): CharacterSheetData => ({
  name: "Ari",
  panels: [
    { key: "topleft", lines: [{ label: "Name", value: "Ari", ...colour }, { label: "", value: "", ...colour }] },
    { key: "combat", lines: [{ label: "Armor", value: "[10,+2]", ...colour }] },
    { key: "skills", lines: [{ label: "Speed", value: "Normal", ...colour }] },
    { key: "notes", lines: [{ label: "Note", value: "A spare panel", ...colour }] },
  ],
  stats: [
    { key: "str", label: "STR: ", natural: "18/40", raceBonus: "+2", classBonus: "-1", equipBonus: "+3", best: "18/50", reduced: "16", naturalMax: true, drained: true },
    { key: "int", label: "INT: ", natural: "18", raceBonus: "+0", classBonus: "+1", equipBonus: "+0", best: "18/20", reduced: null, naturalMax: false, drained: false },
  ],
  history: "Born in a small town.",
  grids: null,
});

describe("character sheet", () => {
  const original = globalThis.HTMLElement;
  afterEach(() => { vi.useRealTimers(); Object.assign(globalThis, { HTMLElement: original }); });

  it("lays out AnybandUI's seven stat columns from the game's sheet rows", () => {
    expect(STAT_HEADERS).toEqual(["Stat", "Base", "Race", "Class", "Gear", "Best", "Current"]);
    expect(statLabel("STR: ", true)).toBe("STR! ");
    expect(statLabel("INT: ", false)).toBe("INT: ");
    expect(statLabel("STR", true)).toBe("STR!");
    expect(statLabel("STR!", true)).toBe("STR!");
    expect(statCells(sheet().stats[0]!)).toEqual({ label: "STR! ", base: "18/40", race: "+2", classBonus: "-1", gear: "+3", best: "18/50", current: "16", drained: true });
    expect(statCells(sheet().stats[1]!).current).toBe("18/20");
    expect(stepSheetPage(0, "ArrowLeft")).toBe(SHEET_PAGES.length - 1);
    expect(stepSheetPage(1, "Home")).toBe(0);
    expect(stepSheetPage(0, "End")).toBe(SHEET_PAGES.length - 1);
    expect(stepSheetPage(0, "a")).toBeNull();
  });

  it("draws panels, stats and flags as text, with no tile", () => {
    const parent = new FakeNode();
    const onPage = vi.fn();
    renderCharacterSheet(parent as unknown as HTMLElement, sheet(), 0, onPage);
    expect(parent.text()).toContain("Ari");
    expect(parent.text()).toContain("Stat");
    expect(parent.text()).toContain("Current");
    expect(parent.text()).toContain("STR! ");
    expect(parent.text()).toContain("A spare panel");
    const drained = parent.walk().find((node) => node.className === "drained");
    expect(drained?.text()).toContain("16");
    expect(parent.text()).not.toContain("Armor");
    expect(parent.walk().some((node) => node.tag === "img")).toBe(false);
    const pages = parent.walk().filter((node) => node.tag === "button").map((node) => node.dataset["focus"]);
    expect(pages).toEqual(["sheet-page-overview", "sheet-page-combat", "sheet-page-flags", "sheet-page-history"]);
    parent.walk().find((node) => node.attributes["role"] === "tablist")?.fire("keydown", "ArrowRight");
    expect(onPage).toHaveBeenCalledWith(1, true);
    parent.replaceChildren();
    renderCharacterSheet(parent as unknown as HTMLElement, sheet(), 1, onPage);
    expect(parent.text()).toContain("Armor");
    expect(parent.text()).toContain("Speed");
    parent.replaceChildren();
    renderCharacterSheet(parent as unknown as HTMLElement, sheet(), 2, onPage);
    expect(parent.text()).toContain("The flag grid is not available in this game.");
    parent.replaceChildren();
    renderCharacterSheet(parent as unknown as HTMLElement, { ...sheet(), history: "", grids: [] }, 2, onPage);
    expect(parent.text()).toContain("No flags.");
    parent.replaceChildren();
    renderCharacterSheet(parent as unknown as HTMLElement, { ...sheet(), history: "" }, 3, onPage);
    expect(parent.text()).toContain("No background.");
    parent.replaceChildren();
    renderCharacterSheet(parent as unknown as HTMLElement, null, 0, onPage);
    expect(parent.text()).toContain("Character sheet unavailable.");
  });

  it("stays closed until its switch is on, then reads the sheet and clears its timer", () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { HTMLElement: class {} });
    const log = vi.fn();
    expect(installCharacterSheet({ flags: {}, log })()).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
    const missing = installCharacterSheet({ flags: { "anybandui.characterSheet": true }, log });
    expect(log).toHaveBeenCalledWith("character sheet: this game has no sheet read");
    expect(log).toHaveBeenCalledWith("character sheet: panel seam unavailable");
    missing();
    const read = vi.fn((): CharacterSheetData | null => { throw new Error("unread"); });
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    const close = vi.fn();
    const cleanup = installCharacterSheet({
      flags: { "anybandui.characterSheet": true }, log, character: { sheet: read },
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close }) },
    });
    expect(root.text()).toContain("Character sheet unavailable.");
    expect(read).toHaveBeenCalled();
    const calls = read.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(read.mock.calls.length).toBeGreaterThan(calls);
    cleanup();
    const after = read.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(read.mock.calls.length).toBe(after);
    expect(close).toHaveBeenCalled();
  });

  it("stops reading when the sheet closes and reads again when its pane returns", async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { HTMLElement: class {} });
    const read = vi.fn(() => sheet());
    let resolveClosed: () => void = () => {};
    const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    const overlay = installCharacterSheet({
      flags: { "anybandui.characterSheet": true }, log: () => {}, character: { sheet: read },
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed, close: () => resolveClosed() }) },
    });
    const running = read.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(read.mock.calls.length).toBeGreaterThan(running);
    resolveClosed();
    await closed;
    const stopped = read.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(read.mock.calls.length).toBe(stopped);
    overlay();
    const registered: PanelKindSpec[] = [];
    const paneRead = vi.fn(() => sheet());
    const paneRoot = new FakeNode("root");
    paneRoot.host = new FakeNode("host");
    installCharacterSheet({
      flags: { "anybandui.characterSheet": true }, log: () => {}, character: { sheet: paneRead },
      ui: { registerPanelKind: (spec) => { registered.push(spec); return () => {}; } },
    });
    const idle = paneRead.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(paneRead.mock.calls.length).toBe(idle);
    const host = { id: "character-sheet", root: paneRoot as unknown as ShadowRoot, bounds: { width: 400, height: 240 }, active: true, focused: false, onStateChange: () => () => {}, requestFocus: () => {}, requestClose: () => {}, setFitHeight: () => {} };
    const unmount = registered[0]!.mount(host);
    const mounted = paneRead.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(paneRead.mock.calls.length).toBeGreaterThan(mounted);
    if (typeof unmount === "function") unmount();
    const gone = paneRead.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(paneRead.mock.calls.length).toBe(gone);
    registered[0]!.mount(host);
    const returned = paneRead.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(paneRead.mock.calls.length).toBeGreaterThan(returned);
  });

  it("keeps focus on an unselected page, and arrow keys move focus with the selected page", () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { HTMLElement: class {} });
    let name = "Ari";
    const read = vi.fn(() => ({ ...sheet(), name }));
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    const cleanup = installCharacterSheet({
      flags: { "anybandui.characterSheet": true }, log: () => {}, character: { sheet: read },
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close: () => {} }) },
    });
    root.byText("Flags")?.focus();
    name = "Ari of Gondor";
    vi.advanceTimersByTime(200);
    expect(root.activeElement?.textContent).toBe("Flags");
    expect(root.byText("Overview")?.attributes["aria-selected"]).toBe("true");
    root.byText("Overview")?.focus();
    root.walk().find((node) => node.attributes["role"] === "tablist")?.fire("keydown", "ArrowRight");
    expect(root.activeElement?.textContent).toBe("Combat");
    expect(root.byText("Combat")?.attributes["aria-selected"]).toBe("true");
    cleanup();
  });
});
