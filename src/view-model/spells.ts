import type { Phase4Context, Phase4Snapshot, SpellInspectResult, InputToken, ItemView } from "../seams.js";

export interface SpellRow { readonly index: number; readonly name: string; readonly level: number; readonly mana: number; readonly fail: number; readonly state: string; readonly canCast: boolean; readonly canStudy: boolean; readonly description: string }
export interface BookRow { readonly key: string; readonly handle: number; readonly name: string; readonly chooseSpells: boolean; readonly spells: readonly SpellRow[] }
export interface SpellsModel { readonly token: InputToken; readonly books: readonly BookRow[] }
export const sameToken = (a: InputToken, b: InputToken): boolean => a.epoch === b.epoch && a.revision === b.revision;
export const itemKey = (item: ItemView): string => item.kindId ?? `${item.tval}:${item.sval}`;

export function adaptSpells(snap: Phase4Snapshot, inspect?: Phase4Context["inspect"]): SpellsModel | null {
  if (!snap.core.spellbooks || !snap.core.inventory || !snap.core.player) return null;
  const books: BookRow[] = [];
  for (const book of snap.core.spellbooks) for (const item of snap.core.inventory) {
    if (item.tval !== book.tval) continue;
    // Core publishes only a book's tval, so ambiguous books need an item-to-book inspection seam.
    const siblings = snap.core.spellbooks.filter((entry) => entry.tval === book.tval);
    if (siblings.length !== 1 && inspect?.bookForItem?.(item.handle) !== book.spells[0]?.bidx) continue;
    const spells = book.spells.map((spell): SpellRow => {
      const info = inspect?.spellInfo?.(spell.sidx);
      const detail: SpellInspectResult | null = info && sameToken(info.token, snap.token) ? info : null;
      const canCast = !!detail?.canCastNow && spell.learned && !spell.forgotten;
      const canStudy = !spell.learned && !spell.forgotten && spell.level <= (snap.core.player?.level ?? 0);
      return { index: spell.sidx, name: spell.name, level: spell.level, mana: detail?.mana ?? spell.mana,
        fail: detail?.failChance ?? spell.chance ?? spell.fail, canCast, canStudy,
        state: spell.forgotten ? "Forgotten" : spell.learned ? canCast ? "Castable" : "Unavailable" : canStudy ? "Learnable" : "Unknown",
        description: detail?.description ?? "Description unavailable." };
    });
    books.push({ key: itemKey(item), handle: item.handle, name: item.label, chooseSpells: snap.core.player.classFlags?.includes("CHOOSE_SPELLS") ?? true, spells });
  }
  return { token: snap.token, books };
}
