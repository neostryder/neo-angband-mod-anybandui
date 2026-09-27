import type { InputToken, ItemIntent, ItemIntentResult, ItemPanelContext, ItemRulesResult } from "./seams.js";
import { playerIsDriving } from "./input-owner.js";

/** One line per rule the player has actually set, in the order the game's own
 * knowledge menus group them: quality thresholds, then kinds, then egos. */
export function itemRuleLines(rules: ItemRulesResult): string[] {
  return [
    ...rules.quality.filter((rule) => rule.threshold > 0).map((rule) => `${rule.name}: ${rule.thresholdName}`),
    ...rules.kinds.flatMap((rule) => {
      const note = rule.noteAware ?? rule.noteUnaware;
      const parts = [rule.ignoreAware || rule.ignoreUnaware ? "ignored" : "", note ? `inscribed ${note}` : ""].filter(Boolean);
      return parts.length ? [`${rule.name}: ${parts.join(", ")}`] : [];
    }),
    ...rules.egos.filter((rule) => rule.ignored).map((rule) => `${rule.name}: ignored`),
  ];
}

// quality_values[].name (obj-ignore.c), as core obj/ignore.ts QUALITY_VALUE_NAMES.
export const QUALITY_NAMES: readonly string[] = ["no ignore", "bad", "average", "good", "non-artifact"];
// ITYPE_RING and ITYPE_AMULET: the quality menu offers them only "no ignore" and
// "bad" (ui-options.c quality_action, count = IGNORE_BAD + 1).
const LIMITED_QUALITY = new Set([24, 25]);
// The knowledge menu's auto-inscription prompt reads into an 80-byte buffer
// (ui-knowledge.c note_text[80]), so a note holds at most 79 characters.
export const NOTE_LIMIT = 79;

/** The threshold names to offer in the editor. An engine publishing the quality row's
 * `levels` decides; on an older engine, fall back to the mod's own list, which keeps
 * rings and amulets at the two values the game's own menu allows for them. */
export function qualityChoices(row: { readonly itype: number; readonly levels?: readonly string[] }): readonly string[] {
  return row.levels ?? (LIMITED_QUALITY.has(row.itype) ? QUALITY_NAMES.slice(0, 2) : QUALITY_NAMES);
}

export type KindRule = ItemRulesResult["kinds"][number];
export type EgoRule = ItemRulesResult["egos"][number] & { readonly typeName: string };
export interface RuleEditorRows {
  readonly quality: ItemRulesResult["quality"];
  readonly kinds: readonly KindRule[];
  readonly egos: readonly EgoRule[];
  /** How many more rows match the filter than are shown. */
  readonly hidden: number;
}

/** The rows the editor shows. With no filter, only the kinds and egos that carry a
 * rule appear, since the game lists every kind and ego the player has seen. A
 * filter searches every kind and ego by name, so a new rule can be added. */
export function ruleEditorRows(rules: ItemRulesResult, filter: string, limit = 30): RuleEditorRows {
  const needle = filter.trim().toLowerCase();
  const typeName = new Map(rules.quality.map((row) => [row.itype, row.name]));
  const kinds = rules.kinds.filter((row) => needle
    ? row.name.toLowerCase().includes(needle)
    : row.ignoreAware || row.ignoreUnaware || row.noteAware !== null || row.noteUnaware !== null);
  const egos = rules.egos.map((row) => ({ ...row, typeName: typeName.get(row.itype) ?? "" }))
    .filter((row) => needle ? `${row.name} ${row.typeName}`.toLowerCase().includes(needle) : row.ignored);
  const quality = needle ? rules.quality.filter((row) => row.name.toLowerCase().includes(needle)) : rules.quality;
  const shownKinds = kinds.slice(0, limit);
  const shownEgos = egos.slice(0, Math.max(0, limit - shownKinds.length));
  return { quality, kinds: shownKinds, egos: shownEgos, hidden: kinds.length + egos.length - shownKinds.length - shownEgos.length };
}

/** Build one item-rule intent, or explain why the value cannot be sent. */
export function ruleIntent(rules: ItemRulesResult, rule: Extract<ItemIntent, { kind: "item-rule" }>["rule"], index: number, value: boolean | number | string, itype?: number): { intent: ItemIntent } | { reason: string } {
  if (rule === "quality") {
    const row = rules.quality.find((entry) => entry.itype === index);
    if (!row || typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= qualityChoices(row).length) return { reason: "That ignore level is not available for this item type." };
    return { intent: { kind: "item-rule", rule, index, value } };
  }
  if (rule === "ego") {
    if (typeof value !== "boolean" || itype === undefined || !rules.egos.some((row) => row.eidx === index && row.itype === itype)) return { reason: "That ego is not in your knowledge list." };
    return { intent: { kind: "item-rule", rule, index, itype, value } };
  }
  if (!rules.kinds.some((row) => row.kidx === index)) return { reason: "That item kind is not in your knowledge list." };
  if (rule === "note-aware" || rule === "note-unaware") {
    if (typeof value !== "string") return { reason: "An inscription must be text." };
    const note = value.trim();
    if (note.length > NOTE_LIMIT) return { reason: `An inscription can be at most ${NOTE_LIMIT} characters.` };
    // An empty note clears the rule, as leaving the game's own prompt blank does.
    return { intent: { kind: "item-rule", rule, index, value: note } };
  }
  if (typeof value !== "boolean") return { reason: "Choose on or off." };
  return { intent: { kind: "item-rule", rule, index, value } };
}

/** Whether this engine accepts an intent kind, read from its intent catalogue. An
 * engine without a catalogue predates the ignore and item-rule intents too. */
export function intentAvailable(ctx: Pick<ItemPanelContext, "intent">, kind: ItemIntent["kind"]): boolean {
  try { return ctx.intent?.catalogue?.()?.intents.some((entry) => entry.kind === kind) ?? false; } catch { return false; }
}

/** Submit an item intent. A controller holding input is a quiet refusal: the
 * panel shows nothing, since the other driver's own status explains it. */
export function submitItemIntent(ctx: Pick<ItemPanelContext, "intent">, token: InputToken, intent: ItemIntent): ItemIntentResult & { readonly quiet?: boolean } {
  const result = ctx.intent?.submit(token, intent) ?? { accepted: false, reason: "Intent seam unavailable." };
  return result.code === "controller-owned" ? { ...result, quiet: true } : result;
}

/** Whether the rules list offers edits now: the engine takes item-rule intents, the
 * game waits for an ordinary command with no question open, and the player drives.
 * A question belongs to the prompt panels, and an autoplayer's input to it. */
export function rulesEditable(ctx: Pick<ItemPanelContext, "intent">, phase: string | null, promptOpen: boolean): boolean {
  return phase === "play" && !promptOpen && playerIsDriving(ctx) && intentAvailable(ctx, "item-rule");
}
