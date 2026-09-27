import { describe, expect, it, vi } from "vitest";
import type { CommandCatalogue, Phase4Context, Phase4Snapshot, SpellPrompt, TextPrompt } from "./seams.js";
import { adaptSpells } from "./view-model/spells.js";
import { actionReady, answerRest, answerSpell, cancelSpell, castSpell, rest, restAnswer, restPrompt, stopResting, studySpell } from "./spell-actions.js";
import { activate, catalogueCommands, itemBindings, migrateSlots, quickbarOwnsKey, readSlots, resolve, slotIndex, writeSlots } from "./quickbar.js";
import { blastGrids } from "./blast-preview.js";
import { adoptLineage, characterFor, restingText } from "./phase4.js";

const token = { epoch: 2, revision: 4 };
const bookItem = { handle: 7, label: "Book of Magic", number: 1, inscription: null, kindId: "book:magic", tval: 90, sval: 0, artifact: false, ego: false };
const potion = { handle: 11, label: "Potion of Healing", number: 2, inscription: null, kindId: "potion:healing", tval: 75, sval: 1, artifact: false, ego: false };
const snap = (): Phase4Snapshot => ({ token, phase: "play", messagePending: false, prompt: null, core: {
  player: { grid: { x: 2, y: 3 }, level: 10, sp: 15, classFlags: ["CHOOSE_SPELLS"] }, inventory: [bookItem, potion], equipment: [],
  spellbooks: [{ name: "Magic", tval: 90, realm: "arcane", spells: [{ name: "Magic Missile", sidx: 3, bidx: 0, level: 1, mana: 2, fail: 20, learned: true, worked: true, forgotten: false }, { name: "Light", sidx: 4, bidx: 0, level: 2, mana: 3, fail: 25, learned: false, worked: false, forgotten: false }] }],
} });
const context = (snapshot = snap): Phase4Context & { intent: NonNullable<Phase4Context["intent"]> } => ({ snapshot, driver: () => ({ kind: "player" }), intent: { submit: vi.fn(() => ({ accepted: true })) },
  inspect: { spellInfo: (index) => ({ token, name: index === 3 ? "Magic Missile" : "Light", description: "A simple spell.", level: 1, mana: 2, failChance: 12, canCastNow: index === 3 }),
    itemTester: (code) => ({ token, items: code === "quaff" ? [{ handle: 11 }] : [] }) }, log: vi.fn() });

