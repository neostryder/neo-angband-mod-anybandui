import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelKindSpec, PanelMount, PanelState } from "../seams.js";
import type { ViewModel } from "../view-model/protocol.js";
import { characterPaneOwnsSidebar, gateSidebarExtent, installCharacterPane, PANE_SIDEBAR_EXTENT } from "./character-pane.js";
import type { PanelSpec } from "./panel-host.js";

class Node {
  children: Node[] = [];
  className = "";
  textContent = "";
  style: Record<string, unknown> = { setProperty(): void {} };
  dataset: Record<string, string> = {};
  host?: Node;
  readonly ownerDocument = { createElement: (): Node => new Node() };
  appendChild(child: Node): Node { this.children.push(child); return child; }
  addEventListener(): void {}
}
const root = (): ShadowRoot => { const r = new Node(); r.host = new Node(); return r as unknown as ShadowRoot; };
const model = (hp: number): ViewModel => ({ player: { hp } }) as unknown as ViewModel;

function paneHost(): PanelMount & { listeners: ((state: PanelState) => void)[] } {
  const listeners: ((state: PanelState) => void)[] = [];
  return { id: "anybandui:character", root: root(), bounds: { width: 200, height: 300 }, active: true, focused: false, listeners,
    onStateChange: (listener) => { listeners.push(listener); return () => {}; }, requestFocus: vi.fn(), requestClose: vi.fn(), setFitHeight: vi.fn() };
}

describe("the character pane", () => {
  const original = globalThis.HTMLElement;
  beforeEach(() => { Object.assign(globalThis, { HTMLElement: Node }); });
  afterEach(() => { Object.assign(globalThis, { HTMLElement: original }); });

  const renders: { container: unknown; hp: number }[] = [];
  const panels: PanelSpec[] = [{ key: "character", select: (m) => m.player.hp, render: (mount, m) => { renders.push({ container: mount, hp: m.player.hp }); } }];
  beforeEach(() => { renders.length = 0; });

  it("declines without panel kinds, so an older engine keeps the card over the column", () => {
    const setSidebarExtent = vi.fn();
    const openPanel = vi.fn();
    expect(installCharacterPane({ log: vi.fn(), ui: { openPanel }, display: { setSidebarExtent } }, panels)).toBeNull();
    expect(openPanel).not.toHaveBeenCalled();
    expect(setSidebarExtent).not.toHaveBeenCalled();
  });

  it("registers one pane docked where the column was and draws the card into it", () => {
    const registered: PanelKindSpec[] = [];
    const unregister = vi.fn();
    const pane = installCharacterPane({ log: vi.fn(), ui: { registerPanelKind: (spec) => { registered.push(spec); return unregister; } } }, panels)!;
    expect(registered.map((spec) => spec.kind)).toEqual(["character"]);
    expect(registered[0]?.preferredPlacement).toEqual({ kind: "dock", target: "main", edge: "left" });
    pane.paint(model(5));
    expect(renders).toEqual([]);
    const host = paneHost();
    registered[0]!.mount(host);
    expect(renders.map((entry) => entry.hp)).toEqual([5]);
    pane.paint(model(5));
    pane.paint(model(7));
    expect(renders.map((entry) => entry.hp)).toEqual([5, 7]);
    host.listeners[0]!({ bounds: host.bounds, active: false, focused: false });
    pane.paint(model(9));
    expect(renders.map((entry) => entry.hp)).toEqual([5, 7]);
    pane.close();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it("survives a host that mounts a saved pane during registration", () => {
    const pane = installCharacterPane({ log: vi.fn(), ui: { registerPanelKind: (spec) => { spec.mount(paneHost()); return () => {}; } } }, panels)!;
    pane.paint(model(3));
    expect(renders.map((entry) => entry.hp)).toEqual([3]);
    pane.close();
  });

  it("gives the column back once the sidebar sink runs, and clears the request on close", () => {
    const setSidebarExtent = vi.fn();
    const pane = installCharacterPane({ log: vi.fn(), ui: { registerPanelKind: () => () => {} }, display: { setSidebarExtent } }, panels)!;
    expect(setSidebarExtent).not.toHaveBeenCalled();
    expect(characterPaneOwnsSidebar()).toBe(false);
    pane.claimSidebar();
    pane.claimSidebar();
    expect(setSidebarExtent.mock.calls).toEqual([[PANE_SIDEBAR_EXTENT]]);
    expect(characterPaneOwnsSidebar()).toBe(true);
    pane.close();
    expect(setSidebarExtent.mock.calls).toEqual([[PANE_SIDEBAR_EXTENT], [null]]);
    expect(characterPaneOwnsSidebar()).toBe(false);
  });

  it("does not clear a sidebar request it never made", () => {
    const setSidebarExtent = vi.fn();
    installCharacterPane({ log: vi.fn(), ui: { registerPanelKind: () => () => {} }, display: { setSidebarExtent } }, panels)!.close();
    expect(setSidebarExtent).not.toHaveBeenCalled();
  });

  it("turns zoom's sidebar reservation into the pane's request only while the pane owns the sidebar", () => {
    const calls: unknown[] = [];
    const display = { setSidebarExtent(extent: unknown): void { calls.push(extent); }, repaint(this: { tag: string }): string { return this.tag; }, tag: "bound" };
    const gated = gateSidebarExtent(display);
    gated.setSidebarExtent({ columns: 12, topRows: 1 });
    const pane = installCharacterPane({ log: vi.fn(), ui: { registerPanelKind: () => () => {} }, display: gated }, panels)!;
    pane.claimSidebar();
    gated.setSidebarExtent({ columns: 12, topRows: 1 });
    gated.setSidebarExtent(null);
    pane.close();
    gated.setSidebarExtent({ columns: 14, topRows: 2 });
    expect(calls).toEqual([{ columns: 12, topRows: 1 }, PANE_SIDEBAR_EXTENT, PANE_SIDEBAR_EXTENT, null, null, { columns: 14, topRows: 2 }]);
    expect(gated.repaint()).toBe("bound");
  });

  it("wraps a frozen display, which is what the host hands a plugin", () => {
    const calls: unknown[] = [];
    const display = Object.freeze({ setSidebarExtent(extent: unknown): void { calls.push(extent); }, getGrid: () => null, cols: 80 });
    const gated = gateSidebarExtent(display);
    expect(typeof gated.getGrid).toBe("function");
    expect(gated.getGrid()).toBeNull();
    expect(gated.cols).toBe(80);
    expect("getGrid" in gated).toBe(true);
    gated.setSidebarExtent({ columns: 12, topRows: 1 });
    expect(calls).toEqual([{ columns: 12, topRows: 1 }]);
  });
});
