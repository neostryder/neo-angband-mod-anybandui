import type { Phase4Context, Phase4Snapshot, ItemView } from "./seams.js";
import { actionReady } from "./spell-actions.js";
import { adaptSpells, itemKey, type SpellsModel } from "./view-model/spells.js";

export interface Appearance { readonly style: "automatic" | "text" | "potion" | "scroll" | "wand"; readonly text: string; readonly color: string }
export type Binding = ({ readonly type: "spell"; readonly key: string; readonly index: number; readonly name: string } | { readonly type: "item"; readonly key: string; readonly code: "quaff" | "read" | "aim-wand" | "activate"; readonly name: string } | { readonly type: "command"; readonly code: "rest"; readonly name: string }) & { readonly appearance?: Appearance };
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
    if (b.type === "command" && b.code === "rest" && typeof b.name === "string") return b as Binding;
    return null;
  });
}
export function writeSlots(ctx: Phase4Context, character: string, slots: Slots): void {
  if (!ctx.prefs?.set) return;
  const raw = ctx.prefs.get(); const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] as Record<string, unknown> : {};
  ctx.prefs.set({ ...root, quickbar: { ...profiles, [character]: slots } });
}
export function itemBindings(snap: Phase4Snapshot, ctx: Phase4Context): Extract<Binding, { type: "item" }>[] {
  const codes = ["quaff", "read", "aim-wand", "activate"] as const;
  return (snap.core.inventory ?? []).flatMap((item) => codes.filter((code) => {
    const result = ctx.inspect?.itemTester?.(code);
    return result?.token.epoch === snap.token.epoch && result.token.revision === snap.token.revision && result.items.some((entry) => "handle" in entry && entry.handle === item.handle);
  }).map((code) => ({ type: "item" as const, key: itemKey(item), code, name: item.label })));
}
export function resolve(snap: Phase4Snapshot, binding: Binding | null, spells: SpellsModel | null, ctx: Phase4Context): { readonly label: string; readonly detail: string; readonly amount?: string; readonly usable: boolean; readonly command?: { code: string; args: Record<string, number> } } {
  if (!binding) return { label: "Empty", detail: "Right-click to assign.", usable: false };
  if (binding.type === "command") return { label: "Rest", detail: "Rest until fully recovered.", usable: true, command: { code: "rest", args: { count: -2 } } };
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
