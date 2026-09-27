import { applyTheme, THEMES } from "../theme.js";
import { validateSettings } from "../settings.js";
import type { ItemsContext, ItemPrompt, QuantityPrompt, LoadoutStats, AgentCommand } from "../seams.js";
import { AcquisitionChanges, adaptItems, compareItem, type ItemRow, type ItemsModel } from "../view-model/items.js";
import { answerItem, answerQuantity, buildItemCommand, quantityShortcut, submitItem } from "../item-interactions.js";

const CSS = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.items{position:absolute;right:12px;top:12px;width:min(440px,44vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 5px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}input[type=search]{width:100%}.tabs,.actions,.quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}table{width:100%;border-collapse:collapse}th{text-align:left;position:sticky;top:0;background:var(--anyband-surface)}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}tr.new{background:#437d5541}.row{width:100%;text-align:left;border:0;background:transparent}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer;font-weight:bold}.muted{opacity:.65}.gain{color:#80b891}.loss{color:#ff7559}.error{color:#ff7559}.prompt{border:1px solid var(--anyband-accent);padding:8px;margin:8px 0}`;
const ACTIONS = ["wield", "takeoff", "drop", "inscribe", "use"] as const;
const USE_CODES = ["activate", "use-staff", "aim-wand", "zap-rod", "eat", "quaff", "read"] as const;
const METRICS: readonly [keyof LoadoutStats, string, number][] = [["speed", "Speed", 1], ["ac", "Armour", 1], ["toH", "To hit", 1], ["toD", "To damage", 1], ["blows", "Blows", 100], ["shots", "Shots", 10], ["maxHp", "Max HP", 1], ["maxSp", "Max SP", 1], ["totalWeight", "Weight", 10]];
function el(parent: Element | ShadowRoot, tag: string, text?: string): HTMLElement { const child = parent.ownerDocument.createElement(tag); if (text !== undefined) child.textContent = text; parent.appendChild(child); return child; }
function button(parent: Element, label: string, action: () => void): HTMLButtonElement { const b = el(parent, "button", label) as HTMLButtonElement; b.type = "button"; b.addEventListener("click", action); return b; }
function same(a: { epoch: number; revision: number }, b: { epoch: number; revision: number }): boolean { return a.epoch === b.epoch && a.revision === b.revision; }

export function installItems(ctx: ItemsContext): () => void {
  const flags = ctx.flags ?? {};
  if (!Object.entries(flags).some(([key, on]) => key.startsWith("anybandui.items") && on && (key !== "anybandui.itemsRules" || !!ctx.inspect?.itemRules))) return () => {};
  if (!ctx.ui?.openPanel || !ctx.snapshot) { ctx.log("items: panel or snapshot seam unavailable"); return () => {}; }
  const panel = ctx.ui.openPanel({ id: "items", modal: false, label: "Items" });
  applyTheme(panel.root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
  el(panel.root, "style", CSS);
  const mount = el(panel.root, "section"); mount.className = "items";
  const changes = new AcquisitionChanges();
  let tab: "pack" | "equipment" | "quiver" = "pack";
  let search = "";
  let selected: number | null = null;
  let unchanged = false;
  let quantity = 1;
  let promptId = -1;
  let error = "";
  let signature = "";
  let closed = false;
  const enabled = (name: string): boolean => flags[`anybandui.items${name}`] === true;
  const read = (): ItemsModel | null => { const snap = ctx.snapshot?.(); return snap?.core ? adaptItems(snap) : null; };
  const usable = (model: ItemsModel, item: ItemRow, code: string): boolean => {
    const tester = ctx.inspect?.itemTester(code);
    return !!tester && same(tester.token, model.token) && tester.items.some((ref) => "handle" in ref && ref.handle === item.handle);
  };
  const act = (model: ItemsModel, item: ItemRow, code: string): void => {
    const latest = read();
    if (!latest || !same(latest.token, model.token) || latest.phase !== "play" || latest.prompt || !ctx.intent?.submit) { error = "Action unavailable at this input wait."; paint(true); return; }
    const actualCode = code === "use" ? USE_CODES.find((candidate) => usable(model, item, candidate)) : code;
    if (!actualCode) { error = "No usable command is available for this item."; paint(true); return; }
    const builders = ctx.core?.createAgentActions?.(ctx.state);
    let inscription: string | undefined;
    if (code === "inscribe") { const input = globalThis.prompt?.("Inscription", item.inscription ?? ""); if (input === null || input === undefined) return; inscription = input; }
    const command = buildItemCommand(builders, actualCode, item.handle, inscription);
    const result = submitItem(ctx.intent, ctx.inspect, model.token, actualCode, item.handle, command);
    error = result.accepted ? "" : result.reason ?? "Action rejected.";
    paint(true);
  };
  const showPrompt = (model: ItemsModel): void => {
    const prompt = model.prompt;
    if (!prompt || !ctx.prompt?.reply) return;
    if (prompt.kind === "quantity" && enabled("Quantity")) {
      const q = prompt as QuantityPrompt;
      if (promptId !== q.promptId) { promptId = q.promptId; quantity = q.defaultValue; }
      const box = el(mount, "section"); box.className = "prompt";
      el(box, "h3", "Choose quantity"); el(box, "p", q.label); el(box, "p", `Available for this action: ${q.max}`);
      const input = el(box, "input") as HTMLInputElement; input.type = "number"; input.min = String(q.min); input.max = String(q.max); input.value = String(quantity);
      input.addEventListener("input", () => { quantity = Number(input.value); });
      const quick = el(box, "div"); quick.className = "quick";
      for (const label of ["One", "Half", "All"] as const) button(quick, label, () => { quantity = quantityShortcut(q, label); input.value = String(quantity); });
      button(box, "Confirm", () => { const result = answerQuantity(ctx.prompt, q, quantity); error = result.accepted ? "" : result.reason ?? "Prompt rejected."; paint(true); });
    } else if (prompt.kind === "item" && enabled("Choice")) {
      const p = prompt as ItemPrompt;
      if (promptId !== p.promptId) { promptId = p.promptId; selected = p.choices[0]?.handle ?? null; }
      const box = el(mount, "section"); box.className = "prompt";
      el(box, "h3", "Angband asks"); el(box, "p", p.label);
      const table = el(box, "table"); const head = el(table, "tr"); for (const name of ["Key", "Item", "Location", "Qty"]) el(head, "th", name);
      for (const choice of p.choices) {
        const item = model.rows.find((row) => row.handle === choice.handle);
        const row = el(table, "tr"); el(row, "td", choice.letter);
        const cell = el(row, "td"); button(cell, choice.label, () => { selected = choice.handle; paint(true); });
        el(row, "td", item?.location ?? "Floor"); el(row, "td", item ? String(item.quantity) : "");
      }
      const current = p.choices.find((choice) => choice.handle === selected);
      if (current && selected !== null) { const inspection = ctx.inspect?.inspectItem(selected); if (inspection && same(inspection.token, model.token)) el(box, "p", inspection.text); }
      const choose = button(box, "Choose", () => { if (current) { const result = answerItem(ctx.prompt, p, current.handle); error = result.accepted ? "" : result.reason ?? "Prompt rejected."; paint(true); } }); choose.disabled = !current;
    }
  };
  const showComparison = (model: ItemsModel, item: ItemRow): void => {
    if (!enabled("Comparison") || item.location !== "pack") return;
    const sim = compareItem(ctx, model.token, item.handle);
    if (!sim || sim.unresolved.length) return;
    const details = el(mount, "details") as HTMLDetailsElement; details.open = true; el(details, "summary", "Equipment comparison");
    if (!sim.placements.length) { el(details, "p", "No compatible equipment slot."); return; }
    const placement = sim.placements[0]!;
    el(details, "p", `Replacing: ${placement.displaced?.label ?? "empty slot"}`);
    el(details, "p", "Known properties only; unidentified effects may differ.");
    const toggle = el(details, "input") as HTMLInputElement; toggle.type = "checkbox"; toggle.checked = unchanged;
    toggle.addEventListener("change", () => { unchanged = toggle.checked; paint(true); }); el(details, "span", " Show unchanged stats");
    const table = el(details, "table"); const head = el(table, "tr"); for (const label of ["Stat", "Current", "Selected", "Change"]) el(head, "th", label);
    for (const [key, label, scale] of METRICS) {
      const before = sim.before.stats[key] as number; const after = sim.after.stats[key] as number; const delta = after - before;
      if (!unchanged && !delta && !["speed", "ac", "blows"].includes(key)) continue;
      const row = el(table, "tr"); el(row, "td", label); el(row, "td", String(before / scale)); el(row, "td", String(after / scale));
      const change = el(row, "td", delta ? `${delta > 0 ? "+" : ""}${delta / scale}` : "-"); change.className = delta === 0 ? "muted" : key === "totalWeight" ? delta < 0 ? "gain" : "loss" : delta > 0 ? "gain" : "loss";
    }
    for (const [index, name] of ["STR", "INT", "WIS", "DEX", "CON"].entries()) {
      const before = sim.before.stats.statUse[index], after = sim.after.stats.statUse[index]; if (before === undefined || after === undefined || (!unchanged && before === after)) continue;
      const row = el(table, "tr"); for (const value of [name, String(before), String(after), after === before ? "-" : `${after > before ? "+" : ""}${after - before}`]) el(row, "td", value);
    }
    el(details, "h4", "Resistances & abilities");
    sim.after.stats.resists.forEach((after, index) => { const before = sim.before.stats.resists[index] ?? 0; if (unchanged || after !== before) el(details, "div", `${sim.after.stats.resistElements[index] ?? index}: ${before} -> ${after}`); });
    for (const flag of new Set([...sim.before.stats.objectFlags, ...sim.after.stats.objectFlags])) { const before = sim.before.stats.objectFlags.includes(flag), after = sim.after.stats.objectFlags.includes(flag); if (unchanged || before !== after) el(details, "div", `${flag}: ${before ? "Yes" : "No"} -> ${after ? "Yes" : "No"}`); }
  };
  const paint = (force = false): void => {
    if (closed || !panel.root.isConnected) return;
    const model = read();
    const next = JSON.stringify([model, tab, search, selected, unchanged, quantity, error]);
    if (!force && next === signature) return; signature = next;
    mount.replaceChildren();
    el(mount, "h2", "Items");
    if (!model) { el(mount, "p", "Inventory read unavailable."); return; }
    if (enabled("Highlights")) changes.update(model);
    showPrompt(model);
    if (enabled("Rules") && ctx.inspect?.itemRules) {
      const rules = ctx.inspect.itemRules;
      const section = el(mount, "details") as HTMLDetailsElement; el(section, "summary", "Item rules");
      for (const rule of rules.list()) {
        const line = el(section, "div"); el(line, "span", `${rule.kind}: ${rule.label} `);
        button(line, "Remove", () => { const result = rules.remove(rule.id); error = result.accepted ? "" : result.reason ?? "Rule removal rejected."; paint(true); });
      }
    }
    if (!enabled("Lists")) return;
    const tabs = el(mount, "div"); tabs.className = "tabs";
    for (const name of ["pack", "equipment", "quiver"] as const) { const b = button(tabs, name[0]!.toUpperCase() + name.slice(1), () => { tab = name; paint(true); }); b.setAttribute("aria-pressed", String(tab === name)); }
    const searchBox = el(mount, "input") as HTMLInputElement; searchBox.type = "search"; searchBox.placeholder = "Search items"; searchBox.value = search;
    searchBox.addEventListener("input", () => { search = searchBox.value; paint(true); mount.querySelector<HTMLInputElement>("input[type=search]")?.focus(); });
    const rows = model.rows.filter((item) => item.location === tab && item.label.toLowerCase().includes(search.toLowerCase()));
    if (!rows.length) el(mount, "p", tab === "pack" ? "Your pack is empty." : tab === "equipment" ? "Nothing equipped." : "No quiver items available.");
    const table = el(mount, "table"); const head = el(table, "tr"); for (const name of tab === "equipment" ? ["Item", "Slot", "Qty"] : ["Item", "Qty"]) el(head, "th", name);
    for (const item of rows) {
      const row = el(table, "tr"); const badge = enabled("Highlights") ? changes.badge(item) : null; if (badge) row.className = "new";
      const cell = el(row, "td"); const b = button(cell, `${item.label}${badge ? ` ${badge}` : ""}`, () => { selected = item.handle; changes.acknowledge(item); paint(true); }); b.className = "row"; b.style.color = item.colour; b.title = [badge === "NEW" ? "Newly acquired" : badge ? `${badge.slice(1)} acquired` : "", item.inscription ? `Inscription: ${item.inscription}` : ""].filter(Boolean).join("\n");
      if (tab === "equipment") el(row, "td", String(item.slot ?? "")); el(row, "td", String(item.quantity));
    }
    const item = model.rows.find((row) => row.handle === selected);
    if (item) {
      el(mount, "h3", "Inspection"); el(mount, "strong", item.label);
      if (enabled("Actions") && model.phase === "play" && !model.prompt && ctx.intent?.submit) {
        const actions = el(mount, "div"); actions.className = "actions";
        for (const code of ACTIONS) { if (code === "use" ? USE_CODES.some((candidate) => usable(model, item, candidate)) : usable(model, item, code)) button(actions, code, () => act(model, item, code)); }
      }
      showComparison(model, item);
      if (enabled("Inspection")) { const inspection = ctx.inspect?.inspectItem(item.handle); if (inspection && same(inspection.token, model.token)) { const details = el(mount, "details") as HTMLDetailsElement; details.open = true; el(details, "summary", inspection.title); el(details, "p", inspection.text); } }
    }
    if (error) { const message = el(mount, "p", error); message.className = "error"; }
  };
  paint(true);
  const timer = globalThis.setInterval(() => paint(), 200);
  void panel.closed.then(() => { closed = true; globalThis.clearInterval(timer); });
  return () => { closed = true; globalThis.clearInterval(timer); panel.close(); };
}
