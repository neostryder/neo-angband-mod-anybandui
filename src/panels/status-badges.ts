import type { StatusPayload, ViewModel } from "../view-model/protocol.js";
import { node } from "./panel-host.js";
import type { InputDriver } from "../seams.js";

const colours = { harm: "#ff7559", mixed: "#ffc259", benefit: "#66e0b3", neutral: "#8cbfff", study: "#8cbfff" } as const;
const kinds = { harm: "Harmful effect", mixed: "Benefits and drawbacks", benefit: "Beneficial effect", neutral: "Active effect", study: "Learning available" } as const;

export function renderStatusBadges(mount: HTMLElement, model: ViewModel): void {
  mount.replaceChildren();
  const statuses: StatusPayload[] = model.player.statuses.filter((item) => item.visible !== false && item.label !== "FOOD");
  statuses.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
  if (model.player.study && model.player.study > 0) statuses.push({ label: "Study", name: "Study", visible: true, priority: undefined, kind: "study", duration: model.player.study, description: undefined });
  if (!statuses.length) return;
  node(mount, "div", "heading", "Status effects");
  const wrap = node(mount, "div", "badges");
  for (const effect of statuses) {
    const kind = effect.kind ?? "neutral";
    const name = effect.name || effect.label || "Effect";
    const badge = node(wrap, "span", "badge", kind === "study" && effect.duration !== undefined ? `${name} - ${effect.duration}` : name);
    badge.style.color = colours[kind];
    badge.style.backgroundColor = `${colours[kind]}29`;
    const lines = [effect.duration === undefined ? name : `${name} (${effect.duration})`, kinds[kind]];
    if (effect.description) lines.push("---------", effect.description);
    badge.dataset.tip = lines.join("\n");
  }
}

/* A controller is named by its owner id: a mod id, or "core:<id>" for an agent
 * bundled with the game. Ids are internal, so only known controllers get their
 * own name and anything else is called an autoplayer. */
const DRIVER_NAMES: Readonly<Record<string, string>> = { borg: "Borg", squire: "Squire", "core:demo-wanderer": "Demo wanderer" };
const driverColour = "#f5bc5a";

export function driverName(owner: string): string {
  return DRIVER_NAMES[owner] ?? "Autoplayer";
}

/**
 * The badge naming whoever holds input when it is not the player. The panels
 * around it keep redrawing from live state, so the sidebar and status panel
 * work as a spectator view while a controller plays.
 */
export function renderDriverBadge(mount: HTMLElement, driver: InputDriver): void {
  mount.replaceChildren();
  if (driver.kind !== "controller") return;
  const name = driverName(driver.owner);
  const label = driver.label?.trim();
  const reason = driver.reason?.trim();
  const wrap = node(mount, "div", "badges");
  const badge = node(wrap, "span", "badge driver", label ? `${name}: ${label}` : `${name} is playing`);
  badge.style.color = driverColour;
  badge.style.backgroundColor = `${driverColour}29`;
  const lines = [`${name} is playing.`];
  if (label) lines.push(label);
  if (reason) lines.push(reason);
  lines.push("Map clicks and panel buttons do nothing until it stops.");
  badge.dataset.tip = lines.join("\n");
}
