import { readDisplayPreference } from "../preferences.js";
import { applyTheme, THEMES } from "../theme.js";
import { validateSettings } from "../settings.js";
import { INTERFACE_ZOOM_SCALES } from "../zoom.js";
import type { PanelKindSpec, PanelMount } from "../seams.js";

/** One card this mod draws: a pane of its own in the host's tiled layout when
 * the host offers panel kinds, or a section of one shared overlay when not. */
export interface SurfaceSpec {
  readonly key: string;
  readonly label: string;
  readonly tab?: string;
  readonly minSize?: PanelKindSpec["minSize"];
  readonly placement?: PanelKindSpec["preferredPlacement"];
  readonly fitHeight?: number;
}

export interface SurfaceContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly ui?: {
    openPanel?(spec: { id: string; modal: boolean; label: string }): { readonly root: ShadowRoot; readonly closed: Promise<void>; close(): void };
    registerPanelKind?(spec: PanelKindSpec): () => void;
  } | undefined;
  readonly prefs?: { get(): unknown } | undefined;
  readonly log: (message: string) => void;
}

export interface Surfaces {
  /** Containers for the cards showing now. A pane in an inactive tab is left out,
   * so a hidden card costs no painting until it is shown again. */
  mounts(): Map<string, HTMLElement>;
  /** Ask the host to size a pane to its content; ignored in the overlay. */
  fit(key: string, px: number): void;
  focus(key: string): void;
  close(): void;
}

interface Entry { readonly container: HTMLElement; readonly host: PanelMount | null; active: boolean; fitted: number | null }

/** The zoom feature's interface step (Ctrl-Shift with the zoom keys) scales these
 * cards too, so one control sizes every panel. Without zoom the cards stay at 100%. */
export function interfaceScale(ctx: SurfaceContext): number {
  if (ctx.flags?.["anybandui.zoom"] !== true) return 1;
  return INTERFACE_ZOOM_SCALES[readDisplayPreference(ctx.prefs?.get()).interfaceZoomIndex] ?? 1;
}

function prepare(ctx: SurfaceContext, root: ShadowRoot, css: string): void {
  applyTheme(root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
  const style = root.ownerDocument.createElement("style"); style.textContent = css; root.appendChild(style);
}

function section(root: ShadowRoot, className: string): HTMLElement {
  const container = root.ownerDocument.createElement("section"); container.className = className; root.appendChild(container);
  return container;
}

/** Register a pane per spec with the host's window manager, or fall back to one
 * overlay holding every spec's section in order. The host owns frames, tabs,
 * placement and saving; this mod owns only what is inside. */
export function openSurfaces(ctx: SurfaceContext, specs: readonly SurfaceSpec[], overlay: { readonly id: string; readonly label: string; readonly className: string }, css: string, onChange: () => void): Surfaces | null {
  const entries = new Map<string, Entry>();
  const scale = (container: HTMLElement): void => { container.style.zoom = String(interfaceScale(ctx)); };
  const register = ctx.ui?.registerPanelKind;
  if (register) {
    const unregister = specs.map((spec) => register({
      kind: spec.key, label: spec.label,
      ...(spec.tab ? { tab: spec.tab } : {}), ...(spec.minSize ? { minSize: spec.minSize } : {}),
      ...(spec.placement ? { preferredPlacement: spec.placement } : {}), ...(spec.fitHeight !== undefined ? { fitHeight: spec.fitHeight } : {}),
      mount(host: PanelMount) {
        prepare(ctx, host.root, css);
        const entry: Entry = { container: section(host.root, overlay.className), host, active: host.active, fitted: spec.fitHeight ?? null };
        entries.set(spec.key, entry);
        const stop = host.onStateChange((state) => { entry.active = state.active; onChange(); });
        onChange();
        return () => { stop(); entries.delete(spec.key); };
      },
    }));
    return {
      mounts: () => new Map([...entries].filter(([, entry]) => entry.active).map(([key, entry]) => { scale(entry.container); return [key, entry.container]; })),
      fit: (key, px) => { const entry = entries.get(key); const next = Math.ceil(px); if (entry?.host && entry.fitted !== next) { entry.fitted = next; entry.host.setFitHeight(next); } },
      focus: (key) => entries.get(key)?.host?.requestFocus(),
      close: () => { for (const stop of unregister) stop(); entries.clear(); },
    };
  }
  if (!ctx.ui?.openPanel) return null;
  const panel = ctx.ui.openPanel({ id: overlay.id, modal: false, label: overlay.label });
  prepare(ctx, panel.root, css);
  for (const spec of specs) entries.set(spec.key, { container: section(panel.root, overlay.className), host: null, active: true, fitted: null });
  let open = true;
  void panel.closed.then(() => { open = false; entries.clear(); });
  return {
    mounts: () => open ? new Map([...entries].map(([key, entry]) => { scale(entry.container); return [key, entry.container]; })) : new Map(),
    fit: () => {},
    focus: () => {},
    close: () => { if (open) panel.close(); open = false; entries.clear(); },
  };
}
