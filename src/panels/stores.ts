import { applyTheme, THEMES } from "../theme.js";
import { validateSettings } from "../settings.js";
import type { InputToken, LoadoutSimulation, StoreConfirmPrompt, StoreContext, StoreInspectResult, StorePromptAnswer, StoreQuantityPrompt, StoreReplyResult } from "../seams.js";
import { adaptStore, type StoreModel, type StoreRow } from "../view-model/stores.js";
import { compareItem } from "../view-model/items.js";
import { renderItemComparison } from "./item-comparison.js";
import { playerIsDriving } from "../input-owner.js";

const CSS = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.store{position:absolute;inset:12px;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}.sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.side{min-width:0;overflow:auto}h2,h3{color:var(--anyband-accent);border-bottom:1px solid var(--anyband-accent)}table{width:100%;border-collapse:collapse}th{text-align:left}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}button,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}.row{width:100%;text-align:left;border:0;background:transparent}.row[aria-pressed=true]{background:var(--anyband-accent);color:var(--anyband-background)!important}.actions{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.prompt{border:1px solid var(--anyband-accent);padding:8px;max-width:30em}.prompt input{width:100%}.muted{opacity:.65}.gain{color:#80b891}.loss,.error,.unaffordable{color:#ff7559}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer}@media(max-width:650px){.sides{grid-template-columns:1fr}}`;
const same = (a: InputToken, b: InputToken): boolean => a.epoch === b.epoch && a.revision === b.revision;
function el(parent: Element | ShadowRoot, tag: string, value?: string): HTMLElement { const node = parent.ownerDocument.createElement(tag); if (value !== undefined) node.textContent = value; parent.appendChild(node); return node; }
function button(parent: Element, label: string, click: () => void): HTMLButtonElement { const node = el(parent, "button", label) as HTMLButtonElement; node.type = "button"; node.addEventListener("click", click); return node; }

/** `quiet` marks a refusal the player should not see as an error, such as a controller holding input. */
export interface StoreOutcome { readonly accepted: boolean; readonly quiet: boolean }
const REFUSED: StoreOutcome = { accepted: false, quiet: false };
const STANDING_DOWN: StoreOutcome = { accepted: false, quiet: true };
function outcome(result: StoreReplyResult): StoreOutcome {
  return { accepted: result.accepted, quiet: !result.accepted && result.code === "controller-owned" };
}

/** Whether Buy, Sell, Stash or Retrieve may be offered for this row right now. */
export function tradeAllowed(model: StoreModel, side: "stock" | "pack", row: StoreRow | undefined): boolean {
  if (!row || !model.transactionPrompts || !model.ready || model.prompt || !row.eligible) return false;
  return side === "pack" || model.home || row.price === undefined || model.gold === undefined || row.price <= model.gold;
}

export function storeAction(ctx: StoreContext, model: StoreModel, side: "stock" | "pack" | "leave", key?: number): StoreOutcome {
  const snap = ctx.snapshot?.();
  if (!snap || snap.phase !== "store" || snap.prompt || !same(snap.token, model.token) || !model.ready || !ctx.intent?.submit) return REFUSED;
  // Only a known player driver may submit. Core also refuses while a controller
  // owns input, and that answer is quiet rather than an error to show.
  if (!playerIsDriving(ctx)) return STANDING_DOWN;
  // Buy, Sell, Stash and Retrieve need an engine that runs the store's own
  // quantity prompt and price confirmation first (model.transactionPrompts).
  // Leave has no prompt to skip, so it works on every engine.
  if (side !== "leave" && !tradeAllowed(model, side, (side === "stock" ? model.stock : model.pack).find((row) => row.key === key))) return REFUSED;
  const command = side === "leave" ? { code: "shop-exit" }
    : side === "stock" ? { code: "shop-buy", args: { index: key } }
      : { code: "shop-sell", args: { handle: key } };
  return outcome(ctx.intent.submit(snap.token, { kind: "command", command }));
}

/** Answers the store's quantity prompt or confirmation. A quantity prompt also takes the typed cancel reply. */
export function storePromptReply(ctx: StoreContext, model: StoreModel, answer: StorePromptAnswer): StoreOutcome {
  const snap = ctx.snapshot?.();
  if (!snap || snap.phase !== "store" || !same(snap.token, model.token) || !snap.prompt || snap.prompt.promptId !== model.prompt?.promptId || !ctx.prompt?.reply) return REFUSED;
  if (!playerIsDriving(ctx)) return STANDING_DOWN;
  const cancel = typeof answer === "object" && answer.action === "cancel";
  if (snap.prompt.kind === "quantity") {
    const quantity = snap.prompt as StoreQuantityPrompt;
    if (!cancel && (typeof answer !== "number" || !Number.isInteger(answer) || answer < quantity.min || answer > quantity.max)) return REFUSED;
  } else if (snap.prompt.kind === "confirm") {
    if (!cancel && typeof answer !== "boolean") return REFUSED;
  } else return REFUSED;
  return outcome(ctx.prompt.reply(snap.prompt.promptId, answer));
}

/** One comparison per body slot the item fits, so a ring shows both ring slots. */
export interface SlotComparison { readonly name: string; readonly sim: LoadoutSimulation }
export function storeComparisons(ctx: StoreContext, model: StoreModel, side: "stock" | "pack", key: number): readonly SlotComparison[] {
  if (ctx.inspect?.compareLoadoutSlots) {
    try {
      const result = ctx.inspect.compareLoadoutSlots(side === "stock" ? { from: "store", store: model.index, index: key } : { from: "gear", handle: key });
      if (result) return same(result.token, model.token) ? result.slots.map((entry) => ({ name: entry.name, sim: entry.comparison })) : [];
    } catch { /* A refused read falls back to the single simulated loadout below. */ }
  }
  const sim = compareItem(ctx, model.token, side === "stock" ? { store: model.index, index: key } : key);
  return sim ? [{ name: "", sim }] : [];
}

/** The game's own inspection text. Stock is inspected only on an engine that answers with sections for a store reference. */
export function storeInspection(ctx: StoreContext, model: StoreModel, side: "stock" | "pack", key: number): StoreInspectResult | null {
  if (!ctx.inspect?.inspectItem) return null;
  let result: StoreInspectResult | null;
  try { result = ctx.inspect.inspectItem(side === "stock" ? { store: model.index, index: key } : key); } catch { return null; }
  if (!result || !same(result.token, model.token)) return null;
  // An older engine treats the store reference as a gear handle and has no
  // sections; never show what it returns for stock.
  if (side === "stock" && !result.sections) return null;
  return result;
}

// The game's prompt text carries keyboard hints that the buttons replace.
function cleanLabel(label: string | undefined): string {
  return (label ?? "").replace(/\s*\[[^\]]*\]\s*$/u, "").replace(/\s*\(0-\d+, \*=all\)/u, "").replace(/[\s:]+$/u, "").trim();
}

interface PendingTrade { readonly side: "stock" | "pack"; readonly key: number; amount: number; unitPrice?: number; seen: boolean }

export function installStores(ctx: StoreContext): () => void {
  const flags = ctx.flags ?? {};
  if (!Object.entries(flags).some(([flag, on]) => flag.startsWith("anybandui.store") && on)) return () => {};
  if (!ctx.ui?.openPanel || !ctx.snapshot) { ctx.log("stores: panel or snapshot seam unavailable"); return () => {}; }
  let panel: ReturnType<NonNullable<NonNullable<StoreContext["ui"]>["openPanel"]>> | null = null;
  let stockSelection: number | null = null, packSelection: number | null = null, unchanged = false, amount = 1, lastPrompt = -1, split = 50;
  let place = "", signature = "", error = "";
  let pending: PendingTrade | null = null;
  let mount: HTMLElement | null = null;
  const on = (part: string): boolean => flags[`anybandui.store${part}`] === true;
  const read = (): StoreModel | null => {
    const snap = ctx.snapshot?.();
    if (snap?.phase !== "store") return null;
    return adaptStore(snap, ctx.knownLevel?.() ?? null);
  };
  const paint = (force = false): void => {
    const model = read();
    if (!model) { if (panel) { panel.close(); panel = null; mount = null; } pending = null; return; }
    if (!panel) {
      panel = ctx.ui!.openPanel({ id: "store", modal: false, label: "Store" });
      applyTheme(panel.root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
      el(panel.root, "style", CSS);
      mount = el(panel.root, "section"); mount.className = "store";
    }
    const name = `${model.index}:${model.name}`;
    if (name !== place) { place = name; stockSelection = null; packSelection = null; error = ""; pending = null; }
    if (!model.stock.some((row) => row.key === stockSelection)) stockSelection = null;
    if (!model.pack.some((row) => row.key === packSelection)) packSelection = null;
    // A trade this window started ends once its prompts have come and gone.
    if (pending) { if (model.prompt) pending.seen = true; else if (pending.seen) pending = null; }
    const asked = model.prompt?.kind === "quantity" ? model.prompt as StoreQuantityPrompt : null;
    if (pending && asked?.unitPrice !== undefined) pending.unitPrice = asked.unitPrice;
    // The amount is left out: it changes as the player types, and a repaint
    // would rebuild the box they are typing in.
    const next = JSON.stringify([model, stockSelection, packSelection, unchanged, error, pending]);
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
    const show = (result: StoreOutcome, failure: string): void => { error = result.accepted || result.quiet ? "" : failure; };
    const action = (side: "stock" | "pack" | "leave", key?: number): void => {
      const result = storeAction(ctx, model, side, key);
      if (result.accepted && side !== "leave" && key !== undefined) pending = { side, key, amount: 1, seen: false };
      show(result, "The store cannot do that right now.");
      paint(true);
    };
    const draw = (side: "stock" | "pack"): void => {
      const box = el(sides, "section"); box.className = "side";
      el(box, "h2", side === "stock" ? `${model.name}${model.owner ? ` - ${model.owner}` : ""}` : `Your inventory${model.gold === undefined ? "" : ` (Gold: ${model.gold})`}`);
      if (side === "pack" && model.noSelling && !model.home) { const note = el(box, "p", "Stores take items as gifts and pay no gold for them."); note.className = "muted"; }
      const rows = side === "stock" ? model.stock : model.pack;
      const selected = side === "stock" ? stockSelection : packSelection;
      // The one-item quote is what the store pays; with no selling it pays nothing, so it is left out.
      const prices = on("Prices") && !model.home && !(side === "pack" && model.noSelling);
      const table = el(box, "table"); const head = el(table, "tr");
      for (const label of ["Item", "Qty", ...(side === "pack" ? ["Location"] : []), ...(prices ? [side === "stock" ? "Gold each" : "Offer each"] : [])]) el(head, "th", label);
      if (!rows.length) el(box, "p", side === "stock" ? "No stock here." : "No items in your pack.");
      for (const row of rows) {
        const tr = el(table, "tr"); const cell = el(tr, "td");
        // A pack item the store will not buy stays selectable for inspection, but greyed out.
        if (!row.eligible) tr.className = "muted";
        const pick = button(cell, row.label, () => { if (side === "stock") stockSelection = row.key; else packSelection = row.key; paint(true); });
        pick.className = "row"; pick.style.color = row.colour;
        pick.title = row.eligible ? row.label : `${row.label}. This store will not buy it.`;
        pick.setAttribute("aria-pressed", String(selected === row.key));
        el(tr, "td", String(row.quantity));
        if (side === "pack") el(tr, "td", row.location ?? "Pack");
        if (prices) {
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
        submit.disabled = !drive || !ctx.intent?.submit || !tradeAllowed(model, side, active);
        if (!model.transactionPrompts) submit.title = "This version of the game cannot run store trades from here.";
        else if (active && !active.eligible) submit.title = "This store will not buy that item.";
        else if (side === "stock" && active && !model.home && active.price !== undefined && model.gold !== undefined && active.price > model.gold) submit.title = "You cannot afford this.";
        if (side === "stock") { const leave = button(actions, model.home ? "Leave home" : "Leave store", () => action("leave")); leave.disabled = !drive || !ctx.intent?.submit || !model.ready || !!model.prompt; }
        if (side === "stock" && model.transactionPrompts && !model.ready && !model.prompt) { const wait = el(box, "p", "Waiting for the store."); wait.className = "muted"; }
      }
      el(box, "h3", "Inspection");
      const chosen = rows.find((row) => row.key === selected);
      if (!chosen) { const empty = el(box, "p", "Select an item to inspect it."); empty.className = "muted"; return; }
      el(box, "strong", chosen.label).style.color = chosen.colour;
      if (on("Comparison")) {
        const slots = storeComparisons(ctx, model, side, chosen.key);
        for (const slot of slots) {
          // Two slots for one item, such as both ring fingers, each get a heading.
          if (slots.length > 1 && slot.name) el(box, "h4", slot.name.charAt(0).toUpperCase() + slot.name.slice(1));
          renderItemComparison(box, slot.sim, unchanged, (value) => { unchanged = value; paint(true); });
        }
      }
      const inspection = storeInspection(ctx, model, side, chosen.key);
      if (inspection) {
        const details = el(box, "details") as HTMLDetailsElement; details.open = true;
        el(details, "summary", inspection.title);
        const parts = inspection.sections?.filter((part) => part.kind !== "title");
        if (parts) for (const part of parts) el(details, "p", part.text);
        else el(details, "p", inspection.text);
      }
    };
    draw("stock"); draw("pack");
    if (model.prompt) drawPrompt(host, model);
    if (error) { const line = el(host, "p", error); line.className = "error"; }
  };
  const drawPrompt = (host: HTMLElement, model: StoreModel): void => {
    const prompt = model.prompt!;
    const box = el(host, "section"); box.className = "prompt";
    // storePrompts off, or a prompt this window does not answer: the game's own
    // keyboard prompt handles it. The window covers the game screen, so it
    // repeats the question rather than hiding it. Only one of the two ever
    // answers: with storePrompts on, these buttons do, and the keyboard is only
    // a fallback the game itself still accepts.
    const interactive = on("Prompts") && !!ctx.prompt?.reply && (prompt.kind === "quantity" || prompt.kind === "confirm");
    if (!interactive) {
      el(box, "p", cleanLabel(prompt.label) || "The game is asking a question.");
      const hint = el(box, "p", "Answer it with the keyboard."); hint.className = "muted";
      return;
    }
    const reply = (answer: StorePromptAnswer): void => {
      const result = storePromptReply(ctx, model, answer);
      if (result.accepted) {
        if (typeof answer === "number" && pending) pending.amount = answer;
        if (typeof answer !== "number" && answer !== true) pending = null;
      }
      error = result.accepted || result.quiet ? "" : "That answer was not accepted.";
      paint(true);
    };
    const selling = pending?.side === "pack";
    if (prompt.kind === "quantity") {
      const quantity = prompt as StoreQuantityPrompt;
      if (quantity.promptId !== lastPrompt) { lastPrompt = quantity.promptId; amount = Math.max(1, Math.min(quantity.max, quantity.defaultValue)); }
      // min is 0 in the game, where 0 means no. Cancel says that directly, so the
      // amount box starts at 1.
      const low = Math.max(1, quantity.min);
      el(box, "h3", "How many?");
      const text = cleanLabel(quantity.label); if (text) el(box, "p", text);
      el(box, "p", `Up to ${quantity.max}`);
      const priced = quantity.unitPrice !== undefined && !(selling && model.noSelling);
      if (selling && model.noSelling) el(box, "p", "The store pays no gold for this.");
      if (priced) el(box, "p", `${selling ? "Offer" : "Price"} each: ${quantity.unitPrice} gold`);
      const total = priced ? el(box, "p") : null;
      if (quantity.gold !== undefined) el(box, "p", `Your gold: ${quantity.gold}`);
      const input = el(box, "input") as HTMLInputElement; input.type = "number"; input.min = String(low); input.max = String(quantity.max); input.value = String(amount);
      input.setAttribute("aria-label", "Amount");
      const actions = el(box, "div"); actions.className = "actions";
      const update = (): void => {
        const valid = Number.isInteger(amount) && amount >= low && amount <= quantity.max;
        confirm.disabled = !valid;
        if (total) {
          // The engine's totals prices every quantity exactly. Without it,
          // totalPrice follows the digits typed at the game's own prompt, which
          // start at 1, so only one item is exact and larger amounts are about.
          const exact = quantity.totals?.[amount];
          const hasExact = typeof exact === "number";
          const sum = hasExact ? exact : amount === 1 && quantity.totalPrice !== undefined ? quantity.totalPrice : quantity.unitPrice! * amount;
          // PROSE
          total.textContent = valid ? `Total: ${!hasExact && amount !== 1 ? "about " : ""}${sum} gold` : "";
          total.className = !selling && quantity.gold !== undefined && sum > quantity.gold ? "unaffordable" : "";
        }
      };
      input.addEventListener("input", () => { amount = Number(input.value); update(); });
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.stopPropagation(); if (!confirm.disabled) reply(amount); } });
      for (const [label, value] of [["One", 1], ["Half", Math.max(1, Math.floor(quantity.max / 2))], ["All", quantity.max]] as const) button(actions, label, () => { amount = value; input.value = String(value); update(); });
      const confirm = button(actions, "OK", () => reply(amount));
      button(actions, "Cancel", () => reply({ action: "cancel" }));
      update();
      return;
    }
    el(box, "h3", pending && !model.home ? selling ? "Accept this offer?" : "Accept this price?" : "Confirm");
    const text = cleanLabel(prompt.label); if (text) el(box, "p", text);
    const price = (prompt as StoreConfirmPrompt).price;
    if (pending && !model.home) {
      const row = (pending.side === "stock" ? model.stock : model.pack).find((entry) => entry.key === pending!.key);
      const unit = pending.unitPrice ?? row?.price;
      if (selling && model.noSelling) el(box, "p", "You get no gold for this.");
      // The engine's own confirm price is exact; without it, the amount times
      // the unit price is only exact for one item.
      // PROSE
      else if (price !== undefined) el(box, "p", `${selling ? "You receive" : "Price"}: ${price} gold`);
      else if (unit !== undefined) el(box, "p", `${selling ? "You receive" : "Price"}: ${pending.amount === 1 ? "" : "about "}${unit * pending.amount} gold`);
    }
    const actions = el(box, "div"); actions.className = "actions";
    button(actions, "Accept", () => reply(true)); button(actions, "Decline", () => reply(false));
    // PROSE
    button(actions, "Cancel", () => reply({ action: "cancel" }));
  };
  paint(true);
  const timer = globalThis.setInterval(() => paint(), 200);
  return () => { globalThis.clearInterval(timer); panel?.close(); panel = null; };
}
