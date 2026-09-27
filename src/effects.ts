import type { EffectContext, EffectEventMap, EffectSnapshot, EventActor, Grid } from "./seams.js";
import { mapProjection } from "./map-overview.js";
import { validateSettings } from "./settings.js";
import { elementEdgeColour } from "./blast-preview.js";

type Cue = { grid: Grid; kind: "cast" | "hit" | "miss" | "death" | "heal" | "departure" | "arrival" | "blast"; started: number; strength: number; colour?: string };
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
export function effectGrids(s: EffectSnapshot | null, known: ReturnType<NonNullable<EffectContext["knownLevel"]>>): { asleep: Grid[]; uniques: { grid: Grid; final: boolean }[]; glows: { grid: Grid; aura: Aura }[] } {
  const asleep: Grid[] = [], uniques: { grid: Grid; final: boolean }[] = [], glows: { grid: Grid; aura: Aura }[] = [];
  for (const m of s?.core.monsters ?? []) if (m.visible) {
    if (m.asleep) asleep.push(m.grid);
    if (m.unique ?? m.raceFlags.includes("UNIQUE")) uniques.push({ grid: m.grid, final: m.finalGuardian ?? m.race === "Morgoth, Lord of Darkness" });
  }
  for (const c of known?.cells ?? []) {
    const auras = new Set<Aura>();
    for (const o of c.remembered.objects) {
      if (!o || typeof o !== "object") continue;
      const read = o as { aura?: string; artifact?: boolean };
      const aura = read.aura ?? (read.artifact === true ? "artifact" : undefined);
      if (aura === "cursed" || aura === "artifact" || aura === "rune") auras.add(aura);
    }
    const aura = AURA_ORDER.find((a) => auras.has(a));
    if (aura) glows.push({ grid: { x: c.x, y: c.y }, aura });
  }
  return { asleep, uniques, glows };
}
type SourceEvent = ({ event: "combat-outcome"; attacker: EventActor | null; kind: "melee" | "ranged" | "spell" | "effect" | "trap"; hit: boolean; died: boolean; grid: Grid; seen: boolean } | { event: "heal"; grid: Grid; seen: boolean } | { event: "motion"; from: Grid; to: Grid; kind: "walk" | "teleport"; seen: boolean });
/** Where a creature named by an event stands now: the player's grid or a visible monster's. */
export function actorGrid(s: EffectSnapshot | null, who: EventActor | null): Grid | null {
  if (who === null) return null;
  if (who === "player") return s?.core.player?.grid ?? null;
  return s?.core.monsters?.find((m) => m.id === who && m.visible)?.grid ?? null;
}
export function eventCue(e: SourceEvent, locate: (who: EventActor | null) => Grid | null = () => null): Omit<Cue, "started" | "strength">[] {
  if (!e.seen) return [];
  if (e.event === "combat-outcome") {
    const caster = e.kind === "spell" ? locate(e.attacker) : null;
    return [...(caster ? [{ grid: caster, kind: "cast" as const }] : []), { grid: e.grid, kind: e.died ? "death" : e.hit ? "hit" : "miss" }];
  }
  if (e.event === "heal") return [{ grid: e.grid, kind: "heal" }];
  return e.kind === "teleport" ? [{ grid: e.from, kind: "departure" }, { grid: e.to, kind: "arrival" }] : [];
}
/** Impact flashes for an explosion: each grid of the blast the player can see,
 * in the colour of its element. Capped so a huge breath cannot flood the list. */
export function blastCues(e: EffectEventMap["explosion"], limit = 200): Omit<Cue, "started" | "strength">[] {
  const colour = elementEdgeColour(e.element);
  const out: Omit<Cue, "started" | "strength">[] = [];
  e.blastGrid.forEach((grid, i) => { if (out.length < limit && e.playerSeesGrid[i]) out.push({ grid: { x: grid.x, y: grid.y }, kind: "blast", colour }); });
  return out;
}
/** The Mods screen setting that sets each effect's strength (MOD_SEAMS 4y). The
 * spell rings and blast flashes share one; the death burst's cue follows the
 * death burst's own setting. */
