import { applyTheme, THEMES } from "../theme.js";
import { validateSettings } from "../settings.js";
import type { InputSnapshot, StoreContext, StoreStatus, QuantityPrompt } from "../seams.js";
import { adaptStore, type StoreModel, type StoreRow } from "../view-model/stores.js";
import { compareItem } from "../view-model/items.js";
import { renderItemComparison } from "./item-comparison.js";
import { playerIsDriving } from "../input-owner.js";

const CSS = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.store{position:absolute;inset:12px;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}.sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.side{min-width:0;overflow:auto}h2,h3{color:var(--anyband-accent);border-bottom:1px solid var(--anyband-accent)}table{width:100%;border-collapse:collapse}th{text-align:left}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}button,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}button{cursor:pointer}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}.row{width:100%;text-align:left;border:0;background:transparent}.row[aria-pressed=true]{background:var(--anyband-accent);color:var(--anyband-background)!important}.actions{display:flex;gap:6px;margin:6px 0}.prompt{border:1px solid var(--anyband-accent);padding:8px;max-width:30em}.prompt input{width:100%}.muted{opacity:.65}.gain{color:#80b891}.loss,.error,.unaffordable{color:#ff7559}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer}@media(max-width:650px){.sides{grid-template-columns:1fr}}`;
const same = (a: InputSnapshot["token"], b: InputSnapshot["token"]): boolean => a.epoch === b.epoch && a.revision === b.revision;
function el(parent: Element | ShadowRoot, tag: string, value?: string): HTMLElement { const node = parent.ownerDocument.createElement(tag); if (value !== undefined) node.textContent = value; parent.appendChild(node); return node; }
function button(parent: Element, label: string, click: () => void): HTMLButtonElement { const node = el(parent, "button", label) as HTMLButtonElement; node.type = "button"; node.addEventListener("click", click); return node; }

export function storeAction(ctx: StoreContext, model: StoreModel, side: "stock" | "pack" | "leave", key?: number): boolean {
  const snap = ctx.snapshot?.();
  if (!snap || snap.phase !== "store" || snap.prompt || !same(snap.token, model.token) || !model.ready || !ctx.intent?.submit) return false;
  // Only a known player driver may submit. An absent driver seam cannot prove ownership.
  if (!playerIsDriving(ctx)) return false;
  const rows = side === "stock" ? model.stock : model.pack;
  // Current core shop commands execute immediately. Only a host that promises
  // the native transaction prompt chain may receive Buy, Sell, Stash or Retrieve.
  if (side !== "leave" && (!model.transactionPrompts || !rows.some((row) => row.key === key && row.eligible && (side === "pack" || model.home || row.price === undefined || model.gold === undefined || row.price <= model.gold)))) return false;
  const command = side === "leave" ? { code: "shop-exit" }
    : side === "stock" ? { code: "shop-buy", args: { index: key } }
      : { code: "shop-sell", args: { handle: key } };
  return ctx.intent.submit(snap.token, { kind: "command", command }).accepted;
}

export function storePromptReply(ctx: StoreContext, model: StoreModel, value: number | boolean): boolean {
  const snap = ctx.snapshot?.();
  if (!snap || snap.phase !== "store" || !same(snap.token, model.token) || !snap.prompt || snap.prompt.promptId !== model.prompt?.promptId || !ctx.prompt?.reply) return false;
  if (!playerIsDriving(ctx)) return false;
  if (snap.prompt.kind === "quantity") {
    const quantity = snap.prompt as QuantityPrompt;
    if (typeof value !== "number" || !Number.isInteger(value) || value < quantity.min || value > quantity.max) return false;
  } else if (snap.prompt.kind === "confirm") {
    if (typeof value !== "boolean") return false;
  } else return false;
  return ctx.prompt.reply(snap.prompt.promptId, value).accepted;
}

export function installStores(ctx: StoreContext): () => void {
  const flags = ctx.flags ?? {};
  if (!Object.entries(flags).some(([flag, on]) => flag.startsWith("anybandui.store") && on)) return () => {};
  if (!ctx.ui?.openPanel || !ctx.snapshot) { ctx.log("stores: panel or snapshot seam unavailable"); return () => {}; }
  let panel: ReturnType<NonNullable<NonNullable<StoreContext["ui"]>["openPanel"]>> | null = null;
  let stockSelection: number | null = null, packSelection: number | null = null, unchanged = false, amount = 1, lastPrompt = -1, split = 50;
  let place = "", signature = "", error = "";
  let mount: HTMLElement | null = null;
  const on = (part: string): boolean => flags[`anybandui.store${part}`] === true;
  const read = (): StoreModel | null => {
    const snap = ctx.snapshot?.();
    if (snap?.phase !== "store") return null;
    const status: StoreStatus | null = ctx.store?.current?.() ?? null;
    return adaptStore(snap, ctx.knownLevel?.() ?? null, status);
  };
  const paint = (force = false): void => {
    const model = read();
    if (!model) { if (panel) { panel.close(); panel = null; mount = null; } return; }
    if (!panel) {
      panel = ctx.ui!.openPanel({ id: "store", modal: false, label: "Store" });
      applyTheme(panel.root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
      el(panel.root, "style", CSS);
      mount = el(panel.root, "section"); mount.className = "store";
    }
    const name = `${model.index}:${model.name}`;
    if (name !== place) { place = name; stockSelection = null; packSelection = null; error = ""; }
    if (!model.stock.some((row) => row.key === stockSelection)) stockSelection = null;
    if (!model.pack.some((row) => row.key === packSelection)) packSelection = null;
    const next = JSON.stringify([model, stockSelection, packSelection, unchanged, amount, error]);
    if (!force && next === signature) return;
    signature = next;
    const host = mount!; host.replaceChildren();
    const width = el(host, "input") as HTMLInputElement;
    width.type = "range"; width.min = "25"; width.max = "75"; width.value = String(split);
    width.setAttribute("aria-label", "Stock column width");
    width.title = "Resize stock and inventory columns";
    width.addEventListener("input", () => { split = Number(width.value); sides.style.gridTemplateColumns = `${split}% ${100 - split}%`; });
    const sides = el(host, "div"); sides.className = "sides";
    sides.style.gridTemplateColumns = `${split}% ${100 - split}%`;
    const action = (side: "stock" | "pack" | "leave", key?: number): void => { error = storeAction(ctx, model, side, key) ? "" : "Action unavailable at this input wait."; paint(true); };
    const draw = (side: "stock" | "pack"): void => {
      const box = el(sides, "section"); box.className = "side";
      el(box, "h2", side === "stock" ? `${model.name}${model.owner ? ` - ${model.owner}` : ""}` : `Your inventory${model.gold === undefined ? "" : ` (Gold: ${model.gold})`}`);
      const rows = side === "stock" ? model.stock : model.pack;
      const selected = side === "stock" ? stockSelection : packSelection;
      const table = el(box, "table"); const head = el(table, "tr");
      for (const label of ["Item", "Qty", ...(side === "pack" ? ["Location"] : []), ...(on("Prices") && !model.home ? ["Gold each"] : [])]) el(head, "th", label);
      if (!rows.length) el(box, "p", side === "stock" ? "No stock here." : "No items in your pack.");
      for (const row of rows) {
        const tr = el(table, "tr"); const cell = el(tr, "td");
        const pick = button(cell, row.label, () => { if (side === "stock") stockSelection = row.key; else packSelection = row.key; paint(true); });
        pick.className = "row"; pick.style.color = row.colour; pick.title = row.label;
        pick.setAttribute("aria-pressed", String(selected === row.key));
        el(tr, "td", String(row.quantity));
        if (side === "pack") el(tr, "td", row.location ?? "Pack");
        if (on("Prices") && !model.home) {
          const price = el(tr, "td", row.price === undefined ? "" : String(row.price));
          if (side === "stock" && row.price !== undefined && model.gold !== undefined && row.price > model.gold) price.className = "unaffordable";
        }
      }
      if (on("Transactions")) {
        const actions = el(box, "div"); actions.className = "actions";
        const label = side === "stock" ? model.home ? "Retrieve" : "Buy" : model.home ? "Stash" : model.noSelling ? "Give" : "Sell";
        const active = rows.find((row) => row.key === selected);
        const drive = playerIsDriving(ctx);
        const submit = button(actions, label, () => action(side, selected ?? undefined));
        submit.disabled = !drive || !ctx.intent?.submit || !model.transactionPrompts || !model.ready || !!model.prompt || !active || !active.eligible || (side === "stock" && !model.home && active.price !== undefined && model.gold !== undefined && active.price > model.gold);
        if (!model.transactionPrompts) submit.title = "Store confirmations are unavailable in this game.";
        if (model.noSelling && side === "pack") submit.title = "Shops accept eligible gifts without paying gold.";
        if (side === "stock") { const leave = button(actions, model.home ? "Leave home" : "Leave store", () => action("leave")); leave.disabled = !drive || !ctx.intent?.submit || !model.ready || !!model.prompt; }
      }
      el(box, "h3", "Inspection");
      const chosen = rows.find((row) => row.key === selected);
      if (!chosen) { const empty = el(box, "p", "Select an item to inspect it."); empty.className = "muted"; return; }
      el(box, "strong", chosen.label).style.color = chosen.colour;
      if (on("Comparison")) {
        const sim = compareItem(ctx, model.token, side === "stock" ? { store: model.index, index: chosen.key } : chosen.key);
        if (sim) renderItemComparison(box, sim, unchanged, (value) => { unchanged = value; paint(true); });
      }
      if (side === "pack") {
        const inspection = ctx.inspect?.inspectItem(chosen.key);
        if (inspection && same(inspection.token, model.token)) { const details = el(box, "details") as HTMLDetailsElement; details.open = true; el(details, "summary", inspection.title); el(details, "p", inspection.text); }
      }
    };
    draw("stock"); draw("pack");
    if (on("Prompts") && model.prompt && ctx.prompt?.reply) {
      const prompt = model.prompt;
      if (prompt.promptId !== lastPrompt) { lastPrompt = prompt.promptId; if (prompt.kind === "quantity") amount = (prompt as QuantityPrompt).defaultValue; }
      if (prompt.kind === "quantity" || prompt.kind === "confirm") {
        const box = el(host, "section"); box.className = "prompt";
        el(box, "h3", prompt.kind === "quantity" ? "Choose quantity" : "Confirm price");
        el(box, "p", prompt.label ?? "Confirm transaction?");
        const reply = (value: number | boolean): void => { error = storePromptReply(ctx, model, value) ? "" : "Prompt answer unavailable."; paint(true); };
        if (prompt.kind === "quantity") {
          const quantity = prompt as QuantityPrompt;
          el(box, "p", `Available for this action: ${quantity.max}`);
          const input = el(box, "input") as HTMLInputElement; input.type = "number"; input.min = String(quantity.min); input.max = String(quantity.max); input.value = String(amount);
          input.addEventListener("input", () => { amount = Number(input.value); });
          input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.stopPropagation(); reply(amount); } });
          const actions = el(box, "div"); actions.className = "actions";
          for (const [label, value] of [["One", 1], ["Half", Math.max(1, Math.floor(quantity.max / 2))], ["All", quantity.max]] as const) button(actions, label, () => { amount = value; input.value = String(value); });
          const confirm = button(actions, "Confirm", () => reply(amount)); confirm.disabled = amount < quantity.min || amount > quantity.max;
        } else {
          const actions = el(box, "div"); actions.className = "actions";
          button(actions, "Yes", () => reply(true)); button(actions, "No", () => reply(false));
        }
      }
    }
    if (error) { const line = el(host, "p", error); line.className = "error"; }
  };
  paint(true);
  const timer = globalThis.setInterval(() => paint(), 200);
  return () => { globalThis.clearInterval(timer); panel?.close(); panel = null; };
}
