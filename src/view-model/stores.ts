import type { KnownLevel, StoreSnapshot, StoreView, InputToken } from "../seams.js";
import { adaptItems, type ItemRow } from "./items.js";

/** `eligible` false greys a pack row out; `price` is the stock price or the one-item quote. */
export interface StoreRow { readonly key: number; readonly label: string; readonly quantity: number; readonly colour: string; readonly location?: string; readonly price?: number; readonly eligible: boolean }
export interface StoreModel { readonly token: InputToken; readonly index: number; readonly name: string; readonly owner: string; readonly home: boolean; readonly gold?: number; readonly ready: boolean; readonly noSelling: boolean; readonly transactionPrompts: boolean; readonly stock: readonly StoreRow[]; readonly pack: readonly StoreRow[]; readonly prompt: StoreSnapshot["prompt"] }
const same = (a: InputToken, b: InputToken): boolean => a.epoch === b.epoch && a.revision === b.revision;

// The store status read names the open store directly. Without it, the known
// cell at the player's position selects one of the copied town stores.
//
// transactionPrompts: core added snapshot().storeStatus in the same change that
// routes a mod's shop-buy and shop-sell through the live store menu, so the
// game's quantity prompt and price confirmation run before a trade. A present
// status is therefore the honest sign that Buy, Sell, Stash and Retrieve are
// safe. An older engine has no status, and its direct path skips both prompts.
export function adaptStore(snap: StoreSnapshot, known: KnownLevel | null): StoreModel | null {
  if (snap.phase !== "store" || !snap.core.stores || !snap.core.player || !snap.core.inventory) return null;
  const status = snap.storeStatus && same(snap.storeStatus.token, snap.token) ? snap.storeStatus : null;
  const cell = known && same(known.token, snap.token)
    ? known.cells.find((entry) => entry.x === snap.core.player!.grid.x && entry.y === snap.core.player!.grid.y) : null;
  const feat = status?.feat ?? cell?.remembered.feat;
  if (feat === undefined) return null;
  const index = snap.core.stores.findIndex((store) => store.feat === feat);
  if (index < 0) return null;
  const store: StoreView = snap.core.stores[index]!;
  const items = adaptItems(snap);
  // The status covers the pack only. Worn gear has no row, so it stays
  // selectable and the store's own check decides whether it buys it.
  const quotes = new Map(status?.inventory.map((entry) => [entry.handle, entry]));
  const pack: StoreRow[] = (items?.rows ?? []).map((item: ItemRow) => {
    const quote = quotes.get(item.handle);
    return { key: item.handle, label: item.label, quantity: item.quantity, colour: item.colour,
      location: item.location === "pack" ? "Pack" : "Equipment", eligible: quote?.eligible ?? true,
      ...(quote && quote.eligible && quote.price !== null ? { price: quote.price } : {}) };
  });
  return { token: snap.token, index, name: store.isHome ? "Home" : store.featName,
    owner: store.isHome ? "" : store.owner.name, home: store.isHome,
    ...(snap.core.player.gold === undefined ? {} : { gold: snap.core.player.gold }),
    ready: status?.ready ?? true, noSelling: status?.noSelling ?? false, transactionPrompts: status !== null,
    stock: store.stock.map((item) => ({ key: item.index, label: item.label, quantity: item.number,
      colour: item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit", eligible: true,
      ...(item.price === undefined ? {} : { price: item.price }) })), pack, prompt: snap.prompt };
}
