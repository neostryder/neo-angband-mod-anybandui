import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterHistoryEntry, RunReport } from "@rpgm-tools/neo-angband-core";
import { filterJournal, journalFromHistory, journalMeta, newJournalFilter } from "./journal.js";
import { DEPTH_POLL_MS, installDepthRecorder, installRunJournal, readDepthMarks, recordDepth } from "./run-journal.js";
import { fakeUi, flush, withHtmlElement } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => { restore(); vi.useRealTimers(); });

const entry = (kind: CharacterHistoryEntry["kind"], text: string, turn: number, level = 1, depth = 0, lost = false): CharacterHistoryEntry => ({ kind, text, turn, level, depth, lost });

const HISTORY: CharacterHistoryEntry[] = [
  entry("birth", "Began the quest to destroy Morgoth.", 1),
  entry("level", "Reached level 2.", 100, 2, 1),
  entry("unique", "Killed Grip, Farmer Maggot's Dog.", 300, 2, 2),
  entry("level", "Reached level 3.", 500, 3, 3),
  entry("artifact", "Found the Phial of Galadriel.", 700, 3, 4, true),
  entry("level", "Reached level 2.", 900, 3, 4),
];

function store(initial: unknown = null) {
  let bag = initial;
  return { get: () => bag, set: vi.fn((value: unknown) => { bag = value; }) };
}

describe("the journal model", () => {
  it("maps Angband's history, keeps the first entry per level, and places depths by history position", () => {
    const journal = journalFromHistory(HISTORY, [{ depth: 4, level: 3, after: 4 }, { depth: 1, level: 1, after: 1 }]);
    expect(journal.map((item) => item.kind)).toEqual(["other", "depth", "level", "unique", "level", "depth", "artifact"]);
    expect(journal[1]!.text).toBe("Reached 50 ft (dungeon level 1).");
    expect(journal.filter((item) => item.text === "Reached level 2.")).toHaveLength(1);
  });

  it("filters by kind and text and puts the newest first by default", () => {
    const journal = journalFromHistory(HISTORY);
    const filter = newJournalFilter();
    expect(filterJournal(journal, filter)[0]!.kind).toBe("artifact");
    expect(filterJournal(journal, { ...filter, category: 1 }).map((item) => item.text)).toEqual(["Reached level 3.", "Reached level 2."]);
    expect(filterJournal(journal, { ...filter, newest: false, search: "GRIP" }).map((item) => item.kind)).toEqual(["unique"]);
  });

  it("writes the meta line as upstream does", () => {
    expect(journalMeta({ kind: "level", text: "", turn: 12, depth: 0, level: 5, lost: false })).toBe("Lv 5  /  Town  /  Turn 12");
    expect(journalMeta({ kind: "level", text: "", turn: 12, depth: 3, level: 5, lost: false })).toBe("Lv 5  /  Depth 3  /  Turn 12");
    expect(journalMeta({ kind: "depth", text: "", turn: null, depth: 3, level: 5, lost: false })).toBe("Lv 5  /  Depth 3");
  });
});

