import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunReport } from "@rpgm-tools/neo-angband-core";
import { archiveRun, GRAVEYARD_KEY, installGraveyard, MAX_ARCHIVE_SIZE, MAX_RECORDS, openGraveyard, readArchive, recordFor, runId, trimArchive, verdict } from "./graveyard.js";
import { fakeUi, flush, press, withHtmlElement } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => restore());

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    outcome: "death", cause: "Grip, Farmer Maggot's Dog", key: "lineage-1", name: "Tester", race: "Human", cls: "Warrior",
    level: 5, maxLevel: 5, maxDepth: 3, depth: 2, gold: 120, turn: 4000, score: 321, scored: true, endedAt: 1_700_000_000_000,
    history: [{ kind: "birth", text: "Began the quest.", turn: 1, depth: 0, level: 1, lost: false }, { kind: "level", text: "Reached level 5.", turn: 3000, depth: 2, level: 5, lost: false }],
    messages: [{ text: "You hit Grip.", count: 1 }, { text: "Grip bites you.", count: 2 }, { text: "You die.", count: 1 }],
    belongings: [{ name: "a Dagger (1d4)", color: "#ffffff", location: "equipment", quantity: 1, recall: { title: "a Dagger", text: "It is a light blade." } },
      { name: "3 Flasks of Oil", color: "#ffff00", location: "pack", quantity: 3, recall: null }],
    sheet: null,
    birth: { race: "Human", cls: "Warrior", name: "Tester", stats: [16, 10, 10, 14, 12] },
    ...overrides,
  } as RunReport;
}

function prefs(initial: unknown = { theme: "dark-graphite" }) {
  let value = initial;
  return { get: () => value, set: vi.fn((next: unknown) => { value = next; }) };
}

describe("the graveyard archive", () => {
  it("keeps each run once, newest first, beside the other preferences", () => {
    const store = prefs();
    const older = recordFor(report({ endedAt: 1000, name: "Older" }));
    const newer = recordFor(report({ endedAt: 2000, name: "Newer" }));
    expect(archiveRun(store, older)).toBe(true);
    expect(archiveRun(store, newer)).toBe(true);
    expect(archiveRun(store, newer)).toBe(true);
    expect(readArchive(store).records.map((record) => record.report.name)).toEqual(["Newer", "Older"]);
    expect((store.get() as Record<string, unknown>)["theme"]).toBe("dark-graphite");
  });

  it("ends the journal with the run's ending", () => {
    const record = recordFor(report());
    expect(record.id).toBe(runId(report()));
    expect(record.journal?.at(-1)).toMatchObject({ kind: "ending", text: "Killed by Grip, Farmer Maggot's Dog." });
  });

  it("drops the oldest runs past the limits, and a huge run's item texts before the run", () => {
    const many = Array.from({ length: MAX_RECORDS + 5 }, (_, index) => recordFor(report({ endedAt: index + 1 })));
    const kept = trimArchive(many);
    expect(kept).toHaveLength(MAX_RECORDS);
    expect(kept[0]!.report.endedAt).toBe(MAX_RECORDS + 5);
    const huge = recordFor(report({ belongings: [{ name: "a Scroll", color: "#fff", location: "pack", quantity: 1, recall: { title: "a Scroll", text: "x".repeat(MAX_ARCHIVE_SIZE) } }] }));
    const trimmed = trimArchive([huge]);
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0]!.report.belongings[0]!.recall).toBeNull();
  });

  it("leaves unreadable records as they are", () => {
    const store = prefs({ [GRAVEYARD_KEY]: { v: 1, records: [{ id: 5 }] } });
    archiveRun(store, recordFor(report()));
    const archive = readArchive(store);
    expect(archive.records).toHaveLength(1);
    expect(archive.unreadable).toEqual([{ id: 5 }]);
  });

  it("reports a refused write", () => {
    const store = { get: () => null, set: () => { throw new Error("quota"); } };
    expect(archiveRun(store, recordFor(report()))).toBe(false);
  });
});

