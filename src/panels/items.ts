import { openSurfaces } from "./surface.js";
import { intentAvailable, itemRuleLines, rulesEditable, qualityChoices, ruleEditorRows, ruleIntent, submitItemIntent, NOTE_LIMIT } from "../item-rules.js";
import type { ItemPanelContext, ItemPrompt, QuantityPrompt, ItemRef, ItemRulesResult, ItemIntent } from "../seams.js";
import { AcquisitionChanges, adaptItems, compareSlots, defaultSlot, panelRows, type ItemRow, type ItemsModel } from "../view-model/items.js";
import { answerItem, answerQuantity, buildItemCommand, floorChoiceIndex, quantityShortcut, submitIgnore, submitItem } from "../item-interactions.js";
import { inspectionBlocks } from "../item-inspection.js";
import { renderItemComparison, slotOptionLabel } from "./item-comparison.js";
import { playerIsDriving } from "../input-owner.js";

const CSS = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.items{position:absolute;right:12px;top:12px;width:min(440px,44vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 5px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}input[type=search]{width:100%}.tabs,.actions,.quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}table{width:100%;border-collapse:collapse}th{text-align:left;position:sticky;top:0;background:var(--anyband-surface)}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}tr.new{background:#437d5541}tr.chosen{outline:1px solid var(--anyband-accent)}.row{width:100%;text-align:left;border:0;background:transparent}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer;font-weight:bold}.muted{opacity:.65}.gain{color:#80b891}.loss{color:#ff7559}.error{color:#ff7559}.prompt{border:1px solid var(--anyband-accent);padding:8px;margin:8px 0}.rule{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;padding:3px 0;border-bottom:1px solid var(--anyband-accent)}.rule .name{flex:1 1 12em}.rule input[type=text]{width:9em}.info{white-space:pre-wrap;margin:4px 0}summary.lead{font-weight:normal;color:inherit}`;
const ACTIONS = ["wield", "takeoff", "drop", "inscribe", "use"] as const;
const ACTION_LABELS: Record<(typeof ACTIONS)[number], string> = { wield: "Wield", takeoff: "Take off", drop: "Drop", inscribe: "Inscribe", use: "Use" };
const USE_CODES = ["activate", "use-staff", "aim-wand", "zap-rod", "eat", "quaff", "read"] as const;
const TAB_NAMES = { pack: "Pack", equipment: "Equipment", quiver: "Quiver" } as const;
function el(parent: Element | ShadowRoot, tag: string, text?: string): HTMLElement { const child = parent.ownerDocument.createElement(tag); if (text !== undefined) child.textContent = text; parent.appendChild(child); return child; }
function button(parent: Element, label: string, action: () => void): HTMLButtonElement { const b = el(parent, "button", label) as HTMLButtonElement; b.type = "button"; b.addEventListener("click", action); return b; }
function same(a: { epoch: number; revision: number }, b: { epoch: number; revision: number }): boolean { return a.epoch === b.epoch && a.revision === b.revision; }

export function installItems(ctx: ItemPanelContext): () => void {
  const flags = ctx.flags ?? {};
  if (!Object.entries(flags).some(([key, on]) => key.startsWith("anybandui.items") && on && (key !== "anybandui.itemsRules" || !!ctx.inspect?.itemRules))) return () => {};
  if (!ctx.snapshot) { ctx.log("items: snapshot seam unavailable"); return () => {}; }
  let repaint = (): void => {};
  // A pane beside the dungeon view when the host tiles mod panels, else an overlay.
  const surfaces = openSurfaces(ctx, [{ key: "items", label: "Items", tab: "Items", minSize: { width: 280, height: 220 }, placement: { kind: "dock", target: "main", edge: "right" } }],
    { id: "items", label: "Items", className: "items" }, CSS, () => repaint());
  if (!surfaces) { ctx.log("items: panel seam unavailable"); return () => {}; }
  let mount: HTMLElement = document.createElement("section");
  const changes = new AcquisitionChanges();
  let tab: keyof typeof TAB_NAMES = "pack";
  let search = "";
  // The selected row's key: a gear key survives letter changes, so the selection
  // stays on the same stack when the pack reorders.
  let selected: string | null = null;
  let promptChoice: number | null = null;
  let unchanged = false;
  let quantity = 1;
  let promptId = -1;
  let error = "";
  let signature = "";
  let closed = false;
  let slotChoice: { key: string; slot: number } | null = null;
  // Items this panel ignored. No read reports an item's own ignore mark, so the
  // panel remembers what it did, and learns from the host's refusal otherwise.
  const ignoredHere = new Set<string>();
  let ignoreEpoch: number | undefined;
  let ruleFilter = "";
  let rulesOpen = false;
  const drafts = new Map<string, string>();
  const folded = new Set<string>();
  const enabled = (name: string): boolean => flags[`anybandui.items${name}`] === true;
  const read = (): ItemsModel | null => { const snap = ctx.snapshot?.(); return snap?.core ? adaptItems(snap) : null; };
  const current = (model: ItemsModel): boolean => {
    const latest = read();
    return !!latest && same(latest.token, model.token) && latest.phase === "play" && !latest.prompt && playerIsDriving(ctx);
  };
  const usable = (model: ItemsModel, item: ItemRow, code: string): boolean => {
    const tester = ctx.inspect?.itemTester(code);
    return !!tester && same(tester.token, model.token) && tester.items.some((ref) => "handle" in ref && ref.handle === item.handle);
  };
  const report = (result: { accepted: boolean; reason?: string; quiet?: boolean }, fallback: string): void => {
    error = result.accepted || result.quiet ? "" : result.reason ?? fallback;
  };
  const act = (model: ItemsModel, item: ItemRow, code: string): void => {
    if (!current(model) || !ctx.intent?.submit) { error = "Action unavailable at this input wait."; paint(true); return; }
    const actualCode = code === "use" ? USE_CODES.find((candidate) => usable(model, item, candidate)) : code;
    if (!actualCode) { error = "No usable command is available for this item."; paint(true); return; }
    const builders = ctx.core?.createAgentActions?.(ctx.state);
    let inscription: string | undefined;
    if (code === "inscribe") { const input = globalThis.prompt?.("Inscription", item.inscription ?? ""); if (input === null || input === undefined) return; inscription = input; }
    const command = buildItemCommand(builders, actualCode, item.handle, inscription);
    const result = submitItem(ctx.intent, ctx.inspect, model.token, actualCode, item.handle, command);
    report({ ...result, quiet: (result as { code?: string }).code === "controller-owned" }, "Action rejected.");
    paint(true);
  };
  const ignore = (model: ItemsModel, item: ItemRow, kind: "ignore" | "unignore"): void => {
    if (!current(model)) { error = "Action unavailable at this input wait."; paint(true); return; }
    const result = submitIgnore(ctx, model.token, kind, item.handle);
    if (result.accepted) { if (kind === "ignore") ignoredHere.add(item.key); else ignoredHere.delete(item.key); error = ""; }
    // The host refuses when the item menu does not offer that entry, which means the
    // item already has the other state: flip the button and say so.
    else if (!result.quiet && result.reason === "invalid item action") {
      if (kind === "ignore") ignoredHere.add(item.key); else ignoredHere.delete(item.key);
      error = kind === "ignore" ? "This item is already ignored." : "This item is not ignored.";
    } else report(result, "Action rejected.");
    paint(true);
  };
  const editRule = (model: ItemsModel, rules: ItemRulesResult, rule: Extract<ItemIntent, { kind: "item-rule" }>["rule"], index: number, value: boolean | number | string, itype?: number): void => {
    if (!current(model)) { error = "Rules can be changed only while the game waits for a command."; paint(true); return; }
    const built = ruleIntent(rules, rule, index, value, itype);
    if ("reason" in built) { error = built.reason; paint(true); return; }
    report(submitItemIntent(ctx, model.token, built.intent), "The game did not accept that rule.");
    paint(true);
  };
  const inspectRef = (model: ItemsModel, item: ItemRow): ItemRef | null => item.location === "floor"
    ? model.player && item.floorIndex !== undefined ? { floor: { x: model.player.x, y: model.player.y, index: item.floorIndex } } : null
    : item.handle;
  const showPrompt = (model: ItemsModel): void => {
    // Store prompts belong to the store panel when both item and store flags are on.
    if (model.phase !== "play" || !playerIsDriving(ctx)) return;
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
      button(box, "Confirm", () => { const result = answerQuantity(ctx.prompt, q, quantity); report({ ...result, quiet: (result as { code?: string }).code === "controller-owned" }, "Prompt rejected."); paint(true); });
    } else if (prompt.kind === "item" && enabled("Choice")) {
      const p = prompt as ItemPrompt;
      if (promptId !== p.promptId) { promptId = p.promptId; promptChoice = p.choices[0]?.handle ?? null; }
      const box = el(mount, "section"); box.className = "prompt";
      el(box, "h3", "Angband asks"); el(box, "p", p.label);
      const table = el(box, "table"); const head = el(table, "tr"); for (const name of ["Key", "Item", "Location", "Qty"]) el(head, "th", name);
      const rowFor = (handle: number): ItemRow | undefined => {
        const floor = floorChoiceIndex(handle);
        return floor === null ? panelRows(model).find((row) => row.handle === handle && row.location !== "floor") : model.floor?.[floor];
      };
      for (const choice of p.choices) {
        const item = rowFor(choice.handle);
        const row = el(table, "tr"); el(row, "td", choice.letter); if (choice.handle === promptChoice) row.className = "chosen";
        const cell = el(row, "td"); const b = button(cell, choice.label, () => { promptChoice = choice.handle; paint(true); }); b.className = "row"; if (item) b.style.color = item.colour;
        el(row, "td", item ? TAB_NAMES[item.location as keyof typeof TAB_NAMES] ?? "Floor" : "Floor"); el(row, "td", item ? String(item.quantity) : "");
      }
      const chosen = p.choices.find((choice) => choice.handle === promptChoice);
      if (chosen) {
        const item = rowFor(chosen.handle);
        const ref = item ? inspectRef(model, item) : chosen.handle > 0 ? chosen.handle : null;
        const inspection = ref === null ? null : ctx.inspect?.inspectItem(ref);
        if (inspection && same(inspection.token, model.token)) el(box, "p", inspection.text);
      }
      const choose = button(box, "Choose", () => { if (chosen) { const result = answerItem(ctx.prompt, p, chosen.handle); report({ ...result, quiet: (result as { code?: string }).code === "controller-owned" }, "Prompt rejected."); paint(true); } }); choose.disabled = !chosen;
    }
  };
  const showRules = (model: ItemsModel): void => {
    const rules = enabled("Rules") ? ctx.inspect?.itemRules?.() ?? null : null;
    if (!rules || !same(rules.token, model.token)) return;
    const section = el(mount, "details") as HTMLDetailsElement; section.open = rulesOpen;
    section.addEventListener("toggle", () => { rulesOpen = section.open; });
    el(section, "summary", "Ignore settings and inscriptions");
    // Editing needs the item-rule intent and an ordinary command wait. Without
    // either, the list stays readable, as on an engine that only reads rules.
    if (!rulesEditable(ctx, model.phase, !!model.prompt)) {
      const lines = itemRuleLines(rules);
      if (!lines.length) el(section, "p", "No ignore settings or inscriptions yet.");
      for (const line of lines) el(section, "div", line);
      return;
    }
    const filter = el(section, "input") as HTMLInputElement; filter.type = "search"; filter.placeholder = "Find an item kind or ego"; filter.value = ruleFilter; filter.dataset["focus"] = "rule-filter";
    filter.addEventListener("input", () => { ruleFilter = filter.value; paint(true); });
    const rows = ruleEditorRows(rules, ruleFilter);
    if (rows.quality.length) {
      el(section, "h4", "Ignore by quality");
      for (const row of rows.quality) {
        const line = el(section, "div"); line.className = "rule";
        el(line, "span", row.name).className = "name";
        const select = el(line, "select") as HTMLSelectElement; select.setAttribute("aria-label", `Ignore ${row.name}`);
        qualityChoices(row.itype).forEach((name, value) => { const option = el(select, "option", name) as HTMLOptionElement; option.value = String(value); option.selected = value === row.threshold; });
        select.addEventListener("change", () => editRule(model, rules, "quality", row.itype, Number(select.value)));
      }
    }
    const checkbox = (line: HTMLElement, label: string, checked: boolean, change: (value: boolean) => void): void => {
      const wrap = el(line, "label"); const box = el(wrap, "input") as HTMLInputElement; box.type = "checkbox"; box.checked = checked;
      box.addEventListener("change", () => change(box.checked)); wrap.append(` ${label}`);
    };
    if (rows.kinds.length) {
      el(section, "h4", "Item kinds");
      for (const row of rows.kinds) {
        const line = el(section, "div"); line.className = "rule";
        el(line, "span", row.name).className = "name";
        checkbox(line, "Ignore", row.ignoreAware, (value) => editRule(model, rules, "kind-aware", row.kidx, value));
        // The game keeps a second flag and note for the kind before it is identified.
        // The list holds only identified kinds, so those appear only when still set.
        if (row.ignoreUnaware) checkbox(line, "Ignore unidentified", true, (value) => editRule(model, rules, "kind-unaware", row.kidx, value));
        const key = `note:${row.kidx}`;
        const note = el(line, "input") as HTMLInputElement; note.type = "text"; note.maxLength = NOTE_LIMIT; note.placeholder = "Inscription"; note.dataset["focus"] = key;
        note.setAttribute("aria-label", `Auto-inscription for ${row.name}`);
        note.value = drafts.get(key) ?? row.noteAware ?? "";
        note.addEventListener("input", () => { drafts.set(key, note.value); });
        button(line, "Save", () => { drafts.delete(key); editRule(model, rules, "note-aware", row.kidx, note.value); });
        if (row.noteUnaware) {
          el(line, "span", `Unidentified: ${row.noteUnaware}`);
          button(line, "Clear", () => editRule(model, rules, "note-unaware", row.kidx, ""));
        }
      }
    }
    if (rows.egos.length) {
      el(section, "h4", "Egos");
      for (const row of rows.egos) {
        const line = el(section, "div"); line.className = "rule";
        el(line, "span", row.typeName ? `${row.name} (${row.typeName})` : row.name).className = "name";
        checkbox(line, "Ignore", row.ignored, (value) => editRule(model, rules, "ego", row.eidx, value, row.itype));
      }
    }
    if (rows.hidden) el(section, "p", `${rows.hidden} more match. Type more of the name to narrow the list.`).className = "muted";
    else if (!ruleFilter.trim() && !rows.kinds.length && !rows.egos.length) el(section, "p", "No kind or ego rules yet. Type a name above to add one.").className = "muted";
  };
  const showComparison = (model: ItemsModel, item: ItemRow): void => {
    if (!enabled("Comparison") || item.location !== "pack") return;
    const slots = compareSlots(ctx, model.token, item.handle);
    // Nothing to compare for an item no body slot can hold, such as a potion.
    if (!slots?.length) return;
    if (!slotChoice || slotChoice.key !== item.key || !slots.some((entry) => entry.slot === slotChoice!.slot)) {
      const slot = defaultSlot(slots);
      slotChoice = slot === null ? null : { key: item.key, slot };
    }
    const chosen = slots.find((entry) => entry.slot === slotChoice?.slot) ?? slots[0]!;
    renderItemComparison(mount, chosen.comparison, unchanged, (value) => { unchanged = value; paint(true); }, {
      options: slots.map((entry) => ({ slot: entry.slot, label: slotOptionLabel(entry.name, entry.comparison.placements.find((placement) => placement.slot === entry.slot)?.displaced?.label ?? null) })),
      chosen: chosen.slot, choose: (slot) => { slotChoice = { key: item.key, slot }; paint(true); },
    });
  };
  const showInspection = (model: ItemsModel, item: ItemRow): void => {
    if (!enabled("Inspection")) return;
    const ref = inspectRef(model, item);
    const inspection = ref === null ? null : ctx.inspect?.inspectItem(ref);
    if (!inspection || !same(inspection.token, model.token)) return;
    for (const block of inspectionBlocks(inspection)) {
      if (!block.heading) { el(mount, "p", block.body).className = "info"; continue; }
      const details = el(mount, "details") as HTMLDetailsElement; details.open = !folded.has(block.heading);
      details.addEventListener("toggle", () => { if (details.open) folded.delete(block.heading); else folded.add(block.heading); });
      const summary = el(details, "summary", block.heading); if (block.lead) summary.className = "lead"; if (block.body) el(details, "p", block.body).className = "info";
    }
  };
  const itemButton = (cell: HTMLElement, item: ItemRow, badge: string | null): void => {
    const b = button(cell, `${item.label}${badge ? ` ${badge}` : ""}`, () => { selected = item.key; changes.acknowledge(item); paint(true); });
    b.className = "row"; b.style.color = item.colour; b.setAttribute("aria-pressed", String(selected === item.key));
    b.title = [badge === "NEW" ? "Newly acquired" : badge ? `${badge.slice(1)} acquired` : "", item.inscription ? `Inscription: ${item.inscription}` : ""].filter(Boolean).join("\n");
  };
  const paint = (force = false): void => {
    if (closed) return;
    const host = surfaces.mounts().get("items");
    if (!host) return;
    if (host !== mount) { mount = host; signature = ""; }
    const model = read();
    // The store window owns these pixels and prompts during a store visit.
    ((mount.getRootNode() as ShadowRoot).host as HTMLElement).style.display = model?.phase === "store" ? "none" : "";
    if (model?.phase === "store") return;
    if (model && ignoreEpoch !== model.token.epoch) { ignoredHere.clear(); ignoreEpoch = model.token.epoch; }
    const next = JSON.stringify([model, tab, search, selected, promptChoice, unchanged, quantity, error, slotChoice, [...ignoredHere], ruleFilter]);
    if (!force && next === signature) return; signature = next;
    // Keep the caret in a text field that a repaint rebuilds.
    const active = (mount.getRootNode() as ShadowRoot).activeElement as HTMLInputElement | null;
    const focusKey = active && mount.contains(active) ? active.dataset?.["focus"] : undefined;
    const caret = focusKey ? [active!.selectionStart, active!.selectionEnd] as const : null;
    mount.replaceChildren();
    build(model);
    if (focusKey) {
      const field = mount.querySelector<HTMLInputElement>(`[data-focus="${focusKey}"]`);
      field?.focus(); if (field && caret && caret[0] !== null) field.setSelectionRange(caret[0], caret[1]);
    }
  };
  const build = (model: ItemsModel | null): void => {
    el(mount, "h2", "Items");
    if (!model) { el(mount, "p", "Inventory read unavailable."); return; }
    if (enabled("Highlights")) changes.update(model);
    showPrompt(model);
    showRules(model);
    if (!enabled("Lists")) return;
    // The pile under the character sits above the tabs, as in upstream's panel.
    if (model.floor?.length) {
      el(mount, "h3", "On this tile");
      const table = el(mount, "table"); const head = el(table, "tr"); for (const name of ["Item", "Qty"]) el(head, "th", name);
      for (const item of model.floor) { const row = el(table, "tr"); itemButton(el(row, "td"), item, null); el(row, "td", String(item.quantity)); }
    }
    const tabs = el(mount, "div"); tabs.className = "tabs";
    for (const name of ["pack", "equipment", "quiver"] as const) { const b = button(tabs, TAB_NAMES[name], () => { tab = name; paint(true); }); b.setAttribute("aria-pressed", String(tab === name)); }
    const searchBox = el(mount, "input") as HTMLInputElement; searchBox.type = "search"; searchBox.placeholder = "Search items"; searchBox.value = search; searchBox.dataset["focus"] = "item-search";
    searchBox.addEventListener("input", () => { search = searchBox.value; paint(true); });
    const listed = tab === "quiver" ? model.quiver ?? [] : model.rows.filter((item) => item.location === tab);
    const rows = listed.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));
    if (!rows.length) el(mount, "p", tab === "pack" ? "Your pack is empty." : tab === "equipment" ? "Nothing equipped." : model.quiver ? "Your quiver is empty." : "No quiver items available.");
    const table = el(mount, "table"); const head = el(table, "tr"); for (const name of tab === "equipment" ? ["Item", "Slot", "Qty"] : ["Item", "Qty"]) el(head, "th", name);
    for (const item of rows) {
      const row = el(table, "tr"); const badge = enabled("Highlights") ? changes.badge(item) : null; if (badge) row.className = "new";
      itemButton(el(row, "td"), item, badge);
      if (tab === "equipment") el(row, "td", item.slotName ?? String(item.slot ?? "")); el(row, "td", String(item.quantity));
    }
    const item = panelRows(model).find((row) => row.key === selected);
    if (item) {
      el(mount, "h3", "Inspection"); el(mount, "strong", item.label).style.color = item.colour;
      if (enabled("Actions") && item.handle > 0 && model.phase === "play" && !model.prompt && ctx.intent?.submit && playerIsDriving(ctx)) {
        const actions = el(mount, "div"); actions.className = "actions";
        for (const code of ACTIONS) { if (code === "use" ? USE_CODES.some((candidate) => usable(model, item, candidate)) : usable(model, item, code)) button(actions, ACTION_LABELS[code], () => act(model, item, code)); }
        const kind = ignoredHere.has(item.key) ? "unignore" : "ignore";
        if (intentAvailable(ctx, kind) && usable(model, item, "ignore")) {
          button(actions, kind === "ignore" ? "Ignore" : "Unignore", () => ignore(model, item, kind));
        }
      }
      showComparison(model, item);
      showInspection(model, item);
    }
    if (error) { const message = el(mount, "p", error); message.className = "error"; }
  };
  paint(true);
  const timer = globalThis.setInterval(() => paint(), 200);
  repaint = () => paint(true);
  return () => { closed = true; globalThis.clearInterval(timer); surfaces.close(); };
}
