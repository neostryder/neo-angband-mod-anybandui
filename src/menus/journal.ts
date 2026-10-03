/**
 * The run timeline (upstream run_journal.h): one model and one view for both the
 * live run journal and a graveyard record's Journal page.
 *
 * Angband's player history has no depth entries, so the new depths come from
 * this mod's own record of each new deepest level (run-journal.ts). Each one
 * goes after the history entries that existed when the level was reached. The
 * history stamps its turns from the player's energy, a different count from the
 * game turn a mod can read, so the two cannot be merged by turn.
 */
import type { CharacterHistoryEntry, RunReport } from "@rpgm-tools/neo-angband-core";
import { el, matches } from "./dialog.js";

export type JournalKind = "level" | "depth" | "unique" | "artifact" | "ending" | "other";

export interface JournalEntry {
  readonly kind: JournalKind;
  readonly text: string;
  /** A depth mark has null here, because this mod cannot read the energy-based turn count that history entries carry. */
  readonly turn: number | null;
  readonly depth: number;
  readonly level: number;
  readonly lost: boolean;
}

/** A new deepest level, as the depth recorder stores it. */
export interface DepthMark {
  readonly depth: number;
  readonly level: number;
  /** How many history entries there were when the level was reached. */
  readonly after: number;
}

export const JOURNAL_CATEGORIES = ["All milestones", "Level-ups", "New depths", "Unique victories", "Artifacts"] as const;
const CATEGORY_KIND: readonly (JournalKind | null)[] = [null, "level", "depth", "unique", "artifact"];

/** run_journal.h:27 */
export function journalSymbol(kind: JournalKind): string {
  return kind === "level" ? "+" : kind === "depth" ? ">" : kind === "unique" ? "!" : kind === "artifact" ? "*" : kind === "ending" ? "X" : "@";
}

/** run_journal.h:28, as CSS colours. */
export function journalTint(kind: JournalKind): string {
  return kind === "artifact" ? "#ebc266" : kind === "unique" || kind === "ending" ? "#e8806e" : kind === "depth" ? "#80bae3" : "#80c299";
}

export function depthText(depth: number): string {
  return `Reached ${depth * 50} ft (dungeon level ${depth}).`;
}

/**
 * The history as journal entries, oldest first. A drained level regained adds a
 * second entry for the same level, so only the first per level is kept.
 */
export function journalFromHistory(history: readonly CharacterHistoryEntry[], depths: readonly DepthMark[] = []): JournalEntry[] {
  const marks = [...depths].sort((a, b) => a.after - b.after);
  const merged: JournalEntry[] = [];
  const levels = new Set<number>();
  let d = 0;
  const depthsUpTo = (count: number): void => {
    while (d < marks.length && marks[d]!.after <= count) {
      const mark = marks[d++]!;
      merged.push({ kind: "depth", text: depthText(mark.depth), turn: null, depth: mark.depth, level: mark.level, lost: false });
    }
  };
  history.forEach((entry, index) => {
    depthsUpTo(index);
    const kind: JournalKind = entry.kind === "level" ? "level" : entry.kind === "unique" ? "unique"
      : entry.kind === "artifact" || entry.kind === "artifact-unknown" ? "artifact" : "other";
    if (kind === "level") {
      if (levels.has(entry.level)) return;
      levels.add(entry.level);
    }
    merged.push({ kind, text: entry.text, turn: entry.turn, depth: entry.depth, level: entry.level, lost: entry.lost });
  });
  depthsUpTo(Number.POSITIVE_INFINITY);
  return merged;
}

/** How a run ended, in the post-mortem's words. */
export function endingText(report: Pick<RunReport, "outcome" | "cause">): string {
  if (report.outcome === "winner") return "Won the game.";
  if (report.outcome === "retired") return "Retired.";
  return `Killed by ${report.cause}.`;
}

export function endingEntry(report: RunReport): JournalEntry {
  return { kind: "ending", text: endingText(report), turn: report.turn, depth: report.depth, level: report.level, lost: false };
}

