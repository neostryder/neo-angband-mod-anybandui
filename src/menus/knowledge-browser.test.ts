import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeListView, ModKnowledge } from "@rpgm-tools/neo-angband-core";
import type { ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import { installKnowledgeBrowser, visibleEntries } from "./knowledge-browser.js";
import { installDomGlobals, overlayUi } from "./test-dom.js";
import { openMenu } from "./openers.js";

const lists: Record<string, KnowledgeListView> = {
  monsters: { title: "known monsters", groups: [
    { name: "Canines", entries: [{ id: "m1", name: "Jackal", color: "#c08040", known: true, cells: [{ text: "C", color: "#c08040" }] }, { id: "m2", name: "Wild dog", color: "#c08040", known: true }] },
    { name: "Kobolds", entries: [{ id: "m3", name: "Small kobold", color: "#ffff00", known: true }] },
  ] },
  objects: { title: "known objects", groups: [{ name: "Potions", entries: [{ id: "o1", name: "Cure Light Wounds", color: "#ffffff", known: true }] }] },
  runes: { title: "runes", groups: [] },
};

function recallPage(name: string): ScreenView {
  return { id: "core:text", title: name, footer: "", blocks: [
    { kind: "text", paragraphs: [[{ text: `${name} is a creature you have met.` }]] },
    { kind: "table", key: "stats", tagged: false, columns: [{ key: "k", label: "Stat" }, { key: "v" }], rows: [{ cells: { k: { text: "Speed" }, v: { text: "+10" } } }] },
  ] };
}

function seam(): ModKnowledge & { recall: ReturnType<typeof vi.fn> } {
  const recall = vi.fn((category: string, id: string) => {
    const entry = lists[category]?.groups.flatMap((g) => g.entries).find((e) => e.id === id);
    return entry ? recallPage(entry.name) : null;
  });
  return {
    categories: () => [
      { id: "objects", title: "known objects", count: 1 },
      { id: "runes", title: "runes (3 unknown)", count: 0 },
      { id: "monsters", title: "known monsters", count: 3 },
    ],
    list: (category: string) => lists[category] ?? null,
    recall,
  } as ModKnowledge & { recall: ReturnType<typeof vi.fn> };
}

describe("knowledge browser", () => {
  let restore = (): void => {};
  let cleanup = (): void => {};
  beforeEach(() => { restore = installDomGlobals(); });
  afterEach(() => { cleanup(); cleanup = () => {}; restore(); });

  it("installs nothing with its switch off", () => {
    const openPanel = vi.fn();
    cleanup = installKnowledgeBrowser({ flags: {}, log: () => {}, ui: { openPanel }, knowledge: seam() });
    expect(openPanel).not.toHaveBeenCalled();
    expect(openMenu("knowledge-browser")).toBe(false);
  });

  it("filters by name and group, case-insensitively, in the game's order", () => {
    expect(visibleEntries(lists["monsters"]!, "", "DOG").map((v) => v.entry.name)).toEqual(["Wild dog"]);
    expect(visibleEntries(lists["monsters"]!, "", "kobolds").map((v) => v.entry.name)).toEqual(["Small kobold"]);
    expect(visibleEntries(lists["monsters"]!, "Canines", "").map((v) => v.entry.name)).toEqual(["Jackal", "Wild dog"]);
  });

  it("opens on the first category with entries, selects the first entry and shows its recall page", () => {
    const { root, ui } = overlayUi();
    const knowledge = seam();
    cleanup = installKnowledgeBrowser({ flags: { "anybandui.knowledgeBrowser": true }, log: () => {}, ui, knowledge });
    expect(root.text()).toContain("Cure Light Wounds is a creature you have met.");
    expect(root.byFocus("tab:runes")?.disabled).toBe(true);
    expect(root.byFocus("tab:objects")?.attributes["aria-selected"]).toBe("true");
    expect(root.text()).toContain("Speed");
  });

  it("moves through categories with Left and Right, entries with Up and Down, and backs out with Escape", () => {
    const { root, ui } = overlayUi();
    cleanup = installKnowledgeBrowser({ flags: { "anybandui.knowledgeBrowser": true }, log: () => {}, ui, knowledge: seam() });
    // Runes has no entries, so Right skips it.
    root.byFocus("tab:objects")!.fire("keydown", "ArrowRight");
    expect(root.focused()).toBe("tab:monsters");
    expect(root.text()).toContain("Jackal is a creature you have met.");
    root.byFocus("tab:monsters")!.fire("keydown", "ArrowDown");
    expect(root.focused()).toBe("entry:m1");
    root.byFocus("entry:m1")!.fire("keydown", "ArrowDown");
    expect(root.focused()).toBe("entry:m2");
    expect(root.text()).toContain("Wild dog is a creature you have met.");
    root.byFocus("entry:m2")!.fire("keydown", "Enter");
    expect(root.focused()).toBe("detail");
    root.byFocus("detail")!.fire("keydown", "Escape");
    expect(root.focused()).toBe("entry:m2");
    root.byFocus("entry:m2")!.fire("keydown", "Escape");
    expect(root.focused()).toBe("search");
    root.byFocus("search")!.fire("keydown", "Escape");
    expect(root.focused()).toBe("tab:monsters");
  });

  it("searches, keeps the caret, and says when nothing matches", () => {
    const { root, ui } = overlayUi();
    cleanup = installKnowledgeBrowser({ flags: { "anybandui.knowledgeBrowser": true }, log: () => {}, ui, knowledge: seam() });
    root.byFocus("tab:monsters")!.click();
    root.byFocus("search")!.focus();
    root.byFocus("search")!.enter("kob");
    expect(root.focused()).toBe("search");
    expect(root.byFocus("search")!.selectionStart).toBe(3);
    expect(root.text()).toContain("1 entry");
    expect(root.text()).toContain("Small kobold is a creature you have met.");
    root.byFocus("search")!.enter("zzz");
    expect(root.text()).toContain("No matching entries.");
    expect(root.text()).toContain("Select an entry to read about it.");
  });

  it("filters by group from the group list", () => {
    const { root, ui } = overlayUi();
    cleanup = installKnowledgeBrowser({ flags: { "anybandui.knowledgeBrowser": true }, log: () => {}, ui, knowledge: seam() });
    root.byFocus("tab:monsters")!.click();
    const group = root.byFocus("group")!;
    group.value = "Kobolds";
    group.fire("change");
    expect(root.text()).toContain("1 entry");
    expect(root.text()).not.toContain("Jackal");
  });

  it("says when the game shares no knowledge lists", () => {
    const { root, ui } = overlayUi();
    const log = vi.fn();
    cleanup = installKnowledgeBrowser({ flags: { "anybandui.knowledgeBrowser": true }, log, ui });
    expect(log).toHaveBeenCalledWith("knowledge browser: this game does not share its knowledge lists");
    expect(root.text()).toContain("This game does not share its knowledge lists.");
  });

  it("redraws when the lists grow and stops reading once closed", () => {
    vi.useFakeTimers();
    try {
      const { root, ui } = overlayUi();
      const knowledge = seam();
      cleanup = installKnowledgeBrowser({ flags: { "anybandui.knowledgeBrowser": true }, log: () => {}, ui, knowledge });
      lists["objects"] = { title: "known objects", groups: [{ name: "Potions", entries: [{ id: "o1", name: "Cure Light Wounds", color: "#ffffff", known: true }, { id: "o2", name: "Speed", color: "#ffffff", known: true }] }] };
      vi.advanceTimersByTime(1000);
      expect(root.text()).toContain("2 entries");
      cleanup(); cleanup = () => {};
      const calls = knowledge.recall.mock.calls.length;
      vi.advanceTimersByTime(5000);
      expect(knowledge.recall.mock.calls.length).toBe(calls);
    } finally {
      lists["objects"] = { title: "known objects", groups: [{ name: "Potions", entries: [{ id: "o1", name: "Cure Light Wounds", color: "#ffffff", known: true }] }] };
      vi.useRealTimers();
    }
  });
});
