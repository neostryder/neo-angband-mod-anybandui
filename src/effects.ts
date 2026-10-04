import type { ActualObject, EffectContext, EffectEventMap, EffectSnapshot, EventActor, Grid } from "./seams.js";
import { featureCode, mapProjection } from "./map-overview.js";
import { validateSettings } from "./settings.js";
import { elementEdgeColour } from "./blast-preview.js";
import { truthLevel, viewInput, viewLevel, viewMonsters, viewPlayer } from "./host-adapter.js";

type CueKind = "cast" | "hit" | "miss" | "death" | "heal" | "departure" | "arrival" | "blast" | "number" | "slide" | "ripple" | "bolt" | "cone";
type Cue = {
  grid: Grid; kind: CueKind; started: number; strength: number; colour?: string; text?: string; glyph?: string;
  from?: Grid; delay?: number; life?: number; distance?: number; span?: number;
};
type DrawnCue = Omit<Cue, "started" | "strength">;
/** How strongly the low-health effect shows. `warning` is PlayerView.hpWarning in
 * hit points, and the effect starts once hp falls below it, as the game's own
 * warning does. An older engine has no hpWarning, and a player who turned the
 * game's warning off has 0; both get 30 percent of maximum, since this switch
 * was turned on separately. */
export function healthIntensity(hp: number | undefined, maxHp: number | undefined, warning: number | undefined): number {
  if (!(hp !== undefined && maxHp && maxHp > 0 && hp > 0)) return 0;
  const threshold = warning !== undefined && warning > 0 ? warning : maxHp * 0.3;
  return hp >= threshold ? 0 : Math.min(1, (threshold - hp) / threshold + 0.12);
}
export function chooseEffectMotion(reduced: boolean): "motion" | "static" { return reduced ? "static" : "motion"; }
export type Aura = "cursed" | "artifact" | "rune";
const AURA_ORDER: readonly Aura[] = ["cursed", "artifact", "rune"];
export const AURA_COLOURS: Readonly<Record<Aura, string>> = { cursed: "#ff4f6d", artifact: "#ffd36a", rune: "#7fd8ff" };
/** What the effects draw this frame. A unique is `final` when it guards the
 * winning quest. The 4t reads (unique, finalGuardian, a remembered object's
 * aura) decide where the engine has them; an older engine falls back to the
 * UNIQUE race flag, Morgoth's name, and an artifact field that only shows
 * artifacts. One glow per cell, in the game's own order: cursed, artifact, rune. */
/** The aura an object really has, whatever the player knows: Wurli's ddf05117b
 * rule, used only when the player turns on the hidden-magic glow. */
export function actualAura(o: ActualObject): Aura | undefined {
  if (o.curses.length > 0) return "cursed";
  if (o.artifact) return "artifact";
  const magical = o.ego || o.flags.length > 0 || o.modifiers.length > 0 || o.brands.length > 0 || o.slays.length > 0 || o.resists.length > 0 || o.toH !== 0 || o.toD !== 0 || o.toA !== 0;
  return magical ? "rune" : undefined;
}

export function effectGrids(s: EffectSnapshot | null, known: ReturnType<NonNullable<EffectContext["knownLevel"]>>, revealHidden = false): { asleep: Grid[]; afraid: Grid[]; uniques: { grid: Grid; final: boolean }[]; glows: { grid: Grid; aura: Aura }[] } {
  const asleep: Grid[] = [], afraid: Grid[] = [], uniques: { grid: Grid; final: boolean }[] = [], glows: { grid: Grid; aura: Aura }[] = [];
  for (const m of viewMonsters(s) ?? []) if (m.visible) {
    if (m.asleep) asleep.push(m.grid);
    if (m.afraid) afraid.push(m.grid);
    if (m.unique ?? m.raceFlags.includes("UNIQUE")) uniques.push({ grid: m.grid, final: m.finalGuardian ?? m.race === "Morgoth, Lord of Darkness" });
  }
  const truth = revealHidden ? new Map(truthLevel(known).cells.map((cell) => [cell.y * 65536 + cell.x, cell])) : null;
  for (const c of known?.cells ?? []) {
    const auras = new Set<Aura>();
    /* A hidden-magic glow reads the true pile, but only where the player can see
     * the grid, remembers an object there, and no creature stands on it. */
    const actual = truth?.get(c.y * 65536 + c.x);
    if (actual && c.visible === true && actual.monster === 0 && c.remembered.objects.length > 0) {
      for (const o of actual.objects) { const aura = actualAura(o); if (aura) auras.add(aura); }
    }
    for (const o of c.remembered.objects) {
      if (!o || typeof o !== "object") continue;
      const read = o as { aura?: string; artifact?: boolean };
      const aura = read.aura ?? (read.artifact === true ? "artifact" : undefined);
      if (aura === "cursed" || aura === "artifact" || aura === "rune") auras.add(aura);
    }
    const aura = AURA_ORDER.find((a) => auras.has(a));
    if (aura) glows.push({ grid: { x: c.x, y: c.y }, aura });
  }
  return { asleep, afraid, uniques, glows };
}
/** A frightened creature shows the exclamation mark instead of the sleep mark,
 * and only while that switch is on. Both lists stay complete for the caller. */
