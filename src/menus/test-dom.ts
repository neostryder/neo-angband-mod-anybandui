/**
 * A minimal stand-in for the panel DOM, for the menu tests. It carries only what
 * the menus touch: elements, text, attributes, listeners, focus and a caret.
 */
import type { PanelKindSpec } from "../seams.js";

export interface FakeEvent { key: string; shiftKey: boolean; preventDefault(): void; stopPropagation(): void; defaultPrevented: boolean }

export class FakeNode {
  children: FakeNode[] = [];
  parent: FakeNode | null = null;
  className = "";
  textContent = "";
  type = "";
  value = "";
  checked = false;
  disabled = false;
  hidden = false;
  open = false;
  id = "";
  htmlFor = "";
  min = "";
  max = "";
  step = "";
  placeholder = "";
  tabIndex = -1;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  host?: FakeNode;
  activeElement: FakeNode | null = null;
  rootNode: FakeNode;
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  private listeners = new Map<string, Array<(event: FakeEvent) => void>>();
  constructor(readonly tag = "div") { this.rootNode = this; }
  get tagName(): string { return this.tag.toUpperCase(); }
  get firstElementChild(): FakeNode | null { return this.children[0] ?? null; }
  get lastElementChild(): FakeNode | null { return this.children.at(-1) ?? null; }
  get classList() {
    return { toggle: (name: string, force: boolean): void => {
      const classes = this.className.split(" ").filter((value) => value && value !== name);
      if (force) classes.push(name);
      this.className = classes.join(" ");
    } };
  }
  get ownerDocument() {
    const root = this.rootNode;
    return {
      createElement: (tag: string) => { const node = new FakeNode(tag); node.rootNode = root; return node; },
      createTextNode: (text: string) => { const node = new FakeNode("#text"); node.textContent = text; node.rootNode = root; return node; },
    };
  }
  getRootNode(): FakeNode { return this.rootNode; }
  appendChild(child: FakeNode): FakeNode {
    child.remove();
    child.rootNode = this.rootNode; child.parent = this; this.children.push(child); return child;
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  closest(selector: string): FakeNode | null {
    for (let node: FakeNode | null = this; node; node = node.parent) {
      if (selector === "[hidden]" ? node.hidden : node.tag === selector) return node;
    }
    return null;
  }
  replaceChildren(): void {
    if (this.rootNode.activeElement && this.contains(this.rootNode.activeElement) && this.rootNode.activeElement !== this) this.rootNode.activeElement = null;
    this.children = [];
  }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  getAttribute(name: string): string | null { return this.attributes[name] ?? null; }
  addEventListener(type: string, listener: (event: FakeEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  /** Fires on this node, then bubbles to its parents unless stopped. */
  fire(type: string, key = "", shiftKey = false, init: Record<string, unknown> = {}): FakeEvent {
    let stopped = false;
    const event: FakeEvent = { key, shiftKey, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; }, stopPropagation() { stopped = true; }, ...init };
    Object.assign(event, { target: this });
    for (let node: FakeNode | null = this; node && !stopped; node = node.parent) {
      for (const listener of node.listeners.get(type) ?? []) listener(event);
    }
    return event;
  }
  click(): void {
    if (this.disabled) return;
    const event = this.fire("click");
    if (!event.defaultPrevented && this.tag === "summary" && this.parent?.tag === "details") {
      this.parent.open = !this.parent.open;
      this.parent.fire("toggle");
    }
  }
  /** Types into an input and fires its input event. */
  enter(value: string): void { this.value = value; this.selectionStart = value.length; this.selectionEnd = value.length; this.fire("input"); }
  contains(node: FakeNode): boolean { return this.walk().includes(node); }
  querySelectorAll(selector: string): FakeNode[] {
    if (selector === "[data-focus]") return this.walk().filter((node) => node.dataset["focus"] !== undefined);
    return [];
  }
  querySelector(selector: string): FakeNode | null { return this.querySelectorAll(selector)[0] ?? null; }
  focus(): void { this.rootNode.activeElement = this; this.fire("focus"); }
  setSelectionRange(start: number, end: number | null): void { this.selectionStart = start; this.selectionEnd = end; }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  byFocus(key: string): FakeNode | undefined { return this.walk().find((node) => node.dataset["focus"] === key); }
  byText(label: string, tag = "button"): FakeNode | undefined { return this.walk().find((node) => node.tag === tag && node.textContent === label); }
  focused(): string | undefined { return this.rootNode.activeElement?.dataset["focus"]; }
}

/** The fallback overlay panel the menus open on a host without panel kinds. */
export function overlayUi(): { root: FakeNode; close: () => void; ui: { openPanel(): { root: ShadowRoot; closed: Promise<void>; close(): void } } } {
  const root = new FakeNode("root");
  root.host = new FakeNode("host");
  const close = (): void => {};
  return { root, close, ui: { openPanel: () => ({ root: root as unknown as ShadowRoot, closed: new Promise<void>(() => {}), close }) } };
}

/** A host with panel kinds, holding one pane the test can take down and put back. */
export function paneUi(): { root: FakeNode; unmount: () => void; remount: () => void; ui: { registerPanelKind(spec: PanelKindSpec): () => void } } {
  const root = new FakeNode("root");
  root.host = new FakeNode("host");
  let kind: PanelKindSpec | null = null;
  let release: void | (() => void);
  const remount = (): void => {
    if (!kind) return;
    release = kind.mount({ id: kind.kind, root: root as unknown as ShadowRoot, bounds: { width: 480, height: 360 }, active: true, focused: false,
      onStateChange: () => () => {}, requestFocus: () => {}, requestClose: () => {}, setFitHeight: () => {} });
  };
  const unmount = (): void => {
    root.activeElement = null;
    root.children = [];
    if (typeof release === "function") release();
    release = undefined;
  };
  return { root, unmount, remount, ui: { registerPanelKind: (spec) => { kind = spec; remount(); return () => { kind = null; }; } } };
}

/** applyTheme checks the panel host against HTMLElement, which Node lacks. */
export function installDomGlobals(): () => void {
  const had = "HTMLElement" in globalThis;
  const original = (globalThis as { HTMLElement?: unknown }).HTMLElement;
  Object.assign(globalThis, { HTMLElement: class {} });
  return () => { if (had) Object.assign(globalThis, { HTMLElement: original }); else delete (globalThis as { HTMLElement?: unknown }).HTMLElement; };
}
