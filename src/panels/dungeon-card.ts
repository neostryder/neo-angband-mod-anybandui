import type { ViewModel } from "../view-model/protocol.js";
import { node } from "./panel-host.js";

export function renderDungeonCard(mount: HTMLElement, model: ViewModel): void {
  mount.replaceChildren();
  node(mount, "div", "heading", "Dungeon");
  const p = model.player;
  const d = model.dungeon;
  const grid = node(mount, "div", "grid");
  for (const [label, value, tip] of [["Depth", String(d.depth), `Depth: ${d.depth_feet} feet`], ["Light", String(d.light), ""], ["Feel", d.feeling || "?", d.feeling_description ?? ""], ["", d.floor ?? "", ""]]) {
    const tile = node(grid, "div", "metric", label);
    node(tile, "b", "", value);
    if (tip) tile.dataset.tip = tip;
  }
  for (const [condition, label] of [[p.trap_detected, "Trap-detected area"], [p.recall, "Recall pending"], [p.descent, "Descent pending"], [p.resting, "Resting"], [p.running, "Running"], [p.repeat, `Repeating: ${p.repeat}`], [p.unignoring, "Showing ignored items"]] as const) {
    if (condition) node(mount, "div", "", label);
  }
}
