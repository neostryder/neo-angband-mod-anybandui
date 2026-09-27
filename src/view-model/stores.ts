import type { InputSnapshot, KnownLevel, StoreStatus, StoreView, InputToken } from "../seams.js";
import { adaptItems, type ItemRow } from "./items.js";

export interface StoreRow { readonly key: number; readonly label: string; readonly quantity: number; readonly colour: string; readonly location?: string; readonly price?: number; readonly eligible: boolean }
export interface StoreModel { readonly token: InputToken; readonly index: number; readonly name: string; readonly owner: string; readonly home: boolean; readonly gold?: number; readonly ready: boolean; readonly noSelling: boolean; readonly transactionPrompts: boolean; readonly stock: readonly StoreRow[]; readonly pack: readonly StoreRow[]; readonly prompt: InputSnapshot["prompt"] }
const same = (a: InputToken, b: InputToken): boolean => a.epoch === b.epoch && a.revision === b.revision;

// The known cell at the player's position selects one of the copied town stores.
// A future store status seam can provide readiness and eligibility, which are
// not part of the current snapshot.
export function adaptStore(snap: InputSnapshot, known: KnownLevel | null, status: StoreStatus | null): StoreModel | null {
  if (snap.phase !== "store" || !snap.core.stores || !snap.core.player || !snap.core.inventory) return null;
  const cell = known && same(known.token, snap.token)
    ? known.cells.find((entry) => entry.x === snap.core.player!.grid.x && entry.y === snap.core.player!.grid.y) : null;
  const feat = status?.feat ?? cell?.remembered.feat;
  if (feat === undefined) return null;
  const index = snap.core.stores.findIndex((store) => store.feat === feat);
  if (index < 0) return null;
  const store: StoreView = snap.core.stores[index]!;
  const items = adaptItems(snap);
  const eligibility = new Map(status?.inventory?.map((entry) => [entry.handle, entry]));
  const pack: StoreRow[] = (items?.rows ?? [])
    .filter((item) => eligibility.get(item.handle)?.eligible !== false)
    .map((item: ItemRow) => ({ key: item.handle, label: item.label, quantity: item.quantity, colour: item.colour,
      location: item.location === "pack" ? "Pack" : "Equipment", eligible: eligibility.get(item.handle)?.eligible ?? true,
      ...(eligibility.get(item.handle)?.price === undefined ? {} : { price: eligibility.get(item.handle)!.price }) }));
  return { token: snap.token, index, name: store.isHome ? "Home" : store.featName,
    owner: store.isHome ? "" : store.owner.name, home: store.isHome,
    ...(snap.core.player.gold === undefined ? {} : { gold: snap.core.player.gold }),
    ready: status?.ready ?? true, noSelling: status?.noSelling ?? false, transactionPrompts: status?.transactionPrompts === true,
    stock: store.stock.map((item) => ({ key: item.index, label: item.label, quantity: item.number,
      colour: item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit", eligible: true,
      ...(item.price === undefined ? {} : { price: item.price }) })), pack, prompt: snap.prompt };
}
