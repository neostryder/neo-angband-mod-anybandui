import type { MessagePayload, ViewModel } from "../view-model/protocol.js";
import { node } from "./panel-host.js";

const ink = { system: "#64a0b5b4", combat: "#c88f5fb4", loot: "#b1a962b4", other: "#5b8a71a0" } as const;

/* Message type numbers from the engine's list-message.h (MSG). A published
 * group or the system flag wins over these. SPELL and PRAYER stay Other:
 * the engine log has no system flag of its own. */
const COMBAT_TYPES = new Set<number>([
  2, 3, 4, 6, 11,
  34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
  85,
  92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
  139, 140, 141, 142, 143, 144, 145, 148, 149,
]);
const LOOT_TYPES = new Set<number>([5, 33, 82, 83, 84]);
const KINDS = new Set(["combat", "loot", "system", "other"]);
/* No System choice: the core log carries no system flag or group (adapter
 * GAPS), and most system lines share GENERIC with everything else. A line a
 * host does flag as system keeps its ink and files under Other. */
const FILTERS = [["all", "All"], ["combat", "Combat"], ["loot", "Loot"], ["other", "Other"]] as const;

export type MessageKind = "combat" | "loot" | "system" | "other";

export function messageKind(message: Pick<MessagePayload, "system" | "group" | "category">): MessageKind {
  if (message.system === true) return "system";
  if (message.group && KINDS.has(message.group)) return message.group as MessageKind;
  if (message.category !== undefined && COMBAT_TYPES.has(message.category)) return "combat";
  if (message.category !== undefined && LOOT_TYPES.has(message.category)) return "loot";
  return "other";
}

export function messageLine(message: Pick<MessagePayload, "text" | "count">): string {
  const count = message.count ?? 1;
  return count > 1 ? `${message.text} (x${count})` : message.text;
}

/** True when the line's text is wider than the cell it is drawn in. */
export function lineIsCut(node: { readonly scrollWidth: number; readonly clientWidth: number }): boolean {
  return node.clientWidth > 0 && node.scrollWidth > node.clientWidth;
}

function childWithClass(parent: Element, className: string): HTMLElement | null {
  const children = parent.children as unknown as ArrayLike<Element>;
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (child && child.className === className) return child as HTMLElement;
  }
  return null;
}

/** Adds or removes the three-dot cue after layout, when a row is wider than its cell. */
export function refreshLineCues(list: HTMLElement): void {
  const children = list.children as unknown as ArrayLike<Element>;
  for (let index = 0; index < children.length; index++) {
    const row = children[index];
    if (!row || row.className !== "message") continue;
    const body = childWithClass(row, "body");
    if (!body) continue;
    const cue = childWithClass(row, "cut");
    if (lineIsCut(body)) {
      if (!cue) {
        const mark = node(row as HTMLElement, "span", "cut", "...");
        mark.setAttribute("aria-hidden", "true");
      }
    } else if (cue) cue.remove();
  }
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** Two bars and three dots. The words stay in the tree for a screen reader. */
export function appendPauseEmblem(parent: HTMLElement, label: string): void {
  const mark = node(parent, "span", prefersReducedMotion() ? "pause still" : "pause");
  mark.setAttribute("aria-hidden", "true");
  node(mark, "i");
  node(mark, "i");
  node(mark, "b");
  node(mark, "b");
  node(mark, "b");
  node(parent, "span", "sr", label);
}

export interface MessageLogOptions {
  /** Answers the -more- pause; returns false when the game did not take it. */
  readonly acknowledge?: () => boolean;
}

export function renderMessageLog(mount: HTMLElement, model: ViewModel, options: MessageLogOptions = {}): void {
  // The input belongs to the panel, so preserve its value across new snapshots.
  const previous = mount.querySelector<HTMLInputElement>("input")?.value ?? "";
  const previousFilter = mount.querySelector<HTMLSelectElement>("select")?.value || "all";
  mount.replaceChildren();
  const heading = node(mount, "div", "heading", "Messages");
  if (model.message_pending === true) {
    heading.style.color = "#ffba4d";
    const acknowledge = options.acknowledge;
    if (acknowledge) {
      /* The ribbon doubles as the key that dismisses the pause. The shared
       * ribbon style ignores the pointer, so this one opts back in. A refused
       * reply (the pause already ended, or another controller drives) leaves
       * the button disabled until the next snapshot redraws the log. */
      const ribbon = node(mount, "button", "ribbon") as HTMLButtonElement;
      ribbon.type = "button";
      ribbon.style.pointerEvents = "auto";
      ribbon.style.cursor = "pointer";
      ribbon.style.background = "transparent";
      ribbon.style.font = "inherit";
      ribbon.style.width = "100%";
      ribbon.style.textAlign = "left";
      appendPauseEmblem(ribbon, "Messages waiting");
      ribbon.addEventListener("click", () => { if (!acknowledge()) ribbon.disabled = true; });
    } else {
      const ribbon = node(mount, "div", "ribbon");
      appendPauseEmblem(ribbon, "Messages waiting");
    }
  }
  const filter = node(mount, "select", "messages-filter") as HTMLSelectElement;
  filter.setAttribute("aria-label", "Filter messages");
  for (const [value, label] of FILTERS) {
    const option = node(filter, "option", "", label) as HTMLOptionElement;
    option.value = value;
  }
  filter.value = FILTERS.some(([value]) => value === previousFilter) ? previousFilter : "all";
  const search = node(mount, "input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Search messages";
  search.setAttribute("aria-label", "Search messages");
  search.value = previous;
  const list = node(mount, "div", "messages");
  const draw = (): void => {
    list.replaceChildren();
    const match = search.value.toLocaleLowerCase();
    // A one-line region hides the filter and search, so it shows the newest
    // line unfiltered; the choices stay set for when the region is tall again.
    const compact = mount.closest(".compact") !== null;
    const selected = compact ? "all" : filter.value || "all";
    if (!model.messages.length) { node(list, "div", "muted", "No messages yet."); return; }
    for (const message of model.messages) {
      if (message.text.trim() === "") continue;
      const bucket = messageKind(message);
      if (selected !== "all" && (bucket === "system" ? "other" : bucket) !== selected) continue;
      if (!compact && !message.text.toLocaleLowerCase().includes(match)) continue;
      const row = node(list, "div", "message");
      node(row, "span", "body", messageLine(message));
      /* A host that publishes per-entry colour wins: it is the CSS colour the
       * game draws that line in (colorToCss), including message.prf changes.
       * Without it the system flag, group, or message type picks the ink. */
      row.style.color = message.color ?? ink[bucket];
    }
    refreshLineCues(list);
  };
  filter.addEventListener("change", draw);
  search.addEventListener("input", draw);
  draw();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => refreshLineCues(list));
}