describe("phase 4 spells and quickbar", () => {
  it("adapts carried books and inspection details", () => { const ctx = context(); const model = adaptSpells(snap(), ctx.inspect)!;
    expect(model.books).toHaveLength(1); expect(model.books[0]?.spells.map((s) => [s.name, s.fail, s.state])).toEqual([["Magic Missile", 12, "Castable"], ["Light", 12, "Learnable"]]); });
  it("declines ambiguous books without an item-to-book seam", () => { const source = snap(); const extra = { ...source.core.spellbooks![0]!, name: "Advanced Magic", spells: [{ ...source.core.spellbooks![0]!.spells[0]!, bidx: 1, sidx: 8 }] };
    const ambiguous: Phase4Snapshot = { ...source, core: { ...source.core, spellbooks: [...source.core.spellbooks!, extra] } };
    expect(adaptSpells(ambiguous, context().inspect)?.books).toHaveLength(0);
    expect(adaptSpells(ambiguous, { ...context().inspect, bookForItem: () => ({ token, bookIndex: 0, spells: [3, 4] }) })?.books.map((b) => b.spells.map((s) => s.index))).toEqual([[3, 4]]); });
  it("submits cast and study using current tokens; random study omits the spell", () => { const ctx = context(); const book = adaptSpells(snap(), ctx.inspect)!.books[0]!;
    expect(castSpell(ctx, snap(), book.spells[0]!)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "cast", args: { spell: 3 } } });
    expect(studySpell(ctx, snap(), book, book.spells[1]!)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "study", args: { handle: 7, spell: 4 } } });
    expect(studySpell(ctx, snap(), { ...book, chooseSpells: false }, book.spells[0]!)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "study", args: { handle: 7 } } });
    expect(castSpell(ctx, { ...snap(), token: { epoch: 2, revision: 3 } }, book.spells[0]!)).toBe(false); });
  it("answers only the live spell prompt", () => { const prompt: SpellPrompt = { kind: "spell", promptId: 14, label: "Choose a spell", choices: [{ index: 3, name: "Magic Missile", level: 1, mana: 2, fail: 12, castable: true }] };
    const current = { ...snap(), prompt }; const reply = vi.fn(() => ({ accepted: true })); const ctx = { ...context(() => current), prompt: { reply } };
    expect(answerSpell(ctx, current, 3)).toBe(true); expect(reply).toHaveBeenCalledWith(14, 3); expect(answerSpell(ctx, current, 4)).toBe(false); expect(reply).toHaveBeenCalledTimes(1); });
  it("cancels the live spell prompt with the typed reply", () => {
    const prompt: SpellPrompt = { kind: "spell", promptId: 14, label: "Choose a spell", choices: [{ index: 3, name: "Magic Missile", level: 1, mana: 2, fail: 12, castable: true }] };
    const current = { ...snap(), prompt }; const reply = vi.fn(() => ({ accepted: true })); const ctx = { ...context(() => current), prompt: { reply } };
    expect(cancelSpell(ctx, current)).toBe(true); expect(reply).toHaveBeenLastCalledWith(14, { action: "cancel" });
    // A moved token declines the cancel reply.
    expect(cancelSpell(ctx, { ...current, token: { epoch: 2, revision: 3 } })).toBe(false);
    expect(cancelSpell({ ...ctx, driver: () => ({ kind: "controller" as const, owner: "core:borg" }) }, current)).toBe(false);
  });
  it("declines to cancel an older engine that refuses the reply", () => {
    const prompt: SpellPrompt = { kind: "spell", promptId: 14, label: "Choose a spell", choices: [{ index: 3, name: "Magic Missile", level: 1, mana: 2, fail: 12, castable: true }] };
    const current = { ...snap(), prompt }; const reply = vi.fn(() => ({ accepted: false })); const ctx = { ...context(() => current), prompt: { reply } };
    expect(cancelSpell(ctx, current)).toBe(false); expect(reply).toHaveBeenLastCalledWith(14, { action: "cancel" });
  });
  it("submits rest counts and declines while an autoplayer drives", () => { const ctx = context(); expect(rest(ctx, snap(), -2)).toBe(true);
    expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "rest", args: { count: -2 } } });
    expect(rest(ctx, snap(), 10000)).toBe(false); const driven = { ...ctx, driver: () => ({ kind: "controller" as const, owner: "borg" }) }; expect(actionReady(driven, snap())).toBe(false); expect(rest(driven, snap(), 5)).toBe(false); const { driver: _driver, ...withoutDriver } = ctx; expect(rest(withoutDriver, snap(), 5)).toBe(true); });
  it("maps top row and modifier rows without taking numpad keys", () => { expect([slotIndex("Digit1", false, false), slotIndex("Digit0", false, false), slotIndex("Digit1", true, false), slotIndex("Digit0", false, true), slotIndex("Numpad1", false, false)]).toEqual([0, 9, 10, 29, -1]); });
  it("owns each number key only during ordinary play across other enabled flags", () => { const flags = { "anybandui.quickbar": true, "anybandui.clickToWalk": true, "anybandui.dungeonActions": true, "anybandui.aimPath": true, "anybandui.itemsChoice": true, "anybandui.zoom": true };
    expect(quickbarOwnsKey(flags["anybandui.quickbar"], snap(), "Digit1", false, false, false)).toBe(true);
    expect(quickbarOwnsKey(false, snap(), "Digit1", false, false, false)).toBe(false);
    expect(quickbarOwnsKey(true, { ...snap(), prompt: { kind: "item", promptId: 5 } }, "Digit1", false, false, false)).toBe(false);
    expect(quickbarOwnsKey(true, snap(), "Digit1", false, false, true)).toBe(false);
    expect(quickbarOwnsKey(true, snap(), "Numpad1", false, false, false)).toBe(false); });
  it("resolves an item after its handle changes and submits its current handle", () => { const ctx = context(); const binding = itemBindings(snap(), ctx).find((b) => b.code === "quaff")!;
    const moved: Phase4Snapshot = { ...snap(), core: { ...snap().core, inventory: [bookItem, { ...potion, handle: 40 }] } };
    const movedCtx = { ...ctx, snapshot: () => moved, inspect: { ...ctx.inspect, itemTester: () => ({ token, items: [{ handle: 40 }] }) } };
    expect(resolve(moved, binding, null, movedCtx).usable).toBe(true); expect(activate(movedCtx, moved, binding)).toBe(true);
    expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "quaff", args: { handle: 40 } } }); });
  it("preserves other preference fields and isolates characters", () => { const prefs = { get: vi.fn(() => ({ theme: "dark-graphite", quickbar: { A: Array(30).fill(null) } })), set: vi.fn() };
    const ctx = { ...context(), prefs }; const slots = Array(30).fill(null); slots[0] = { type: "spell", key: "book:magic", index: 3, name: "Magic Missile", appearance: { style: "potion", text: "Blast", color: "#aabbcc" } }; slots[10] = { type: "command", code: "rest", name: "Rest" }; writeSlots(ctx, "B", slots);
    const written = prefs.set.mock.calls[0]?.[0] as Record<string, unknown>; expect(written.theme).toBe("dark-graphite"); expect(readSlots(written, "B")[0]).toEqual(slots[0]); expect(readSlots(written, "A")[0]).toBeNull(); });
  it("resolves the rest command binding", () => { const ctx = context(); const binding = { type: "command" as const, code: "rest" as const, name: "Rest" }; expect(activate(ctx, snap(), binding)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "rest", args: { count: -2 } } }); });
  it("leaves other phase controls untouched during prompts and blocked phases", () => { const ctx = context();
    for (const prompt of [null, { kind: "item", promptId: 5 }]) { const current = { ...snap(), prompt, phase: prompt ? "modal" as const : "store" as const }; expect(actionReady({ ...ctx, snapshot: () => current }, current)).toBe(false); }
    expect(actionReady({ ...ctx, snapshot: () => ({ ...snap(), messagePending: true }) }, snap())).toBe(false); });
});