describe("the graveyard", () => {
  it("installs nothing with its switch off", () => {
    const onRunEnd = vi.fn(() => () => {});
    const registerRow = vi.fn(() => () => {});
    installGraveyard({ flags: {}, character: { onRunEnd }, title: { registerRow }, log: () => {} })();
    expect(onRunEnd).not.toHaveBeenCalled();
    expect(registerRow).not.toHaveBeenCalled();
  });

  it("archives a run as it ends and opens its post-mortem", async () => {
    const host = fakeUi();
    const store = prefs();
    let listener: ((value: RunReport) => void) | null = null;
    const unsubscribe = vi.fn();
    const create = vi.fn(async () => ({ ok: true as const }));
    const cleanup = installGraveyard({ flags: { "anybandui.graveyard": true }, ui: host.ui, prefs: store, saves: { create }, log: () => {},
      character: { onRunEnd: (fn) => { listener = fn; return unsubscribe; } } });
    listener!(report());
    expect(readArchive(store).records).toHaveLength(1);
    const root = host.top()!.root;
    const text = root.text();
    expect(text).toContain("GAME OVER");
    expect(text).toContain("Human Warrior  |  Level 5");
    expect(text).toContain("Killed by Grip, Farmer Maggot's Dog");
    expect(text).toContain("3 (150 ft)");
    expect(text).toContain("321");
    // Final moments, newest first, with repeats counted.
    const moments = root.walk().filter((node) => node.tag === "p" && node.parent?.className === "moments").map((node) => node.textContent);
    expect(moments).toEqual(["You die.", "Grip bites you. (x2)", "You hit Grip."]);
    root.byText("Journal")!.click();
    expect(root.text()).toContain("Killed by Grip, Farmer Maggot's Dog.");
    root.byText("Final belongings")!.click();
    expect(root.text()).toContain("Select an item to inspect its final, identified properties.");
    root.byText("a Dagger (1d4)")!.click();
    expect(root.text()).toContain("It is a light blade.");
    root.byText("a Dagger (1d4)")!.focus();
    press(root, "ArrowDown");
    expect(root.text()).toContain("No description was recorded for this item.");
    root.byText("Character sheet")!.click();
    expect(root.text()).toContain("Character sheet unavailable.");
    expect(root.byText("Close")).toBeDefined();
    root.byText("Play Again")!.click();
    await flush();
    expect(create).toHaveBeenCalledWith({ like: report().birth });
    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("moves between the post-mortem pages with the arrows", () => {
    const host = fakeUi();
    let listener: ((value: RunReport) => void) | null = null;
    installGraveyard({ flags: { "anybandui.graveyard": true }, ui: host.ui, prefs: prefs(), log: () => {}, character: { onRunEnd: (fn) => { listener = fn; return () => {}; } } });
    listener!(report({ outcome: "winner", cause: "Ripe Old Age" }));
    const root = host.top()!.root;
    expect(root.text()).toContain("VICTORY");
    root.byText("Final moments")!.focus();
    press(root, "ArrowRight");
    expect(root.activeElement?.textContent).toBe("Journal");
    expect(root.byText("Journal")!.attributes["aria-selected"]).toBe("true");
  });

  it("offers Retry archiving when the run could not be stored", () => {
    const host = fakeUi();
    let listener: ((value: RunReport) => void) | null = null;
    let fail = true;
    let saved: unknown = null;
    const store = { get: () => saved, set: (value: unknown) => { if (fail) throw new Error("quota"); saved = value; } };
    installGraveyard({ flags: { "anybandui.graveyard": true }, ui: host.ui, prefs: store, log: () => {}, character: { onRunEnd: (fn) => { listener = fn; return () => {}; } } });
    listener!(report());
    const root = host.top()!.root;
    expect(root.text()).toContain("This run could not be added to the graveyard. Its summary is still available here.");
    fail = false;
    root.byText("Retry archiving")!.click();
    expect(root.byText("Retry archiving")).toBeUndefined();
    expect(readArchive(store).records).toHaveLength(1);
  });

  it("adds a Graveyard row to the title that lists past runs", async () => {
    const host = fakeUi();
    const store = prefs();
    archiveRun(store, recordFor(report({ name: "Alpha", endedAt: 1000 })));
    archiveRun(store, recordFor(report({ name: "Beta", endedAt: 2000, outcome: "retired", cause: "Retiring" })));
    let row: { label: string; run(): void | Promise<void> } | null = null;
    const create = vi.fn(async () => ({ ok: true as const }));
    installGraveyard({ flags: { "anybandui.graveyard": true }, ui: host.ui, prefs: store, saves: { create }, log: () => {}, title: { registerRow: (value) => { row = value; return () => {}; } } });
    expect(row!.label).toBe("Graveyard");
    const closed = row!.run();
    const list = host.top()!.root;
    expect(list.text()).toContain("Back to title");
    expect(list.text()).toContain("Beta - Human Warrior");
    expect(list.text()).toContain("Retired.");
    const search = list.byFocus("search")!;
    search.value = "alpha";
    search.fire("input");
    expect(list.text()).not.toContain("Beta - Human Warrior");
    list.byText("Alpha - Human Warrior")!.click();
    await flush();
    expect(host.live()).toHaveLength(2);
    const post = host.top()!.root;
    expect(post.byText("Back to graveyard")).toBeDefined();
    post.byText("New character like this")!.click();
    await flush();
    expect(create).toHaveBeenCalled();
    host.escape();
    await flush();
    expect(host.live()).toHaveLength(1);
    host.escape();
    await expect(closed).resolves.toBeUndefined();
  });

  it("says so when there are no runs, and when records cannot be read", () => {
    const host = fakeUi();
    void openGraveyard({ ui: host.ui, prefs: prefs({ [GRAVEYARD_KEY]: { records: ["junk"] } }), log: () => {} });
    const text = host.top()!.root.text();
    expect(text).toContain("Your completed runs will appear here.");
    expect(text).toContain("Some run records could not be read.");
  });

  it("names the outcome as upstream does", () => {
    expect(verdict({ outcome: "death" })).toBe("GAME OVER");
    expect(verdict({ outcome: "retired" })).toBe("RETIRED");
    expect(verdict({ outcome: "winner" })).toBe("VICTORY");
  });
});
