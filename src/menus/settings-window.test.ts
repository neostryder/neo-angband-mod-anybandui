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
    const manifest = JSON.parse(readFileSync(new URL("../../manifest.json", import.meta.url), "utf8")).data as { settings: { id: string; title: string }[] };
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

  it("shows the game's strengths read only when the game owns them", () => {
    const { root, ui } = overlayUi();
    const get = vi.fn((id: string) => (id === "anybandui.crtStrength" ? 40 : 100));
    cleanup = installSettingsWindow({ flags: { ...ON, "anybandui.crt": true }, log: () => {}, ui, prefs: prefs(), settings: { get } as never });
    root.byFocus("page:effects")!.click();
    expect(root.text()).toContain("The game keeps these on its Mods screen");
    expect(root.text()).toContain("40%");
    expect(root.text()).toContain("Lava ember strength (effect off)");
    expect(root.byFocus("strength:Subtle")).toBeUndefined();
    expect(root.byFocus("strength:anybandui.crtStrength")).toBeUndefined();
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
});
