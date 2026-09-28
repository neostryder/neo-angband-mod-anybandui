import { describe, expect, it, vi } from "vitest";
import { chromeThemeFor, installChromePaint, mix, PAINT_CSS, paintColours, tint } from "./paint.js";
import { THEMES } from "./theme.js";

const HEX6 = /^#[0-9a-f]{6}$/;

describe("the coat of paint", () => {
  it("mixes and tints the way ui_theme.h does", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#111a1dff", "#d9e3dbff", 0)).toBe("#111a1d");
    expect(tint("#80b891ff", 0.35)).toBe("#80b89159");
  });

  it("asks for a chrome theme the host accepts for every preset", () => {
    for (const theme of Object.values(THEMES)) {
      const chrome = chromeThemeFor(theme);
      for (const key of ["page", "titleBackground", "text", "textStrong", "muted", "border", "divider", "dividerHover", "accent", "floatBorder"] as const) {
        expect(chrome[key]).toMatch(HEX6);
      }
      expect(chrome.font).toBe("Angband 8x13");
      expect(chrome.fontSize).toBe(13);
      expect(chrome.radius).toBeGreaterThanOrEqual(0);
      expect(chrome.radius).toBeLessThanOrEqual(16);
    }
    expect(chromeThemeFor(THEMES["terminal-original"]!).page).toBe("#070b0d");
  });

  it("drops the decorations when a theme turns them off", () => {
    const plain = paintColours({ ...THEMES["terminal-original"]!, decorations: false });
    expect(plain.tick).toBe("#00000000");
    expect(plain.band).toBe("#00000000");
    expect(paintColours(THEMES["terminal-original"]!).tick).not.toBe("#00000000");
  });

  it("keeps rows flat and scopes every rule to the card", () => {
    for (const rule of PAINT_CSS.split("\n")) expect(rule.startsWith(":host")).toBe(true);
    expect(PAINT_CSS).toContain("button:not(.row)");
    expect(PAINT_CSS).not.toMatch(/system-ui|sans-serif/);
  });
});

describe("repainting the window chrome", () => {
  const theme = THEMES["terminal-original"]!;

  it("leaves the chrome alone while no card is on", () => {
    const setChromeTheme = vi.fn();
    installChromePaint({ setChromeTheme }, { "anybandui.crt": true }, theme, () => {})();
    expect(setChromeTheme).not.toHaveBeenCalled();
  });

  it("repaints while a card is on and gives the game its look back on teardown", () => {
    const setChromeTheme = vi.fn();
    const cleanup = installChromePaint({ setChromeTheme }, { "anybandui.sidebar": true }, theme, () => {});
    expect(setChromeTheme).toHaveBeenCalledWith(chromeThemeFor(theme));
    cleanup();
    expect(setChromeTheme).toHaveBeenLastCalledWith(null);
  });

  it("says so once on an engine without the seam, and survives a refusal", () => {
    const log = vi.fn();
    installChromePaint({}, { "anybandui.spells": true }, theme, log);
    expect(log).toHaveBeenCalledTimes(1);
    const refuse = vi.fn(() => { throw new TypeError("bad value"); });
    expect(() => installChromePaint({ setChromeTheme: refuse }, { "anybandui.spells": true }, theme, log)()).not.toThrow();
  });
});
