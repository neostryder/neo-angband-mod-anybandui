import type { InputSnapshot, ItemPanelSnapshot, ItemView, ItemsContext, ItemPanelContext, LoadoutSimulation, LoadoutSlotsResult, InputToken, PanelItemView, EquipmentSlotView, Grid } from "../seams.js";

export type ItemLocation = "pack" | "equipment" | "quiver" | "floor";
export interface ItemRow {
  readonly handle: number;
  /** A stable identity for selection and change marks: the gear key, which survives
   * a letter change, or the floor index and kind for an object on the floor. */
  readonly key: string;
  readonly label: string; readonly quantity: number; readonly location: ItemLocation;
  readonly slot?: number; readonly slotName?: string; readonly floorIndex?: number;
  readonly colour: string; readonly inscription: string | null; readonly family: string;
}
export interface ItemsModel {
  readonly token: InputToken; readonly phase: InputSnapshot["phase"]; readonly prompt: InputSnapshot["prompt"];
  /** Pack then worn items. The store window reads this list, so it keeps that shape. */
  readonly rows: readonly ItemRow[];
  /** Null when the engine does not publish the quiver. */
  readonly quiver: readonly ItemRow[] | null;
  /** The pile under the character, or null when the floor read is absent. */
  readonly floor: readonly ItemRow[] | null;
  readonly player: Grid | null;
}

// The 28 named rows of core color.ts COLOR_TABLE (z-color.c color_table). nameColor
// carries object_base.txt's graphics name, such as "light umber", or the "slate"
// core uses for a book this class cannot read. White and dark follow the panel's
// own text colour, so a light theme keeps them readable.
const NAME_COLOURS: Readonly<Record<string, string>> = {
  slate: "#808080", orange: "#ff8000", red: "#c00000", green: "#008040", blue: "#0040ff", umber: "#804000",
  "light dark": "#606060", "light slate": "#c0c0c0", "light purple": "#ff00ff", yellow: "#ffff00", "light red": "#ff4040",
  "light green": "#00ff00", "light blue": "#00ffff", "light umber": "#c08040", purple: "#900090", violet: "#9020ff",
  teal: "#00a0a0", mud: "#6c6c30", "light yellow": "#ffff90", "magenta pink": "#ff00a0", "light teal": "#20ffdc",
  "light violet": "#b8a8ff", "light pink": "#ff8080", mustard: "#b4b400", "blue slate": "#a0c0d0", "deep light blue": "#00b0ff",
};
// The pref-file attr letters from the same table, for an engine that reports one.
const ATTR_LETTERS: Readonly<Record<string, string>> = {
  s: "slate", o: "orange", r: "red", g: "green", b: "blue", u: "umber", D: "light dark", W: "light slate", P: "light purple",
  y: "yellow", R: "light red", G: "light green", B: "light blue", U: "light umber", p: "purple", v: "violet", t: "teal",
  m: "mud", Y: "light yellow", i: "magenta pink", T: "light teal", V: "light violet", I: "light pink", M: "mustard",
  z: "blue slate", Z: "deep light blue",
};

/** The CSS colour for an item name, from the engine's nameColor when it has one. */
export function itemColour(item: PanelItemView): string {
  const raw = item.nameColor;
  if (raw) {
    const name = raw.length === 1 ? ATTR_LETTERS[raw] : raw.toLowerCase().replace(/[-_]+/g, " ").trim();
    if (name === "white" || name === "dark" || raw === "w" || raw === "d") return "inherit";
    const colour = name ? NAME_COLOURS[name] : undefined;
    if (colour) return colour;
  }
  // An engine without nameColor: mark artifacts and egos, as before the field existed.
  return item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit";
}

function slotLabel(slots: readonly EquipmentSlotView[] | null | undefined, slot: number): string | undefined {
  const name = slots?.[slot]?.name;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : undefined;
}

export function adaptItems(snap: InputSnapshot | ItemPanelSnapshot): ItemsModel | null {
  const core = (snap as ItemPanelSnapshot).core;
  if (!core.inventory || !core.equipment) return null;
  const row = (item: PanelItemView, location: ItemLocation, extra: { slot?: number; floorIndex?: number } = {}): ItemRow => {
    const family = item.kindKey ?? item.kindId ?? `${item.tval}:${item.sval}`;
    const slotName = extra.slot === undefined ? undefined : slotLabel(core.equipmentSlots, extra.slot);
    return {
      handle: item.handle,
      key: location === "floor" ? `floor:${extra.floorIndex}:${family}` : item.itemKey ?? `gear:${item.handle}`,
      label: item.label, quantity: item.number, location,
      ...(extra.slot === undefined ? {} : { slot: extra.slot }), ...(slotName === undefined ? {} : { slotName }),
      ...(extra.floorIndex === undefined ? {} : { floorIndex: extra.floorIndex }),
      colour: itemColour(item), inscription: item.inscription, family,
    };
  };
  return { token: snap.token, phase: snap.phase, prompt: snap.prompt,
    rows: [...core.inventory.map((item) => row(item, "pack")),
      ...core.equipment.flatMap((item, slot) => item ? [row(item, "equipment", { slot })] : [])],
    quiver: core.quiver ? core.quiver.map((item) => row(item, "quiver")) : null,
    floor: core.floorHere ? core.floorHere.map((item, floorIndex) => row(item, "floor", { floorIndex })) : null,
    player: core.player?.grid ? { x: core.player.grid.x, y: core.player.grid.y } : null };
}

