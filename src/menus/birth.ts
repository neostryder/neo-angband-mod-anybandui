/**
 * The character creation wizard, AnybandUI's birth_panel.h, as a `birth`
 * presenter over Core's birth session (`ui:birth.replace`).
 *
 * Each step is a modal panel stacked on the one before it. Next opens the next
 * step's panel and Back closes the top one, so Escape, which the host keeps for
 * itself and uses to close the top panel, also backs out one step. Escape on the
 * first screen leaves creation for the title screen, as Core's own birth
 * screens do.
 */
import type { BirthDraftView, ModBirthSession, ModPanel, ModPanelSpec } from "@rpgm-tools/neo-angband-core";
import { applyTheme, onThemeChange, type ThemeTokens } from "../theme.js";
import { themeFromPrefs } from "../settings.js";
import {
  BirthWizard, choiceView, nextStep, previewSummary, STEP_LABELS, statKey, statRows, stepChoice, stepNumber, WIZARD_STEPS, signed,
  type BirthStep, type StatRowView,
} from "./birth-model.js";

export const BIRTH_FLAG = "anybandui.birthWizard";

/** What the host calls before it shows the birth screens; true takes this creation. */
export interface BirthPresenter { show(session: ModBirthSession): boolean | undefined }

type PanelHandle = Pick<ModPanel, "root" | "closed" | "close">;

export interface BirthWizardContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly ui?: { openPanel(spec: ModPanelSpec): PanelHandle } | undefined;
  readonly prefs?: { get(): unknown } | undefined;
  readonly log: (message: string) => void;
}

const CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.backdrop{position:absolute;inset:0;overflow:auto;background:var(--anyband-background);padding:16px;box-sizing:border-box}
.birth{max-width:1100px;margin:0 auto;padding:12px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
h2,h3,h4{margin:6px 0;color:var(--anyband-accent)}h4{font-size:1em}
button,input,textarea{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
button{cursor:pointer}button:disabled,button[aria-disabled="true"]{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible,li:focus-visible{outline:2px solid var(--anyband-accent)}
.progress{height:4px;background:var(--anyband-background);border-radius:2px;margin:4px 0 10px}.progress>div{height:100%;background:var(--anyband-accent);border-radius:2px}
.layout{display:grid;grid-template-columns:minmax(0,62fr) minmax(0,38fr);gap:14px}
@media (max-width:760px){.layout{grid-template-columns:minmax(0,1fr)}}
.preview{border-left:1px solid var(--anyband-accent);padding-left:12px}
@media (max-width:760px){.preview{border-left:0;padding-left:0;border-top:1px solid var(--anyband-accent)}}
ul.choices{list-style:none;margin:0 0 8px;padding:0;max-height:220px;overflow:auto;border:1px solid var(--anyband-accent);border-radius:3px}
ul.choices li{padding:3px 8px;cursor:pointer}ul.choices li[aria-selected="true"]{background:var(--anyband-accent);color:var(--anyband-background)}
table{width:100%;border-collapse:collapse}td,th{padding:2px 4px;text-align:right}td:first-child,th:first-child{text-align:left}
th{opacity:.7;font-weight:normal}tr:nth-child(even) td{background:color-mix(in srgb,var(--anyband-background) 55%,transparent)}
.metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin:4px 0}
.metric{padding:4px 6px;border:1px solid var(--anyband-accent);border-radius:3px}.metric b{display:block}
.ability{margin:6px 0;padding:6px;border:1px solid var(--anyband-accent);border-radius:4px}.ability h4{margin:0 0 4px}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.footer{display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--anyband-accent);margin-top:10px;padding-top:8px}
.footer .nav{margin-left:auto;display:flex;gap:6px}
.error{color:var(--anyband-accent);font-weight:bold}.muted{opacity:.7}.history{white-space:pre-wrap}
.adjust button{min-width:2em;padding:0 4px}
label.field{display:block;margin:6px 0 2px}input.name{width:100%;box-sizing:border-box}textarea{width:100%;box-sizing:border-box;resize:vertical}
details{margin:8px 0}summary{cursor:pointer}details label{display:flex;gap:6px;align-items:flex-start;margin:3px 0}`;

function el(parent: Element, tag: string, text?: string, className?: string): HTMLElement {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== undefined) child.textContent = text;
  if (className) child.className = className;
  parent.appendChild(child);
  return child;
}

function button(parent: Element, label: string, focus: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const node = el(parent, "button", label) as HTMLButtonElement;
  node.type = "button";
  node.dataset["focus"] = focus;
  if (disabled) node.disabled = true;
  node.addEventListener("click", () => { if (!node.disabled) onClick(); });
  return node;
}

/** What a step's controls do. The stack below owns the panels. */
export interface StepActions {
  /**
   * Run a session change and repaint this step. `build` is false for the name,
   * background and options, which leave the starting build alone. `focus` moves
   * the caret after the repaint; without it the caret stays where it was.
   */
  act(change: (session: ModBirthSession) => ReturnType<ModBirthSession["buy"]>, build?: boolean, focus?: string): void;
  /** Open a step on top of this one. */
  open(step: BirthStep): void;
  /** Close this step and show the one below. */
  back(): void;
  canGoBack: boolean;
  usePrevious(): void;
  accept(): void;
  cancel(): void;
  repaint(focus?: string): void;
  /** Which collapsible sections are open, kept across repaints. */
  readonly expanded: Set<string>;
}

function collapsible(parent: HTMLElement, key: string, title: string, actions: StepActions): HTMLElement {
  const details = el(parent, "details") as HTMLDetailsElement;
  if (actions.expanded.has(key)) details.open = true;
  const summary = el(details, "summary", title);
  summary.dataset["focus"] = `section-${key}`;
  details.addEventListener("toggle", () => { if (details.open) actions.expanded.add(key); else actions.expanded.delete(key); });
  return details;
}

/** birth_panel.h:122-125 and :188-191. */
function birthOptions(parent: HTMLElement, draft: BirthDraftView, actions: StepActions): void {
  if (!draft.options.length) return;
  const details = collapsible(parent, "options", "Birth options", actions);
  for (const option of draft.options) {
    const label = el(details, "label");
    const box = el(label, "input") as HTMLInputElement;
    box.type = "checkbox";
    box.checked = option.value;
    box.dataset["focus"] = `option-${option.name}`;
    box.setAttribute("aria-label", option.description || option.name);
    box.addEventListener("change", () => actions.act((s) => s.setOption(option.name, box.checked), false));
    el(label, "span", option.description || option.name);
  }
}

/** birth_panel.h:65-93. Editable rows carry Spent and the - and + buttons. */
export function statTable(parent: HTMLElement, rows: readonly StatRowView[], editable: boolean, pointsLeft: number, actions: StepActions): void {
  const table = el(parent, "table");
  const head = el(table, "tr");
  for (const name of ["Stat", "Base", "Race", "Class", "Total", ...(editable ? ["Spent", "Adjust"] : [])]) el(head, "th", name);
  for (const row of rows) {
    const tr = el(table, "tr");
    for (const value of [row.name, row.base, row.race, row.cls, row.total]) el(tr, "td", value);
    if (!editable) continue;
    el(tr, "td", String(row.spent));
    const cell = el(tr, "td", undefined, "adjust");
    /* aria-disabled rather than disabled keeps the buttons focusable for the
     * row keys below, so each handler checks the same condition itself. */
    const canBuy = !row.atMaximum && pointsLeft > 0;
    const sell = button(cell, "-", `sell-${row.index}`, () => { if (row.canSell) actions.act((s) => s.sell(row.index)); });
    sell.setAttribute("aria-label", `Refund a point from ${row.name}`);
    if (!row.canSell) sell.setAttribute("aria-disabled", "true");
    const buy = button(cell, "+", `buy-${row.index}`, () => { if (canBuy) actions.act((s) => s.buy(row.index)); });
    buy.setAttribute("aria-label", `Spend points on ${row.name}`);
    /* Core's draft has no per-stat cost, so the hint gives what it has and
     * a refused buy says why. */
    buy.title = row.atMaximum ? "Base stat is at its maximum." : `Spends points. ${pointsLeft} remaining.`;
    if (!canBuy) buy.setAttribute("aria-disabled", "true");
    for (const [node, kind] of [[sell, "sell"], [buy, "buy"]] as const) {
      node.addEventListener("keydown", (event: KeyboardEvent) => {
        const action = statKey(event.key);
        if (!action) return;
        event.preventDefault();
        if (action === "up" || action === "down") {
          const next = row.index + (action === "up" ? -1 : 1);
          if (next >= 0 && next < rows.length) actions.repaint(`${kind}-${next}`);
          return;
        }
        if (action === "buy") { if (canBuy) actions.act((s) => s.buy(row.index), true, `${kind}-${row.index}`); }
        else if (row.canSell) actions.act((s) => s.sell(row.index), true, `${kind}-${row.index}`);
      });
    }
  }
}

/** birth_panel.h:192-198: the right-hand column. */
function previewColumn(parent: HTMLElement, wizard: BirthWizard, draft: BirthDraftView, actions: StepActions): void {
  const column = el(parent, "div", undefined, "preview");
  column.setAttribute("aria-label", "Character preview");
  el(column, "h3", "Character preview");
  el(column, "p", draft.name || "No name yet", draft.name ? undefined : "muted");
  el(column, "p", [draft.race, draft.cls].filter(Boolean).join(" ") || "Choose a race and a class.");
  if (!draft.preview) {
    el(column, "p", "The preview appears once a race and a class are chosen.", "muted");
    return;
  }
  const summary = previewSummary(draft);
  el(column, "p", `HP ${summary.hp}    SP ${summary.sp}`);
  el(column, "p", `Starting funds: ${summary.gold ?? 0} gold`);
  el(column, "p", "Starting equipment is deducted from these funds.", "muted");
  statTable(column, statRows(draft, wizard.catalogue), false, draft.pointsLeft, actions);
  if (draft.history) el(column, "p", draft.history, "history");
}

/** birth_panel.h:34-64 and :179-187 for the race and class steps. */
function choiceStep(parent: HTMLElement, wizard: BirthWizard, draft: BirthDraftView, list: "races" | "classes", actions: StepActions): void {
  const entries = wizard.catalogue[list];
  const current = list === "races" ? draft.race : draft.cls;
  const choose = (name: string): void => actions.act((s) => list === "races" ? s.chooseRace(name) : s.chooseClass(name), true, `choice-${name}`);
  const names = entries.map((entry) => entry.name);
  const ul = el(parent, "ul", undefined, "choices");
  ul.setAttribute("role", "listbox");
  ul.setAttribute("aria-label", list === "races" ? "Race" : "Class");
  for (const name of names) {
    const li = el(ul, "li", name);
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(name === current));
    li.setAttribute("tabindex", name === current || (current === null && name === names[0]) ? "0" : "-1");
    li.dataset["focus"] = `choice-${name}`;
    li.addEventListener("click", () => choose(name));
    li.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(name); return; }
      const next = stepChoice(names, current ?? name, event.key);
      if (next === null) return;
      event.preventDefault();
      if (next !== current) choose(next);
      else actions.repaint(`choice-${next}`);
    });
  }
  const selected = entries.find((entry) => entry.name === current);
  if (!selected) { el(parent, "p", list === "races" ? "Choose a race." : "Choose a class.", "muted"); return; }
  const view = choiceView(selected, list === "classes" ? wizard.catalogue.races.find((race) => race.name === draft.race) ?? null : null);
  const modifiers = el(parent, "table");
  const head = el(modifiers, "tr");
  const values = el(modifiers, "tr");
  wizard.catalogue.stats.forEach((stat, index) => { el(head, "th", stat); el(values, "td", signed(view.modifiers[index] ?? 0)); });
  el(parent, "h3", "Traits");
  const metrics = el(parent, "div", undefined, "metrics");
  for (const trait of view.traits) {
    const metric = el(metrics, "div", undefined, "metric");
    el(metric, "span", trait.label, "muted");
    el(metric, "b", trait.value);
    if (trait.note) el(metric, "span", trait.note, "muted");
  }
  if (view.abilities.length) {
    el(parent, "h3", "Abilities");
    for (const ability of view.abilities) {
      const card = el(parent, "div", undefined, "ability");
      el(card, "h4", ability.name);
      if (ability.description) el(card, "p", ability.description);
    }
  }
  if (view.skills.length) {
    const details = collapsible(parent, `skills-${list}`, "Skill modifiers", actions);
    const table = el(details, "table");
    for (const skill of view.skills) { const tr = el(table, "tr"); el(tr, "td", skill.label); el(tr, "td", skill.value); }
  }
}

/** birth_panel.h:150-165. */
function attributesStep(parent: HTMLElement, wizard: BirthWizard, draft: BirthDraftView, actions: StepActions): void {
  const methods = el(parent, "div", undefined, "row");
  methods.setAttribute("role", "radiogroup");
  methods.setAttribute("aria-label", "How to set your stats");
  for (const [method, label] of [["point", "Point buy"], ["roller", "Random rolls"]] as const) {
    const wrap = el(methods, "label");
    const radio = el(wrap, "input") as HTMLInputElement;
    radio.type = "radio";
    radio.name = "method";
    radio.checked = draft.method === method;
    radio.dataset["focus"] = `method-${method}`;
    radio.addEventListener("change", () => {
      if (!radio.checked || draft.method === method) return;
      actions.act((s) => method === "point" ? s.usePointBuy() : s.roll(), true, `method-${method}`);
    });
    el(wrap, "span", label);
  }
  const rows = statRows(draft, wizard.catalogue);
  if (draft.method === "point") {
    el(parent, "p", `Points remaining: ${draft.pointsLeft}`);
    el(parent, "p", draft.pointsLeft === 0
      ? "All points are allocated. Use - to free points, or Reset points to start from scratch."
      : "Use + to spend points and - to refund them. Race and class bonuses are added automatically.", "muted");
    statTable(parent, rows, true, draft.pointsLeft, actions);
    const row = el(parent, "div", undefined, "row");
    button(row, "Suggested allocation", "suggest", () => actions.act((s) => s.suggest()));
    button(row, "Reset points", "reset", () => actions.act((s) => s.reset()));
  } else {
    statTable(parent, rows, false, 0, actions);
    const row = el(parent, "div", undefined, "row");
    button(row, "Roll again", "roll", () => actions.act((s) => s.roll()));
    button(row, "Previous roll", "previous-roll", () => actions.act((s) => s.previousRoll()), !draft.canPreviousRoll);
  }
}

/** birth_panel.h:166-172. */
function identityStep(parent: HTMLElement, wizard: BirthWizard, draft: BirthDraftView, actions: StepActions): void {
  el(parent, "label", "Name", "field");
  const name = el(parent, "input", undefined, "name") as HTMLInputElement;
  name.type = "text";
  name.value = draft.name;
  name.maxLength = wizard.catalogue.nameMax;
  name.dataset["focus"] = "name";
  name.setAttribute("aria-label", "Name");
  if (wizard.catalogue.namePinned) { name.disabled = true; name.title = "The name is set for this game."; }
  name.addEventListener("input", () => actions.act((s) => s.setName(name.value), false));
  name.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    actions.open("review");
  });
  const nameRow = el(parent, "div", undefined, "row");
  button(nameRow, "Random name", "random-name", () => actions.act((s) => s.randomName(), false), wizard.catalogue.namePinned);
  el(parent, "label", "Background", "field");
  const history = el(parent, "textarea") as HTMLTextAreaElement;
  history.rows = 8;
  history.value = draft.history;
  history.dataset["focus"] = "history";
  history.setAttribute("aria-label", "Background");
  history.addEventListener("input", () => actions.act((s) => s.setHistory(history.value), false));
  const row = el(parent, "div", undefined, "row");
  const generated = wizard.generatedHistory;
  button(row, "Restore generated background", "restore-history", () => actions.act((s) => s.setHistory(generated), false),
    !draft.historyEdited || generated === "" || generated === draft.history);
  button(row, "New background", "new-history", () => actions.act((s) => s.regenerateHistory(), false), draft.race === null);
}

/** birth_panel.h:173-176, with the game's own five preview panels under it. */
function reviewStep(parent: HTMLElement, draft: BirthDraftView, actions: StepActions): void {
  el(parent, "p", `${draft.name || "No name yet"} - ${[draft.race, draft.cls].filter(Boolean).join(" ")}`);
  if (draft.history) el(parent, "p", draft.history, "history");
  if (!draft.ready) el(parent, "p", "Give your character a name before you start.", "muted");
  if (!draft.preview) return;
  const details = collapsible(parent, "sheet", "Character sheet", actions);
  for (const panel of draft.preview.panels) {
    const table = el(details, "table");
    for (const line of panel.lines) {
      if (!line.label.trim() && !line.value.trim()) continue;
      const tr = el(table, "tr");
      el(tr, "td", line.label);
      el(tr, "td", line.value);
    }
  }
}

function errorLine(parent: HTMLElement, wizard: BirthWizard): void {
  if (!wizard.error) return;
  const line = el(parent, "p", wizard.error, "error");
  line.setAttribute("role", "alert");
}

/** birth_panel.h:101-131: reuse the previous character, rename it, or start over. */
function previousScreen(parent: HTMLElement, wizard: BirthWizard, draft: BirthDraftView, actions: StepActions): void {
  el(parent, "h2", "Play again");
  el(parent, "p", draft.name || "No name yet");
  el(parent, "p", [draft.race, draft.cls].filter(Boolean).join(" "));
  el(parent, "p", "Reuse this character's starting choices or create a new character.");
  el(parent, "h3", "Starting attributes");
  statTable(parent, statRows(draft, wizard.catalogue), false, draft.pointsLeft, actions);
  if (draft.history) el(parent, "p", draft.history, "history");
  el(parent, "h3", "New character");
  button(parent, "Use previous character", "use-previous", () => actions.usePrevious(), !draft.ready);
  el(parent, "p", "Begin at level 1 with the same race, class and starting attributes.", "muted");
  button(parent, "Change name / background", "rename", () => actions.open("identity"));
  el(parent, "p", "Keep the character's starting build and give them a new identity.", "muted");
  button(parent, "Create a different character", "different", () => { actions.act((s) => s.suggest()); actions.open("race"); });
  el(parent, "p", "Choose race, class, attributes and identity in character creation.", "muted");
  birthOptions(parent, draft, actions);
  errorLine(parent, wizard);
  const footer = el(parent, "div", undefined, "footer");
  button(footer, "Return to main menu", "cancel", () => actions.cancel());
}

/** Draw one step's panel contents. */
export function renderBirthStep(mount: HTMLElement, wizard: BirthWizard, step: BirthStep, actions: StepActions): void {
  const draft = wizard.draft();
  const backdrop = el(mount, "div", undefined, "backdrop");
  const frame = el(backdrop, "section", undefined, "birth");
  if (step === "previous") { previousScreen(frame, wizard, draft, actions); return; }
  el(frame, "h2", "Create a character");
  const number = stepNumber(step);
  el(frame, "p", `Step ${number} of ${WIZARD_STEPS.length} - ${STEP_LABELS[step]}`);
  const bar = el(frame, "div", undefined, "progress");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "1");
  bar.setAttribute("aria-valuemax", String(WIZARD_STEPS.length));
  bar.setAttribute("aria-valuenow", String(number));
  el(bar, "div").style.width = `${(number / WIZARD_STEPS.length) * 100}%`;
  const layout = el(frame, "div", undefined, "layout");
  const choices = el(layout, "div");
  el(choices, "h3", STEP_LABELS[step]);
  if (step === "race" && wizard.catalogue.previous) button(choices, "Use previous character", "quick-start", () => { if (wizard.usePrevious()) actions.open("review"); else actions.repaint(); });
  if (step === "race") choiceStep(choices, wizard, draft, "races", actions);
  else if (step === "class") choiceStep(choices, wizard, draft, "classes", actions);
  else if (step === "attributes") attributesStep(choices, wizard, draft, actions);
  else if (step === "identity") identityStep(choices, wizard, draft, actions);
  else reviewStep(choices, draft, actions);
  birthOptions(choices, draft, actions);
  previewColumn(layout, wizard, draft, actions);
  errorLine(frame, wizard);
  const footer = el(frame, "div", undefined, "footer");
  button(footer, "Return to main menu", "cancel", () => actions.cancel());
  const nav = el(footer, "div", undefined, "nav");
  button(nav, "Back", "back", () => actions.back(), !actions.canGoBack);
  const next = nextStep(step);
  if (next) button(nav, "Next", "next", () => actions.open(next));
  else button(nav, "Start game", "start", () => actions.accept(), !draft.ready);
}

/** The control a freshly shown step puts the caret on. */
function firstFocus(step: BirthStep, wizard: BirthWizard): string {
  const draft = wizard.draft();
  if (step === "race") return `choice-${draft.race ?? wizard.catalogue.races[0]?.name ?? ""}`;
  if (step === "class") return `choice-${draft.cls ?? wizard.catalogue.classes[0]?.name ?? ""}`;
  if (step === "attributes") return draft.method === "point" ? "buy-0" : "roll";
  if (step === "identity") return wizard.catalogue.namePinned ? "random-name" : "name";
  if (step === "review") return draft.ready ? "start" : "back";
  return draft.ready ? "use-previous" : "rename";
}

interface Level {
  readonly step: BirthStep;
  readonly panel: PanelHandle;
  readonly mount: HTMLElement;
}

/** The panels of one creation, bottom step first. */
class BirthStack {
  private readonly levels: Level[] = [];
  private readonly expanded = new Set<string>();
  private readonly stopTheme: () => void;
  private serial = 0;

  constructor(private readonly ctx: BirthWizardContext & { readonly ui: NonNullable<BirthWizardContext["ui"]> }, private readonly wizard: BirthWizard, private theme: Readonly<ThemeTokens>) {
    this.stopTheme = onThemeChange((next) => {
      this.theme = next;
      for (const level of this.levels) applyTheme(level.panel.root, next);
    });
  }

  get depth(): number { return this.levels.length; }

  /** Open a step on top. Throws when the host refuses a panel. */
  push(step: BirthStep): void {
    const panel = this.ctx.ui.openPanel({ id: `birth-${++this.serial}`, modal: true, label: `Character creation: ${STEP_LABELS[step]}` });
    applyTheme(panel.root, this.theme);
    const style = panel.root.ownerDocument.createElement("style");
    style.textContent = CSS;
    panel.root.appendChild(style);
    const mount = panel.root.ownerDocument.createElement("div");
    panel.root.appendChild(mount);
    const level: Level = { step, panel, mount };
    this.levels.push(level);
    void panel.closed.then(() => this.closedElsewhere(level));
    this.paint(level, firstFocus(step, this.wizard));
  }

  /** The player (Escape or the close control) or the host closed a panel. */
  private closedElsewhere(level: Level): void {
    const index = this.levels.indexOf(level);
    if (index < 0) return;
    for (const above of this.levels.splice(index).slice(1)) above.panel.close();
    if (this.wizard.finished) return;
    if (!this.levels.length) { this.dispose(); this.wizard.cancel(); return; }
    this.leaveStep();
    this.showTop();
  }

  /** Draw the top step again, after the draft changed under it. */
  showTop(): void {
    const top = this.levels[this.levels.length - 1];
    if (top) this.paint(top, firstFocus(top.step, this.wizard));
  }

  /** Back: close the top step and show the one under it. */
  pop(): void {
    if (this.levels.length < 2) return;
    this.levels.pop()!.panel.close();
    this.leaveStep();
    this.showTop();
  }

  /** A refusal belongs to the step that caused it, so moving to another step drops it. */
  private leaveStep(): void { this.wizard.error = ""; }

  /** Close every panel; used once creation is accepted or cancelled. */
  closeAll(): void {
    for (const level of this.levels.splice(0).reverse()) level.panel.close();
    this.dispose();
  }

  private dispose(): void { this.stopTheme(); }

  paint(level: Level, focus?: string): void {
    const root = level.mount.getRootNode() as ShadowRoot | HTMLElement;
    const active = (root as { activeElement?: Element | null }).activeElement as (HTMLInputElement | null | undefined);
    const keep = focus ?? (active && level.mount.contains(active) ? active.dataset?.["focus"] : undefined);
    const caret = !focus && active && keep && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") ? [active.selectionStart, active.selectionEnd] as const : null;
    level.mount.replaceChildren();
    const isTop = this.levels[this.levels.length - 1] === level;
    const actions: StepActions = {
      act: (change, build, next) => { this.wizard.run(change, build); this.paint(level, next); },
      open: (step) => {
        this.leaveStep();
        if (step === "race") this.wizard.start();
        try { this.push(step); } catch (error) {
          this.wizard.error = `The next step could not open: ${error instanceof Error ? error.message : String(error)}`;
          this.paint(level);
        }
      },
      back: () => { if (isTop) this.pop(); },
      canGoBack: this.levels.indexOf(level) > 0,
      usePrevious: () => {
        if (this.wizard.usePrevious() && this.wizard.accept()) { this.closeAll(); return; }
        this.paint(level);
      },
      accept: () => { if (this.wizard.accept()) this.closeAll(); else this.paint(level); },
      cancel: () => { this.wizard.cancel(); this.closeAll(); },
      repaint: (next) => this.paint(level, next),
      expanded: this.expanded,
    };
    renderBirthStep(level.mount, this.wizard, level.step, actions);
    if (!keep) return;
    /* Compared as a string: a race or option name can hold quotes or brackets that would break a selector. */
    const target = Array.from(level.mount.querySelectorAll<HTMLInputElement>("[data-focus]")).find((node) => node.dataset["focus"] === keep)
      ?? level.mount.querySelector<HTMLElement>("button:not([disabled])") as HTMLInputElement | null;
    target?.focus();
    if (target && caret && caret[0] !== null && typeof target.setSelectionRange === "function") target.setSelectionRange(caret[0], caret[1]);
  }
}

/**
 * The `birth` presenter, or undefined when the switch is off or the game has no
 * panel seam; either way Core shows its own birth screens.
 */
export function installBirthWizard(ctx: BirthWizardContext): BirthPresenter | undefined {
  if (ctx.flags?.[BIRTH_FLAG] !== true) return undefined;
  const ui = ctx.ui;
  if (!ui) { ctx.log("character creation: panel seam unavailable, so the game shows its own birth screens"); return undefined; }
  let live: BirthStack | null = null;
  return {
    show(session: ModBirthSession): boolean {
      live?.closeAll();
      live = null;
      let wizard: BirthWizard;
      try { wizard = new BirthWizard(session); } catch (error) {
        ctx.log(`character creation: could not read the birth session (${error instanceof Error ? error.message : String(error)})`);
        return false;
      }
      const previous = wizard.catalogue.previous !== null;
      const stack = new BirthStack({ ...ctx, ui }, wizard, themeFromPrefs(ctx.prefs?.get()));
      /* The window opens before the draft is touched, so a refusal leaves the
       * session as the game's own screens expect it. */
      try { stack.push(previous ? "previous" : "race"); } catch (error) {
        stack.closeAll();
        ctx.log(`character creation: could not open its window (${error instanceof Error ? error.message : String(error)}), so the game shows its own birth screens`);
        return false;
      }
      try {
        if (previous) wizard.usePrevious();
        else wizard.start();
        stack.showTop();
      } catch (error) {
        stack.closeAll();
        ctx.log(`character creation: could not draw its first step (${error instanceof Error ? error.message : String(error)}), so the game shows its own birth screens`);
        return false;
      }
      live = stack;
      return true;
    },
  };
}