export function markGrids(asleep: readonly Grid[], afraid: readonly Grid[], fearOn: boolean): { sleep: Grid[]; fear: Grid[] } {
  if (!fearOn) return { sleep: [...asleep], fear: [] };
  const fearAt = new Set(afraid.map((p) => `${p.x},${p.y}`));
  return { sleep: asleep.filter((p) => !fearAt.has(`${p.x},${p.y}`)), fear: [...afraid] };
}
type SourceEvent = ({ event: "combat-outcome"; attacker: EventActor | null; kind: "melee" | "ranged" | "spell" | "effect" | "trap"; hit: boolean; died: boolean; grid: Grid; seen: boolean } | { event: "heal"; grid: Grid; seen: boolean } | { event: "motion"; from: Grid; to: Grid; kind: "walk" | "teleport"; seen: boolean });
/** Where a creature named by an event stands now: the player's grid or a visible monster's. */
export function actorGrid(s: EffectSnapshot | null, who: EventActor | null): Grid | null {
  if (who === null) return null;
  if (who === "player") return viewPlayer(s)?.grid ?? null;
  return viewMonsters(s)?.find((m) => m.id === who && m.visible)?.grid ?? null;
}
export function eventCue(e: SourceEvent, locate: (who: EventActor | null) => Grid | null = () => null): DrawnCue[] {
  if (!e.seen) return [];
  if (e.event === "combat-outcome") {
    const caster = e.kind === "spell" ? locate(e.attacker) : null;
    return [...(caster ? [{ grid: caster, kind: "cast" as const }] : []), { grid: e.grid, kind: e.died ? "death" : e.hit ? "hit" : "miss" }];
  }
  if (e.event === "heal") return [{ grid: e.grid, kind: "heal" }];
  // A walk is not a ring. The slide is its own cue, so the rings can be off while the slide stays on.
  return e.kind === "teleport" ? [{ grid: e.from, kind: "departure" }, { grid: e.to, kind: "arrival" }] : [];
}
/** Impact flashes for an explosion: each grid of the blast the player can see,
 * in the colour of its element. Capped so a huge breath cannot flood the list. */
export function blastCues(e: EffectEventMap["explosion"], limit = 200): DrawnCue[] {
  const colour = elementEdgeColour(e.element);
  const out: DrawnCue[] = [];
  e.blastGrid.forEach((grid, i) => { if (out.length < limit && e.playerSeesGrid[i]) out.push({ grid: { x: grid.x, y: grid.y }, kind: "blast", colour }); });
  return out;
}
const NUMBER_COLOUR = { heal: "#64ffa0", player: "#ff6152", monster: "#ffce63" } as const;
/** The number over the square that took the blow or the healing. Misses and
 * unseen events draw nothing, so a hidden creature's loss stays hidden. */
export function numberCues(e: { event: "combat-outcome"; hit?: boolean; damage?: number; grid?: Grid; seen?: boolean; target?: EventActor } | { event: "heal"; amount?: number; grid?: Grid; seen?: boolean }): DrawnCue[] {
  if (!e.seen || !e.grid) return [];
  if (e.event === "heal") {
    if (!(typeof e.amount === "number" && e.amount > 0)) return [];
    return [{ grid: e.grid, kind: "number", text: `+${e.amount}`, colour: NUMBER_COLOUR.heal, life: 720 }];
  }
  if (!e.hit || !(typeof e.damage === "number" && e.damage > 0)) return [];
  return [{ grid: e.grid, kind: "number", text: `-${e.damage}`, colour: e.target === "player" ? NUMBER_COLOUR.player : NUMBER_COLOUR.monster, life: 720 }];
}
/** One adjacent step, whoever the motion event names. Anything further is not a walk. Core marks
 * the event seen from the destination alone, and the slide starts on the origin, so an origin the
 * player cannot see draws nothing. */
export function walkCues(e: Partial<EffectEventMap["motion"]> | null | undefined, visible: (p: Grid) => boolean = () => true): DrawnCue[] {
  if (!e?.seen || e.kind !== "walk" || !e.from || !e.to || !visible(e.from)) return [];
  if (Math.max(Math.abs(e.to.x - e.from.x), Math.abs(e.to.y - e.from.y)) !== 1) return [];
  return [{ grid: e.to, from: e.from, kind: "slide", life: 100 }];
}
/** Ease toward the destination. t is 0 at the start square and 1 on arrival. */
export function slidePlace(from: Grid, to: Grid, t: number): Grid {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const remain = (1 - clamped) * (1 - clamped);
  return { x: to.x + (from.x - to.x) * remain, y: to.y + (from.y - to.y) * remain };
}
export function blinkCues(e: Partial<EffectEventMap["motion"]> | null | undefined): DrawnCue[] {
  if (!e?.seen || e.kind !== "teleport" || !e.to) return [];
  return [{ grid: e.to, kind: "ripple", life: 340, span: 3.8 }];
}
/** How bright a cell is while the ring passes it. 0 once the ring has moved on. */
export function rippleAlpha(distance: number, radius: number, age: number): number {
  return Math.max(0, 1 - Math.abs(distance - radius) / 0.85) * (1 - age) * 0.3;
}
export function rippleCells(centre: Grid, known: { readonly cells?: readonly { x: number; y: number; visible?: boolean }[] } | null, radius: number): Grid[] {
  const out: Grid[] = [];
  for (const c of known?.cells ?? []) {
    if (c.visible !== true) continue;
    if (Math.hypot(c.x - centre.x, c.y - centre.y) <= radius + 0.85) out.push({ x: c.x, y: c.y });
  }
  return out;
}
/** The character for one traveled step. Core's bolt event is that step: origin
 * in ox, oy and the square it reached in x, y. Electricity alternates by square
 * so a straight bolt does not repeat one character. */
export function boltGlyph(dx: number, dy: number, element: string, x: number, y: number): string {
  if (element === "ELEC") return (x + y) % 2 ? "~" : "*";
  if (dy === 0) return dx === 0 ? "*" : "-";
  if (dx === 0) return "|";
  return dx * dy > 0 ? "\\" : "/";
}
export function boltCue(e: Partial<EffectEventMap["bolt"]> | null | undefined, delay = 0): DrawnCue | null {
  if (!e?.seen || typeof e.x !== "number" || typeof e.y !== "number" || typeof e.ox !== "number" || typeof e.oy !== "number") return null;
  return {
    grid: { x: e.x, y: e.y }, from: { x: e.ox, y: e.oy }, kind: "bolt", delay, life: 200,
    glyph: boltGlyph(e.x - e.ox, e.y - e.oy, e.element ?? "", e.x, e.y), colour: elementEdgeColour(e.element),
  };
}
/** Core emits every step before the next frame. Spacing them is what plays the
 * bolt in order. Reduced motion shows the whole path at once. A gap starts a new bolt. */
