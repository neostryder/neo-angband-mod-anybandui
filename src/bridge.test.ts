import { describe, expect, it, vi } from "vitest";
import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { createBridge } from "./bridge.js";

const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value });
const token = { epoch: 1, revision: 3 };

interface Fake {
  readonly mod: ModApi2;
  readonly calls: { readonly submit: unknown[][]; readonly answer: unknown[][]; readonly prefsSet: unknown[]; readonly saveCalls: number[] };
  input: Record<string, unknown>;
}

function fakeMod(options: { readonly manage?: boolean; readonly owner?: string } = {}): Fake {
  const calls = { submit: [] as unknown[][], answer: [] as unknown[][], prefsSet: [] as unknown[], saveCalls: [] as number[] };
  const fake: Fake = {
    calls,
    input: { token, driver: options.owner ? { kind: "controller", owner: options.owner } : { kind: "player" }, phase: "play", messagePending: false, prompt: null },
    mod: undefined as unknown as ModApi2,
  };
  const events = { on: () => ok({ id: "s1" }), off: () => ok(null) };
  const mod = {
    meta: { id: "anybandui", api: "2.0.0", engine: "1.23.0-beta.1", tier: "first-party", flags: {}, log: vi.fn(), granted: () => [], settings: () => ok({ "anybandui.crtStrength": 100 }), setSetting: (_id: string, value: number) => ok(value), mods: () => ok([]) },
    view: {
      input: () => ok(fake.input),
      catalogue: () => ok({ commands: [] }),
      character: () => ok({ key: "k1", sheet: null, history: [], report: null }),
      knowledge: () => ok({ categories: [{ id: "objects", title: "known objects", count: 2 }], lists: {}, recall: null }),
    },
    store: {
      prefs: { get: () => ok({ a: 1 }), set: (value: unknown) => { calls.prefsSet.push(value); return ok(null); } },
      character: { get: () => ok({ mine: true }), set: () => ok(null) },
    },
    act: {
      submit: (...args: unknown[]) => { calls.submit.push(args); return ok({ accepted: true }); },
      answer: (...args: unknown[]) => { calls.answer.push(args); return ok({ accepted: true }); },
    },
    events,
    ...(options.manage ? { manage: { session: { save: () => { calls.saveCalls.push(1); return ok(null); }, exitToTitle: () => ok(null), quit: () => ok(null) } } } : {}),
  };
  (fake as { mod: ModApi2 }).mod = mod as unknown as ModApi2;
  return fake;
}

describe("the API 2 bridge", () => {
  it("primes the stored values and the input wait before the features read them", async () => {
    const { mod } = fakeMod();
    const bridge = createBridge(mod);
    await bridge.prime();
    expect(bridge.ctx.prefs?.get()).toEqual({ a: 1 });
    expect(bridge.ctx.settings?.get("anybandui.crtStrength")).toBe(100);
    expect(bridge.input()?.phase).toBe("play");
    expect(bridge.ctx.driver?.()).toEqual({ kind: "player" });
    bridge.dispose();
  });

  it("answers a submit at once and sends it under the token it was given", async () => {
    const fake = fakeMod();
    const bridge = createBridge(fake.mod);
    await bridge.prime();
    const result = bridge.ctx.intent!.submit(token as never, { kind: "walk", direction: 6 } as never);
    expect(result).toEqual({ accepted: true });
    expect(fake.calls.submit).toEqual([[token, { kind: "walk", direction: 6 }]]);
    // The game is still working until the next read lands.
    expect(bridge.ctx.intent!.submit(token as never, { kind: "walk", direction: 6 } as never).accepted).toBe(false);
    await bridge.refresh();
    bridge.dispose();
  });

  it("refuses a stale token and a keyboard another mod holds", async () => {
    const stale = fakeMod();
    const a = createBridge(stale.mod);
    await a.prime();
    expect(a.ctx.intent!.submit({ epoch: 1, revision: 2 } as never, { kind: "walk", direction: 6 } as never)).toMatchObject({ accepted: false });
    expect(stale.calls.submit).toEqual([]);
    a.dispose();
    const owned = fakeMod({ owner: "squire" });
    const b = createBridge(owned.mod);
    await b.prime();
    expect(b.ctx.intent!.submit(token as never, { kind: "walk", direction: 6 } as never)).toMatchObject({ accepted: false, code: "controller-owned" });
    expect(owned.calls.submit).toEqual([]);
    b.dispose();
  });

  it("answers a prompt only while that prompt is open", async () => {
    const fake = fakeMod();
    fake.input = { ...fake.input, prompt: { promptId: 7, kind: "ack" } };
    const bridge = createBridge(fake.mod);
    await bridge.prime();
    expect(bridge.ctx.prompt!.reply(8, { kind: "ack" } as never)).toMatchObject({ accepted: false });
    expect(bridge.ctx.prompt!.reply(7, { kind: "ack" } as never)).toMatchObject({ accepted: true });
    expect(fake.calls.answer).toEqual([[7, { kind: "ack" }]]);
    bridge.dispose();
  });

  it("writes preferences through to the store and reads them back from the cache", async () => {
    const fake = fakeMod();
    const bridge = createBridge(fake.mod);
    await bridge.prime();
    bridge.ctx.prefs!.set({ b: 2 });
    expect(bridge.ctx.prefs!.get()).toEqual({ b: 2 });
    expect(fake.calls.prefsSet).toEqual([{ b: 2 }]);
    bridge.dispose();
  });

  it("serves the character, the knowledge categories and the character record from primed caches", async () => {
    const bridge = createBridge(fakeMod().mod);
    await bridge.prime();
    expect(bridge.ctx.character?.key()).toBe("k1");
    expect(bridge.ctx.knowledge?.categories()).toEqual([{ id: "objects", title: "known objects", count: 2 }]);
    expect(bridge.ctx.characterStore?.get()).toEqual({ mine: true });
    bridge.dispose();
  });

  it("offers the session and the roster only to a mod that holds the manage namespace", async () => {
    const without = createBridge(fakeMod().mod);
    expect(without.ctx.session).toBeUndefined();
    expect(without.ctx.saves).toBeUndefined();
    expect(without.ctx.options).toBeUndefined();
    without.dispose();
    const fake = fakeMod({ manage: true });
    const withManage = createBridge(fake.mod);
    await withManage.prime();
    expect(await withManage.ctx.session!.save()).toEqual({ ok: true });
    expect(fake.calls.saveCalls).toEqual([1]);
    withManage.dispose();
  });
});
