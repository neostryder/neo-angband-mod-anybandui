/**
 * The one place this mod reads the game host. Features call these functions
 * instead of reading ctx.core, ctx.state, ctx.registries or a raw snapshot, so
 * the move to mod API 2 rewrites this file and leaves the features alone. Each
 * function is named after the API 2 call that will replace it, and its doc
 * names that call.
 *
 * truthLevel is the only read of the real map. It backs the "Glow shows hidden
 * magic" rule (anybandui.itemGlowReveals) and the state:map-actual.read grant,
 * and becomes truth.level() under API 2. Everything else reads what the
 * character knows.
 */
import type { ActualCell, AgentView, GameObject, GameState, KnownLevelView, ModCoreApi } from "@rpgm-tools/neo-angband-core";
import type { Grid, ItemsContext, LoadoutSimulation } from "./seams.js";

/** A plugin context, or the core and state pair a feature or a test hands in. */
export interface LiveGame { readonly core?: unknown; readonly state?: unknown }

/* The engine exports this file calls, all optional so a missing one reads as absent. */
interface HostCore {
  readonly TMD?: Readonly<Record<string, number>>;
  describeLookGrid?(state: unknown, grid: Grid, mode: number): { text?: string; mon?: { hp?: number; maxhp?: number } | null } | null;
  knownPile?(state: unknown, grid: Grid): readonly { sensed?: boolean; obj?: unknown }[];
  describeObject?(state: unknown, object: unknown): string;
  squareApparentName?(state: unknown, grid: Grid): string;
  squareIsSeen?(chunk: unknown, grid: Grid): boolean;
  squareIsVisibleTrap?(state: unknown, grid: Grid): boolean;
  floorObject?(grid: Grid, floorIndex: number): GameObject | null;
  createAgentView?(state: unknown): { simulateLoadout?(change: unknown): LoadoutSimulation | null };
}

/* The live state fields this file reads. */
interface HostState {
  readonly actor?: { readonly grid?: Grid; readonly player?: { readonly timed?: readonly number[]; readonly chp?: number; readonly mhp?: number; readonly race?: { readonly name?: unknown }; readonly cls?: { readonly name?: unknown }; readonly auBirth?: unknown; readonly htBirth?: unknown; readonly wtBirth?: unknown } };
  readonly chunk?: { readonly width: number; readonly height: number; readonly depth?: number; feature?(grid: Grid): { shopnum?: number } | undefined };
  readonly levelSerial?: number;
}

const coreOf = (game: LiveGame | null | undefined): HostCore | undefined => game?.core as HostCore | undefined;
const stateOf = (game: LiveGame | null | undefined): HostState | undefined => game?.state as HostState | undefined;

// Known world: the snapshot and the remembered map.

/** The input snapshot, or null when the host has none. API 2: view.input(). */
export function viewInput<S>(seam: { readonly snapshot?: (() => S | null) | undefined }): S | null {
  return seam.snapshot?.() ?? null;
}

/** The known world inside an input snapshot. API 2: view.world(). */
export function viewWorld<C>(input: { readonly core: C }): C;
export function viewWorld<C>(input: { readonly core?: C | null | undefined } | null | undefined): C | null | undefined;
export function viewWorld<C>(input: { readonly core?: C | null | undefined } | null | undefined): C | null | undefined {
  return input?.core;
}

/** The character as the snapshot shows it. API 2: view.player(). */
export function viewPlayer<P>(input: { readonly core?: { readonly player?: P } | null | undefined } | null | undefined): P | undefined {
  return input?.core?.player;
}

/** The monsters the snapshot lists, visible or not. API 2: view.monsters(). */
export function viewMonsters<M>(input: { readonly core?: { readonly monsters?: M } | null | undefined } | null | undefined): M | undefined {
  return input?.core?.monsters;
}

/** The remembered map, or null when the host has none. API 2: view.level(). */
export function viewLevel<L>(seam: { readonly knownLevel?: (() => L | null) | undefined }): L | null {
  return seam.knownLevel?.() ?? null;
}

// Truth: the real map, read only for the hidden-magic glow.

/** The real contents of each cell the remembered map carries them for, with
 * the cell's grid. Cells come with them only under state:map-actual.read.
 * API 2: truth.level().cells (first-party only). */
export function truthLevel(level: Pick<KnownLevelView, "cells"> | null | undefined): { readonly cells: readonly (ActualCell & Grid)[] } {
  const cells: (ActualCell & Grid)[] = [];
  for (const cell of level?.cells ?? []) if (cell.actual) cells.push({ ...cell.actual, x: cell.x, y: cell.y });
  return { cells };
}

// Live game: reads that take the core and state the plugin registered with.

/** The core and state the plugin registered with, under the names the
 * features use. API 2: none; the view, act and truth domains replace them. */
export function liveGame<C, S>(ctx: { readonly core?: C; readonly state?: S }): { readonly liveCore: C | undefined; readonly liveState: S | undefined } {
  return { liveCore: ctx.core, liveState: ctx.state };
}