export function nextBoltDelay(now: number, reduced: boolean, state: { count: number; at: number }): number {
  if (now - state.at > 50) { state.count = 0; state.at = now; }
  const delay = reduced ? 0 : Math.min(state.count, 48) * 40;
  state.count += 1;
  return delay;
}
const CONE_GLYPH: Readonly<Record<string, string>> = { COLD: "+", ICE: "+", ELEC: "*", POIS: "~", ACID: "~" };
/** A breath's squares, delayed by distance from the centre so the wash travels
 * outward. A ball is not a cone: arc is the flag that says so. */
export function coneCues(e: EffectEventMap["explosion"], limit = 200): DrawnCue[] {
  if (!e?.arc || !Array.isArray(e.blastGrid) || !Array.isArray(e.playerSeesGrid)) return [];
  const colour = elementEdgeColour(e.element);
  const glyph = CONE_GLYPH[e.element] ?? "^";
  const span = Math.max(1, e.radius || 0);
  const out: DrawnCue[] = [];
  e.blastGrid.forEach((grid, i) => {
    if (out.length >= limit || !e.playerSeesGrid[i]) return;
    const distance = Array.isArray(e.distanceToGrid) ? e.distanceToGrid[i] ?? 0 : 0;
    out.push({ grid: { x: grid.x, y: grid.y }, kind: "cone", colour, glyph, distance, span, delay: 240 * distance / span, life: 360 });
  });
  return out;
}
/** The Mods screen setting that sets each effect's strength (MOD_SEAMS 4y). The
 * spell rings and blast flashes share one; the death burst's cue follows the
 * death burst's own setting. */
export const STRENGTH_SETTINGS: Readonly<Record<string, string>> = {
  crt: "anybandui.crtStrength", lowHealth: "anybandui.lowHealthStrength", death: "anybandui.deathStrength",
  itemGlow: "anybandui.itemGlowStrength", sleepMarks: "anybandui.sleepMarksStrength", fearMarks: "anybandui.fearMarksStrength",
  presenceHaze: "anybandui.presenceHazeStrength",
  cast: "anybandui.spellEffectsStrength", hit: "anybandui.spellEffectsStrength", miss: "anybandui.spellEffectsStrength",
  heal: "anybandui.spellEffectsStrength", departure: "anybandui.spellEffectsStrength", arrival: "anybandui.spellEffectsStrength",
  blast: "anybandui.spellEffectsStrength", number: "anybandui.damageNumbersStrength", slide: "anybandui.walkSlideStrength",
  ripple: "anybandui.blinkRippleStrength", bolt: "anybandui.boltGlyphsStrength", cone: "anybandui.coneWashStrength",
  lava: "anybandui.lavaEmbersStrength", stairs: "anybandui.stairEmbersStrength", recall: "anybandui.recallRingStrength",
  level: "anybandui.levelFlashStrength", scene: "anybandui.sceneFadeStrength",
  crtGlow: "anybandui.crtGlowStrength", crtFringe: "anybandui.crtFringeStrength", crtSweep: "anybandui.crtSweepStrength",
};
/** Switches that install the dungeon overlay. Each one is also a Mods screen flag. */
export const EFFECT_FLAGS: readonly string[] = [
  "anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow",
  "anybandui.sleepMarks", "anybandui.fearMarks", "anybandui.presenceHaze", "anybandui.damageNumbers", "anybandui.walkSlide",
  "anybandui.blinkRipple", "anybandui.boltGlyphs", "anybandui.coneWash", "anybandui.spellEffects",
  "anybandui.lavaEmbers", "anybandui.stairEmbers", "anybandui.recallRing", "anybandui.levelFlash",
  "anybandui.sceneFade", "anybandui.crtGlow", "anybandui.crtFringe", "anybandui.crtSweep",
];
/** An effect's strength from 0 to 100. The engine's numeric settings decide
 * where it has them; an older engine has no control for them, so the strengths
 * this mod stored in its own preferences stand, at full strength by default. */
export function effectStrength(settings: EffectContext["settings"], stored: Readonly<Record<string, number>>, key: string): number {
  const id = STRENGTH_SETTINGS[key];
  let value: number | undefined;
  try { value = id ? settings?.get(id) : undefined; } catch { value = undefined; }
  const raw = typeof value === "number" && Number.isFinite(value) ? value : stored[key] ?? 100;
  return Math.max(0, Math.min(100, raw));
}

export type SceneTerrain = "lava" | "up" | "down";
/** Lava and stairs from a remembered terrain code. The local id is the part
 * after the pack prefix, so `core:lava` and the index fallback `LAVA` agree.
 * A code that merely contains those letters is left alone: the cell has no
 * fiery flag, and guessing would mark terrain the game did not name. */
export function sceneTerrain(code: string | undefined): SceneTerrain | null {
  if (!code) return null;
  const local = (code.split(":").pop() ?? code).toLowerCase().replace(/_/g, "-");
  if (local === "less" || local === "stair-up" || local === "up-stair") return "up";
  if (local === "more" || local === "stair-down" || local === "down-stair") return "down";
  if (local === "lava" || local.startsWith("lava-") || local.endsWith("-lava")) return "lava";
  return null;
}
type TerrainCell = { x: number; y: number; remembered: { feat: number; featCode?: string } };
/** Remembered lava and stairs. Known-level cells are already only squares the
 * character has seen, including ones outside the current light. */
export function sceneCells(known: { cells?: readonly TerrainCell[] } | null): { grid: Grid; kind: SceneTerrain }[] {
  const out: { grid: Grid; kind: SceneTerrain }[] = [];
  for (const cell of known?.cells ?? []) {
    const kind = sceneTerrain(featureCode(cell));
    if (kind) out.push({ grid: { x: cell.x, y: cell.y }, kind });
  }
  return out;
}
export function playerOnStairs(known: { cells?: readonly TerrainCell[] } | null, grid: Grid | null | undefined): boolean {
  if (!grid) return false;
  const cell = known?.cells?.find((entry) => entry.x === grid.x && entry.y === grid.y);
  if (!cell) return false;
  const kind = sceneTerrain(featureCode(cell));
  return kind === "up" || kind === "down";
}
/** The player's grid while Word of Recall still has turns left, else nothing. */
export function recallGrid(player: { grid?: Grid; recall?: number } | null | undefined): Grid | null {
  if (!player?.grid || !(typeof player.recall === "number" && player.recall > 0)) return null;
  return player.grid;
}
/** Sparks as fractions of a cell. Reduced motion holds each spark where it would be at time zero. */
export function driftingEmbers(now: number, seed: number, count: number, reduced: boolean): { x: number; y: number; alpha: number }[] {
  const out: { x: number; y: number; alpha: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (reduced ? 0 : (now / 1000) * 0.65) + seed + i * 0.25;
    const frac = t - Math.floor(t);
    out.push({ x: Math.sin(seed + i * 2 + frac * 3) * 0.4, y: 0.35 - frac * 1.05, alpha: Math.sin(frac * Math.PI) });
  }
  return out;
}

