import type { ViewModel } from "../view-model/protocol.js";
import { fraction, meter, node } from "./panel-host.js";

const expanded = new WeakMap<HTMLElement, Map<string, boolean>>();
const words = (code: string): string => code.toLowerCase().replaceAll("_", " ").replace(/\b(elec|pois|conf|disen)\b/g,
  (word) => ({ elec: "lightning", pois: "poison", conf: "confusion", disen: "disenchantment" })[word]!);
const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function spellName(code: string): string {
  const name = words(code.slice(code.indexOf("_") + 1));
  if (code.startsWith("BR_")) return `Breathe ${name}`;
  if (code.startsWith("BO_")) return `${sentence(name)} bolt`;
  if (code.startsWith("BA_")) return `${sentence(name)} ball`;
  if (code.startsWith("S_")) return `Summon ${name}`;
  return sentence(words(code));
}

export function renderTrackedCreature(mount: HTMLElement, model: ViewModel): void {
  let state = expanded.get(mount);
  if (!state) { state = new Map(); expanded.set(mount, state); }
  const root = mount.getRootNode?.() as Document | ShadowRoot | undefined;
  const focus = (root?.activeElement as HTMLElement | null)?.dataset?.["recallSection"];
  const section = (title: string, lines: readonly string[], open = false): void => {
    if (!lines.length) return;
    const details = node(mount, "details", "creature-section") as HTMLDetailsElement;
    details.open = state.get(title) ?? open;
    const summary = node(details, "summary", "", title);
    summary.dataset["recallSection"] = title;
    details.addEventListener("toggle", () => state.set(title, details.open));
    const body = node(details, "div", "creature-facts");
    body.tabIndex = 0;
    body.dataset["recallSection"] = `${title} details`;
    body.setAttribute("role", "region");
    body.setAttribute("aria-label", `${title} details`);
    for (const line of lines) node(body, "div", "", line);
    if (focus === title) summary.focus();
    if (focus === `${title} details`) body.focus();
  };
  mount.replaceChildren();
  node(mount, "div", "heading", "Tracked creature");
  const target = model.player.tracked_creature;
  if (!target) {
    node(mount, "div", "muted", "No creature tracked");
    meter(mount, "HP", "-- / --", 0, "#8f5e1f");
    return;
  }
  const known = target.known;
  const name = node(mount, "div", "creature-name");
  if (known?.glyph) node(name, "span", "creature-glyph", `${known.glyph} `).setAttribute("aria-hidden", "true");
  node(name, "span", "", target.name).dataset.tip = target.name;
  if (!target.visible) node(mount, "div", "", "Out of sight");
  if (known?.look) node(mount, "div", "", sentence(known.look.split(",")[0]!));
  if (known?.status.length) {
    const marks = node(mount, "div", "badges");
    for (const status of known.status) node(marks, "span", "badge", sentence(status));
  }
  if (target.hp !== undefined && target.max_hp !== undefined) {
    meter(mount, "HP", `${Math.max(0, target.hp)} / ${target.max_hp}`, fraction(target.hp, target.max_hp), "#8f5e1f");
  }
  if (known) {
    section("Melee", known.blows.map((blow) => {
      const damage = blow.damage;
      const dice = damage ? [damage.dice && damage.sides ? `${damage.dice}d${damage.sides}` : "",
        damage.base || "", damage.mBonus ? `M${damage.mBonus}` : ""].filter(Boolean).join("+").replace("+-", "-") : "";
      return `${sentence(words(blow.method))}${blow.effect ? ` - ${words(blow.effect)}` : ""}${dice ? ` (${dice})` : ""}`;
    }), true);
    const spells = known.knownSpells.map(spellName);
    if (spells.length) {
      for (const [label, frequency] of [["Spell frequency", known.spellFrequency], ["Innate frequency", known.innateFrequency]] as const) {
        if (frequency) spells.push(`${label}: ${frequency.exact ? "" : "about "}${frequency.percent}%`);
      }
    }
    section("Spells seen", spells, true);
    section("Resistances", known.knownFlags.filter((flag) => /^(IM_|RES_|NO_)/.test(flag)).map((flag) => sentence(words(flag.replace(/^(IM_|RES_|NO_)/, "")))));
    section("Vulnerabilities", known.knownFlags.filter((flag) => flag.startsWith("HURT_")).map((flag) => sentence(words(flag.slice(5)))));
    section("Known traits", known.knownFlags.filter((flag) => !/^(IM_|RES_|NO_|HURT_)/.test(flag)).map((flag) => sentence(words(flag))));
  }
  if (target.recall) section("Recall", [target.recall.split("\n").slice(1).join("\n").trim()].filter(Boolean));
}
