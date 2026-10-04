/**
 * The death recap: a short account of how a run ended in death, built from the
 * blows and healing the character took in its last moments, the run report's
 * final messages and the run journal.
 *
 * Angband keeps no record of who hit the character for how much, so the recap
 * listens to the resolved combat and healing events (MOD_SEAMS 4l) while the
 * run is alive and keeps the latest few. A creature is named only when the
 * snapshot lists it as visible at the moment of the blow, so the recap never
 * names something the character could not see.
 *
 * With the graveyard on, the recap is the first page of the post-mortem and is
 * stored with the run. With the graveyard off, it opens in a dialog of its own.
 */
import type { RunReport } from "@rpgm-tools/neo-angband-core";
import type { EffectEventMap, EventActor, InputDriver } from "../seams.js";
import { currentDriver } from "../input-owner.js";
import { driverName } from "../panels/status-badges.js";
import { button, el, metric, openDialog, type DialogContext } from "./dialog.js";
import { journalFromHistory, journalMeta, journalSymbol, journalTint, type JournalEntry } from "./journal.js";
import { readDepthMarks, type CharacterStoreSeam, type EventSeam } from "./run-journal.js";
import { viewInput, viewMonsters } from "../host-adapter.js";

/** How many blows and heals are kept while the run is alive. */
export const BLOW_BUFFER = 40;
/** How many of them the recap shows. */
export const RECAP_BLOWS = 8;
export const RECAP_MESSAGES = 6;
export const RECAP_MILESTONES = 4;

export type BlowKind = "melee" | "ranged" | "spell" | "effect" | "trap" | "heal";

export interface RecapBlow {
  /** Who struck, as the character saw it. */
  readonly by: string;
  readonly kind: BlowKind;
  readonly hit: boolean;
  /** Hit points lost, or restored for a heal. */
  readonly amount: number;
}

export interface DeathRecap {
  readonly v: 1;
  readonly killer: string;
  readonly depth: number;
  readonly maxDepth: number;
  readonly level: number;
  readonly turn: number;
  /** Oldest first. */
  readonly blows: readonly RecapBlow[];
  /** Oldest first. */
  readonly messages: readonly string[];
  /** The last milestones before the ending, oldest first. */
  readonly milestones: readonly JournalEntry[];
  /** The controller's owner id when an autoplayer held the keyboard at the end, else null. */
  readonly driver: string | null;
}

type CombatPayload = Pick<EffectEventMap["combat-outcome"], "attacker" | "target" | "kind" | "hit" | "damage">;
type HealPayload = Pick<EffectEventMap["heal"], "who" | "amount">;

/** The monsters the snapshot lists, for naming an attacker. */
export interface RecapSnapshot {
  readonly core?: { readonly monsters?: readonly { readonly id: number; readonly race: string; readonly visible: boolean }[] | null } | null;
}

/** The name a blow's source gets: a visible creature's race, or what the character could tell. */
export function attackerName(attacker: EventActor | null, kind: Exclude<BlowKind, "heal">, snapshot: RecapSnapshot | null): string {
  if (attacker === "player") return "You";
  if (attacker === null) return kind === "trap" ? "A trap" : "Something unseen";
  const monster = viewMonsters(snapshot)?.find((entry) => entry.id === attacker);
  return monster?.visible && monster.race ? monster.race : "Something unseen";
}

export interface BlowLog {
  combat(payload: CombatPayload): void;
  heal(payload: HealPayload): void;
  entries(): readonly RecapBlow[];
  clear(): void;
}

/** The latest blows against the character and its own healing, oldest first. */
export function createBlowLog(snapshot: () => RecapSnapshot | null, limit = BLOW_BUFFER): BlowLog {
  const kept: RecapBlow[] = [];
  const push = (blow: RecapBlow): void => {
    kept.push(blow);
    if (kept.length > limit) kept.splice(0, kept.length - limit);
  };
  return {
    combat(payload) {
      if (!payload || payload.target !== "player") return;
      let snap: RecapSnapshot | null = null;
      // Only a numbered attacker needs the monster list.
      if (typeof payload.attacker === "number") { try { snap = snapshot(); } catch { snap = null; } }
      push({ by: attackerName(payload.attacker, payload.kind, snap), kind: payload.kind, hit: payload.hit === true, amount: Math.max(0, Math.round(payload.damage || 0)) });
    },
    heal(payload) {
      if (!payload || payload.who !== "player" || !(payload.amount > 0)) return;
      push({ by: "You", kind: "heal", hit: true, amount: Math.round(payload.amount) });
    },
    entries: () => [...kept],
    clear: () => { kept.length = 0; },
  };
}

