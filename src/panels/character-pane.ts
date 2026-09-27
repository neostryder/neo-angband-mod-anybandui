import type { ViewModel } from "../view-model/protocol.js";
import { createPanelContent, PANEL_CSS, type PanelSpec } from "./panel-host.js";
import { openSurfaces, type SurfaceContext, type Surfaces } from "./surface.js";

/** The display setter this file uses, from packages/web/src/mod-plugin.ts ModDisplay. */
export interface SidebarExtentDisplay {
  setSidebarExtent?(extent: { readonly columns: number; readonly topRows: number } | null): void;
}

export interface CharacterPaneContext extends SurfaceContext {
  readonly display?: SidebarExtentDisplay | undefined;
}

export interface CharacterPane {
  /** Called from the HUD sidebar sink on every frame. Its first call proves this
   * mod owns the sidebar region, which is when the column's space is released. */
  claimSidebar(): void;
  /** Redraw the card from the latest model, in every pane that is showing. */
  paint(model: ViewModel): void;
  close(): void;
}

/**
 * The smallest sidebar this mod can ask for.
 *
 * The HUD sidebar sink stays claimed, so core stops drawing the character
 * column; this request then gives the column's cells back to the map. The
 * alternatives were worse. Releasing the sink would make core draw the column
 * again beside the pane. Changing the player's sidebar mode to None would
 * rewrite a setting the player owns, and it is not a mod seam. Zero is the
 * honest request: setSidebarExtent (packages/web/src/main.ts) accepts a
 * zero-wide column or zero-tall top row as a request to give the whole region
 * to the map. The request is per mod and core drops it at teardown; close()
 * also clears it with null.
 */
export const PANE_SIDEBAR_EXTENT = { columns: 0, topRows: 0 } as const;

const PANE_CSS = `:host{display:block;height:100%;color:var(--anyband-text);font:12px/1.35 system-ui,sans-serif}${PANEL_CSS}.surface{position:relative}`;

let paneOwnsSidebar = false;

/** True while a character pane holds the sidebar region. */
export function characterPaneOwnsSidebar(): boolean { return paneOwnsSidebar; }

/**
 * Hand the zoom feature a display whose sidebar requests follow the pane.
 *
 * Zoom and the card share this mod's one sidebar-extent request, and the last
 * call wins. Zoom re-reserves its responsive sidebar width on every zoom step
 * and layout change, which would bring the empty strip back beside the pane.
 * While the pane owns the sidebar, a non-null zoom request becomes the pane's
 * request instead; null still clears it, and without a pane nothing changes.
 */
export function gateSidebarExtent<T extends object>(display: T): T {
  return new Proxy(display, { get(target, property) {
    const member: unknown = Reflect.get(target, property);
    if (typeof member !== "function") return member;
    if (property !== "setSidebarExtent") return (member as (...args: unknown[]) => unknown).bind(target);
    return (extent: { readonly columns: number; readonly topRows: number } | null) =>
      Reflect.apply(member, target, [extent && paneOwnsSidebar ? PANE_SIDEBAR_EXTENT : extent]);
  } });
}

/**
 * The character card as a pane of its own in the host's window manager, where
 * the player can dock, tab or float it (MOD_SEAMS 4p and 4r).
 *
 * Returns null when the host has no panel kinds, and the caller keeps drawing
 * the card over the sidebar region as before. openSurfaces would fall back to an
 * overlay panel there, which is not what an older engine did, so this checks
 * for registerPanelKind first.
 */
export function installCharacterPane(ctx: CharacterPaneContext, panels: readonly PanelSpec[]): CharacterPane | null {
  if (!ctx.ui?.registerPanelKind) return null;
  let latest: ViewModel | undefined;
  const contents = new WeakMap<HTMLElement, ReturnType<typeof createPanelContent>>();
  /* Declared before openSurfaces runs, because a host may mount a saved pane
   * during registration and call render() before openSurfaces returns. */
  let surfaces: Surfaces | null = null;
  const render = (): void => {
    if (!latest || !surfaces) return;
    for (const container of surfaces.mounts().values()) {
      let content = contents.get(container);
      if (!content) { content = createPanelContent(container, panels); contents.set(container, content); }
      content.render(latest);
    }
  };
  surfaces = openSurfaces(ctx, [{ key: "character", label: "Character", tab: "Character",
    minSize: { width: 180, height: 160 }, placement: { kind: "dock", target: "main", edge: "left" } }],
  { id: "character", label: "Character", className: "surface" }, PANE_CSS, render);
  if (!surfaces) return null;
  const opened = surfaces;
  let claimed = false;
  return {
    claimSidebar() {
      if (claimed) return;
      claimed = true;
      paneOwnsSidebar = true;
      ctx.display?.setSidebarExtent?.(PANE_SIDEBAR_EXTENT);
    },
    paint(model) { latest = model; render(); },
    close() {
      opened.close();
      if (claimed) ctx.display?.setSidebarExtent?.(null);
      claimed = false;
      paneOwnsSidebar = false;
      latest = undefined;
    },
  };
}
