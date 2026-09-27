import type { PublicMod } from "./seams.js";

/**
 * Quality of Life drew these display features up to and including 1.12.0.
 * The release after that removed them, and AnybandUI draws them now. Each
 * AnybandUI flag is paired with the Quality of Life rule that drew the same
 * thing, so a public flags map from a later Quality of Life patch can say
 * whether its copy is really on.
 */
export const MOVED_FROM_QOL = [
  { flag: "anybandui.zoom", qolFlag: "qol.zoomPan", name: "zoom and pan" },
  { flag: "anybandui.enlargedDisplay", qolFlag: "qol.accessibilityZoom", name: "the enlarged display" },
  { flag: "anybandui.crispTiles", qolFlag: "qol.sharpenZoomedTiles", name: "sharper tiles" },
  { flag: "anybandui.mapHoverCards", qolFlag: "qol.mapHoverCards", name: "map overview hover cards" },
  { flag: "anybandui.firstEncounter", qolFlag: "qol.firstEncounterAlerts", name: "first-encounter alerts" },
  { flag: "anybandui.quiverItemization", qolFlag: "qol.quiverItemization", name: "the itemized quiver" },
  { flag: "anybandui.highContrast", qolFlag: "qol.accessibilityHighContrast", name: "high contrast" },
  { flag: "anybandui.colourblind", qolFlag: "qol.accessibilityColorblind", name: "the colourblind filter" },
] as const;

export const QOL_MOD_ID = "qol";
const LAST_QOL_WITH_MOVED_FEATURES = [1, 12, 0] as const;

/** True for a Quality of Life version that still ships the moved features. */
export function qolKeepsMovedFeatures(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  // Manifest versions are validated semver, so an unreadable one is not a
  // release this rule knows about and gets no special treatment.
  if (!match) return false;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  for (let i = 0; i < 3; i++) {
    if (parts[i]! !== LAST_QOL_WITH_MOVED_FEATURES[i]) return parts[i]! < LAST_QOL_WITH_MOVED_FEATURES[i]!;
  }
  return true;
}

/**
 * The flags AnybandUI acts on, after standing down wherever an older Quality
 * of Life still draws the same feature.
 *
 * AnybandUI gives way, not Quality of Life, because AnybandUI has no way to
 * turn the other mod's copy off: Quality of Life 1.12.0 publishes none of its
 * flags. Running both would draw two hover cards on one grid and two alerts
 * for one sighting, and the two zoom features would fight over the camera.
 * Giving way keeps what the player already had, and the log names the
 * features that were skipped. If the Quality of Life row does carry a
 * matching public flag set to false, AnybandUI draws its own copy. The mod
 * list only changes on a mod-change reload, and that reload registers
 * AnybandUI again, so one read at register time is enough.
 */
export function coexistingFlags(
  flags: Readonly<Record<string, boolean>>,
  mods: (() => readonly PublicMod[]) | undefined,
  log?: (message: string) => void,
): Readonly<Record<string, boolean>> {
  let list: readonly PublicMod[] = [];
  try { list = typeof mods === "function" ? mods() : []; } catch { list = []; }
  const qol = list.find((mod) => mod.id === QOL_MOD_ID);
  if (!qol || !qolKeepsMovedFeatures(qol.version)) return flags;
  const yielded = MOVED_FROM_QOL.filter((feature) => flags[feature.flag] === true && qol.flags?.[feature.qolFlag] !== false);
  if (!yielded.length) return flags;
  log?.(`Quality of Life ${qol.version} still draws ${yielded.map((feature) => feature.name).join(", ")}, so AnybandUI leaves them to it`);
  return Object.freeze({ ...flags, ...Object.fromEntries(yielded.map((feature) => [feature.flag, false])) });
}
