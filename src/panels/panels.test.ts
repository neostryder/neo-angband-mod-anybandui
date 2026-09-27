import { describe, expect, it } from "vitest";
import type { ViewModel } from "../view-model/protocol.js";
import { renderCharacterCard } from "./character-card.js";
import { renderDungeonCard } from "./dungeon-card.js";
import { renderStatusBadges } from "./status-badges.js";
import { renderTrackedCreature } from "./tracked-creature.js";
import { renderMessageLog } from "./message-log.js";

class ElementStub {
  children: ElementStub[] = [];
  className = "";
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  value = "";
  type = "";
  placeholder = "";
  private ownText = "";
  private listeners: Record<string, () => void> = {};
  constructor(readonly ownerDocument: Document, readonly tag: string) {}
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(""); }
  appendChild(child: ElementStub): ElementStub { this.children.push(child); return child; }
  replaceChildren(): void { this.children = []; this.ownText = ""; }
  querySelector<T>(selector: string): T | null { return (this.walk().find((item) => item.tag === selector) ?? null) as T | null; }
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
    messages: [{ text: "Orc hits.", count: 3, system: false, category: 1, group: "combat" },
      { text: "Found gold.", count: 2, system: false, category: 2, group: "loot" }], message_pending: true };
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
    expect(root.walk().find((e) => e.dataset.tip === "Depth: 200 feet")).toBeDefined();
  });
  it("filters badges and explains supplied effects", () => {
    const root = mount(); renderStatusBadges(asHtml(root), fixture());
    expect(root.textContent).toContain("PoisonedStudy - 2");
    expect(root.textContent).not.toContain("Hidden");
    expect(root.walk().find((e) => e.style.color === "#ff7559")?.dataset.tip).toContain("Losing health");
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
    expect(root.textContent).toContain("Orc hits. (x3)");
    expect(root.textContent).not.toContain("(x2)");
    expect(root.walk().find((e) => e.style.color === "#c88f5fb4")).toBeDefined();
    const search = root.querySelector<ElementStub>("input")!;
    search.value = "gold"; search.fire("input");
    expect(root.textContent).toContain("Found gold.");
    expect(root.textContent).not.toContain("Orc hits.");
    model.message_pending = false; renderMessageLog(asHtml(root), model);
    expect(root.textContent).not.toContain("Messages waiting");
  });
});
