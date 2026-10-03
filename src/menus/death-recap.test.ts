import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunReport } from "@rpgm-tools/neo-angband-core";
import { attackerName, BLOW_BUFFER, blowRow, buildRecap, createBlowLog, driverNote, installDeathRecap, readRecap, RECAP_BLOWS, type RecapSnapshot } from "./death-recap.js";
import { installGraveyard, readArchive } from "./graveyard.js";
import { installMenus } from "./menus.js";
import { fakeUi, withHtmlElement } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => restore());

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    outcome: "death", cause: "Grip, Farmer Maggot's Dog", key: "lineage-1", name: "Tester", race: "Human", cls: "Warrior",
    level: 5, maxLevel: 5, maxDepth: 3, depth: 2, gold: 120, turn: 4000, score: 321, scored: true, endedAt: 1_700_000_000_000,
    history: [{ kind: "birth", text: "Began the quest.", turn: 1, depth: 0, level: 1, lost: false }, { kind: "level", text: "Reached level 5.", turn: 3000, depth: 2, level: 5, lost: false }],
    messages: [{ text: "You hit Grip.", count: 1 }, { text: "Grip bites you.", count: 2 }, { text: "You die.", count: 1 }],
    belongings: [],
    sheet: null,
    birth: { race: "Human", cls: "Warrior", name: "Tester", stats: [16, 10, 10, 14, 12] },
    ...overrides,
  } as RunReport;
}

const SNAPSHOT: RecapSnapshot = { core: { monsters: [{ id: 7, race: "Grip, Farmer Maggot's Dog", visible: true }, { id: 9, race: "Poltergeist", visible: false }] } };
const blow = (attacker: number | null, damage: number, hit = true, kind: "melee" | "trap" = "melee") => ({ attacker, target: "player" as const, kind, hit, damage, died: false, grid: { x: 1, y: 1 }, seen: true });

/** A fake event bus that calls handlers as Core does: the event name, then the payload. */
function bus() {
  const handlers = new Map<string, Set<(type: string, payload: unknown) => void>>();
  return {
    on: vi.fn((type: string, fn: (type: string, payload: unknown) => void) => { (handlers.get(type) ?? handlers.set(type, new Set()).get(type)!).add(fn); }),
    off: vi.fn((type: string, fn: (type: string, payload: unknown) => void) => { handlers.get(type)?.delete(fn); }),
    emit(type: string, payload: unknown) { for (const fn of handlers.get(type) ?? []) fn(type, payload); },
    count: () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0),
  };
}

describe("the blow log", () => {
  it("names only a creature the character could see", () => {
    expect(attackerName(7, "melee", SNAPSHOT)).toBe("Grip, Farmer Maggot's Dog");
    expect(attackerName(9, "spell", SNAPSHOT)).toBe("Something unseen");
    expect(attackerName(null, "trap", SNAPSHOT)).toBe("A trap");
    expect(attackerName(null, "effect", null)).toBe("Something unseen");
    expect(attackerName("player", "effect", null)).toBe("You");
  });

  it("keeps blows against the character and its own healing, up to the limit", () => {
    const log = createBlowLog(() => SNAPSHOT, 3);
    log.combat({ ...blow(7, 4), target: 7 });
    log.combat(blow(7, 4));
    log.heal({ who: 7, amount: 5 });
    log.heal({ who: "player", amount: 6 });
    log.combat(blow(7, 0, false));
    log.combat(blow(null, 3, true, "trap"));
    expect(log.entries()).toEqual([
      { by: "You", kind: "heal", hit: true, amount: 6 },
      { by: "Grip, Farmer Maggot's Dog", kind: "melee", hit: false, amount: 0 },
      { by: "A trap", kind: "trap", hit: true, amount: 3 },
    ]);
    log.clear();
    expect(log.entries()).toEqual([]);
  });

  it("shows each blow as a change in hit points", () => {
    expect(blowRow({ by: "Grip", kind: "melee", hit: true, amount: 4 })).toEqual(["Grip", "melee", "-4"]);
    expect(blowRow({ by: "Grip", kind: "ranged", hit: false, amount: 0 })).toEqual(["Grip", "missile", "missed"]);
    expect(blowRow({ by: "You", kind: "heal", hit: true, amount: 6 })).toEqual(["You", "healing", "+6"]);
  });
});

describe("the recap", () => {
  it("is built only for a death", () => {
    expect(buildRecap(report({ outcome: "winner" }), [], undefined, null)).toBeNull();
    const blows = Array.from({ length: RECAP_BLOWS + 3 }, (_, at) => ({ by: "Grip", kind: "melee" as const, hit: true, amount: at }));
    const recap = buildRecap(report(), blows, undefined, { kind: "player" })!;
    expect(recap).toMatchObject({ killer: "Grip, Farmer Maggot's Dog", depth: 2, maxDepth: 3, level: 5, turn: 4000, driver: null });
    expect(recap.blows).toHaveLength(RECAP_BLOWS);
    expect(recap.blows.at(-1)!.amount).toBe(RECAP_BLOWS + 2);
    expect(recap.messages).toEqual(["You hit Grip.", "Grip bites you. (x2)", "You die."]);
    expect(recap.milestones.map((entry) => entry.text)).toEqual(["Reached level 5."]);
    expect(readRecap(recap)).toBe(recap);
    expect(readRecap({ v: 1, killer: 3 })).toBeNull();
    const { driver: _driver, ...noDriver } = recap;
    expect(readRecap(noDriver)).toBeNull();
  });

  it("names a controller that was playing, and points to Squire's own report", () => {
    expect(buildRecap(report(), [], undefined, { kind: "controller", owner: "squire" })!.driver).toBe("squire");
    expect(driverNote(null)).toBeNull();
    expect(driverNote("squire")).toContain("Report tab of the Squire panel");
    expect(driverNote("borg")).toBe("Borg was playing when this character died.");
    expect(driverNote("someone-else")).toBe("Autoplayer was playing when this character died.");
  });
});

