/**
 * The real map for the "Glow shows hidden magic" option.
 *
 * The manifest asks for no real-map capability. When the player turns the option on, the game asks its
 * own question through mod.permissions.requestTruth; a yes returns the truth domain and the game keeps
 * the answer for later sessions. The glow then reads the real objects under each grid it can see.
 *
 * truth.level() is async and the glow draws synchronously, so the cells are cached per level token and
 * the bridge merges them into the known level. A no is not asked again until the option is switched off
 * and on. A mod the game gives no permissions object (or no truth domain) leaves the option inert.
 *
 * The question is not asked on the first look at a freshly loaded game. The game draws it over a running
 * game, and a question raised while the load is still finishing never appears and never answers, so the
 * ask waits until the world has moved on from the state it first saw.
 */
import type { Api2TrueCell, Api2Truth, KnownToken, ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";

export const GLOW_FLAG = "anybandui.itemGlowReveals";
export const GLOW_REASON = "Shows hidden magic on the floor.";

export interface TruthSeam {
  /** Asks once when the option turns on, then keeps the cell cache current. Calls never overlap. */
  sync(token: KnownToken | null): Promise<void>;
  /** The real objects by grid (y * 65536 + x), or null while the option is off or the map is not held. */
  cells(): ReadonlyMap<number, Api2TrueCell> | null;
}

const sameToken = (a: KnownToken | null, b: KnownToken | null): boolean => !!a && !!b && a.epoch === b.epoch && a.revision === b.revision;

export function createTruthSeam(mod: ModApi2): TruthSeam {
  let truth: Api2Truth | undefined = mod.truth;
  let asked = false;
  let busy = false;
  let readAt: KnownToken | null = null;
  let firstSeen: KnownToken | null = null;
  let cache: ReadonlyMap<number, Api2TrueCell> | null = null;
  const wanted = (): boolean => mod.meta.flags[GLOW_FLAG] === true;

  async function run(token: KnownToken | null): Promise<void> {
    if (!wanted()) {
      asked = false;
      cache = null;
      readAt = null;
      return;
    }
    if (!truth) {
      if (!mod.permissions) {
        if (!asked) mod.meta.log("glow: the game gave this mod no permissions object, so the real map cannot be asked for");
        asked = true;
        return;
      }
      if (asked) return;
      /* The game draws its question over a running game, so the first look at a freshly loaded one waits. */
      if (token && !firstSeen) firstSeen = token;
      if (!token || sameToken(firstSeen, token)) return;
      asked = true;
      mod.meta.log("glow: asking the game for the real map");
      const answer = await mod.permissions.requestTruth(GLOW_REASON);
      if (!answer.ok) {
        mod.meta.log(`glow: the real map was not granted (${"code" in answer ? String(answer.code) : "not granted"})`);
        return;
      }
      truth = answer.value;
    }
    if (cache && sameToken(readAt, token)) return;
    const level = await truth.level();
    if (!level.ok) return;
    const map = new Map<number, Api2TrueCell>();
    for (const cell of level.value.cells) if (cell.objects.length > 0) map.set(cell.y * 65536 + cell.x, cell);
    cache = map;
    readAt = token;
  }

  return {
    async sync(token) {
      if (busy) return;
      busy = true;
      try {
        await run(token);
      } catch (error) {
        mod.meta.log(`glow: reading the real map failed (${String(error)})`);
      } finally {
        busy = false;
      }
    },
    cells: () => (wanted() ? cache : null),
  };
}
