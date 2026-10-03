/**
 * The graveyard (upstream run_history.h): every finished run's report, kept by
 * this mod so it outlives the save, with a list and a post-mortem per run.
 *
 * Upstream writes one JSON file per run beside its settings. A mod has no files
 * of its own to write, so the records live in this mod's stored preferences
 * under one key, newest first, trimmed from the oldest end to stay small: the
 * browser's storage also holds the saves themselves.
 */
import type { RunReport } from "@rpgm-tools/neo-angband-core";
import { renderCharacterSheet, SHEET_PAGES } from "../panels/character-sheet.js";
import { button, el, formatWhen, matches, metric, openDialog, stepFocus, type DialogContext } from "./dialog.js";
import { createJournalView, endingEntry, endingText, journalFromHistory, JOURNAL_CSS, newJournalFilter, type JournalEntry } from "./journal.js";
import { readDepthMarks, type CharacterStoreSeam, type CreateSeam } from "./run-journal.js";
import { readRecap, RECAP_CSS, renderRecap, type DeathRecap } from "./death-recap.js";

export const GRAVEYARD_KEY = "graveyard";
export const MAX_RECORDS = 20;
/** Characters of JSON for the whole archive. */
export const MAX_ARCHIVE_SIZE = 600_000;

export interface StoredRun {
  readonly id: string;
  readonly report: RunReport;
  readonly journal: readonly JournalEntry[] | null;
  /** The death recap, kept when that switch was on at the death. */
  readonly recap?: DeathRecap | null;
}

export interface PrefsSeam {
  get(): unknown;
  set(value: unknown): void;
}

export interface Archive {
  readonly records: StoredRun[];
  /** Entries that are not readable records. They are written back untouched. */
  readonly unreadable: unknown[];
}

export function runId(report: Pick<RunReport, "endedAt" | "key" | "name">): string {
  return `${report.endedAt}-${report.key ?? report.name}`;
}

function validRecord(value: unknown): value is StoredRun {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredRun>;
  const report = record.report as Partial<RunReport> | undefined;
  return typeof record.id === "string" && !!report && typeof report === "object"
    && typeof report.name === "string" && typeof report.outcome === "string" && typeof report.endedAt === "number"
    && Array.isArray(report.history) && Array.isArray(report.messages) && Array.isArray(report.belongings)
    && !!report.birth && typeof report.birth === "object"
    && (record.journal === null || Array.isArray(record.journal));
}

function prefsRoot(prefs: PrefsSeam | undefined): Record<string, unknown> {
  let raw: unknown;
  try { raw = prefs?.get(); } catch { raw = null; }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

export function readArchive(prefs: PrefsSeam | undefined): Archive {
  const stored = prefsRoot(prefs)[GRAVEYARD_KEY];
  const list = stored && typeof stored === "object" && Array.isArray((stored as { records?: unknown }).records) ? (stored as { records: unknown[] }).records : [];
  const records: StoredRun[] = [];
  const unreadable: unknown[] = [];
  for (const entry of list) (validRecord(entry) ? records : unreadable).push(entry as StoredRun);
  records.sort((a, b) => b.report.endedAt - a.report.endedAt);
  return { records, unreadable };
}

/** A record without its item descriptions, then without its sheet: what is dropped first when a run is too large to keep. */
function compact(record: StoredRun, step: number): StoredRun {
  const report = { ...record.report, belongings: record.report.belongings.map((item) => ({ ...item, recall: null })) };
  return { ...record, report: step > 1 ? { ...report, sheet: null } : report };
}

/** Newest first, at most MAX_RECORDS, and within MAX_ARCHIVE_SIZE with the unreadable entries counted. */
export function trimArchive(records: readonly StoredRun[], unreadable: readonly unknown[] = []): StoredRun[] {
  const kept = [...records].sort((a, b) => b.report.endedAt - a.report.endedAt).slice(0, MAX_RECORDS);
  const size = (): number => JSON.stringify([...kept, ...unreadable]).length;
  while (kept.length > 1 && size() > MAX_ARCHIVE_SIZE) kept.pop();
  for (let step = 1; step <= 2 && kept.length === 1 && size() > MAX_ARCHIVE_SIZE; step += 1) kept[0] = compact(kept[0]!, step);
  return kept;
}

/** Add a run to the stored graveyard. False when the store refused the write. */
export function archiveRun(prefs: PrefsSeam | undefined, record: StoredRun): boolean {
  if (!prefs) return false;
  try {
    const { records, unreadable } = readArchive(prefs);
    const merged = records.some((existing) => existing.id === record.id) ? records : [record, ...records];
    const root = prefsRoot(prefs);
    prefs.set({ ...root, [GRAVEYARD_KEY]: { v: 1, records: [...trimArchive(merged, unreadable), ...unreadable] } });
    return readArchive(prefs).records.some((existing) => existing.id === record.id);
  } catch {
    return false;
  }
}

export function recordFor(report: RunReport, store?: CharacterStoreSeam, recap?: DeathRecap | null): StoredRun {
  const journal = [...journalFromHistory(report.history, readDepthMarks(store)), endingEntry(report)];
  return recap ? { id: runId(report), report, journal, recap } : { id: runId(report), report, journal };
}

export interface GraveyardContext extends DialogContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly prefs?: PrefsSeam | undefined;
  readonly saves?: CreateSeam | undefined;
  readonly characterStore?: CharacterStoreSeam | undefined;
  readonly character?: {
    runReport?(): RunReport | null;
    onRunEnd?(listener: (report: RunReport) => void): () => void;
  } | undefined;
  readonly title?: { registerRow(row: { readonly label: string; readonly key?: string; run(): void | Promise<void> }): () => void } | undefined;
}

