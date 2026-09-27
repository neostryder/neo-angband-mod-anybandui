import type { Phase4Context, Phase4Snapshot, ItemView } from "./seams.js";
import { actionReady } from "./spell-actions.js";
import { adaptSpells, itemKey, type SpellsModel } from "./view-model/spells.js";

export interface Appearance { readonly style: "automatic" | "text" | "potion" | "scroll" | "wand"; readonly text: string; readonly color: string }
export type Binding = ({ readonly type: "spell"; readonly key: string; readonly index: number; readonly name: string } | { readonly type: "item"; readonly key: string; readonly code: "quaff" | "read" | "aim-wand" | "activate"; readonly name: string } | { readonly type: "command"; readonly code: string; readonly name: string }) & { readonly appearance?: Appearance };
/** Readable names for play commands that take no arguments. The catalogue has
 * codes only, and codes never reach the screen, so a code with no name here,
 * such as another mod's command, is left out. */
export const COMMAND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  hold: "Stay still", pickup: "Pick up", descend: "Go down stairs", ascend: "Go up stairs",
  explore: "Explore", "navigate-down": "Walk to down stairs", "navigate-up": "Walk to up stairs",
  "fire-at-nearest": "Fire at nearest", look: "Look around",
});
/** Grid-bound commands whose use the game can already rule on for the player's grid. */
const TILE_COMMANDS = new Set(["pickup", "ascend", "descend"]);
/** The argument-free play commands the engine's catalogue offers, by name.
 * Rest keeps its own binding with a duration, and cast needs a spell. */
export function catalogueCommands(ctx: Phase4Context): Extract<Binding, { type: "command" }>[] {
  let catalogue: ReturnType<NonNullable<NonNullable<Phase4Context["intent"]>["catalogue"]>> = null;
  try { catalogue = ctx.intent?.catalogue?.() ?? null; } catch { catalogue = null; }
  return (catalogue?.commands ?? []).filter((entry) => entry.phase === "play" && entry.args.startsWith("args?") && entry.code !== "rest" && Object.hasOwn(COMMAND_LABELS, entry.code))
    .map((entry) => ({ type: "command" as const, code: entry.code, name: COMMAND_LABELS[entry.code]! }));
}
export type Slots = readonly (Binding | null)[];
export const slotIndex = (code: string, shift: boolean, ctrl: boolean): number => {
  if (!/^Digit[0-9]$/.test(code)) return -1;
  return (ctrl ? 20 : shift ? 10 : 0) + (Number(code.slice(-1)) + 9) % 10;
};
export function quickbarOwnsKey(enabled: boolean, snap: Phase4Snapshot | null, code: string, shift: boolean, ctrl: boolean, menuOpen: boolean): boolean {
  // Phase 2 map keys never claim number keys; modal and typed prompts keep theirs.
  return enabled && !menuOpen && !!snap && snap.phase === "play" && !snap.prompt && !snap.messagePending && slotIndex(code, shift, ctrl) >= 0;
}
export function readSlots(raw: unknown, character: string): Slots {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] as Record<string, unknown> : {};
  const slots = profiles[character];
  return Array.from({ length: 30 }, (_, i) => {
    const entry = Array.isArray(slots) ? slots[i] : null;
    if (!entry || typeof entry !== "object") return null;
    const b = entry as Record<string, unknown>;
    if (b.type === "spell" && typeof b.key === "string" && Number.isInteger(b.index) && typeof b.name === "string") return b as Binding;
    if (b.type === "item" && typeof b.key === "string" && ["quaff", "read", "aim-wand", "activate"].includes(String(b.code)) && typeof b.name === "string") return b as Binding;
    if (b.type === "command" && (b.code === "rest" || Object.hasOwn(COMMAND_LABELS, String(b.code))) && typeof b.name === "string") return b as Binding;
    return null;
  });
}
export function writeSlots(ctx: Phase4Context, character: string, slots: Slots): void {
  if (!ctx.prefs?.set) return;
  const raw = ctx.prefs.get(); const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] as Record<string, unknown> : {};
  ctx.prefs.set({ ...root, quickbar: { ...profiles, [character]: slots } });
}
/** Move one character's slots to a new key, once. Returns the preferences to
 * write, or null when there is nothing to move: no slots under the old key, or
 * the new key already has its own. Other preference fields are kept. */
