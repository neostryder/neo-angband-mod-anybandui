/**
 * Pickup previews: what an item on the floor under the character would change
 * if it were worn, shown before it is picked up.
 *
 * The comparison read (compareLoadoutSlots) takes carried, worn and store items
 * only, so a floor item is simulated through the agent view's simulateLoadout
 * with the object itself. The object is found the way the snapshot's floorHere
 * list is built: the pile under the character, less anything only sensed, so a
 * row's floor index names the same object here.
 */
import type { GameObject, ModCoreApi } from "@rpgm-tools/neo-angband-core";
import type { Grid, InputToken, ItemsContext, LoadoutSimulation } from "./seams.js";
import type { ItemRow, ItemsModel } from "./view-model/items.js";
import { canSimulateLoadout, floorObject, listedFloorObject, simulateLoadout, viewInput } from "./host-adapter.js";

export type FloorCore = Pick<ModCoreApi, "floorPile" | "knownFloorObject">;
export type FloorState = Parameters<ModCoreApi["floorPile"]>[0];

/** The object behind a floor row: the pile at `grid` as the snapshot lists it, at `floorIndex`. */
export function floorObjectAt(core: FloorCore, state: FloorState, grid: Grid, floorIndex: number): GameObject | null {
  return listedFloorObject(core, state, grid, floorIndex);
}

/** The comparison for wearing a floor item, or null when nothing can be compared at this input wait. */
export function previewFloorItem(ctx: ItemsContext, token: InputToken, grid: Grid, floorIndex: number): LoadoutSimulation | null {
  const before = viewInput(ctx);
  if (!before || before.token.epoch !== token.epoch || before.token.revision !== token.revision) return null;
  let object: GameObject | null = null;
  try { object = floorObject(ctx, grid, floorIndex); } catch { object = null; }
  if (!object || !canSimulateLoadout(ctx)) return null;
  let sim: LoadoutSimulation | null = null;
  try { sim = simulateLoadout(ctx, { wield: [{ from: "object", object }] }); } catch { sim = null; }
  // A potion or a scroll has no body slot, so there is nothing to compare.
  return sim && !sim.unresolved.length && sim.placements.length ? sim : null;
}

/** How many of the same kind the character already carries, wears or holds in the quiver. */
export function carriedCount(model: Pick<ItemsModel, "rows" | "quiver">, item: Pick<ItemRow, "family">): number {
  return [...model.rows, ...(model.quiver ?? [])].filter((row) => row.family === item.family).reduce((sum, row) => sum + row.quantity, 0);
}

/** The line under a floor item about what is already carried. */
export function carriedText(count: number): string {
  return count === 0 ? "You carry none of these." : count === 1 ? "You already carry one of these." : `You already carry ${count} of these.`;
}
