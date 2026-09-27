import type { LoadoutSimulation, LoadoutStats } from "../seams.js";

const METRICS: readonly [keyof LoadoutStats, string, number][] = [["speed", "Speed", 1], ["ac", "Armour", 1], ["toH", "To hit", 1], ["toD", "To damage", 1], ["blows", "Blows", 100], ["shots", "Shots", 10], ["maxHp", "Max HP", 1], ["maxSp", "Max SP", 1], ["totalWeight", "Weight", 10]];
const tip = "Whole-character preview. The replaced item stays in your pack; an item from outside your belongings adds its weight.";
function readableFlag(flag: string): string {
  const words = flag.replace(/^(OF|OBJ_MOD|ELEM)_/, "").replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function el(parent: Element, tag: string, value?: string): HTMLElement {
  const node = parent.ownerDocument.createElement(tag);
  if (value !== undefined) node.textContent = value;
  parent.appendChild(node);
  return node;
}

// Shared by the item and store panels so their known-property preview stays identical.
export function renderItemComparison(parent: Element, sim: LoadoutSimulation, unchanged: boolean, toggle: (value: boolean) => void): void {
  if (sim.unresolved.length) return;
  const details = el(parent, "details") as HTMLDetailsElement;
  details.open = true;
  el(details, "summary", "Equipment comparison");
  if (!sim.placements.length) { el(details, "p", "No compatible equipment slot."); return; }
  const placement = sim.placements[0]!;
  el(details, "p", `Replacing: ${placement.displaced?.label ?? "empty slot"}`);
  el(details, "p", "Known properties only; unidentified effects may differ.");
  const checkbox = el(details, "input") as HTMLInputElement;
  checkbox.type = "checkbox";
  checkbox.checked = unchanged;
  checkbox.addEventListener("change", () => toggle(checkbox.checked));
  el(details, "span", " Show unchanged stats");
  const table = el(details, "table");
  const head = el(table, "tr");
  for (const label of ["Stat", "Current", "Selected", "Change"]) el(head, "th", label);
  for (const [key, label, scale] of METRICS) {
    const before = sim.before.stats[key] as number;
    const after = sim.after.stats[key] as number;
    const delta = after - before;
    if (!unchanged && !delta && !["speed", "ac", "blows"].includes(key)) continue;
    const row = el(table, "tr");
    const name = el(row, "td", label);
    name.title = tip;
    el(row, "td", String(before / scale));
    el(row, "td", String(after / scale));
    const change = el(row, "td", delta ? `${delta > 0 ? "+" : ""}${delta / scale}` : "-");
    change.className = delta === 0 ? "muted" : key === "totalWeight" ? delta < 0 ? "gain" : "loss" : delta > 0 ? "gain" : "loss";
  }
  for (const [index, name] of ["STR", "INT", "WIS", "DEX", "CON"].entries()) {
    const before = sim.before.stats.statUse[index], after = sim.after.stats.statUse[index];
    if (before === undefined || after === undefined || (!unchanged && before === after)) continue;
    const row = el(table, "tr");
    for (const value of [name, String(before), String(after), after === before ? "-" : `${after > before ? "+" : ""}${after - before}`]) el(row, "td", value);
  }
  el(details, "h4", "Resistances and abilities");
  sim.after.stats.resists.forEach((after, index) => {
    const before = sim.before.stats.resists[index] ?? 0;
    if (unchanged || after !== before) el(details, "div", `${sim.after.stats.resistElements[index] ?? `Element ${index + 1}`}: ${before} to ${after}`);
  });
  for (const flag of new Set([...sim.before.stats.objectFlags, ...sim.after.stats.objectFlags])) {
    const before = sim.before.stats.objectFlags.includes(flag), after = sim.after.stats.objectFlags.includes(flag);
    if (unchanged || before !== after) el(details, "div", `${readableFlag(flag)}: ${before ? "Yes" : "No"} to ${after ? "Yes" : "No"}`);
  }
}
