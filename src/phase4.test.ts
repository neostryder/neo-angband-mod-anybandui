import { describe, expect, it, vi } from "vitest";
import type { Phase4Context, Phase4Snapshot, SpellPrompt } from "./seams.js";
import { adaptSpells } from "./view-model/spells.js";
import { actionReady, answerSpell, castSpell, rest, studySpell } from "./spell-actions.js";
import { activate, itemBindings, quickbarOwnsKey, readSlots, resolve, slotIndex, writeSlots } from "./quickbar.js";

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
    expect(adaptSpells(ambiguous, { ...context().inspect, bookForItem: () => 0 })?.books).toHaveLength(1); });
  it("submits cast and study using current tokens; random study omits the spell", () => { const ctx = context(); const book = adaptSpells(snap(), ctx.inspect)!.books[0]!;
    expect(castSpell(ctx, snap(), book.spells[0]!)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "cast", args: { spell: 3 } } });
    expect(studySpell(ctx, snap(), book, book.spells[1]!)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "study", args: { handle: 7, spell: 4 } } });
    expect(studySpell(ctx, snap(), { ...book, chooseSpells: false }, book.spells[0]!)).toBe(true); expect(ctx.intent.submit).toHaveBeenCalledWith(token, { kind: "command", command: { code: "study", args: { handle: 7 } } });
    expect(castSpell(ctx, { ...snap(), token: { epoch: 2, revision: 3 } }, book.spells[0]!)).toBe(false); });
  it("answers only the live spell prompt", () => { const prompt: SpellPrompt = { kind: "spell", promptId: 14, label: "Choose a spell", choices: [{ index: 3, name: "Magic Missile", level: 1, mana: 2, fail: 12, castable: true }] };
    const current = { ...snap(), prompt }; const reply = vi.fn(() => ({ accepted: true })); const ctx = { ...context(() => current), prompt: { reply } };
    expect(answerSpell(ctx, current, 3)).toBe(true); expect(reply).toHaveBeenCalledWith(14, 3); expect(answerSpell(ctx, current, 4)).toBe(false); expect(reply).toHaveBeenCalledTimes(1); });
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
