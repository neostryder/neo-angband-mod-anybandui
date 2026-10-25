/**
 * The keymap editor (AnybandUI keybinding_editor.h), over ctx.keybindings.
 * Changes are a draft until Save, as upstream's editor applies them only on
 * Save and Close; Save asks first, then removes and sets keymaps one by one
 * through the seam, which stores each at once. Choosing a key says what that
 * key runs now, as upstream's "Currently:" line does: its keymap, or else the
 * game command on that key in the keyset being edited. Either keyset can be
 * edited, as upstream's keyset selector allows, whichever one is in use.
 *
 * While a capture waits, the host takes the next key pressed anywhere in the
 * game, and only that key or Escape ends it. Nothing in this panel keeps the
 * focus then, so Escape goes to the capture. Cancel keymap stops the capture
 * through the seam, and so does the host hiding the panel, so the next key
 * reaches the game.
 */
import type { ModGameCommand, ModKeybinding, ModKeybindings } from "@rpgm-tools/neo-angband-core";
import type { SurfaceContext } from "../panels/surface.js";
import { CONFIRM_NO, renderConfirm, type Confirmation } from "./inline-confirm.js";
import { button, el, listStep, matches, swallow } from "./keys.js";
import { openMenuSurface } from "./menu-surface.js";

export const KEYBINDINGS_KEY = "keybinding-editor";

export interface KeybindingContext extends SurfaceContext {
  readonly keybindings?: ModKeybindings | undefined;
}

export interface DraftBinding { readonly action: string; readonly owner: string | null }
export type BindingDraft = Map<string, DraftBinding>;

export function draftFromList(list: readonly ModKeybinding[]): BindingDraft {
  return new Map(list.map((binding) => [binding.trigger, { action: binding.action, owner: binding.owner }]));
}

export interface BindingDiff { readonly remove: readonly string[]; readonly set: readonly (readonly [string, string])[] }

/**
 * Save removes these triggers, then binds these. seam.set makes a binding the
 * player's, so a mod binding the player took over is set again even when its
 * action is unchanged.
 */
export function bindingDiff(original: readonly ModKeybinding[], draft: BindingDraft): BindingDiff {
  const before = draftFromList(original);
  const remove = [...before.keys()].filter((trigger) => !draft.has(trigger));
  const set = [...draft].filter(([trigger, binding]) => {
    const stored = before.get(trigger);
    return stored?.action !== binding.action || (stored.owner !== null && binding.owner === null);
  }).map(([trigger, binding]) => [trigger, binding.action] as const);
  return { remove, set };
}

export type Keyset = "original" | "roguelike";

export const KEYSET_NAMES: Readonly<Record<Keyset, string>> = { original: "Original", roguelike: "Roguelike" };

/** The game command a plain key runs in a keyset when no keymap is bound to it. */
export function commandOnKey(commands: readonly ModGameCommand[], trigger: string, keyset: Keyset): ModGameCommand | null {
  return commands.find((command) => command.keys[keyset] === trigger) ?? null;
}

/** The keys that run a command, as the catalogue lists them: "a in Original, z in Roguelike, Ctrl-A". */
export function commandKeys(command: ModGameCommand): string {
  const parts: string[] = [];
  for (const keyset of ["original", "roguelike"] as const) {
    const key = command.keys[keyset];
    if (key !== null) parts.push(`${key} in ${KEYSET_NAMES[keyset]}`);
  }
  if (command.control) parts.push(`Ctrl-${command.control}`);
  return parts.length > 0 ? parts.join(", ") : "no key";
}

/** The conflict line for a key about to be bound (keybinding_editor.h:31-36, :90). */
export function conflictNote(trigger: string, draft: BindingDraft, editing: string | null, command: ModGameCommand | null = null): string {
  const current = draft.get(trigger);
  if (current) {
    const owner = current.owner ? ` It was set by the ${current.owner} mod, and saving makes it yours.` : "";
    const replaces = trigger === editing ? "" : " This keymap replaces it.";
    return `Currently: ${trigger} runs ${current.action}.${replaces}${owner}`;
  }
  // keybinding_editor.h:10-13 keeps the number keys for movement and counts.
  if (/^[0-9]$/u.test(trigger)) return `Currently: ${trigger} moves your character or enters a number. A keymap here replaces that.`;
  if (command) return `Currently: ${trigger} runs the game command ${command.name}. A keymap here runs instead.`;
  return `Currently: ${trigger} has no keymap and runs no game command.`;
}

interface Form { trigger: string | null; action: string; editing: string | null; capturing: boolean; error: string }

