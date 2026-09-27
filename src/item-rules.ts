import type { ItemRulesResult } from "./seams.js";

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
