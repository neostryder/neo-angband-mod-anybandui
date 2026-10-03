/**
 * One menu panel: a pane in the host's layout (or the overlay on older hosts),
 * redrawn whole on each change with the focused control, and the caret in a
 * text box, put back afterwards. The theme follows the other panels through
 * openSurfaces.
 */
import { openSurfaces, type SurfaceContext, type SurfaceSpec } from "../panels/surface.js";
import { registerOpener } from "./openers.js";

export const MENU_CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.menu{position:absolute;right:12px;top:12px;width:min(620px,62vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);box-sizing:border-box}
h2{margin:0 0 6px;font-size:inherit;color:var(--anyband-accent)}
button,input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
button{cursor:pointer}button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--anyband-accent)}
[aria-pressed=true],[aria-selected=true]{background:var(--anyband-accent);color:var(--anyband-background)}
.tabs,.actions,.controls{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0;align-items:center}
.controls input[type=search]{flex:1 1 55%}
.section{margin:10px 0 4px;padding-bottom:2px;color:var(--anyband-accent);border-bottom:1px solid var(--anyband-accent)}
.list{display:flex;flex-direction:column;gap:1px}
.row{display:flex;gap:8px;justify-content:space-between;text-align:left;border-color:transparent;background:transparent}
.row .cells{opacity:.85}
.field{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:3px 0}
.field .name{opacity:.6;font-size:.9em}
.split{display:grid;grid-template-columns:minmax(150px,38%) 1fr;gap:10px;align-items:start}
.nav{display:flex;flex-direction:column;gap:2px}
.nav .group{margin-top:6px;opacity:.6}
.detail{padding:4px;border-left:1px solid var(--anyband-accent);min-height:4em;white-space:normal}
.detail pre{margin:0;white-space:pre}
.detail table{border-collapse:collapse}.detail td,.detail th{padding:0 6px 0 0;text-align:left}
.muted{opacity:.7}.warn{color:var(--anyband-accent);font-weight:bold}
.confirm{margin:8px 0;padding:8px;border:1px solid var(--anyband-accent);background:var(--anyband-background);border-radius:var(--anyband-rounding)}
.note{margin-top:6px}`;

export interface MenuSurface {
  /**
   * Draw again. `focusKey` moves the focus to that control instead of keeping it,
   * and null leaves nothing in the panel focused, so the next key goes to the game.
   */
  repaint(focusKey?: string | null): void;
  /** Whether the panel is showing now. */
  mounted(): boolean;
  close(): void;
}

export interface MenuSpec extends SurfaceSpec {
  /** The control that takes the focus when the settings window opens this panel. */
  readonly firstFocus: string;
  /** Runs when a showing panel stops showing: the host moved to another tab, or closed the pane or the overlay. */
  readonly onHidden?: () => void;
}

type Focusable = HTMLElement & { selectionStart?: number | null; selectionEnd?: number | null; setSelectionRange?(start: number, end: number | null): void };

export function findFocus(mount: HTMLElement, key: string): HTMLElement | null {
  for (const node of Array.from(mount.querySelectorAll<HTMLElement>("[data-focus]"))) {
    if (node.dataset["focus"] === key) return node;
  }
  return null;
}

export function openMenuSurface(ctx: SurfaceContext, spec: MenuSpec, render: (mount: HTMLElement) => void): MenuSurface | null {
  let closed = false;
  let shown = false;
  let paint = (_focus?: string | null): void => {};
  const surfaces = openSurfaces(ctx, [spec], { id: spec.key, label: spec.label, className: "menu" }, MENU_CSS, () => paint());
  if (!surfaces) return null;
  const stopOpener = registerOpener(spec.key, () => { surfaces.focus(spec.key); paint(spec.firstFocus); });
  paint = (focusKey?: string | null): void => {
    if (closed) return;
    const mount = surfaces.mounts().get(spec.key);
    if (!mount) {
      if (shown) { shown = false; spec.onHidden?.(); }
      return;
    }
    shown = true;
    const root = mount.getRootNode() as { activeElement?: Element | null };
    const active = (root.activeElement ?? null) as Focusable | null;
    const kept = active && mount.contains(active) ? active.dataset?.["focus"] : undefined;
    const target = focusKey === null ? undefined : focusKey ?? kept;
    const caret = focusKey === undefined && active && typeof active.selectionStart === "number"
      ? [active.selectionStart, active.selectionEnd ?? null] as const : null;
    mount.replaceChildren();
    /* A fresh frame each time, so listeners a render adds go away with it. */
    const frame = mount.ownerDocument.createElement("div");
    mount.appendChild(frame);
    render(frame);
    if (!target) return;
    const field = findFocus(mount, target) as Focusable | null;
    field?.focus();
    if (field && caret && typeof field.setSelectionRange === "function") {
      try { field.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field */ }
    }
  };
  paint();
  return {
    repaint: (focusKey) => paint(focusKey),
    mounted: () => !closed && surfaces.mounts().has(spec.key),
    close: () => { if (closed) return; closed = true; stopOpener(); surfaces.close(); },
  };
}
