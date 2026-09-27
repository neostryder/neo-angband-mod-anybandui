/**
 * The plugin ABI, checked at the seam the host calls.
 *
 * The context is a hand-made stand-in for the host's. It carries only the fields
 * this plugin reads, because booting a game to watch a mod log one line would
 * test the host rather than the mod.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import plugin from "./plugin.js";

describe("the AnybandUI plugin", () => {
  it("implements plugin ABI 1", () => {
    expect(plugin.api).toBe(1);
  });

  it("registers without touching the registry host, and says so in the log", () => {
    const logged: string[] = [];
    plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: (m) => logged.push(m) });
    expect(logged).toEqual(["AnybandUI loaded on engine 1.18.0"]);
  });

  it("declares only the needed capabilities and disabled rules", () => {
    const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8")) as {
      capabilities: string[]; rules: { flag: string; default: boolean; requiresReload: boolean }[];
    };
    expect(manifest.capabilities).toEqual(["ui:sidebar.replace", "ui:status.replace", "ui:messages.replace", "display:filter", "ui:panel.mount", "state:map.read", "state:interaction.read", "input:intent", "input:prompt.reply"]);
    expect(manifest.rules.map((rule) => rule.flag)).toEqual(["anybandui.clickToWalk", "anybandui.dungeonActions", "anybandui.aimPath", "anybandui.walkRoutePreview", "anybandui.sidebar", "anybandui.status", "anybandui.messages", "anybandui.highContrast", "anybandui.colourblind", "anybandui.firstEncounter", "anybandui.quiverItemization", "anybandui.crispTiles", "anybandui.zoom", "anybandui.enlargedDisplay", "anybandui.dragPan", "anybandui.followPlayer", "anybandui.keepTargetInView", "anybandui.recentreOnFloor", "anybandui.mapHoverCards", "anybandui.dungeonHoverCards", "anybandui.mapOverview", "anybandui.mapSchematic"]);
    expect(manifest.rules.every((rule) => !rule.default && rule.requiresReload)).toBe(true);
  });

  it("installs quiver and crisp sampling independently and restores both on unload", () => {
    const setQuiverItemization = vi.fn();
    const setTileScaling = vi.fn();
    const setFullMapOverview = vi.fn();
    const display = { setVisualFilter: () => {}, setQuiverItemization, setTileScaling, setFullMapOverview };
    plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: () => {},
      flags: { "anybandui.quiverItemization": true, "anybandui.crispTiles": true },
      display });
    expect(setQuiverItemization).toHaveBeenCalledWith(true);
    expect(setTileScaling).toHaveBeenCalledWith("crisp");
    expect(setFullMapOverview).toHaveBeenCalledWith(true);
    plugin.uninstall();
    expect(setQuiverItemization).toHaveBeenLastCalledWith(false);
    expect(setTileScaling).toHaveBeenLastCalledWith("auto");
    expect(setFullMapOverview).toHaveBeenLastCalledWith(false);
  });

  it("leaves unselected display conveniences untouched", () => {
    const setQuiverItemization = vi.fn();
    const setTileScaling = vi.fn();
    plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: () => {},
      flags: { "anybandui.quiverItemization": true },
      display: { setVisualFilter: () => {}, setQuiverItemization, setTileScaling } });
    plugin.uninstall();
    expect(setQuiverItemization.mock.calls).toEqual([[true], [false]]);
    expect(setTileScaling).not.toHaveBeenCalled();
  });

  it("does not reset overview settings when only the zoom display seam is available", () => {
    const setTileScaling = vi.fn();
    const setFullMapOverview = vi.fn();
    plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: () => {},
      flags: { "anybandui.followPlayer": true },
      display: { setVisualFilter: () => {}, snapshot: vi.fn(), onKey: vi.fn(() => () => {}),
        setGrid: vi.fn(), setCamera: vi.fn(), setSidebarExtent: vi.fn(), repaint: vi.fn(),
        setMapView: vi.fn(), setTileScaling, setFullMapOverview } });
    plugin.uninstall();
    expect(setTileScaling).not.toHaveBeenCalled();
    expect(setFullMapOverview).not.toHaveBeenCalled();
  });

  it("applies and restores crisp overview settings once on a modern display", () => {
    const setTileScaling = vi.fn();
    const setFullMapOverview = vi.fn();
    plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: () => {},
      flags: { "anybandui.crispTiles": true, "anybandui.mapOverview": true },
      display: { setVisualFilter: () => {}, snapshot: vi.fn(), onKey: vi.fn(() => () => {}),
        setGrid: vi.fn(), setCamera: vi.fn(), setSidebarExtent: vi.fn(), repaint: vi.fn(),
        setMapView: vi.fn(), setTileScaling, setFullMapOverview } });
    plugin.uninstall();
    expect(setTileScaling.mock.calls).toEqual([["crisp"], ["auto"]]);
    expect(setFullMapOverview.mock.calls).toEqual([[true], [false]]);
  });

  it("declines without a DOM", () => {
    expect(plugin.hud({ flags: { "anybandui.sidebar": true } } as unknown as Parameters<typeof plugin.hud>[0])).toBeUndefined();
  });

  it("returns only enabled region sinks", () => {
    const originalDoc = globalThis.document;
    const originalElement = globalThis.HTMLElement;
    class Stub {
      ownerDocument: Document;
      style = { setProperty(): void {} };
      children: Stub[] = [];
      host?: Stub;
      constructor(doc: Document) { this.ownerDocument = doc; }
      attachShadow(): ShadowRoot { const root = new Stub(this.ownerDocument); root.host = this; return root as unknown as ShadowRoot; }
      appendChild(child: Stub): Stub { this.children.push(child); return child; }
      set className(_value: string) {}
      set textContent(_value: string) {}
      addEventListener(): void {}
    }
    const doc = { createElement: () => new Stub(doc as Document), body: undefined as unknown as Stub } as unknown as Document;
    (doc as unknown as { body: Stub }).body = new Stub(doc);
    Object.assign(globalThis, { document: doc, HTMLElement: Stub });
    try {
      const sinks = plugin.hud({ flags: { "anybandui.sidebar": true, "anybandui.status": false, "anybandui.messages": true } } as unknown as Parameters<typeof plugin.hud>[0]);
      expect(Object.keys(sinks ?? {})).toEqual(["sidebar", "messages"]);
    } finally {
      Object.assign(globalThis, { document: originalDoc, HTMLElement: originalElement });
    }
  });
});