const UNREADABLE = "Some run records could not be read. They have been left untouched.";
const NOT_ARCHIVED = "This run could not be added to the graveyard. Its summary is still available here.";

const CSS = `${JOURNAL_CSS}
${RECAP_CSS}
.graveyard-head{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.runs button{background:none;border:none;padding:0;text-align:left;width:100%}
.runs button:focus-visible{outline:2px solid var(--anyband-accent)}
.verdict{color:#e6ad59;letter-spacing:.1em}
.name{font-size:1.5em;margin:2px 0}
.moments p:first-child{color:#ffa673}
.split{display:grid;grid-template-columns:1.7fr 1fr;gap:10px}
.belongings button{background:none;border:none;padding:0;text-align:left}
.belongings tr[aria-selected="true"] td{background:rgba(128,128,128,.18)}
.inspection{white-space:pre-wrap}`;

/** The heading word, run_history.h:74. */
export function verdict(report: Pick<RunReport, "outcome">): string {
  return report.outcome === "winner" ? "VICTORY" : report.outcome === "retired" ? "RETIRED" : "GAME OVER";
}

/** The run's character as the list names it, run_history.h:61. */
export function runLabel(report: Pick<RunReport, "name" | "race" | "cls">): string {
  return `${report.name || "Unnamed"} - ${report.race} ${report.cls}`;
}

const POST_MORTEM_PAGES = ["Final moments", "Journal", "Final belongings", "Character sheet"] as const;

/** The post-mortem's pages: a stored death recap comes first. */
export function postMortemPages(record: Pick<StoredRun, "recap">): string[] {
  return readRecap(record.recap) ? ["Recap", ...POST_MORTEM_PAGES] : [...POST_MORTEM_PAGES];
}

function locationLabel(location: string): string {
  return location ? location[0]!.toUpperCase() + location.slice(1) : "";
}

export interface PostMortemOptions {
  /** Opened from the graveyard list rather than at the end of the run. */
  readonly archived: boolean;
  /** The archive refused this run; offers Retry archiving. */
  readonly notArchived?: boolean;
}

