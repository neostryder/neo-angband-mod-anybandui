import { describe, expect, it } from "vitest";
import type { AgentView, PlayerView, MonsterView, TargetView } from "@rpgm-tools/neo-angband-core";
import type { HudFrame, HudEntry, HudSection } from "@rpgm-tools/neo-angband-mod-sdk";
import { adapt, GAPS } from "./adapter.js";

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const player = freeze({
  race: "Elf", cls: "Mage", level: 8, maxLevel: 8, exp: 900, maxExp: 900,
  gold: 321, depth: 4, maxDepth: 4, hp: 25, maxHp: 40, sp: 18, maxSp: 22,
  speed: 112, ac: 17, toHit: 0, toDam: 0, stats: [18, 17, 16, 15, 14],
  light: 3, grid: { x: 2, y: 3 },
  status: { blind: 0, confused: 0, afraid: 0, poisoned: 4, cut: 0, stun: 0, paralyzed: 0, food: 5000,
    fast: 0, sprint: 0, protEvil: 9, hero: 0, shero: 0, shield: 0, stoneskin: 0, blessed: 0,
    fastcast: 0, resAcid: 0, resElec: 0, resFire: 0, resCold: 0, resPois: 0 },
  dead: false, winner: false, skills: [], shape: null, objectFlags: [], classFlags: [],
  seeInfra: 0, blows: 1, shots: 1,
}) satisfies PlayerView;
const monster = freeze({ id: 7, race: "orc", raceIndex: 1, grid: { x: 3, y: 3 },
  visible: true, hp: 12, maxHp: 20, speed: 110, asleep: false, afraid: false,
  confused: false, stunned: false, poisoned: false, level: 4, raceFlags: [], spellFlags: [] }) satisfies MonsterView;
const target = freeze({ midx: 7, grid: { x: 3, y: 3 } }) satisfies TargetView;
const view: AgentView = {
  apiVersion: "1.18.0", turn: () => 2, player: () => player, monsters: () => [monster],
  cell: () => null, mapBounds: () => ({ width: 5, height: 5 }), inventory: () => [],
  equipment: () => [], floorItems: () => [], target: () => target, messages: () => ["Fallback"],
  stores: () => [], spellbooks: () => [], constants: () => ({}) as ReturnType<AgentView["constants"]>,
};
function hud(key: string, values: Record<string, number> = {}, text = key): HudEntry {
  return { key, values, runs: [{ text, css: "white" }], screen: { col: 0, row: 0 } };
}
function section(name: HudSection["name"], entries: HudEntry[]): HudSection {
  return { name, entries, clip: { col: 0, row: 0, cols: 80, rows: 1 } };
}
const frame: HudFrame = freeze({ layout: "left", targeting: false,
  messages: section("messages", [{ key: "message", runs: [{ text: "An orc appears.", css: "white" }], screen: { col: 0, row: 0 } }]),
  sidebar: section("sidebar", [hud("race", {}, "High Elf"), hud("title", {}, "Adept"),
    hud("class", {}, "Sorcerer"), hud("hp", { current: 23, max: 40 }),
    hud("sp", { current: 17, max: 22 }), hud("exp", { exp: 901, maxExp: 950, advance: 99 }),
    hud("level", { level: 8 }), hud("gold", { au: 322 }), hud("equippy"),
    hud("ac", { ac: 21, armour: 18 }), hud("speed", { speed: 113 }),
    hud("depth", { depth: 4, feet: 200 }), hud("str", { use: 17, cur: 17, max: 18 }),
    hud("int", { use: 19, cur: 19, max: 19 }), hud("wis", { use: 16, cur: 16, max: 16 }),
    hud("dex", { use: 15, cur: 15, max: 15 }), hud("con", { use: 14, cur: 14, max: 14 }),
    hud("health", { current: 12, max: 20 })]),
  status: section("status", [
    hud("level_feeling", { monster: 7, object: 6, squares: 12, need: 10 }, "LF:3-5 "),
    hud("light", {}, "Light 4 "), hud("moves", {}, "Moves +2 "),
    hud("unignore", {}, "Unignoring "), hud("recall", {}, "Recall "),
    hud("descent", {}, "Descent "), hud("state", {}, "Rest     42 "),
    hud("study", {}, "Study (3) "),
    { ...hud("tmd"), runs: [
      { text: "Poisoned ", css: "green" }, { text: "ProtEvil ", css: "blue" },
      { text: "Fed ", css: "white" }, { text: "50 % ", css: "white" },
    ] },
    hud("dtrap", {}, "DTrap "), hud("terrain", {}, "Granite wall "),
  ]),
});

