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
 * This first version registers nothing and declares no capabilities. Each
 * capability is added to manifest.json with the first feature that needs it, so
 * the consent list a player reads always matches what the mod does.
 */

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

export default {
  api: 1,

  register(_host: unknown, ctx: RegisterCtx): void {
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}; no panels are enabled in this version`);
  },
};
