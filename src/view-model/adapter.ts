import type { AgentView, PlayerView } from "@rpgm-tools/neo-angband-core";
import type { HudEntry, HudFrame } from "@rpgm-tools/neo-angband-mod-sdk";
import type { DungeonSummaryPayload, FeelingIndicesPayload, MessagePayload, PlayerPayload, StatusPayload, ViewModel } from "./protocol.js";

export interface AdapterInput {
  readonly name?: string;
  readonly history?: readonly { readonly text: string; readonly count: number | undefined; readonly category: number | undefined }[];
  readonly foodMax?: number;
  readonly levelStartExperience?: number;
  readonly study?: number;
  readonly repeat?: number;
  readonly resting?: boolean;
  readonly running?: boolean;
  readonly unignoring?: number;
  readonly recall?: number;
  readonly descent?: number;
  readonly extraMoves?: number;
  /** Whether a -more- pause holds input; source.ts reads it from the ack prompt. */
  readonly messagePending?: boolean;
}

export const GAPS: readonly { field: string; reason: string }[] = [
  { field: "player.food_max", reason: "The food grade ceiling is in the bound timed-effect registry, not AgentView, HudFrame, or GameState." },
  { field: "player.level_start_experience", reason: "The previous level threshold needs the core experience table, which is not published through plugin context." },
  { field: "player.feeling_description", reason: "HUD has compact LF text and indices, but no prose description." },
  { field: "player.statuses[].name", reason: "Tmd runs provide badge text, but no separate long name." },
  { field: "player.statuses[].priority", reason: "Tmd runs have display order, but no numeric priority." },
  { field: "player.statuses[].kind", reason: "Tmd runs and AgentView do not classify badges." },
  { field: "player.statuses[].description", reason: "Tmd runs and AgentView provide no explanation." },
  { field: "messages[].system", reason: "The core log stores text, count, and type, but no system flag." },
  { field: "messages[].group", reason: "The core log stores no message group." },
] as const;

function entry(frame: HudFrame | undefined, key: string): HudEntry | undefined {
  return frame?.sidebar?.entries.find((item) => item.key === key)
    ?? frame?.status.entries.find((item) => item.key === key);
}

function value(frame: HudFrame | undefined, key: string, field: string): number | undefined {
  return entry(frame, key)?.values?.[field];
}

function label(frame: HudFrame | undefined, key: string): string | undefined {
  const item = entry(frame, key);
  if (!item || item.runs.length === 0) return undefined;
  return item.runs.map((run) => run.text).join("").trim();
}

function feelingIndices(frame: HudFrame | undefined): FeelingIndicesPayload | undefined {
  // Core publishes the underlying indices alongside its compact LF label.
  const values = entry(frame, "level_feeling")?.values;
  if (values?.object === undefined || values.monster === undefined ||
      values.squares === undefined || values.need === undefined) return undefined;
  return { object: values.object, monster: values.monster,
    squares: values.squares, need: values.need };
}

function statPayload(source: PlayerView, frame: HudFrame | undefined): PlayerPayload["stats"] {
  // HUD use/cur/max include equipment effects and stat drain.
  return ["STR", "INT", "WIS", "DEX", "CON"].map((name, index) => {
    const key = name.toLowerCase();
    const current = value(frame, key, "cur");
    const maximum = value(frame, key, "max");
    return { label: name, value: value(frame, key, "use") ?? source.stats[index] ?? 0,
      drained: current === undefined || maximum === undefined ? undefined : current < maximum };
  });
}

function badgePayload(source: PlayerView, frame: HudFrame | undefined): StatusPayload[] {
  // Tmd runs carry the game's grade-specific badge text and colors.
  const status = source.status as unknown as Record<string, number>;
  const aliases: Record<string, string> = {
    haste: "fast", "paralyzed!": "paralyzed", graze: "cut",
    "light cut": "cut", "bad cut": "cut", "nasty cut": "cut",
    "severe cut": "cut", "deep gash": "cut", "mortal wound": "cut",
    "stunned": "stun", "heavy stun": "stun", "knocked out": "stun",
    protevil: "protEvil", berserk: "shero", blssd: "blessed",
    racid: "resAcid", relec: "resElec", rfire: "resFire",
    rcold: "resCold", rpois: "resPois", stone: "stoneskin",
    fastcast: "fastcast",
    fed: "food", full: "food", hungry: "food", weak: "food", faint: "food",
    starving: "food",
  };
  const result: StatusPayload[] = [];
  for (const run of entry(frame, "tmd")?.runs ?? []) {
    const text = run.text.trim();
    if (!text || /^\d+\s*%$/.test(text)) continue;
    const key = aliases[text.toLowerCase()] ?? text.toLowerCase().replace(/[^a-z]/g, "");
    result.push({ label: text, name: undefined, visible: true, priority: undefined,
      kind: undefined, duration: status[key], description: undefined });
  }
  return result;
}

