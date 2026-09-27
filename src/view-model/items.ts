import type { InputSnapshot, ItemView, ItemsContext, LoadoutSimulation, InputToken } from "../seams.js";

export interface ItemRow { readonly handle: number; readonly label: string; readonly quantity: number; readonly location: "pack" | "equipment"; readonly slot?: number; readonly colour: string; readonly inscription: string | null; readonly family: string }
export interface ItemsModel { readonly token: InputToken; readonly phase: InputSnapshot["phase"]; readonly prompt: InputSnapshot["prompt"]; readonly rows: readonly ItemRow[] }

// The snapshot lacks native palette indices and slot labels. Use known item facts
// and neutral theme colours until those display fields are published by core.
export function adaptItems(snap: InputSnapshot): ItemsModel | null {
  if (!snap.core.inventory || !snap.core.equipment) return null;
  const row = (item: ItemView, location: ItemRow["location"], slot?: number): ItemRow => ({
    handle: item.handle, label: item.label, quantity: item.number, location,
    ...(slot === undefined ? {} : { slot }), colour: item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit",
    inscription: item.inscription, family: item.kindId ?? `${item.tval}:${item.sval}`,
  });
  return { token: snap.token, phase: snap.phase, prompt: snap.prompt,
    rows: [...snap.core.inventory.map((item) => row(item, "pack")),
      ...snap.core.equipment.flatMap((item, slot) => item ? [row(item, "equipment", slot)] : [])] };
}

export function compareItem(ctx: ItemsContext, token: InputToken, handle: number | { store: number; index: number }): LoadoutSimulation | null {
  if (!ctx.core?.createAgentView || !ctx.state) return null;
  const before = ctx.snapshot?.();
  if (!before || before.token.epoch !== token.epoch || before.token.revision !== token.revision) return null;
  const ref = typeof handle === "number" ? { from: "gear" as const, handle } : { from: "store" as const, ...handle };
  return ctx.core.createAgentView(ctx.state).simulateLoadout?.({ wield: [ref] }) ?? null;
}

export class AcquisitionChanges {
  private previous = new Map<string, number>();
  private pending = new Map<string, { amount: number; fresh: boolean }>();
  private epoch: number | undefined;
  update(model: ItemsModel): void {
    if (model.phase !== "play" && model.phase !== "store") { this.previous.clear(); this.pending.clear(); this.epoch = undefined; return; }
    if (this.epoch !== model.token.epoch) { this.previous.clear(); this.pending.clear(); this.epoch = model.token.epoch; }
    const current = new Map<string, number>();
    const family = new Map<string, number>();
    for (const item of model.rows) {
      if (!item.handle) continue;
      const key = `${item.family}:${item.handle}`;
      current.set(key, (current.get(key) ?? 0) + Math.max(0, item.quantity));
      family.set(item.family, (family.get(item.family) ?? 0) + Math.max(0, item.quantity));
    }
    const previousFamily = new Map<string, number>();
    for (const [key, count] of this.previous) {
      const name = key.slice(0, key.lastIndexOf(":"));
      previousFamily.set(name, (previousFamily.get(name) ?? 0) + count);
    }
    for (const [key, count] of current) {
      const name = key.slice(0, key.lastIndexOf(":"));
      const added = Math.min(Math.max(0, count - (this.previous.get(key) ?? 0)), Math.max(0, (family.get(name) ?? 0) - (previousFamily.get(name) ?? 0)));
      if (added) this.pending.set(key, { amount: Math.min(count, (this.pending.get(key)?.amount ?? 0) + added), fresh: (this.previous.get(key) ?? 0) === 0 });
    }
    for (const [key, value] of this.pending) {
      const count = current.get(key) ?? 0;
      if (!count) this.pending.delete(key);
      else if (value.amount > count) this.pending.set(key, { ...value, amount: count });
    }
    this.previous = current;
  }
  badge(item: ItemRow): string | null { const entry = this.pending.get(`${item.family}:${item.handle}`); return entry ? entry.fresh ? "NEW" : `+${entry.amount}` : null; }
  acknowledge(item: ItemRow): void { this.pending.delete(`${item.family}:${item.handle}`); }
}
