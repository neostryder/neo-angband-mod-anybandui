/**
 * The character creation wizard's state, apart from any page.
 *
 * Ported from AnybandUI's birth_panel.h. The steps, their order and what each
 * one shows follow that panel; the data and every change come from Core's
 * `ModBirthSession`, so the wizard never computes a cost, a spread or a roll of
 * its own. Each change goes through the session, and the draft is read back
 * from the session afterwards, so what the wizard shows is what Core will make.
 */
import type { BirthCatalogue, BirthClassView, BirthDraftView, BirthRaceView, BirthResult, ModBirthSession } from "@rpgm-tools/neo-angband-core";

/** birth_panel.h:132, plus the "Play again" screen upstream draws at step -1 (:101). */
export type BirthStep = "previous" | "race" | "class" | "attributes" | "identity" | "review";

export const WIZARD_STEPS = ["race", "class", "attributes", "identity", "review"] as const satisfies readonly BirthStep[];
export const STEP_LABELS: Readonly<Record<BirthStep, string>> = {
  previous: "Play again", race: "Race", class: "Class", attributes: "Attributes", identity: "Identity", review: "Review",
};

/** 1 to 5 for a wizard step, 0 for the Play again screen. */
export function stepNumber(step: BirthStep): number {
  return (WIZARD_STEPS as readonly BirthStep[]).indexOf(step) + 1;
}

/** The step Next opens, or null on Review, where the button is Start game. */
export function nextStep(step: BirthStep): BirthStep | null {
  if (step === "previous") return "identity";
  const index = (WIZARD_STEPS as readonly BirthStep[]).indexOf(step);
  return WIZARD_STEPS[index + 1] ?? null;
}

/** upstream prints modifiers with %+d. */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

const SKILL_LABELS: Readonly<Record<string, string>> = {
  DISARM_PHYS: "Disarm (physical)", DISARM_MAGIC: "Disarm (magic)", DEVICE: "Magic devices", SAVE: "Saving throw",
  STEALTH: "Stealth", SEARCH: "Searching", TO_HIT_MELEE: "Melee", TO_HIT_BOW: "Shooting", TO_HIT_THROW: "Throwing", DIGGING: "Digging",
};

export function skillLabel(key: string): string {
  const known = SKILL_LABELS[key];
  if (known) return known;
  const words = key.toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? `${words[0]!.toUpperCase()}${words.slice(1)}` : key;
}

export interface TraitView { readonly label: string; readonly value: string; readonly note?: string }

export interface ChoiceView {
  readonly name: string;
  readonly modifiers: readonly number[];
  readonly traits: readonly TraitView[];
  readonly abilities: readonly { readonly name: string; readonly description: string }[];
  readonly skills: readonly { readonly label: string; readonly value: string }[];
}

/**
 * birth_panel.h:34-64 and :179-187: the selected race or class, its modifiers, traits, abilities and skills.
 *
 * Hit die and XP modifier follow the game's own birth screen (skill_help in ui-birth.c) rather than
 * upstream's %+d, because Core's pack holds whole values, such as 100 for a Human's XP. A class
 * shows the sum with the chosen race, as the game's class list does.
 */
export function choiceView(entry: BirthRaceView | BirthClassView, race: BirthRaceView | null = null): ChoiceView {
  const added = "magic" in entry ? race : null;
  const note: { note?: string } = added ? { note: "Includes your race." } : {};
  const traits: TraitView[] = [
    { label: "Hit die", value: String(entry.hitDie + (added?.hitDie ?? 0)), ...note },
    { label: "XP modifier", value: `${entry.expFactor + (added?.expFactor ?? 0)}%`, ...note },
  ];
  if ("infravisionFeet" in entry) traits.push({ label: "Infravision", value: `${entry.infravisionFeet} ft` });
  if ("magic" in entry) {
    const casts = entry.magic.length > 0;
    traits.push({ label: "Magic", value: casts ? "Yes" : "No", note: casts ? `Can learn spells: ${entry.magic.join(", ")}.` : "Does not cast spells." });
  }
  return {
    name: entry.name,
    modifiers: [...entry.statAdj],
    traits,
    abilities: entry.abilities.map((ability) => ({ name: ability.name, description: ability.description })),
    skills: Object.entries(entry.skills).map(([key, value]) => ({ label: skillLabel(key), value: signed(value) })),
  };
}

/** cnv_stat for a natural stat the preview does not cover yet. */
export function formatStat(value: number): string {
  if (value <= 18) return String(value);
  const bonus = value - 18;
  return bonus >= 220 ? "18/***" : `18/${String(bonus).padStart(2, "0")}`;
}

export interface StatRowView {
  readonly index: number;
  readonly name: string;
  readonly base: string;
  readonly race: string;
  readonly cls: string;
  readonly total: string;
  readonly spent: number;
  /** What the next point costs, null at 18 or with the roller. */
  readonly buyCost: number | null;
  /** What lowering the stat one point gives back, null at 10 or with the roller. */
  readonly sellRefund: number | null;
  /** Whether the game would take a buy or a sell now. */
  readonly canBuy: boolean;
  readonly canSell: boolean;
  readonly atMaximum: boolean;
}

