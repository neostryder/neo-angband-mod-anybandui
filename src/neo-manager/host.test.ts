import { describe, expect, it, vi } from "vitest";
import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { createManageHost, MANAGER_SETTINGS_KEY, type HostEnvironment } from "./host.js";

const env: HostEnvironment = { now: () => 5, setTimeout: () => 1, clearTimeout: () => {}, vibrate: vi.fn(), reducedMotion: () => true };

function fakeMod(stored: unknown = null, withManage = true) {
  const writes: unknown[] = [];
  const mods = { snapshot: vi.fn() };
  const mod = {
    store: {
      kv: {
        get: async (key: string) => ({ ok: true, value: key === MANAGER_SETTINGS_KEY ? stored : null }),
        set: async (_key: string, value: unknown) => { writes.push(value); return { ok: true, value: null }; },
      },
    },
    ...(withManage ? { manage: { mods } } : {}),
  };
  return { mod: mod as unknown as ModApi2, writes, mods };
}

describe("the manager host over the manage namespace", () => {
  it("is absent for a mod that holds no manage namespace", async () => {
    expect(await createManageHost(fakeMod(null, false).mod, env)).toBeNull();
  });

  it("hands over the manage mods and the declared defaults when nothing is stored", async () => {
    const fake = fakeMod();
    const host = (await createManageHost(fake.mod, env))!;
    expect(host.mods).toBe(fake.mods);
    expect(host.settings.get()["textSize"]).toBe(100);
    expect(host.prefersReducedMotion()).toBe(true);
    host.haptics.tick();
    expect(env.vibrate).toHaveBeenCalledWith(10);
  });

  it("keeps a stored value only when it is declared and of the declared kind", async () => {
    const host = (await createManageHost(fakeMod({ textSize: 120, theme: 7, nonsense: true }).mod, env))!;
    expect(host.settings.get()["textSize"]).toBe(120);
    expect(host.settings.get()["theme"]).toBe("system");
    expect(host.settings.get()).not.toHaveProperty("nonsense");
  });

  it("writes a change through, tells subscribers, and stops telling one that unsubscribed", async () => {
    const fake = fakeMod();
    const host = (await createManageHost(fake.mod, env))!;
    const heard = vi.fn();
    const stop = host.settings.subscribe(heard);
    expect((await host.settings.set({ textSize: 90 })).ok).toBe(true);
    expect(host.settings.get()["textSize"]).toBe(90);
    expect((fake.writes[0] as Record<string, unknown>)["textSize"]).toBe(90);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    await host.settings.set({ textSize: 100 });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("holds the Neo look and says plainly that switching back is not available yet", async () => {
    const host = (await createManageHost(fakeMod().mod, env))!;
    expect(host.look.read()).toEqual({ desired: "Neo", active: "Neo", pending: null });
    expect((await host.look.choose("Neo")).ok).toBe(true);
    expect(await host.look.choose("Vanilla")).toMatchObject({ ok: false, reason: "unavailable" });
  });
});
