import { describe, expect, it } from "vitest";
import type { ViewModel } from "../view-model/protocol.js";
import { renderCharacterCard } from "./character-card.js";
import { renderDungeonCard } from "./dungeon-card.js";
import { driverName, renderDriverBadge, renderStatusBadges } from "./status-badges.js";
import { renderTrackedCreature } from "./tracked-creature.js";
import { lineIsCut, messageKind, refreshLineCues, renderMessageLog } from "./message-log.js";
import { PANEL_CSS } from "./panel-host.js";

class ElementStub {
  children: ElementStub[] = [];
  className = "";
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  value = "";
  type = "";
  placeholder = "";
  disabled = false;
  scrollWidth = 0;
  clientWidth = 0;
  parent: ElementStub | null = null;
  private ownText = "";
  private listeners: Record<string, () => void> = {};
  constructor(readonly ownerDocument: Document, readonly tag: string) {}
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(""); }
  appendChild(child: ElementStub): ElementStub { child.parent = this; this.children.push(child); return child; }
  replaceChildren(): void { this.children = []; this.ownText = ""; }
  remove(): void {
    const parent = this.parent;
    if (!parent) return;
    const index = parent.children.indexOf(this);
    if (index >= 0) parent.children.splice(index, 1);
    this.parent = null;
  }
  querySelector<T>(selector: string): T | null { return (this.walk().find((item) => item.tag === selector) ?? null) as T | null; }
  closest(selector: string): ElementStub | null {
    for (let at: ElementStub | null = this; at; at = at.parent) if (at.className.split(" ").includes(selector.slice(1))) return at;
    return null;
  }
  addEventListener(event: string, listener: () => void): void { this.listeners[event] = listener; }
  setAttribute(): void {}
  fire(event: string): void { this.listeners[event]?.(); }
  walk(): ElementStub[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
}
const doc = { createElement: (tag: string) => new ElementStub(doc as Document, tag) } as unknown as Document;
const mount = (): ElementStub => new ElementStub(doc, "div");
const asHtml = (element: ElementStub): HTMLElement => element as unknown as HTMLElement;

function fixture(): ViewModel {
  const player: ViewModel["player"] = {
    name: "Ari", race: "Human", class: "Mage", title: "Scholar", hp: 30, max_hp: 60, sp: 8, max_sp: 16,
    food: 500, food_max: 1000, experience: 150, max_experience: 150, level_start_experience: 100,
    next_level_experience: 200, level: 5, max_level: 5,
    stats: [{ label: "STR", value: 58, drained: true }, { label: "INT", value: 18, drained: false }],
    gold: 12, armour: 4, speed: 110, extra_moves: 1,
    tracked_creature: { visible: true, name: "Orc", hp: 20, max_hp: 40 },
    depth: 4, depth_feet: 200, light: 2, feeling: "3", feeling_indices: undefined,
    feeling_description: "A quiet floor", floor: "granite", trap_detected: true, recall: false,
    descent: false, resting: false, running: false, repeat: 0, unignoring: false,
    statuses: [{ label: "Poisoned", name: "Poisoned", visible: true, priority: 1, kind: "harm", duration: 4, description: "Losing health" },
      { label: "Hidden", name: undefined, visible: false, priority: 2, kind: "mixed", duration: undefined, description: undefined }], study: 2,
  };
  return { player, dungeon: { depth: 4, depth_feet: 200, light: 2, feeling: "3", feeling_indices: undefined, feeling_description: "A quiet floor", floor: "granite" },
    messages: [{ text: "Orc hits.", count: 3, system: false, category: 1, group: "combat", color: undefined },
      { text: "Found gold.", count: 2, system: false, category: 2, group: "loot", color: undefined }], message_pending: true };
}

