import { afterEach, describe, expect, it, vi } from "vitest";
import type { HudFrame, HudSection } from "@rpgm-tools/neo-angband-mod-sdk";
import plugin from "../plugin.js";
import { controllerOwned, currentDriver, playerIsDriving } from "./input-owner.js";
import { coexistingFlags, MOVED_FROM_QOL, qolKeepsMovedFeatures } from "./mod-coexistence.js";
import type { DriverSeams, InputDriver, PublicMod } from "./seams.js";

const borg: InputDriver = { kind: "controller", owner: "borg", label: "Clearing level 5" };
const allMoved = Object.fromEntries(MOVED_FROM_QOL.map(({ flag }) => [flag, true]));

afterEach(() => {
  plugin.uninstall();
  vi.unstubAllGlobals();
});

describe("who is driving", () => {
  it("reads core's ctx.driver() and treats an absent read as the player", () => {
    expect(playerIsDriving(undefined)).toBe(true);
    expect(playerIsDriving({})).toBe(true);
    expect(playerIsDriving({ driver: () => ({ kind: "player" }) } satisfies DriverSeams)).toBe(true);
    expect(playerIsDriving({ driver: () => borg } satisfies DriverSeams)).toBe(false);
    expect(currentDriver({ driver: () => borg })).toEqual(borg);
  });

  it("does not read the snapshot, so a check never costs a second capture", () => {
    const snapshot = vi.fn(() => ({ driver: borg }));
    expect(playerIsDriving({ snapshot })).toBe(true);
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("treats a malformed answer as the player", () => {
    expect(playerIsDriving({ driver: () => null })).toBe(true);
    expect(playerIsDriving({ driver: () => ({ kind: "controller" }) })).toBe(true);
    expect(playerIsDriving({ driver: "borg" })).toBe(true);
  });

  it("recognises core's controller-owned refusal", () => {
    expect(controllerOwned({ accepted: false, code: "controller-owned", reason: "input is owned by controller borg" } as { code?: string })).toBe(true);
    expect(controllerOwned({ accepted: false, reason: "stale token" } as { code?: string })).toBe(false);
    expect(controllerOwned(undefined)).toBe(false);
  });
});

describe("coexisting with an older Quality of Life", () => {
  const mods = (...rows: PublicMod[]) => () => rows;

  it("knows 1.12.0 is the last Quality of Life with the moved features", () => {
    expect(qolKeepsMovedFeatures("1.12.0")).toBe(true);
    expect(qolKeepsMovedFeatures("1.9.3")).toBe(true);
    expect(qolKeepsMovedFeatures("0.4.0")).toBe(true);
    expect(qolKeepsMovedFeatures("1.12.1")).toBe(false);
    expect(qolKeepsMovedFeatures("1.13.0")).toBe(false);
    expect(qolKeepsMovedFeatures("2.0.0")).toBe(false);
    expect(qolKeepsMovedFeatures("next")).toBe(false);
  });

  it("stands down every moved feature beside Quality of Life 1.12.0, with one log line", () => {
    const log = vi.fn();
    const flags = { ...allMoved, "anybandui.crt": true, "anybandui.sidebar": true };
    const result = coexistingFlags(flags, mods({ id: "anybandui", version: "0.1.0" }, { id: "qol", version: "1.12.0" }), log);
    for (const { flag } of MOVED_FROM_QOL) expect(result[flag]).toBe(false);
    expect(result["anybandui.crt"]).toBe(true);
    expect(result["anybandui.sidebar"]).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toContain("Quality of Life 1.12.0");
  });

  it("keeps every feature beside a Quality of Life that no longer ships them", () => {
    const log = vi.fn();
    const result = coexistingFlags(allMoved, mods({ id: "qol", version: "1.13.0" }), log);
    expect(result).toEqual(allMoved);
    expect(log).not.toHaveBeenCalled();
  });

  it("keeps every feature with no Quality of Life, no mod list, or a failing mod list", () => {
    expect(coexistingFlags(allMoved, mods({ id: "borg", version: "1.2.1" }))).toEqual(allMoved);
    expect(coexistingFlags(allMoved, undefined)).toEqual(allMoved);
    expect(coexistingFlags(allMoved, () => { throw new Error("torn down"); })).toEqual(allMoved);
  });

  it("logs nothing when the player turned none of the moved features on", () => {
    const log = vi.fn();
    expect(coexistingFlags({ "anybandui.crt": true }, mods({ id: "qol", version: "1.12.0" }), log)).toEqual({ "anybandui.crt": true });
    expect(log).not.toHaveBeenCalled();
  });

  it("lets a published Quality of Life flag decide when the row carries one", () => {
    const result = coexistingFlags(allMoved, mods({ id: "qol", version: "1.12.0", flags: { "qol.zoomPan": false, "qol.mapHoverCards": true } }));
    expect(result["anybandui.zoom"]).toBe(true);
    expect(result["anybandui.mapHoverCards"]).toBe(false);
    expect(result["anybandui.quiverItemization"]).toBe(false);
  });

  it("draws no second itemized quiver or filter beside Quality of Life 1.12.0, and does beside a newer one", () => {
    for (const [version, drawn] of [["1.12.0", false], ["1.13.0", true]] as const) {
      const setQuiverItemization = vi.fn();
      const setVisualFilter = vi.fn();
      const logged: string[] = [];
      plugin.register(undefined, { id: "anybandui", engine: "1.19.0", log: (m) => logged.push(m),
        flags: { "anybandui.quiverItemization": true, "anybandui.highContrast": true },
        mods: () => [{ id: "qol", version }],
        display: { setVisualFilter, setQuiverItemization } });
      expect(setQuiverItemization.mock.calls.length > 0).toBe(drawn);
      expect(setVisualFilter.mock.calls.some(([filter]) => filter !== null)).toBe(drawn);
      expect(logged.some((line) => line.includes("Quality of Life"))).toBe(!drawn);
      plugin.uninstall();
    }
  });
});

describe("the driving badge in the status panel", () => {
  class Stub {
    children: Stub[] = [];
    className = "";
    dataset: Record<string, string> = {};
    style: Record<string, string> & { setProperty(): void } = { setProperty: () => {} } as never;
    textContent = "";
    host?: Stub;
    constructor(readonly ownerDocument: Document) {}
    attachShadow(): Stub { const root = new Stub(this.ownerDocument); root.host = this; return root; }
    appendChild(child: Stub): Stub { this.children.push(child); return child; }
    replaceChildren(): void { this.children = []; }
    addEventListener(): void {}
  }

  it("listens for driver-changed while registered and redraws the status panel with its last frame", () => {
    const doc = { createElement: () => new Stub(doc as unknown as Document), body: undefined as unknown as Stub } as { createElement(): Stub; body: Stub };
    doc.body = new Stub(doc as unknown as Document);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("HTMLElement", Stub);
    const handlers = new Set<(type: "driver-changed", event: InputDriver) => void>();
    const events = { on: vi.fn((_name: string, fn: (type: "driver-changed", event: InputDriver) => void) => { handlers.add(fn); }),
      off: vi.fn((_name: string, fn: (type: "driver-changed", event: InputDriver) => void) => { handlers.delete(fn); }) };
    let driver: InputDriver = { kind: "player" };
    const ctx = { id: "anybandui", engine: "1.19.0", log: () => {}, events, driver: () => driver,
      flags: { "anybandui.status": true }, core: { createAgentView: () => { throw new Error("no game"); } } };
    plugin.register(undefined, ctx as unknown as Parameters<typeof plugin.register>[1]);
    expect(events.on).toHaveBeenCalledWith("driver-changed", expect.any(Function));
    const output = plugin.hud(ctx as unknown as Parameters<typeof plugin.hud>[0])!;
    const section = { entries: [] } as unknown as HudSection;
    const frame = { layout: "left" } as unknown as HudFrame;
    output.status!.present(section, frame);
    const present = vi.fn();
    (output.status as { present: typeof present }).present = present;
    driver = borg;
    for (const handler of handlers) handler("driver-changed", borg);
    expect(present).toHaveBeenCalledWith(section, frame);
    plugin.uninstall();
    expect(handlers.size).toBe(0);
  });

  it("registers on an engine whose event stream refuses driver-changed", () => {
    const events = { on: vi.fn(() => { throw new Error('capability "event:driver-changed" is not granted'); }), off: vi.fn() };
    expect(() => plugin.register(undefined, { id: "anybandui", engine: "1.18.0", log: () => {}, events } as unknown as Parameters<typeof plugin.register>[1])).not.toThrow();
  });
});
