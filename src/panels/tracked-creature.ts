import type { ViewModel } from "../view-model/protocol.js";
import { recallLine } from "../hover-cards.js";
import { fraction, meter, node } from "./panel-host.js";

const traits = new Set([
  "NEVER_BLOW", "NEVER_MOVE", "RAND_25", "RAND_50", "MULTIPLY", "REGENERATE", "STUPID", "SMART", "SPIRIT", "POWERFUL",
  "INVISIBLE", "COLD_BLOOD", "EMPTY_MIND", "WEIRD_MIND", "OPEN_DOOR", "BASH_DOOR", "PASS_WALL", "KILL_WALL", "SMASH_WALL",
  "MOVE_BODY", "KILL_BODY", "TAKE_ITEM", "KILL_ITEM", "CLEAR_WEB", "PASS_WEB",
]);
const protections: Readonly<Record<string, string>> = {
  NO_FEAR: "Cannot be frightened", NO_STUN: "Cannot be stunned", NO_CONF: "Cannot be confused",
  NO_SLEEP: "Cannot be put to sleep", NO_HOLD: "Cannot be held", NO_SLOW: "Cannot be slowed",
};
interface RecallSection { details: HTMLDetailsElement; summary: HTMLElement; body: HTMLElement; signature: string }
interface RecallPanel {
  heading: HTMLElement;
  name: HTMLElement;
  sight: HTMLElement;
  condition: HTMLElement;
  sections: HTMLElement;
  entries: Map<string, RecallSection>;
}
const panels = new WeakMap<HTMLElement, RecallPanel>();
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
  let panel = panels.get(mount);
  if (!panel) {
    const heading = node(mount, "div", "heading", "Tracked creature");
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "2");
    heading.tabIndex = -1;
    const name = node(mount, "div", "creature-name");
    const sight = node(mount, "div", "muted");
    sight.setAttribute("role", "status");
    sight.setAttribute("aria-atomic", "true");
    panel = { heading, name, sight, condition: node(mount, "div", ""), sections: node(mount, "div", ""), entries: new Map() };
    panels.set(mount, panel);
  }
  const root = mount.getRootNode?.() as Document | ShadowRoot | undefined;
  const active = root?.activeElement as HTMLElement | null;
  const focus = active && mount.contains(active) ? active.dataset["recallSection"] : undefined;
  let restore: HTMLElement | undefined;
  const visibleSections: HTMLElement[] = [];
  const section = (title: string, lines: readonly string[], open = false): void => {
    if (!lines.length) return;
    let entry = panel.entries.get(title);
    if (!entry) {
      const details = node(panel.sections, "details", "creature-section") as HTMLDetailsElement;
      details.open = open;
      const summary = node(details, "summary", "", title);
      summary.dataset["recallSection"] = title;
      const body = node(details, "div", "creature-facts");
      body.tabIndex = 0;
      body.dataset["recallSection"] = `${title} details`;
      entry = { details, summary, body, signature: "" };
      panel.entries.set(title, entry);
    }
    const signature = JSON.stringify(lines);
    if (entry.signature !== signature) {
      entry.body.replaceChildren();
      for (const line of lines) node(entry.body, "div", "", line);
      entry.signature = signature;
    }
    visibleSections.push(entry.details);
    if (focus === title) restore = entry.summary;
    if (focus === `${title} details`) restore = entry.body;
  };
  const finish = (): void => {
    const children = [...panel.sections.children];
    if (children.length !== visibleSections.length || children.some((child, index) => child !== visibleSections[index])) {
      panel.sections.replaceChildren();
      for (const details of visibleSections) panel.sections.appendChild(details);
    }
    if (focus) (restore ?? panel.heading).focus();
  };
  panel.name.replaceChildren();
  panel.condition.replaceChildren();
  const target = model.player.tracked_creature;
  if (!target) {
    if (panel.sight.textContent !== "No creature tracked") panel.sight.textContent = "No creature tracked";
    meter(panel.condition, "HP", "-- / --", 0, "#8f5e1f");
    finish();
    return;
  }
  const known = target.known;
  const name = panel.name;
  if (known?.glyph) node(name, "span", "creature-glyph", `${known.glyph} `).setAttribute("aria-hidden", "true");
  node(name, "span", "", target.name);
  const sight = target.visible ? "" : "Out of sight";
  if (panel.sight.textContent !== sight) panel.sight.textContent = sight;
  if (known?.look) node(panel.condition, "div", "", sentence(known.look.split(",")[0]!));
  if (known?.status.length) {
    const marks = node(panel.condition, "div", "badges");
    for (const status of known.status) node(marks, "span", "badge", sentence(status));
  }
  if (target.hp !== undefined && target.max_hp !== undefined) {
    meter(panel.condition, "HP", `${Math.max(0, target.hp)} / ${target.max_hp}`, fraction(target.hp, target.max_hp), "#8f5e1f");
  }
  if (known) {
    section("Melee", known.blows.map((blow) => {
      const damage = blow.damage;
      const dice = damage ? [damage.dice && damage.sides ? `${damage.dice}d${damage.sides}` : "",
        damage.base || "", damage.mBonus ? `M${damage.mBonus}` : ""].filter(Boolean).join("+").replace("+-", "-") : "";
      return `${sentence(words(blow.method))}${blow.effect ? ` - ${words(blow.effect)}` : ""}${dice ? ` (${dice})` : ""}`;
    }), true);
    const spells = known.knownSpells.map(spellName);
    section("Spells seen", spells, true);
    const frequencies: string[] = [];
    for (const [label, frequency] of [["Spell frequency", known.spellFrequency], ["Innate frequency", known.innateFrequency]] as const) {
      const percent = Math.round(frequency?.percent ?? 0);
      if (frequency && percent > 0) frequencies.push(`${label}: ${frequency.exact ? "" : "about "}${percent}%`);
    }
    section("Casting frequency", frequencies, true);
    section("Resistances", known.knownFlags.filter((flag) => /^(IM_|RES_)/.test(flag)).map((flag) => sentence(words(flag.replace(/^(IM_|RES_)/, "")))));
    section("Status protections", known.knownFlags.flatMap((flag) => Object.hasOwn(protections, flag) ? [protections[flag]!] : []));
    section("Vulnerabilities", known.knownFlags.filter((flag) => flag.startsWith("HURT_")).map((flag) => sentence(words(flag.slice(5)))));
    section("Known traits", known.knownFlags.filter((flag) => traits.has(flag)).map((flag) => sentence(words(flag))));
  }
  const recall = recallLine(target.recall ? { text: target.recall } : null);
  if (recall) section("Recall", [recall]);
  finish();
}
