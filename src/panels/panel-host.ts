import type { HudFrame, HudSection } from "@rpgm-tools/neo-angband-mod-sdk";
import { applyTheme } from "../theme.js";
import type { ThemeTokens } from "../theme.js";
import type { ViewModel } from "../view-model/protocol.js";

export type PanelRender = (mount: HTMLElement, model: ViewModel) => void;

/** Places the overlay host over its HUD region. A host pane sizes its own slot, so
 * character-pane.ts pairs PANEL_CSS with a :host rule of its own instead. */
const HOST_CSS = `:host{position:fixed;display:none;z-index:50;box-sizing:border-box;color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}`;

/** How a card looks inside its surface, shared by the overlay and the host pane. */
export const PANEL_CSS = `
*{box-sizing:border-box}.surface{width:100%;height:100%;overflow:auto;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);padding:5px}
.group{min-height:0;overflow:auto}.heading{color:var(--anyband-accent);font-weight:700;border-bottom:1px solid var(--anyband-accent);margin:0 0 4px;padding-bottom:2px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.metric{text-align:center;border:1px solid var(--anyband-accent);border-radius:3px;padding:2px;min-width:0}.metric b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{height:6px;background:var(--anyband-background);border:1px solid var(--anyband-accent);margin-top:2px}.fill{height:100%}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));text-align:center}.drained{opacity:.55}
.badges{display:flex;flex-wrap:wrap;gap:4px}.badge{border:1px solid currentColor;border-left-width:2px;padding:2px 5px;border-radius:3px}
.muted{opacity:.55}.messages{overflow:auto;max-height:min(24em,50vh)}.message{white-space:pre-wrap}.message .body{white-space:inherit}.ribbon{color:#f5bc5a;border:1px solid #f5bc5a;padding:2px 5px;pointer-events:none}
.messages-filter{width:100%;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent)}
.pause{display:inline-flex;align-items:flex-end;gap:2px;height:1em;vertical-align:middle}.pause i,.pause b{display:inline-block;background:currentColor;font-style:normal;font-weight:normal}
.pause i{width:.13em;height:.7em}.pause b{width:.16em;height:.16em;border-radius:50%;animation:anyband-breathe 1.1s ease-in-out infinite}
.pause b:nth-child(4){animation-delay:.15s}.pause b:nth-child(5){animation-delay:.3s}
@keyframes anyband-breathe{0%,100%{opacity:.35}50%{opacity:1}}
.pause.still b{animation:none;opacity:.8}@media (prefers-reduced-motion:reduce){.pause b{animation:none;opacity:.8}}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cut{flex:none;margin-left:.25em}
.tip{display:none;position:absolute;z-index:2;max-width:26em;white-space:pre-wrap;pointer-events:none;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent);border-radius:3px;padding:6px}
input{width:100%;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent)}
.compact{display:flex;align-items:center;gap:10px;overflow:hidden;white-space:nowrap;padding:0 5px}.compact .group{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden}.compact .group:empty{display:none}
.compact .heading,.compact input,.compact .messages-filter{display:none}.compact .badges{flex-wrap:nowrap}.compact .badge{padding:0 4px}.compact .grid,.compact .metric-grid{display:flex;gap:8px}
.compact .metric{border:0;padding:0;display:flex;gap:3px}.compact .metric b{display:inline}.compact .messages{overflow:hidden;max-height:none;min-width:0}
.compact .message{display:flex;align-items:baseline;overflow:hidden;white-space:nowrap;min-width:0}.compact .message .body{overflow:hidden;white-space:nowrap;min-width:0;flex:1}
.compact .message~.message{display:none}.compact .ribbon{width:auto!important;flex:none}
`;

/** A HUD region this short is one line, so its groups sit side by side without headings. */
const COMPACT_ROWS = 3;
const CSS = `${HOST_CSS}${PANEL_CSS}`;

const panelHosts = new Set<HTMLElement>();
let panelVisualFilter: string | null = null;

/** The older display seam filters the terminal canvas only, so cover our HTML hosts here. */
export function setPanelHostVisualFilter(filter: string | null): void {
  panelVisualFilter = filter;
  for (const host of panelHosts) host.style.filter = filter ?? "";
}

