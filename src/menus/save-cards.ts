/**
 * The main menu's save roster as profile cards (upstream character_select.h),
 * answering Core's character picker (`core:character-select`).
 *
 * Every action goes through `ctx.saves`: Continue loads, Play Again and New
 * character create, Rename renames, Delete deletes. Export, Import and Storage
 * stay the host's own pages, reached by answering the picker with the command
 * key it offers. Escape answers the picker with a cancel, which steps back to
 * the title exactly as it does in Core's picker.
 *
 * Deleting asks twice. This mod's Delete save dialog asks first, and the
 * host's delete seam then shows its own confirmation, which a mod cannot
 * answer (MOD_SEAMS 4m). The roster closes while the host asks, so the host's
 * question gets the keyboard, and opens again with the result.
 */
import type { MenuAnswer, MenuPresenter, MenuQuestion } from "@rpgm-tools/neo-angband-mod-sdk";
import type { SaveEntry, SaveListResult, SaveResult } from "@rpgm-tools/neo-angband-core";
import { themeFromPrefs } from "../settings.js";
import { button, el, formatWhen, matches, metric, openDialog, stepFocus, type Dialog, type DialogContext } from "./dialog.js";
import { askRename, confirmDeleteSave } from "./save-dialogs.js";

export const CHARACTER_SELECT_ID = "core:character-select";

export interface SavesSeam {
  list(): Promise<SaveListResult>;
  load(id: string): Promise<SaveResult>;
  rename(id: string, name: string): Promise<SaveResult>;
  delete(id: string): Promise<SaveResult>;
  create?(options?: { readonly like?: { readonly race: string; readonly cls: string; readonly name?: string; readonly stats?: readonly number[] } }): Promise<SaveResult>;
}

export interface SaveCardsContext extends DialogContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly saves?: SavesSeam | undefined;
  /** Opens the graveyard over the roster; present while the graveyard is on. */
  readonly graveyard?: (() => Promise<void>) | undefined;
}

/** HSV to RGB as Dear ImGui's ColorConvertHSVtoRGB computes it. */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  if (s === 0) return [v, v, v];
  const scaled = (h % 1) / (60 / 360);
  const i = Math.floor(scaled), f = scaled - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/**
 * A save's own colour (character_select.h:6-22): an FNV-1a hash of the save id,
 * mixed, picks the hue; saturation and value are those of upstream's muted
 * green, darkened on light themes.
 */
export function accentColour(id: string, light: boolean): string {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(id)) { hash ^= byte; hash = Math.imul(hash, 16777619) >>> 0; }
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d) >>> 0; hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0; hash ^= hash >>> 16; hash >>>= 0;
  const hue = (hash & 0x00ffffff) / 16777216;
  const scale = light ? 0.52 : 1;
  const channels = hsvToRgb(hue, 55 / 183, 183 / 255).map((value) => Math.round(Math.min(1, Math.max(0, value * scale)) * 255));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** The card's status line, character_select.h:137-138. */
export function statusLine(entry: Pick<SaveEntry, "dead" | "depth" | "level">): string {
  const where = entry.dead ? "DEAD" : entry.depth === 0 ? "IN TOWN" : `DEPTH ${entry.depth}`;
  return `${where}    /    LEVEL ${entry.level}`;
}

export function identity(entry: Pick<SaveEntry, "race" | "cls">): string {
  return `${entry.race} ${entry.cls}`.trim();
}

const CSS = `.roster{display:grid;grid-template-columns:minmax(220px,.42fr) minmax(260px,.58fr);gap:12px}
@media (max-width:640px){.roster{grid-template-columns:1fr}}
.cards{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto;margin:6px 0}
.card{display:grid;grid-template-columns:2.4em 1fr;align-items:center;text-align:left;padding:6px 8px;border-radius:4px;background:var(--anyband-background)}
.card .at{font-size:1.8em;text-align:center}
.card .who{font-size:1.15em;display:block}
.card .identity{display:block;opacity:.65}
.card .status{display:block;font-size:.85em;letter-spacing:.04em}
.roster-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.roster-actions button{padding:10px 6px}
.profile .emblem{font-size:3em;line-height:1.2}
.profile .who{font-size:1.8em;margin:0}
.label{opacity:.65;font-size:.85em;text-transform:uppercase;margin-top:8px}
.primary{width:100%;padding:8px;margin-top:10px}
.search{width:100%;box-sizing:border-box}`;

/** The picker part, or null with the switch off so Core keeps its own picker. */
export function saveCardsPart(ctx: SaveCardsContext): MenuPresenter | null {
  if (ctx.flags?.["anybandui.saveCards"] !== true) return null;
  return {
    ask(question) {
      if (question.id !== CHARACTER_SELECT_ID || !ctx.saves || !ctx.ui?.openPanel) return undefined;
      return runRoster(ctx, ctx.saves, question);
    },
  };
}

