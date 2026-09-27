import { describe, expect, it } from "vitest";
import { createSettingsStore, DEFAULT_SETTINGS, validateSettings } from "./settings.js";

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

  it("shares and bounds the delay for both map and dungeon cards", () => {
    expect(DEFAULT_SETTINGS.hoverDelayMs).toBe(550);
    expect(validateSettings({ hoverDelayMs: 825 }).hoverDelayMs).toBe(825);
    expect(validateSettings({ hoverDelayMs: -20 }).hoverDelayMs).toBe(0);
    expect(validateSettings({ hoverDelayMs: 10000 }).hoverDelayMs).toBe(5000);
  });
});