export function node(parent: HTMLElement, tag: string, className = "", value?: string): HTMLElement {
  const child = parent.ownerDocument.createElement(tag);
  child.className = className;
  if (value !== undefined) child.textContent = value;
  parent.appendChild(child);
  return child;
}

export function fraction(current: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
}

export function meter(parent: HTMLElement, label: string, value: string, amount: number, colour: string, tip?: string): void {
  const cell = node(parent, "div", "meter");
  node(cell, "span", "", label);
  node(cell, "span", "", ` ${value}`);
  const track = node(cell, "div", "bar");
  const fill = node(track, "div", "fill");
  fill.style.width = `${Math.round(amount * 100)}%`;
  fill.style.backgroundColor = colour;
  if (tip) cell.dataset.tip = tip;
}

function intersects(a: { col: number; row: number; cols: number; rows: number }, b: typeof a): boolean {
  return a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
}

export interface PanelSpec { readonly key: string; readonly render: PanelRender; readonly select: (model: ViewModel) => unknown }

/** Fill a surface with one group per panel and a shared tooltip. render() redraws
 * only the panels whose selected data or compact layout changed since the last call. */
export function createPanelContent(surface: HTMLElement, panels: readonly PanelSpec[]): { render(model: ViewModel): void } {
  const mounts = panels.map(() => node(surface, "div", "group"));
  const tip = node(surface, "div", "tip");
  const signatures: string[] = [];
  surface.addEventListener("mouseover", (event) => {
    const target = event.target;
    const subject = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-tip]") : null;
    tip.textContent = subject?.dataset.tip ?? "";
    tip.style.display = subject ? "block" : "none";
    if (subject) { tip.style.left = `${Math.min(subject.offsetLeft, Math.max(0, surface.clientWidth - tip.offsetWidth))}px`; tip.style.top = `${Math.min(subject.offsetTop + subject.offsetHeight, Math.max(0, surface.clientHeight - tip.offsetHeight))}px`; }
  });
  surface.addEventListener("mouseleave", () => { tip.style.display = "none"; });
  return {
    render(model) {
      panels.forEach((panel, index) => {
        // A switch to or from one line redraws too: a compact panel draws differently.
        const signature = JSON.stringify([surface.className, panel.select(model)]);
        if (signatures[index] === signature) return;
        signatures[index] = signature;
        panel.render(mounts[index]!, model);
      });
    },
  };
}

export function createPanelHost(doc: Document, panels: readonly PanelSpec[], theme?: Readonly<ThemeTokens>): {
  present(section: HudSection, frame: HudFrame, model: ViewModel): void;
  element: HTMLElement;
} {
  const element = doc.createElement("div");
  element.className = "anyband-panel";
  panelHosts.add(element);
  element.style.filter = panelVisualFilter ?? "";
  const shadow = element.attachShadow({ mode: "open" });
  if (theme) applyTheme(shadow, theme);
  else applyTheme(shadow);
  node(shadow as unknown as HTMLElement, "style", "", CSS);
  const surface = node(shadow as unknown as HTMLElement, "div", "surface");
  const content = createPanelContent(surface, panels);
  doc.body.appendChild(element);
  return {
    element,
    present(section, frame, model) {
      const region = section.region;
      const box = region?.pixels;
      const at = frame.stack?.findIndex((item) => item.id === region?.name) ?? -1;
      // A later live region owns the pixels while it overlaps this HUD region.
      const covered = at >= 0 && frame.stack!.slice(at + 1).some((item) => intersects(item.cells, region!.cells));
      if (!box || box.width <= 0 || box.height <= 0 || covered || (frame.stack && at < 0)) {
        element.style.display = "none";
        return;
      }
      element.style.display = "block";
      element.style.left = `${box.x}px`;
      element.style.top = `${box.y}px`;
      element.style.width = `${box.width}px`;
      element.style.height = `${box.height}px`;
      surface.className = region!.cells.rows < COMPACT_ROWS ? "surface compact" : "surface";
      content.render(model);
    },
  };
}