/** The post-mortem of one run (run_history.h:73-151). Resolves when it closes. */
export function openPostMortem(ctx: GraveyardContext, record: StoredRun, options: PostMortemOptions): Promise<void> {
  const dialog = openDialog(ctx, { id: "post-mortem", label: `${record.report.name || "Unnamed"}: post-mortem`, className: "wide", css: CSS });
  if (!dialog) return Promise.resolve();
  const report = record.report;
  const body = dialog.body;
  el(body, "div", verdict(report), "verdict");
  el(body, "div", report.name || "Unnamed", "name");
  el(body, "p", `${report.race} ${report.cls}  |  Level ${report.level}  |  ${formatWhen(report.endedAt)}`);
  el(body, "p", report.outcome === "death" ? `Killed by ${report.cause}` : report.cause);
  const metrics = el(body, "div", undefined, "metrics");
  metric(metrics, "Deepest", `${report.maxDepth} (${report.maxDepth * 50} ft)`);
  metric(metrics, "Turns", String(report.turn));
  metric(metrics, "Score", String(report.score), "Angband's calculated points. High-score eligibility remains governed by the engine.");
  metric(metrics, "Gold", String(report.gold));
  const archiveRow = el(body, "div");
  let notArchived = options.notArchived === true && !options.archived;
  const drawArchive = (): void => {
    archiveRow.replaceChildren();
    if (!notArchived) return;
    el(archiveRow, "p", NOT_ARCHIVED, "error");
    button(archiveRow, "Retry archiving", () => { notArchived = !archiveRun(ctx.prefs, record); drawArchive(); }, "retry");
  };
  drawArchive();
  const tabs = el(body, "div", undefined, "tabs");
  tabs.setAttribute("role", "tablist");
  const page = el(body, "div");
  const tabButtons: HTMLButtonElement[] = [];
  let sheetPage = 0;
  const journalFilter = newJournalFilter();
  const pages = postMortemPages(record);
  const recap = readRecap(record.recap);
  const show = (index: number, moveFocus = false): void => {
    tabButtons.forEach((tab, at) => tab.setAttribute("aria-selected", String(at === index)));
    if (moveFocus) tabButtons[index]?.focus();
    page.replaceChildren();
    const name = pages[index];
    if (name === "Recap" && recap) {
      renderRecap(page, recap);
    } else if (name === "Final moments") {
      const moments = el(page, "div", undefined, "moments");
      // Newest first, so the fatal message is at the top (run_history.h:92).
      const messages = [...report.messages].reverse();
      if (!messages.length) el(moments, "p", "No messages were recorded.", "muted");
      for (const message of messages) el(moments, "p", message.count > 1 ? `${message.text} (x${message.count})` : message.text);
    } else if (name === "Journal") {
      createJournalView(page, journalFilter, "post-mortem-journal").update(record.journal);
    } else if (name === "Final belongings") {
      drawBelongings(page, report, dialog.root);
    } else {
      const sheet = el(page, "div");
      const draw = (): void => {
        sheet.replaceChildren();
        renderCharacterSheet(sheet, report.sheet, sheetPage, (next, focus) => {
          sheetPage = next; draw();
          if (focus) (sheet.querySelector(`[data-focus="sheet-page-${(SHEET_PAGES[next] ?? "Overview").toLowerCase()}"]`) as HTMLElement | null)?.focus();
        });
      };
      draw();
    }
  };
  pages.forEach((name, index) => {
    const tab = button(tabs, name, () => show(index), `post-mortem-tab-${index}`);
    tab.setAttribute("role", "tab");
    tabButtons.push(tab);
  });
  tabs.addEventListener("keydown", (event) => {
    const next = stepFocus(tabButtons, dialog.root.activeElement as HTMLElement | null, event.key, "horizontal");
    if (next === null) return;
    event.preventDefault();
    show(next, true);
  });
  const actions = el(body, "div", undefined, "actions");
  const leave = button(actions, options.archived ? "Back to graveyard" : "Close", () => dialog.close(), "leave");
  const status = el(body, "p", "", "muted");
  if (ctx.saves?.create) {
    const create = ctx.saves.create.bind(ctx.saves);
    button(actions, options.archived ? "New character like this" : "Play Again", () => {
      void create({ like: report.birth }).then((result) => { if (!result.ok) status.textContent = result.reason; });
    }, "play-again");
  }
  show(0);
  leave.focus();
  return dialog.closed;
}

function drawBelongings(parent: HTMLElement, report: RunReport, root: ShadowRoot): void {
  const split = el(parent, "div", undefined, "split");
  const listSide = el(split, "div");
  const inspection = el(split, "div", "Select an item to inspect its final, identified properties.", "inspection");
  if (!report.belongings.length) { el(listSide, "p", "No belongings were recorded.", "muted"); return; }
  const table = el(listSide, "table", undefined, "belongings");
  const head = el(el(table, "thead"), "tr");
  for (const name of ["Name", "Location", "Qty"]) el(head, "th", name);
  const rows = el(table, "tbody");
  const buttons: HTMLButtonElement[] = [];
  const trs: HTMLElement[] = [];
  const select = (index: number): void => {
    const item = report.belongings[index];
    if (!item) return;
    trs.forEach((tr, at) => tr.setAttribute("aria-selected", String(at === index)));
    inspection.replaceChildren();
    if (!item.recall) { el(inspection, "p", "No description was recorded for this item.", "muted"); return; }
    el(inspection, "h3", item.recall.title);
    el(inspection, "p", item.recall.text);
  };
  report.belongings.forEach((item, index) => {
    const tr = el(rows, "tr");
    trs.push(tr);
    const name = button(el(tr, "td"), item.name, () => select(index), `belonging-${index}`);
    name.style.color = item.color;
    buttons.push(name);
    el(tr, "td", locationLabel(item.location));
    el(tr, "td", String(item.quantity));
  });
  table.addEventListener("keydown", (event) => {
    const next = stepFocus(buttons, root.activeElement as HTMLElement | null, event.key);
    if (next === null) return;
    event.preventDefault();
    select(next);
  });
}