/** The recap of a death, or null for a run that ended any other way. */
export function buildRecap(report: RunReport, blows: readonly RecapBlow[], depthStore: CharacterStoreSeam | undefined, driver: InputDriver | null): DeathRecap | null {
  if (report.outcome !== "death") return null;
  const journal = journalFromHistory(report.history, readDepthMarks(depthStore)).filter((entry) => entry.kind !== "other");
  return {
    v: 1,
    killer: report.cause,
    depth: report.depth,
    maxDepth: report.maxDepth,
    level: report.level,
    turn: report.turn,
    blows: blows.slice(-RECAP_BLOWS),
    messages: report.messages.slice(-RECAP_MESSAGES).map((message) => message.count > 1 ? `${message.text} (x${message.count})` : message.text),
    milestones: journal.slice(-RECAP_MILESTONES),
    driver: driver?.kind === "controller" ? driver.owner : null,
  };
}

/** A stored recap, or null for anything that is not one. Records from older versions have none. */
export function readRecap(value: unknown): DeathRecap | null {
  if (!value || typeof value !== "object") return null;
  const recap = value as Partial<DeathRecap>;
  return recap.v === 1 && typeof recap.killer === "string" && Array.isArray(recap.blows) && Array.isArray(recap.messages) && Array.isArray(recap.milestones)
    && [recap.depth, recap.maxDepth, recap.level, recap.turn].every((n) => typeof n === "number")
    && (recap.driver === null || typeof recap.driver === "string")
    ? recap as DeathRecap : null;
}

const KIND_WORDS: Readonly<Record<BlowKind, string>> = { melee: "melee", ranged: "missile", spell: "spell", effect: "effect", trap: "trap", heal: "healing" };

/** One row of the blows table: who, how, and the change in hit points. */
export function blowRow(blow: RecapBlow): [string, string, string] {
  if (blow.kind === "heal") return [blow.by, KIND_WORDS.heal, `+${blow.amount}`];
  return [blow.by, KIND_WORDS[blow.kind], blow.hit ? `-${blow.amount}` : "missed"];
}

/** The line about who was playing, or null when the player was. */
export function driverNote(owner: string | null): string | null {
  if (owner === null) return null;
  const name = driverName(owner);
  return owner === "squire"
    ? "Squire was playing when this character died. Its own report of the run is on the Report tab of the Squire panel."
    : `${name} was playing when this character died.`;
}

export const RECAP_CSS = `.recap .killer{font-size:1.2em;margin:2px 0 6px}
.recap .loss{color:#e8806f}.recap .gain{color:#80c299}
.recap ol.milestones{list-style:none;margin:0;padding:0}
.recap ol.milestones li{display:grid;grid-template-columns:1.6em 1fr;gap:6px;margin:0 0 4px}
.recap .meta{display:block;font-size:.8em;opacity:.65}`;

/** The recap itself, drawn into `parent`. */
export function renderRecap(parent: HTMLElement, recap: DeathRecap): void {
  const box = el(parent, "div", undefined, "recap");
  el(box, "p", `Killed by ${recap.killer}`, "killer");
  const note = driverNote(recap.driver);
  if (note) el(box, "p", note, "muted");
  const metrics = el(box, "div", undefined, "metrics");
  metric(metrics, "Depth", recap.depth === 0 ? "Town" : `${recap.depth} (${recap.depth * 50} ft)`);
  metric(metrics, "Deepest", `${recap.maxDepth} (${recap.maxDepth * 50} ft)`);
  metric(metrics, "Level", String(recap.level));
  metric(metrics, "Turns", String(recap.turn));
  el(box, "h3", "Last blows");
  if (!recap.blows.length) el(box, "p", "No blows were seen in the last moments.", "muted");
  else {
    const table = el(box, "table");
    const head = el(el(table, "thead"), "tr");
    for (const name of ["From", "How", "Hit points"]) el(head, "th", name);
    const rows = el(table, "tbody");
    for (const blow of recap.blows) {
      const tr = el(rows, "tr");
      const [by, how, change] = blowRow(blow);
      el(tr, "td", by);
      el(tr, "td", how);
      el(tr, "td", change, blow.kind === "heal" ? "gain" : blow.hit ? "loss" : "muted");
    }
    const taken = recap.blows.reduce((sum, blow) => sum + (blow.kind !== "heal" && blow.hit ? blow.amount : 0), 0);
    el(box, "p", `${taken} hit points lost in these blows.`, "muted");
  }
  el(box, "h3", "Last messages");
  if (!recap.messages.length) el(box, "p", "No messages were recorded.", "muted");
  for (const message of recap.messages) el(box, "p", message);
  el(box, "h3", "Last milestones");
  if (!recap.milestones.length) { el(box, "p", "No milestones were recorded.", "muted"); return; }
  const list = el(box, "ol", undefined, "milestones");
  for (const entry of recap.milestones) {
    const item = el(list, "li");
    const mark = el(item, "span", journalSymbol(entry.kind));
    mark.style.color = journalTint(entry.kind);
    mark.setAttribute("aria-hidden", "true");
    const text = el(item, "span", entry.lost ? `${entry.text} (lost)` : entry.text);
    el(text, "span", journalMeta(entry), "meta");
  }
}