/** How many game commands the list shows before it asks for a search. */
const COMMAND_LIMIT = 40;

const rowFocus = (trigger: string): string => `key:${trigger}`;

export function installKeybindingEditor(ctx: KeybindingContext): () => void {
  if (ctx.flags?.["anybandui.keybindingEditor"] !== true) return () => {};
  if (!ctx.keybindings) ctx.log("keybinding editor: this game does not share its keymaps");
  /* The keyset being edited. It starts as the one in use, and the player can
   * switch to the other. */
  let keyset: Keyset = "original";
  let started = false;
  let commands: readonly ModGameCommand[] = [];
  let showCommands = false;
  let original: readonly ModKeybinding[] = [];
  let draft: BindingDraft = new Map();
  let selected: string | null = null;
  let form: Form | null = null;
  let confirm: Confirmation | null = null;
  let search = "";
  let note = "";
  let closed = false;
  let captureRun = 0;

  const reload = (): void => {
    const seam = ctx.keybindings;
    if (!seam) return;
    try {
      if (!started) { keyset = seam.keyset(); started = true; }
      original = seam.list(keyset);
      commands = seam.commands();
    } catch (err) { original = []; note = `The keymaps could not be read: ${err instanceof Error ? err.message : String(err)}`; }
    draft = draftFromList(original);
    form = null;
  };
  reload();
  const changes = (): number => { const diff = bindingDiff(original, draft); return diff.remove.length + diff.set.length; };

  let surface: ReturnType<typeof openMenuSurface> = null;
  const repaint = (focusKey?: string | null): void => surface?.repaint(focusKey);
  const ask = (next: Confirmation): void => { confirm = next; repaint(CONFIRM_NO); };

  const capture = (): void => {
    const seam = ctx.keybindings;
    if (!seam || !form) return;
    form.capturing = true;
    form.error = "";
    const run = ++captureRun;
    repaint(null);
    void seam.capture().then((key) => {
      if (closed || run !== captureRun || !form) return;
      form.capturing = false;
      // Escape cancels the capture, and a new keymap with no key yet with it.
      if (key === null) { if (form.trigger === null) { form = null; repaint(selected ? rowFocus(selected) : "add"); return; } repaint("action"); return; }
      form.trigger = key;
      repaint("action");
    }, () => {
      if (closed || run !== captureRun || !form) return;
      form.capturing = false;
      form.error = "The key could not be read.";
      repaint("capture");
    });
  };
  /* Stops a waiting capture, so the next key reaches the game. Bumping
   * captureRun makes the null the cancelled capture resolves with a no-op here. */
  const dropCapture = (): void => {
    if (!form?.capturing) return;
    captureRun++;
    form.capturing = false;
    if (form.trigger === null) form = null;
    try { ctx.keybindings?.cancelCapture(); } catch { /* the capture ends with the next key instead */ }
  };
  const openForm = (binding: readonly [string, DraftBinding] | null): void => {
    form = binding
      ? { trigger: binding[0], action: binding[1].action, editing: binding[0], capturing: false, error: "" }
      : { trigger: null, action: "", editing: null, capturing: false, error: "" };
    if (binding) repaint("action"); else capture();
  };
  const closeForm = (): void => { dropCapture(); form = null; repaint(selected ? rowFocus(selected) : "add"); };
  const applyForm = (): void => {
    if (!form) return;
    if (!form.trigger) { form.error = "Press a key for this keymap first."; repaint("capture"); return; }
    const action = form.action.trim();
    if (!action) { form.error = "Type the keys this keymap presses."; repaint("action"); return; }
    if (form.editing && form.editing !== form.trigger) draft.delete(form.editing);
    draft.set(form.trigger, { action, owner: null });
    selected = form.trigger;
    form = null;
    note = "";
    repaint(rowFocus(selected));
  };
  const removeRow = (trigger: string): void => {
    const triggers = [...draft.keys()];
    const at = triggers.indexOf(trigger);
    draft.delete(trigger);
    const rest = [...draft.keys()];
    selected = rest[Math.min(at, rest.length - 1)] ?? null;
    note = "";
    repaint(selected ? rowFocus(selected) : "add");
  };
  const save = (): void => {
    const seam = ctx.keybindings;
    const diff = bindingDiff(original, draft);
    const count = diff.remove.length + diff.set.length;
    if (!seam || count === 0) return;
    ask({ question: `Save ${count} ${count === 1 ? "change" : "changes"} to your ${keyset} keymaps? This replaces what is stored now.`, yes: "Save", onYes: () => {
      let failed: string[] = [];
      try {
        for (const trigger of diff.remove) seam.remove(trigger, keyset);
        failed = diff.set.filter(([trigger, action]) => !seam.set(trigger, action, keyset)).map(([trigger]) => trigger);
      } catch (err) { note = `The keymaps could not be saved: ${err instanceof Error ? err.message : String(err)}`; repaint("save"); return; }
      reload();
      note = failed.length > 0 ? `The game refused a keymap for ${failed.join(", ")}.` : "Saved.";
      repaint("save");
    } });
  };
  const cancel = (): void => {
    if (changes() === 0) { reload(); note = ""; repaint("add"); return; }
    ask({ question: "Throw away your changes to the keymaps?", yes: "Discard", onYes: () => { reload(); note = "Changes discarded."; repaint("add"); } });
  };
  const switchKeyset = (next: Keyset): void => {
    if (next === keyset) return;
    const go = (): void => { dropCapture(); keyset = next; selected = null; reload(); note = ""; repaint(`keyset:${next}`); };
    if (changes() === 0) { go(); return; }
    ask({ question: `Throw away your changes to the ${keyset} keymaps and edit the ${next} ones?`, yes: "Discard", onYes: go });
  };
  const clearKeyset = (): void => {
    for (const [trigger, binding] of [...draft]) if (binding.owner === null) draft.delete(trigger);
    selected = null;
    note = "Your keymaps are removed from the draft. Save to apply this, or Cancel to keep them.";
    repaint("save");
  };

  const render = (mount: HTMLElement): void => {
    el(mount, "h2", "Keybindings");
    if (!ctx.keybindings) { el(mount, "p", "This game does not share its keymaps.").className = "muted"; return; }
    let inUse: Keyset | null = null;
    try { inUse = ctx.keybindings.keyset(); } catch { inUse = null; }
    const sets = el(mount, "div");
    sets.className = "tabs";
    sets.setAttribute("aria-label", "Keyset to edit");
    for (const choice of ["original", "roguelike"] as const) {
      const tab = button(sets, `${KEYSET_NAMES[choice]} keyset`, `keyset:${choice}`, () => switchKeyset(choice));
      tab.setAttribute("aria-pressed", String(choice === keyset));
      tab.disabled = form?.capturing === true || confirm !== null;
    }
    el(mount, "p", `Editing: ${KEYSET_NAMES[keyset]}.${inUse ? ` In use: ${KEYSET_NAMES[inUse]}.` : ""} The roguelike keys option chooses which one is in use. Your changes apply when you press Save.`).className = "muted";
    if (form) {
      const active = form;
      const box = el(mount, "div");
      box.className = "confirm";
      el(box, "div", active.editing ? "Change keymap" : "New keymap").className = "section";
      if (active.capturing) {
        el(box, "p", "Press the key to bind. Escape cancels.").setAttribute("role", "status");
      } else {
        el(box, "p", `Key: ${active.trigger ?? "none yet"}`);
        if (active.trigger) el(box, "p", conflictNote(active.trigger, draft, active.editing, commandOnKey(commands, active.trigger, keyset))).className = "warn";
      }
      const field = el(box, "label");
      field.className = "field";
      el(field, "span", "Keys it presses");
      const input = el(field, "input");
      input.type = "text";
      input.placeholder = "Such as R&[Enter]";
      input.value = active.action;
      input.dataset["focus"] = "action";
      input.disabled = active.capturing;
      input.setAttribute("aria-label", "Keys the keymap presses");
      input.addEventListener("input", () => { active.action = input.value; });
      input.addEventListener("keydown", (event: KeyboardEvent) => { if (event.key === "Enter") { swallow(event); applyForm(); } });
      if (active.error) el(box, "p", active.error).className = "warn";
      const actions = el(box, "div");
      actions.className = "actions";
      button(actions, "Use this key", "apply", applyForm).disabled = active.capturing;
      button(actions, active.trigger ? "Choose another key" : "Choose a key", "capture", capture).disabled = active.capturing;
      button(actions, "Cancel keymap", "form-cancel", closeForm);
      box.addEventListener("keydown", (event: KeyboardEvent) => {
        if (active.capturing) return;
        if (event.key === "Escape") { swallow(event); closeForm(); }
      });
    }
    const controls = el(mount, "div");
    controls.className = "controls";
    const searchBox = el(controls, "input");
    searchBox.type = "search";
    searchBox.placeholder = "Search keys and actions";
    searchBox.value = search;
    searchBox.dataset["focus"] = "search";
    searchBox.setAttribute("aria-label", "Search keymaps");
    searchBox.addEventListener("input", () => { search = searchBox.value; repaint(); });
    button(controls, "Add keymap", "add", () => openForm(null)).disabled = form !== null || confirm !== null;

    const rows = [...draft].filter(([trigger, binding]) => matches(`${trigger} ${binding.action} ${binding.owner ?? ""}`, search));
    const list = el(mount, "div");
    list.className = "list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Keymaps");
    if (rows.length === 0) el(list, "p", draft.size === 0 ? "No keymaps in this keyset yet." : "No matching keymaps.").className = "muted";
    for (const [trigger, binding] of rows) {
      const row = button(list, "", rowFocus(trigger), () => { selected = trigger; openForm([trigger, binding]); });
      row.disabled = form?.capturing === true;
      row.className = "row";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(trigger === selected));
      el(row, "span", trigger);
      el(row, "span", binding.action);
      const hidden = commandOnKey(commands, trigger, keyset);
      el(row, "span", `${binding.owner ? `from ${binding.owner}` : "yours"}${hidden ? `, hides ${hidden.name}` : ""}`).className = "muted";
      row.addEventListener("focus", () => { selected = trigger; });
    }
    list.addEventListener("keydown", (event: KeyboardEvent) => {
      if (form || confirm) return;
      const triggers = rows.map(([trigger]) => trigger);
      const root = list.getRootNode() as { activeElement?: Element | null };
      const focused = (root.activeElement as HTMLElement | null)?.dataset?.["focus"];
      const current = focused?.startsWith("key:") ? focused.slice(4) : selected;
      const at = current ? triggers.indexOf(current) : -1;
      const next = listStep(event.key, at, triggers.length);
      if (next !== null) { swallow(event); selected = triggers[next] ?? null; repaint(selected ? rowFocus(selected) : undefined); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && current && draft.has(current)) { swallow(event); removeRow(current); }
    });

    if (confirm) renderConfirm(mount, confirm, () => { confirm = null; repaint("save"); });
    const count = changes();
    const actions = el(mount, "div");
    actions.className = "actions";
    const busy = form !== null || confirm !== null;
    button(actions, count > 0 ? `Save (${count})` : "Save", "save", save).disabled = count === 0 || busy;
    button(actions, "Cancel", "cancel", cancel).disabled = busy;
    button(actions, "Remove my keymaps", "clear", clearKeyset).disabled = busy || ![...draft.values()].some((binding) => binding.owner === null);
    if (selected && draft.has(selected) && !busy) {
      const chosen = selected;
      button(actions, `Remove ${chosen}`, "remove", () => removeRow(chosen));
    }
    if (note) el(mount, "p", note).className = "note";
    /* The game's commands with their keys in both keysets (upstream lists its
     * catalogue the same way), narrowed by the search box. */
    if (commands.length > 0) {
      const toggle = button(mount, showCommands ? "Hide game commands" : "Show game commands", "commands", () => { showCommands = !showCommands; repaint("commands"); });
      toggle.setAttribute("aria-expanded", String(showCommands));
      if (showCommands) {
        const shown = commands.filter((command) => matches(`${command.name} ${command.group} ${commandKeys(command)}`, search));
        const table = el(mount, "div");
        table.className = "list";
        table.setAttribute("aria-label", "Game commands");
        if (shown.length === 0) el(table, "p", "No matching game commands.").className = "muted";
        let group = "";
        for (const command of shown.slice(0, COMMAND_LIMIT)) {
          if (command.group !== group) { el(table, "div", command.group).className = "section"; group = command.group; }
          const row = el(table, "div");
          row.className = "field";
          el(row, "span", command.name);
          el(row, "span", commandKeys(command)).className = "muted";
        }
        if (shown.length > COMMAND_LIMIT) el(table, "p", `${shown.length - COMMAND_LIMIT} more. Search to narrow the list.`).className = "muted";
      }
    }
    // Escape backs out one level: the form first, then a draft with changes.
    mount.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key !== "Escape" || form || confirm || changes() === 0) return;
      swallow(event);
      cancel();
    });
  };

  surface = openMenuSurface(ctx, { key: KEYBINDINGS_KEY, label: "Keybindings", tab: "Keys", minSize: { width: 360, height: 240 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: "add", onHidden: dropCapture }, render);
  if (!surface) { ctx.log("keybinding editor: panel seam unavailable"); return () => {}; }
  return () => { dropCapture(); closed = true; surface?.close(); surface = null; };
}