describe("the depth recorder", () => {
  /* The host's snapshot as this mod receives it: core.turn is null, because the
   * manifest holds no state:turn.read grant. */
  const snapshot = (depth: number, level = 4) => () => ({ core: { turn: null, player: { depth, level } } });
  const historyOf = (count: number) => ({ history: () => HISTORY.slice(0, count) });

  it("stores only a new deepest level and keeps the rest of the bag", () => {
    const bag = store({ other: 1 });
    expect(recordDepth({ characterStore: bag, snapshot: snapshot(0), log: () => {} })).toBe(false);
    expect(recordDepth({ characterStore: bag, snapshot: snapshot(3), character: historyOf(2), log: () => {} })).toBe(true);
    expect(recordDepth({ characterStore: bag, snapshot: snapshot(2), character: historyOf(3), log: () => {} })).toBe(false);
    expect(recordDepth({ characterStore: bag, snapshot: snapshot(5, 7), character: historyOf(5), log: () => {} })).toBe(true);
    expect(bag.get()).toEqual({ other: 1, journalDepths: [{ depth: 3, level: 4, after: 2 }, { depth: 5, level: 7, after: 5 }] });
    expect(readDepthMarks(bag)).toHaveLength(2);
  });

  it("places a new depth after the history recorded before it, though the snapshot has no turn", () => {
    const bag = store();
    recordDepth({ characterStore: bag, snapshot: snapshot(3, 2), character: historyOf(3), log: () => {} });
    const kinds = journalFromHistory(HISTORY, readDepthMarks(bag)).map((item) => item.kind);
    expect(kinds).toEqual(["other", "level", "unique", "depth", "level", "artifact"]);
  });

  it("listens for level changes and stops on cleanup", () => {
    vi.useFakeTimers();
    let handler: (() => void) | null = null;
    const events = { on: vi.fn((_type: string, fn: () => void) => { handler = fn; }), off: vi.fn() };
    let depth = 0;
    const bag = store();
    const cleanup = installDepthRecorder({ characterStore: bag, events: events as never, snapshot: () => ({ core: { player: { depth, level: 1 } } }), character: historyOf(1), log: () => {} });
    expect(events.on).toHaveBeenCalledWith("dungeonlevel", expect.any(Function));
    depth = 2;
    handler!();
    expect(readDepthMarks(bag)).toEqual([{ depth: 2, level: 1, after: 1 }]);
    cleanup();
    expect(events.off).toHaveBeenCalledWith("dungeonlevel", handler);
  });

  it("records a new depth when the level-change event never comes", () => {
    vi.useFakeTimers();
    let depth = 0;
    const bag = store();
    const events = { on: vi.fn(), off: vi.fn() };
    const cleanup = installDepthRecorder({ characterStore: bag, events: events as never, snapshot: () => ({ core: { player: { depth, level: 1 } } }), character: historyOf(1), log: () => {} });
    depth = 2;
    vi.advanceTimersByTime(DEPTH_POLL_MS);
    expect(readDepthMarks(bag)).toEqual([{ depth: 2, level: 1, after: 1 }]);
    cleanup();
    depth = 3;
    vi.advanceTimersByTime(DEPTH_POLL_MS * 2);
    expect(readDepthMarks(bag)).toHaveLength(1);
  });

  it("says so when the game refuses the event", () => {
    const log = vi.fn();
    installDepthRecorder({ characterStore: store(), events: { on: () => { throw new Error("not granted"); }, off: () => {} } as never, log });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("new depths are not recorded"));
  });
});

describe("the run journal pane", () => {
  it("opens nothing with its switch off", () => {
    const openPanel = vi.fn();
    const registerPanelKind = vi.fn();
    installRunJournal({ flags: {}, ui: { openPanel, registerPanelKind }, log: () => {} })();
    expect(openPanel).not.toHaveBeenCalled();
    expect(registerPanelKind).not.toHaveBeenCalled();
  });

  it("shows the live timeline, filters it, and offers Play Again once the run ends", async () => {
    vi.useFakeTimers();
    const host = fakeUi();
    let report: RunReport | null = null;
    const create = vi.fn(async () => ({ ok: true as const }));
    const cleanup = installRunJournal({ flags: { "anybandui.runJournal": true }, ui: host.ui, log: () => {},
      character: { history: () => HISTORY, runReport: () => report }, saves: { create },
      characterStore: store({ journalDepths: [{ depth: 4, level: 3, after: 4 }] }) });
    const root = host.top()!.root;
    expect(root.text()).toContain("Run summary");
    expect(root.text()).toContain("Found the Phial of Galadriel. (lost)");
    expect(root.text()).toContain("Reached 200 ft (dungeon level 4).");
    expect(root.byText("Play Again")).toBeUndefined();
    const category = root.byFocus("run-journal-category")!;
    category.value = "3";
    category.fire("change");
    expect(root.text()).toContain("Killed Grip");
    expect(root.text()).not.toContain("Reached level 3.");
    category.value = "0";
    category.fire("change");
    report = { outcome: "death", cause: "Grip", turn: 1000, depth: 4, level: 3, birth: { race: "Human", cls: "Warrior", name: "Tester", stats: [] } } as unknown as RunReport;
    vi.advanceTimersByTime(200);
    expect(root.text()).toContain("Killed by Grip.");
    root.byText("Play Again")!.click();
    await flush();
    expect(create).toHaveBeenCalledWith({ like: { race: "Human", cls: "Warrior", name: "Tester", stats: [] } });
    cleanup();
  });

  it("says when the search matches nothing", () => {
    vi.useFakeTimers();
    const host = fakeUi();
    const cleanup = installRunJournal({ flags: { "anybandui.runJournal": true }, ui: host.ui, log: () => {}, character: { history: () => HISTORY } });
    const search = host.top()!.root.byFocus("run-journal-search")!;
    search.value = "balrog";
    search.fire("input");
    expect(host.top()!.root.text()).toContain("No matching milestones yet.");
    cleanup();
  });
});
