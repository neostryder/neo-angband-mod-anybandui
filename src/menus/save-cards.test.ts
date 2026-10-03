import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MenuQuestion } from "@rpgm-tools/neo-angband-mod-sdk";
import type { SaveEntry } from "@rpgm-tools/neo-angband-core";
import { accentColour, CHARACTER_SELECT_ID, saveCardsPart, statusLine, type SavesSeam } from "./save-cards.js";
import { fakeUi, flush, press, withHtmlElement, type FakeNode } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => restore());

const ROSTER: SaveEntry[] = [
  { id: "slot-a", name: "Aragorn", race: "Dunadan", cls: "Warrior", level: 12, depth: 5, dead: false, lastPlayed: 1_700_000_000_000 },
  { id: "slot-b", name: "Bilbo", race: "Hobbit", cls: "Rogue", level: 3, depth: 0, dead: false, lastPlayed: 1_700_000_100_000 },
  { id: "slot-c", name: "Celeborn", race: "High-Elf", cls: "Mage", level: 20, depth: 15, dead: true, lastPlayed: 1_700_000_200_000 },
];

function fakeSaves(start: readonly SaveEntry[] = ROSTER) {
  let entries = [...start];
  const saves = {
    list: vi.fn(async () => ({ ok: true as const, entries })),
    load: vi.fn(async (_id: string) => ({ ok: true as const })),
    rename: vi.fn(async (id: string, name: string) => { entries = entries.map((entry) => entry.id === id ? { ...entry, name } : entry); return { ok: true as const }; }),
    delete: vi.fn(async (id: string) => { entries = entries.filter((entry) => entry.id !== id); return { ok: true as const }; }),
    create: vi.fn(async (_options?: unknown) => ({ ok: true as const })),
  };
  return saves;
}

function question(rows = ROSTER.length): MenuQuestion {
  const choices = Array.from({ length: rows + 1 }, (_, index) => ({ id: `${CHARACTER_SELECT_ID}:row:${index}`, semantic: { kind: "choice" as const, ref: index }, label: index === rows ? "[ New character ]" : `row ${index}`, disabled: false }));
  return { id: CHARACTER_SELECT_ID, title: "Select a character", subtitle: "Living characters resume; tombstones are memorials.", footer: "", choices,
    style: "screen", cursor: 0, browseOnly: false,
    commands: [{ key: "Delete", ctrl: false }, { key: "Backspace", ctrl: false }, { key: "X", ctrl: false }, { key: "M", ctrl: false }, { key: "W", ctrl: false }],
    detail: () => [] };
}

async function openRoster(saves: SavesSeam, extra: { graveyard?: () => Promise<void> } = {}) {
  const host = fakeUi();
  const part = saveCardsPart({ flags: { "anybandui.saveCards": true }, ui: host.ui, saves, log: () => {}, ...extra })!;
  const answer = part.ask(question()) as Promise<unknown>;
  await flush();
  return { host, answer, root: (): FakeNode => host.live()[0]!.root };
}

