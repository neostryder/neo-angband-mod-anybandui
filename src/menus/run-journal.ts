/**
 * The run journal (upstream run_journal.h): the current run's milestones in a
 * pane of their own, filtered and searched as upstream does, with Play Again
 * once the run has ended (client.cpp:2002-2026 offers it from the post-mortem).
 *
 * Upstream opens the journal as a modal from a toolbar button
 * (client.cpp:1961). Here it is a pane like the character sheet, so the host's
 * window manager places it and the player can keep it open while playing.
 *
 * The depth recorder keeps each new deepest level in this mod's per-character
 * storage, because Angband's history does not record depths. It runs while
 * either the journal or the graveyard is on, since both show the timeline.
 * Core declares the `dungeonlevel` event but does not send it yet, so the
 * recorder also reads the depth once a second.
 */
import type { CharacterHistoryEntry, ModPluginContext, RunReport } from "@rpgm-tools/neo-angband-core";
import { openSurfaces, type SurfaceContext } from "../panels/surface.js";
import { button, el, DIALOG_CSS } from "./dialog.js";
import { createJournalView, endingEntry, journalFromHistory, JOURNAL_CSS, newJournalFilter, type DepthMark, type JournalEntry, type JournalView } from "./journal.js";
import { viewInput, viewPlayer } from "../host-adapter.js";

export interface CharacterStoreSeam {
  get(): unknown;
  set(value: unknown): void;
}

export interface DepthSnapshot {
  readonly core?: { readonly player?: { readonly depth?: number; readonly level?: number } | null } | null;
}

export type EventSeam = Pick<NonNullable<ModPluginContext["events"]>, "on" | "off">;

export interface DepthRecorderContext {
  readonly characterStore?: CharacterStoreSeam | undefined;
  /** The history a new depth is placed after. */
  readonly character?: { history(): readonly CharacterHistoryEntry[] } | undefined;
  readonly events?: EventSeam | undefined;
  readonly snapshot?: (() => DepthSnapshot | null) | undefined;
  readonly log: (message: string) => void;
}

const DEPTH_KEY = "journalDepths";
/** How often the recorder reads the depth, in milliseconds. */
export const DEPTH_POLL_MS = 1000;

/** The depth marks stored on this character, oldest first. */
export function readDepthMarks(store: CharacterStoreSeam | undefined): DepthMark[] {
  let bag: unknown;
  try { bag = store?.get(); } catch { return []; }
  const raw = bag && typeof bag === "object" ? (bag as Record<string, unknown>)[DEPTH_KEY] : undefined;
  if (!Array.isArray(raw)) return [];
  return raw.filter((mark): mark is DepthMark => !!mark && typeof mark === "object"
    && Number.isFinite((mark as DepthMark).depth) && Number.isFinite((mark as DepthMark).level)
    && Number.isInteger((mark as DepthMark).after) && (mark as DepthMark).after >= 0);
}

/** Store the current depth when it is deeper than any stored one. True when a mark was added. */
export function recordDepth(ctx: DepthRecorderContext): boolean {
  const store = ctx.characterStore;
  if (!store) return false;
  let snap: DepthSnapshot | null = null;
  try { snap = viewInput(ctx); } catch { snap = null; }
  const player = viewPlayer(snap);
  const depth = player?.depth;
  if (typeof depth !== "number" || depth <= 0) return false;
  const marks = readDepthMarks(store);
  if (marks.some((mark) => mark.depth >= depth)) return false;
  let bag: unknown;
  try { bag = store.get(); } catch { bag = null; }
  const root = bag && typeof bag === "object" && !Array.isArray(bag) ? bag as Record<string, unknown> : {};
  let after = 0;
  try { after = ctx.character?.history().length ?? 0; } catch { after = 0; }
  try {
    store.set({ ...root, [DEPTH_KEY]: [...marks, { depth, level: player?.level ?? 0, after }] });
    return true;
  } catch (error) {
    ctx.log(`run journal: the depth could not be stored (${String(error)})`);
    return false;
  }
}

