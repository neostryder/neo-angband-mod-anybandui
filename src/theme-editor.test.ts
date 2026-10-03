import { afterEach, describe, expect, it, vi } from "vitest";
import { installThemeEditor } from "./theme-editor.js";
import { onThemeChange, THEMES } from "./theme.js";

class FakeNode {
  children: FakeNode[] = [];
  className = "";
  textContent = "";
  type = "";
  value = "";
  checked = false;
  min = "";
  max = "";
  step = "";
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  host?: FakeNode;
  activeElement: FakeNode | null = null;
  rootNode: FakeNode;
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
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
    return null;
  }
  focus(): void { this.rootNode.activeElement = this; }
  setSelectionRange(start: number, end: number | null): void { this.selectionStart = start; this.selectionEnd = end; }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  byText(label: string): FakeNode | undefined { return this.walk().find((node) => node.tag === "button" && node.textContent === label); }
}

describe("theme editor", () => {
  const original = globalThis.HTMLElement;
  afterEach(() => { Object.assign(globalThis, { HTMLElement: original }); });

  it("stays closed until its switch is on", () => {
    const openPanel = vi.fn();
    const cleanup = installThemeEditor({ flags: {}, log: () => {}, ui: { openPanel } });
    cleanup();
    expect(openPanel).not.toHaveBeenCalled();
  });

  it("saves a custom theme and inverts the dungeon only after Save", () => {
    Object.assign(globalThis, { HTMLElement: class {} });
    let saved: unknown = null;
    const setVisualFilter = vi.fn((_filter: string | null, _options?: { scope?: "canvas" | "game" }) => {});
    const setChromeTheme = vi.fn();
    const root = new FakeNode("root");
    root.host = new FakeNode("host");
    const close = vi.fn();
    const seen: string[] = [];
    const stop = onThemeChange((theme) => { seen.push(`${theme.background}:${theme.invert_dungeon}`); });
    const cleanup = installThemeEditor({
      flags: { "anybandui.themeEditor": true }, log: () => {},
      prefs: { get: () => saved, set: (value) => { saved = value; } },
      display: { setVisualFilter, getVisualFilter: () => null, setChromeTheme },
      ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close }) },
    });
    expect(root.text()).toContain("Background");
    expect(root.text()).toContain("Invert dungeon colours");
    expect(root.byText("Terminal (original)")).toBeDefined();
    const background = root.walk().find((node) => node.dataset["focus"] === "background");
    background!.value = "#112233";
    background?.fire("input");
    const box = root.walk().find((node) => node.type === "checkbox");
    box!.checked = true;
    box?.fire("change");
    expect(setVisualFilter).not.toHaveBeenCalled();
    expect(saved).toBeNull();
    expect(seen).toEqual([]);
    root.byText("Save")?.fire("click");
    expect(saved).toMatchObject({ theme: "terminal-original", customTheme: { background: "#112233ff", invert_dungeon: true, rounding: THEMES["terminal-original"]!.rounding } });
    expect(setVisualFilter).toHaveBeenCalledWith("invert(1)", { scope: "canvas" });
    expect(setChromeTheme).toHaveBeenCalled();
    expect(root.text()).toContain("Saved.");
    expect(seen.at(-1)).toBe("#112233ff:true");
    root.byText("Drop custom theme")?.fire("click");
    expect(saved).toMatchObject({ customTheme: null });
    expect(setVisualFilter).toHaveBeenLastCalledWith(null, { scope: "canvas" });
    expect(root.text()).toContain("Using the preset.");
    expect(seen.at(-1)).toBe(`${THEMES["terminal-original"]!.background}:false`);
    stop();
    cleanup();
    expect(close).toHaveBeenCalled();
  });
});