/** The graveyard list (run_history.h:45-71). Resolves when it closes. */
export function openGraveyard(ctx: GraveyardContext, backLabel = "Back to characters"): Promise<void> {
  const dialog = openDialog(ctx, { id: "graveyard", label: "Graveyard", className: "wide", css: CSS });
  if (!dialog) return Promise.resolve();
  const body = dialog.body;
  el(body, "h2", "Graveyard");
  const head = el(body, "div", undefined, "graveyard-head");
  const back = button(head, backLabel, () => dialog.close(), "back");
  const search = el(head, "input");
  search.type = "search";
  search.placeholder = "Search characters";
  search.setAttribute("aria-label", "Search characters");
  search.dataset["focus"] = "search";
  const { records, unreadable } = readArchive(ctx.prefs);
  if (unreadable.length) el(body, "p", UNREADABLE, "error");
  const list = el(body, "div");
  let rowButtons: HTMLButtonElement[] = [];
  const draw = (): void => {
    list.replaceChildren();
    rowButtons = [];
    if (!records.length) { el(list, "p", "Your completed runs will appear here.", "muted"); return; }
    const shown = records.filter((record) => matches(`${runLabel(record.report)} ${record.report.cause}`, search.value));
    if (!shown.length) { el(list, "p", "No matching runs.", "muted"); return; }
    const table = el(list, "table", undefined, "runs");
    const header = el(el(table, "thead"), "tr");
    for (const name of ["Character", "Outcome", "Depth", "Ended"]) el(header, "th", name);
    const rows = el(table, "tbody");
    for (const record of shown) {
      const tr = el(rows, "tr");
      rowButtons.push(button(el(tr, "td"), runLabel(record.report), () => { void openPostMortem(ctx, record, { archived: true }); }, `run-${record.id}`));
      el(tr, "td", record.report.outcome === "death" ? record.report.cause : endingText(record.report));
      el(tr, "td", String(record.report.maxDepth));
      el(tr, "td", formatWhen(record.report.endedAt));
    }
  };
  search.addEventListener("input", draw);
  list.addEventListener("keydown", (event) => {
    if (stepFocus(rowButtons, dialog.root.activeElement as HTMLElement | null, event.key) !== null) event.preventDefault();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && rowButtons.length) { event.preventDefault(); rowButtons[0]!.focus(); }
  });
  draw();
  (rowButtons[0] ?? back).focus();
  return dialog.closed;
}

/**
 * Archive each run as it ends and open its post-mortem, and add a Graveyard row
 * to the title screen. Off, nothing listens and the title is unchanged.
 */
export function installGraveyard(ctx: GraveyardContext, recapFor?: (report: RunReport) => DeathRecap | null): () => void {
  if (ctx.flags?.["anybandui.graveyard"] !== true) return () => {};
  const cleanups: Array<() => void> = [];
  const character = ctx.character;
  if (character?.onRunEnd) {
    try {
      cleanups.push(character.onRunEnd((report) => {
        let recap: DeathRecap | null = null;
        try { recap = recapFor?.(report) ?? null; } catch (error) { ctx.log(`graveyard: death recap failed (${String(error)})`); }
        const record = recordFor(report, ctx.characterStore, recap);
        const stored = archiveRun(ctx.prefs, record);
        void openPostMortem(ctx, record, { archived: false, notArchived: !stored });
      }));
    } catch (error) { ctx.log(`graveyard: run end unavailable (${String(error)})`); }
  } else ctx.log("graveyard: this game does not report the end of a run");
  /* A run that ended before this mod registered (a mod toggled on the death
   * screen) is still on the page; keep it too. */
  try {
    const ended = character?.runReport?.() ?? null;
    if (ended && !readArchive(ctx.prefs).records.some((record) => record.id === runId(ended))) archiveRun(ctx.prefs, recordFor(ended, ctx.characterStore));
  } catch { /* no report on this page */ }
  if (ctx.title) {
    try {
      cleanups.push(ctx.title.registerRow({ label: "Graveyard", run: () => openGraveyard(ctx, "Back to title") }));
    } catch (error) { ctx.log(`graveyard: title row refused (${String(error)})`); }
  }
  return () => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
}
