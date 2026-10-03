/**
 * A small stand-in for the DOM and the host's panel seam, for this folder's
 * tests. It models what the menus use: elements, focus, bubbling key events,
 * and modal panels that the player closes with Escape, topmost first.
 */

type Listener = (event: FakeEvent) => void;

export interface FakeEvent {
  readonly type: string;
  readonly key: string;
  defaultPrevented: boolean;
  preventDefault(): void;
}

export class FakeNode {
  children: FakeNode[] = [];
  parent: FakeNode | null = null;
  className = "";
  textContent = "";
  type = "";
  value = "";
  checked = false;
  disabled = false;
  placeholder = "";
  maxLength = -1;
  title = "";
  scrollTop = 0;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  host?: FakeNode;
  activeElement: FakeNode | null = null;
  rootNode: FakeNode;
  private listeners = new Map<string, Listener[]>();
  constructor(readonly tag = "div") { this.rootNode = this; }
  get ownerDocument(): { createElement(tag: string): FakeNode } {
    const root = this.rootNode;
    return { createElement: (tag: string) => { const node = new FakeNode(tag); node.rootNode = root; return node; } };
  }
  getRootNode(): FakeNode { return this.rootNode; }
  appendChild(child: FakeNode): FakeNode {
    child.parent = this;
    for (const node of child.walk()) node.rootNode = this.rootNode;
    this.children.push(child);
    return child;
  }
  replaceChildren(): void {
    for (const child of this.children) child.parent = null;
    this.children = [];
  }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  getAttribute(name: string): string | null { return this.attributes[name] ?? null; }
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  /** Run this node's own listeners. */
  fire(type: string, key = ""): FakeEvent {
    const event: FakeEvent = { type, key, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; } };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  /** Run listeners here and on every ancestor, as a bubbling event does. */
  dispatch(type: string, key = ""): FakeEvent {
    const event: FakeEvent = { type, key, defaultPrevented: false, preventDefault() { event.defaultPrevented = true; } };
    for (let node: FakeNode | null = this; node; node = node.parent) {
      for (const listener of node.listeners.get(type) ?? []) listener(event);
    }
    return event;
  }
  click(): void { if (!this.disabled) this.fire("click"); }
  contains(node: FakeNode): boolean { return this.walk().includes(node); }
  querySelector(selector: string): FakeNode | null {
    const focus = /\[data-focus="([^"]+)"\]/.exec(selector);
    if (focus) return this.walk().find((node) => node.dataset["focus"] === focus[1]) ?? null;
    return null;
  }
  focus(): void { this.rootNode.activeElement = this; }
  select(): void {}
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  byText(label: string): FakeNode | undefined { return this.walk().find((node) => node.tag === "button" && node.textContent === label); }
  byFocus(key: string): FakeNode | undefined { return this.walk().find((node) => node.dataset["focus"] === key); }
  all(tag: string): FakeNode[] { return this.walk().filter((node) => node.tag === tag); }
}

export interface FakePanel {
  readonly id: string;
  readonly label: string;
  readonly root: FakeNode;
  open: boolean;
  closedBy: "player" | "mod" | null;
}

/** The host's panel seam. `escape()` closes the topmost panel as the player. */
export function fakeUi(options: { refuse?: () => boolean } = {}) {
  const panels: FakePanel[] = [];
  const settle = new Map<FakePanel, () => void>();
  const finish = (panel: FakePanel, by: "player" | "mod"): void => {
    if (!panel.open) return;
    panel.open = false;
    panel.closedBy = by;
    settle.get(panel)?.();
  };
  const ui = {
    openPanel(spec: { id: string; modal: boolean; label: string }) {
      if (options.refuse?.()) throw new Error("refused");
      const root = new FakeNode("root");
      root.host = new FakeNode("host");
      const panel: FakePanel = { id: spec.id, label: spec.label, root, open: true, closedBy: null };
      const closed = new Promise<void>((resolve) => { settle.set(panel, resolve); });
      panels.push(panel);
      return { root: root as unknown as ShadowRoot, closed, close: () => finish(panel, "mod") };
    },
  };
  const live = (): FakePanel[] => panels.filter((panel) => panel.open);
  return {
    ui,
    panels,
    live,
    top: (): FakePanel | undefined => live().at(-1),
    escape(): void { const top = live().at(-1); if (top) finish(top, "player"); },
  };
}

/** A key pressed on the focused element of this root; Enter on a button clicks it unless a handler stopped it. */
export function press(root: FakeNode, key: string): FakeEvent {
  const target = root.activeElement ?? root;
  const event = target.dispatch("keydown", key);
  if (key === "Enter" && !event.defaultPrevented && target.tag === "button") target.click();
  return event;
}

/** Let promise callbacks run. */
export async function flush(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

/** Stand in for HTMLElement so applyTheme's host check can run. */
export function withHtmlElement(): () => void {
  const original = (globalThis as { HTMLElement?: unknown }).HTMLElement;
  Object.assign(globalThis, { HTMLElement: class {} });
  return () => { Object.assign(globalThis, { HTMLElement: original }); };
}
