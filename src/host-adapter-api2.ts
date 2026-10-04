/**
 * The mod API 2 version of host-adapter.ts, for the day Core loads API 2 mods.
 * Nothing imports it yet. The port is to read a frame once per draw with
 * readFrame and then swap the features' imports from host-adapter.js to this
 * file.
 *
 * API 2 calls are async and the features read the game synchronously, so the
 * reads happen in readFrame and every other function here reads the frame it
 * returns. Each function keeps the name, and gives the same answer, as the API
 * 1 function it replaces; host-adapter-api2.test.ts holds the two side by side.
 *
 * Functions that host-adapter.ts has and this file does not have no API 2 read
 * yet. docs/API2-MIGRATION.md lists each one with the Core change it waits on.
 */
import type {
  Api2Call,
  Api2InputState,
  Api2TrueCell,
  Api2TrueLevel,
  KnownItem,
  KnownLevel,
  KnownLevelCell,
  KnownMonster,
  KnownPlayer,
  KnownPlayerStatus,
  KnownRememberedObject,
  KnownWorldData,
  ModApi2,
} from "@rpgm-tools/neo-angband-mod-sdk";
import type { Grid } from "./seams.js";

/** The feature name the glow asks Core's confirmation for, which is also its rule flag. */
export const GLOW_REVEALS_FEATURE = "anybandui.itemGlowReveals";

/**
 * The confirmation Core draws before a first-party mod may read the real map.
 * API 2 has no such member yet (docs/API2-MIGRATION.md, Core request 1), so
 * this is the shape the mod expects. status() never prompts. request() shows
 * Core's warning, marks the save when the player says yes, and answers what
 * the player chose. Until a feature is confirmed, truth.level() refuses with
 * the code "not-confirmed".
 */
export interface TruthConsent {
  status(feature: string): Api2Call<{ readonly confirmed: boolean }>;
  request(feature: string, warning: string): Api2Call<{ readonly confirmed: boolean }>;
}

/** What readFrame read at one input wait. input, world and truth are each null when the host refused that read. */
export interface Api2Frame {
  readonly input: Api2InputState | null;
  readonly world: KnownWorldData | null;
  readonly truth: Api2TrueLevel | null;
}

/** The input wait with the known world attached, standing in for API 1's input snapshot. */
export type Api2Input = Api2InputState & { readonly core: KnownWorldData };

/** One monster the character perceives, with the fields effects.ts, hover-cards.ts and death-recap.ts read from API 1's MonsterView. */
export interface Api2MonsterRow {
  readonly id: number;
  readonly race: string;
  readonly raceIndex: number;
  readonly grid: Grid;
  readonly visible: boolean;
  readonly asleep: boolean;
  readonly afraid: boolean;
  readonly confused: boolean;
  readonly stunned: boolean;
  readonly unique: boolean;
  readonly questGuardian: boolean;
  readonly finalGuardian: boolean;
  /** The race flags the character's monster memory has learned. API 1 lists them all. */
  readonly raceFlags: readonly string[];
}

/**
 * Reads the input wait and the known world, plus the real map when the glow
 * asks for it. The real map is read only when revealHidden is on, the host
 * gave this mod a truth domain, and the player has confirmed the glow through
 * Core's warning. Otherwise the frame's truth is null and no truth call is
 * made.
 */
export async function readFrame(api: Pick<ModApi2, "view" | "truth">, options: { readonly revealHidden?: boolean; readonly consent?: TruthConsent } = {}): Promise<Api2Frame> {
  const [input, world] = await Promise.all([api.view.input(), api.view.world()]);
  let truth: Api2TrueLevel | null = null;
  if (options.revealHidden && api.truth && options.consent) {
    const status = await options.consent.status(GLOW_REVEALS_FEATURE);
    if (status.ok && status.value.confirmed) {
      const level = await api.truth.level();
      if (level.ok) truth = level.value;
    }
  }
  return { input: input.ok ? input.value : null, world: world.ok ? world.value : null, truth };
}

// Known world.

/** The input wait with the known world attached, or null without both. API 1: viewInput. */
export function viewInput(frame: Api2Frame): Api2Input | null {
  return frame.input && frame.world ? { ...frame.input, core: frame.world } : null;
}

/** The known world inside an input. API 1: viewWorld. */
export function viewWorld(input: Api2Input | null | undefined): KnownWorldData | undefined {
  return input?.core;
}

/** The character, or undefined when the player part was not readable. API 1: viewPlayer. */
export function viewPlayer(input: Api2Input | null | undefined): KnownPlayer | undefined {
  return input?.core.player ?? undefined;
}

/** The monsters the character perceives, under API 1's field names. API 1: viewMonsters. */
export function viewMonsters(input: Api2Input | null | undefined): Api2MonsterRow[] | undefined {
  return input?.core.monsters?.map(monsterRow);
}

function monsterRow(monster: KnownMonster): Api2MonsterRow {
  const has = (status: KnownMonster["status"][number]): boolean => monster.status.includes(status);
  return {
    id: monster.id,
    race: monster.race,
    raceIndex: monster.raceIndex,
    grid: monster.grid,
    visible: monster.visible,
    asleep: has("asleep"),
    afraid: has("afraid"),
    confused: has("confused"),
    stunned: has("stunned"),
    unique: monster.unique,
    questGuardian: monster.questGuardian,
    finalGuardian: monster.finalGuardian,
    raceFlags: monster.knownFlags,
  };
}

