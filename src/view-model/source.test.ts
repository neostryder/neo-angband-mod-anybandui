import { describe, expect, it, vi } from "vitest";
import type { AgentView, GameState } from "@rpgm-tools/neo-angband-core";
import { createSource, messageHistory, messagePending } from "./source.js";
import type { MessageSnapshot } from "../seams.js";

const token = { epoch: 1, revision: 4 };
// Newest at age 0, as GameState.messages reads.
const coreLog = (rows: readonly [string, number, number][]) => ({
  num: () => rows.length, str: (age: number) => rows[age]![0], count: (age: number) => rows[age]![1], type: (age: number) => rows[age]![2],
});
const snapshot = (over: Partial<MessageSnapshot> = {}): MessageSnapshot => ({
  token, phase: "play", messagePending: false, prompt: null, core: {}, ...over,
});

describe("message history", () => {
  it("reads the core log when the snapshot carries no entries", () => {
    const log = coreLog([["You hit it.", 3, 1], ["You enter a maze.", 1, 0]]);
    expect(messageHistory(undefined, log)).toEqual([
      { text: "You hit it.", count: 3, category: 1 }, { text: "You enter a maze.", count: 1, category: 0 },
    ]);
    expect(messageHistory(null, log)).toHaveLength(2);
    expect(messageHistory(undefined, undefined)).toEqual([]);
  });

  it("orders snapshot entries newest first and takes counts where the logs agree", () => {
    const log = coreLog([["You hit it.", 3, 1], ["You enter a maze.", 1, 0]]);
    expect(messageHistory(["You enter a maze.", "The host saved.", "You hit it."], log)).toEqual([
      { text: "You hit it.", count: 3, category: 1 },
      { text: "The host saved.", count: undefined, category: undefined },
      { text: "You enter a maze.", count: 1, category: 0 },
    ]);
    expect(messageHistory(["Only here."], undefined)).toEqual([{ text: "Only here.", count: undefined, category: undefined }]);
  });
});

describe("message pending", () => {
  it("comes from the ack prompt tagged more, then the pause flag, else unknown", () => {
    expect(messagePending(snapshot({ phase: "more", prompt: { kind: "ack", promptId: 9, label: "-more-", tag: "more" } }))).toBe(true);
    expect(messagePending(snapshot({ phase: "more", messagePending: true }))).toBe(true);
    expect(messagePending(snapshot())).toBe(false);
    expect(messagePending(snapshot({ phase: null, messagePending: null }))).toBeUndefined();
    expect(messagePending(null)).toBeUndefined();
  });
});

describe("source", () => {
  const view = {} as AgentView;
  const state = {
    actor: { player: { fullName: "Ari", upkeep: { newSpells: 0 }, wordRecall: 0, deepDescent: 0 } },
    messages: coreLog([["Core line.", 2, 5]]),
  } as unknown as GameState;
  const make = (snap: MessageSnapshot | null, reply?: (id: number, answer: unknown) => { accepted: boolean }, driver: "player" | "autoplayer" = "player") => {
    const adapt = vi.fn(() => view);
    return createSource({
      state, core: { createAgentView: adapt },
      snapshot: () => snap,
      ...(reply ? { prompt: { reply } } : {}),
      controller: { driver: () => ({ kind: driver }) },
    } as Parameters<typeof createSource>[0]);
  };

  it("offers acknowledge only with a prompt reply, and answers only an open -more- pause", () => {
    expect(make(snapshot()).acknowledge).toBeUndefined();
    const reply = vi.fn(() => ({ accepted: true }));
    const pause = snapshot({ phase: "more", prompt: { kind: "ack", promptId: 9, label: "-more-", tag: "more" } });
    expect(make(pause, reply).acknowledge!()).toBe(true);
    expect(reply).toHaveBeenCalledWith(9, { action: "acknowledge" });
    expect(make(snapshot(), reply).acknowledge!()).toBe(false);
    expect(make(pause, reply, "autoplayer").acknowledge!()).toBe(false);
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("treats a throwing snapshot read as absent", () => {
    const source = createSource({ state, core: { createAgentView: () => view }, snapshot: () => { throw new Error("gone"); }, prompt: { reply: () => ({ accepted: true }) } });
    expect(source.acknowledge!()).toBe(false);
  });
});
