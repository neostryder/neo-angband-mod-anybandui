import type { EffectContext, EffectEventMap, EffectSnapshot, EventActor, Grid } from "./seams.js";
import { mapProjection } from "./map-overview.js";
import { validateSettings } from "./settings.js";

type Cue = { grid: Grid; kind: "cast" | "hit" | "miss" | "death" | "heal" | "departure" | "arrival"; started: number; strength: number };
export function healthIntensity(hp: number | undefined, maxHp: number | undefined, warning: number | undefined): number {
  if (!(hp !== undefined && maxHp && maxHp > 0 && hp > 0)) return 0;
  const threshold = warning !== undefined && warning > 0 ? warning * 10 : 30; // hitpoint_warn is in tenths; use the engine default of 30 percent when unavailable.
  const ratio = hp / maxHp * 100;
  return ratio > threshold ? 0 : Math.max(0, Math.min(1, (threshold - ratio) / Math.max(1, threshold) + 0.12));
}
export function chooseEffectMotion(reduced: boolean): "motion" | "static" { return reduced ? "static" : "motion"; }
export function effectGrids(s: EffectSnapshot | null, known: ReturnType<NonNullable<EffectContext["knownLevel"]>>): { asleep: Grid[]; uniques: Grid[]; artifacts: Grid[] } {
  const asleep: Grid[] = [], uniques: Grid[] = [], artifacts: Grid[] = [];
  for (const m of s?.core.monsters ?? []) if (m.visible) { if (m.asleep) asleep.push(m.grid); if (m.raceFlags.includes("UNIQUE")) uniques.push(m.grid); }
  for (const c of known?.cells ?? []) if (c.remembered.objects.some((o) => !!o && typeof o === "object" && (o as { artifact?: boolean }).artifact === true)) artifacts.push({ x: c.x, y: c.y });
  return { asleep, uniques, artifacts };
}
type SourceEvent = ({ event: "combat-outcome"; attacker: EventActor | null; kind: "melee" | "ranged" | "spell" | "effect" | "trap"; hit: boolean; died: boolean; grid: Grid; seen: boolean } | { event: "heal"; grid: Grid; seen: boolean } | { event: "motion"; from: Grid; to: Grid; kind: "walk" | "teleport"; seen: boolean });
/** Where a creature named by an event stands now: the player's grid or a visible monster's. */
export function actorGrid(s: EffectSnapshot | null, who: EventActor | null): Grid | null {
  if (who === null) return null;
  if (who === "player") return s?.core.player?.grid ?? null;
  return s?.core.monsters?.find((m) => m.id === who)?.grid ?? null;
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
  const cues: Cue[] = []; let raf = 0, previousPhase: string | null = null, deadBurstAt = 0;
  const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const add = (e: SourceEvent) => { for (const cue of eventCue(e, (who) => actorGrid(ctx.snapshot?.() ?? null, who))) { const strength = Math.max(0, Math.min(100, validateSettings(ctx.prefs?.get()).effects[cue.kind] ?? 100)); if (strength > 0) cues.push({ ...cue, started: performance.now(), strength }); } request(); };
  // Core calls each handler with the event name first and the payload second.
  const combat = (_type: "combat-outcome", e: EffectEventMap["combat-outcome"]) => add({ event: "combat-outcome", ...e });
  const heal = (_type: "heal", e: EffectEventMap["heal"]) => add({ event: "heal", ...e });
  const motion = (_type: "motion", e: EffectEventMap["motion"]) => add({ event: "motion", ...e });
  // Event rings belong to the spell effects switch alone; the other effects read the snapshot.
  const listen = flags["anybandui.spellEffects"] === true;
  if (listen) { ctx.events?.on("combat-outcome", combat); ctx.events?.on("heal", heal); ctx.events?.on("motion", motion); }
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
    const intensity = (key: string) => Math.max(0, Math.min(100, effectSettings[key] ?? 100)) / 100;
    const staticMode = chooseEffectMotion(reduced()) === "static";
    if (flags["anybandui.crt"] && intensity("crt") > 0) {
      g.fillStyle = `rgba(0,0,0,${.10 * intensity("crt")})`; for (let y=0; y<rect.height; y+=3) g.fillRect(0,y,rect.width,1);
      if (!staticMode) { const y = now / 14 % rect.height; g.fillStyle = "rgba(120,220,255,.08)"; g.fillRect(0,y,rect.width,Math.max(2,cellH*.18)); }
    }
    if (flags["anybandui.lowHealthEffect"] && intensity("lowHealth") > 0) { const p = snap?.core.player; const v = healthIntensity(p?.hp, p?.maxHp, undefined) * intensity("lowHealth"); if (v) { g.fillStyle = `rgba(255,20,25,${v*(staticMode ? .10 : .08+.08*Math.sin(now/45))})`; g.fillRect(0,0,rect.width,rect.height); } }
    if (snap?.phase === "dead" && previousPhase !== "dead" && flags["anybandui.deathEffect"] && intensity("death") > 0) { deadBurstAt=now; const at = snap.core.player?.grid; if (at) cues.push({ grid: at, kind:"death", started:now, strength:100 }); }
    previousPhase = snap?.phase ?? null;
    const known = ctx.knownLevel?.() ?? null, grids = effectGrids(snap, known);
    if (flags["anybandui.itemGlow"]) for (const p of grids.artifacts) paint(p,"#ffd36a",intensity("itemGlow"));
    if (flags["anybandui.sleepMarks"]) for (const p of grids.asleep) { const q=cell(p); g.strokeStyle=`rgba(190,220,255,${intensity("sleepMarks")})`; g.lineWidth=1.5; g.beginPath(); g.moveTo(q.x-3,q.y-cellH*.38); g.lineTo(q.x,q.y-cellH*.52); g.lineTo(q.x+3,q.y-cellH*.38); g.stroke(); }
    if (flags["anybandui.presenceHaze"]) for (const p of grids.uniques) paint(p,"#b45cff",intensity("presenceHaze") * ((snap?.core.monsters ?? []).some(m=>m.visible && m.grid.x===p.x && m.grid.y===p.y && m.race==="Morgoth, Lord of Darkness") ? 1 : .65));
    let active=false;
    for (const c of cues) { const age=(now-c.started)/650; if (age >= (staticMode ? 0.08 : 1)) continue; active=true; const q=cell(c.grid), a=staticMode ? .45 : (1-age)*c.strength/100; g.strokeStyle=`rgba(${c.kind==="heal"?"100,255,160":c.kind==="cast"?"100,190,255":"255,190,90"},${a})`; g.lineWidth=2; g.beginPath(); g.arc(q.x,q.y,staticMode?5:4+age*cellH*.55,0,Math.PI*2); g.stroke(); }
    cues.splice(0,cues.length,...cues.filter(c=>(now-c.started)<650));
    if (flags["anybandui.deathEffect"] && deadBurstAt && now-deadBurstAt<900) active=true;
    if (active || (!staticMode && ((flags["anybandui.crt"] && intensity("crt") > 0) || (flags["anybandui.lowHealthEffect"] && healthIntensity(snap?.core.player?.hp, snap?.core.player?.maxHp, undefined) > 0) || (flags["anybandui.sleepMarks"] && grids.asleep.length > 0) || (flags["anybandui.itemGlow"] && grids.artifacts.length > 0) || (flags["anybandui.presenceHaze"] && grids.uniques.length > 0)))) request();
    function paint(p: Grid,color:string,a:number) { if (!a) return; const q=cell(p); g.fillStyle=color; g.globalAlpha=a*(staticMode?1:.5+.5*Math.sin(now/180)); g.beginPath(); g.arc(q.x,q.y,Math.max(3,cellW*.42),0,Math.PI*2); g.fill(); g.globalAlpha=1; }
  }
  // Glows and marks are static in reduced motion and when nothing animates, so a
  // slow redraw keeps them on the right cells as monsters and the camera move.
  const tick = globalThis.setInterval(request, 250);
  request();
  return () => { globalThis.clearInterval(tick); if (raf) cancelAnimationFrame(raf); if (listen) { ctx.events?.off("combat-outcome", combat); ctx.events?.off("heal", heal); ctx.events?.off("motion", motion); } canvas.remove(); cues.length=0; };
}
