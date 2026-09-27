/**
 * AnybandUI, as a mod's entry point.
 *
 * AnybandUI is a native desktop frontend for Angband by Wurli Monkhaven
 * (https://github.com/WurliMonkhaven/AnybandUI). This mod ports its interface to
 * Neo Angband's own UI seams: the per-region HUD, menu and screen replacements,
 * mod-created regions, and HTML panels. PLANNED.md holds the phased port.
 *
 * The port reads game state through one adapter that shapes it like AnybandUI's
 * full-v1 protocol payloads (protocol/wire-v1.md in that repository). Every panel
 * draws from that view model rather than from engine objects directly, so the
 * same adapter can later back a stdio bridge that lets the native AnybandUI
 * client drive Neo Angband.
 *
 * Each capability is added with the first feature that needs it, so the
 * consent list a player reads matches what the mod does.
 */
import type { HudFrame, HudOwnership, HudSection } from "@rpgm-tools/neo-angband-mod-sdk";
import { createSource } from "./src/view-model/source.js";
import { createPanelHost } from "./src/panels/panel-host.js";
import { renderCharacterCard } from "./src/panels/character-card.js";
import { renderDungeonCard } from "./src/panels/dungeon-card.js";
import { renderStatusBadges } from "./src/panels/status-badges.js";
import { renderTrackedCreature } from "./src/panels/tracked-creature.js";
import { renderMessageLog } from "./src/panels/message-log.js";
import { validateSettings } from "./src/settings.js";
import { THEMES } from "./src/theme.js";

/**
 * What this plugin needs from the host's context, structurally.
 *
 * Declared here rather than imported from the host's mod-plugin.ts, because this
 * file compiles in a standalone repository that holds no copy of the host.
 */
interface RegisterCtx {
  readonly id: string;
  readonly engine: string;
  readonly log: (msg: string) => void;
}

type HudCtx = Parameters<typeof createSource>[0] & { readonly flags: Readonly<Record<string, boolean>>; readonly prefs?: { get(): unknown } };

export default {
  api: 1,

  register(_host: unknown, ctx: RegisterCtx): void {
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
  },

  hud(ctx: HudCtx): HudOwnership | undefined {
    const doc = globalThis.document;
    if (!doc?.body) return undefined;
    const enabled = { sidebar: ctx.flags["anybandui.sidebar"] === true,
      status: ctx.flags["anybandui.status"] === true,
      messages: ctx.flags["anybandui.messages"] === true };
    if (!enabled.sidebar && !enabled.status && !enabled.messages) return undefined;
    const source = createSource(ctx);
    const theme = THEMES[validateSettings(ctx.prefs?.get()).theme]!;
    const output: { -readonly [K in keyof HudOwnership]: HudOwnership[K] } = {};
    if (enabled.sidebar) {
      const host = createPanelHost(doc, [
        { key: "character", render: renderCharacterCard, select: (m) => { const p = m.player; return [p.name, p.race, p.class, p.title, p.hp, p.max_hp, p.sp, p.max_sp, p.food, p.food_max, p.experience, p.level_start_experience, p.next_level_experience, p.level, p.stats, p.gold, p.armour, p.speed, p.extra_moves]; } },
        { key: "tracked", render: renderTrackedCreature, select: (m) => m.player.tracked_creature },
      ], theme);
      output.sidebar = { present(section: HudSection, frame: HudFrame) {
        source.hud.sidebar!.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    if (enabled.status) {
      const host = createPanelHost(doc, [
        { key: "status", render: renderStatusBadges, select: (m) => [m.player.statuses, m.player.study] },
        { key: "dungeon", render: renderDungeonCard, select: (m) => [m.dungeon, m.player.trap_detected, m.player.recall, m.player.descent, m.player.resting, m.player.running, m.player.repeat, m.player.unignoring] },
      ], theme);
      output.status = { present(section: HudSection, frame: HudFrame) {
        source.hud.status!.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    if (enabled.messages) {
      const host = createPanelHost(doc, [{ key: "messages", render: renderMessageLog, select: (m) => [m.messages, m.message_pending] }], theme);
      output.messages = { present(section: HudSection, frame: HudFrame) {
        source.hud.messages!.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    return output;
  },
};
