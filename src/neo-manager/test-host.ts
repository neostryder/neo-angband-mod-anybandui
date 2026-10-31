import { vi } from "vitest";
import { MANAGER_SETTINGS } from "./settings.js";
import type { Api2Call, Api2ManagerConfirmation, Api2ManagerState, Api2Result, ManageHost, SettingValue } from "./types.js";

export const permissionFixture: Api2ManagerConfirmation["permissions"] = [
  { modId: "squire", capability: "state:map.read", consentText: "See the dungeon as you know it", withoutIt: "Only what you have seen and explored. Nothing hidden from you.", canRunWithout: false },
  { modId: "squire", capability: "store:kv", consentText: "Keep notes between games", withoutIt: "Safe to turn off.", canRunWithout: true },
];

export function stateFixture(): Api2ManagerState {
  const installed = ["anybandui", "squire", "borg"].map((id, index) => ({
    id, name: ["AnybandUI", "Squire", "Borg"][index]!, version: "1.0.0", enabled: index < 2,
    repository: `team/${id}`, commit: null, digests: null, loadOrder: index, pins: [], sectionChoices: {}, settings: {},
    consent: { granted: ["state:map.read", "store:kv"], refused: [] }, consentVersion: "1.0.0",
    tier: { trust: "first-party" as const, execution: "in-process" as const, capabilityTier: "P", seams: [], marksSave: [], why: "First-party mod" },
    catalogMod: { id, name: id, version: "1.0.0", shape: "plugin", kind: "trusted" as const,
      manifest: { id, name: id, version: "1.0.0", shape: "plugin", modApi: 2, description: `${id} description` }, enabled: index < 2,
      capabilities: ["state:map.read", "store:kv"], nondeterministic: false, affectsGameplay: false, consented: true, granted: ["state:map.read", "store:kv"] },
  }));
  const mod = { repo: "team/compass", tag: "v1.0.0", tags: ["v1.0.0"], id: "compass", name: "Compass", author: null,
    version: "1.0.0", description: "A compass", engine: null, screenshots: [], compatible: true, engineNote: null,
    channelHeld: null, engineHeld: null, payload: [], bytes: 120, guessedPayload: false };
  return {
    revision: 1, installed, catalog: { curated: [{ ok: true, ref: { repo: mod.repo, tag: mod.tag }, mod }], community: [], sideloads: [], problems: [] },
    pendingPlans: [], pendingConfirmation: null, safeMode: false,
    modList: installed.map(({ id, version, enabled }) => ({ id, version, enabled })),
    updates: installed.slice(0, 2).map(({ id, name }) => ({ id, name, repo: `team/${id}`, installed: "1.0.0", newest: "1.1.0", standing: "behind", problem: null, channelHeld: null, engineHeld: null })),
  };
}

export function testHost() {
  let state = stateFixture();
  let values: Readonly<Record<string, SettingValue>> = Object.fromEntries(MANAGER_SETTINGS.map((setting) => [setting.id, setting.default]));
  let look: "Vanilla" | "Neo" = "Vanilla";
  let pending = false;
  let listener: ((state: Api2ManagerState) => void) | null = null;
  const settingsListeners = new Set<() => void>();
  const ok = async <T>(value: T): Api2Call<T> => ({ ok: true, value });
  const mutation = () => vi.fn(async (): Api2Call<Api2ManagerConfirmation | null> => ok(null));
  const mods = {
    snapshot: vi.fn(() => ok(state)), subscribe: vi.fn(async (next: (state: Api2ManagerState) => void) => { listener = next; return ok({ id: "sub-1" }); }),
    unsubscribe: vi.fn(() => ok(null)), browse: vi.fn(() => ok(state.catalog)), refresh: vi.fn(() => ok(state)),
    planInstall: vi.fn(() => ok({ id: 7, operation: "install" as const, downloads: [], newGrants: [] })),
    applyPlan: mutation(), recordConsent: vi.fn(async (_id: string, _decisions: { readonly granted: readonly string[]; readonly refused: readonly string[] }) => ok(null)),
    enable: mutation(), disable: mutation(), update: mutation(), updateAll: mutation(), remove: mutation(), rollback: mutation(), restoreModList: mutation(),
  };
  const settings = {
    definitions: MANAGER_SETTINGS, get: () => values,
    set: vi.fn(async (next: Readonly<Record<string, SettingValue>>) => { values = { ...next }; for (const notify of settingsListeners) notify(); return ok(null); }),
    subscribe: (notify: () => void) => { settingsListeners.add(notify); return () => { settingsListeners.delete(notify); }; },
  };
  const recovery = {
    read: vi.fn((): ReturnType<NonNullable<ManageHost["recovery"]>["read"]> => ({ removed: [], restore: null })),
    startWithModsOff: vi.fn(() => ok(null)), continue: vi.fn(() => ok(null)), restore: mutation(),
  };
  const host: ManageHost = {
    mods, settings, recovery,
    look: {
      read: () => ({ desired: look, active: pending ? "Vanilla" : look, pending: pending ? { look: "Neo", modId: "anybandui" } : null }),
      choose: vi.fn(async (next) => { look = next; return ok(null); }),
    },
    clock: { now: () => Date.now(), setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout: (id) => { if (id !== undefined) clearTimeout(id as ReturnType<typeof setTimeout>); } },
    haptics: { tick: vi.fn() }, prefersReducedMotion: vi.fn(() => false), permissions: () => permissionFixture,
    updatePermissions: (id) => id === "anybandui" ? [] : permissionFixture,
  };
  return {
    host, mods, settings, recovery,
    publish(next: Api2ManagerState): void { state = next; listener?.(state); },
    state: () => state,
    pending(): void { look = "Neo"; pending = true; },
    ok,
    fail: <T>(message: string): Promise<Api2Result<T>> => Promise.resolve({ ok: false, reason: "refused", code: "test", message }),
  };
}
