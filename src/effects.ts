import type { ActualObject, EffectContext, EffectEventMap, EffectSnapshot, EventActor, Grid } from "./seams.js";
import { mapProjection } from "./map-overview.js";
import { validateSettings } from "./settings.js";
import { elementEdgeColour } from "./blast-preview.js";

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
  for (const m of s?.core.monsters ?? []) if (m.visible) {
    if (m.asleep) asleep.push(m.grid);
    if (m.afraid) afraid.push(m.grid);
    if (m.unique ?? m.raceFlags.includes("UNIQUE")) uniques.push({ grid: m.grid, final: m.finalGuardian ?? m.race === "Morgoth, Lord of Darkness" });
  }
  for (const c of known?.cells ?? []) {
    const auras = new Set<Aura>();
    /* A hidden-magic glow reads the true pile, but only where the player can see
     * the grid, remembers an object there, and no creature stands on it. */
    if (revealHidden && c.visible === true && c.actual && c.actual.monster === 0 && c.remembered.objects.length > 0) {
      for (const o of c.actual.objects) { const aura = actualAura(o); if (aura) auras.add(aura); }
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
  if (who === "player") return s?.core.player?.grid ?? null;
  return s?.core.monsters?.find((m) => m.id === who && m.visible)?.grid ?? null;
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
};
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
export function installEffects(ctx: EffectContext): () => void {
  const flags = ctx.flags ?? {};
  const enabled = ["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.fearMarks", "anybandui.presenceHaze", "anybandui.damageNumbers", "anybandui.walkSlide", "anybandui.blinkRipple", "anybandui.boltGlyphs", "anybandui.coneWash", "anybandui.spellEffects"].some((x) => flags[x]);
  const display = ctx.display;
  if (!enabled || !display || typeof document === "undefined") return () => {};
  const activeDisplay = display;
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", pointerEvents: "none", zIndex: "2", display: "none" }); document.body.append(canvas);
  const maybeContext = canvas.getContext("2d"); if (!maybeContext) { canvas.remove(); return () => {}; }
  const g: CanvasRenderingContext2D = maybeContext;
  const cues: Cue[] = []; let raf = 0, wasDead = false, deadBurstAt = 0;
  const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const push = (list: DrawnCue[]) => { const effects = validateSettings(ctx.prefs?.get()).effects; for (const cue of list) { const strength = effectStrength(ctx.settings, effects, cue.kind); if (strength > 0) cues.push({ ...cue, started: performance.now(), strength }); } request(); };
  const add = (e: SourceEvent) => push(eventCue(e, (who) => actorGrid(ctx.snapshot?.() ?? null, who)));
  const spell = flags["anybandui.spellEffects"] === true, numbers = flags["anybandui.damageNumbers"] === true;
  const slides = flags["anybandui.walkSlide"] === true, ripples = flags["anybandui.blinkRipple"] === true;
  const bolts = flags["anybandui.boltGlyphs"] === true, cones = flags["anybandui.coneWash"] === true;
  const boltState = { count: 0, at: 0 };
  // Core calls each handler with the event name first and the payload second.
  const combat = (_type: "combat-outcome", e: EffectEventMap["combat-outcome"]) => { if (spell) add({ event: "combat-outcome", ...e }); if (numbers) push(numberCues({ event: "combat-outcome", ...e })); };
  const heal = (_type: "heal", e: EffectEventMap["heal"]) => { if (spell) add({ event: "heal", ...e }); if (numbers) push(numberCues({ event: "heal", ...e })); };
  const motion = (_type: "motion", e: EffectEventMap["motion"]) => { if (spell) add({ event: "motion", ...e }); if (slides) push(walkCues(e, (p) => (ctx.knownLevel?.()?.cells ?? []).some((c) => c.x === p.x && c.y === p.y && c.visible === true))); if (ripples) push(blinkCues(e)); };
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
    const view = activeDisplay.snapshot(), rect = mapProjection(view); const snap = ctx.snapshot?.() ?? null;
    if (!rect || view.mode !== "play") { canvas.style.display = "none"; return; }
    canvas.style.display = "block"; canvas.style.left = `${rect.x}px`; canvas.style.top = `${rect.y}px`; canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const dpr = devicePixelRatio || 1; canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, rect.width, rect.height);
    const cellW = rect.width / view.viewport.size.width, cellH = rect.height / view.viewport.size.height;
    const cell = (p: Grid) => ({ x: (p.x - view.viewport.origin.x + .5) * cellW, y: (p.y - view.viewport.origin.y + .5) * cellH });
    // ctx.prefs parses its stored value on every read, so read the settings once per frame.
    const effectSettings = validateSettings(ctx.prefs?.get()).effects;
    const intensity = (key: string) => effectStrength(ctx.settings, effectSettings, key) / 100;
    const staticMode = chooseEffectMotion(reduced()) === "static";
    if (flags["anybandui.crt"] && intensity("crt") > 0) {
      g.fillStyle = `rgba(0,0,0,${.10 * intensity("crt")})`; for (let y=0; y<rect.height; y+=3) g.fillRect(0,y,rect.width,1);
      if (!staticMode) { const y = now / 14 % rect.height; g.fillStyle = "rgba(120,220,255,.08)"; g.fillRect(0,y,rect.width,Math.max(2,cellH*.18)); }
    }
    if (flags["anybandui.lowHealthEffect"] && intensity("lowHealth") > 0) { const p = snap?.core.player; const v = healthIntensity(p?.hp, p?.maxHp, p?.hpWarning) * intensity("lowHealth"); if (v) { g.fillStyle = `rgba(255,20,25,${v*(staticMode ? .10 : .08+.08*Math.sin(now/45))})`; g.fillRect(0,0,rect.width,rect.height); } }
    // PlayerView.dead turns true at the killing blow, before the -more- that
    // leads to the dead phase, so the burst lands on the blow itself.
    const dead = snap?.phase === "dead" || snap?.core.player?.dead === true;
    if (dead && !wasDead && flags["anybandui.deathEffect"] && intensity("death") > 0) { deadBurstAt=now; const at = snap?.core.player?.grid; if (at) cues.push({ grid: at, kind:"death", started:now, strength:100 }); }
    wasDead = dead;
    const known = ctx.knownLevel?.() ?? null, grids = effectGrids(snap, known, flags["anybandui.itemGlowReveals"] === true);
    if (flags["anybandui.itemGlow"]) for (const glow of grids.glows) paint(glow.grid, AURA_COLOURS[glow.aura], intensity("itemGlow"));
    const marked = markGrids(grids.asleep, grids.afraid, flags["anybandui.fearMarks"] === true && intensity("fearMarks") > 0);
    if (flags["anybandui.sleepMarks"]) for (const p of marked.sleep) { const q=cell(p); g.strokeStyle=`rgba(190,220,255,${intensity("sleepMarks")})`; g.lineWidth=1.5; g.beginPath(); g.moveTo(q.x-3,q.y-cellH*.38); g.lineTo(q.x,q.y-cellH*.52); g.lineTo(q.x+3,q.y-cellH*.38); g.stroke(); }
    // The exclamation mark is drawn as text on the cell, so text mode and every tileset show the same mark.
    if (flags["anybandui.fearMarks"]) for (const p of marked.fear) { const q=cell(p); const bob = staticMode ? 0 : Math.sin(now / 200) * cellH * .06; g.globalAlpha = intensity("fearMarks"); g.fillStyle = "#f5ba69"; g.font = `${Math.max(12, cellH * .55)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", q.x, q.y - cellH * .42 + bob); g.globalAlpha = 1; }
    if (flags["anybandui.presenceHaze"]) for (const u of grids.uniques) paint(u.grid,"#b45cff",intensity("presenceHaze") * (u.final ? 1 : .65));
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
    if (active || (!staticMode && ((flags["anybandui.crt"] && intensity("crt") > 0) || (flags["anybandui.lowHealthEffect"] && healthIntensity(snap?.core.player?.hp, snap?.core.player?.maxHp, snap?.core.player?.hpWarning) > 0) || (flags["anybandui.sleepMarks"] && grids.asleep.length > 0) || (flags["anybandui.fearMarks"] && grids.afraid.length > 0) || (flags["anybandui.itemGlow"] && grids.glows.length > 0) || (flags["anybandui.presenceHaze"] && grids.uniques.length > 0)))) request();
    function paint(p: Grid,color:string,a:number) { if (!a) return; const q=cell(p); g.fillStyle=color; g.globalAlpha=a*(staticMode?1:.5+.5*Math.sin(now/180)); g.beginPath(); g.arc(q.x,q.y,Math.max(3,cellW*.42),0,Math.PI*2); g.fill(); g.globalAlpha=1; }
  }
  // Glows and marks are static in reduced motion and when nothing animates, so a
  // slow redraw keeps them on the right cells as monsters and the camera move.
  const tick = globalThis.setInterval(request, 250);
  request();
  return () => { globalThis.clearInterval(tick); if (raf) cancelAnimationFrame(raf); if (listenCombat) { ctx.events?.off("combat-outcome", combat); ctx.events?.off("heal", heal); } if (listenMotion) ctx.events?.off("motion", motion); if (listenBlast) ctx.events?.off("explosion", explosion); if (listenBolt) ctx.events?.off("bolt", bolt); canvas.remove(); cues.length=0; };
}
