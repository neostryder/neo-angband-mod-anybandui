import { describe, expect, it, vi } from "vitest";
import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { createTruthSeam, GLOW_FLAG, GLOW_REASON } from "./bridge-truth.js";

const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value });
const cell = (x: number, y: number, objects: unknown[]) => ({ x, y, feat: 1, traps: [], objects, monster: 0 });
const level = (revision: number, cells: unknown[]) => ({ token: { epoch: 1, revision }, levelId: 1, depth: 1, width: 10, height: 10, cells });

function fakeMod(options: { flag: boolean; answer?: "yes" | "no"; permissions?: boolean; held?: boolean }) {
  const flags: Record<string, boolean> = { [GLOW_FLAG]: options.flag };
  const read = vi.fn(() => ok(level(1, [cell(3, 2, [{ name: "a Dagger" }]), cell(4, 2, [])])));
  const truth = { level: read };
  const request = vi.fn(() => (options.answer === "no" ? Promise.resolve({ ok: false as const, code: "declined" }) : ok(truth)));
  const mod = {
    meta: { flags, log: vi.fn() },
    ...(options.held ? { truth } : {}),
    ...(options.permissions === false ? {} : { permissions: { truthHeld: () => options.held === true, requestTruth: request } }),
  };
  return { mod: mod as unknown as ModApi2, flags, read, request };
}

describe("the glow's real map", () => {
  it("waits through the first look at a freshly loaded game, then asks once with its reason and caches the cells that hold objects", async () => {
    const { mod, request, read } = fakeMod({ flag: true });
    const seam = createTruthSeam(mod);
    await seam.sync({ epoch: 1, revision: 0 });
    expect(request).not.toHaveBeenCalled();
    await seam.sync({ epoch: 1, revision: 1 });
    await seam.sync({ epoch: 1, revision: 1 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(GLOW_REASON);
    expect(read).toHaveBeenCalledTimes(1);
    expect([...(seam.cells()?.keys() ?? [])]).toEqual([2 * 65536 + 3]);
  });

  it("reads again when the level token moves", async () => {
    const { mod, read } = fakeMod({ flag: true });
    const seam = createTruthSeam(mod);
    await seam.sync({ epoch: 1, revision: 0 });
    await seam.sync({ epoch: 1, revision: 1 });
    await seam.sync({ epoch: 1, revision: 2 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the option is off", async () => {
    const { mod, request } = fakeMod({ flag: false });
    const seam = createTruthSeam(mod);
    await seam.sync({ epoch: 1, revision: 1 });
    expect(request).not.toHaveBeenCalled();
    expect(seam.cells()).toBeNull();
  });

  it("does not ask again after a no until the option is switched off and on", async () => {
    const { mod, flags, request } = fakeMod({ flag: true, answer: "no" });
    const seam = createTruthSeam(mod);
    await seam.sync({ epoch: 1, revision: 1 });
    await seam.sync({ epoch: 1, revision: 2 });
    await seam.sync({ epoch: 1, revision: 3 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(seam.cells()).toBeNull();
    flags[GLOW_FLAG] = false;
    await seam.sync({ epoch: 1, revision: 4 });
    flags[GLOW_FLAG] = true;
    await seam.sync({ epoch: 1, revision: 5 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("uses the truth domain a held grant already gave, without asking", async () => {
    const { mod, request } = fakeMod({ flag: true, held: true });
    const seam = createTruthSeam(mod);
    await seam.sync({ epoch: 1, revision: 1 });
    expect(request).not.toHaveBeenCalled();
    expect(seam.cells()?.size).toBe(1);
  });

  it("stays inert for a mod the game gives no permissions", async () => {
    const { mod } = fakeMod({ flag: true, permissions: false });
    const seam = createTruthSeam(mod);
    await seam.sync({ epoch: 1, revision: 1 });
    expect(seam.cells()).toBeNull();
  });
});