describe("save cards", () => {
  it("is absent with its switch off", () => {
    expect(saveCardsPart({ flags: {}, saves: fakeSaves(), ui: fakeUi().ui, log: () => {} })).toBeNull();
  });

  it("declines every other menu", () => {
    const part = saveCardsPart({ flags: { "anybandui.saveCards": true }, saves: fakeSaves(), ui: fakeUi().ui, log: () => {} })!;
    expect(part.ask({ ...question(), id: "core:game-menu" })).toBeUndefined();
  });

  it("hands the picker back to Core when the roster cannot be read", async () => {
    const saves = { ...fakeSaves(), list: vi.fn(async () => ({ ok: false as const, reason: "no storage" })) };
    const part = saveCardsPart({ flags: { "anybandui.saveCards": true }, saves, ui: fakeUi().ui, log: () => {} })!;
    await expect(part.ask(question())).resolves.toBeUndefined();
  });

  it("draws each save as a card with its colour, identity and status", async () => {
    const { root } = await openRoster(fakeSaves());
    const text = root().text();
    expect(text).toContain("Aragorn");
    expect(text).toContain("Dunadan Warrior");
    expect(text).toContain("DEPTH 5    /    LEVEL 12");
    expect(text).toContain("IN TOWN    /    LEVEL 3");
    expect(text).toContain("DEAD    /    LEVEL 20");
    expect(text).toContain("Character summary");
    expect(text).toContain("Living characters resume");
    const card = root().byFocus("card-slot-a")!;
    expect(card.attributes["aria-pressed"]).toBe("true");
    expect(card.style["borderColor"]).toBe(accentColour("slot-a", false));
  });

  it("filters the cards by the search box", async () => {
    const { root } = await openRoster(fakeSaves());
    const search = root().byFocus("search")!;
    search.value = "hobbit";
    search.fire("input");
    expect(root().byFocus("card-slot-b")).toBeDefined();
    expect(root().byFocus("card-slot-a")).toBeUndefined();
    search.value = "nobody";
    search.fire("input");
    expect(root().text()).toContain("No matching characters.");
  });

  it("moves between cards with the arrows and continues with Enter", async () => {
    const saves = fakeSaves();
    const { root } = await openRoster(saves);
    expect(root().activeElement?.dataset["focus"]).toBe("card-slot-a");
    press(root(), "ArrowDown");
    expect(root().activeElement?.dataset["focus"]).toBe("card-slot-b");
    expect(root().text()).toContain("Bilbo");
    press(root(), "Enter");
    await flush();
    expect(saves.load).toHaveBeenCalledWith("slot-b");
  });

  it("continues a living character through the load seam", async () => {
    const saves = fakeSaves();
    const { root } = await openRoster(saves);
    root().byText("Continue")!.click();
    await flush();
    expect(saves.load).toHaveBeenCalledWith("slot-a");
  });

  it("starts a dead character's Play Again through create with its race and class", async () => {
    const saves = fakeSaves();
    const { root } = await openRoster(saves);
    root().byFocus("card-slot-c")!.click();
    expect(root().text()).toContain("Final character");
    root().byText("Play Again")!.click();
    await flush();
    expect(saves.create).toHaveBeenCalledWith({ like: { race: "High-Elf", cls: "Mage", name: "Celeborn" } });
    expect(saves.load).not.toHaveBeenCalled();
  });

  it("starts a new character through create, or picks Core's New row without it", async () => {
    const saves = fakeSaves();
    const first = await openRoster(saves);
    first.root().byText("New character")!.click();
    await flush();
    expect(saves.create).toHaveBeenCalledWith();
    const { create: _create, ...noCreate } = fakeSaves();
    const second = await openRoster(noCreate);
    second.root().byText("New character")!.click();
    await expect(second.answer).resolves.toEqual({ kind: "choose", choice: `${CHARACTER_SELECT_ID}:row:3` });
  });

  it("renames through a dialog that Escape closes on its own", async () => {
    const saves = fakeSaves();
    const { host, root } = await openRoster(saves);
    root().byText("Rename")!.click();
    await flush();
    expect(host.live()).toHaveLength(2);
    host.escape();
    await flush();
    expect(host.live()).toHaveLength(1);
    expect(saves.rename).not.toHaveBeenCalled();
    root().byText("Rename")!.click();
    await flush();
    const dialog = host.top()!.root;
    const input = dialog.byFocus("name")!;
    input.value = "   ";
    input.fire("input");
    expect(dialog.text()).toContain("Enter a name.");
    expect(dialog.byText("Rename")!.disabled).toBe(true);
    input.value = "Strider";
    input.fire("input");
    dialog.byText("Rename")!.click();
    await flush();
    expect(saves.rename).toHaveBeenCalledWith("slot-a", "Strider");
    expect(root().text()).toContain("Renamed to Strider.");
    expect(root().byFocus("card-slot-a")!.text()).toContain("Strider");
  });

  it("deletes only after the Delete save confirmation", async () => {
    const saves = fakeSaves();
    const { host, root } = await openRoster(saves);
    root().byText("Delete")!.click();
    await flush();
    let confirm = host.top()!.root;
    expect(confirm.text()).toContain("Permanently delete Aragorn?");
    expect(confirm.text()).toContain("This cannot be undone.");
    confirm.byText("Cancel")!.click();
    await flush();
    expect(saves.delete).not.toHaveBeenCalled();
    expect(host.live()).toHaveLength(1);
    root().byText("Delete")!.click();
    await flush();
    confirm = host.top()!.root;
    confirm.byText("Delete save")!.click();
    await flush();
    expect(saves.delete).toHaveBeenCalledWith("slot-a");
    // The roster stepped aside for the host's own question and came back with the result.
    expect(host.panels.filter((panel) => panel.label === "Select a character")).toHaveLength(2);
    expect(host.live()).toHaveLength(1);
    expect(root().text()).toContain("Aragorn was deleted.");
    expect(root().byFocus("card-slot-a")).toBeUndefined();
  });

  it("cancels the picker on Escape, which returns to the title", async () => {
    const { host, answer } = await openRoster(fakeSaves());
    host.escape();
    await expect(answer).resolves.toEqual({ kind: "cancel" });
  });

  it("reaches the host's export, import and storage pages through their command keys", async () => {
    const first = await openRoster(fakeSaves());
    first.root().byFocus("card-slot-b")!.click();
    first.root().byText("Export character")!.click();
    await expect(first.answer).resolves.toEqual({ kind: "command", key: "X", cursor: 1 });
    const second = await openRoster(fakeSaves());
    second.root().byFocus("card-slot-c")!.click();
    expect(second.root().byText("Export character")!.disabled).toBe(true);
    second.root().byText("Storage")!.click();
    await expect(second.answer).resolves.toEqual({ kind: "command", key: "W", cursor: 2 });
  });

  it("opens the graveyard over the roster when it is on", async () => {
    const graveyard = vi.fn(async () => {});
    const { root } = await openRoster(fakeSaves(), { graveyard });
    root().byText("Graveyard")!.click();
    await flush();
    expect(graveyard).toHaveBeenCalled();
    const without = await openRoster(fakeSaves());
    expect(without.root().byText("Graveyard")).toBeUndefined();
  });

  it("says so when there are no saves", async () => {
    const { root } = await openRoster(fakeSaves([]));
    expect(root().text()).toContain("No saved characters.");
    expect(root().byText("New character")).toBeDefined();
  });
});

describe("card colours and status", () => {
  it("keeps a save's colour stable and darkens it on light themes", () => {
    const dark = accentColour("slot-a", false);
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(accentColour("slot-a", false)).toBe(dark);
    expect(accentColour("slot-b", false)).not.toBe(dark);
    const light = accentColour("slot-a", true);
    const channels = (hex: string): number[] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    channels(light).forEach((value, index) => expect(value).toBeLessThan(channels(dark)[index]!));
    // Upstream's saturation and value: the brightest channel is 183.
    expect(Math.max(...channels(dark))).toBe(183);
  });

  it("names the town, the depth and the dead as upstream does", () => {
    expect(statusLine({ dead: false, depth: 0, level: 1 })).toBe("IN TOWN    /    LEVEL 1");
    expect(statusLine({ dead: false, depth: 7, level: 9 })).toBe("DEPTH 7    /    LEVEL 9");
    expect(statusLine({ dead: true, depth: 7, level: 9 })).toBe("DEAD    /    LEVEL 9");
  });
});
