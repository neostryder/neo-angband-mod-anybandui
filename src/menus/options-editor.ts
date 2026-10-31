/**
 * The game options editor (AnybandUI engine_options.h). Changes stay in a draft
 * until Save, which asks first and then applies the whole change through
 * ctx.options.set, or none of it. Cancel throws the draft away. Only what the
 * seam marks writable can change: the user interface options and the three
 * number settings. Birth, cheat and score options are shown read-only.
 */
import type { ModOptions, ModOptionsChange, ModOptionsView } from "@rpgm-tools/neo-angband-core";
import type { SurfaceContext } from "../panels/surface.js";
import { CONFIRM_NO, renderConfirm, type Confirmation } from "./inline-confirm.js";
import { button, el, matches, swallow } from "./keys.js";
import { openMenuSurface } from "./menu-surface.js";

export const OPTIONS_KEY = "options-editor";

export interface OptionsContext extends SurfaceContext {
  readonly options?: Pick<ModOptions, "get"> & Partial<Pick<ModOptions, "set">> | undefined;
}

/** engine_options.h:139-161: how upstream groups the interface options. */
const GROUP_OF: Readonly<Record<string, string>> = {
  rogue_like_commands: "Input and targeting", use_old_target: "Input and targeting", mouse_movement: "Input and targeting",
  disturb_near: "Input and targeting", autoexplore_commands: "Input and targeting",
  pickup_always: "Items", pickup_inven: "Items", show_flavors: "Items",
  show_damage: "Messages", auto_more: "Messages", notify_recharge: "Messages",
  show_target: "Display", highlight_player: "Display", solid_walls: "Display", hybrid_walls: "Display",
  view_yellow_light: "Display", animate_flicker: "Display", center_player: "Display", purple_uniques: "Display",
  hp_changes_color: "Display", effective_speed: "Display",
};
const GROUPS = ["Input and targeting", "Items", "Messages", "Display", "Other"] as const;
const READ_ONLY_PAGES: readonly (readonly [string, string])[] = [["birth", "Birth options"], ["cheat", "Cheat options"], ["score", "Score options"]];

export function optionGroup(name: string): string {
  return GROUP_OF[name] ?? "Other";
}

export interface NumberSetting {
  readonly key: "hitpointWarn" | "delayFactor" | "lazymoveDelay";
  readonly label: string;
  readonly help: string;
  readonly max: number;
  readonly scale: number;
  readonly unit: string;
}

/** engine_options.h:193-197, in the units ctx.options documents. */
export const NUMBER_SETTINGS: readonly NumberSetting[] = [
  { key: "hitpointWarn", label: "Low hit point warning", help: "Warns you when your hit points fall below this share of the maximum.", max: 9, scale: 10, unit: "%" },
  { key: "delayFactor", label: "Animation delay", help: "How long the game pauses on each step of a missile or spell animation.", max: 255, scale: 1, unit: " ms" },
  { key: "lazymoveDelay", label: "Movement key delay", help: "How long the game waits to combine two direction keys into a diagonal. 0 turns this off.", max: 255, scale: 1, unit: " ms" },
];

export interface OptionsDraft {
  values: Record<string, boolean>;
  hitpointWarn: number;
  delayFactor: number;
  lazymoveDelay: number;
}

export function draftFromView(view: ModOptionsView): OptionsDraft {
  return {
    values: Object.fromEntries(view.entries.map((entry) => [entry.name, entry.value])),
    hitpointWarn: view.hitpointWarn, delayFactor: view.delayFactor, lazymoveDelay: view.lazymoveDelay,
  };
}