export interface LevelWatch { readonly highest: number; readonly flashedLevel: number; readonly started: number }
export const IDLE_LEVEL: LevelWatch = { highest: 0, flashedLevel: 0, started: -1 };
const LEVEL_PHASES = new Set(["play", "store", "more", "modal"]);
/** Session baseline. The first reading, and any climb back up to `maxLevel`,
 * stays quiet. A pause (`more`, `modal`) keeps the baseline; leaving the
 * session drops it. */
export function observeLevel(watch: LevelWatch, sample: { phase?: string | null | undefined; level?: number | undefined; maxLevel?: number | undefined; dead?: boolean | undefined }, now: number): LevelWatch {
  const phase = sample.phase;
  if (!phase) return watch;
  if (!LEVEL_PHASES.has(phase)) return IDLE_LEVEL;
  if (typeof sample.level !== "number" || !Number.isFinite(sample.level)) return watch;
  const current = sample.level;
  const recorded = typeof sample.maxLevel === "number" && Number.isFinite(sample.maxLevel) ? sample.maxLevel : current;
  const best = Math.max(current, recorded);
  const flashed = watch.highest > 0 && current > watch.highest && sample.dead !== true
    ? { highest: watch.highest, flashedLevel: current, started: now } : watch;
  return { ...flashed, highest: Math.max(flashed.highest, best) };
}
/** 0 to about 1 over 2.2s, front-loaded. Reduced motion holds a short steady mark. */
export function levelFlashIntensity(started: number, now: number, reduced = false): number {
  if (started < 0) return 0;
  const duration = reduced ? 200 : 2200;
  const t = (now - started) / duration;
  if (t < 0 || t >= 1) return 0;
  if (reduced) return 0.7;
  return Math.min(1, t * 12) * Math.max(0, 1 - t) * 1.15;
}

export type SceneKind = "load" | "stairs" | "shop" | "death";
export interface SceneWatch {
  readonly established: boolean; readonly levelId: number | null; readonly depth: number;
  readonly inShop: boolean; readonly onStairs: boolean; readonly kind: SceneKind | null; readonly started: number;
}
export const IDLE_SCENE: SceneWatch = { established: false, levelId: null, depth: 0, inShop: false, onStairs: false, kind: null, started: 0 };
export function sceneDuration(kind: SceneKind): number {
  return kind === "death" ? 900 : kind === "load" ? 420 : kind === "shop" ? 300 : 340;
}
export interface SceneSample { readonly phase?: string | null | undefined; readonly dead?: boolean | undefined; readonly levelId?: number | undefined; readonly depth?: number | undefined; readonly onStairs?: boolean | undefined }
/** Load on the first level, stairs only when the previous square was stairs,
 * the moment a shop opens, and death once. Leaving a shop does not fade:
 * the overlay only keeps the dungeon picture, not the shop screen. A missing
 * phase keeps the watch, so a gap in snapshots does not play the load fade again. */
export function observeScene(watch: SceneWatch, sample: SceneSample, now: number): SceneWatch {
  const phase = sample.phase;
  if (!phase) return watch;
  if (phase === "pregame") return IDLE_SCENE;
  if (sample.dead === true || phase === "dead") {
    return watch.kind === "death" ? watch : { ...watch, kind: "death", started: now };
  }
  let current: SceneWatch = watch.kind === "death" ? { ...watch, kind: null, started: 0 } : watch;
  const shop = phase === "store";
  if (current.established && shop && !current.inShop) current = { ...current, kind: "shop", started: now, inShop: true };
  else current = { ...current, inShop: shop };
  if (typeof sample.levelId !== "number" || !Number.isFinite(sample.levelId)) return current;
  const nextDepth = typeof sample.depth === "number" && Number.isFinite(sample.depth) ? sample.depth : current.depth;
  const onStairs = sample.onStairs === true;
  if (!current.established) {
    return { ...current, established: true, kind: "load", started: now, levelId: sample.levelId, depth: nextDepth, onStairs };
  }
  if (current.levelId !== null && sample.levelId !== current.levelId && current.onStairs) {
    current = { ...current, kind: "stairs", started: now };
  }
  return { ...current, levelId: sample.levelId, depth: nextDepth, onStairs };
}
/** How much of the previous frame is still covered. 1 at the start, 0 after. */
export function sceneOpacity(watch: SceneWatch, now: number, reduced = false): number {
  if (!watch.kind) return 0;
  const duration = reduced ? 80 : sceneDuration(watch.kind);
  const t = (now - watch.started) / duration;
  if (t < 0 || t >= 1) return 0;
  const remain = 1 - t;
  return remain * remain * (3 - 2 * remain);
}

/** Brightness kept for the phosphor bloom, 0 for a dark cell and 1 for a lit one. */
export function phosphorKeep(r: number, g: number, b: number): number {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const x = (lum - 0.08) / (0.45 - 0.08);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}
/** Pixel shift for the red and blue channels. 0 when the part is off. */
export function fringeOffset(strength: number, width: number): number {
  if (!(strength > 0) || !(width > 0)) return 0;
  return Math.max(1, Math.round(strength * Math.min(6, width * 0.006)));
}
/** Cubic trail just above a downward front, wrapping with the screen. 1 on the
 * front, 0 once the row is 24% of the height behind it. */
