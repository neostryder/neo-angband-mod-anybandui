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
import type { ModDisplay, ModPluginContext } from "@rpgm-tools/neo-angband-core";
import { createSource } from "./src/view-model/source.js";
import { createPanelHost, type PanelSpec } from "./src/panels/panel-host.js";
import { gateSidebarExtent, installCharacterPane, type CharacterPane } from "./src/panels/character-pane.js";
import { renderCharacterCard } from "./src/panels/character-card.js";
import { renderDungeonCard } from "./src/panels/dungeon-card.js";
import { renderDriverBadge, renderStatusBadges } from "./src/panels/status-badges.js";
import { renderTrackedCreature } from "./src/panels/tracked-creature.js";
import { renderMessageLog } from "./src/panels/message-log.js";
import { validateSettings } from "./src/settings.js";
import { THEMES } from "./src/theme.js";
import { installAccessibilityAccommodations, uninstallAccessibilityAccommodations } from "./src/accessibility.js";
import { installFirstEncounter, uninstallFirstEncounter } from "./src/first-encounter.js";
import { installZoomPan, releaseTileSettings, uninstallZoomPan, zoomPanHud, type ZoomPanContext } from "./src/zoom.js";
import { installHoverCards } from "./src/hover-cards.js";
import { installMapHoverCards } from "./src/qol-map-hover.js";
import { installMapOverview } from "./src/map-overview.js";
import { installItems } from "./src/panels/items.js";
import type { ItemsContext } from "./src/seams.js";
import { installMapMouse } from "./src/map-mouse.js";
import { installPhase4 } from "./src/phase4.js";
import { installStores } from "./src/panels/stores.js";
import { installEffects } from "./src/effects.js";
import { coexistingFlags } from "./src/mod-coexistence.js";
import { currentDriver } from "./src/input-owner.js";
import { installChromePaint } from "./src/paint.js";

/** The register callback reads a subset of the published plugin context. */
type RegisterCtx = Pick<ModPluginContext, "id" | "engine" | "log"> & Partial<Omit<ModPluginContext, "id" | "engine" | "log" | "display">> & { readonly display?: Pick<ModDisplay, "setVisualFilter"> & Partial<Omit<ModDisplay, "setVisualFilter">> };

let quiverDisplay: RegisterCtx["display"];
let tileDisplay: RegisterCtx["display"];
let tileFullOverviewApplied = false;
let displayCleanups: Array<() => void> = [];
let characterPane: CharacterPane | null = null;
/** Redraws the status panel with its last frame; set by hud(), called on driver-changed. */
let statusRepaint: (() => void) | null = null;

type HudCtx = Parameters<typeof createSource>[0] & Pick<ModPluginContext, "flags"> & Partial<Pick<ModPluginContext, "prefs" | "ui" | "display" | "log">>;

