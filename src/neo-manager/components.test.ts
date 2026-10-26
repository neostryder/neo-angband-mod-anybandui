import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeNode } from "../menus/test-dom.js";
import { loadFonts } from "../fonts.js";
import { mountNeoManager } from "./components.js";
import { exportSettings, ledgerText } from "./model.js";
import { LEDGER_FONTS, ledgerStyles } from "./styles.js";
import { stateFixture, testHost } from "./test-host.js";
import type { Api2Result } from "./types.js";

const flush = async (): Promise<void> => { for (let index = 0; index < 30; index += 1) await Promise.resolve(); };
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function setup(tab: "installed" | "browse" | "lists" | "settings" = "installed") {
  const fixture = testHost();
  const target = new FakeNode("target");
  const handle = mountNeoManager(fixture.host, target as unknown as HTMLElement);
  cleanups.push(handle.dispose);
  handle.open(tab);
  await flush();
  const root = target.children[0]!;
  return { ...fixture, target, root, handle };
}

describe("Ledger components", () => {
  it("renders real state as lettered list rows, switches, and matching accessible cards", async () => {
    const { root } = await setup();
    const name = root.byFocus("mod:squire")!;
    expect(name.attributes["aria-label"]).toBe("b) Squire");
    const description = root.walk().find((node) => node.id === name.attributes["aria-describedby"])!;
    expect(description.textContent).toContain("squire description");
    expect(description.parent?.attributes["role"]).toBe("tooltip");
    expect(description.parent?.hidden).toBe(true);
    root.byFocus("mod:squire-help")!.click();
    expect(description.parent?.hidden).toBe(false);
    expect(root.byFocus("toggle:squire")!.attributes).toMatchObject({ role: "switch", "aria-checked": "true" });
    const line = name.parent!;
    expect(line.text()).not.toContain("First-party");
    expect(line.text()).not.toContain("store:kv");
  });

  it("expands a row in place and collapses it on a second click", async () => {
    const { root } = await setup();
    root.byFocus("mod:squire")!.click();
    expect(root.byFocus("mod:squire")!.attributes["aria-expanded"]).toBe("true");
    expect(root.byFocus("remove:squire")!.closest("div")?.parent?.parent?.attributes["role"]).toBe("listitem");
    root.byFocus("mod:borg")!.click();
    expect(root.byFocus("remove:squire")).toBeUndefined();
    expect(root.byFocus("remove:borg")).toBeDefined();
    root.byFocus("mod:borg")!.click();
    expect(root.byFocus("remove:borg")).toBeUndefined();
  });

  it("routes switches through management and shows returned refusal text", async () => {
    const { root, mods, fail } = await setup();
    mods.disable.mockImplementationOnce(() => fail("Neo cannot change this"));
    root.byFocus("toggle:squire")!.click();
    await flush();
    expect(mods.disable).toHaveBeenCalledWith("squire");
    expect(root.text()).toContain("Neo Angband cannot change this");
  });

  it.each(["remove", "rollback"] as const)("routes the expanded %s action through Core", async (operation) => {
    const { root, mods } = await setup();
    root.byFocus("mod:squire")!.click(); root.byFocus(`${operation}:squire`)!.click(); await flush();
    expect(mods[operation]).toHaveBeenCalledWith("squire");
  });

  it("routes bulk updates, enablement, and the current mod list through Core", async () => {
    const { root, mods, handle, state } = await setup();
    root.byFocus("update-all")!.click(); await flush(); expect(mods.updateAll).toHaveBeenCalledTimes(1);
    root.byFocus("toggle:borg")!.click(); await flush(); expect(mods.enable).toHaveBeenCalledWith("borg");
    handle.open("lists"); await flush(); root.byFocus("restore-list")!.click(); await flush();
    expect(mods.restoreModList).toHaveBeenCalledWith(state().modList.map(({ id, enabled }) => ({ id, enabled })), true);
  });

  it("marks update rows for Update or Review according to permission previews", async () => {
    const { root, mods } = await setup();
    root.byFocus("review-updates")!.click();
    expect(root.byFocus("apply-update:anybandui")!.textContent).toBe("Update");
    expect(root.byFocus("apply-update:squire")!.textContent).toBe("Review");
    root.byFocus("apply-update:squire")!.click(); await flush();
    expect(mods.update).toHaveBeenCalledWith("squire");
  });

  it("shows Core confirmation pending and never exposes a resolver", async () => {
    const { root, publish, state, mods } = await setup();
    publish({ ...state(), revision: 2, pendingConfirmation: { id: 9, operation: "enable", mods: [], permissions: [], riskNotice: [] } });
    expect(root.text()).toContain(ledgerText.pending);
    expect(root.byFocus("toggle:squire")!.disabled).toBe(true);
    expect(root.walk().some((node) => node.tag === "na-consent-dialog")).toBe(false);
    root.byFocus("toggle:squire")!.click();
    expect(mods.disable).not.toHaveBeenCalled();
  });

  it("round trips consent decisions with required items locked and traps focus", async () => {
    const { root, mods, target } = await setup();
    root.byFocus("mod:squire")!.click();
    root.byFocus("permissions:squire")!.click();
    const dialog = root.walk().find((node) => node.tag === "na-consent-dialog")!;
    expect(dialog.attributes).toMatchObject({ role: "dialog", "aria-modal": "true" });
    expect(root.byFocus("consent:state:map.read")!.disabled).toBe(true);
    const optional = root.byFocus("consent:store:kv")!;
    optional.checked = false; optional.fire("change");
    root.byFocus("consent-cancel")!.focus();
    root.byFocus("consent-cancel")!.fire("keydown", "Tab");
    expect(target.focused()).toBe("consent:state:map.read-help");
    root.byFocus("consent-allow")!.click(); await flush();
    expect(mods.recordConsent).toHaveBeenCalledWith("squire", { granted: ["state:map.read"], refused: ["store:kv"] });
    expect(root.walk().some((node) => node.tag === "na-consent-dialog")).toBe(false);
  });

  it("returns focus to the permissions button when consent is canceled", async () => {
    const { root, target } = await setup();
    root.byFocus("mod:squire")!.click(); root.byFocus("permissions:squire")!.click();
    root.byFocus("consent-cancel")!.fire("keydown", "Escape");
    expect(target.focused()).toBe("permissions:squire");
  });

  it("opens matching settings groups and keeps search focus and its caret", async () => {
    const { root, target } = await setup("settings");
    expect(root.byFocus("group:Display")!.parent!.open).toBe(false);
    root.byFocus("search")!.focus();
    root.byFocus("search")!.enter("contrast");
    expect(root.byFocus("group:Display")!.parent!.open).toBe(true);
    expect(root.byFocus("setting:theme:system")).toBeUndefined();
    expect(target.focused()).toBe("search");
    expect(root.byFocus("search")!.selectionStart).toBe(8);
    root.byFocus("search")!.enter("Neo Angband");
    expect(root.byFocus("group:look")!.parent!.open).toBe(true);
    root.byFocus("search")!.enter("JSON");
    expect(root.byFocus("group:backup")!.parent!.open).toBe(true);
  });

  it("exports and imports settings JSON through the injected accessor", async () => {
    const { root, host, settings } = await setup("settings");
    root.byFocus("group:backup")!.click(); root.byFocus("export")!.click();
    const exported = root.byFocus("backup-json")!.value;
    expect(exported).toBe(exportSettings(host));
    const document = JSON.parse(exported) as { settings: { highContrast: boolean } };
    document.settings.highContrast = true;
    root.byFocus("backup-json")!.enter(JSON.stringify(document)); root.byFocus("import")!.click(); await flush();
    expect(settings.get()["highContrast"]).toBe(true);
    expect(root.dataset["contrast"]).toBe("high");
    expect(root.text()).toContain(ledgerText.saved);
  });

  it("rejects invalid JSON without writing settings", async () => {
    const { root, settings } = await setup("settings");
    root.byFocus("backup-json")!.enter("{bad"); root.byFocus("import")!.click(); await flush();
    expect(settings.set).not.toHaveBeenCalled();
    expect(root.text()).toContain(ledgerText.invalidSettings);
  });

  it("reads an imported JSON file without applying it until Import", async () => {
    const { root, host, settings } = await setup("settings");
    const file = root.byFocus("import-file")!;
    Object.assign(file, { files: [{ text: async () => exportSettings(host) }] });
    file.fire("change"); await flush();
    expect(root.byFocus("backup-json")!.value).toBe(exportSettings(host));
    expect(settings.set).not.toHaveBeenCalled();
    root.byFocus("import")!.click(); await flush(); expect(settings.set).toHaveBeenCalledTimes(1);
  });

  it("uses segments, range, select, and switch controls from setting definitions", async () => {
    const { root, settings } = await setup("settings");
    root.byFocus("setting:theme:dark")!.click(); await flush();
    expect(settings.get()["theme"]).toBe("dark");
    expect(root.byFocus("setting:theme:dark")!.attributes["aria-pressed"]).toBe("true");
    const range = root.byFocus("setting:textSize")!; range.value = "120"; range.fire("change"); await flush();
    expect(settings.get()["textSize"]).toBe(120);
    const select = root.byFocus("setting:colorblind")!; select.value = "red-green"; select.fire("change"); await flush();
    expect(root.dataset["colorblind"]).toBe("red-green");
    root.byFocus("setting:highContrast")!.click(); await flush(); expect(root.dataset["contrast"]).toBe("high");
  });

  it("uses keyboard arrows, tab letters, search, details, and gamepad actions", async () => {
    const { root, target, handle } = await setup();
    root.byFocus("tab:installed")!.fire("keydown", "ArrowDown");
    expect(target.focused()).toBe("mod:anybandui");
    handle.handleGamepad("down"); expect(target.focused()).toBe("mod:squire");
    expect(root.byFocus("mod:squire")!.tabIndex).toBe(0);
    expect(root.byFocus("mod:anybandui")!.tabIndex).toBe(-1);
    handle.handleGamepad("a"); expect(root.byFocus("remove:squire")).toBeDefined();
    handle.handleGamepad("y");
    const description = root.walk().find((node) => node.id === root.byFocus("mod:squire")!.attributes["aria-describedby"])!;
    expect(description.parent!.hidden).toBe(false);
    handle.handleGamepad("b"); expect(description.parent!.hidden).toBe(true);
    root.byFocus("mod:squire")!.fire("keydown", "/"); expect(target.focused()).toBe("search");
    root.byFocus("mod:squire")!.fire("keydown", "s"); await flush();
    expect(root.byFocus("setting:highContrast")).toBeDefined();
    handle.handleGamepad("right"); await flush(); expect(root.byFocus("mod:squire")).toBeDefined();
  });

  it("does not steal tab shortcut letters from a search field", async () => {
    const { root } = await setup();
    root.byFocus("search")!.fire("keydown", "s");
    expect(root.byFocus("mod:squire")).toBeDefined();
    expect(root.byFocus("setting:highContrast")).toBeUndefined();
  });

  it("leaves Space on a switch to the button and opens its row card with help", async () => {
    const { root, mods } = await setup();
    const toggle = root.byFocus("toggle:borg")!;
    toggle.focus();
    expect(toggle.fire("keydown", " ").defaultPrevented).toBe(false);
    expect(mods.disable).not.toHaveBeenCalled();
    toggle.fire("keydown", "?");
    const description = root.walk().find((node) => node.id === toggle.attributes["aria-describedby"])!;
    expect(description.parent!.hidden).toBe(false);
  });

  it("links setting controls to their help text and opens it with gamepad Y", async () => {
    const { root, handle } = await setup("settings");
    root.byFocus("group:Display")!.click();
    const control = root.byFocus("setting:highContrast")!;
    control.focus(); handle.handleGamepad("y");
    const description = root.walk().find((node) => node.id === control.attributes["aria-describedby"])!;
    expect(description.parent!.hidden).toBe(false);
    expect(description.textContent).toBe("Uses white borders and brighter text on black.");
  });

  it("cancels a long press when the finger moves to scroll", async () => {
    vi.useFakeTimers();
    const { root, host } = await setup();
    const name = root.byFocus("mod:squire")!;
    name.fire("pointerdown", "", false, { pointerType: "touch", clientX: 20, clientY: 20 });
    name.fire("pointermove", "", false, { pointerType: "touch", clientX: 20, clientY: 50 });
    vi.advanceTimersByTime(500);
    name.fire("pointerup", "", false, { pointerType: "touch" });
    const description = root.walk().find((node) => node.id === name.attributes["aria-describedby"])!;
    expect(description.parent!.hidden).toBe(true);
    expect(host.haptics.tick).not.toHaveBeenCalled();
  });

  it("opens long-press cards only on release, suppresses the click, and sends one haptic tick", async () => {
    vi.useFakeTimers();
    const { root, host, settings } = await setup();
    await settings.set({ ...settings.get(), haptics: true });
    const name = root.byFocus("mod:squire")!;
    name.fire("pointerdown", "", false, { pointerType: "touch" }); vi.advanceTimersByTime(450);
    const description = root.walk().find((node) => node.id === name.attributes["aria-describedby"])!;
    expect(description.parent!.hidden).toBe(true);
    name.fire("pointerup", "", false, { pointerType: "touch" }); name.click();
    expect(description.parent!.hidden).toBe(false);
    expect(description.parent!.children[1]!.hidden).toBe(false);
    expect(root.byFocus("remove:squire")).toBeUndefined();
    expect(host.haptics.tick).toHaveBeenCalledTimes(1);
    description.parent!.children[1]!.children[0]!.click();
    expect(root.byFocus("remove:squire")).toBeDefined();
  });

  it("delays hover and keeps the card open while the pointer moves onto it", async () => {
    vi.useFakeTimers();
    const { root } = await setup();
    const name = root.byFocus("mod:squire")!;
    const description = root.walk().find((node) => node.id === name.attributes["aria-describedby"])!;
    name.fire("pointerenter"); vi.advanceTimersByTime(249); expect(description.parent!.hidden).toBe(true);
    vi.advanceTimersByTime(1); expect(description.parent!.hidden).toBe(false);
    name.parent!.parent!.fire("pointerleave"); description.parent!.fire("pointerenter");
    vi.advanceTimersByTime(100); expect(description.parent!.hidden).toBe(false);
    root.fire("pointerdown"); expect(description.parent!.hidden).toBe(true);
  });

  it("honors high contrast and reduced motion through data and CSS", async () => {
    const { root, settings, host } = await setup();
    vi.mocked(host.prefersReducedMotion).mockReturnValue(true);
    await settings.set({ ...settings.get(), highContrast: true });
    expect(root.dataset).toMatchObject({ contrast: "high", motion: "reduce" });
    expect(ledgerStyles).toContain("outline:2px solid var(--ledger-focus)");
    expect(ledgerStyles).toContain("@container (width < 600px)");
    expect(ledgerStyles).toContain("min-height:44px");
    expect(ledgerStyles).toContain("prefers-reduced-motion:reduce");
  });

  it("plans a browse installation then hands the plan to Core", async () => {
    const { root, mods } = await setup("browse");
    root.byFocus("install:compass")!.click(); await flush();
    expect(mods.planInstall).toHaveBeenCalledWith([{ repo: "team/compass", tag: "v1.0.0" }]);
    expect(mods.applyPlan).toHaveBeenCalledWith(7);
  });

  it("keeps a failed browse plan from reaching applyPlan", async () => {
    const { root, mods, fail } = await setup("browse");
    mods.planInstall.mockImplementationOnce(() => fail("The download is unavailable."));
    root.byFocus("install:compass")!.click(); await flush();
    expect(mods.applyPlan).not.toHaveBeenCalled();
    expect(root.text()).toContain("The download is unavailable.");
  });

  it("requests the Ledger faces through the existing font loader and keeps fallback on a missing asset", async () => {
    const add = vi.fn();
    vi.stubGlobal("document", { fonts: { add } });
    vi.stubGlobal("FontFace", class {
      constructor(readonly family: string, readonly source: string) {}
      async load() { return this; }
    });
    const assetUrl = vi.fn(async (path: string) => path.endsWith(LEDGER_FONTS[0]) ? "/own/mono.ttf" : null);
    expect(await loadFonts({ assetUrl }, LEDGER_FONTS)).toEqual([LEDGER_FONTS[0]]);
    expect(assetUrl.mock.calls.map(([path]) => path)).toEqual(LEDGER_FONTS.map((file) => `fonts/${file}`));
    expect(add).toHaveBeenCalledTimes(1);
    expect(ledgerStyles).toContain('"IBM Plex Mono",monospace');
    expect(ledgerStyles).toContain('"IM Fell English SC",serif');
  });

  it("shows the look picker and offline pending text without a bare Neo label", async () => {
    const { root, host, pending } = await setup();
    pending(); root.byFocus("look")!.click();
    expect(root.text()).toContain(ledgerText.lookPending);
    root.byFocus("look-neo-angband")!.click(); await flush();
    expect(host.look.choose).toHaveBeenCalledWith("Neo");
    const visibleText = root.walk().filter((node) => node.tag !== "style").map((node) => node.textContent).join(" ");
    expect(visibleText).not.toMatch(/\bNeo\b(?! Angband)/);
  });

  it("moves between look choices with keyboard and gamepad before selecting", async () => {
    const { root, handle, target, host } = await setup();
    root.byFocus("look")!.click();
    handle.handleGamepad("right"); expect(target.focused()).toBe("look-neo-angband");
    handle.handleGamepad("left"); expect(target.focused()).toBe("look-vanilla");
    root.byFocus("look-vanilla")!.fire("keydown", "ArrowRight");
    expect(target.focused()).toBe("look-neo-angband");
    handle.handleGamepad("a"); await flush();
    expect(host.look.choose).toHaveBeenCalledWith("Neo");
  });

  it("wires safe mode, restore, and removed-for-harm notices through the recovery seam", async () => {
    const { root, state, publish, recovery } = await setup();
    publish({ ...state(), revision: 2, safeMode: true });
    root.byFocus("notice-continue")!.click(); await flush(); expect(recovery.startWithModsOff).toHaveBeenCalledTimes(1);
    recovery.read.mockReturnValue({ removed: [{ id: "harm", name: "Compass", version: "1" }], restore: null });
    publish({ ...state(), revision: 3, safeMode: false });
    expect(root.text()).toContain("Removed for harm");
    root.byFocus("notice-continue")!.click(); await flush(); expect(recovery.continue).toHaveBeenCalledTimes(1);
    recovery.read.mockReturnValue({ removed: [], restore: { plan: { id: 33, operation: "restore", downloads: [], newGrants: [] }, unavailable: [] } });
    publish({ ...state(), revision: 4 }); root.byFocus("restore")!.click(); await flush();
    expect(recovery.restore).toHaveBeenCalledWith(33);
  });

  it("shows available and unavailable restore entries before passing the plan to Core", async () => {
    const { root, state, publish, recovery } = await setup();
    const entry = state().catalog.curated[0]!;
    if (!entry.ok) throw new Error("The fixture needs a catalog mod.");
    recovery.read.mockReturnValue({ removed: [], restore: {
      plan: { id: 33, operation: "restore", downloads: [{ mod: entry.mod, bytes: 120 }], newGrants: [] },
      unavailable: [{ name: "Missing", version: "2" }],
    } });
    publish({ ...state(), revision: 2 });
    expect(root.text()).toContain("Compass v1.0.0: Ready");
    expect(root.text()).toContain("Missing v2: Unavailable");
    expect(root.byFocus("restore")!.textContent).toBe("Restore my mods (1)");
    root.byFocus("restore")!.click(); await flush(); expect(recovery.restore).toHaveBeenCalledWith(33);
  });

  it("ignores older state revisions and cleans up subscriptions on dispose", async () => {
    const { root, publish, mods, handle, target } = await setup();
    publish({ ...stateFixture(), revision: 3, installed: [] });
    publish({ ...stateFixture(), revision: 2 });
    expect(root.byFocus("mod:squire")).toBeUndefined();
    handle.dispose(); await flush();
    expect(mods.unsubscribe).toHaveBeenCalledWith({ id: "sub-1" });
    expect(target.children).toHaveLength(0);
  });

  it("unsubscribes when an asynchronous registration finishes after disposal", async () => {
    const fixture = testHost();
    let finish!: (value: Api2Result<{ readonly id: string }>) => void;
    fixture.mods.subscribe.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const target = new FakeNode();
    const handle = mountNeoManager(fixture.host, target as unknown as HTMLElement);
    handle.dispose(); finish({ ok: true, value: { id: "late" } }); await flush();
    expect(fixture.mods.unsubscribe).toHaveBeenCalledWith({ id: "late" });
    expect(target.children).toHaveLength(0);
  });
});