const input = freeze({
  name: "Elbereth",
  history: [{ text: "An orc appears.", count: 3, category: 2, color: undefined },
    { text: "You hear a noise.", count: 1, category: 0, color: undefined }],
  repeat: 0, resting: true, running: false, unignoring: 1,
  recall: 5, descent: 2, extraMoves: 2, study: 3, messagePending: true,
});

describe("full-v1 phase 1 adapter", () => {
  it("maps every published character, dungeon, status, target, and message field", () => {
    const actual = adapt(view, frame, input);
    expect(actual.player).toMatchObject({ name: "Elbereth", race: "High Elf", class: "Sorcerer",
      title: "Adept", hp: 23, max_hp: 40, sp: 17, max_sp: 22,
      food: 5000, experience: 901, max_experience: 950,
      next_level_experience: 1000, level: 8, max_level: 8,
      gold: 322, armour: 21, speed: 113, extra_moves: 2,
      depth: 4, depth_feet: 200, light: 4, feeling: "LF:3-5",
      feeling_indices: { monster: 7, object: 6, squares: 12, need: 10 },
      floor: "Granite wall", trap_detected: true, recall: 5, descent: 2,
      resting: true, running: false, repeat: 0, unignoring: 1, study: 3 });
    expect(actual.player.stats).toEqual([
      { label: "STR", value: 17, drained: true },
      { label: "INT", value: 19, drained: false },
      { label: "WIS", value: 16, drained: false },
      { label: "DEX", value: 15, drained: false },
      { label: "CON", value: 14, drained: false },
    ]);
    expect(actual.player.statuses).toEqual([
      { label: "Poisoned", name: undefined, visible: true, priority: undefined,
        kind: undefined, duration: 4, description: undefined },
      { label: "ProtEvil", name: undefined, visible: true, priority: undefined,
        kind: undefined, duration: 9, description: undefined },
      { label: "Fed", name: undefined, visible: true, priority: undefined,
        kind: undefined, duration: 5000, description: undefined },
    ]);
    expect(actual.player.tracked_creature).toEqual({ visible: true, name: "orc", hp: 12, max_hp: 20 });
    expect(actual.dungeon).toEqual({ depth: 4, depth_feet: 200, light: 4,
      feeling: "LF:3-5", feeling_indices: { monster: 7, object: 6, squares: 12, need: 10 },
      feeling_description: undefined, floor: "Granite wall" });
    expect(actual.message_pending).toBe(true);
    expect(adapt(view, frame, { ...input, messagePending: false }).message_pending).toBe(false);
    expect(actual.messages).toEqual([
      { text: "An orc appears.", count: 3, system: undefined, category: 2, group: undefined, color: undefined },
      { text: "You hear a noise.", count: 1, system: undefined, category: 0, group: undefined, color: undefined },
    ]);
  });

  it("passes a per-entry color through to the message payload", () => {
    const withColor = freeze({
      ...input,
      history: [{ text: "You hit it.", count: 3, category: undefined, color: "#c88f5fb4" }],
    });
    const actual = adapt(view, frame, withColor);
    expect(actual.messages[0]).toMatchObject({ text: "You hit it.", count: 3, color: "#c88f5fb4" });
  });

  it("leaves deep-frozen inputs untouched and produces equal independent snapshots", () => {
    const first = adapt(view, frame, input);
    const second = adapt(view, frame, input);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(Object.isFrozen(player)).toBe(true);
    expect(Object.isFrozen(frame.sidebar?.entries[0]?.values)).toBe(true);
  });

  it("accounts for every undefined full-v1 field in GAPS", () => {
    const result = adapt(view, frame, input);
    const missing: string[] = [];
    const visit = (value: unknown, path: string): void => {
      if (value === undefined) { missing.push(path); return; }
      if (Array.isArray(value)) { for (const item of value) visit(item, `${path}[]`); return; }
      if (value !== null && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) visit(item, path ? `${path}.${key}` : key);
      }
    };
    visit({ player: result.player, messages: result.messages, message_pending: result.message_pending }, "");
    expect(new Set(missing)).toEqual(new Set(GAPS.map((gap) => gap.field)));
  });
});