/** The agent view and floor lookup the item panels take,
 * bound to the live state, or nothing without both. API 2: none; the panels
 * would read view.world() and submit through act. */
export function itemsGame(core: ModCoreApi | undefined, state: GameState | undefined): Pick<ItemsContext, "core" | "state"> {
  if (!core || !state) return {};
  return { state, core: { createAgentView: () => core.createAgentView(state),
    floorObject: (grid, floorIndex) => listedFloorObject(core, state, grid, floorIndex) } };
}

/** Whether the host's core has every one of these exports. API 2: meta.granted() for the matching capability. */
export function offers(game: LiveGame, names: readonly string[]): boolean {
  const core = game.core as Readonly<Record<string, unknown>> | null | undefined;
  return !!core && names.every((name) => typeof core[name] === "function");
}

/** Whether the plugin was handed a live state. API 2: none; every view read carries its own token. */
export function hasLiveState(game: LiveGame): boolean {
  return !!game.state;
}

/** The character's grid. API 2: view.player().grid. */
export function playerGrid(game: LiveGame): Grid | undefined {
  return stateOf(game)?.actor?.grid;
}

/** The character's current and maximum hit points. API 2: view.player().hp and maxHp. */
export function playerHitPoints(game: LiveGame): { readonly hp: number | undefined; readonly maxHp: number | undefined } {
  const player = stateOf(game)?.actor?.player;
  return { hp: player?.chp, maxHp: player?.mhp };
}

/** Whether the character is hallucinating. API 2: view.player().status.image. */
export function playerHallucinating(game: LiveGame): boolean {
  const core = coreOf(game);
  return core?.TMD?.IMAGE !== undefined && (stateOf(game)?.actor?.player?.timed?.[core.TMD.IMAGE] ?? 0) > 0;
}

/** The engine names of the timed effects running on the character, or null
 * when the engine lists none. API 2: view.player().status. */
export function playerTimedEffects(game: LiveGame): string[] | null {
  const TMD = coreOf(game)?.TMD, timed = stateOf(game)?.actor?.player?.timed;
  if (!TMD || !timed) return null;
  return Object.entries(TMD).filter(([, index]) => (timed[index] ?? 0) > 0).map(([name]) => name);
}

/** The race, class and birth figures that fingerprint a character, unchecked.
 * API 2: view.player().race and cls; the birth figures have no API 2 read. */
export function birthFacts(game: LiveGame): { readonly raceName: unknown; readonly clsName: unknown; readonly auBirth: unknown; readonly htBirth: unknown; readonly wtBirth: unknown } | null {
  const player = stateOf(game)?.actor?.player;
  if (!player) return null;
  return { raceName: player.race?.name, clsName: player.cls?.name, auBirth: player.auBirth, htBirth: player.htBirth, wtBirth: player.wtBirth };
}

/** A key that changes when the character changes level. API 2: view.level().levelId. */
export function levelKey(game: LiveGame): number | undefined {
  const state = stateOf(game);
  return state?.levelSerial ?? state?.chunk?.depth;
}

/** The current level's depth. API 2: view.level().depth. */
export function levelDepth<D>(game: { readonly state: { readonly chunk: { readonly depth: D } } }): D {
  return game.state.chunk.depth;
}

/** The current level's size, or null before a level exists. API 2: view.level().width and height. */
export function levelSize(game: LiveGame): { readonly width: number; readonly height: number } | null {
  const chunk = stateOf(game)?.chunk;
  return chunk ? { width: chunk.width, height: chunk.height } : null;
}

/** Whether the character sees this grid now. API 2: view.level() cell.visible. */
export function gridInView(game: LiveGame, grid: Grid): boolean {
  return coreOf(game)?.squareIsSeen?.(stateOf(game)?.chunk, grid) ?? false;
}

/** Whether a trap the character knows of is on this grid. API 2: view.level() cell.remembered.traps. */
export function gridHasVisibleTrap(game: LiveGame, grid: Grid): boolean {
  return !!coreOf(game)?.squareIsVisibleTrap?.(game.state, grid);
}

/** Whether this grid is a shop entrance. It reads the live chunk's feature;
 * shop entrances are fixed town features. API 2: view.level() cell.remembered.featCode. */
export function gridIsShop(game: LiveGame, grid: Grid): boolean {
  return (stateOf(game)?.chunk?.feature?.(grid)?.shopnum ?? 0) > 0;
}

/** The game's own look text for a grid and whether a creature is on it, or
 * null when the look read answers nothing. API 2: view.monsters() look text
 * and view.level() cells. */
export function lookAt(game: LiveGame, grid: Grid): { readonly text: string | undefined; readonly creature: boolean; readonly hp: number | undefined; readonly maxHp: number | undefined } | null {
  const look = coreOf(game)?.describeLookGrid?.(game.state, grid, 0);
  if (!look) return null;
  return { text: look.text, creature: !!look.mon, hp: look.mon?.hp, maxHp: look.mon?.maxhp };
}

