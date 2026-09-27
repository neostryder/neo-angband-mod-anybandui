import type { MessagePayload, ViewModel } from "../view-model/protocol.js";
import { node } from "./panel-host.js";

const ink = { system: "#64a0b5b4", combat: "#c88f5fb4", loot: "#b1a962b4", other: "#5b8a71a0" } as const;

export interface MessageLogOptions {
  /** Answers the -more- pause; returns false when the game did not take it. */
  readonly acknowledge?: () => boolean;
}

export function renderMessageLog(mount: HTMLElement, model: ViewModel, options: MessageLogOptions = {}): void {
  // The input belongs to the panel, so preserve its value across new snapshots.
  const previous = mount.querySelector<HTMLInputElement>("input")?.value ?? "";
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
      const ribbon = node(mount, "button", "ribbon", "Messages waiting") as HTMLButtonElement;
      ribbon.type = "button";
      ribbon.style.pointerEvents = "auto";
      ribbon.style.cursor = "pointer";
      ribbon.style.background = "transparent";
      ribbon.style.font = "inherit";
      ribbon.style.width = "100%";
      ribbon.style.textAlign = "left";
      ribbon.addEventListener("click", () => { if (!acknowledge()) ribbon.disabled = true; });
    } else node(mount, "div", "ribbon", "Messages waiting");
  }
  const search = node(mount, "input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Search messages";
  search.setAttribute("aria-label", "Search messages");
  search.value = previous;
  const list = node(mount, "div", "messages");
  const recent = model.messages.slice(0, 20);
  const draw = (): void => {
    list.replaceChildren();
    const match = search.value.toLocaleLowerCase();
    if (!recent.length) { node(list, "div", "muted", "No messages yet."); return; }
    for (const [index, message] of recent.entries()) {
      if (!message.text.toLocaleLowerCase().includes(match)) continue;
      const row = node(list, "div", "message", `${message.text}${index === 0 && (message.count ?? 1) > 1 ? ` (x${message.count})` : ""}`);
      /* A host that publishes per-entry colour wins: it is the CSS colour the
       * game draws that line in (colorToCss), including message.prf changes.
       * Without it the older system/group hints pick the ink. */
      const group: keyof typeof ink = message.system ? "system" : message.group === "combat" ? "combat" : message.group === "loot" ? "loot" : "other";
      row.style.color = message.color ?? ink[group];
    }
  };
  search.addEventListener("input", draw);
  draw();
}
