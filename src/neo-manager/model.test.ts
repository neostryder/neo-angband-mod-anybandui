import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consentDecision, createCardTiming, displayText, exportSettings, importSettings, initialView, isPhone, keyAction, ledgerText, lookView, managerRows, recoveryView, reduceManager, settingsGroups, updateRows } from "./model.js";
import { NEO_ANGBAND_PRESET, validateNeoAngbandPreset } from "./preset.js";
import { MANAGER_SETTINGS } from "./settings.js";
import { permissionFixture, stateFixture, testHost } from "./test-host.js";

afterEach(() => vi.useRealTimers());

describe("Ledger manager model", () => {
  it("builds lettered rows and one accessible card description from Core state", () => {
    const { host } = testHost();
    const rows = managerRows(stateFixture(), initialView, host.updatePermissions, host.permissions);
    expect(rows.map((row) => [row.label, row.stateText])).toEqual([["a) AnybandUI", "ON"], ["b) Squire", "ON"], ["c) Borg", "OFF"]]);
    expect(rows[0]?.description).toContain("First-party: made by the Neo Angband team.");
    expect(rows[1]?.description).toContain("Can: See the dungeon as you know it.");
    expect(rows[1]?.description).toContain("Can: Keep notes between games.");
  });

  it("filters by search, enabled status, and updates without changing state", () => {
    const state = stateFixture();
    const before = JSON.stringify(state);
    expect(managerRows(state, { ...initialView, query: "sQuI" }).map((row) => row.id)).toEqual(["squire"]);
    expect(managerRows(state, { ...initialView, filter: "off" }).map((row) => row.id)).toEqual(["borg"]);
    expect(managerRows(state, { ...initialView, filter: "updates" })).toHaveLength(2);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("clamps navigation, expands one row, and resets on tab changes", () => {
    let view = reduceManager(initialView, { type: "move", delta: -1, length: 0 });
    expect(view.selected).toBe(0);
    view = reduceManager(view, { type: "move", delta: 8, length: 3 });
    expect(view.selected).toBe(2);
    view = reduceManager(view, { type: "expand", id: "squire" });
    expect(view.expanded).toBe("squire");
    expect(reduceManager(view, { type: "expand", id: "squire" }).expanded).toBeNull();
    expect(reduceManager(view, { type: "tab", tab: "settings" })).toEqual({ ...initialView, tab: "settings" });
  });

  it("keeps required permissions and round trips optional decisions", () => {
    expect(consentDecision(permissionFixture, [])).toEqual({ granted: ["state:map.read"], refused: ["store:kv"] });
    const decision = consentDecision(permissionFixture, ["state:map.read", "store:kv"]);
    expect(decision).toEqual({ granted: ["state:map.read", "store:kv"], refused: [] });
    expect(consentDecision(permissionFixture, decision.granted)).toEqual(decision);
  });

  it("distinguishes update permissions and treats unknown previews as needing review", () => {
    const { host } = testHost();
    const updates = updateRows(stateFixture(), host.updatePermissions);
    expect(updates.map((row) => row.review)).toEqual([false, true]);
    expect(updates[0]?.note).toBe("No new permissions.");
    expect(updateRows(stateFixture()).every((row) => row.review)).toBe(true);
    expect(updateRows({ ...stateFixture(), updates: [{ ...stateFixture().updates[0]!, newest: null }] })).toEqual([]);
  });

  it("opens only matching settings groups during search and summarizes current values", () => {
    const groups = settingsGroups(MANAGER_SETTINGS, { highContrast: true }, "contrast");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.open).toBe(true);
    expect(groups[0]?.members.map((setting) => setting.id)).toEqual(["highContrast"]);
    expect(groups[0]?.summary).toContain("High contrast: ON");
    expect(settingsGroups(MANAGER_SETTINGS, {}, "").every((group) => !group.open)).toBe(true);
  });

  it("exports every declared setting with defaults and validates an exact JSON round trip", () => {
    const { host } = testHost();
    const document = importSettings(exportSettings(host), MANAGER_SETTINGS);
    expect(document?.format).toBe("neo-angband/anybandui/manager-settings");
    expect(document?.schemaVersion).toBe(1);
    expect(document?.settings).toEqual(host.settings.get());
    expect(document?.look).toBe("Vanilla");
  });

  it.each([
    (value: Record<string, unknown>) => { value["format"] = "other"; },
    (value: Record<string, unknown>) => { value["schemaVersion"] = 2; },
    (value: Record<string, unknown>) => { value["look"] = "other"; },
    (value: Record<string, unknown>) => { (value["settings"] as Record<string, unknown>)["textSize"] = 85; },
    (value: Record<string, unknown>) => { (value["settings"] as Record<string, unknown>)["theme"] = "missing"; },
    (value: Record<string, unknown>) => { (value["settings"] as Record<string, unknown>)["highContrast"] = "true"; },
    (value: Record<string, unknown>) => { delete (value["settings"] as Record<string, unknown>)["haptics"]; },
    (value: Record<string, unknown>) => { (value["settings"] as Record<string, unknown>)["extra"] = true; },
    (value: Record<string, unknown>) => { value["settings"] = []; },
  ])("rejects invalid settings before any host mutation (%#)", (damage) => {
    const { host } = testHost();
    const document = JSON.parse(exportSettings(host)) as Record<string, unknown>;
    damage(document);
    expect(importSettings(JSON.stringify(document), MANAGER_SETTINGS)).toBeNull();
    expect(host.settings.set).not.toHaveBeenCalled();
  });

  it("rejects malformed and non-object settings JSON", () => {
    for (const text of ["{", "null", "[]", "1"]) expect(importSettings(text, MANAGER_SETTINGS)).toBeNull();
  });

  it("uses the Core look values internally and full names in the view", () => {
    const fixture = testHost();
    expect(lookView(fixture.host).active).toBe("Vanilla");
    fixture.pending();
    expect(lookView(fixture.host)).toMatchObject({ pending: true, active: "Vanilla" });
    expect(lookView(fixture.host).text).toContain("Neo Angband is waiting");
    expect(exportSettings(fixture.host)).not.toMatch(/\bNeo\b(?! Angband)/);
    expect(importSettings(exportSettings(fixture.host), MANAGER_SETTINGS)?.look).toBe("Neo Angband");
  });

  it("shows only the applicable recovery notice, with safe mode taking precedence", () => {
    const { host, recovery } = testHost();
    expect(recoveryView(stateFixture(), host)).toBeNull();
    recovery.read.mockReturnValue({ removed: [{ id: "harm", name: "Harm", version: "1" }], restore: null });
    expect(recoveryView(stateFixture(), host)?.kind).toBe("removed");
    expect(recoveryView({ ...stateFixture(), safeMode: true }, host)?.kind).toBe("safe");
    recovery.read.mockReturnValue({ removed: [], restore: { plan: { id: 4, operation: "restore", downloads: [], newGrants: [] }, unavailable: [] } });
    expect(recoveryView(stateFixture(), host)?.kind).toBe("restore");
  });

  it("uses the phone breakpoint and the documented keyboard map", () => {
    expect([390, 599, 600, 1280].map(isPhone)).toEqual([true, true, false, false]);
    expect(["ArrowUp", "ArrowDown", "Enter", "Escape", "?", "/", " ", "i", "b", "m", "s", "q"].map(keyAction))
      .toEqual(["up", "down", "a", "b", "y", "search", "toggle", "installed", "browse", "lists", "settings", null]);
  });

  it("delays hover by 250 ms, cancels it on leave, and opens a long press only on release", () => {
    vi.useFakeTimers();
    const { host } = testHost();
    const open = vi.fn();
    const timing = createCardTiming(host.clock, open);
    timing.hover(); vi.advanceTimersByTime(249); expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(open).toHaveBeenLastCalledWith(false);
    open.mockClear(); timing.hover(); timing.leave(); vi.advanceTimersByTime(300); expect(open).not.toHaveBeenCalled();
    timing.press(); vi.advanceTimersByTime(449); expect(timing.release()).toBe(false);
    timing.press(); vi.advanceTimersByTime(450); expect(open).not.toHaveBeenCalled();
    expect(timing.release()).toBe(true); expect(open).toHaveBeenLastCalledWith(true);
    timing.press(); timing.cancel(); vi.advanceTimersByTime(450); expect(timing.release()).toBe(false);
  });

  it("validates the preset against the actual manifest numeric declarations", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../manifest.json", import.meta.url), "utf8")) as { settings: { id: string; min: number; max: number; step: number }[] };
    expect(validateNeoAngbandPreset(NEO_ANGBAND_PRESET, manifest.settings)).toBe(true);
    expect(validateNeoAngbandPreset({ look: "Neo", settings: { undeclared: 1 } }, manifest.settings)).toBe(false);
    expect(validateNeoAngbandPreset({ look: "Neo", settings: { "anybandui.crtStrength": 55 } }, manifest.settings)).toBe(false);
  });

  it("exports no user-visible bare Neo string, including generated row descriptions", () => {
    const strings = [...Object.values(ledgerText), ...MANAGER_SETTINGS.flatMap((setting) => [setting.title, setting.group, setting.description, ...(setting.choices?.map((choice) => choice.label) ?? [])]),
      ...managerRows(stateFixture(), initialView).flatMap((row) => [row.name, row.label, row.description])];
    for (const value of strings) expect(value).not.toMatch(/\bNeo\b(?! Angband)/);
    expect(displayText("Neo - presentation")).toBe("Neo Angband - presentation");
  });
});
