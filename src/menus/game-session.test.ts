import { describe, expect, it, vi } from "vitest";
import type { ModGameSession } from "@rpgm-tools/neo-angband-core";
import { runSessionAction } from "./game-session.js";

function session(result: Awaited<ReturnType<ModGameSession["quit"]>> = { ok: true }): ModGameSession & Record<keyof ModGameSession, ReturnType<typeof vi.fn>> {
  return { save: vi.fn(() => result), exitToTitle: vi.fn(async () => result), quit: vi.fn(async () => result) };
}

describe("save, close game and quit", () => {
  it("runs each action through the game's own call and says what happened", async () => {
    const s = session();
    expect(await runSessionAction(s, "save")).toEqual({ ok: true, message: "Game saved." });
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(await runSessionAction(s, "close")).toEqual({ ok: true, message: "Game saved. Returning to the main menu." });
    expect(s.exitToTitle).toHaveBeenCalledTimes(1);
    expect(await runSessionAction(s, "quit")).toEqual({ ok: true, message: "Game saved. Quitting." });
    expect(s.quit).toHaveBeenCalledTimes(1);
  });

  it("passes on the game's reason when it refuses", async () => {
    const s = session({ ok: false, reason: "No character is in play." });
    expect(await runSessionAction(s, "save")).toEqual({ ok: false, message: "The game was not saved: No character is in play." });
    expect(await runSessionAction(s, "close")).toEqual({ ok: false, message: "The game was not saved: No character is in play." });
  });

  it("turns a throw into a refusal, and says when the game has no session to offer", async () => {
    const s = session();
    s.quit.mockImplementation(async () => { throw new Error("disk full"); });
    expect(await runSessionAction(s, "quit")).toEqual({ ok: false, message: "The game was not saved: disk full" });
    expect(await runSessionAction(undefined, "save")).toEqual({ ok: false, message: "This game does not let mods save it." });
  });
});