/** The remembered map, or null. API 1: viewLevel. */
export function viewLevel(frame: Api2Frame): KnownLevel | null {
  return frame.world?.level ?? null;
}

// Truth: the real map, read only for the hidden-magic glow.

/** The real contents of each cell, with its grid. Empty unless readFrame read the real map. API 1: truthLevel. */
export function truthLevel(frame: Api2Frame): { readonly cells: readonly Api2TrueCell[] } {
  return { cells: frame.truth?.cells ?? [] };
}

// The character.

/** Whether the frame holds a character. API 1: hasLiveState. */
export function hasLiveState(frame: Api2Frame): boolean {
  return !!frame.world?.player;
}

/** The character's grid. API 1: playerGrid. */
export function playerGrid(frame: Api2Frame): Grid | undefined {
  return frame.world?.player?.grid;
}

/** The character's current and maximum hit points. API 1: playerHitPoints. */
export function playerHitPoints(frame: Api2Frame): { readonly hp: number | undefined; readonly maxHp: number | undefined } {
  const player = frame.world?.player;
  return { hp: player?.hp, maxHp: player?.maxHp };
}

/** Whether the character is hallucinating. API 1: playerHallucinating. */
export function playerHallucinating(frame: Api2Frame): boolean {
  return (frame.world?.player?.status.image ?? 0) > 0;
}

/* The timed effects the known player status carries, under the engine's
 * names and in the engine's order. The engine has more than these; the rest
 * wait on Core request 6. */
const TIMED_NAMES: readonly (readonly [string, keyof KnownPlayerStatus])[] = [
  ["FAST", "fast"], ["BLIND", "blind"], ["PARALYZED", "paralyzed"], ["CONFUSED", "confused"],
  ["AFRAID", "afraid"], ["IMAGE", "image"], ["POISONED", "poisoned"], ["CUT", "cut"], ["STUN", "stun"],
  ["FOOD", "food"], ["PROTEVIL", "protEvil"], ["HERO", "hero"], ["SHERO", "shero"], ["SHIELD", "shield"],
  ["BLESSED", "blessed"], ["OPP_ACID", "resAcid"], ["OPP_ELEC", "resElec"], ["OPP_FIRE", "resFire"],
  ["OPP_COLD", "resCold"], ["OPP_POIS", "resPois"], ["AMNESIA", "amnesia"], ["STONESKIN", "stoneskin"],
  ["TERROR", "terror"], ["SPRINT", "sprint"], ["FASTCAST", "fastcast"],
];

/** The engine names of the timed effects running on the character, or null
 * without a character. Covers only the effects in TIMED_NAMES. API 1: playerTimedEffects. */
export function playerTimedEffects(frame: Api2Frame): string[] | null {
  const status = frame.world?.player?.status;
  if (!status) return null;
  return TIMED_NAMES.filter(([, field]) => Number(status[field] ?? 0) > 0).map(([name]) => name);
}

/** Everything the character carries. API 1: carriedGear, which yields live objects instead. */
export function carriedGear(frame: Api2Frame): KnownItem[] {
  const world = frame.world;
  if (!world) return [];
  const worn = (world.equipment ?? []).filter((item): item is KnownItem => item !== null);
  return [...(world.inventory ?? []), ...worn, ...(world.quiver ?? [])];
}

/** Whether the character knows an item is an artifact. API 1: knownArtifactTest. */
export function knownArtifactTest(): (item: KnownItem) => boolean {
  return (item) => item.artifact;
}

// The level.

/** A key that changes when the character changes level. API 1: levelKey. */
export function levelKey(frame: Api2Frame): number | undefined {
  return frame.world?.level?.levelId;
}

/** The current level's depth. API 1: levelDepth. */
export function levelDepth(frame: Api2Frame): number | undefined {
  return frame.world?.level?.depth;
}

/** The current level's size, or null before a level exists. API 1: levelSize. */
export function levelSize(frame: Api2Frame): { readonly width: number; readonly height: number } | null {
  const level = frame.world?.level;
  return level ? { width: level.width, height: level.height } : null;
}

function cellAt(frame: Api2Frame, grid: Grid): KnownLevelCell | undefined {
  const level = frame.world?.level;
  if (!level || grid.x < 0 || grid.y < 0 || grid.x >= level.width || grid.y >= level.height) return undefined;
  const indexed = level.cells[grid.y * level.width + grid.x];
  if (indexed && indexed.x === grid.x && indexed.y === grid.y) return indexed;
  return level.cells.find((cell) => cell.x === grid.x && cell.y === grid.y);
}

/** Whether a trap the character knows of is on this grid. API 1: gridHasVisibleTrap. */
export function gridHasVisibleTrap(frame: Api2Frame, grid: Grid): boolean {
  return (cellAt(frame, grid)?.remembered.traps.length ?? 0) > 0;
}

/** Whether the character remembers a shop entrance on this grid: its
 * remembered terrain is one the known shops stand on. API 1: gridIsShop, which
 * reads the real terrain instead. */
export function gridIsShop(frame: Api2Frame, grid: Grid): boolean {
  const feat = cellAt(frame, grid)?.remembered.feat;
  return feat !== undefined && (frame.world?.stores ?? []).some((store) => store.feat === feat);
}

/** The objects the character remembers on a grid. API 1: rememberedPile, whose
 * entries also carry the live object for naming. */
export function rememberedPile(frame: Api2Frame, grid: Grid): readonly KnownRememberedObject[] {
  return cellAt(frame, grid)?.remembered.objects ?? [];
}
