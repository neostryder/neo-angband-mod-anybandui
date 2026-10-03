/**
 * The read-only character sheet. Values come from ctx.character.sheet(), the
 * same panels, stat rows and flag grid the character screen draws.
 */
import type { CharacterSheetData } from "@rpgm-tools/neo-angband-core";
import { openSurfaces } from "./surface.js";
import type { SurfaceContext } from "./surface.js";

export const STAT_HEADERS = ["Stat", "Base", "Race", "Class", "Gear", "Best", "Current"] as const;
export const SHEET_PAGES = ["Overview", "Combat", "Flags", "History"] as const;

const OVERVIEW = new Set(["topleft", "misc", "midleft"]);
const COMBAT = new Set(["combat", "skills"]);
const PANEL_TITLE: Readonly<Record<string, string>> = {
  topleft: "Name", misc: "Age", midleft: "Level", combat: "Combat", skills: "Skills",
};

const CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.sheet{position:absolute;left:12px;right:12px;bottom:12px;max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
button{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px;cursor:pointer}
button:focus-visible{outline:2px solid var(--anyband-accent)}
.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}
table{width:100%;border-collapse:collapse}td,th{padding:2px 4px;border-bottom:1px solid var(--anyband-accent);text-align:right}
td:first-child,th:first-child{text-align:left}
.drained{opacity:.55}.history{white-space:pre-wrap}.muted{opacity:.65}
.grid{overflow:auto;margin:8px 0}.cells{font:inherit;letter-spacing:.2em}`;

export interface CharacterSheetContext extends SurfaceContext {
  readonly character?: { sheet?(): CharacterSheetData | null } | undefined;
}

export interface StatCells {
  readonly label: string;
  readonly base: string;
  readonly race: string;
  readonly classBonus: string;
  readonly gear: string;
  readonly best: string;
  readonly current: string;
  readonly drained: boolean;
}

/** The game prints "!" in place of the colon when a stat is already at its cap. */
export function statLabel(label: string, naturalMax: boolean): string {
  if (!naturalMax || label.includes("!")) return label;
  const colon = label.indexOf(":");
  if (colon < 0) return `${label}!`;
  return `${label.slice(0, colon)}!${label.slice(colon + 1)}`;
}

export function statCells(row: CharacterSheetData["stats"][number]): StatCells {
  return {
    label: statLabel(row.label, row.naturalMax),
    base: row.natural, race: row.raceBonus, classBonus: row.classBonus, gear: row.equipBonus, best: row.best,
    current: row.reduced ?? row.best, drained: row.drained,
  };
}

export function stepSheetPage(index: number, key: string): number | null {
  const count = SHEET_PAGES.length;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  return null;
}

function pageFocus(index: number): string {
  const name = SHEET_PAGES[index] ?? "Overview";
  return `sheet-page-${name.toLowerCase()}`;
}

function el(parent: Element, tag: string, text?: string): HTMLElement {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== undefined) child.textContent = text;
  parent.appendChild(child);
  return child;
}

function panelTitle(key: string): string {
  return PANEL_TITLE[key] ?? key;
}

function drawPanel(parent: HTMLElement, panel: CharacterSheetData["panels"][number]): void {
  el(parent, "h3", panelTitle(panel.key));
  const table = el(parent, "table");
  for (const line of panel.lines) {
    if (!line.label && !line.value) continue;
    const row = el(table, "tr");
    el(row, "td", line.label);
    const value = el(row, "td", line.value);
    if (line.css) value.style.color = line.css;
  }
}

function drawStats(parent: HTMLElement, data: CharacterSheetData): void {
  el(parent, "h3", "Attributes");
  const table = el(parent, "table");
  const head = el(table, "tr");
  for (const name of STAT_HEADERS) el(head, "th", name);
  for (const row of data.stats) {
    const cells = statCells(row);
    const tr = el(table, "tr");
    if (cells.drained) tr.className = "drained";
    for (const value of [cells.label, cells.base, cells.race, cells.classBonus, cells.gear, cells.best, cells.current]) el(tr, "td", value);
  }
}

function drawGrids(parent: HTMLElement, data: CharacterSheetData): void {
  if (!data.grids) { el(parent, "p", "The flag grid is not available in this game.").className = "muted"; return; }
  if (!data.grids.length) { el(parent, "p", "No flags.").className = "muted"; return; }
  for (const grid of data.grids) {
    el(parent, "h3", panelTitle(grid.key));
    const table = el(parent, "table");
    table.className = "grid";
    for (const row of grid.rows) {
      const tr = el(table, "tr");
      const label = el(tr, "td", row.label);
      if (row.labelColor.css) label.style.color = row.labelColor.css;
      const symbols = el(tr, "td");
      symbols.className = "cells";
      for (const cell of row.cells) {
        const mark = el(symbols, "span", cell.symbol || " ");
        if (cell.css) mark.style.color = cell.css;
      }
    }
  }
}

export function renderCharacterSheet(parent: HTMLElement, data: CharacterSheetData | null, page: number, onPage: (page: number, moveFocus?: boolean) => void): void {
  el(parent, "h2", data?.name ? data.name : "Character");
  const tabs = el(parent, "div");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");
  SHEET_PAGES.forEach((name, index) => {
    const button = el(tabs, "button", name) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === page));
    button.dataset["focus"] = pageFocus(index);
    button.addEventListener("click", () => onPage(index));
  });
  tabs.addEventListener("keydown", (event) => {
    const next = stepSheetPage(page, event.key);
    if (next === null) return;
    event.preventDefault();
    onPage(next, true);
  });
  if (!data) { el(parent, "p", "Character sheet unavailable.").className = "muted"; return; }
  const name = SHEET_PAGES[page] ?? "Overview";
  if (name === "Overview") {
    for (const panel of data.panels) if (OVERVIEW.has(panel.key)) drawPanel(parent, panel);
    for (const panel of data.panels) if (!OVERVIEW.has(panel.key) && !COMBAT.has(panel.key)) drawPanel(parent, panel);
    drawStats(parent, data);
  } else if (name === "Combat") {
    const panels = data.panels.filter((panel) => COMBAT.has(panel.key));
    if (!panels.length) el(parent, "p", "No combat details.").className = "muted";
    for (const panel of panels) drawPanel(parent, panel);
  } else if (name === "Flags") drawGrids(parent, data);
  else {
    el(parent, "h3", "History");
    el(parent, "p", data.history || "No background.").className = data.history ? "history" : "history muted";
  }
}

export function installCharacterSheet(ctx: CharacterSheetContext): () => void {
  if (ctx.flags?.["anybandui.characterSheet"] !== true) return () => {};
  if (!ctx.character?.sheet) ctx.log("character sheet: this game has no sheet read");
  let page = 0;
  let repaint = (): void => {};
  const surfaces = openSurfaces(ctx, [{ key: "character-sheet", label: "Character sheet", tab: "Character", minSize: { width: 360, height: 220 }, placement: { kind: "dock", target: "main", edge: "bottom" } }],
    { id: "character-sheet", label: "Character sheet", className: "sheet" }, CSS, () => repaint());
  if (!surfaces) { ctx.log("character sheet: panel seam unavailable"); return () => {}; }
  let mount: HTMLElement | null = null;
  let signature = "";
  let closed = false;
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  const read = (): CharacterSheetData | null => {
    try { return ctx.character?.sheet?.() ?? null; } catch { return null; }
  };
  // The interval follows the mount. A closed overlay or an unmounted pane has none, and opening the sheet starts it again.
  const stopTimer = (): void => {
    if (timer === null) return;
    globalThis.clearInterval(timer);
    timer = null;
  };
  const ensureTimer = (): void => {
    if (timer !== null || closed) return;
    timer = globalThis.setInterval(() => paint(), 200);
  };
  const paint = (force = false, nextFocus?: string): void => {
    if (closed) return;
    const host = surfaces.mounts().get("character-sheet");
    if (!host) { stopTimer(); return; }
    ensureTimer();
    if (host !== mount) { mount = host; signature = ""; }
    const data = read();
    const next = JSON.stringify([page, data]);
    if (!force && next === signature) return;
    signature = next;
    const active = (mount.getRootNode() as ShadowRoot).activeElement as HTMLElement | null;
    const focusKey = nextFocus ?? (active && mount.contains(active) ? active.dataset?.["focus"] : undefined);
    mount.replaceChildren();
    renderCharacterSheet(mount, data, page, (index, moveFocus) => { page = index; paint(true, moveFocus ? pageFocus(index) : undefined); });
    if (focusKey) mount.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
  };
  paint(true);
  repaint = () => paint(true);
  return () => { closed = true; stopTimer(); surfaces.close(); };
}
