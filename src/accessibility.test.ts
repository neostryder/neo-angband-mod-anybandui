import { afterEach, describe, expect, it, vi } from "vitest";
import { accessibilityFilter, COLORBLIND_FILTER_ID, installAccessibilityAccommodations, uninstallAccessibilityAccommodations } from "./accessibility.js";
import { createPanelHost } from "./panels/panel-host.js";

afterEach(() => uninstallAccessibilityAccommodations());

describe("visual accessibility accommodations", () => {
  it("applies only the high-contrast filter when high contrast alone is selected", () => {
    expect(accessibilityFilter({ "anybandui.highContrast": true })).toBe("contrast(1.55) saturate(1.2)");
  });

  it("applies only the SVG colourblind correction when colourblind alone is selected", () => {
    expect(accessibilityFilter({ "anybandui.colourblind": true })).toBe(`url("#${COLORBLIND_FILTER_ID}")`);
  });

  it("prioritizes the colourblind correction over high contrast when both are selected (#209)", () => {
    expect(accessibilityFilter({ "anybandui.colourblind": true, "anybandui.highContrast": true })).toBe(`url("#${COLORBLIND_FILTER_ID}")`);
  });

  it("keeps the CRT finish after the selected accessibility filter", () => {
    expect(accessibilityFilter({ "anybandui.colourblind": true, "anybandui.highContrast": true, "anybandui.crt": true }))
      .toBe(`url("#${COLORBLIND_FILTER_ID}") contrast(1.08) saturate(1.25) brightness(1.02)`);
  });

  it("uses the scoped display seam and clears it on uninstall", () => {
    const setVisualFilter = vi.fn((_filter: string | null, _options: { scope: "game" }) => {});
    installAccessibilityAccommodations({ flags: { "anybandui.highContrast": true }, display: { setVisualFilter } });
    expect(setVisualFilter).toHaveBeenCalledWith("contrast(1.55) saturate(1.2)", { scope: "game" });
    uninstallAccessibilityAccommodations();
    expect(setVisualFilter).toHaveBeenLastCalledWith(null, { scope: "game" });
  });

  it("filters existing and future AnybandUI panel hosts with the older seam", () => {
    const original = globalThis.HTMLElement;
    class Stub {
      ownerDocument: Document;
      style = { filter: "", setProperty(): void {} };
      constructor(doc: Document) { this.ownerDocument = doc; }
      attachShadow(): ShadowRoot { const root = new Stub(this.ownerDocument) as Stub & { host?: Stub }; root.host = this; return root as unknown as ShadowRoot; }
      appendChild(): void {}
      set className(_value: string) {}
      set textContent(_value: string) {}
      addEventListener(): void {}
    }
    const doc = { createElement: () => new Stub(doc as Document), body: { appendChild(): void {} } } as unknown as Document;
    Object.assign(globalThis, { HTMLElement: Stub });
    try {
      const host = createPanelHost(doc, []);
      const setVisualFilter = vi.fn((_filter: string | null) => {});
      installAccessibilityAccommodations({ flags: { "anybandui.highContrast": true }, display: { setVisualFilter } });
      expect(host.element.style.filter).toBe("contrast(1.55) saturate(1.2)");
      expect(createPanelHost(doc, []).element.style.filter).toBe("contrast(1.55) saturate(1.2)");
      uninstallAccessibilityAccommodations();
      expect(host.element.style.filter).toBe("");
      expect(setVisualFilter).toHaveBeenLastCalledWith(null);
    } finally { Object.assign(globalThis, { HTMLElement: original }); }
  });
  it("passes the scope to an engine that keeps a filter per mod, whatever the setter's arity", () => {
    const setVisualFilter = vi.fn((..._args: unknown[]) => {});
    const getVisualFilter = vi.fn(() => null);
    installAccessibilityAccommodations({ flags: { "anybandui.colourblind": true }, display: { setVisualFilter: (...args: unknown[]) => setVisualFilter(...args), getVisualFilter } });
    expect(setVisualFilter).toHaveBeenCalledWith(expect.stringContaining(COLORBLIND_FILTER_ID), { scope: "game" });
    uninstallAccessibilityAccommodations();
    expect(setVisualFilter).toHaveBeenLastCalledWith(null, { scope: "game" });
  });
});