/** The objects the character remembers on a grid. API 2: view.level() cell.remembered.objects. */
export function rememberedPile(game: LiveGame, grid: Grid): readonly { readonly sensed?: boolean; readonly obj?: unknown }[] {
  return coreOf(game)?.knownPile?.(game.state, grid) ?? [];
}

/** An object's name as the character knows it, or null when the engine has no
 * describer. API 2: the remembered object's name or view.world() item name. */
export function describeObject(game: LiveGame, object: unknown): string | null {
  const core = coreOf(game);
  return core?.describeObject ? core.describeObject(game.state, object) : null;
}

/** The terrain name the character sees on a grid. API 2: view.level() cell.remembered.featCode. */
export function apparentTerrain(game: LiveGame, grid: Grid): string | undefined {
  return coreOf(game)?.squareApparentName?.(game.state, grid);
}

/** The object behind a floor row: the pile at `grid` as the snapshot lists it,
 * less anything only sensed, at `floorIndex`. API 2: view.world().floorHere. */
export function listedFloorObject(core: Pick<ModCoreApi, "floorPile" | "knownFloorObject">, state: Parameters<ModCoreApi["floorPile"]>[0], grid: Grid, floorIndex: number): GameObject | null {
  if (!Number.isInteger(floorIndex) || floorIndex < 0) return null;
  try {
    const listed = core.floorPile(state, grid).filter((obj) => {
      const memory = core.knownFloorObject(state, grid, obj);
      return !!memory && !memory.sensed;
    });
    return listed[floorIndex] ?? null;
  } catch { return null; }
}

/** The floor object a row names, through the items context's own lookup. API 2: view.world().floorHere. */
export function floorObject(game: LiveGame, grid: Grid, floorIndex: number): GameObject | null {
  return coreOf(game)?.floorObject?.(grid, floorIndex) ?? null;
}

/** Whether a loadout comparison can be asked for. API 2: none; the comparison moves to an act or view read. */
export function canSimulateLoadout(game: LiveGame): boolean {
  return !!coreOf(game)?.createAgentView && !!game.state;
}

/** What wearing a change would do to the character, or null. API 2: no
 * counterpart yet; simulateLoadout has no API 2 read. */
export function simulateLoadout(game: LiveGame, change: unknown): LoadoutSimulation | null {
  return coreOf(game)?.createAgentView?.(game.state).simulateLoadout?.(change) ?? null;
}

/** The engine's agent view over the live state, with the HUD figures it
 * leaves out, or undefined without a state. API 2: view.world(), view.player()
 * and view.input(); the command queue has no API 2 read. */
export function liveHud(game: { readonly core: Pick<ModCoreApi, "createAgentView">; readonly state?: GameState }): { readonly view: AgentView; readonly name: string; readonly messages: GameState["messages"]; readonly study: number; readonly repeat: number; readonly resting: boolean; readonly running: boolean; readonly unignoring: number; readonly recall: number; readonly descent: number; readonly extraMoves: number } | undefined {
  const state = game.state;
  if (state === undefined) return undefined;
  return {
    view: game.core.createAgentView(state),
    name: state.actor.player.fullName,
    messages: state.messages,
    study: state.actor.player.upkeep.newSpells,
    repeat: state.cmdQueue?.[0]?.repeatRemaining ?? 0,
    resting: state.resting !== undefined,
    running: state.run !== undefined,
    unignoring: state.unignoring ?? 0,
    recall: state.actor.player.wordRecall,
    descent: state.actor.player.deepDescent,
    extraMoves: state.playerState?.numMoves ?? 0,
  };
}

/** The races of the monsters the character can see. API 2: view.monsters(). */
export function visibleMonsterRaces<R>(game: { readonly core: { monsterListCollect(state: never): { readonly entries: readonly { readonly race: R }[] } }; readonly state: unknown }): R[] {
  return game.core.monsterListCollect(game.state as never).entries.map((entry) => entry.race);
}

/** Everything the character carries. API 2: view.world().inventory, equipment and quiver. */
export function carriedGear<T>(game: { readonly state: { readonly gear: { readonly store: { values(): Iterable<T> } } } }): Iterable<T> {
  return game.state.gear.store.values();
}

/** The engine's test for an object the character knows is an artifact. API 2: KnownItem.artifact. */
export function knownArtifactTest<F>(game: { readonly core: { readonly liveObjectIsKnownArtifact: F } }): F {
  return game.core.liveObjectIsKnownArtifact;
}

/** The engine's depth and colour formatters. API 2: content.lookup() for colours; depth text has no API 2 read. */
export function coreFormatters<D, C>(game: { readonly core: { readonly fmtDepth: D; readonly colorToCss: C } }): { readonly fmtDepth: D; readonly colorToCss: C } {
  return { fmtDepth: game.core.fmtDepth, colorToCss: game.core.colorToCss };
}
