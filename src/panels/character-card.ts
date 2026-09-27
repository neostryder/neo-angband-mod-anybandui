import type { ViewModel } from "../view-model/protocol.js";
import { fraction, meter, node } from "./panel-host.js";

function stat(value: number): string { return value > 18 ? `18/${String(value - 18).padStart(2, "0")}` : String(value); }

export function renderCharacterCard(mount: HTMLElement, model: ViewModel): void {
  mount.replaceChildren();
  const p = model.player;
  node(mount, "div", "heading", [p.name || "Adventurer", [p.race, p.class].filter(Boolean).join(" "), p.title].filter(Boolean).join(" - ")).dataset.tip =
    [p.name || "Adventurer", `Race: ${p.race}`, `Class: ${p.class}`, p.title ? `Title: ${p.title}` : ""].filter(Boolean).join("\n");
  const grid = node(mount, "div", "grid");
  meter(grid, "HP", `${Math.max(0, p.hp)} / ${Math.max(0, p.max_hp)}`, fraction(p.hp, p.max_hp), "#a82630", `HP: ${Math.max(0, p.hp)} / ${Math.max(0, p.max_hp)}`);
  meter(grid, "SP", `${Math.max(0, p.sp)} / ${Math.max(0, p.max_sp)}`, fraction(p.sp, p.max_sp), "#244f9e", `SP: ${Math.max(0, p.sp)} / ${Math.max(0, p.max_sp)}`);
  if (p.food_max !== undefined) {
    const food = `${(p.food_max > 0 ? 100 * p.food / p.food_max : 0).toFixed(1)}% (${p.food})`;
    meter(grid, "Food", food, fraction(p.food, p.food_max), "#246b3b", food);
  } else {
    node(grid, "div", "metric", `Food ${p.food}`);
  }
  if (p.next_level_experience !== undefined) {
    const next = p.next_level_experience;
    const base = p.level_start_experience;
    const progress = next > 0 && base !== undefined ? fraction(p.experience - base, next - base) : 0;
    const value = next <= 0 ? "MAX" : base === undefined ? `${p.experience} - Lv ${p.level}` : `${Math.round(progress * 100)}% - Lv ${p.level}`;
    const tip = [`Level ${p.level}`, `Experience: ${p.experience}`, next <= 0 ? "Maximum level reached" : `Next level: ${next}\nRemaining: ${Math.max(0, next - p.experience)}`].join("\n");
    if (next <= 0 || base !== undefined) meter(grid, "XP", value, progress, "#8f5e1f", tip);
    else node(grid, "div", "metric", `XP ${value}`).dataset.tip = tip;
  } else {
    node(grid, "div", "metric", `XP ${p.experience} - Lv ${p.level}`);
  }
  if (p.stats.length) {
    const stats = node(mount, "div", "stats");
    for (const item of p.stats) {
      const cell = node(stats, "div", item.drained ? "drained" : "");
      node(cell, "div", "", `${item.label}${item.drained ? "*" : ""}`);
      node(cell, "div", "", stat(item.value));
      cell.dataset.tip = `${item.label}: ${stat(item.value)}`;
    }
  }
  const metrics = node(mount, "div", "metric-grid");
  for (const [label, value] of [["Gold", p.gold], ["Armour", p.armour], ["Speed", p.speed]] as const) {
    const tile = node(metrics, "div", "metric", label);
    node(tile, "b", "", String(value));
  }
  if (p.extra_moves) node(mount, "div", "", `Extra moves: ${p.extra_moves > 0 ? "+" : ""}${p.extra_moves}`);
}