describe("Phase 1 panels", () => {
  it("draws character resources, stat formatting, and theme bar colours", () => {
    const root = mount(); renderCharacterCard(asHtml(root), fixture());
    expect(root.textContent).toContain("Ari - Human Mage - Scholar");
    expect(root.textContent).toContain("18/40");
    expect(root.textContent).toContain("50.0% (500)");
    expect(root.walk().filter((e) => e.className === "fill").map((e) => e.style.width)).toEqual(["50%", "50%", "50%", "50%"]);
    expect(root.walk().find((e) => e.style.backgroundColor === "#a82630")).toBeDefined();
    expect(root.walk().find((e) => e.dataset.tip?.includes("Race: Human"))).toBeDefined();
  });
  it("draws dungeon facts and condition lines", () => {
    const root = mount(); renderDungeonCard(asHtml(root), fixture());
    expect(root.textContent).toContain("Depth4Light2Feel3granite");
    expect(root.textContent).toContain("Trap-detected area");
    expect(root.textContent).not.toContain("Resting");
    expect(root.walk().find((e) => e.dataset.tip === "Depth: 200 feet")).toBeDefined();
  });
  it("draws the resting emblem and keeps the word for a screen reader", () => {
    const root = mount();
    const model = fixture();
    model.player = { ...model.player, resting: true };
    renderDungeonCard(asHtml(root), model);
    expect(root.textContent).toContain("Resting");
    expect(root.textContent).toContain("Trap-detected area");
    expect(root.walk().find((e) => e.className === "pause")).toBeDefined();
    expect(root.walk().find((e) => e.className === "sr")?.textContent).toBe("Resting");
  });
  it("filters badges and explains supplied effects", () => {
    const root = mount(); renderStatusBadges(asHtml(root), fixture());
    expect(root.textContent).toContain("PoisonedStudy - 2");
    expect(root.textContent).not.toContain("Hidden");
    expect(root.walk().find((e) => e.style.color === "#ff7559")?.dataset.tip).toContain("Losing health");
  });
  it("names the controller holding input, with its published status", () => {
    const root = mount();
    renderDriverBadge(asHtml(root), { kind: "player" });
    expect(root.children).toEqual([]);
    renderDriverBadge(asHtml(root), { kind: "controller", owner: "borg" });
    expect(root.textContent).toBe("Borg is playing");
    renderDriverBadge(asHtml(root), { kind: "controller", owner: "squire", label: "Selling loot", reason: "Pack is full" });
    expect(root.textContent).toBe("Squire: Selling loot");
    const tip = root.walk().find((e) => e.dataset.tip)?.dataset.tip ?? "";
    expect(tip).toContain("Selling loot");
    expect(tip).toContain("Pack is full");
    renderDriverBadge(asHtml(root), { kind: "controller", owner: "some-mod-id" });
    expect(root.textContent).toBe("Autoplayer is playing");
    expect(driverName("core:demo-wanderer")).toBe("Demo wanderer");
  });
  it("draws tracked health or its absent placeholder", () => {
    const root = mount(); const model = fixture(); renderTrackedCreature(asHtml(root), model);
    expect(root.textContent).toContain("OrcHP 20 / 40");
    expect(root.walk().find((e) => e.className === "fill")?.style.width).toBe("50%");
    model.player.tracked_creature = undefined; renderTrackedCreature(asHtml(root), model);
    expect(root.textContent).toContain("No creature tracked");
  });
  it("shows latest repeats, filters search, and clears the waiting ribbon", () => {
    const root = mount(); const model = fixture(); renderMessageLog(asHtml(root), model);
    expect(root.textContent).toContain("Messages waiting");
    expect(root.walk().find((e) => e.className === "pause")).toBeDefined();
    expect(root.walk().find((e) => e.className === "sr")?.textContent).toBe("Messages waiting");
    expect(root.textContent).toContain("Orc hits. (x3)");
    expect(root.textContent).toContain("Found gold. (x2)");
    expect(root.walk().find((e) => e.style.color === "#c88f5fb4")).toBeDefined();
    const search = root.querySelector<ElementStub>("input")!;
    search.value = "gold"; search.fire("input");
    expect(root.textContent).toContain("Found gold.");
    expect(root.textContent).not.toContain("Orc hits.");
    model.message_pending = false; renderMessageLog(asHtml(root), model);
    expect(root.textContent).not.toContain("Messages waiting");
  });
  it("answers the -more- pause from the ribbon only when it can", () => {
    const root = mount(); const model = fixture();
    renderMessageLog(asHtml(root), model);
    expect(root.walk().find((e) => e.className === "ribbon")?.tag).toBe("div");
    let accepted = true, calls = 0;
    const acknowledge = (): boolean => { calls++; return accepted; };
    renderMessageLog(asHtml(root), model, { acknowledge });
    const ribbon = root.walk().find((e) => e.className === "ribbon")!;
    expect(ribbon.tag).toBe("button");
    expect(ribbon.style.pointerEvents).toBe("auto");
    ribbon.fire("click");
    expect(calls).toBe(1);
    expect(ribbon.disabled).toBe(false);
    accepted = false; ribbon.fire("click");
    expect(ribbon.disabled).toBe(true);
    model.message_pending = false; renderMessageLog(asHtml(root), model, { acknowledge });
    expect(root.walk().some((e) => e.className === "ribbon")).toBe(false);
  });

  it("paints the row from the engine's per-entry color when the host publishes it", () => {
    const root = mount();
    const model = { ...fixture(), message_pending: false,
      messages: [{ text: "You hit it.", count: 1, system: undefined, category: undefined, group: undefined, color: "#c88f5fb4" },
        { text: "Found gold.", count: 1, system: undefined, category: undefined, group: undefined, color: "#b1a962b4" }] };
    renderMessageLog(asHtml(root), model);
    const rows = root.walk().filter((e) => e.className === "message");
    expect(rows[0]?.style.color).toBe("#c88f5fb4");
    expect(rows[1]?.style.color).toBe("#b1a962b4");
  });

  it("uses the ink group when the host publishes no color", () => {
    const root = mount();
    const model = { ...fixture(), message_pending: false,
      messages: [{ text: "Mystery.", count: 1, system: undefined, category: undefined, group: undefined, color: undefined }] };
    renderMessageLog(asHtml(root), model);
    const row = root.walk().find((e) => e.className === "message");
    expect(row?.style.color).toBe("#5b8a71a0");
  });

  it("sorts a line by its system flag, then its group, then its message type", () => {
    expect(messageKind({ system: true, group: "combat", category: 82 })).toBe("system");
    expect(messageKind({ system: false, group: "loot", category: 2 })).toBe("loot");
    expect(messageKind({ system: undefined, group: undefined, category: 2 })).toBe("combat");
    expect(messageKind({ system: undefined, group: undefined, category: 82 })).toBe("loot");
    expect(messageKind({ system: undefined, group: undefined, category: 16 })).toBe("other");
    expect(messageKind({ system: undefined, group: undefined, category: 146 })).toBe("other");
    expect(messageKind({ system: undefined, group: undefined, category: undefined })).toBe("other");
  });

  it("keeps the whole history, filters it, and counts every repeat", () => {
    const root = mount();
    const messages = [
      ...Array.from({ length: 20 }, (_, index) => ({
        text: `Hit ${index}.`, count: index === 1 ? 2 : 1, system: undefined, category: 2, group: undefined, color: undefined,
      })),
      { text: "   ", count: 1, system: undefined, category: 0, group: undefined, color: undefined },
      { text: "Found gold.", count: 4, system: undefined, category: 82, group: undefined, color: undefined },
    ];
    const model = { ...fixture(), message_pending: false, messages };
    renderMessageLog(asHtml(root), model);
    expect(root.walk().filter((e) => e.className === "message")).toHaveLength(21);
    expect(root.textContent).toContain("Hit 1. (x2)");
    expect(root.textContent).toContain("Found gold. (x4)");
    expect(root.walk().find((e) => e.className === "message")?.style.color).toBe("#c88f5fb4");
    const filter = root.walk().find((e) => e.tag === "select")!;
    filter.value = "combat";
    filter.fire("change");
    expect(root.textContent).not.toContain("Found gold.");
    expect(root.walk().filter((e) => e.className === "message")).toHaveLength(20);
    renderMessageLog(asHtml(root), model);
    expect(root.walk().find((e) => e.tag === "select")?.value).toBe("combat");
    expect(root.textContent).not.toContain("Found gold.");
    const search = root.querySelector<ElementStub>("input")!;
    expect(search.tag).toBe("input");
  });

  it("offers no System filter and files a flagged system line under Other", () => {
    const root = mount();
    const messages = [
      { text: "You feel rested.", count: 1, system: true, category: 0, group: undefined, color: undefined },
      { text: "Orc hits.", count: 1, system: undefined, category: 2, group: undefined, color: undefined },
    ];
    renderMessageLog(asHtml(root), { ...fixture(), message_pending: false, messages });
    const filter = root.walk().find((e) => e.tag === "select")!;
    expect(filter.children.map((option) => option.value)).toEqual(["all", "combat", "loot", "other"]);
    filter.value = "other";
    filter.fire("change");
    expect(root.textContent).toContain("You feel rested.");
    expect(root.textContent).not.toContain("Orc hits.");
    expect(root.walk().find((e) => e.className === "message")?.style.color).toBe("#64a0b5b4");
  });

  it("shows a one-line region unfiltered and keeps the choice for when it is tall again", () => {
    const surface = mount();
    const root = surface.appendChild(mount());
    const messages = [
      { text: "Found gold.", count: 1, system: undefined, category: 82, group: undefined, color: undefined },
      { text: "Orc hits.", count: 1, system: undefined, category: 2, group: undefined, color: undefined },
    ];
    const model = { ...fixture(), message_pending: false, messages };
    renderMessageLog(asHtml(root), model);
    const filter = root.walk().find((e) => e.tag === "select")!;
    filter.value = "combat";
    filter.fire("change");
    root.querySelector<ElementStub>("input")!.value = "orc";
    expect(root.textContent).not.toContain("Found gold.");
    surface.className = "surface compact";
    renderMessageLog(asHtml(root), model);
    expect(root.walk().find((e) => e.className === "message")?.textContent).toBe("Found gold.");
    expect(root.walk().find((e) => e.tag === "select")?.value).toBe("combat");
    expect(root.querySelector<ElementStub>("input")?.value).toBe("orc");
    surface.className = "surface";
    renderMessageLog(asHtml(root), model);
    expect(root.textContent).not.toContain("Found gold.");
    expect(root.textContent).toContain("Orc hits.");
  });

  it("draws three dots only when the line is wider than its cell", () => {
    expect(lineIsCut({ scrollWidth: 10, clientWidth: 0 })).toBe(false);
    expect(lineIsCut({ scrollWidth: 40, clientWidth: 40 })).toBe(false);
    expect(lineIsCut({ scrollWidth: 80, clientWidth: 40 })).toBe(true);
    const root = mount();
    renderMessageLog(asHtml(root), { ...fixture(), message_pending: false });
    expect(root.textContent).not.toContain("...");
    const list = root.walk().find((e) => e.className === "messages")!;
    const body = root.walk().find((e) => e.className === "body")!;
    body.scrollWidth = 200;
    body.clientWidth = 40;
    refreshLineCues(asHtml(list));
    expect(root.walk().find((e) => e.className === "cut")?.textContent).toBe("...");
    body.scrollWidth = 10;
    body.clientWidth = 40;
    refreshLineCues(asHtml(list));
    expect(root.walk().some((e) => e.className === "cut")).toBe(false);
  });

  it("holds the pause dots still when reduced motion is requested", () => {
    expect(PANEL_CSS).toContain("prefers-reduced-motion:reduce");
    const saved = globalThis.matchMedia;
    Object.assign(globalThis, { matchMedia: (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)" }) });
    try {
      const root = mount();
      renderMessageLog(asHtml(root), fixture());
      expect(root.walk().find((e) => e.className.split(" ").includes("pause"))?.className).toContain("still");
    } finally {
      Object.assign(globalThis, { matchMedia: saved });
    }
  });
});
