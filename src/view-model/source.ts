import type { GameState, InputSnapshot, ModPluginContext } from "@rpgm-tools/neo-angband-core";
import type { HudFrame, HudOwnership } from "@rpgm-tools/neo-angband-mod-sdk";
import { adapt } from "./adapter.js";
import type { ViewModel } from "./protocol.js";
import type { MessageSeams, MessageSnapshot } from "../seams.js";
import { playerIsDriving } from "../input-owner.js";
import { hasLiveState, liveHud, viewInput } from "../host-adapter.js";

type SourceCtx = MessageSeams & Pick<ModPluginContext, "state"> & { readonly core: Pick<ModPluginContext["core"], "createAgentView"> };

/** The core message log's read side, newest at age 0 (GameState.messages). */
type CoreLog = Pick<NonNullable<GameState["messages"]>, "num" | "str" | "count" | "type">;
/* The host's own message log, oldest first (packages/web/src/input-snapshot.ts
 * InputSnapshot.messages.log). Each entry carries its repeat count and the
 * colour the engine drew it in. It does not carry a message type, so that
 * still comes from the core log where the text matches. */
type SnapshotLogEntry = NonNullable<InputSnapshot["messages"]>["log"][number];
export interface HistoryEntry { readonly text: string; readonly count: number | undefined; readonly category: number | undefined; readonly color: string | undefined }

/* How far ahead in the core log a snapshot entry is looked for. The host's
 * log and the core log are fed from the same message sink, so they normally
 * line up age for age; the window only absorbs a host-only line or two. */
const MATCH_WINDOW = 8;

/**
 * The message history, newest first.
 *
 * The snapshot's entries come from the host's own history under
 * state:messages.read, and reading them leaves the per-decision message buffer
 * a controller drains untouched. They carry text only, so each entry takes its
 * repeat count and message type from the core log where the two logs agree on
 * the text; an entry with no match keeps its text and leaves both unknown.
 * Without entries, the core log is read directly, as before the snapshot
 * carried messages.
 *
 * When the snapshot also carries a `log` (the field the host added alongside
 * `entries` for engine #294), every entry takes its count and the colour the
 * engine drew it in straight from the host's log. The message type is still
 * the core log's type() where the text matches, and the host count is kept.
 */
export function messageHistory(
  entries: readonly string[] | null | undefined,
  log: CoreLog | undefined,
  hostLog?: readonly SnapshotLogEntry[] | null,
): HistoryEntry[] {
  if (hostLog) {
    const core = log === undefined ? [] : Array.from({ length: log.num() }, (_, age) => ({
      text: log.str(age), category: log.type(age),
    }));
    const history: HistoryEntry[] = [];
    let next = 0;
    for (let index = hostLog.length - 1; index >= 0; index--) {
      const entry = hostLog[index]!;
      let category: number | undefined;
      let found = -1;
      for (let age = next; age < Math.min(core.length, next + MATCH_WINDOW); age++) {
        if (core[age]!.text === entry.text) { found = age; break; }
      }
      if (found >= 0) { category = core[found]!.category; next = found + 1; }
      history.push({ text: entry.text, count: entry.count, category, color: entry.color });
    }
    return history;
  }
  const core = log === undefined ? [] : Array.from({ length: log.num() }, (_, age) => ({
    text: log.str(age), count: log.count(age), category: log.type(age), color: undefined,
  }));
  if (!entries) return core;
  const history: HistoryEntry[] = [];
  let next = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const text = entries[index]!;
    let found = -1;
    for (let age = next; age < Math.min(core.length, next + MATCH_WINDOW); age++) {
      if (core[age]!.text === text) { found = age; break; }
    }
    if (found < 0) { history.push({ text, count: undefined, category: undefined, color: undefined }); continue; }
    const foundEntry = core[found]!;
    history.push({ text: foundEntry.text, count: foundEntry.count, category: foundEntry.category, color: undefined });
    next = found + 1;
  }
  return history;
}

/**
 * Whether a -more- pause is holding input. The pager's ack prompt tagged
 * "more" is the direct answer. Without it, the snapshot's own messagePending
 * flag still answers on an engine that has interaction reads but no ack
 * descriptor. Undefined means the host publishes neither.
 */
export function messagePending(snap: MessageSnapshot | null): boolean | undefined {
  if (!snap) return undefined;
  if (snap.prompt?.kind === "ack" && (snap.prompt as { tag?: string }).tag === "more") return true;
  if (snap.phase === null || snap.phase === undefined) return undefined;
  return snap.messagePending === true;
}

/** A source exists before any HUD paint, so the frame is genuinely optional. */
export function createSource(ctx: SourceCtx): {
  readonly hud: HudOwnership;
  /** `messages` reads the input snapshot for the history and the pause. */
  snapshot(read?: { readonly messages?: boolean }): ViewModel | undefined;
  /** Present only when the host can take a prompt reply. */
  readonly acknowledge?: () => boolean;
} {
  let latest: HudFrame | undefined;
  const present = (_section: unknown, frame: HudFrame): void => { latest = frame; };
  const read = (): MessageSnapshot | null => {
    try { return viewInput(ctx); } catch { return null; }
  };
  /* Answers the -more- pause the way a keypress does. It reads a fresh
   * snapshot, so a pause the player already dismissed with a key is not
   * answered twice, and it stands down while another controller drives. */
  const acknowledge = (): boolean => {
    if (!ctx.prompt || !playerIsDriving(ctx)) return false;
    const prompt = read()?.prompt;
    if (prompt?.kind !== "ack" || (prompt as { tag?: string }).tag !== "more") return false;
    return ctx.prompt.reply(prompt.promptId, { action: "acknowledge" }).accepted;
  };
  return {
    hud: { sidebar: { present }, messages: { present }, status: { present } },
    ...(ctx.prompt ? { acknowledge } : {}),
    snapshot(options: { readonly messages?: boolean } = {}): ViewModel | undefined {
      if (!hasLiveState(ctx)) return undefined;
      /* The input snapshot copies the whole capture and the last map frame,
       * so it is read only for the message log, the one panel that shows the
       * history and the pause. The other panels keep the plain log read. */
      const snap = options.messages ? read() : null;
      const pending = messagePending(snap);
      const live = liveHud(ctx)!;
      return adapt(live.view, latest, {
        name: live.name,
        history: messageHistory(snap?.messages?.entries, live.messages, snap?.messages?.log),
        study: live.study,
        repeat: live.repeat,
        resting: live.resting,
        running: live.running,
        unignoring: live.unignoring,
        recall: live.recall,
        descent: live.descent,
        extraMoves: live.extraMoves,
        ...(pending === undefined ? {} : { messagePending: pending }),
      });
    },
  };
}
