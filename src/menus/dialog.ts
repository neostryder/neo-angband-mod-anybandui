/**
 * The modal frame every menu in this folder draws into: a host panel with the
 * mod's theme painted on it, repainted when the theme changes, and a few DOM
 * helpers the menus share.
 *
 * A modal panel takes the keyboard and the pointer, and the host closes the
 * topmost one on Escape. Stacking one dialog over another is therefore how a
 * menu here backs out one level at a time: Escape closes only the dialog on top.
 */
import { applyTheme, onThemeChange } from "../theme.js";
import { themeFromPrefs } from "../settings.js";

export interface PanelSeam {
  openPanel(spec: { id: string; modal: boolean; label: string }): { readonly root: ShadowRoot; readonly closed: Promise<void>; close(): void };
}

export interface DialogContext {
  readonly ui?: Partial<PanelSeam> | undefined;
  readonly prefs?: { get(): unknown } | undefined;
  readonly log: (message: string) => void;
}

export interface Dialog {
  readonly root: ShadowRoot;
  readonly body: HTMLElement;
  /** Resolves when the panel goes, whoever closed it. */
  readonly closed: Promise<void>;
  /** True once the player closed it (Escape or the host's close control) rather than this mod. */
  dismissedByPlayer(): boolean;
  isOpen(): boolean;
  close(): void;
}

/** The frame look shared with the other panels: surface fill, accent border, theme rounding. */
export const DIALOG_CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:max-content;min-width:min(320px,calc(100vw - 24px));max-width:min(900px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:10px 12px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
.dialog.wide{width:min(900px,calc(100vw - 24px))}
h2{margin:0 0 6px;font-size:1.15em}h3{margin:8px 0 4px;font-size:1em;opacity:.8;text-transform:uppercase;letter-spacing:.05em}
p{margin:4px 0}
button{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 8px;cursor:pointer}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--anyband-accent)}
input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
.actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.muted{opacity:.65}.error{color:#e8806f}
.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}
.tabs button[aria-selected="true"]{border-width:2px}
table{width:100%;border-collapse:collapse}td,th{padding:2px 6px;border-bottom:1px solid var(--anyband-accent);text-align:left;vertical-align:top}
th{opacity:.8;font-weight:normal}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin:8px 0}
.metric{border:1px solid var(--anyband-accent);border-radius:calc(var(--anyband-rounding) * .6);padding:4px 6px}
.metric .label{display:block;opacity:.65;font-size:.85em;text-transform:uppercase}
.metric .value{display:block;font-size:1.2em}`;

let serial = 0;

/** Open a themed modal dialog, or null when the panel seam is missing or refuses. */
export function openDialog(ctx: DialogContext, spec: { readonly id: string; readonly label: string; readonly className?: string; readonly css?: string }): Dialog | null {
  const ui = ctx.ui;
  if (!ui?.openPanel) return null;
  let panel: ReturnType<PanelSeam["openPanel"]>;
  serial += 1;
  try {
    // The host refuses a second panel under an id that is still open, so each dialog gets its own.
    panel = ui.openPanel({ id: `${spec.id}-${serial}`, modal: true, label: spec.label });
  } catch (error) {
    ctx.log(`${spec.label}: the panel could not open (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
  const root = panel.root;
  applyTheme(root, themeFromPrefs(ctx.prefs?.get()));
  const style = root.ownerDocument.createElement("style");
  style.textContent = `${DIALOG_CSS}${spec.css ?? ""}`;
  root.appendChild(style);
  const body = root.ownerDocument.createElement("section");
  body.className = `dialog${spec.className ? ` ${spec.className}` : ""}`;
  body.setAttribute("role", "dialog");
  body.setAttribute("aria-label", spec.label);
  root.appendChild(body);
  const stopTheme = onThemeChange((theme) => applyTheme(root, theme));
  let open = true;
  let byPlayer = false;
  void panel.closed.then(() => {
    if (open) byPlayer = true;
    open = false;
    stopTheme();
  });
  return {
    root, body, closed: panel.closed,
    dismissedByPlayer: () => byPlayer,
    isOpen: () => open,
    close: () => {
      if (!open) return;
      open = false;
      stopTheme();
      panel.close();
    },
  };
}

/** Append a child element, with text when given. */
export function el<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== undefined) child.textContent = text;
  if (className) child.className = className;
  parent.appendChild(child);
  return child;
}

export function button(parent: Element, label: string, onClick: () => void, focusKey?: string): HTMLButtonElement {
  const node = el(parent, "button", label);
  node.type = "button";
  if (focusKey) node.dataset["focus"] = focusKey;
  node.addEventListener("click", () => { if (!node.disabled) onClick(); });
  return node;
}

/** The element holding the keyboard inside this element's shadow root, if any. */
export function activeIn(node: Element): HTMLElement | null {
  const root = node.getRootNode() as ShadowRoot | Document;
  return (root.activeElement as HTMLElement | null) ?? null;
}

/**
 * Move focus through `items` with the arrow keys. Returns the new index, or null
 * when the key is not a step key or there is nothing to move to.
 */
export function stepFocus(items: readonly HTMLElement[], current: HTMLElement | null, key: string, axis: "vertical" | "horizontal" | "both" = "vertical"): number | null {
  const forward = axis === "horizontal" ? ["ArrowRight"] : axis === "vertical" ? ["ArrowDown"] : ["ArrowDown", "ArrowRight"];
  const back = axis === "horizontal" ? ["ArrowLeft"] : axis === "vertical" ? ["ArrowUp"] : ["ArrowUp", "ArrowLeft"];
  const ends = key === "Home" ? 0 : key === "End" ? items.length - 1 : null;
  if (!forward.includes(key) && !back.includes(key) && ends === null) return null;
  if (!items.length) return null;
  const at = current ? items.indexOf(current) : -1;
  const next = ends !== null ? ends : at < 0 ? 0 : forward.includes(key) ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
  items[next]?.focus();
  return next;
}

/** A labelled figure: the metric boxes the post-mortem and the profile use. */
export function metric(parent: Element, label: string, value: string, tooltip?: string): HTMLElement {
  const box = el(parent, "div", undefined, "metric");
  el(box, "span", label, "label");
  el(box, "span", value, "value");
  if (tooltip) box.title = tooltip;
  return box;
}

/** Local date and time as YYYY-MM-DD HH:MM, or "Unknown" for a missing stamp. */
export function formatWhen(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Unknown";
  const date = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Case-insensitive substring test, as upstream's search boxes use (client.cpp:67). */
export function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}