async function runRoster(ctx: SaveCardsContext, saves: SavesSeam, question: MenuQuestion): Promise<MenuAnswer | undefined> {
  let listed: SaveListResult;
  try { listed = await saves.list(); } catch { return undefined; }
  if (!listed.ok) { ctx.log(`save cards: ${listed.reason}`); return undefined; }
  // The picker's rows are the roster at the moment it asked, in this order (saves-facade lists the same roster).
  const questionIds = listed.entries.map((entry) => entry.id);
  const commands = new Set(question.commands.filter((command) => !command.ctrl).map((command) => command.key));
  const light = themeFromPrefs(ctx.prefs?.get()).light_styling;
  let entries: readonly SaveEntry[] = listed.entries;
  let selected: string | null = entries[0]?.id ?? null;
  let search = "";
  let status = "";
  let busy = false;
  let dialog: Dialog | null = null;

  return new Promise<MenuAnswer | undefined>((resolve) => {
    let settled = false;
    const answer = (value: MenuAnswer | undefined): void => {
      if (settled) return;
      settled = true;
      dialog?.close();
      resolve(value);
    };
    const refresh = async (): Promise<void> => {
      try {
        const next = await saves.list();
        if (next.ok) entries = next.entries;
      } catch { /* keep the last roster */ }
      if (!entries.some((entry) => entry.id === selected)) selected = entries[0]?.id ?? null;
    };
    const chosen = (): SaveEntry | undefined => entries.find((entry) => entry.id === selected);
    const run = async (work: () => Promise<void>): Promise<void> => {
      if (busy) return;
      busy = true;
      draw();
      try { await work(); } finally { busy = false; if (dialog?.isOpen()) draw(); }
    };
    const report = (result: SaveResult, done: string): void => { status = result.ok ? done : result.reason; };

    const play = (entry: SaveEntry): void => {
      if (entry.dead) {
        if (!saves.create) return;
        const create = saves.create.bind(saves);
        void run(async () => {
          status = "Starting a new character...";
          const result = await create({ like: { race: entry.race, cls: entry.cls, name: entry.name } });
          if (!result.ok) status = result.reason;
        });
        return;
      }
      void run(async () => {
        status = "Loading...";
        const result = await saves.load(entry.id);
        if (!result.ok) status = result.reason;
      });
    };
    const newCharacter = (): void => {
      if (!saves.create) {
        const row = question.choices[question.choices.length - 1];
        if (row) answer({ kind: "choose", choice: row.id });
        return;
      }
      const create = saves.create.bind(saves);
      void run(async () => {
        status = "Starting a new character...";
        const result = await create();
        if (!result.ok) status = result.reason;
      });
    };
    const rename = (entry: SaveEntry): void => {
      void run(async () => {
        const name = await askRename(ctx, entry.name);
        if (name === null || name === entry.name) return;
        report(await saves.rename(entry.id, name), `Renamed to ${name}.`);
        await refresh();
      }).then(() => focus("rename"));
    };
    const remove = (entry: SaveEntry): void => {
      void run(async () => {
        const who = entry.name || "this character";
        if (!(await confirmDeleteSave(ctx, who))) return;
        // The host asks again on the game screen; the roster steps aside so that question has the keyboard.
        dialog?.close();
        const result = await saves.delete(entry.id);
        report(result, `${who} was deleted.`);
        await refresh();
        if (!open()) answer({ kind: "cancel" });
      }).then(() => focus(selected ? `card-${selected}` : "new"));
    };
    const graveyard = (): void => {
      const show = ctx.graveyard;
      if (!show) return;
      void run(show).then(() => focus("graveyard"));
    };
    const command = (key: string, cursor: number): void => answer({ kind: "command", key, cursor });

    const focus = (key: string): void => {
      const target = dialog?.body.querySelector(`[data-focus="${key}"]`) as HTMLElement | null | undefined;
      target?.focus();
    };

    let cards: HTMLElement | null = null;
    let profile: HTMLElement | null = null;
    let statusLineNode: HTMLElement | null = null;
    let extras: HTMLElement | null = null;
    let cardButtons: HTMLButtonElement[] = [];

    const drawCards = (): void => {
      if (!cards) return;
      cards.replaceChildren();
      cardButtons = [];
      const shown = entries.filter((entry) => matches(`${entry.name} ${entry.id} ${identity(entry)}`, search));
      if (!shown.length) { el(cards, "p", "No matching characters.", "muted"); return; }
      for (const entry of shown) {
        const ink = accentColour(entry.id, light);
        const card = button(cards, "", () => { selected = entry.id; draw(); focus(`card-${entry.id}`); }, `card-${entry.id}`);
        card.className = "card";
        card.style.borderColor = entry.id === selected ? ink : "";
        card.setAttribute("aria-pressed", String(entry.id === selected));
        card.setAttribute("aria-label", `${entry.name}, ${identity(entry)}, ${statusLine(entry).replace(/\s+\/\s+/, ", ").toLowerCase()}`);
        const at = el(card, "span", "@", "at");
        at.style.color = ink;
        const text = el(card, "span");
        el(text, "span", entry.name || "Unnamed", "who");
        el(text, "span", identity(entry), "identity");
        el(text, "span", statusLine(entry), "status").style.color = ink;
        cardButtons.push(card);
      }
    };

    const drawProfile = (): void => {
      if (!profile) return;
      profile.replaceChildren();
      const entry = chosen();
      if (!entry) return;
      const ink = accentColour(entry.id, light);
      el(profile, "div", "@", "emblem").style.color = ink;
      el(profile, "p", entry.name || "Unnamed", "who");
      el(profile, "p", identity(entry) || "Character details unavailable.");
      el(profile, "h3", entry.dead ? "Final character" : "Character summary");
      const metrics = el(profile, "div", undefined, "metrics");
      metric(metrics, "Level", String(entry.level));
      metric(metrics, "Depth", entry.depth === 0 ? "Town" : String(entry.depth));
      el(profile, "div", "LAST SAVED", "label");
      el(profile, "p", formatWhen(entry.lastPlayed));
      const primary = button(profile, entry.dead ? "Play Again" : "Continue", () => play(entry), "primary");
      primary.className = "primary";
      primary.disabled = busy || (entry.dead && !saves.create);
      const row = el(profile, "div", undefined, "actions");
      const renameButton = button(row, "Rename", () => rename(entry), "rename");
      // The rename seam refuses a dead character's save.
      renameButton.disabled = busy || entry.dead;
      button(row, "Delete", () => remove(entry), "delete").disabled = busy;
    };

    const drawExtras = (): void => {
      if (!extras) return;
      extras.replaceChildren();
      const entry = chosen();
      const cursor = entry ? questionIds.indexOf(entry.id) : -1;
      if (commands.has("X")) {
        const exportButton = button(extras, "Export character", () => command("X", cursor), "export");
        // Export works on a living character the picker was showing when it asked.
        exportButton.disabled = busy || !entry || entry.dead || cursor < 0;
      }
      if (commands.has("M")) button(extras, "Import character", () => command("M", Math.max(0, Math.min(cursor, questionIds.length))), "import").disabled = busy;
      if (commands.has("W")) button(extras, "Storage", () => command("W", Math.max(0, Math.min(cursor, questionIds.length))), "storage").disabled = busy;
    };

    function draw(): void {
      drawCards();
      drawProfile();
      drawExtras();
      if (statusLineNode) statusLineNode.textContent = status;
    }

    function build(target: Dialog): void {
      const body = target.body;
      el(body, "h2", question.title || "Select a character");
      if (question.subtitle) el(body, "p", question.subtitle, "muted");
      const layout = el(body, "div", undefined, "roster");
      const left = el(layout, "div");
      if (entries.length) {
        const input = el(left, "input", undefined, "search");
        input.type = "search";
        input.placeholder = "Find a character";
        input.setAttribute("aria-label", "Find a character");
        input.dataset["focus"] = "search";
        input.value = search;
        input.addEventListener("input", () => { search = input.value; drawCards(); });
        input.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown" && cardButtons.length) { event.preventDefault(); cardButtons[0]!.focus(); }
        });
      }
      cards = el(left, "div", undefined, "cards");
      if (!entries.length) el(left, "p", "No saved characters.", "muted");
      cards.addEventListener("keydown", (event) => {
        const at = cardButtons.indexOf(target.root.activeElement as HTMLButtonElement);
        if (event.key === "Enter" && at >= 0) {
          event.preventDefault();
          const entry = entries.find((candidate) => `card-${candidate.id}` === cardButtons[at]!.dataset["focus"]);
          if (entry && !busy) { selected = entry.id; play(entry); }
          return;
        }
        if (event.key === "Delete" && at >= 0) {
          event.preventDefault();
          const entry = chosen();
          if (entry) remove(entry);
          return;
        }
        const next = stepFocus(cardButtons, target.root.activeElement as HTMLElement | null, event.key);
        if (next === null) return;
        event.preventDefault();
        const id = cardButtons[next]?.dataset["focus"]?.slice(5);
        if (id) { selected = id; draw(); focus(`card-${id}`); }
      });
      const rosterActions = el(left, "div", undefined, "roster-actions");
      if (ctx.graveyard) button(rosterActions, "Graveyard", graveyard, "graveyard");
      button(rosterActions, "New character", newCharacter, "new");
      profile = el(layout, "div", undefined, "profile");
      extras = el(body, "div", undefined, "actions");
      statusLineNode = el(body, "p", "", "muted");
      statusLineNode.setAttribute("role", "status");
      draw();
    }

    function open(): boolean {
      const next = openDialog(ctx, { id: "character-select", label: "Select a character", className: "wide", css: CSS });
      dialog = next;
      if (!next) return false;
      void next.closed.then(() => { if (next.dismissedByPlayer()) answer({ kind: "cancel" }); });
      build(next);
      return true;
    }

    // A roster that cannot open hands the picker back to Core.
    if (!open()) { settled = true; resolve(undefined); return; }
    focus(selected ? `card-${selected}` : "new");
  });
}
