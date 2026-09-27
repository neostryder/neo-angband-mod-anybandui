import { applyTheme, THEMES } from "./theme.js";
import { validateSettings } from "./settings.js";
import type { Phase4Context, Phase4Snapshot, SpellPrompt } from "./seams.js";
import { adaptSpells, type BookRow, type SpellRow } from "./view-model/spells.js";
import { actionReady, answerSpell, castSpell, rest, studySpell } from "./spell-actions.js";
import { activate, itemBindings, quickbarOwnsKey, readSlots, resolve, slotIndex, writeSlots, type Appearance, type Binding, type Slots } from "./quickbar.js";
import { installBlastPreview } from "./blast-preview.js";

const CSS = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.phase4{position:fixed;left:12px;bottom:12px;width:min(680px,calc(100vw - 24px));max-height:55vh;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,select,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:4px}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--anyband-accent)}button:disabled{opacity:.45}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:3px;border-bottom:1px solid var(--anyband-accent)}.slots{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px}.slot{min-height:42px;overflow:hidden;word-break:break-word}.muted{opacity:.55}.row{width:100%;text-align:left;border:0;background:transparent}.menu{margin:6px 0;padding:6px;border:1px solid var(--anyband-accent)}.menu button{margin:2px}.hint{font-size:12px}`;
function el(parent: Element | ShadowRoot, tag: string, content?: string): HTMLElement { const node = parent.ownerDocument.createElement(tag); if (content !== undefined) node.textContent = content; parent.append(node); return node; }
function button(parent: Element, label: string, callback: () => void): HTMLButtonElement { const node = el(parent, "button", label) as HTMLButtonElement; node.type = "button"; node.addEventListener("click", callback); return node; }
const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
function drawIcon(parent: HTMLElement, style: string): void {
  const svg = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "22"); svg.setAttribute("height", "22"); svg.setAttribute("aria-hidden", "true");
  const path = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", style === "potion" ? "M9 2h6v3h-1v5l5 8c1 2 0 4-2 4H7c-2 0-3-2-2-4l5-8V5H9z" : style === "scroll" ? "M5 3h13v14a4 4 0 0 1-4 4H6a3 3 0 0 1-3-3c0-2 1-3 3-3h8M6 15V3" : "M4 20 19 4l2 2L6 22z");
  path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.5"); svg.append(path); parent.prepend(svg);
}

export function installPhase4(ctx: Phase4Context): () => void {
  const flags = ctx.flags ?? {};
  const spellOn = flags["anybandui.spells"] === true;
  const quickOn = flags["anybandui.quickbar"] === true;
  const restOn = flags["anybandui.restDialog"] === true;
  const blastCleanup = flags["anybandui.blastPreview"] ? installBlastPreview(ctx) : () => {};
  if (!spellOn && !quickOn && !restOn) return blastCleanup;
  if (!ctx.ui?.openPanel || !ctx.snapshot) { ctx.log("phase 4: panel or snapshot seam unavailable"); return blastCleanup; }
  const panel = ctx.ui.openPanel({ id: "phase4", modal: false, label: "Spells and quickbar" });
  applyTheme(panel.root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
  el(panel.root, "style", CSS);
  const mount = el(panel.root, "section"); mount.className = "phase4";
  let bookKey = "", spellIndex = -1, menu = -1, customize = -1, restOpen = false, restMode = -2, turns = 10, promptChoice = -1, error = "", signature = "", closed = false;
  let appearance: Appearance = { style: "automatic", text: "", color: "#7abaf4" };
  let character = ctx.character?.key?.() ?? null;
  let slots: Slots = character ? readSlots(ctx.prefs?.get(), character) : Array(30).fill(null);
  const save = (): void => { if (character) writeSlots(ctx, character, slots); };
  const assign = (index: number, binding: Binding | null): void => { const next = [...slots]; next[index] = binding; slots = next; save(); menu = -1; paint(true); };
  const paint = (force = false): void => {
    if (closed || !panel.root.isConnected) return;
    const snap = ctx.snapshot?.();
    const key = ctx.character?.key?.() ?? null;
    if (key !== character) { character = key; slots = key ? readSlots(ctx.prefs?.get(), key) : Array(30).fill(null); }
    const model = snap ? adaptSpells(snap, ctx.inspect) : null;
    const sig = JSON.stringify([snap, slots, bookKey, spellIndex, menu, customize, appearance, restOpen, restMode, turns, promptChoice, error]);
    if (!force && sig === signature) return; signature = sig;
    mount.replaceChildren();
    if (!snap) { el(mount, "p", "Game state unavailable."); return; }
    if (spellOn) {
      el(mount, "h2", "Spells");
      if (!model) el(mount, "p", "Spell list unavailable.");
      else if (!model.books.length) el(mount, "p", "No readable spellbooks carried.");
      else {
        const picker = el(mount, "select") as HTMLSelectElement; picker.setAttribute("aria-label", "Spellbook");
        for (const book of model.books) { const opt = el(picker, "option", book.name) as HTMLOptionElement; opt.value = book.key; }
        if (!model.books.some((book) => book.key === bookKey)) bookKey = model.books[0]!.key;
        picker.value = bookKey; picker.addEventListener("change", () => { bookKey = picker.value; spellIndex = -1; paint(true); });
        const book = model.books.find((entry) => entry.key === bookKey)!;
        const table = el(mount, "table"); const head = el(table, "tr"); for (const label of ["Spell", "Mana", "Fail", "State"]) el(head, "th", label);
        for (const spell of book.spells) {
          const row = el(table, "tr"); if (!spell.canCast && !spell.canStudy) row.className = "muted";
          const cell = el(row, "td"); const pick = button(cell, spell.name, () => { spellIndex = spell.index; paint(true); }); pick.className = "row";
          pick.title = spell.name; pick.draggable = quickOn;
          pick.addEventListener("dblclick", () => { if (castSpell(ctx, snap, spell)) error = ""; paint(true); });
          pick.addEventListener("dragstart", (event) => { if (quickOn) event.dataTransfer?.setData("application/x-anybandui-binding", JSON.stringify({ type: "spell", key: book.key, index: spell.index, name: spell.name })); });
          pick.addEventListener("contextmenu", (event) => { if (!quickOn) return; event.preventDefault(); menu = -2; spellIndex = spell.index; paint(true); });
          el(row, "td", String(spell.mana)); el(row, "td", `${spell.fail}%`); el(row, "td", spell.state);
        }
        const selected = book.spells.find((entry) => entry.index === spellIndex) ?? book.spells[0];
        if (selected) {
          const cast = button(mount, "Cast", () => { if (!castSpell(ctx, snap, selected)) error = "Cast unavailable."; paint(true); }); cast.disabled = !selected.canCast || !ctx.intent?.submit;
          const study = button(mount, book.chooseSpells ? "Study" : "Study book", () => { if (!studySpell(ctx, snap, book, selected)) error = "Study unavailable."; paint(true); }); study.disabled = !(book.chooseSpells ? selected.canStudy : book.spells.some((entry) => entry.canStudy)) || !ctx.intent?.submit;
          if (!book.chooseSpells) study.title = "Your class learns a random eligible spell from this book.";
          el(mount, "h3", selected.name); el(mount, "p", `Level ${selected.level}. Mana ${selected.mana}. Failure ${selected.fail}%. ${selected.state}.`);
          if (selected.canCast && (snap.core.player?.sp ?? 0) < selected.mana) el(mount, "p", "Not enough mana. Confirmation may be required.");
          el(mount, "p", selected.description);
          if (quickOn && menu === -2) { const box = el(mount, "div"); box.className = "menu"; el(box, "strong", "Assign spell to quickbar");
            for (let i = 0; i < 30; i++) button(box, `${i < 10 ? "" : i < 20 ? "Shift+" : "Ctrl+"}${keys[i % 10]}`, () => assign(i, { type: "spell", key: book.key, index: selected.index, name: selected.name })); }
        }
      }
      if (snap.prompt?.kind === "spell" && ctx.prompt?.reply && (ctx.controller?.driver?.()?.kind ?? "player") === "player") {
        // Spell prompts own their choices; the item panel only handles item and quantity prompts.
        const prompt = snap.prompt as SpellPrompt; const box = el(mount, "div"); box.className = "menu"; el(box, "h3", "Choose spell"); el(box, "p", prompt.label);
        for (const choice of prompt.choices) button(box, choice.name, () => { promptChoice = choice.index; paint(true); });
        button(box, "Choose", () => { if (!answerSpell(ctx, snap, promptChoice)) error = "Choice unavailable."; paint(true); });
        button(box, "Cancel", () => { ctx.prompt?.reply(prompt.promptId, null); paint(true); });
      }
    }
    if (quickOn && snap.phase === "play") {
      el(mount, "h2", "Quickbar"); if (!character) el(mount, "p", "Assignments last for this game session.");
      for (let row = 0; row < 3; row++) {
        el(mount, "h3", row === 0 ? "Number keys" : row === 1 ? "Shift and number" : "Ctrl and number");
        const line = el(mount, "div"); line.className = "slots";
        for (let col = 0; col < 10; col++) {
          const index = row * 10 + col; const binding = slots[index] ?? null; const result = resolve(snap, binding, model, ctx);
          const custom = binding?.appearance;
          const shown = custom?.style === "text" && custom.text ? custom.text : result.label;
          const slot = button(line, `${keys[col]} ${shown}${result.amount ? ` - ${result.amount}` : ""}`, () => { if (!activate(ctx, snap, binding)) error = result.detail; paint(true); });
          slot.className = "slot" + (result.usable ? "" : " muted"); slot.title = `Quickbar ${row === 0 ? "" : row === 1 ? "Shift+" : "Ctrl+"}${keys[col]}. ${result.detail}`;
          if (custom?.color && /^#[0-9a-f]{6}$/i.test(custom.color)) slot.style.borderColor = custom.color;
          if (custom && ["potion", "scroll", "wand"].includes(custom.style)) drawIcon(slot, custom.style);
          slot.setAttribute("aria-label", slot.title);
          slot.addEventListener("contextmenu", (event) => { event.preventDefault(); menu = index; paint(true); });
          slot.addEventListener("dragstart", (event) => { if (binding) event.dataTransfer?.setData("application/x-anybandui-slot", JSON.stringify({ index, binding })); }); slot.draggable = !!binding;
          slot.addEventListener("dragover", (event) => { event.preventDefault(); });
          slot.addEventListener("drop", (event) => { event.preventDefault(); const origin = event.dataTransfer?.getData("application/x-anybandui-slot"); const external = event.dataTransfer?.getData("application/x-anybandui-binding");
            if (origin) { try { const parsed = JSON.parse(origin) as { index: number; binding: Binding }; if (parsed.index >= 0 && parsed.index < 30 && JSON.stringify(slots[parsed.index]) === JSON.stringify(parsed.binding)) { const next = [...slots]; [next[index], next[parsed.index]] = [next[parsed.index] ?? null, next[index] ?? null]; slots = next; save(); paint(true); } } catch { /* A foreign drag is ignored. */ } }
            else if (external) { try { const parsed = JSON.parse(external) as Binding; if (parsed.type === "spell" && model?.books.some((book) => book.key === parsed.key && book.spells.some((spell) => spell.index === parsed.index))) assign(index, parsed); } catch { /* A foreign drag is ignored. */ } }
          });
        }
      }
      if (menu >= 0) { const box = el(mount, "div"); box.className = "menu"; el(box, "strong", `Assign ${keys[menu % 10]}`);
        if (slots[menu]) button(box, "Customize", () => { customize = menu; appearance = slots[menu]?.appearance ?? { style: "automatic", text: "", color: "#7abaf4" }; menu = -1; paint(true); });
        button(box, "Rest until recovered", () => assign(menu, { type: "command", code: "rest", name: "Rest" }));
        for (const binding of itemBindings(snap, ctx)) { const choice = button(box, `${binding.code === "quaff" ? "Drink" : binding.code === "read" ? "Read" : binding.code === "aim-wand" ? "Aim" : "Activate"}: ${binding.name}`, () => assign(menu, binding));
          choice.draggable = true; choice.addEventListener("dragstart", (event) => event.dataTransfer?.setData("application/x-anybandui-binding", JSON.stringify(binding))); }
        for (const book of model?.books ?? []) for (const spell of book.spells) button(box, `Cast: ${spell.name}`, () => assign(menu, { type: "spell", key: book.key, index: spell.index, name: spell.name }));
        button(box, "Clear", () => assign(menu, null)); button(box, "Close", () => { menu = -1; paint(true); }); }
      if (customize >= 0 && slots[customize]) { const box = el(mount, "div"); box.className = "menu"; el(box, "h3", "Customize slot");
        const style = el(box, "select") as HTMLSelectElement; style.setAttribute("aria-label", "Appearance");
        for (const [value, label] of [["automatic", "Automatic"], ["text", "Custom text"], ["potion", "Potion icon"], ["scroll", "Scroll icon"], ["wand", "Wand icon"]]) { const opt = el(style, "option", label) as HTMLOptionElement; opt.value = value!; } style.value = appearance.style;
        style.addEventListener("change", () => { appearance = { ...appearance, style: style.value as Appearance["style"] }; paint(true); });
        const input = el(box, "input") as HTMLInputElement; input.value = appearance.text; input.placeholder = "Text wraps to fit the slot."; input.setAttribute("aria-label", "Slot text"); input.addEventListener("input", () => { appearance = { ...appearance, text: input.value.slice(0, 60) }; });
        const color = el(box, "input") as HTMLInputElement; color.type = "color"; color.value = appearance.color; color.setAttribute("aria-label", "Slot color"); color.addEventListener("input", () => { appearance = { ...appearance, color: color.value }; });
        button(box, "Reset appearance", () => { appearance = { style: "automatic", text: "", color: "#7abaf4" }; paint(true); });
        button(box, "Save and close", () => { const binding = slots[customize]; if (binding) assign(customize, { ...binding, appearance }); customize = -1; paint(true); });
        button(box, "Cancel", () => { customize = -1; paint(true); }); }
    }
    if (restOn && snap.phase === "play") { button(mount, "Rest", () => { restOpen = !restOpen; paint(true); });
      if (restOpen) { const box = el(mount, "div"); box.className = "menu"; el(box, "h3", "Rest");
        for (const [count, label, description] of [[-2, "Fully recovered", "Recover HP and mana and wait out harmful conditions."], [-1, "HP and mana", "Stop when both are full."], [-3, "HP or mana", "Stop as soon as either is full."], [1, "Number of turns", "Rest for a set number of turns."]] as const) {
          const choice = button(box, label, () => { restMode = count; paint(true); }); choice.setAttribute("aria-pressed", String(restMode === count)); el(box, "p", description); }
        if (restMode === 1) { const input = el(box, "input") as HTMLInputElement; input.type = "number"; input.min = "1"; input.max = "9999"; input.value = String(turns); input.setAttribute("aria-label", "Turns"); input.addEventListener("input", () => { turns = Number(input.value); }); }
        if (restMode === 1 && (!Number.isInteger(turns) || turns < 1 || turns > 9999)) el(box, "p", "Enter between 1 and 9999 turns.");
        el(box, "p", "Danger interrupts rest normally."); const confirm = button(box, "Rest", () => { if (!rest(ctx, snap, restMode === 1 ? turns : restMode)) error = "Rest unavailable."; else restOpen = false; paint(true); });
        confirm.disabled = restMode === 1 && (!Number.isInteger(turns) || turns < 1 || turns > 9999);
        button(box, "Cancel", () => { restOpen = false; paint(true); }); }
    }
    if (error) { const p = el(mount, "p", error); p.setAttribute("role", "status"); }
  };
  const keydown = (event: KeyboardEvent): void => {
    if (!quickOn || menu >= 0 || customize >= 0 || restOpen || event.repeat || event.altKey || event.metaKey || event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
    const index = slotIndex(event.code, event.shiftKey, event.ctrlKey);
    const snap = ctx.snapshot?.(); if (!quickbarOwnsKey(quickOn, snap ?? null, event.code, event.shiftKey, event.ctrlKey, menu >= 0 || restOpen) || !snap || !actionReady(ctx, snap)) return;
    // The quickbar owns top-row digits during ordinary play, including empty slots.
    const binding = slots[index] ?? null;
    event.preventDefault(); event.stopImmediatePropagation();
    if (resolve(snap, binding, adaptSpells(snap, ctx.inspect), ctx).usable) activate(ctx, snap, binding);
    paint(true);
  };
  paint(true); window.addEventListener("keydown", keydown, true);
  const timer = window.setInterval(() => paint(), 200);
  void panel.closed.then(() => { closed = true; window.clearInterval(timer); });
  return () => { closed = true; window.clearInterval(timer); window.removeEventListener("keydown", keydown, true); panel.close(); blastCleanup(); };
}