/** birth_panel.h:65-93: Stat, Base, Race, Class, Total and, in point-buy, Spent, with the game's own costs. */
export function statRows(draft: BirthDraftView, catalogue: BirthCatalogue): StatRowView[] {
  return catalogue.stats.map((name, index) => {
    const preview = draft.preview?.stats[index];
    const natural = draft.stats[index] ?? 0;
    const spent = draft.pointsSpent[index] ?? 0;
    const cost = draft.statCosts[index];
    return {
      index, name,
      base: preview?.natural.trim() || formatStat(natural),
      race: preview?.raceBonus.trim() || "-",
      cls: preview?.classBonus.trim() || "-",
      total: preview?.best.trim() || "-",
      spent,
      buyCost: cost?.buyCost ?? null,
      sellRefund: cost?.sellRefund ?? null,
      canBuy: cost?.canBuy ?? false,
      canSell: cost?.canSell ?? false,
      atMaximum: natural >= 18,
    };
  });
}

export interface PreviewSummary { readonly hp: string; readonly sp: string; readonly gold: number | null }

/** The maximum of a "current/maximum" line. */
function maximum(value: string | undefined): string {
  if (!value) return "-";
  const slash = value.lastIndexOf("/");
  return (slash >= 0 ? value.slice(slash + 1) : value).trim() || "-";
}

/** birth_panel.h:195-196: hit points, spell points and starting gold, read from the game's own preview sheet. */
export function previewSummary(draft: BirthDraftView): PreviewSummary {
  const lines = draft.preview?.panels.flatMap((panel) => panel.lines) ?? [];
  const find = (label: string): string | undefined => lines.find((line) => line.label.trim() === label)?.value;
  return { hp: maximum(find("HP")), sp: maximum(find("SP")), gold: draft.preview ? draft.preview.gold : null };
}

/** Up, Down, Home and End through a list of names; null for any other key. */
export function stepChoice(names: readonly string[], current: string | null, key: string): string | null {
  if (!names.length) return null;
  const index = current === null ? -1 : names.indexOf(current);
  if (key === "Home") return names[0]!;
  if (key === "End") return names[names.length - 1]!;
  if (key === "ArrowDown") return names[Math.min(names.length - 1, index + 1)]!;
  if (key === "ArrowUp") return names[Math.max(0, index - 1)]!;
  return null;
}

export type StatKeyAction = "buy" | "sell" | "up" | "down";

/** Left or minus refunds a point, Right or plus spends one, Up and Down move between stats. */
export function statKey(key: string): StatKeyAction | null {
  if (key === "ArrowRight" || key === "+" || key === "=") return "buy";
  if (key === "ArrowLeft" || key === "-" || key === "_") return "sell";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
}

/**
 * One character creation: the session, the last refusal, and the draft as Core
 * last reported it.
 */
export class BirthWizard {
  readonly catalogue: BirthCatalogue;
  /** The last refusal, shown under the step as upstream shows menu_error (:202). */
  error = "";
  private cached: BirthDraftView | null = null;
  /** Something other than the name, background or options changed after the previous character was applied. */
  private changedSincePrevious = true;
  finished = false;

  constructor(readonly session: ModBirthSession) {
    this.catalogue = session.catalogue();
  }

  draft(): BirthDraftView {
    if (!this.cached) this.cached = this.session.draft();
    return this.cached;
  }

  /** Run one session change, keep its refusal, and read the draft again. */
  run(change: (session: ModBirthSession) => BirthResult, build = true): boolean {
    if (this.finished) return false;
    let result: BirthResult;
    try { result = change(this.session); } catch (error) { result = { ok: false, reason: error instanceof Error ? error.message : String(error) }; }
    this.cached = null;
    this.error = result.ok ? "" : result.reason;
    if (result.ok && build) this.changedSincePrevious = true;
    return result.ok;
  }

  /** Upstream's engine always has a race and a class picked; Core starts with neither, so the first of each is chosen. */
  start(): void {
    const draft = this.draft();
    const race = this.catalogue.races[0]?.name;
    const cls = this.catalogue.classes[0]?.name;
    if (draft.race === null && race !== undefined) this.run((s) => s.chooseRace(race));
    if (this.draft().cls === null && cls !== undefined) this.run((s) => s.chooseClass(cls));
  }

  /** The previous character's race, class and stats (Core's quick start), unless they are already in the draft. */
  usePrevious(): boolean {
    if (!this.catalogue.previous) return false;
    if (!this.changedSincePrevious) return true;
    const ok = this.run((s) => s.usePrevious());
    if (ok) this.changedSincePrevious = false;
    return ok;
  }

  accept(): boolean {
    const ok = this.run((s) => s.accept(), false);
    if (ok) this.finished = true;
    return ok;
  }

  cancel(): void {
    if (this.finished) return;
    this.finished = true;
    try { this.session.cancel(); } catch { /* the game has already left creation */ }
  }
}
