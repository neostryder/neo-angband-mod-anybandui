import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paintColours } from "./paint.js";
import { themeFromPrefs, validateSettings } from "./settings.js";
import { PACK_CHOICES, resolveTheme, setThemePacks, THEME_CHOICES, themeChoices, THEMES } from "./theme.js";
import { draftFromTheme, renderThemeEditor } from "./theme-editor.js";
import { installSettingsWindow } from "./menus/settings-window.js";
import { installDomGlobals, overlayUi } from "./menus/test-dom.js";
import { FakeNode } from "./menus/fake-dom.js";

afterEach(() => setThemePacks(false));

describe("theme packs", () => {
  it("offers the pack presets only with the switch on", () => {
    expect(themeChoices()).toEqual(THEME_CHOICES);
    setThemePacks(true);
    expect(themeChoices().map(([id]) => id)).toEqual([...THEME_CHOICES.map(([id]) => id), "linoleum", "plain-terminal"]);
    expect(PACK_CHOICES.map(([, label]) => label)).toEqual(["Linoleum", "Plain terminal"]);
  });

  it("keeps a saved pack theme, and draws it only while the packs are on", () => {
    expect(validateSettings({ theme: "plain-terminal" }).theme).toBe("plain-terminal");
    expect(themeFromPrefs({ theme: "plain-terminal" })).toEqual(THEMES["terminal-original"]);
    setThemePacks(true);
    expect(themeFromPrefs({ theme: "plain-terminal" })).toEqual(THEMES["plain-terminal"]);
    expect(resolveTheme("linoleum", null)).toEqual(THEMES["linoleum"]);
  });

  it("draws the plain terminal theme without decorations or rounding, even with custom colours", () => {
    setThemePacks(true);
    const plain = resolveTheme("plain-terminal", { background: "#101010ff", surface: "#000000ff", text: "#ffffffff", accent: "#808080ff", rounding: 0, invert_dungeon: false });
    expect(plain.decorations).toBe(false);
    expect(plain.rounding).toBe(0);
    const colours = paintColours(plain);
    expect([colours.tick, colours.wash, colours.band]).toEqual(["#00000000", "#00000000", "#00000000"]);
    expect(THEMES["linoleum"]!.decorations).toBe(true);
  });

  it("puts the pack presets in the theme editor", () => {
    const parent = new FakeNode();
    const draft = draftFromTheme(THEMES["terminal-original"]!, "terminal-original");
    const draw = (): void => { parent.replaceChildren(); renderThemeEditor(parent as unknown as HTMLElement, draft, "", () => {}, draw, () => {}, () => {}); };
    draw();
    expect(parent.byText("Plain terminal")).toBeUndefined();
    setThemePacks(true);
    draw();
    parent.byText("Plain terminal")!.click();
    expect(draft).toMatchObject({ preset: "plain-terminal", background: "#000000ff", text: "#c0c0c0ff", rounding: 0 });
    expect(parent.byText("Plain terminal")!.attributes["aria-pressed"]).toBe("true");
  });
});

describe("theme packs in the settings window", () => {
  let restore = (): void => {};
  let cleanup = (): void => {};
  beforeEach(() => { restore = installDomGlobals(); });
  afterEach(() => { cleanup(); cleanup = () => {}; restore(); });

  it("saves a pack preset from the Theme page", () => {
    setThemePacks(true);
    const { root, ui } = overlayUi();
    let stored: Record<string, unknown> = {};
    const prefs = { get: (): unknown => stored, set: vi.fn((value: unknown) => { stored = value as Record<string, unknown>; }) };
    cleanup = installSettingsWindow({ flags: { "anybandui.settingsWindow": true }, log: () => {}, ui, prefs });
    root.byFocus("page:theme")!.click();
    root.byFocus("theme:linoleum")!.click();
    root.byFocus("save")!.click();
    expect(stored["theme"]).toBe("linoleum");
  });
});