export const STRENGTH_SETTINGS: Readonly<Record<string, string>> = {
  crt: "anybandui.crtStrength", lowHealth: "anybandui.lowHealthStrength", death: "anybandui.deathStrength",
  itemGlow: "anybandui.itemGlowStrength", sleepMarks: "anybandui.sleepMarksStrength", presenceHaze: "anybandui.presenceHazeStrength",
  cast: "anybandui.spellEffectsStrength", hit: "anybandui.spellEffectsStrength", miss: "anybandui.spellEffectsStrength",
  heal: "anybandui.spellEffectsStrength", departure: "anybandui.spellEffectsStrength", arrival: "anybandui.spellEffectsStrength",
  blast: "anybandui.spellEffectsStrength",
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
  const enabled = ["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.presenceHaze", "anybandui.spellEffects"].some((x) => flags[x]);
  const display = ctx.display;
  if (!enabled || !display || typeof document === "undefined") return () => {};
  const activeDisplay = display;
  const canvas = document.createElement("canvas"); canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", pointerEvents: "none", zIndex: "2", display: "none" }); document.body.append(canvas);
  const maybeContext = canvas.getContext("2d"); if (!maybeContext) { canvas.remove(); return () => {}; }
  const g: CanvasRenderingContext2D = maybeContext;
  const cues: Cue[] = []; let raf = 0, wasDead = false, deadBurstAt = 0;
  const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const push = (list: Omit<Cue, "started" | "strength">[]) => { const effects = validateSettings(ctx.prefs?.get()).effects; for (const cue of list) { const strength = effectStrength(ctx.settings, effects, cue.kind); if (strength > 0) cues.push({ ...cue, started: performance.now(), strength }); } request(); };
  const add = (e: SourceEvent) => push(eventCue(e, (who) => actorGrid(ctx.snapshot?.() ?? null, who)));
  // Core calls each handler with the event name first and the payload second.
  const combat = (_type: "combat-outcome", e: EffectEventMap["combat-outcome"]) => add({ event: "combat-outcome", ...e });
  const heal = (_type: "heal", e: EffectEventMap["heal"]) => add({ event: "heal", ...e });
  const motion = (_type: "motion", e: EffectEventMap["motion"]) => add({ event: "motion", ...e });
  const explosion = (_type: "explosion", e: EffectEventMap["explosion"]) => { if (Array.isArray(e?.blastGrid) && Array.isArray(e.playerSeesGrid)) push(blastCues(e)); };
  // Event rings belong to the spell effects switch alone; the other effects read the snapshot.
  const listen = flags["anybandui.spellEffects"] === true;
  if (listen) { ctx.events?.on("combat-outcome", combat); ctx.events?.on("heal", heal); ctx.events?.on("motion", motion); ctx.events?.on("explosion", explosion); }
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
    const known = ctx.knownLevel?.() ?? null, grids = effectGrids(snap, known);
    if (flags["anybandui.itemGlow"]) for (const glow of grids.glows) paint(glow.grid, AURA_COLOURS[glow.aura], intensity("itemGlow"));
    if (flags["anybandui.sleepMarks"]) for (const p of grids.asleep) { const q=cell(p); g.strokeStyle=`rgba(190,220,255,${intensity("sleepMarks")})`; g.lineWidth=1.5; g.beginPath(); g.moveTo(q.x-3,q.y-cellH*.38); g.lineTo(q.x,q.y-cellH*.52); g.lineTo(q.x+3,q.y-cellH*.38); g.stroke(); }
    if (flags["anybandui.presenceHaze"]) for (const u of grids.uniques) paint(u.grid,"#b45cff",intensity("presenceHaze") * (u.final ? 1 : .65));
    let active=false;
    for (const c of cues) { const age=(now-c.started)/650; if (age >= (staticMode ? 0.08 : 1)) continue; active=true; const q=cell(c.grid), a=staticMode ? .45 : (1-age)*c.strength/100;
      if (c.kind === "blast") { g.fillStyle = c.colour ?? "#ffbe5a"; g.globalAlpha = a * .55; g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH); g.globalAlpha = 1; continue; }
      g.strokeStyle=`rgba(${c.kind==="heal"?"100,255,160":c.kind==="cast"?"100,190,255":"255,190,90"},${a})`; g.lineWidth=2; g.beginPath(); g.arc(q.x,q.y,staticMode?5:4+age*cellH*.55,0,Math.PI*2); g.stroke(); }
    cues.splice(0,cues.length,...cues.filter(c=>(now-c.started)<650));
    if (flags["anybandui.deathEffect"] && deadBurstAt && now-deadBurstAt<900) active=true;
    if (active || (!staticMode && ((flags["anybandui.crt"] && intensity("crt") > 0) || (flags["anybandui.lowHealthEffect"] && healthIntensity(snap?.core.player?.hp, snap?.core.player?.maxHp, snap?.core.player?.hpWarning) > 0) || (flags["anybandui.sleepMarks"] && grids.asleep.length > 0) || (flags["anybandui.itemGlow"] && grids.glows.length > 0) || (flags["anybandui.presenceHaze"] && grids.uniques.length > 0)))) request();
    function paint(p: Grid,color:string,a:number) { if (!a) return; const q=cell(p); g.fillStyle=color; g.globalAlpha=a*(staticMode?1:.5+.5*Math.sin(now/180)); g.beginPath(); g.arc(q.x,q.y,Math.max(3,cellW*.42),0,Math.PI*2); g.fill(); g.globalAlpha=1; }
  }
  // Glows and marks are static in reduced motion and when nothing animates, so a
  // slow redraw keeps them on the right cells as monsters and the camera move.
  const tick = globalThis.setInterval(request, 250);
  request();
  return () => { globalThis.clearInterval(tick); if (raf) cancelAnimationFrame(raf); if (listen) { ctx.events?.off("combat-outcome", combat); ctx.events?.off("heal", heal); ctx.events?.off("motion", motion); ctx.events?.off("explosion", explosion); } canvas.remove(); cues.length=0; };
}