/** The recap in a dialog of its own, for when the graveyard is off. Resolves when it closes. */
export function openRecapDialog(ctx: DialogContext, recap: DeathRecap, name: string): Promise<void> {
  const dialog = openDialog(ctx, { id: "death-recap", label: `${name || "Unnamed"}: death recap`, css: RECAP_CSS });
  if (!dialog) return Promise.resolve();
  el(dialog.body, "h2", "Death recap");
  renderRecap(dialog.body, recap);
  const actions = el(dialog.body, "div", undefined, "actions");
  button(actions, "Close", () => dialog.close(), "close").focus();
  return dialog.closed;
}

export interface DeathRecapContext extends DialogContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly events?: EventSeam | undefined;
  readonly snapshot?: (() => unknown) | undefined;
  readonly driver?: (() => InputDriver | null | undefined) | undefined;
  readonly characterStore?: CharacterStoreSeam | undefined;
  readonly character?: { onRunEnd?(listener: (report: RunReport) => void): () => void } | undefined;
}

export interface DeathRecapInstall {
  /** The recap for a run that just ended, or null. Undefined with the switch off. */
  readonly recap?: (report: RunReport) => DeathRecap | null;
  readonly cleanup: () => void;
}

/**
 * Listen for blows while the switch is on. With `ownDialog` (the graveyard is
 * off) the recap also opens on its own when a run ends in death.
 */
export function installDeathRecap(ctx: DeathRecapContext, ownDialog: boolean): DeathRecapInstall {
  if (ctx.flags?.["anybandui.deathRecap"] !== true) return { cleanup: () => {} };
  const cleanups: Array<() => void> = [];
  const log = createBlowLog(() => viewInput(ctx) as RecapSnapshot | null);
  // Core calls each handler with the event name first and the payload second.
  const combat = (_type: "combat-outcome", payload: EffectEventMap["combat-outcome"]): void => log.combat(payload);
  const heal = (_type: "heal", payload: EffectEventMap["heal"]): void => log.heal(payload);
  const events = ctx.events;
  if (events?.on) {
    try {
      events.on("combat-outcome", combat);
      cleanups.push(() => events.off("combat-outcome", combat));
      events.on("heal", heal);
      cleanups.push(() => events.off("heal", heal));
    } catch (error) { ctx.log(`death recap: combat events unavailable (${String(error)})`); }
  } else ctx.log("death recap: this game sends no combat events, so the recap has no blows");
  // The blows belong to the run that just ended, so a later run starts with none.
  const recap = (report: RunReport): DeathRecap | null => {
    const built = buildRecap(report, log.entries(), ctx.characterStore, currentDriver(ctx));
    log.clear();
    return built;
  };
  if (ownDialog) {
    if (ctx.character?.onRunEnd) {
      try {
        cleanups.push(ctx.character.onRunEnd((report) => {
          const built = recap(report);
          if (built) void openRecapDialog(ctx, built, report.name);
        }));
      } catch (error) { ctx.log(`death recap: run end unavailable (${String(error)})`); }
    } else ctx.log("death recap: this game does not report the end of a run");
  }
  return { recap, cleanup: () => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); } };
}
