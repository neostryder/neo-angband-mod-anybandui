import { describe, expect, it } from "vitest";
import { createSettingsStore, DEFAULT_SETTINGS, themeFromPrefs, validateSettings } from "./settings.js";
import { THEMES } from "./theme.js";

describe("settings store", () => {
  it("validates stored values independently", () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ theme: "unknown", interfaceFont: "not-a-font.ttf", dungeonFont: "missing.ttf",
      showHeadings: "yes" })).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings({ theme: "light-paper", showHeadings: false })).toEqual({
      ...DEFAULT_SETTINGS, theme: "light-paper", showHeadings: false,
    });
  });

  it("persists changes and notifies subscribed listeners once", () => {
    let saved: unknown = null;
    const store = createSettingsStore({ prefs: { get: () => saved, set: (value) => { saved = value; } } });
    const seen: unknown[] = [];
    const unsubscribe = store.subscribe((settings) => seen.push(settings));
    store.set({ theme: "amber-terminal", showHeadings: false });
    store.set({ theme: "amber-terminal" });
    expect(saved).toEqual({ ...DEFAULT_SETTINGS, theme: "amber-terminal", showHeadings: false });
    expect(seen).toEqual([saved]);
    unsubscribe();
    store.set({ theme: "midnight-ice" });
    expect(seen).toHaveLength(1);
  });

  it("keeps encounter memory when changing a theme", () => {
    let saved: unknown = { v: 2, firstEncounter: { characterKey: "hobbit|rogue", monsters: [1], artifacts: [] } };
    const store = createSettingsStore({ prefs: { get: () => saved, set: (value) => { saved = value; } } });
    store.set({ theme: "light-paper" });
    expect(saved).toMatchObject({ firstEncounter: { monsters: [1] }, theme: "light-paper" });
  });

  it("keeps a custom theme and drops one that is not complete", () => {
    const custom = { background: "#112233", surface: "#223344ff", text: "#CCDDEE", accent: "#80b891", rounding: 4, invert_dungeon: true };
    let saved: unknown = null;
    const store = createSettingsStore({ prefs: { get: () => saved, set: (value) => { saved = value; } } });
    store.set({ customTheme: custom });
    expect(store.get().customTheme).toEqual({ background: "#112233ff", surface: "#223344ff", text: "#ccddeeff", accent: "#80b891ff", rounding: 4, invert_dungeon: true });
    expect(validateSettings(saved).customTheme).toEqual(store.get().customTheme);
    expect(themeFromPrefs(saved).background).toBe("#112233ff");
    expect(themeFromPrefs(saved).invert_dungeon).toBe(true);
    expect(themeFromPrefs(saved).light_styling).toBe(false);
    expect(themeFromPrefs(saved).decorations).toBe(THEMES["terminal-original"]!.decorations);
    store.set({ customTheme: null });
    expect(store.get().customTheme).toBeNull();
    expect(validateSettings({ customTheme: { background: "red", rounding: 17 } }).customTheme).toBeNull();
    expect(themeFromPrefs({ theme: "light-paper" }).light_styling).toBe(true);
    expect(themeFromPrefs({ theme: "terminal-original" }).light_styling).toBe(false);
    expect(themeFromPrefs({ theme: "light-paper", customTheme: { background: "#070b0dff", surface: "#111a1dff", text: "#d9e3dbff", accent: "#80b891ff", rounding: 0, invert_dungeon: false } }).light_styling).toBe(false);
  });

  it("shares and bounds the delay for both map and dungeon cards", () => {
    expect(DEFAULT_SETTINGS.hoverDelayMs).toBe(550);
    expect(validateSettings({ hoverDelayMs: 825 }).hoverDelayMs).toBe(825);
    expect(validateSettings({ hoverDelayMs: -20 }).hoverDelayMs).toBe(0);
    expect(validateSettings({ hoverDelayMs: 10000 }).hoverDelayMs).toBe(5000);
  });
});
