import { expect, it } from "vitest";
import type { HudFrame, HudSection } from "@rpgm-tools/neo-angband-mod-sdk";
import type { ViewModel } from "../view-model/protocol.js";
import { THEMES } from "../theme.js";
import { createPanelHost } from "./panel-host.js";

it("places a shadow panel, skips unchanged data, and hides under later overlapping regions", () => {
  const originalElement = globalThis.HTMLElement;
  class Stub {
    ownerDocument: Document;
    properties: Record<string, string> = {};
    style = { display: "", left: "", top: "", width: "", height: "", setProperty: (key: string, value: string): void => { this.properties[key] = value; } };
    children: Stub[] = [];
    host?: Stub;
    shadow?: Stub;
    constructor(doc: Document) { this.ownerDocument = doc; }
    attachShadow(): ShadowRoot { const root = new Stub(this.ownerDocument); root.host = this; this.shadow = root; return root as unknown as ShadowRoot; }
    appendChild(child: Stub): Stub { this.children.push(child); return child; }
    className = "";
    set textContent(_value: string) {}
    addEventListener(): void {}
  }
  const doc = { createElement: () => new Stub(doc as Document), body: undefined as unknown as Stub } as unknown as Document;
  (doc as unknown as { body: Stub }).body = new Stub(doc);
  Object.assign(globalThis, { HTMLElement: Stub });
  try {
    let renders = 0;
    const host = createPanelHost(doc, [{ key: "test", select: (m) => m.player.hp, render: () => { renders++; } }]);
    const section = { region: { name: "sidebar", pixels: { x: 11, y: 13, width: 90, height: 120 }, cells: { col: 0, row: 0, cols: 10, rows: 10 } } } as HudSection;
    const base = { id: "sidebar", cells: section.region!.cells };
    const model = { player: { hp: 5 } } as ViewModel;
    host.present(section, { stack: [base] } as unknown as HudFrame, model);
    host.present(section, { stack: [base] } as unknown as HudFrame, model);
    expect(renders).toBe(1);
    expect(host.element.style.left).toBe("11px");
    expect(host.element.style.height).toBe("120px");
    expect((host.element as unknown as Stub).properties["--anyband-surface"]).toBe(THEMES["terminal-original"]!.surface);
    const surface = (host.element as unknown as Stub).shadow!.children.find((child) => child.className.startsWith("surface"))!;
    expect(surface.className).toBe("surface");
    const line = { region: { name: "status", pixels: { x: 0, y: 200, width: 400, height: 20 }, cells: { col: 0, row: 23, cols: 80, rows: 1 } } } as HudSection;
    host.present(line, { stack: [{ id: "status", cells: line.region!.cells }] } as unknown as HudFrame, model);
    expect(surface.className).toBe("surface compact");
    host.present(section, { stack: [base] } as unknown as HudFrame, model);
    expect(surface.className).toBe("surface");
    host.present(section, { stack: [base, { id: "modal", cells: { col: 5, row: 5, cols: 4, rows: 4 } }] } as unknown as HudFrame, model);
    expect(host.element.style.display).toBe("none");
  } finally {
    Object.assign(globalThis, { HTMLElement: originalElement });
  }
});