export function sweepTrail(y: number, front: number, height: number): number {
  if (!(height > 0)) return 0;
  const behind = (front - y) / height;
  const wrapped = behind - Math.floor(behind);
  if (wrapped >= 0.24) return 0;
  const t = 1 - wrapped / 0.24;
  return t * t * t;
}
export function glowFigure(aura: Aura): "sunburst" | "disc" {
  return aura === "artifact" ? "sunburst" : "disc";
}
export function sunburstAngles(spin: number): readonly number[] {
  return Array.from({ length: 6 }, (_, ray) => ray * (Math.PI / 3) + spin);
}
/** Cell centre in the map overlay. The same grid lands on the same point in
 * text mode and under any tileset, because the viewport is in cells. */
export function cellAnchor(origin: Grid, size: { width: number; height: number }, rect: { width: number; height: number }, grid: Grid): { x: number; y: number } {
  const cellW = rect.width / size.width, cellH = rect.height / size.height;
  return { x: (grid.x - origin.x + 0.5) * cellW, y: (grid.y - origin.y + 0.5) * cellH };
}
/** `#game` is the terminal canvas, whether it is drawing glyphs or tiles. */
export function terminalCanvas(doc: { getElementById(id: string): unknown } | undefined = typeof document === "undefined" ? undefined : document): HTMLCanvasElement | null {
  const node = doc?.getElementById("game");
  return typeof HTMLCanvasElement !== "undefined" && node instanceof HTMLCanvasElement ? node : null;
}
/** Copy one CSS rectangle out of the terminal canvas. False when the picture
 * cannot be read, in which case the caller draws no sampled effect. */