describe("quickbar character identity", () => {
  it("prefers the engine's key and falls back to the birth fingerprint", async () => {
    const { characterFor } = await import("./phase4.js");
    const player = { race: { name: "Dwarf" }, cls: { name: "Priest" }, auBirth: 120, htBirth: 48, wtBirth: 150 };
    const base = { log: vi.fn() };
    expect(characterFor({ ...base, character: { key: () => "engine-key" }, state: { actor: { player } } })).toBe("engine-key");
    expect(characterFor({ ...base, state: { actor: { player } } })).toBe("Dwarf|Priest|120|48|150");
    expect(characterFor({ ...base, state: { actor: { player: { ...player, auBirth: undefined } } } })).toBeNull();
    expect(characterFor(base)).toBeNull();
  });
});

describe("adopted core seams: spells", () => {
  const twoBooks = (): Phase4Snapshot => { const source = snap(); const advanced = { handle: 8, label: "Conjurings and Tricks", number: 1, inscription: null, kindId: "book:conjurings", tval: 90, sval: 1, artifact: false, ego: false };
    return { ...source, core: { ...source.core, inventory: [bookItem, advanced, potion],
      player: { ...source.core.player!, learnableSpells: 2 },
      spellbooks: [{ ...source.core.spellbooks![0]!, spells: source.core.spellbooks![0]!.spells.map((s) => ({ ...s, studyEligible: !s.learned, infoLine: s.learned ? " dam 3d4" : "" })) },
        { name: "Conjurings", tval: 90, realm: "arcane", spells: [{ name: "Phase Door", sidx: 8, bidx: 1, level: 3, mana: 2, fail: 22, learned: false, worked: false, forgotten: false, studyEligible: false, infoLine: "" }] }] } }; };
  const mapping = (handle: number) => handle === 7 ? { token, bookIndex: 0, spells: [3, 4] } : handle === 8 ? { token, bookIndex: 1, spells: [8] } : null;
  it("maps every carried book through the engine, so two books of one item class both appear", () => {
    const model = adaptSpells(twoBooks(), { ...context().inspect, bookForItem: mapping })!;
    expect(model.books.map((b) => [b.handle, b.spells.map((s) => s.index)])).toEqual([[7, [3, 4]], [8, [8]]]);
    expect(model.learnable).toBe(2);
  });
  it("ignores a mapping from another wait and an item the class cannot cast from", () => {
    const stale = adaptSpells(twoBooks(), { ...context().inspect, bookForItem: () => ({ token: { epoch: 2, revision: 3 }, bookIndex: 0, spells: [3, 4] }) })!;
    expect(stale.books).toHaveLength(0);
    const throwing = adaptSpells(twoBooks(), { ...context().inspect, bookForItem: () => { throw new Error("capability"); } })!;
    expect(throwing.books).toHaveLength(0);
  });
  it("uses the game's study check and info line, and allows no study with no new spell slots", () => {
    const model = adaptSpells(twoBooks(), { ...context().inspect, bookForItem: mapping })!;
    const [first, second] = model.books;
    expect(first!.spells.map((s) => [s.canStudy, s.infoLine])).toEqual([[false, "dam 3d4"], [true, ""]]);
    // Phase Door is level 3 at character level 10, but the game says it is not eligible.
    expect(second!.spells[0]!.canStudy).toBe(false);
    const full: Phase4Snapshot = { ...twoBooks(), core: { ...twoBooks().core, player: { ...twoBooks().core.player!, learnableSpells: 0 } } };
    expect(adaptSpells(full, { ...context().inspect, bookForItem: mapping })!.books[0]!.spells.every((s) => !s.canStudy)).toBe(true);
    expect(adaptSpells(snap(), context().inspect)!.learnable).toBeNull();
  });
});