export default {
  api: 1,

  register(_host: unknown, ctx: RegisterCtx): void {
    this.uninstall();
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
    const flags = coexistingFlags(ctx.flags ?? {}, ctx.mods?.bind(ctx), ctx.log);
    /* The listener lives here rather than in hud() so that uninstall removes
     * it. An engine without the event still redraws the badge on the next HUD
     * frame, because the badge's select reads the driver on every frame. */
    if (ctx.events) {
      const events = ctx.events;
      const repaint = (): void => statusRepaint?.();
      try {
        events.on("driver-changed", repaint);
        displayCleanups.push(() => events.off("driver-changed", repaint));
      } catch { /* no driver-changed event or grant on this engine */ }
    }
    displayCleanups.push(installEffects({ flags, ...(ctx.snapshot ? { snapshot: ctx.snapshot } : {}), ...(ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {}), ...(ctx.events ? { events: ctx.events } : {}), ...(ctx.display?.snapshot ? { display: { snapshot: ctx.display.snapshot.bind(ctx.display) } } : {}), ...(ctx.prefs ? { prefs: ctx.prefs } : {}), ...(ctx.settings ? { settings: ctx.settings } : {}) }));
    /* The window frames around the cards take the same paint as the cards. */
    displayCleanups.push(installChromePaint(ctx.display, flags, THEMES[validateSettings(ctx.prefs?.get()).theme]!, ctx.log));
    const liveCore = ctx.core, liveState = ctx.state;
    const itemContext: ItemsContext = { flags, log: ctx.log,
      ...(ctx.snapshot ? { snapshot: ctx.snapshot } : {}), ...(ctx.inspect ? { inspect: ctx.inspect } : {}),
      ...(ctx.intent ? { intent: ctx.intent } : {}), ...(ctx.prompt ? { prompt: ctx.prompt } : {}),
      ...(ctx.ui ? { ui: ctx.ui } : {}), ...(ctx.prefs ? { prefs: ctx.prefs } : {}),
      ...(liveCore && liveState ? { state: liveState, core: { createAgentView: () => liveCore.createAgentView(liveState), createAgentActions: () => liveCore.createAgentActions(liveState) } } : {}) };
    displayCleanups.push(installItems(itemContext));
    displayCleanups.push(installStores({ ...itemContext, ...(ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {}), ...(ctx.driver ? { driver: ctx.driver } : {}) }));
    if (flags["anybandui.highContrast"] || flags["anybandui.colourblind"] || flags["anybandui.crt"]) {
      installAccessibilityAccommodations({ flags, ...(ctx.display ? { display: ctx.display } : {}), log: ctx.log });
    }
    if (flags["anybandui.quiverItemization"]) {
      if (!ctx.display) ctx.log("this game is too old for display conveniences");
      else {
        if (flags["anybandui.quiverItemization"] && ctx.display.setQuiverItemization) {
          quiverDisplay = ctx.display;
          ctx.display.setQuiverItemization(true);
        }
      }
    }
    if (ctx.display?.snapshot && ctx.display.onKey && ctx.display.setGrid && ctx.display.setCamera && ctx.display.setSidebarExtent && ctx.display.repaint) {
      const display = ctx.display as NonNullable<ZoomPanContext["display"]>;
      // The gate keeps zoom's sidebar reservation from reopening the strip the character pane released.
      installZoomPan({ flags, display: gateSidebarExtent(display), manageTileSettings: false, ...(ctx.prefs ? { prefs: ctx.prefs as NonNullable<ZoomPanContext["prefs"]> } : {}),
        ...(ctx.snapshot ? { snapshot: ctx.snapshot as NonNullable<ZoomPanContext["snapshot"]> } : {}),
        ...(ctx.subwindows ? { subwindows: ctx.subwindows } : {}),
        ...(ctx.state ? { state: ctx.state as unknown as NonNullable<ZoomPanContext["state"]> } : {}), log: ctx.log });
      displayCleanups.push(uninstallZoomPan);
      if (ctx.display.setFullMapOverview && ctx.display.setMapView && ctx.display.setTileScaling) {
        displayCleanups.push(installMapOverview({ flags, display: ctx.display as unknown as NonNullable<Parameters<typeof installMapOverview>[0]["display"]>,
          ...(ctx.state ? { state: ctx.state as unknown as NonNullable<ZoomPanContext["state"]> } : {}),
          ...(ctx.knownLevel ? { knownLevel: ctx.knownLevel as NonNullable<Parameters<typeof installMapOverview>[0]["knownLevel"]> } : {}),
          ...(ctx.prefs ? { prefs: ctx.prefs } : {}), log: ctx.log }));
      }
      displayCleanups.push(installMapHoverCards({ flags,
        ...(ctx.core ? { core: ctx.core } : { core: null }),
        ...(ctx.state ? { state: ctx.state as unknown as NonNullable<Parameters<typeof installMapHoverCards>[0]["state"]> } : {}),
        display }));
      displayCleanups.push(installHoverCards({ flags: { ...flags, "anybandui.mapHoverCards": false }, display,
        ...(ctx.snapshot ? { snapshot: ctx.snapshot } : {}),
        ...(ctx.inspect ? { inspect: ctx.inspect as NonNullable<Parameters<typeof installHoverCards>[0]["inspect"]> } : {}),
        ...(ctx.core ? { core: ctx.core as unknown as NonNullable<Parameters<typeof installHoverCards>[0]["core"]> } : {}),
        ...(ctx.knownLevel ? { knownLevel: ctx.knownLevel as NonNullable<Parameters<typeof installHoverCards>[0]["knownLevel"]> } : {}),
        ...(ctx.state ? { state: ctx.state as unknown as NonNullable<ZoomPanContext["state"]> } : {}), ...(ctx.prefs ? { prefs: ctx.prefs } : {}), log: ctx.log }));
    } else if (flags["anybandui.crispTiles"] && ctx.display?.setTileScaling) {
      tileDisplay = ctx.display;
      ctx.display.setTileScaling("crisp");
      if (ctx.display.setFullMapOverview) {
        ctx.display.setFullMapOverview(true);
        tileFullOverviewApplied = true;
      }
    }
    if (flags["anybandui.mapHoverCards"] &&
        !(ctx.display?.snapshot && ctx.display.onKey && ctx.display.setGrid && ctx.display.setCamera && ctx.display.setSidebarExtent && ctx.display.repaint)) {
      displayCleanups.push(installMapHoverCards({ flags, core: ctx.core ?? null,
        ...(ctx.state ? { state: ctx.state as unknown as NonNullable<Parameters<typeof installMapHoverCards>[0]["state"]> } : {}),
        ...(ctx.display?.snapshot ? { display: ctx.display as NonNullable<ZoomPanContext["display"]> } : {}) }));
    }
    displayCleanups.push(installMapMouse({ flags,
      ...(ctx.display?.snapshot ? { display: ctx.display as NonNullable<ZoomPanContext["display"]> } : {}),
      ...(ctx.snapshot ? { snapshot: ctx.snapshot } : {}),
      ...(ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {}),
      ...(ctx.intent ? { intent: ctx.intent } : {}),
      ...(ctx.prompt ? { prompt: ctx.prompt } : {}),
      ...(ctx.inspect ? { inspect: ctx.inspect } : {}),
      ...(ctx.prefs ? { prefs: ctx.prefs } : {}), log: ctx.log }));
    displayCleanups.push(installPhase4({ flags, log: ctx.log,
      ...(ctx.snapshot ? { snapshot: ctx.snapshot } : {}), ...(ctx.intent ? { intent: ctx.intent } : {}),
      ...(ctx.prompt ? { prompt: ctx.prompt } : {}), ...(ctx.inspect ? { inspect: ctx.inspect } : {}),
      ...(ctx.ui ? { ui: ctx.ui } : {}), ...(ctx.prefs ? { prefs: ctx.prefs } : {}),
      ...(ctx.display?.snapshot ? { display: { snapshot: ctx.display.snapshot.bind(ctx.display) } } : {}),
      ...(ctx.driver ? { driver: ctx.driver } : {}), ...(ctx.character ? { character: ctx.character } : {}),
      ...(ctx.state ? { state: ctx.state } : {}) }));
    /* The live state is available at register time. See first-encounter.ts
     * for why sightings are polled and stored in prefs by character. */
    if (flags["anybandui.firstEncounter"]) {
      if (ctx.core && ctx.state) {
        const theme = THEMES[validateSettings(ctx.prefs?.get()).theme]!;
        installFirstEncounter({ core: ctx.core, state: ctx.state, theme,
          ...(ctx.ui ? { ui: ctx.ui } : {}), ...(ctx.prefs ? { prefs: ctx.prefs } : {}),
          ...(ctx.tiles ? { tiles: ctx.tiles } : {}), log: ctx.log });
      } else ctx.log("first-encounter alerts: no live game at register time");
    }
  },

  uninstall(): void {
    characterPane?.close();
    characterPane = null;
    for (const cleanup of displayCleanups.splice(0).reverse()) cleanup();
    uninstallFirstEncounter();
    uninstallAccessibilityAccommodations();
    quiverDisplay?.setQuiverItemization?.(false);
    if (tileDisplay?.setTileScaling) releaseTileSettings(tileDisplay as Parameters<typeof releaseTileSettings>[0], tileFullOverviewApplied);
    quiverDisplay = undefined;
    tileDisplay = undefined;
    tileFullOverviewApplied = false;
  },

  hud(ctx: HudCtx): HudOwnership | undefined {
    characterPane?.close();
    characterPane = null;
    const doc = globalThis.document;
    if (!doc?.body) return undefined;
    const enabled = { sidebar: ctx.flags["anybandui.sidebar"] === true,
      status: ctx.flags["anybandui.status"] === true,
      messages: ctx.flags["anybandui.messages"] === true };
    const zoomSidebar = !enabled.sidebar && (ctx.flags["anybandui.zoom"] || ctx.flags["anybandui.enlargedDisplay"]);
    if (!enabled.sidebar && !enabled.status && !enabled.messages && !zoomSidebar) return undefined;
    const source = createSource(ctx);
    const theme = THEMES[validateSettings(ctx.prefs?.get()).theme]!;
    const output: { -readonly [K in keyof HudOwnership]: HudOwnership[K] } = {};
    const cardPanels: PanelSpec[] = [
      { key: "character", render: renderCharacterCard, select: (m) => { const p = m.player; return [p.name, p.race, p.class, p.title, p.hp, p.max_hp, p.sp, p.max_sp, p.food, p.food_max, p.experience, p.level_start_experience, p.next_level_experience, p.level, p.stats, p.gold, p.armour, p.speed, p.extra_moves]; } },
      { key: "tracked", render: renderTrackedCreature, select: (m) => m.player.tracked_creature },
    ];
    /* With panel kinds the card is always a pane of its own. The sidebar sink is
     * still claimed so core stops drawing its column, and character-pane.ts says
     * how the column's cells go back to the map. Without panel kinds the card is
     * drawn over the sidebar region, as on older engines. */
    const pane = enabled.sidebar
      ? installCharacterPane({ flags: ctx.flags, ui: ctx.ui, prefs: ctx.prefs, display: ctx.display, log: ctx.log ?? (() => {}) }, cardPanels)
      : null;
    characterPane = pane;
    if (pane) {
      output.sidebar = { present(section: HudSection, frame: HudFrame) {
        zoomPanHud({ flags: ctx.flags })?.sidebar?.present(section, frame);
        source.hud.sidebar!.present(section, frame);
        pane.claimSidebar();
        const model = source.snapshot();
        if (model) pane.paint(model);
      } };
    }
    else if (enabled.sidebar) {
      const host = createPanelHost(doc, cardPanels, theme);
      output.sidebar = { present(section: HudSection, frame: HudFrame) {
        zoomPanHud({ flags: ctx.flags })?.sidebar?.present(section, frame);
        source.hud.sidebar!.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    else if (zoomSidebar) {
      const sink = zoomPanHud({ flags: ctx.flags })?.sidebar;
      if (sink) output.sidebar = sink as NonNullable<HudOwnership["sidebar"]>;
    }
    if (enabled.status) {
      const host = createPanelHost(doc, [
        { key: "driver", render: (mount) => renderDriverBadge(mount, currentDriver(ctx)), select: () => currentDriver(ctx) },
        { key: "status", render: renderStatusBadges, select: (m) => [m.player.statuses, m.player.study] },
        { key: "dungeon", render: renderDungeonCard, select: (m) => [m.dungeon, m.player.trap_detected, m.player.recall, m.player.descent, m.player.resting, m.player.running, m.player.repeat, m.player.unignoring] },
      ], theme);
      let last: readonly [HudSection, HudFrame] | null = null;
      output.status = { present(section: HudSection, frame: HudFrame) {
        last = [section, frame];
        source.hud.status!.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
        /* The pane is not tied to the sidebar region, so any frame this mod sees
         * refreshes it; the card's own signatures skip unchanged data. */
        if (model) pane?.paint(model);
      } };
      statusRepaint = () => { if (last) output.status!.present(last[0], last[1]); };
    }
    if (enabled.messages) {
      const acknowledge = source.acknowledge;
      const host = createPanelHost(doc, [{ key: "messages", render: (mount, model) => renderMessageLog(mount, model, acknowledge ? { acknowledge } : {}), select: (m) => [m.messages, m.message_pending] }], theme);
      output.messages = { present(section: HudSection, frame: HudFrame) {
        source.hud.messages!.present(section, frame);
        const model = source.snapshot({ messages: true });
        if (model) host.present(section, frame, model);
        if (model) pane?.paint(model);
      } };
    }
    return output;
  },
};
