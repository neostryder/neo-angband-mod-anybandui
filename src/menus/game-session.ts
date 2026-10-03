/**
 * Save, Close game and Quit (AnybandUI client.cpp:2034-2045 and :2121-2128),
 * over ctx.session. Save writes the game and play goes on. Close game saves and
 * returns to the title screen, as upstream's "Save and return to main menu"
 * does. Quit saves and quits, which closes the desktop app; a browser tab goes
 * to the title screen. Each call saves first, and the game refuses, without
 * leaving, when no living character is in play, a mod failed mid-turn, or the
 * save failed. The refusal's reason is what the player reads.
 */
import type { ModGameSession, SaveResult } from "@rpgm-tools/neo-angband-core";

export type SessionAction = "save" | "close" | "quit";

export interface SessionOutcome {
  readonly ok: boolean;
  /** The line to show the player: what happened, or why the game refused. */
  readonly message: string;
}

export const SESSION_LABELS: Readonly<Record<SessionAction, string>> = {
  save: "Save and continue",
  close: "Save and return to main menu",
  quit: "Save and quit",
};

/** The question asked before a call that leaves the game. Save asks nothing, as upstream's menu does not. */
export const SESSION_QUESTIONS: Readonly<Record<Exclude<SessionAction, "save">, string>> = {
  close: "Save this character and return to the main menu?",
  quit: "Save this character and quit?",
};

const DONE: Readonly<Record<SessionAction, string>> = {
  save: "Game saved.",
  close: "Game saved. Returning to the main menu.",
  quit: "Game saved. Quitting.",
};

function outcome(action: SessionAction, result: SaveResult): SessionOutcome {
  if (result.ok) return { ok: true, message: DONE[action] };
  return { ok: false, message: `The game was not saved: ${result.reason}` };
}

/** Run one action. A refusal or a throw comes back as a message rather than being lost. */
export async function runSessionAction(session: ModGameSession | undefined, action: SessionAction): Promise<SessionOutcome> {
  if (!session) return { ok: false, message: "This game does not let mods save it." };
  try {
    if (action === "save") return outcome(action, session.save());
    return outcome(action, await (action === "close" ? session.exitToTitle() : session.quit()));
  } catch (err) {
    return { ok: false, message: `The game was not saved: ${err instanceof Error ? err.message : String(err)}` };
  }
}