function trackedPayload(view: AgentView, frame: HudFrame | undefined): PlayerPayload["tracked_creature"] {
  // AgentView identifies the target; HUD health numbers may be absent.
  const target = view.target();
  if (target === null) return undefined;
  const monster = view.monsters().find((item) => item.id === target.midx);
  if (!monster) return undefined;
  return { visible: monster.visible, name: monster.race,
    hp: value(frame, "health", "current"), max_hp: value(frame, "health", "max") };
}

function playerPayload(view: AgentView, frame: HudFrame | undefined, input: AdapterInput): PlayerPayload {
  const source = view.player();
  const experience = value(frame, "exp", "exp") ?? source.exp;
  const advance = value(frame, "exp", "advance");
  const state = label(frame, "state") ?? "";
  const moves = label(frame, "moves");
  // HUD values win because they use the same calculated state as the game display.
  return {
    name: input.name, race: label(frame, "race") ?? source.race,
    class: label(frame, "class") ?? source.cls, title: label(frame, "title"),
    hp: value(frame, "hp", "current") ?? source.hp,
    max_hp: value(frame, "hp", "max") ?? source.maxHp,
    sp: value(frame, "sp", "current") ?? source.sp,
    max_sp: value(frame, "sp", "max") ?? source.maxSp,
    food: source.status.food, food_max: input.foodMax,
    experience, max_experience: value(frame, "exp", "maxExp") ?? source.maxExp,
    level_start_experience: input.levelStartExperience,
    next_level_experience: advance === undefined ? undefined : advance === 0 ? 0 : experience + advance,
    level: value(frame, "level", "level") ?? source.level,
    max_level: value(frame, "level", "maxLevel") ?? source.maxLevel,
    stats: statPayload(source, frame),
    gold: value(frame, "gold", "au") ?? source.gold,
    armour: value(frame, "ac", "ac") ?? source.ac,
    speed: value(frame, "speed", "speed") ?? source.speed,
    extra_moves: input.extraMoves ?? (moves ? Number(moves.match(/[+-]\d+/)?.[0]) : undefined),
    tracked_creature: trackedPayload(view, frame),
    depth: value(frame, "depth", "depth") ?? source.depth,
    depth_feet: value(frame, "depth", "feet") ?? source.depth * 50,
    light: Number(label(frame, "light")?.match(/-?\d+/)?.[0] ?? source.light),
    feeling: label(frame, "level_feeling"), feeling_indices: feelingIndices(frame),
    feeling_description: undefined,
    floor: label(frame, "terrain"), trap_detected: Boolean(label(frame, "dtrap")),
    recall: input.recall ?? (label(frame, "recall") ? true : undefined),
    descent: input.descent ?? (label(frame, "descent") ? true : undefined),
    resting: input.resting ?? state.startsWith("Rest"),
    running: input.running,
    repeat: input.repeat ?? (state.startsWith("Repeat") ? Number(state.match(/\d+/)?.[0]) : undefined),
    unignoring: input.unignoring ?? (label(frame, "unignore") ? true : undefined),
    statuses: badgePayload(source, frame),
    study: input.study ?? Number(label(frame, "study")?.match(/\d+/)?.[0] ?? 0),
  };
}

function messagePayload(input: AdapterInput): MessagePayload[] {
  // The HUD has one current line; the state log preserves history and repeats.
  return (input.history ?? []).map((item) => ({ text: item.text, count: item.count,
    system: undefined, category: item.category, group: undefined }));
}

function dungeonPayload(player: PlayerPayload): DungeonSummaryPayload {
  // The summary repeats the player's HUD-derived dungeon facts.
  return { depth: player.depth, depth_feet: player.depth_feet, light: player.light,
    feeling: player.feeling, feeling_indices: player.feeling_indices,
    feeling_description: player.feeling_description, floor: player.floor };
}

/** Pure projection of the agent, HUD, and read-only state facts. */
export function adapt(view: AgentView, frame?: HudFrame, input: AdapterInput = {}): ViewModel {
  const player = playerPayload(view, frame, input);
  return { player, dungeon: dungeonPayload(player), messages: messagePayload(input),
    message_pending: input.messagePending };
}
