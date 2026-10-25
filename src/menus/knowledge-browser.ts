/**
 * The knowledge browser (AnybandUI knowledge_browser.h): a tab per category,
 * a search box over names and groups, a group filter, the entries on the left
 * and the selected entry's recall page on the right. The lists and pages are
 * the game's own, read through ctx.knowledge, and reading one changes nothing.
 * The Known only switch hides object flavours the player has seen but not
 * identified, and starts on, as upstream's does (knowledge_browser.h:4, :34).
 */
import type { KnowledgeCategoryView, KnowledgeEntryView, KnowledgeListView, ModKnowledge } from "@rpgm-tools/neo-angband-core";
import type { ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import type { SurfaceContext } from "../panels/surface.js";
import { button, el, listStep, matches, swallow } from "./keys.js";
import { openMenuSurface } from "./menu-surface.js";
import { renderScreenView } from "./screen-view.js";

export const KNOWLEDGE_KEY = "knowledge-browser";
const REFRESH_MS = 1000;

export interface KnowledgeContext extends SurfaceContext {
  readonly knowledge?: Pick<ModKnowledge, "categories" | "list" | "recall"> | undefined;
}

export interface KnowledgeState {
  category: string;
  group: string;
  search: string;
  selected: string | null;
  knownOnly: boolean;
}

export interface VisibleEntry { readonly group: string; readonly entry: KnowledgeEntryView }

/** The entries the known-only switch, search and group filter leave, in the game's order (knowledge_browser.h:56). */
export function visibleEntries(list: KnowledgeListView | null, group: string, search: string, knownOnly = false): VisibleEntry[] {
  const out: VisibleEntry[] = [];
  for (const g of list?.groups ?? []) {
    if (group && g.name !== group) continue;
    for (const entry of g.entries) {
      if (knownOnly && !entry.known) continue;
      if (matches(`${entry.name} ${g.name}`, search)) out.push({ group: g.name, entry });
    }
  }
  return out;
}

const entryFocus = (id: string): string => `entry:${id}`;
const tabFocus = (id: string): string => `tab:${id}`;

interface Model {
  readonly categories: readonly KnowledgeCategoryView[];
  readonly list: KnowledgeListView | null;
  readonly visible: readonly VisibleEntry[];
  readonly recall: ScreenView | null;
  readonly error: string;
}

export function installKnowledgeBrowser(ctx: KnowledgeContext): () => void {
  if (ctx.flags?.["anybandui.knowledgeBrowser"] !== true) return () => {};
  if (!ctx.knowledge) ctx.log("knowledge browser: this game does not share its knowledge lists");
  const state: KnowledgeState = { category: "", group: "", search: "", selected: null, knownOnly: true };
  let signature = "";
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;

  const read = (): Model => {
    const seam = ctx.knowledge;
    if (!seam) return { categories: [], list: null, visible: [], recall: null, error: "This game does not share its knowledge lists." };
    try {
      const categories = seam.categories();
      if (!categories.some((c) => c.id === state.category)) {
        state.category = (categories.find((c) => c.count > 0) ?? categories[0])?.id ?? "";
        state.group = ""; state.selected = null;
      }
      const list = state.category ? seam.list(state.category) : null;
      if (state.group && !list?.groups.some((g) => g.name === state.group)) state.group = "";
      const visible = visibleEntries(list, state.group, state.search, state.knownOnly);
      // knowledge_browser.h:61: a selection the filter hides moves to the first entry left.
      if (!visible.some((v) => v.entry.id === state.selected)) state.selected = visible[0]?.entry.id ?? null;
      const recall = state.selected ? seam.recall(state.category, state.selected) : null;
      return { categories, list, visible, recall, error: "" };
    } catch (err) {
      return { categories: [], list: null, visible: [], recall: null, error: `The knowledge lists could not be read: ${err instanceof Error ? err.message : String(err)}` };
    }
  };

  let surface: ReturnType<typeof openMenuSurface> = null;
  const repaint = (focusKey?: string): void => surface?.repaint(focusKey);
  const choose = (category: string, focusKey?: string): void => {
    if (category === state.category) { repaint(focusKey); return; }
    state.category = category; state.group = ""; state.selected = null;
    repaint(focusKey);
  };

  const render = (mount: HTMLElement): void => {
    const model = read();
    signature = JSON.stringify([state, model]);
    el(mount, "h2", "Knowledge");
    if (model.error) { el(mount, "p", model.error).className = "muted"; return; }
    const tabs = el(mount, "div");
    tabs.className = "tabs";
    tabs.setAttribute("role", "tablist");
    const usable = model.categories.filter((c) => c.count > 0 || c.id === state.category);
    for (const category of model.categories) {
      const tab = button(tabs, category.title, tabFocus(category.id), () => choose(category.id, tabFocus(category.id)));
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(category.id === state.category));
      tab.disabled = category.count === 0 && category.id !== state.category;
    }
    tabs.addEventListener("keydown", (event: KeyboardEvent) => {
      const at = usable.findIndex((c) => c.id === state.category);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        swallow(event);
        const next = usable[(at + (event.key === "ArrowRight" ? 1 : usable.length - 1)) % usable.length];
        if (next) choose(next.id, tabFocus(next.id));
      } else if (event.key === "ArrowDown") {
        swallow(event);
        repaint(state.selected ? entryFocus(state.selected) : "search");
      }
    });
    const controls = el(mount, "div");
    controls.className = "controls";
    const knownLabel = el(controls, "label");
    const known = el(knownLabel, "input");
    known.type = "checkbox";
    known.checked = state.knownOnly;
    known.dataset["focus"] = "known-only";
    known.title = "Hide item types whose identity you have not learned.";
    known.addEventListener("change", () => { state.knownOnly = known.checked; repaint("known-only"); });
    el(knownLabel, "span", " Known only");
    const search = el(controls, "input");
    search.type = "search";
    search.placeholder = "Search by name or group";
    search.value = state.search;
    search.dataset["focus"] = "search";
    search.setAttribute("aria-label", "Search knowledge");
    search.addEventListener("input", () => { state.search = search.value; repaint(); });
    search.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "Enter") { swallow(event); if (state.selected) repaint(entryFocus(state.selected)); }
      else if (event.key === "Escape") { swallow(event); repaint(tabFocus(state.category)); }
    });
    const groups = el(controls, "select");
    groups.dataset["focus"] = "group";
    groups.setAttribute("aria-label", "Group");
    const all = el(groups, "option", "All groups");
    all.value = "";
    for (const g of model.list?.groups ?? []) { const option = el(groups, "option", g.name); option.value = g.name; }
    groups.value = state.group;
    groups.addEventListener("change", () => { state.group = groups.value; repaint(); });
    groups.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") { swallow(event); repaint(tabFocus(state.category)); }
    });

    const split = el(mount, "div");
    split.className = "split";
    const left = el(split, "div");
    const count = model.visible.length;
    el(left, "p", `${count} ${count === 1 ? "entry" : "entries"}`).className = "muted";
    const list = el(left, "div");
    list.className = "list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", model.list?.title ?? "Entries");
    if (count === 0) {
      const empty = (model.list?.groups.length ?? 0) === 0
        ? "No entries discovered yet. Your knowledge grows as you explore."
        : "No matching entries.";
      el(left, "p", empty).className = "muted";
    }
    let lastGroup = "";
    for (const { group, entry } of model.visible) {
      if (!state.group && group !== lastGroup) { el(list, "div", group).className = "section"; lastGroup = group; }
      const row = button(list, "", entryFocus(entry.id), () => { state.selected = entry.id; repaint(entryFocus(entry.id)); });
      row.className = "row";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(entry.id === state.selected));
      const name = el(row, "span", entry.name);
      name.style.color = entry.color;
      if (entry.cells && entry.cells.length > 0) {
        const cells = el(row, "span");
        cells.className = "cells";
        for (const cell of entry.cells) { const part = el(cells, "span", ` ${cell.text}`); part.style.color = cell.color; }
      }
    }
    list.addEventListener("keydown", (event: KeyboardEvent) => {
      const ids = model.visible.map((v) => v.entry.id);
      const at = state.selected ? ids.indexOf(state.selected) : -1;
      const next = listStep(event.key, at, ids.length);
      if (next !== null) { swallow(event); state.selected = ids[next] ?? null; repaint(state.selected ? entryFocus(state.selected) : undefined); return; }
      if (event.key === "ArrowRight" || event.key === "Enter") { swallow(event); repaint("detail"); return; }
      if (event.key === "Escape") { swallow(event); repaint("search"); }
    });

    const detail = el(split, "div");
    detail.className = "detail";
    detail.tabIndex = 0;
    detail.dataset["focus"] = "detail";
    detail.setAttribute("aria-live", "polite");
    if (!state.selected) el(detail, "p", "Select an entry to read about it.").className = "muted";
    else if (!model.recall) el(detail, "p", "Nothing more is known about this yet.").className = "muted";
    else renderScreenView(detail, model.recall);
    detail.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "ArrowLeft") { swallow(event); repaint(state.selected ? entryFocus(state.selected) : "search"); }
    });
  };

  surface = openMenuSurface(ctx, { key: KNOWLEDGE_KEY, label: "Knowledge", tab: "Knowledge", minSize: { width: 420, height: 260 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: "search" }, render);
  if (!surface) { ctx.log("knowledge browser: panel seam unavailable"); return () => {}; }
  // The lists grow as the character learns; redraw only when what they show changed.
  timer = globalThis.setInterval(() => {
    if (!surface?.mounted()) return;
    const before = signature;
    const model = read();
    if (JSON.stringify([state, model]) !== before) repaint();
  }, REFRESH_MS);
  return () => {
    if (timer !== null) globalThis.clearInterval(timer);
    timer = null;
    surface?.close();
    surface = null;
  };
}