/** Every row the panel can list: pack, equipment, quiver, then the floor. */
export function panelRows(model: ItemsModel): readonly ItemRow[] {
  return [...model.rows, ...(model.quiver ?? []), ...(model.floor ?? [])];
}

export function compareItem(ctx: ItemsContext, token: InputToken, handle: number | { store: number; index: number }): LoadoutSimulation | null {
  if (!ctx.core?.createAgentView || !ctx.state) return null;
  const before = ctx.snapshot?.();
  if (!before || before.token.epoch !== token.epoch || before.token.revision !== token.revision) return null;
  const ref = typeof handle === "number" ? { from: "gear" as const, handle } : { from: "store" as const, ...handle };
  return ctx.core.createAgentView(ctx.state).simulateLoadout?.({ wield: [ref] }) ?? null;
}

export type SlotComparisons = LoadoutSlotsResult["slots"];

/** One comparison per body slot that could hold the item. compareLoadoutSlots answers
 * both slots of a pair, so a ring can be compared against either hand; an engine
 * without it falls back to simulateLoadout, which answers the slot the game picks. */
export function compareSlots(ctx: ItemPanelContext, token: InputToken, handle: number | { store: number; index: number }): SlotComparisons | null {
  const same = (other: InputToken): boolean => other.epoch === token.epoch && other.revision === token.revision;
  if (ctx.inspect?.compareLoadoutSlots) {
    const ref = typeof handle === "number" ? { from: "gear" as const, handle } : { from: "store" as const, ...handle };
    let result: LoadoutSlotsResult | null = null;
    // The read throws when a domain it needs is not granted; that is a decline.
    try { result = ctx.inspect.compareLoadoutSlots(ref); } catch { result = null; }
    if (result) return same(result.token) ? result.slots : null;
  }
  const sim = compareItem(ctx as unknown as ItemsContext, token, handle);
  if (!sim) return null;
  const placement = sim.placements[0];
  if (!placement || sim.unresolved.length) return [];
  const slots = ctx.snapshot?.()?.core.equipmentSlots;
  return [{ slot: placement.slot, name: slots?.[placement.slot]?.name ?? "", comparison: sim }];
}

/** The slot a fresh comparison starts on: the one the game's wield_slot would fill,
 * which is the first empty compatible slot, or else the first compatible slot. */
export function defaultSlot(slots: SlotComparisons): number | null {
  const empty = slots.find((entry) => entry.comparison.placements.some((placement) => placement.slot === entry.slot && !placement.displaced));
  return (empty ?? slots[0])?.slot ?? null;
}

export class AcquisitionChanges {
  private previous = new Map<string, number>();
  private families = new Map<string, number>();
  private pending = new Map<string, { amount: number; fresh: boolean }>();
  private epoch: number | undefined;
  // The first look at a game only records what is carried, as upstream's
  // InventoryChanges does, so a loaded character's pack is not all marked new.
  private initialized = false;
  private reset(): void { this.previous.clear(); this.families.clear(); this.pending.clear(); this.initialized = false; }
  update(model: ItemsModel): void {
    if (model.phase !== "play" && model.phase !== "store") { this.reset(); this.epoch = undefined; return; }
    if (this.epoch !== model.token.epoch) { this.reset(); this.epoch = model.token.epoch; }
    const current = new Map<string, number>();
    const totals = new Map<string, number>();
    const familyOf = new Map<string, string>();
    // The quiver counts as carried, so ammunition moving between pack and quiver is
    // not a gain, while arrows picked up straight into the quiver are.
    for (const item of [...model.rows, ...(model.quiver ?? [])]) {
      if (!item.handle) continue;
      const key = this.keyOf(item);
      const count = Math.max(0, item.quantity);
      current.set(key, (current.get(key) ?? 0) + count);
      totals.set(item.family, (totals.get(item.family) ?? 0) + count);
      familyOf.set(key, item.family);
    }
    if (this.initialized) {
      const gains = new Map([...totals].map(([family, count]) => [family, Math.max(0, count - (this.families.get(family) ?? 0))]));
      for (const [key, count] of current) {
        const family = familyOf.get(key)!;
        const before = this.previous.get(key) ?? 0;
        // Only a real increase in what is owned marks a stack; a move or a merge
        // leaves the family total unchanged.
        const added = Math.min(Math.max(0, count - before), gains.get(family) ?? 0);
        if (added > 0) {
          const entry = this.pending.get(key);
          this.pending.set(key, { amount: (entry?.amount ?? 0) + added, fresh: (entry?.fresh ?? false) || before === 0 });
          gains.set(family, (gains.get(family) ?? 0) - added);
        }
      }
    }
    for (const [key, value] of this.pending) {
      const count = current.get(key) ?? 0;
      if (!count) this.pending.delete(key);
      else if (value.amount > count) this.pending.set(key, { ...value, amount: count });
    }
    this.previous = current; this.families = totals; this.initialized = true;
  }
  badge(item: ItemRow): string | null { const entry = this.pending.get(this.keyOf(item)); return entry ? entry.fresh ? "NEW" : `+${entry.amount}` : null; }
  acknowledge(item: ItemRow): void { this.pending.delete(this.keyOf(item)); }
  // The kind key and the gear key: a stack keeps its mark when its letter changes,
  // and a handle reused for another kind is a new item.
  private keyOf(item: ItemRow): string { return `${item.family}|${item.key}`; }
}
