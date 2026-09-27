import type { AgentView, GameState } from "@rpgm-tools/neo-angband-core";
import type { HudFrame, HudOwnership } from "@rpgm-tools/neo-angband-mod-sdk";
import { adapt } from "./adapter.js";
import type { ViewModel } from "./protocol.js";

interface SourceCtx {
  readonly state?: GameState;
  readonly core: { readonly createAgentView: (state: GameState) => AgentView };
}

/** A source exists before any HUD paint, so the frame is genuinely optional. */
export function createSource(ctx: SourceCtx): {
  readonly hud: HudOwnership;
  snapshot(): ViewModel | undefined;
} {
  let latest: HudFrame | undefined;
  const present = (_section: unknown, frame: HudFrame): void => { latest = frame; };
  return {
    hud: { sidebar: { present }, messages: { present }, status: { present } },
    snapshot(): ViewModel | undefined {
      if (ctx.state === undefined) return undefined;
      const state = ctx.state;
      const log = state.messages;
      const history = log === undefined ? [] : Array.from({ length: log.num() }, (_, age) => ({
        text: log.str(age), count: log.count(age), category: log.type(age),
      }));
      return adapt(ctx.core.createAgentView(state), latest, {
        name: state.actor.player.fullName,
        history,
        study: state.actor.player.upkeep.newSpells,
        repeat: state.cmdQueue?.[0]?.repeatRemaining ?? 0,
        resting: state.resting !== undefined,
        running: state.run !== undefined,
        unignoring: state.unignoring ?? 0,
        recall: state.actor.player.wordRecall,
        descent: state.actor.player.deepDescent,
        extraMoves: state.playerState?.numMoves ?? 0,
      });
    },
  };
}
