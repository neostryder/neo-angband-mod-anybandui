import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { MANAGER_SETTINGS } from "./settings.js";
import type { ManageHost, SettingValue } from "./types.js";

/** Where the manager's own display settings are kept, apart from the effect settings the rest of this mod reads. */
export const MANAGER_SETTINGS_KEY = "neoManager.settings";

const ok = { ok: true, value: null } as const;

export interface HostEnvironment {
  readonly now: () => number;
  readonly setTimeout: (callback: () => void, ms: number) => unknown;
  readonly clearTimeout: (id: unknown) => void;
  readonly vibrate: (ms: number) => void;
  readonly reducedMotion: () => boolean;
}

/** The page the mod runs in, as far as the manager needs it. A test passes its own. */
export function pageEnvironment(page: Window = window): HostEnvironment {
  return {
    now: () => Date.now(),
    setTimeout: (callback, ms) => page.setTimeout(callback, ms),
    clearTimeout: (id) => page.clearTimeout(id as number),
    vibrate: (ms) => { try { page.navigator.vibrate?.(ms); } catch { /* no haptics here */ } },
    reducedMotion: () => { try { return page.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } },
  };
}

function defaults(): Record<string, SettingValue> {
  return Object.fromEntries(MANAGER_SETTINGS.map((entry) => [entry.id, entry.default]));
}

/** Keep only the stored values that are still declared and still the declared kind, so an old or edited record cannot reach the panels as something else. */
function readStored(value: unknown): Record<string, SettingValue> {
  const out = defaults();
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const entry of MANAGER_SETTINGS) {
    const stored = (value as Record<string, unknown>)[entry.id];
    if (typeof stored === typeof entry.default) out[entry.id] = stored as SettingValue;
  }
  return out;
}

/**
 * The manager's host, built over the API 2 `manage` namespace. The settings load
 * from this mod's key-value store before the first read and write back on every
 * change. The look is fixed to Neo Angband while this mod runs: the game picks it
 * up from the manifest's `lookPreset`, and the namespace has no call to change it,
 * so the Vanilla choice answers that it is unavailable rather than pretending.
 */
export async function createManageHost(mod: ModApi2, env: HostEnvironment = pageEnvironment()): Promise<ManageHost | null> {
  const manage = mod.manage;
  if (!manage) return null;
  let values = defaults();
  try {
    const read = await mod.store.kv.get(MANAGER_SETTINGS_KEY);
    if (read.ok) values = readStored(read.value);
  } catch { /* an unreadable store leaves the defaults */ }
  const listeners = new Set<() => void>();
  return {
    mods: manage.mods,
    look: {
      read: () => ({ desired: "Neo", active: "Neo", pending: null }),
      choose: async (look) => look === "Neo" ? ok : { ok: false, reason: "unavailable", message: "The game has no way yet to switch the look back from here." },
    },
    settings: {
      definitions: MANAGER_SETTINGS,
      get: () => values,
      set: async (change) => {
        const next = readStored({ ...values, ...change });
        const written = await mod.store.kv.set(MANAGER_SETTINGS_KEY, next);
        if (!written.ok) return written;
        values = next;
        for (const listener of [...listeners]) listener();
        return ok;
      },
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    },
    clock: { now: env.now, setTimeout: env.setTimeout, clearTimeout: env.clearTimeout },
    haptics: { tick: () => env.vibrate(10) },
    prefersReducedMotion: env.reducedMotion,
  };
}