export function blitRegion(game: HTMLCanvasElement, css: { x: number; y: number; width: number; height: number }, dest: HTMLCanvasElement): boolean {
  const bounds = game.getBoundingClientRect();
  if (!(bounds.width > 0) || !(bounds.height > 0) || !(css.width > 1) || !(css.height > 1)) return false;
  const scaleX = game.width / bounds.width, scaleY = game.height / bounds.height;
  const sx = (css.x - bounds.left) * scaleX, sy = (css.y - bounds.top) * scaleY;
  const sw = css.width * scaleX, sh = css.height * scaleY;
  if (!(sw > 1) || !(sh > 1)) return false;
  const dw = Math.max(1, Math.round(css.width)), dh = Math.max(1, Math.round(css.height));
  if (dest.width !== dw) dest.width = dw;
  if (dest.height !== dh) dest.height = dh;
  const cg = dest.getContext("2d");
  if (!cg) return false;
  try {
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.drawImage(game, sx, sy, sw, sh, 0, 0, dw, dh);
    return true;
  } catch { return false; }
}
export function installEffects(ctx: EffectContext): () => void {
  const flags = ctx.flags ?? {};
  const enabled = EFFECT_FLAGS.some((x) => flags[x]);
  const display = ctx.display;
  if (!enabled || !display || typeof document === "undefined") return () => {};
  const activeDisplay = display;
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", pointerEvents: "none", zIndex: "2", display: "none" }); document.body.append(canvas);
  const maybeContext = canvas.getContext("2d"); if (!maybeContext) { canvas.remove(); return () => {}; }
  const g: CanvasRenderingContext2D = maybeContext;
  const cues: Cue[] = []; let raf = 0, wasDead = false, deadBurstAt = 0;
  let levelWatch: LevelWatch = IDLE_LEVEL, sceneWatch: SceneWatch = IDLE_SCENE;
  const held = document.createElement("canvas"), sample = document.createElement("canvas");
  const glowScratch = document.createElement("canvas"), fringeScratch = document.createElement("canvas");
  let heldReady = false;
  let lastRect: { x: number; y: number; width: number; height: number } | null = null;
  const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const push = (list: DrawnCue[]) => { const effects = validateSettings(ctx.prefs?.get()).effects; for (const cue of list) { const strength = effectStrength(ctx.settings, effects, cue.kind); if (strength > 0) cues.push({ ...cue, started: performance.now(), strength }); } request(); };
  const add = (e: SourceEvent) => push(eventCue(e, (who) => actorGrid(viewInput(ctx), who)));
  const spell = flags["anybandui.spellEffects"] === true, numbers = flags["anybandui.damageNumbers"] === true;
  const slides = flags["anybandui.walkSlide"] === true, ripples = flags["anybandui.blinkRipple"] === true;
  const bolts = flags["anybandui.boltGlyphs"] === true, cones = flags["anybandui.coneWash"] === true;
  const boltState = { count: 0, at: 0 };
  // Core calls each handler with the event name first and the payload second.
  const combat = (_type: "combat-outcome", e: EffectEventMap["combat-outcome"]) => { if (spell) add({ event: "combat-outcome", ...e }); if (numbers) push(numberCues({ event: "combat-outcome", ...e })); };
  const heal = (_type: "heal", e: EffectEventMap["heal"]) => { if (spell) add({ event: "heal", ...e }); if (numbers) push(numberCues({ event: "heal", ...e })); };
  const motion = (_type: "motion", e: EffectEventMap["motion"]) => { if (spell) add({ event: "motion", ...e }); if (slides) push(walkCues(e, (p) => (viewLevel(ctx)?.cells ?? []).some((c) => c.x === p.x && c.y === p.y && c.visible === true))); if (ripples) push(blinkCues(e)); };
  const explosion = (_type: "explosion", e: EffectEventMap["explosion"]) => {
    if (!e || !Array.isArray(e.blastGrid) || !Array.isArray(e.playerSeesGrid)) return;
    // A breath uses the cone wash instead of the flat flash while that switch is on.
    if (e.arc && cones) push(coneCues(e)); else if (spell) push(blastCues(e));
  };
  const bolt = (_type: "bolt", e: EffectEventMap["bolt"]) => {
    const delay = nextBoltDelay(performance.now(), reduced(), boltState);
    const cue = boltCue(e, delay); if (cue) push([cue]);
  };
  // Each switch subscribes only to the events it draws. The rings stay on the spell effects switch.
  const listenCombat = spell || numbers, listenMotion = spell || slides || ripples, listenBlast = spell || cones, listenBolt = bolts;
  if (listenCombat) { ctx.events?.on("combat-outcome", combat); ctx.events?.on("heal", heal); }
  if (listenMotion) ctx.events?.on("motion", motion);
  if (listenBlast) ctx.events?.on("explosion", explosion);
  if (listenBolt) ctx.events?.on("bolt", bolt);
  function request() { if (!raf) raf = requestAnimationFrame(draw); }
  function draw(now: number) {
    raf = 0;
    const view = activeDisplay.snapshot(), rect = mapProjection(view); const snap = viewInput(ctx);
    const player = viewPlayer(snap) ?? null;
    const known = viewLevel(ctx);
    const staticMode = chooseEffectMotion(reduced()) === "static";
    if (flags["anybandui.levelFlash"]) {
      levelWatch = observeLevel(levelWatch, { phase: snap?.phase, level: player?.level, maxLevel: player?.maxLevel, dead: player?.dead === true }, now);
    }
    if (flags["anybandui.sceneFade"]) {
      sceneWatch = observeScene(sceneWatch, {
        phase: snap?.phase, dead: player?.dead === true || snap?.phase === "dead",
        ...(known ? { levelId: known.levelId, depth: known.depth } : {}),
        onStairs: playerOnStairs(known, player?.grid),
      }, now);
    }
    const fade = flags["anybandui.sceneFade"] ? sceneOpacity(sceneWatch, now, staticMode) : 0;
    const live = rect && view.mode === "play" ? rect : null;
    if (live) lastRect = live;
    const drawRect = live ?? (fade > 0 ? lastRect : null);
    if (!drawRect) { canvas.style.display = "none"; if (fade > 0) request(); return; }
    canvas.style.display = "block"; canvas.style.left = `${drawRect.x}px`; canvas.style.top = `${drawRect.y}px`; canvas.style.width = `${drawRect.width}px`; canvas.style.height = `${drawRect.height}px`;
    const dpr = devicePixelRatio || 1; canvas.width = Math.round(drawRect.width * dpr); canvas.height = Math.round(drawRect.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, drawRect.width, drawRect.height);
    // ctx.prefs parses its stored value on every read, so read the settings once per frame.
    const effectSettings = validateSettings(ctx.prefs?.get()).effects;
    const intensity = (key: string) => effectStrength(ctx.settings, effectSettings, key) / 100;
    const sceneAlpha = fade * intensity("scene");
    if (live && view.viewport.size.width > 0 && view.viewport.size.height > 0) {
      const cellW = live.width / view.viewport.size.width, cellH = live.height / view.viewport.size.height;
      const cell = (p: Grid) => cellAnchor(view.viewport.origin, view.viewport.size, live, p);
      const seen = (p: Grid) => { const q = cell(p); return q.x >= -cellW && q.y >= -cellH && q.x <= live.width + cellW && q.y <= live.height + cellH; };
      if (flags["anybandui.lowHealthEffect"] && intensity("lowHealth") > 0) { const v = healthIntensity(player?.hp, player?.maxHp, player?.hpWarning) * intensity("lowHealth"); if (v) { g.fillStyle = `rgba(255,20,25,${v*(staticMode ? .10 : .08+.08*Math.sin(now/45))})`; g.fillRect(0,0,live.width,live.height); } }
      // PlayerView.dead turns true at the killing blow, before the -more- that
      // leads to the dead phase, so the burst lands on the blow itself.
      const dead = snap?.phase === "dead" || player?.dead === true;
      if (dead && !wasDead && flags["anybandui.deathEffect"] && intensity("death") > 0) { deadBurstAt=now; const at = player?.grid; if (at) cues.push({ grid: at, kind:"death", started:now, strength:100 }); }
      wasDead = dead;
      const grids = effectGrids(snap, known, flags["anybandui.itemGlowReveals"] === true);
      if (flags["anybandui.itemGlow"]) for (const glow of grids.glows) paint(glow.grid, AURA_COLOURS[glow.aura], intensity("itemGlow"), glow.aura);
      const marked = markGrids(grids.asleep, grids.afraid, flags["anybandui.fearMarks"] === true && intensity("fearMarks") > 0);
      if (flags["anybandui.sleepMarks"]) for (const p of marked.sleep) { const q=cell(p); g.strokeStyle=`rgba(190,220,255,${intensity("sleepMarks")})`; g.lineWidth=1.5; g.beginPath(); g.moveTo(q.x-3,q.y-cellH*.38); g.lineTo(q.x,q.y-cellH*.52); g.lineTo(q.x+3,q.y-cellH*.38); g.stroke(); }
      // The exclamation mark is drawn as text on the cell, so text mode and every tileset show the same mark.
      if (flags["anybandui.fearMarks"]) for (const p of marked.fear) { const q=cell(p); const bob = staticMode ? 0 : Math.sin(now / 200) * cellH * .06; g.globalAlpha = intensity("fearMarks"); g.fillStyle = "#f5ba69"; g.font = `${Math.max(12, cellH * .55)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", q.x, q.y - cellH * .42 + bob); g.globalAlpha = 1; }
      if (flags["anybandui.presenceHaze"]) for (const u of grids.uniques) paint(u.grid,"#b45cff",intensity("presenceHaze") * (u.final ? 1 : .65));
      const places = (flags["anybandui.lavaEmbers"] || flags["anybandui.stairEmbers"]) ? sceneCells(known) : [];
      if (flags["anybandui.lavaEmbers"]) for (const place of places) if (place.kind === "lava" && seen(place.grid)) embers(place.grid, "lava", intensity("lava"));
      if (flags["anybandui.stairEmbers"]) for (const place of places) if (place.kind !== "lava" && seen(place.grid)) embers(place.grid, place.kind, intensity("stairs"));
      const recallAt = flags["anybandui.recallRing"] ? recallGrid(player) : null;
      if (recallAt && seen(recallAt)) ring(recallAt, intensity("recall"));
      const flash = flags["anybandui.levelFlash"] ? levelFlashIntensity(levelWatch.started, now, staticMode) * intensity("level") : 0;
      if (flash > 0 && player?.grid && seen(player.grid)) { const q = cell(player.grid); g.fillStyle = `rgba(255,196,80,${0.45 * flash})`; g.beginPath(); g.arc(q.x, q.y, Math.max(cellW, cellH) * 0.9, 0, Math.PI * 2); g.fill(); }
      let active=false;
      for (const c of cues) {
        const life = c.life ?? 650, delay = staticMode ? 0 : (c.delay ?? 0), elapsed = now - c.started - delay;
        if (elapsed < 0) { active = true; continue; }
        const age = elapsed / life; if (age >= (staticMode ? 0.08 : 1)) continue; active = true;
        const q = cell(c.grid), a = staticMode ? .45 : (1 - age) * c.strength / 100;
        if (c.kind === "blast") { g.fillStyle = c.colour ?? "#ffbe5a"; g.globalAlpha = a * .55; g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH); g.globalAlpha = 1; continue; }
        if (c.kind === "number") { const rise = staticMode ? 0 : age * cellH * .65; g.globalAlpha = a; g.fillStyle = c.colour ?? "#ffce63"; g.font = `${Math.max(13, cellH * .7)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(c.text ?? "", q.x, q.y - cellH * .15 - rise); g.globalAlpha = 1; continue; }
        if (c.kind === "slide" && c.from) { const at = slidePlace(c.from, c.grid, staticMode ? 1 : age); const s = cell(at); g.globalAlpha = a; g.fillStyle = "#d7e6f5"; g.beginPath(); g.arc(s.x, s.y, Math.max(3, cellW * .22), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; continue; }
        if (c.kind === "ripple") {
          const radius = staticMode ? 0 : age * (c.span ?? 3.8);
          const cells = rippleCells(c.grid, known, radius);
          for (const p of cells) { const band = staticMode ? .3 : rippleAlpha(Math.hypot(p.x - c.grid.x, p.y - c.grid.y), radius, age); if (band <= 0) continue; const s = cell(p); g.globalAlpha = band * c.strength / 100; g.fillStyle = "#a6d4ff"; g.fillRect(s.x - cellW / 2, s.y - cellH / 2, cellW, cellH); }
          g.globalAlpha = 1; continue;
        }
        if (c.kind === "bolt" || c.kind === "cone") {
          const ink = c.colour ?? "#ffbe5a"; g.fillStyle = ink; g.globalAlpha = a * (c.kind === "cone" ? .42 : .34); g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH);
          g.globalAlpha = a; g.font = `${Math.max(12, cellH * .8)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(c.glyph ?? "*", q.x, q.y); g.globalAlpha = 1; continue;
        }
        g.strokeStyle=`rgba(${c.kind==="heal"?"100,255,160":c.kind==="cast"?"100,190,255":"255,190,90"},${a})`; g.lineWidth=2; g.beginPath(); g.arc(q.x,q.y,staticMode?5:4+age*cellH*.55,0,Math.PI*2); g.stroke();
      }
      cues.splice(0, cues.length, ...cues.filter((c) => now - c.started < (c.life ?? 650) + (staticMode ? 0 : (c.delay ?? 0))));
      if (flags["anybandui.deathEffect"] && deadBurstAt && now-deadBurstAt<900) active=true;
      if (sceneAlpha > 0) cover(drawRect, sceneAlpha);
      if (sceneAlpha === 0) hold(live);
      const crtOn = flags["anybandui.crt"] && intensity("crt") > 0;
      if (crtOn) {
        g.fillStyle = `rgba(0,0,0,${.10 * intensity("crt")})`; for (let y=0; y<live.height; y+=3) g.fillRect(0,y,live.width,1);
        if (!staticMode) { const y = now / 14 % live.height; g.fillStyle = "rgba(120,220,255,.08)"; g.fillRect(0,y,live.width,Math.max(2,cellH*.18)); }
      }
      if (sceneAlpha === 0) sampled(live, intensity("crtGlow"), intensity("crtFringe"));
      if (flags["anybandui.crtSweep"] && !staticMode && intensity("crtSweep") > 0) sweep(live.height, live.width, intensity("crtSweep"));
      const moving = !staticMode && (crtOn || (flags["anybandui.crtSweep"] && intensity("crtSweep") > 0) || (flags["anybandui.lowHealthEffect"] && healthIntensity(player?.hp, player?.maxHp, player?.hpWarning) > 0) || (flags["anybandui.sleepMarks"] && grids.asleep.length > 0) || (flags["anybandui.fearMarks"] && grids.afraid.length > 0) || (flags["anybandui.itemGlow"] && grids.glows.length > 0) || (flags["anybandui.presenceHaze"] && grids.uniques.length > 0) || places.length > 0 || recallAt !== null || (flags["anybandui.crtGlow"] && intensity("crtGlow") > 0) || (flags["anybandui.crtFringe"] && intensity("crtFringe") > 0));
      if (active || sceneAlpha > 0 || flash > 0 || moving) request();
      function paint(p: Grid, color: string, a: number, aura?: Aura) {
        if (!a) return; const q = cell(p);
        if (aura && glowFigure(aura) === "sunburst") {
          const unit = Math.max(cellW, cellH), spin = staticMode ? 0 : now / 8000;
          const beat = staticMode ? 0.65 : 0.5 + 0.5 * Math.sin(now / 420);
          g.save(); g.strokeStyle = color; g.globalAlpha = a; g.lineWidth = Math.max(1, unit * 0.055);
          for (const angle of sunburstAngles(spin)) {
            const length = unit * (0.55 + 0.65 * beat), inner = unit * 0.22;
            g.beginPath(); g.moveTo(q.x + Math.cos(angle) * inner, q.y + Math.sin(angle) * inner);
            g.lineTo(q.x + Math.cos(angle) * (inner + length), q.y + Math.sin(angle) * (inner + length)); g.stroke();
          }
          g.restore(); return;
        }
        g.fillStyle=color; g.globalAlpha=a*(staticMode?1:.5+.5*Math.sin(now/180)); g.beginPath(); g.arc(q.x,q.y,Math.max(3,cellW*.42),0,Math.PI*2); g.fill(); g.globalAlpha=1;
      }
      function embers(p: Grid, kind: SceneTerrain, a: number) {
        if (!a || !seen(p)) return; const q = cell(p), seed = p.x * 0.173 + p.y * 0.317;
        if (kind === "lava") {
          g.fillStyle = `rgba(255,70,12,${0.28 * a})`; g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH);
          for (const dot of driftingEmbers(now, seed, 4, staticMode)) {
            g.fillStyle = `rgba(255,140,30,${dot.alpha * a})`; g.fillRect(q.x + dot.x * cellW, q.y + dot.y * cellH, 2, 2);
          }
        } else {
          const ink = kind === "up" ? "255,133,41" : "217,145,255";
          g.fillStyle = `rgba(${ink},${0.22 * a})`; g.beginPath(); g.arc(q.x, q.y, Math.max(cellW, cellH) * 0.7, 0, Math.PI * 2); g.fill();
          for (const dot of driftingEmbers(now, seed, 5, staticMode)) {
            const reach = Math.max(cellW, cellH) * (0.25 + (1 - dot.alpha) * 0.4);
            g.fillStyle = `rgba(${ink},${dot.alpha * 0.7 * a})`; g.fillRect(q.x + Math.cos(seed + dot.x) * reach, q.y + Math.sin(seed + dot.y) * reach, 2, 2);
          }
        }
      }
      function ring(p: Grid, a: number) {
        if (!a) return; const q = cell(p), unit = Math.max(cellW, cellH), spin = staticMode ? 0 : now / 2800;
        g.strokeStyle = `rgba(64,191,255,${0.75 * a})`; g.lineWidth = Math.max(1, unit * 0.06);
        const radius = unit * 0.62;
        for (let i = 0; i < 8; i++) { const a0 = spin + i * Math.PI * 2 / 8; g.beginPath(); g.arc(q.x, q.y, radius, a0, a0 + 1.7 / 8); g.stroke(); }
      }
    } else if (sceneAlpha > 0) {
      cover(drawRect, sceneAlpha);
      request();
    }
    function cover(area: { width: number; height: number }, alpha: number) {
      if (heldReady) { g.globalAlpha = alpha; g.drawImage(held, 0, 0, area.width, area.height); g.globalAlpha = 1; }
      else { g.fillStyle = `rgba(8,12,17,${alpha})`; g.fillRect(0, 0, area.width, area.height); }
    }
    function hold(area: { x: number; y: number; width: number; height: number }) {
      const game = terminalCanvas();
      if (game && blitRegion(game, area, held)) heldReady = true;
    }
    function sampled(area: { x: number; y: number; width: number; height: number }, glow: number, fringe: number) {
      if (!(flags["anybandui.crtGlow"] && glow > 0) && !(flags["anybandui.crtFringe"] && fringe > 0)) return;
      const game = terminalCanvas();
      if (!game || !blitRegion(game, area, sample)) return;
      if (flags["anybandui.crtFringe"] && fringe > 0) fringeChannels(fringeOffset(fringe, area.width), fringe, area.width, area.height);
      if (flags["anybandui.crtGlow"] && glow > 0) phosphor(glow, area.width, area.height);
    }
    function fringeChannels(shift: number, amount: number, width: number, height: number) {
      if (shift <= 0) return;
      const channel = (color: string, dx: number) => {
        fringeScratch.width = sample.width; fringeScratch.height = sample.height;
        const sg = fringeScratch.getContext("2d"); if (!sg) return;
        sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = "source-over"; sg.clearRect(0, 0, fringeScratch.width, fringeScratch.height);
        sg.drawImage(sample, dx, 0); sg.globalCompositeOperation = "multiply"; sg.fillStyle = color; sg.fillRect(0, 0, fringeScratch.width, fringeScratch.height);
        sg.globalCompositeOperation = "destination-in"; sg.drawImage(sample, dx, 0);
        g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.85 * amount; g.drawImage(fringeScratch, 0, 0, width, height); g.restore();
      };
      try { channel("#ff0000", shift); channel("#0000ff", -shift); } catch { /* an unreadable terminal picture draws no fringe */ }
    }
    function phosphor(amount: number, width: number, height: number) {
      const sg = sample.getContext("2d"); if (!sg || !(sample.width > 0) || !(sample.height > 0)) return;
      let image: ImageData;
      try { image = sg.getImageData(0, 0, sample.width, sample.height); } catch { return; }
      const px = image.data; let lit = false;
      for (let i = 0; i < px.length; i += 4) {
        const keep = phosphorKeep(px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0);
        px[i + 3] = Math.round(255 * keep); if (keep > 0.05) lit = true;
      }
      if (!lit) return;
      glowScratch.width = sample.width; glowScratch.height = sample.height;
      const gg = glowScratch.getContext("2d"); if (!gg) return;
      gg.putImageData(image, 0, 0);
      g.save(); g.globalAlpha = 0.55 * amount;
      try { g.filter = `blur(${Math.max(1, Math.round(1 + 3 * amount))}px)`; } catch { g.filter = "none"; }
      g.drawImage(glowScratch, 0, 0, width, height); g.filter = "none"; g.restore();
    }
    function sweep(height: number, width: number, amount: number) {
      const front = (now / 4000 % 1) * height, trail = height * 0.24, yStart = front - trail;
      const band = (y0: number, y1: number) => {
        if (y1 - y0 < 1) return;
        const grad = g.createLinearGradient(0, y0, 0, y1);
        for (let i = 0; i <= 4; i++) {
          const y = y0 + ((y1 - y0) * i) / 4;
          grad.addColorStop(i / 4, `rgba(170,220,255,${sweepTrail(y, front, height) * 0.18 * amount})`);
        }
        g.fillStyle = grad; g.fillRect(0, y0, width, y1 - y0);
      };
      if (yStart >= 0) band(yStart, front);
      else { band(0, front); band(height + yStart, height); }
    }
  }
  // Glows and marks are static in reduced motion and when nothing animates, so a
  // slow redraw keeps them on the right cells as monsters and the camera move.
  const tick = globalThis.setInterval(request, 250);
  request();
  return () => { globalThis.clearInterval(tick); if (raf) cancelAnimationFrame(raf); if (listenCombat) { ctx.events?.off("combat-outcome", combat); ctx.events?.off("heal", heal); } if (listenMotion) ctx.events?.off("motion", motion); if (listenBlast) ctx.events?.off("explosion", explosion); if (listenBolt) ctx.events?.off("bolt", bolt); canvas.remove(); cues.length=0; };
}
