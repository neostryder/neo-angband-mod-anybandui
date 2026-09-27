import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelKindSpec, PanelMount, PanelState } from "../seams.js";
import { interfaceScale, openSurfaces } from "./surface.js";

class Node {
  children: Node[] = [];
  className = "";
  textContent = "";
  style: Record<string, string> = {};
  host?: Node;
  readonly ownerDocument = { createElement: (): Node => new Node() };
  appendChild(child: Node): Node { this.children.push(child); return child; }
}
const root = (): ShadowRoot => { const r = new Node(); r.host = new Node(); return r as unknown as ShadowRoot; };
const specs = [{ key: "spells", label: "Spells" }, { key: "quickbar", label: "Quickbar", fitHeight: 140 }] as const;
const overlay = { id: "phase4", label: "Spells and quickbar", className: "phase4" };

describe("mod card surfaces", () => {
  const original = globalThis.HTMLElement;
  beforeEach(() => { Object.assign(globalThis, { HTMLElement: class {} }); });
  afterEach(() => { Object.assign(globalThis, { HTMLElement: original }); });

  it("registers one host pane per card and paints only the active ones", () => {
    const registered: PanelKindSpec[] = []; const unregister = vi.fn();
    const ctx = { log: vi.fn(), ui: { openPanel: vi.fn(), registerPanelKind: (spec: PanelKindSpec) => { registered.push(spec); return unregister; } } };
    const onChange = vi.fn();
    const surfaces = openSurfaces(ctx, specs, overlay, "", onChange)!;
    expect(ctx.ui.openPanel).not.toHaveBeenCalled();
    expect(registered.map((spec) => spec.kind)).toEqual(["spells", "quickbar"]);
    expect(registered[1]?.fitHeight).toBe(140);
    expect(surfaces.mounts().size).toBe(0);
    const listeners: ((state: PanelState) => void)[] = [];
    const host = (active: boolean): PanelMount & { fits: (number | null)[] } => {
      const fits: (number | null)[] = [];
      return { id: "x", root: root(), bounds: { width: 300, height: 200 }, active, focused: false, fits,
        onStateChange: (listener) => { listeners.push(listener); return () => {}; }, requestFocus: vi.fn(), requestClose: vi.fn(), setFitHeight: (px) => { fits.push(px); } };
    };
    const spellHost = host(true), quickHost = host(false);
    registered[0]!.mount(spellHost); const cleanup = registered[1]!.mount(quickHost);
    expect([...surfaces.mounts().keys()]).toEqual(["spells"]);
    listeners[1]!({ bounds: { width: 300, height: 80 }, active: true, focused: false });
    expect([...surfaces.mounts().keys()]).toEqual(["spells", "quickbar"]);
    expect(onChange).toHaveBeenCalled();
    surfaces.fit("quickbar", 96.2); surfaces.fit("quickbar", 96.4);
    expect(quickHost.fits).toEqual([97]);
    if (typeof cleanup === "function") cleanup();
    expect([...surfaces.mounts().keys()]).toEqual(["spells"]);
    surfaces.close();
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it("falls back to one overlay holding every card in order", () => {
    let closeOverlay = (): void => {};
    const panel = { root: root(), closed: new Promise<void>((resolve) => { closeOverlay = resolve; }), close: vi.fn() };
    const ctx = { log: vi.fn(), ui: { openPanel: vi.fn(() => panel) } };
    const surfaces = openSurfaces(ctx, specs, overlay, "", vi.fn())!;
    expect(ctx.ui.openPanel).toHaveBeenCalledTimes(1);
    const mounts = surfaces.mounts();
    expect([...mounts.keys()]).toEqual(["spells", "quickbar"]);
    expect(mounts.get("spells")).not.toBe(mounts.get("quickbar"));
    surfaces.fit("quickbar", 90);
    surfaces.close();
    expect(panel.close).toHaveBeenCalledTimes(1);
    expect(surfaces.mounts().size).toBe(0);
    closeOverlay();
  });

  it("declines without a panel seam", () => {
    expect(openSurfaces({ log: vi.fn() }, specs, overlay, "", vi.fn())).toBeNull();
  });

  it("follows the zoom feature's interface step and stays at 100% without zoom", () => {
    expect(interfaceScale({ log: vi.fn(), prefs: { get: () => ({ display: { v: 2, zoomIndex: 7, interfaceZoomIndex: 3, mapDetail: 0 } }) } })).toBe(1);
    const blob = { v: 2, display: { v: 2, zoomIndex: 7, interfaceZoomIndex: 3, mapDetail: 0 } };
    expect(interfaceScale({ log: vi.fn(), flags: { "anybandui.zoom": true }, prefs: { get: () => blob } })).toBe(1.5);
    expect(interfaceScale({ log: vi.fn(), flags: { "anybandui.zoom": true }, prefs: { get: () => ({}) } })).toBe(1);
  });
});