export function migrateSlots(raw: unknown, from: string, to: string): Record<string, unknown> | null {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] as Record<string, unknown> : {};
  if (from === to || !Array.isArray(profiles[from]) || Object.hasOwn(profiles, to)) return null;
  const { [from]: moved, ...rest } = profiles;
  return { ...root, quickbar: { ...rest, [to]: moved } };
}
export function itemBindings(snap: Phase4Snapshot, ctx: Phase4Context): Extract<Binding, { type: "item" }>[] {
  const codes = ["quaff", "read", "aim-wand", "activate"] as const;
  return (snap.core.inventory ?? []).flatMap((item) => codes.filter((code) => {
    const result = ctx.inspect?.itemTester?.(code);
    return result?.token.epoch === snap.token.epoch && result.token.revision === snap.token.revision && result.items.some((entry) => "handle" in entry && entry.handle === item.handle);
  }).map((code) => ({ type: "item" as const, key: itemKey(item), code, name: item.label })));
}
export function resolve(snap: Phase4Snapshot, binding: Binding | null, spells: SpellsModel | null, ctx: Phase4Context): { readonly label: string; readonly detail: string; readonly amount?: string; readonly usable: boolean; readonly command?: { code: string; args?: Record<string, number> } } {
  if (!binding) return { label: "Empty", detail: "Right-click to assign.", usable: false };
  if (binding.type === "command" && binding.code === "rest") return { label: "Rest", detail: "Rest until fully recovered.", usable: true, command: { code: "rest", args: { count: -2 } } };
  if (binding.type === "command") {
    const name = COMMAND_LABELS[binding.code] ?? binding.name;
    if (!catalogueCommands(ctx).some((entry) => entry.code === binding.code)) return { label: name, detail: "This command is not available in this game.", usable: false };
    let usable = true;
    const grid = snap.core.player?.grid;
    if (TILE_COMMANDS.has(binding.code) && grid && ctx.inspect?.tileActions) {
      const actions = ctx.inspect.tileActions(grid);
      if (actions && actions.token.epoch === snap.token.epoch && actions.token.revision === snap.token.revision) usable = actions.codes.includes(binding.code);
    }
    // Look takes no arguments or a grid, and the host refuses an empty args
    // object for it, so the command goes out with no args key.
    return { label: name, detail: usable ? `${name}.` : `${name}. Not possible on this square.`, usable, ...(usable ? { command: { code: binding.code } } : {}) };
  }
  if (binding.type === "spell") {
    const book = spells?.books.find((b) => b.key === binding.key);
    const spell = book?.spells.find((s) => s.index === binding.index && s.name === binding.name);
    if (!spell) return { label: binding.name, detail: "Spellbook no longer carried.", usable: false };
    return { label: spell.name, amount: `${spell.mana} SP`, detail: `Mana ${spell.mana}, fail ${spell.fail}%. ${spell.state}. ${spell.description}`, usable: spell.canCast,
      ...(spell.canCast ? { command: { code: "cast", args: { spell: spell.index } } } : {}) };
  }
  const item: ItemView | undefined = snap.core.inventory?.find((entry) => itemKey(entry) === binding.key);
  if (!item) return { label: binding.name, detail: "Item no longer carried.", usable: false };
  const tester = ctx.inspect?.itemTester?.(binding.code);
  const usable = !!tester && tester.token.epoch === snap.token.epoch && tester.token.revision === snap.token.revision && tester.items.some((entry) => "handle" in entry && entry.handle === item.handle);
  const inspection = ctx.inspect?.inspectItem?.(item.handle);
  const description = inspection?.token.epoch === snap.token.epoch && inspection.token.revision === snap.token.revision ? ` ${inspection.text.slice(0, 600)}` : "";
  const charge = binding.code === "aim-wand" ? ` Charges ${item.pval ?? 0}.` : binding.code === "activate" ? ` Recharge ${item.timeout ?? 0}.` : "";
  return { label: item.label, amount: binding.code === "aim-wand" ? `${item.pval ?? 0} charges` : binding.code === "activate" ? item.timeout ? "Recharging" : "Ready" : `${item.number} carried`, detail: `${item.number} carried.${charge}${description}`, usable, ...(usable ? { command: { code: binding.code, args: { handle: item.handle } } } : {}) };
}
export function activate(ctx: Phase4Context, snap: Phase4Snapshot, binding: Binding | null): boolean {
  if (!actionReady(ctx, snap)) return false;
  const resolved = resolve(snap, binding, adaptSpells(snap, ctx.inspect), ctx);
  return !!resolved.usable && !!resolved.command && !!ctx.intent?.submit(snap.token, { kind: "command", command: resolved.command }).accepted;
}
