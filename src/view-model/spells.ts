import type { Phase4Context, Phase4Snapshot, SpellInspectResult, InputToken, ItemView, SpellbookView } from "../seams.js";

export interface SpellRow { readonly index: number; readonly name: string; readonly level: number; readonly mana: number; readonly fail: number; readonly state: string; readonly canCast: boolean; readonly canStudy: boolean; readonly description: string; readonly infoLine: string }
export interface BookRow { readonly key: string; readonly handle: number; readonly name: string; readonly chooseSpells: boolean; readonly spells: readonly SpellRow[] }
/** `learnable` is the game's own count of spells the character may learn now,
 * or null on an engine that does not report it. */
export interface SpellsModel { readonly token: InputToken; readonly books: readonly BookRow[]; readonly learnable: number | null }
export const sameToken = (a: InputToken, b: InputToken): boolean => a.epoch === b.epoch && a.revision === b.revision;
export const itemKey = (item: ItemView): string => item.kindId ?? `${item.tval}:${item.sval}`;

/** Which class book a carried item is. The engine's bookForItem answer wins
 * when it carries this wait's token. Without that read, an item class with one
 * class book is still unambiguous; with two, both books are skipped. */
function bookFor(snap: Phase4Snapshot, item: ItemView, books: readonly SpellbookView[], inspect?: Phase4Context["inspect"]): SpellbookView | null {
  if (!books.some((book) => book.tval === item.tval)) return null;
  if (inspect?.bookForItem) {
    let mapped: ReturnType<NonNullable<NonNullable<Phase4Context["inspect"]>["bookForItem"]>> = null;
    try { mapped = inspect.bookForItem(item.handle); } catch { mapped = null; }
    // A null answer means the class cannot cast from this item at all.
    if (!mapped || !sameToken(mapped.token, snap.token)) return null;
    return books[mapped.bookIndex] ?? null;
  }
  const siblings = books.filter((book) => book.tval === item.tval);
  return siblings.length === 1 ? siblings[0]! : null;
}

export function adaptSpells(snap: Phase4Snapshot, inspect?: Phase4Context["inspect"]): SpellsModel | null {
  const player = snap.core.player;
  if (!snap.core.spellbooks || !snap.core.inventory || !player) return null;
  const learnable = typeof player.learnableSpells === "number" ? player.learnableSpells : null;
  const books: BookRow[] = [];
  for (const item of snap.core.inventory) {
    const book = bookFor(snap, item, snap.core.spellbooks, inspect);
    // Two stacks of one book are one book to the panel and the quickbar.
    if (!book || books.some((entry) => entry.key === itemKey(item))) continue;
    const spells = book.spells.map((spell): SpellRow => {
      const info = inspect?.spellInfo?.(spell.sidx);
      const detail: SpellInspectResult | null = info && sameToken(info.token, snap.token) ? info : null;
      const canCast = !!detail?.canCastNow && spell.learned && !spell.forgotten;
      // Use the game's studyEligible flag when the engine sends it, and the old
      // level test otherwise. With no new spell slots the Study command fails
      // anyway, so no spell counts as learnable then.
      const eligible = spell.studyEligible ?? (!spell.learned && !spell.forgotten && spell.level <= (player.level ?? 0));
      const canStudy = eligible && learnable !== 0;
      return { index: spell.sidx, name: spell.name, level: spell.level, mana: detail?.mana ?? spell.mana,
        fail: detail?.failChance ?? spell.chance ?? spell.fail, canCast, canStudy,
        state: spell.forgotten ? "Forgotten" : spell.learned ? canCast ? "Castable" : "Unavailable" : canStudy ? "Learnable" : "Unknown",
        description: detail?.description ?? "Description unavailable.", infoLine: (spell.infoLine ?? "").trim() };
    });
    books.push({ key: itemKey(item), handle: item.handle, name: item.label, chooseSpells: player.classFlags?.includes("CHOOSE_SPELLS") ?? true, spells });
  }
  return { token: snap.token, books, learnable };
}