/** run_journal.h:32 */
export function journalMeta(entry: JournalEntry): string {
  const where = `Lv ${entry.level}  /  ${entry.depth === 0 ? "Town" : `Depth ${entry.depth}`}`;
  return entry.turn === null ? where : `${where}  /  Turn ${entry.turn}`;
}

export interface JournalFilter {
  search: string;
  newest: boolean;
  category: number;
}

export function newJournalFilter(): JournalFilter {
  return { search: "", newest: true, category: 0 };
}

/** run_journal.h:6-9 and 22-24: the category, the search text, then the order. */
export function filterJournal(entries: readonly JournalEntry[], filter: JournalFilter): JournalEntry[] {
  const kind = CATEGORY_KIND[filter.category] ?? null;
  const shown = entries.filter((entry) => (kind === null || entry.kind === kind) && matches(entry.text, filter.search));
  return filter.newest ? shown.reverse() : shown;
}

export const JOURNAL_CSS = `.journal-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.timeline{list-style:none;margin:0;padding:0}
.timeline li{display:grid;grid-template-columns:2em 1fr;gap:8px;margin:0 0 6px}
.timeline .mark{display:flex;align-items:center;justify-content:center;height:2em;border:1px solid currentColor;border-radius:3px}
.timeline .entry{border:1px solid var(--anyband-accent);border-radius:calc(var(--anyband-rounding) * .6);padding:3px 8px}
.timeline .meta{display:block;font-size:.8em;opacity:.65}`;

export interface JournalView {
  /** Redraw the timeline. Null means no journal was recorded. */
  update(entries: readonly JournalEntry[] | null): void;
}

/** The search box, the Newest first box, the category list and the timeline. */
export function createJournalView(parent: HTMLElement, filter: JournalFilter, focusPrefix = "journal"): JournalView {
  const controls = el(parent, "div", undefined, "journal-controls");
  const search = el(controls, "input");
  search.type = "search";
  search.placeholder = "Search milestones";
  search.setAttribute("aria-label", "Search milestones");
  search.value = filter.search;
  search.dataset["focus"] = `${focusPrefix}-search`;
  const newestLabel = el(controls, "label");
  const newest = el(newestLabel, "input");
  newest.type = "checkbox";
  newest.checked = filter.newest;
  newest.dataset["focus"] = `${focusPrefix}-newest`;
  el(newestLabel, "span", " Newest first");
  const category = el(controls, "select");
  category.setAttribute("aria-label", "Milestone type");
  category.dataset["focus"] = `${focusPrefix}-category`;
  JOURNAL_CATEGORIES.forEach((name, index) => {
    const option = el(category, "option", name);
    option.value = String(index);
  });
  category.value = String(filter.category);
  const list = el(parent, "ol", undefined, "timeline");
  let last: readonly JournalEntry[] | null = null;
  const draw = (): void => {
    list.replaceChildren();
    if (last === null) { el(list, "li", "No journal was recorded for this run.", "muted"); return; }
    const shown = filterJournal(last, filter);
    if (!shown.length) { el(list, "li", "No matching milestones yet.", "muted"); return; }
    for (const entry of shown) {
      const item = el(list, "li");
      const mark = el(item, "span", journalSymbol(entry.kind), "mark");
      mark.style.color = journalTint(entry.kind);
      mark.setAttribute("aria-hidden", "true");
      const box = el(item, "span", undefined, "entry");
      el(box, "span", entry.lost ? `${entry.text} (lost)` : entry.text);
      el(box, "span", journalMeta(entry), "meta");
    }
  };
  search.addEventListener("input", () => { filter.search = search.value; draw(); });
  newest.addEventListener("change", () => { filter.newest = newest.checked; draw(); });
  category.addEventListener("change", () => { filter.category = Number(category.value) || 0; draw(); });
  return { update(entries) { last = entries; draw(); } };
}