/** Store each new deepest level, on the level-change event and on a timer. */
export function installDepthRecorder(ctx: DepthRecorderContext): () => void {
  const events = ctx.events;
  if (!ctx.characterStore) return () => {};
  const onLevel = (): void => { recordDepth(ctx); };
  let listening = false;
  if (events) {
    try {
      events.on("dungeonlevel", onLevel);
      listening = true;
    } catch {
      ctx.log("run journal: this game does not report level changes, so new depths are read once a second");
    }
  }
  const timer = ctx.snapshot ? globalThis.setInterval(onLevel, DEPTH_POLL_MS) : null;
  if (!listening && timer === null) ctx.log("run journal: this game reports no depth, so new depths are not recorded");
  // A character loaded below its deepest stored level is already where the event would put it.
  recordDepth(ctx);
  return () => {
    if (timer !== null) globalThis.clearInterval(timer);
    if (listening) events?.off("dungeonlevel", onLevel);
  };
}

export interface JournalCharacter {
  history(): readonly CharacterHistoryEntry[];
  runReport?(): RunReport | null;
}

export interface CreateSeam {
  create?(options?: { readonly like?: { readonly race: string; readonly cls: string; readonly name?: string; readonly stats?: readonly number[] } }): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>;
}

export interface RunJournalContext extends SurfaceContext, DepthRecorderContext {
  readonly character?: JournalCharacter | undefined;
  readonly saves?: CreateSeam | undefined;
}

/** The live run's timeline: Angband's history, the stored depths, and the ending once there is one. */
export function liveJournal(ctx: RunJournalContext): JournalEntry[] | null {
  const character = ctx.character;
  if (!character) return null;
  let history: readonly CharacterHistoryEntry[] = [];
  try { history = character.history(); } catch { return null; }
  const entries = journalFromHistory(history, readDepthMarks(ctx.characterStore));
  let report: RunReport | null = null;
  try { report = character.runReport?.() ?? null; } catch { report = null; }
  if (report) entries.push(endingEntry(report));
  return entries;
}

const CSS = `${DIALOG_CSS}${JOURNAL_CSS}
.journal-pane{position:absolute;left:12px;right:12px;bottom:12px;max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}`;

export function installRunJournal(ctx: RunJournalContext): () => void {
  if (ctx.flags?.["anybandui.runJournal"] !== true) return () => {};
  if (!ctx.character) ctx.log("run journal: this game has no character history read");
  let repaint = (): void => {};
  const surfaces = openSurfaces(ctx, [{ key: "run-journal", label: "Run journal", tab: "Character", minSize: { width: 320, height: 200 }, placement: { kind: "dock", target: "main", edge: "bottom" } }],
    { id: "run-journal", label: "Run journal", className: "journal-pane" }, CSS, () => repaint());
  if (!surfaces) { ctx.log("run journal: panel seam unavailable"); return () => {}; }
  const filter = newJournalFilter();
  let mount: HTMLElement | null = null;
  let view: JournalView | null = null;
  let actions: HTMLElement | null = null;
  let status: HTMLElement | null = null;
  let signature = "";
  let closed = false;
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  const stopTimer = (): void => { if (timer !== null) { globalThis.clearInterval(timer); timer = null; } };
  const playAgain = async (): Promise<void> => {
    const report = ctx.character?.runReport?.() ?? null;
    if (!report || !ctx.saves?.create) return;
    const result = await ctx.saves.create({ like: report.birth });
    if (!result.ok && status) status.textContent = result.reason;
  };
  const paint = (force = false): void => {
    if (closed) return;
    const host = surfaces.mounts().get("run-journal");
    if (!host) { stopTimer(); return; }
    if (timer === null) timer = globalThis.setInterval(() => paint(), 200);
    if (host !== mount) {
      mount = host;
      host.replaceChildren();
      el(host, "h3", "Run summary");
      view = createJournalView(host, filter, "run-journal");
      actions = el(host, "div", undefined, "actions");
      status = el(host, "p", "", "muted");
      signature = "";
    }
    const entries = liveJournal(ctx);
    const ended = !!entries?.length && entries[entries.length - 1]!.kind === "ending";
    const next = JSON.stringify([entries, ended]);
    if (!force && next === signature) return;
    signature = next;
    view?.update(entries);
    if (actions) {
      actions.replaceChildren();
      if (ended && ctx.saves?.create) button(actions, "Play Again", () => { void playAgain(); }, "play-again");
    }
  };
  paint(true);
  repaint = () => paint(true);
  return () => { closed = true; stopTimer(); surfaces.close(); };
}