describe("the death recap switch", () => {
  it("lets go of a combat listener when the healing one cannot be added", () => {
    const off = vi.fn();
    const on = vi.fn((type: string) => { if (type === "heal") throw new Error("not granted"); });
    const install = installDeathRecap({ flags: { "anybandui.deathRecap": true }, events: { on, off } as never, log: () => {} }, false);
    install.cleanup();
    expect(off).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledWith("combat-outcome", expect.any(Function));
  });

  it("listens to nothing with its switch off", () => {
    const events = bus();
    const onRunEnd = vi.fn(() => () => {});
    const install = installDeathRecap({ flags: {}, events, character: { onRunEnd }, log: () => {} }, true);
    expect(install.recap).toBeUndefined();
    install.cleanup();
    expect(events.on).not.toHaveBeenCalled();
    expect(onRunEnd).not.toHaveBeenCalled();
  });

  it("opens a recap dialog at a death when the graveyard is off, and lets go on cleanup", () => {
    const host = fakeUi();
    const events = bus();
    let listener: ((value: RunReport) => void) | null = null;
    const unsubscribe = vi.fn();
    const install = installDeathRecap({ flags: { "anybandui.deathRecap": true }, ui: host.ui, events, snapshot: () => SNAPSHOT,
      driver: () => ({ kind: "controller", owner: "squire" }), character: { onRunEnd: (fn) => { listener = fn; return unsubscribe; } }, log: () => {} }, true);
    events.emit("combat-outcome", blow(7, 9));
    events.emit("heal", { who: "player", amount: 2, grid: { x: 1, y: 1 }, seen: true });
    listener!(report({ outcome: "retired", cause: "Retired" }));
    expect(host.top()).toBeUndefined();
    events.emit("combat-outcome", blow(7, 5));
    listener!(report());
    const text = host.top()!.root.text();
    expect(text).toContain("Death recap");
    expect(text).toContain("Killed by Grip, Farmer Maggot's Dog");
    expect(text).toContain("-5");
    expect(text).toContain("Report tab of the Squire panel");
    expect(text).toContain("Reached level 5.");
    install.cleanup();
    expect(unsubscribe).toHaveBeenCalled();
    expect(events.count()).toBe(0);
  });

  it("keeps no more than its buffer of blows", () => {
    const events = bus();
    const install = installDeathRecap({ flags: { "anybandui.deathRecap": true }, events, snapshot: () => SNAPSHOT, log: () => {} }, false);
    for (let at = 0; at < BLOW_BUFFER + 10; at++) events.emit("combat-outcome", blow(7, 1));
    expect(install.recap!(report())!.blows).toHaveLength(RECAP_BLOWS);
  });

  it("becomes the first page of the post-mortem when the graveyard is on", () => {
    const host = fakeUi();
    const events = bus();
    let value: unknown = {};
    const prefs = { get: () => value, set: (next: unknown) => { value = next; } };
    const listeners: Array<(value: RunReport) => void> = [];
    const cleanup = installMenus({ flags: { "anybandui.deathRecap": true, "anybandui.graveyard": true }, ui: host.ui, prefs, events, snapshot: () => SNAPSHOT,
      character: { onRunEnd: (fn: (value: RunReport) => void) => { listeners.push(fn); return () => {}; }, history: () => [] }, log: () => {} } as never);
    events.emit("combat-outcome", blow(7, 6));
    for (const fn of listeners) fn(report());
    expect(host.live()).toHaveLength(1);
    const root = host.top()!.root;
    expect(root.byText("Recap")!.attributes["aria-selected"]).toBe("true");
    expect(root.text()).toContain("Last blows");
    expect(root.text()).toContain("-6");
    expect(readArchive(prefs).records[0]!.recap!.blows).toHaveLength(1);
    root.byText("Final moments")!.click();
    expect(root.text()).toContain("Grip bites you. (x2)");
    cleanup();
  });

  it("leaves the post-mortem pages as they were without a recap", () => {
    const host = fakeUi();
    let listener: ((value: RunReport) => void) | null = null;
    installGraveyard({ flags: { "anybandui.graveyard": true }, ui: host.ui, prefs: { get: () => null, set: () => {} }, log: () => {}, character: { onRunEnd: (fn) => { listener = fn; return () => {}; } } });
    listener!(report());
    const root = host.top()!.root;
    expect(root.byText("Recap")).toBeUndefined();
    expect(root.byText("Final moments")!.attributes["aria-selected"]).toBe("true");
  });
});