describe("adopted core seams: rest", () => {
  const restQuestion: TextPrompt = { kind: "text", promptId: 21, label: "Rest (0-9999): ", maxLength: 4, defaultValue: "&", tag: "rest" };
  it("maps each rest choice to the letter the game's own question takes", () => {
    expect([-2, -1, -3, 25, 9999, 0, 10000].map(restAnswer)).toEqual(["&", "*", "!", "25", "9999", null, null]);
  });
  it("answers the tagged rest question and never an ordinary text question", () => {
    // Cancel reply is refused so the empty-string fallback runs, the same way
    // the older engine answered the rest prompt before the typed cancel reply.
    const asking: Phase4Snapshot = { ...snap(), phase: "modal", prompt: restQuestion };
    const reply = vi.fn((_id: number, answer: unknown) => ({ accepted: !(typeof answer === "object" && answer !== null && (answer as { action?: string }).action === "cancel") }));
    const ctx = { ...context(() => asking), prompt: { reply } };
    expect(restPrompt(asking)?.promptId).toBe(21);
    expect(answerRest(ctx, asking, -1)).toBe(true); expect(reply).toHaveBeenLastCalledWith(21, "*");
    expect(answerRest(ctx, asking, 40)).toBe(true); expect(reply).toHaveBeenLastCalledWith(21, "40");
    // Cancel sends the empty answer, which the game treats as no rest at all.
    expect(answerRest(ctx, asking, null)).toBe(true); expect(reply).toHaveBeenLastCalledWith(21, "");
    const { tag: _tag, ...untagged } = restQuestion;
    const inscription: Phase4Snapshot = { ...asking, prompt: { ...untagged, promptId: 22 } };
    expect(restPrompt(inscription)).toBeNull(); expect(answerRest({ ...ctx, snapshot: () => inscription }, inscription, -2)).toBe(false);
    expect(reply).toHaveBeenCalledTimes(4);
  });
  it("leaves number keys to the rest question", () => {
    expect(quickbarOwnsKey(true, { ...snap(), prompt: restQuestion }, "Digit5", false, false, false)).toBe(false);
  });
  it("stops a rest from the rest modal with the token current at the click", () => {
    const resting: Phase4Snapshot = { ...snap(), phase: "modal", token: { epoch: 2, revision: 9 }, resting: { active: true, mode: 30, turnsRemaining: 12 } };
    const ctx = context(() => resting);
    expect(stopResting(ctx)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith({ epoch: 2, revision: 9 }, { kind: "stop-resting" });
    expect(stopResting(context())).toBe(false);
    const driven = { ...ctx, driver: () => ({ kind: "controller" as const, owner: "core:borg" }) };
    expect(stopResting(driven)).toBe(false);
  });
  it("describes each rest mode and the turns left", () => {
    expect([{ active: true, mode: 30, turnsRemaining: 12 }, { active: true, mode: 1, turnsRemaining: 1 }, { active: true, mode: -2, turnsRemaining: null }, { active: true, mode: -1, turnsRemaining: null }, { active: true, mode: -3, turnsRemaining: null }].map(restingText))
      .toEqual(["Resting: 12 turns left.", "Resting: 1 turn left.", "Resting until fully recovered.", "Resting until hit points and mana are full.", "Resting until hit points or mana are full."]);
  });
  it("describes the named rest modes and a timed rest with both counts", () => {
    expect([
      { active: true, mode: "turns" as const, turnsRequested: 25, turnsRemaining: 12, turnsRested: 13 },
      { active: true, mode: "turns" as const, turnsRequested: 1, turnsRemaining: 1, turnsRested: 0 },
      { active: true, mode: "complete" as const, turnsRequested: null, turnsRemaining: null, turnsRested: 7 },
      { active: true, mode: "all-points" as const, turnsRequested: null, turnsRemaining: null, turnsRested: 7 },
      { active: true, mode: "some-points" as const, turnsRequested: null, turnsRemaining: null, turnsRested: 7 },
    ].map(restingText)).toEqual([
      "Resting: 12 of 25 turns left.",
      "Resting: 1 of 1 turns left.",
      "Resting until fully recovered.",
      "Resting until hit points and mana are full.",
      "Resting until hit points or mana are full.",
    ]);
  });
  it("cancels a rest prompt with the typed reply on a newer engine and the empty string on an older one", () => {
    const asking: Phase4Snapshot = { ...snap(), phase: "modal", prompt: restQuestion }; const reply = vi.fn();
    const newer = { ...context(() => asking), prompt: { reply: reply.mockImplementation(() => ({ accepted: true })) } };
    expect(answerRest(newer, asking, null)).toBe(true); expect(reply).toHaveBeenLastCalledWith(21, { action: "cancel" });
    // Older engine: cancel reply is refused, so the empty string falls back.
    reply.mockReset();
    const older = { ...context(() => asking), prompt: { reply: reply.mockImplementation((id, answer) => ({ accepted: !(typeof answer === "object" && answer.action === "cancel") })) } };
    expect(answerRest(older, asking, null)).toBe(true); expect(reply.mock.calls[0]).toEqual([21, { action: "cancel" }]);
    expect(reply.mock.calls[1]).toEqual([21, ""]);
  });
});

describe("adopted core seams: blast preview", () => {
  const area = vi.fn((to: { x: number; y: number }, radius: number) => ({ token, grids: [to, { x: to.x + radius, y: to.y }], radius, element: "FIRE", wallsStop: true }));
  const ball = { token, radius: 2, element: "FIRE", wallsStop: true };
  const breath = { token, radius: 2, arc: 60, element: "FIRE", wallsStop: true };
  it("draws the game's blast area at the target cursor with the pending radius", () => {
    const aiming: Phase4Snapshot = { ...snap(), phase: "modal", activeBlast: ball, prompt: { kind: "target", promptId: 3, cursor: { x: 9, y: 4 } } };
    const result = blastGrids({ ...context(), inspect: { blastArea: area } }, aiming, { x: 1, y: 1 });
    // A ball carries no arc; the third argument is undefined for the older engine and a numeric breath for the newer one.
    expect(area).toHaveBeenLastCalledWith({ x: 9, y: 4 }, 2, undefined); expect(result).toEqual({ grids: [{ x: 9, y: 4 }, { x: 11, y: 4 }], element: "FIRE" });
  });
  it("forwards a breath's arc to the blast area preview", () => {
    const aiming: Phase4Snapshot = { ...snap(), phase: "modal", activeBlast: breath, prompt: { kind: "target", promptId: 3, cursor: { x: 9, y: 4 } } };
    blastGrids({ ...context(), inspect: { blastArea: area } }, aiming, { x: 1, y: 1 });
    expect(area).toHaveBeenLastCalledWith({ x: 9, y: 4 }, 2, 60);
  });
  it("uses the hovered grid for a direction question and draws nothing without a pending blast", () => {
    const direction: Phase4Snapshot = { ...snap(), phase: "modal", activeBlast: ball, prompt: { kind: "direction", promptId: 4 } };
    const ctx = { ...context(), inspect: { blastArea: area } };
    expect(blastGrids(ctx, direction, { x: 5, y: 6 })?.grids[0]).toEqual({ x: 5, y: 6 });
    expect(blastGrids(ctx, direction, null)).toBeNull();
    expect(blastGrids(ctx, { ...direction, activeBlast: null }, { x: 5, y: 6 })).toBeNull();
    expect(blastGrids(ctx, { ...direction, activeBlast: { ...ball, token: { epoch: 2, revision: 1 } } }, { x: 5, y: 6 })).toBeNull();
    expect(blastGrids(ctx, { ...snap(), activeBlast: ball }, { x: 5, y: 6 })).toBeNull();
  });
});

describe("adopted core seams: quickbar commands and identity", () => {
  const catalogue = (overrides: Record<string, Partial<{ verb: string | null }>> = {}): CommandCatalogue => {
    const base = { walk: null, hold: null, descend: null, look: null, rest: null, quaff: null, "shop-exit": null, "mymod-dance": null } as Record<string, string | null>;
    for (const [code, value] of Object.entries(overrides)) base[code] = value.verb ?? null;
    return { token, intents: [{ kind: "stop-resting", args: "none" }], commands: [
      { code: "walk", verb: base.walk, phase: "play", args: "dir: 1..9" },
      { code: "hold", verb: base.hold, phase: "play", args: "args?: plain object" },
      { code: "descend", verb: base.descend, phase: "play", args: "args?: plain object" },
      { code: "look", verb: base.look, phase: "play", args: "args?: {x: integer, y: integer}" },
      { code: "rest", verb: base.rest, phase: "play", args: "args?: {count: integer}" },
      { code: "quaff", verb: base.quaff, phase: "play", args: "args: {handle: integer, quantity?: positive integer}" },
      { code: "shop-exit", verb: base["shop-exit"], phase: "store", args: "args?: plain object" },
      { code: "mymod-dance", verb: base["mymod-dance"], phase: "play", args: "args?: plain object" },
    ] };
  };
  it("offers argument-free play commands by a readable name and never a raw code", () => {
    const ctx = { ...context(), intent: { submit: vi.fn(() => ({ accepted: true })), catalogue: () => catalogue() } };
    const offered = catalogueCommands(ctx);
    expect(offered.map((b) => b.code)).toEqual(["hold", "descend", "look"]);
    expect(offered.map((b) => b.name)).toEqual(["Stay still", "Go down stairs", "Look around"]);
    for (const b of offered) expect(b.name).not.toBe(b.code);
    expect(catalogueCommands(context())).toEqual([]);
  });
  it("labels a slot with the engine's verb when no table entry exists, and skips verbs that are null with no table entry", () => {
    const ctx = { ...context(), intent: { submit: vi.fn(() => ({ accepted: true })), catalogue: () => catalogue({ "mymod-dance": { verb: "dance" }, hold: { verb: null } }) } };
    const offered = catalogueCommands(ctx);
    // mymod-dance has no table entry but the engine supplies a verb, so it appears.
    expect(offered.find((b) => b.code === "mymod-dance")?.name).toBe("Dance");
    // hold still has a table entry, which wins over the missing verb.
    expect(offered.find((b) => b.code === "hold")?.name).toBe("Stay still");
  });
  it("omits codes without a table entry and without a verb on a newer engine", () => {
    const ctx = { ...context(), intent: { submit: vi.fn(() => ({ accepted: true })), catalogue: () => catalogue() } };
    expect(catalogueCommands(ctx).some((b) => b.code === "mymod-dance")).toBe(false);
  });
  it("submits a command slot with no arguments and greys a stair command off the stairs", () => {
    const submit = vi.fn(() => ({ accepted: true }));
    const ctx = { ...context(), intent: { submit, catalogue }, inspect: { ...context().inspect, tileActions: () => ({ token, codes: ["pickup"] }) } };
    expect(activate(ctx, snap(), { type: "command", code: "look", name: "Look around" })).toBe(true);
    expect(submit).toHaveBeenLastCalledWith(token, { kind: "command", command: { code: "look" } });
    expect(resolve(snap(), { type: "command", code: "descend", name: "Go down stairs" }, null, ctx).usable).toBe(false);
    const older = { ...context(), intent: { submit } };
    expect(resolve(snap(), { type: "command", code: "hold", name: "Stay still" }, null, older)).toMatchObject({ usable: false, label: "Stay still" });
    expect(activate(ctx, snap(), { type: "command", code: "rest", name: "Rest" })).toBe(true);
    expect(submit).toHaveBeenLastCalledWith(token, { kind: "command", command: { code: "rest", args: { count: -2 } } });
  });
  it("keeps saved command slots, including a mod command named by its verb, and drops nameless ones", () => {
    const saved = { quickbar: { A: [{ type: "command", code: "hold", name: "Stay still" }, { type: "command", code: "mymod-dance", name: "Dance" }, { type: "command", code: "mymod-hop", name: "" }] } };
    expect(readSlots(saved, "A").slice(0, 3)).toEqual([{ type: "command", code: "hold", name: "Stay still" }, { type: "command", code: "mymod-dance", name: "Dance" }, null]);
  });
  it("moves a character's slots from the birth fingerprint to the lineage once", () => {
    const fingerprint = "Dwarf|Priest|120|48|150"; const bar = Array(30).fill(null); bar[0] = { type: "command", code: "rest", name: "Rest" };
    let stored: unknown = { theme: "dark-graphite", quickbar: { [fingerprint]: bar, other: [] } };
    const prefs = { get: () => stored, set: vi.fn((value: unknown) => { stored = value; }) };
    const player = { race: { name: "Dwarf" }, cls: { name: "Priest" }, auBirth: 120, htBirth: 48, wtBirth: 150 };
    const current: Phase4Snapshot = { ...snap(), core: { ...snap().core, player: { ...snap().core.player!, race: "Dwarf", cls: "Priest" } } };
    const ctx = { ...context(), prefs, state: { actor: { player } }, character: { key: () => "lineage-7" } };
    expect(characterFor(ctx)).toBe("lineage-7");
    expect(adoptLineage(ctx, current)).toBe(true);
    expect(readSlots(stored, "lineage-7")[0]).toEqual(bar[0]); expect((stored as { theme: string }).theme).toBe("dark-graphite");
    expect(Object.keys((stored as { quickbar: object }).quickbar).sort()).toEqual(["lineage-7", "other"]);
    expect(adoptLineage(ctx, current)).toBe(false); expect(prefs.set).toHaveBeenCalledTimes(1);
  });
  it("never moves slots onto a lineage whose race and class differ from the fingerprint", () => {
    const stored = { quickbar: { "Dwarf|Priest|120|48|150": [] } }; const prefs = { get: () => stored, set: vi.fn() };
    const player = { race: { name: "Dwarf" }, cls: { name: "Priest" }, auBirth: 120, htBirth: 48, wtBirth: 150 };
    const other: Phase4Snapshot = { ...snap(), core: { ...snap().core, player: { ...snap().core.player!, race: "Elf", cls: "Mage" } } };
    expect(adoptLineage({ ...context(), prefs, state: { actor: { player } }, character: { key: () => "lineage-9" } }, other)).toBe(false);
    expect(migrateSlots(stored, "Dwarf|Priest|120|48|150", "Dwarf|Priest|120|48|150")).toBeNull();
    expect(prefs.set).not.toHaveBeenCalled();
  });
});