/** What Save would send: only what differs from the game, and only what may change. */
export function draftChanges(view: ModOptionsView, draft: OptionsDraft): ModOptionsChange {
  const values: Record<string, boolean> = {};
  for (const entry of view.entries) {
    const next = draft.values[entry.name];
    if (entry.writable && next !== undefined && next !== entry.value) values[entry.name] = next;
  }
  return {
    ...(Object.keys(values).length > 0 ? { values } : {}),
    ...(draft.hitpointWarn !== view.hitpointWarn ? { hitpointWarn: draft.hitpointWarn } : {}),
    ...(draft.delayFactor !== view.delayFactor ? { delayFactor: draft.delayFactor } : {}),
    ...(draft.lazymoveDelay !== view.lazymoveDelay ? { lazymoveDelay: draft.lazymoveDelay } : {}),
  };
}

export function changeCount(change: ModOptionsChange): number {
  return Object.keys(change.values ?? {}).length + (["hitpointWarn", "delayFactor", "lazymoveDelay"] as const).filter((key) => change[key] !== undefined).length;
}

const optionFocus = (name: string): string => `opt:${name}`;

export function installOptionsEditor(ctx: OptionsContext): () => void {
  if (ctx.flags?.["anybandui.optionsEditor"] !== true) return () => {};
  if (!ctx.options) ctx.log("options editor: this game does not share its options");
  let view: ModOptionsView | null = null;
  let draft: OptionsDraft | null = null;
  let search = "";
  let note = "";
  let confirm: Confirmation | null = null;
  const writable = typeof ctx.options?.set === "function";

  const reload = (): void => {
    try { view = ctx.options?.get() ?? null; } catch (err) { view = null; note = `The options could not be read: ${err instanceof Error ? err.message : String(err)}`; }
    draft = view ? draftFromView(view) : null;
  };
  reload();
  const pending = (): ModOptionsChange => (view && draft ? draftChanges(view, draft) : {});

  let surface: ReturnType<typeof openMenuSurface> = null;
  const repaint = (focusKey?: string): void => surface?.repaint(focusKey);

  const ask = (next: Confirmation): void => { confirm = next; repaint(CONFIRM_NO); };
  const save = (): void => {
    const change = pending();
    const count = changeCount(change);
    if (count === 0 || !ctx.options?.set) return;
    ask({ question: `Save ${count} changed ${count === 1 ? "option" : "options"}? This replaces the game's current values.`, yes: "Save", onYes: async () => {
      let result;
      try { result = await ctx.options!.set!(change); } catch (err) { result = { ok: false as const, reason: err instanceof Error ? err.message : String(err) }; }
      if (result.ok) { reload(); note = "Saved."; } else note = result.reason;
      repaint("save");
    } });
  };
  /* With no draft, Cancel reads the game's values again. */
  const cancel = (focusKey = "cancel"): void => {
    if (changeCount(pending()) === 0) { reload(); note = ""; repaint(focusKey); return; }
    ask({ question: "Throw away your changes to the options?", yes: "Discard", onYes: () => { reload(); note = "Changes discarded."; repaint(focusKey); } });
  };

  const render = (mount: HTMLElement): void => {
    el(mount, "h2", "Game options");
    if (!view || !draft) { el(mount, "p", note || "This game does not share its options.").className = "muted"; return; }
    const current = view;
    const edits = draft;
    el(mount, "p", writable
      ? "For this character. Your changes are a draft until you press Save, and Cancel throws them away."
      : "This game lets this mod read the options but not change them.").className = "muted";
    const searchBox = el(mount, "input");
    searchBox.type = "search";
    searchBox.placeholder = "Search options";
    searchBox.value = search;
    searchBox.dataset["focus"] = "search";
    searchBox.setAttribute("aria-label", "Search options");
    searchBox.addEventListener("input", () => { search = searchBox.value; repaint(); });
    const body = el(mount, "div");
    body.className = "list";
    let any = false;
    const toggles = (entries: readonly ModOptionsView["entries"][number][], group: string, readOnly: boolean): void => {
      const shown = entries.filter((entry) => matches(`${entry.description} ${entry.name} ${group}`, search));
      if (shown.length === 0) return;
      any = true;
      el(body, "div", readOnly ? `${group} (read only)` : group).className = "section";
      for (const entry of shown) {
        const row = el(body, "label");
        row.className = "field";
        const box = el(row, "input");
        box.type = "checkbox";
        box.checked = edits.values[entry.name] ?? entry.value;
        box.disabled = readOnly || !entry.writable || !writable;
        box.dataset["focus"] = optionFocus(entry.name);
        box.setAttribute("aria-label", entry.description);
        box.addEventListener("change", () => { edits.values[entry.name] = box.checked; note = ""; repaint(); });
        const text = el(row, "span", entry.description);
        text.style.flex = "1";
        el(row, "span", entry.name).className = "name";
      }
    };
    for (const group of GROUPS) toggles(current.entries.filter((entry) => entry.page === "interface" && optionGroup(entry.name) === group), group, false);
    const numbers = NUMBER_SETTINGS.filter((setting) => matches(`${setting.label} ${setting.help} Warnings and timing`, search));
    if (numbers.length > 0) { any = true; el(body, "div", "Warnings and timing").className = "section"; }
    for (const setting of numbers) {
      const row = el(body, "label");
      row.className = "field";
      row.title = setting.help;
      el(row, "span", setting.label);
      const range = el(row, "input");
      range.type = "range";
      range.min = "0";
      range.max = String(setting.max);
      range.step = "1";
      range.value = String(edits[setting.key]);
      range.disabled = !writable;
      range.dataset["focus"] = `num:${setting.key}`;
      range.setAttribute("aria-label", setting.label);
      const readout = el(row, "span", `${edits[setting.key] * setting.scale}${setting.unit}`);
      range.addEventListener("input", () => {
        const next = Math.round(Number(range.value));
        if (!Number.isFinite(next)) return;
        edits[setting.key] = Math.max(0, Math.min(setting.max, next));
        readout.textContent = `${edits[setting.key] * setting.scale}${setting.unit}`;
        note = "";
      });
      range.addEventListener("change", () => repaint());
    }
    for (const [page, title] of READ_ONLY_PAGES) toggles(current.entries.filter((entry) => entry.page === page), title, true);
    if (!any) el(body, "p", "No matching options.").className = "muted";
    // Up and Down move between rows; Left and Right still move a slider, and Space ticks a box.
    body.addEventListener("keydown", (event: KeyboardEvent) => {
      if (confirm || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      const controls = Array.from(body.querySelectorAll<HTMLElement>("[data-focus]"));
      const root = body.getRootNode() as { activeElement?: Element | null };
      const at = controls.findIndex((node) => node === root.activeElement);
      const next = controls[event.key === "ArrowDown" ? Math.min(controls.length - 1, at + 1) : Math.max(0, at - 1)];
      if (next) { swallow(event); next.focus(); }
    });
    const count = changeCount(pending());
    if (confirm) {
      const active = confirm;
      renderConfirm(mount, active, () => { confirm = null; repaint(writable ? "save" : "search"); });
    }
    const actions = el(mount, "div");
    actions.className = "actions";
    if (writable) {
      const saveButton = button(actions, count > 0 ? `Save (${count})` : "Save", "save", save);
      saveButton.disabled = count === 0 || confirm !== null;
      button(actions, "Cancel", "cancel", () => { cancel(); }).disabled = confirm !== null;
    }
    if (note) el(mount, "p", note).className = "note";
    // Escape backs out of the editor: it offers to throw away a draft, and does nothing without one.
    mount.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key !== "Escape" || confirm || changeCount(pending()) === 0) return;
      swallow(event);
      cancel(writable ? "cancel" : "search");
    });
  };

  surface = openMenuSurface(ctx, { key: OPTIONS_KEY, label: "Game options", tab: "Options", minSize: { width: 360, height: 240 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: "search" }, render);
  if (!surface) { ctx.log("options editor: panel seam unavailable"); return () => {}; }
  return () => { surface?.close(); surface = null; };
}
