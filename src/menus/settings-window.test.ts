import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsStore, themeFromPrefs, validateSettings } from "../settings.js";
import { notifyThemeChange } from "../theme.js";
import { installThemeEditor } from "../theme-editor.js";
import { registerOpener } from "./openers.js";
import { cueKindsFor, draftFromSettings, installSettingsWindow, rebaseDraft, settingsPatch, STRENGTH_GROUPS } from "./settings-window.js";
import { installDomGlobals, overlayUi } from "./test-dom.js";

const CUSTOM = { background: "#101010", surface: "#202020", text: "#e0e0e0", accent: "#ff8800", rounding: 4, invert_dungeon: false };

function prefs(initial: Record<string, unknown> = {}) {
  let stored: Record<string, unknown> = { ...initial };
  const set = vi.fn((value: unknown) => { stored = value as Record<string, unknown>; });
  return { get: (): unknown => stored, set, value: (): Record<string, unknown> => stored };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const ON = { "anybandui.settingsWindow": true };

describe("settings window", () => {
  let restore = (): void => {};
  let cleanup = (): void => {};
  beforeEach(() => { restore = installDomGlobals(); });
  afterEach(() => { cleanup(); cleanup = () => {}; restore(); });

  it("installs nothing with its switch off", () => {
    const openPanel = vi.fn();
    cleanup = installSettingsWindow({ flags: {}, log: () => {}, ui: { openPanel }, prefs: prefs() });
    expect(openPanel).not.toHaveBeenCalled();
  });

  it("covers every strength setting in the manifest, with its title, and each maps to stored cue kinds", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../manifest.json", import.meta.url), "utf8")) as { settings: { id: string; title: string }[] };
    const grouped = STRENGTH_GROUPS.flatMap(([, members]) => members);
    expect(grouped.map((s) => s.id).sort()).toEqual(manifest.settings.map((s) => s.id).sort());
    for (const setting of grouped) {
      expect(manifest.settings.find((s) => s.id === setting.id)?.title).toBe(setting.title);
      expect(cueKindsFor(setting.id).length).toBeGreaterThan(0);
    }
  });

  it("writes only what changed, and strengths only when asked", () => {
    const current = validateSettings({ theme: "dark-graphite", customTheme: CUSTOM });
    const draft = draftFromSettings(current);
    expect(settingsPatch(current, draft, true)).toEqual({});
    draft.theme = "amber-terminal";
    draft.keepCustom = false;
    draft.strengths["anybandui.crtStrength"] = 40;
    const patch = settingsPatch(current, draft, false);
    expect(patch).toEqual({ theme: "amber-terminal", customTheme: null });
    const withStrengths = settingsPatch(current, draft, true);
    for (const kind of cueKindsFor("anybandui.crtStrength")) expect(withStrengths.effects?.[kind]).toBe(40);
  });

  it("follows stored changes made elsewhere for every field the player has not touched", () => {
    const base = draftFromSettings(validateSettings({ theme: "dark-graphite", hoverDelayMs: 550 }));
    const draft = { ...base, strengths: { ...base.strengths }, hoverDelayMs: 1000 };
    draft.strengths["anybandui.crtStrength"] = 40;
    const fresh = draftFromSettings(validateSettings({ theme: "amber-terminal", customTheme: CUSTOM, hoverDelayMs: 250, effects: { [cueKindsFor("anybandui.deathStrength")[0]!]: 60 } }));
    const next = rebaseDraft(base, draft, fresh);
    expect(next.theme).toBe("amber-terminal");
    expect(next.keepCustom).toBe(true);
    expect(next.hoverDelayMs).toBe(1000);
    expect(next.strengths["anybandui.crtStrength"]).toBe(40);
    expect(next.strengths["anybandui.deathStrength"]).toBe(60);
    const picked = { ...base, theme: "light-paper" as const, keepCustom: false };
    expect(rebaseDraft(base, picked, fresh)).toMatchObject({ theme: "light-paper", keepCustom: false });
  });

  it("never writes back a theme the theme editor saved while this window was open", () => {
    const { root, ui } = overlayUi();
    const store = prefs({ theme: "dark-graphite" });
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store });
    root.byFocus("page:theme")!.click();
    createSettingsStore({ prefs: store }).set({ theme: "amber-terminal", customTheme: CUSTOM });
    const saved = store.value()["customTheme"];
    notifyThemeChange(themeFromPrefs(store.get()));
    expect(root.byFocus("save")?.disabled).toBe(true);
    expect(root.byFocus("keep-custom")?.checked).toBe(true);
    expect(root.byFocus("theme:amber-terminal")?.attributes["aria-pressed"]).toBe("false");
    root.byFocus("page:interaction")!.click();
    root.byFocus("hover:Patient")!.click();
    root.byFocus("save")!.click();
    expect(root.text()).not.toContain("Saving removes your custom theme colours");
    expect(store.value()["hoverDelayMs"]).toBe(1000);
    expect(store.value()["theme"]).toBe("amber-terminal");
    expect(store.value()["customTheme"]).toEqual(saved);
    expect(saved).not.toBeNull();
  });

  it("moves through pages with the arrows, into a page with Right, and back out with Escape", () => {
    const { root, ui } = overlayUi();
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: prefs() });
    expect(root.text()).toContain("PLAY");
    expect(root.text()).toContain("PRESENTATION");
    root.byFocus("page:interaction")!.focus();
    root.byFocus("page:interaction")!.fire("keydown", "ArrowDown");
    expect(root.focused()).toBe("page:keys");
    expect(root.text()).toContain("Turn on Keybinding editor on the Mods screen to use it here.");
    root.byFocus("page:keys")!.fire("keydown", "ArrowUp");
    root.byFocus("page:interaction")!.fire("keydown", "ArrowRight");
    expect(root.focused()).toBe("hover:Quick");
    root.byFocus("hover:Quick")!.fire("keydown", "Escape");
    expect(root.focused()).toBe("page:interaction");
  });

  it("saves a hover preset without asking, since nothing is lost", () => {
    const { root, ui } = overlayUi();
    const store = prefs({ notebook: { kept: true } });
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store });
    expect(root.byFocus("save")?.disabled).toBe(true);
    root.byFocus("hover:Patient")!.click();
    expect(store.set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    expect(store.value()["hoverDelayMs"]).toBe(1000);
    expect(store.value()["notebook"]).toEqual({ kept: true });
    expect(root.text()).toContain("Saved.");
  });

  it("asks before a theme preset drops a custom theme, and No keeps it", () => {
    const { root, ui } = overlayUi();
    const store = prefs({ theme: "dark-graphite", customTheme: CUSTOM });
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store });
    root.byFocus("page:theme")!.click();
    expect(root.byFocus("keep-custom")?.checked).toBe(true);
    root.byFocus("theme:light-paper")!.click();
    expect(root.byFocus("keep-custom")?.checked).toBe(false);
    root.byFocus("save")!.click();
    expect(root.text()).toContain("Saving removes your custom theme colours. Save anyway?");
    expect(root.focused()).toBe("confirm-no");
    root.byFocus("confirm-no")!.click();
    expect(store.set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(store.value()["theme"]).toBe("light-paper");
    expect(store.value()["customTheme"]).toBeNull();
  });

  it("asks before Cancel or Escape throws changes away", () => {
    const { root, ui } = overlayUi();
    const store = prefs();
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store });
    root.byFocus("hover:Quick")!.click();
    root.byFocus("page:interaction")!.fire("keydown", "Escape");
    expect(root.text()).toContain("Throw away your changes to these settings?");
    root.byFocus("confirm-no")!.click();
    expect(root.byFocus("hover:Quick")?.attributes["aria-pressed"]).toBe("true");
    root.byFocus("cancel")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(root.byFocus("hover:Standard")?.attributes["aria-pressed"]).toBe("true");
    expect(root.text()).toContain("Changes discarded.");
    expect(store.set).not.toHaveBeenCalled();
  });

  it("moves the game's strengths with presets and sliders, and writes them through the game on Save", () => {
    const { root, ui } = overlayUi();
    const values = new Map<string, number>([["anybandui.crtStrength", 40]]);
    const listeners = new Set<() => void>();
    const settings = {
      get: vi.fn((id: string) => values.get(id) ?? 100),
      set: vi.fn((id: string, value: number) => { values.set(id, value); for (const listener of listeners) listener(); return value; }),
      onChange: vi.fn((listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }),
    };
    const store = prefs();
    cleanup = installSettingsWindow({ flags: { ...ON, "anybandui.crt": true }, log: () => {}, ui, prefs: store, settings });
    root.byFocus("page:effects")!.click();
    expect(root.text()).toContain("These are the strengths under this mod on the Mods screen.");
    expect(root.text()).toContain("40%");
    expect(root.text()).toContain("Lava ember strength (effect off)");
    const crt = root.byFocus("strength:anybandui.crtStrength")!;
    crt.value = "70";
    crt.fire("input");
    crt.fire("change");
    expect(settings.set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    expect(settings.set).toHaveBeenCalledTimes(1);
    expect(settings.set).toHaveBeenCalledWith("anybandui.crtStrength", 70);
    expect(store.value()["effects"]).toBeUndefined();
    root.byFocus("strength:Subtle")!.click();
    expect(root.byFocus("strength:anybandui.crtStrength")?.value).toBe("30");
    root.byFocus("save")!.click();
    for (const [id] of STRENGTH_GROUPS.flatMap(([, members]) => members.map((m) => [m.id] as const))) expect(values.get(id)).toBe(30);
    expect(root.byFocus("strength:Subtle")?.attributes["aria-pressed"]).toBe("true");
    expect(root.byFocus("save")?.disabled).toBe(true);
  });

  it("sets every strength from a preset when this mod keeps them", () => {
    const { root, ui } = overlayUi();
    const store = prefs();
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store });
    root.byFocus("page:effects")!.click();
    root.byFocus("strength:Subtle")!.click();
    expect(root.byFocus("strength:anybandui.crtStrength")?.value).toBe("30");
    root.byFocus("save")!.click();
    const effects = store.value()["effects"] as Record<string, number>;
    for (const kind of cueKindsFor("anybandui.deathStrength")) expect(effects[kind]).toBe(30);
  });

  it("opens the other panels from their pages", () => {
    const { root, ui } = overlayUi();
    const opened = vi.fn();
    const stop = registerOpener("keybinding-editor", opened);
    try {
      cleanup = installSettingsWindow({ flags: { ...ON, "anybandui.keybindingEditor": true }, log: () => {}, ui, prefs: prefs() });
      root.byFocus("page:keys")!.click();
      root.byFocus("open:keys")!.click();
      expect(opened).toHaveBeenCalledTimes(1);
    } finally { stop(); }
  });

  it("opens the theme editor's colours from the Theme page", () => {
    const { root, ui } = overlayUi();
    const store = prefs();
    const stopEditor = installThemeEditor({ flags: { "anybandui.themeEditor": true }, log: () => {}, ui, prefs: store });
    try {
      cleanup = installSettingsWindow({ flags: { ...ON, "anybandui.themeEditor": true }, log: () => {}, ui, prefs: store });
      root.byFocus("page:theme")!.click();
      expect(root.byFocus("open:theme-editor")).toBeDefined();
      root.byFocus("open:theme-editor")!.click();
    } finally { stopEditor(); }
    expect(root.byFocus("open:theme-editor")).toBeDefined();
  });
  it("saves at once from the Save game page, and asks before leaving", async () => {
    const { root, ui } = overlayUi();
    const session = { save: vi.fn(() => ({ ok: true }) as const), exitToTitle: vi.fn(async () => ({ ok: true }) as const), quit: vi.fn(async () => ({ ok: true }) as const) };
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: prefs(), session });
    root.byFocus("page:session")!.click();
    root.byFocus("session:save")!.click();
    await flush();
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(root.text()).toContain("Game saved.");
    root.byFocus("session:close")!.click();
    expect(root.text()).toContain("Save this character and return to the main menu?");
    expect(session.exitToTitle).not.toHaveBeenCalled();
    root.byFocus("confirm-no")!.click();
    expect(root.focused()).toBe("session:close");
    root.byFocus("session:quit")!.click();
    expect(root.text()).toContain("Save this character and quit?");
    root.byFocus("confirm-yes")!.click();
    await flush();
    expect(session.quit).toHaveBeenCalledTimes(1);
    expect(root.text()).toContain("Game saved. Quitting.");
  });

  it("shows the game's refusal on the Save game page", async () => {
    const { root, ui } = overlayUi();
    const refused = { ok: false, reason: "No character is in play." } as const;
    const session = { save: vi.fn(() => refused), exitToTitle: vi.fn(async () => refused), quit: vi.fn(async () => refused) };
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: prefs(), session });
    root.byFocus("page:session")!.click();
    root.byFocus("session:close")!.click();
    root.byFocus("confirm-yes")!.click();
    await flush();
    expect(session.exitToTitle).toHaveBeenCalledTimes(1);
    expect(root.text()).toContain("The game was not saved: No character is in play.");
    expect(root.byFocus("session:save")?.disabled).toBe(false);
  });

  it("says when the game offers no session or layout", () => {
    const { root, ui } = overlayUi();
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: prefs() });
    root.byFocus("page:session")!.click();
    expect(root.text()).toContain("This game does not let mods save it.");
    root.byFocus("page:layout")!.click();
    expect(root.text()).toContain("This game cannot save or restore its layout.");
  });

  it("undoes layout changes and keeps layouts by name on the Layout page", () => {
    const { root, ui } = overlayUi();
    let current = "layout A";
    const listeners = new Set<(text: string) => void>();
    const subwindows = {
      layout: () => current,
      setLayout: vi.fn((text: string) => { if (!text.startsWith("layout")) return false; current = text; for (const l of [...listeners]) l(text); return true; }),
      onLayoutChange: (listener: (text: string) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
    const move = (text: string): void => { current = text; for (const l of [...listeners]) l(text); };
    const store = prefs({ savedLayouts: { v: 1, entries: [{ name: "Broken", layout: "junk" }] } });
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store, subwindows });
    root.byFocus("page:layout")!.click();
    expect(root.byFocus("layout:undo")?.disabled).toBe(true);
    move("layout B");
    expect(root.byFocus("layout:undo")?.disabled).toBe(false);
    root.byFocus("layout:undo")!.click();
    expect(current).toBe("layout A");
    expect(root.text()).toContain("Layout change undone.");
    expect(root.byFocus("layout:redo")?.disabled).toBe(false);
    root.byFocus("layout:redo")!.click();
    expect(current).toBe("layout B");
    root.byFocus("layout-saved:Broken")!.click();
    expect(root.text()).toContain("The game could not use the layout saved as Broken.");
    root.byFocus("layout-delete:Broken")!.click();
    expect(root.text()).toContain("Delete the saved layout Broken?");
    root.byFocus("confirm-yes")!.click();
    expect(root.text()).toContain("No saved layouts yet.");
    expect(root.byFocus("layout:save")?.disabled).toBe(true);
    root.byFocus("layout:name")!.enter("Wide");
    root.byFocus("layout:save")!.click();
    expect(root.text()).toContain("Saved the current layout as Wide.");
    move("layout C");
    root.byFocus("layout:name")!.enter("Wide");
    expect(root.byFocus("layout:save")?.textContent).toBe("Replace saved layout");
    root.byFocus("layout-rename-open:Wide")!.click();
    root.byFocus("layout-rename:Wide")!.enter("Tall");
    root.byFocus("layout-apply:Wide")!.click();
    expect(root.text()).toContain("Renamed to Tall.");
    root.byFocus("layout-saved:Tall")!.click();
    expect(current).toBe("layout B");
    expect(root.text()).toContain("Restored Tall.");
    expect(store.value()["savedLayouts"]).toEqual({ v: 1, entries: [{ name: "Tall", layout: "layout B" }] });
  });

  it("keeps a saved layout named like a Layout page button apart from that button", () => {
    const { root, ui } = overlayUi();
    let current = "layout A";
    const subwindows = {
      layout: () => current,
      setLayout: vi.fn((text: string) => { current = text; return true; }),
      onLayoutChange: () => () => {},
    };
    const store = prefs({ savedLayouts: { v: 1, entries: [{ name: "undo", layout: "layout B" }] } });
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, ui, prefs: store, subwindows });
    root.byFocus("page:layout")!.click();
    expect(root.byFocus("layout:undo")?.textContent).toBe("Undo");
    root.byFocus("layout-saved:undo")!.click();
    expect(current).toBe("layout B");
    expect(root.text()).toContain("Restored undo.");
  });

  it("stops watching the layout when the window cannot open", () => {
    const listeners = new Set<(text: string) => void>();
    const subwindows = {
      layout: () => "layout A",
      setLayout: () => true,
      onLayoutChange: (listener: (text: string) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
    cleanup = installSettingsWindow({ flags: ON, log: () => {}, prefs: prefs(), subwindows });
    expect(listeners.size).toBe(0);
  });
});
