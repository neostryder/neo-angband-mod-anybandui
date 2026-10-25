/**
 * The settings window (AnybandUI client.cpp:760-1010): a page list on the left
 * in Play and Presentation groups, the page on the right, and Save and Cancel
 * under both. It gathers this mod's own settings: the theme preset, the hover
 * delay and the effect strengths, each with presets. Everything is a draft
 * until Save. The effect strengths are this mod's settings on the game's Mods
 * screen, so Save moves them through ctx.settings, which clamps each to its
 * range. The game options, keybindings, knowledge and colour editors are
 * their own panels, and their pages here open them.
 *
 * Two pages act at once rather than through the draft. Save game holds
 * upstream's "Save and..." menu (client.cpp:2034-2045), and Layout holds the
 * undo, redo and saved layouts of upstream's Layout menu
 * (workspace_layout.h:262-335). Upstream keeps both on its toolbar; this mod
 * has no toolbar of its own, so they sit here beside the other settings.
 */
import type { ModDisplay, ModGameSession, ModSettingsRead } from "@rpgm-tools/neo-angband-core";
import type { SurfaceContext } from "../panels/surface.js";
import { STRENGTH_SETTINGS } from "../effects.js";
import { createSettingsStore, themeFromPrefs, validateSettings, type Settings } from "../settings.js";
import { broadcastTheme } from "../theme-editor.js";
import { onThemeChange, themeChoices } from "../theme.js";
import { runSessionAction, SESSION_LABELS, SESSION_QUESTIONS, type SessionAction } from "./game-session.js";
import { CONFIRM_NO, renderConfirm, type Confirmation } from "./inline-confirm.js";
import { button, el, listStep, swallow } from "./keys.js";
import { KEYBINDINGS_KEY } from "./keybinding-editor.js";
import { KNOWLEDGE_KEY } from "./knowledge-browser.js";
import { createLayoutHistory, createSavedLayouts, LAYOUT_NAME_MAX, SAVED_LAYOUT_LIMIT, type LayoutSeam } from "./layout-history.js";
import { openMenuSurface } from "./menu-surface.js";
import { hasOpener, openMenu } from "./openers.js";
import { OPTIONS_KEY } from "./options-editor.js";

export const SETTINGS_KEY = "settings-window";

export interface SettingsWindowContext extends SurfaceContext {
  readonly prefs?: { get(): unknown; set(value: unknown): void } | undefined;
  readonly settings?: Pick<ModSettingsRead, "get" | "set" | "onChange"> | undefined;
  readonly display?: Pick<ModDisplay, "setVisualFilter"> & Partial<Pick<ModDisplay, "getVisualFilter" | "setChromeTheme">> | undefined;
  readonly session?: ModGameSession | undefined;
  readonly subwindows?: LayoutSeam | undefined;
}

export interface StrengthSetting { readonly id: string; readonly title: string; readonly flag: string }

/** The effect strengths, grouped as upstream's Animations and CRT pages group their switches (client.cpp:921-995). */
export const STRENGTH_GROUPS: readonly (readonly [string, readonly StrengthSetting[]])[] = [
  ["Atmosphere and milestones", [
    { id: "anybandui.lowHealthStrength", title: "Low health tint strength", flag: "anybandui.lowHealthEffect" },
    { id: "anybandui.sceneFadeStrength", title: "Scene fade strength", flag: "anybandui.sceneFade" },
    { id: "anybandui.levelFlashStrength", title: "Level flash strength", flag: "anybandui.levelFlash" },
    { id: "anybandui.deathStrength", title: "Death burst strength", flag: "anybandui.deathEffect" },
  ]],
  ["Movement and combat", [
    { id: "anybandui.walkSlideStrength", title: "Walk slide strength", flag: "anybandui.walkSlide" },
    { id: "anybandui.blinkRippleStrength", title: "Teleport ripple strength", flag: "anybandui.blinkRipple" },
    { id: "anybandui.boltGlyphsStrength", title: "Bolt glyph strength", flag: "anybandui.boltGlyphs" },
    { id: "anybandui.coneWashStrength", title: "Breath cone strength", flag: "anybandui.coneWash" },
    { id: "anybandui.spellEffectsStrength", title: "Combat ring strength", flag: "anybandui.spellEffects" },
    { id: "anybandui.damageNumbersStrength", title: "Damage number strength", flag: "anybandui.damageNumbers" },
  ]],
  ["Dungeon indicators", [
    { id: "anybandui.itemGlowStrength", title: "Floor item glow strength", flag: "anybandui.itemGlow" },
    { id: "anybandui.presenceHazeStrength", title: "Presence haze strength", flag: "anybandui.presenceHaze" },
    { id: "anybandui.stairEmbersStrength", title: "Stair ember strength", flag: "anybandui.stairEmbers" },
    { id: "anybandui.lavaEmbersStrength", title: "Lava ember strength", flag: "anybandui.lavaEmbers" },
    { id: "anybandui.recallRingStrength", title: "Recall ring strength", flag: "anybandui.recallRing" },
    { id: "anybandui.sleepMarksStrength", title: "Sleep mark strength", flag: "anybandui.sleepMarks" },
    { id: "anybandui.fearMarksStrength", title: "Fear mark strength", flag: "anybandui.fearMarks" },
  ]],
  ["CRT effects", [
    { id: "anybandui.crtStrength", title: "CRT strength", flag: "anybandui.crt" },
    { id: "anybandui.crtGlowStrength", title: "Phosphor glow strength", flag: "anybandui.crtGlow" },
    { id: "anybandui.crtFringeStrength", title: "Colour fringe strength", flag: "anybandui.crtFringe" },
    { id: "anybandui.crtSweepStrength", title: "CRT sweep strength", flag: "anybandui.crtSweep" },
  ]],
];

/** Upstream's effect strength presets by name (client.cpp:956), as one level for every effect. */
export const STRENGTH_PRESETS: readonly (readonly [string, number])[] = [["Subtle", 30], ["Classic", 60], ["Vivid", 80], ["Zero Cool", 100]];
export const HOVER_PRESETS: readonly (readonly [string, number])[] = [["Quick", 250], ["Standard", 550], ["Patient", 1000]];

/** The cue kinds this mod's stored strengths are keyed by, for one setting. */
export function cueKindsFor(id: string): string[] {
  return Object.entries(STRENGTH_SETTINGS).filter(([, setting]) => setting === id).map(([kind]) => kind);
}

interface Page { readonly id: string; readonly group: "Play" | "Presentation"; readonly title: string; readonly summary: string; readonly opens?: { readonly key: string; readonly flag: string; readonly switchTitle: string } }

const PAGES: readonly Page[] = [
  { id: "interaction", group: "Play", title: "Interaction", summary: "How the mouse and hover cards behave." },
  { id: "keys", group: "Play", title: "Keybindings", summary: "Your keymaps for the current keyset.", opens: { key: KEYBINDINGS_KEY, flag: "anybandui.keybindingEditor", switchTitle: "Keybinding editor" } },
  { id: "options", group: "Play", title: "Game options", summary: "The game's own options for this character.", opens: { key: OPTIONS_KEY, flag: "anybandui.optionsEditor", switchTitle: "Game options editor" } },
  { id: "knowledge", group: "Play", title: "Knowledge", summary: "What your character has learned about the world.", opens: { key: KNOWLEDGE_KEY, flag: "anybandui.knowledgeBrowser", switchTitle: "Knowledge browser" } },
  { id: "session", group: "Play", title: "Save game", summary: "Save this character, or save and leave. These act at once." },
  { id: "theme", group: "Presentation", title: "Theme", summary: "The colours of this mod's panels and window frames." },
  { id: "effects", group: "Presentation", title: "Effects", summary: "How strongly each dungeon effect is drawn." },
  { id: "layout", group: "Presentation", title: "Layout", summary: "Undo and redo changes to the panel layout, and keep layouts by name. These act at once." },
];

/** Reads a strength setting's value from the game, undefined where it has none. */
export type StrengthRead = (id: string) => number | undefined;

export interface SettingsDraft {
  theme: Settings["theme"];
  keepCustom: boolean;
  hoverDelayMs: number;
  /** By setting id. */
  strengths: Record<string, number>;
}

/**
 * The draft for the stored settings. With `read`, the strengths are the game's
 * own settings; without it they come from this mod's stored copy.
 */
export function draftFromSettings(settings: Readonly<Settings>, read?: StrengthRead): SettingsDraft {
  const strengths: Record<string, number> = {};
  for (const [, members] of STRENGTH_GROUPS) for (const setting of members) {
    let stored: number | undefined;
    if (read) { try { stored = read(setting.id); } catch { stored = undefined; } }
    else stored = cueKindsFor(setting.id).map((kind) => settings.effects[kind]).find((value) => typeof value === "number");
    strengths[setting.id] = typeof stored === "number" ? stored : 100;
  }
  return { theme: settings.theme, keepCustom: settings.customTheme !== null, hoverDelayMs: settings.hoverDelayMs, strengths };
}

/**
 * The draft after the stored settings changed from `base` to `fresh` somewhere
 * else, such as the theme editor saving. A field the player has not touched
 * here takes the new stored value; a touched one keeps the player's choice.
 * The theme preset and the custom theme switch move together, since choosing
 * a preset turns the custom theme off.
 */
export function rebaseDraft(base: SettingsDraft, draft: SettingsDraft, fresh: SettingsDraft): SettingsDraft {
  const themeTouched = draft.theme !== base.theme || draft.keepCustom !== base.keepCustom;
  const strengths: Record<string, number> = {};
  for (const id of new Set([...Object.keys(fresh.strengths), ...Object.keys(draft.strengths)])) {
    const value = draft.strengths[id] === base.strengths[id] ? fresh.strengths[id] : draft.strengths[id];
    if (value !== undefined) strengths[id] = value;
  }
  return {
    theme: themeTouched ? draft.theme : fresh.theme,
    keepCustom: themeTouched ? draft.keepCustom : fresh.keepCustom,
    hoverDelayMs: draft.hoverDelayMs === base.hoverDelayMs ? fresh.hoverDelayMs : draft.hoverDelayMs,
    strengths,
  };
}

/** The strengths Save moves through the game's settings: each one the draft changed. */
export function strengthWrites(draft: SettingsDraft, read: StrengthRead): (readonly [string, number])[] {
  return Object.entries(draft.strengths).filter(([id, value]) => {
    let stored: number | undefined;
    try { stored = read(id); } catch { stored = undefined; }
    return (typeof stored === "number" ? stored : 100) !== value;
  });
}

/** The settings patch Save writes. */
export function settingsPatch(current: Readonly<Settings>, draft: SettingsDraft, writeStrengths: boolean): Partial<Settings> {
  const patch: Partial<Settings> = {};
  if (draft.theme !== current.theme) patch.theme = draft.theme;
  if (!draft.keepCustom && current.customTheme !== null) patch.customTheme = null;
  if (draft.hoverDelayMs !== current.hoverDelayMs) patch.hoverDelayMs = draft.hoverDelayMs;
  if (writeStrengths) {
    const effects: Record<string, number> = { ...current.effects };
    let moved = false;
    // An unstored strength counts as 100, so an untouched draft writes nothing.
    for (const [id, value] of Object.entries(draft.strengths)) for (const kind of cueKindsFor(id)) {
      if ((current.effects[kind] ?? 100) === value) continue;
      effects[kind] = value;
      moved = true;
    }
    if (moved) patch.effects = effects;
  }
  return patch;
}

const pageFocus = (id: string): string => `page:${id}`;

export function installSettingsWindow(ctx: SettingsWindowContext): () => void {
  if (ctx.flags?.["anybandui.settingsWindow"] !== true) return () => {};
  /* Read the stored settings fresh each time: the theme editor saves through a
   * store of its own, and a cached copy here would write its old colours back. */
  const current = (): Readonly<Settings> => validateSettings(ctx.prefs?.get());
  /* The strengths are the game's settings for this mod, read and written through
   * ctx.settings. Without it they fall back to this mod's own stored copy. */
  const seam = ctx.settings;
  const read: StrengthRead | undefined = seam ? (id) => seam.get(id) : undefined;
  /* The stored settings the draft was made from. When they change elsewhere,
   * the draft follows them for every field the player has not touched here. */
  let base = draftFromSettings(current(), read);
  let draft = draftFromSettings(current(), read);
  const rebase = (): void => {
    const fresh = draftFromSettings(current(), read);
    if (JSON.stringify(fresh) === JSON.stringify(base)) return;
    draft = rebaseDraft(base, draft, fresh);
    base = fresh;
  };
  const reset = (): void => { base = draftFromSettings(current(), read); draft = draftFromSettings(current(), read); };
  let page = PAGES[0]!.id;
  let confirm: Confirmation | null = null;
  /* Where the focus goes when the question closes. */
  let confirmReturn = "save";
  let note = "";
  /* What the last Save game or Layout action did, shown on its page. */
  let pageNote: { readonly text: string; readonly warn: boolean } | null = null;
  let leaving = false;
  let layoutName = "";
  let renaming: { readonly from: string; text: string } | null = null;
  const history = ctx.subwindows ? createLayoutHistory(ctx.subwindows) : null;
  const saved = ctx.subwindows && ctx.prefs ? createSavedLayouts(ctx.subwindows, ctx.prefs) : null;

  let surface: ReturnType<typeof openMenuSurface> = null;
  const repaint = (focusKey?: string): void => surface?.repaint(focusKey);
  const pending = (): Partial<Settings> => { rebase(); return settingsPatch(current(), draft, !read); };
  const strengthChanges = (): (readonly [string, number])[] => (read ? strengthWrites(draft, read) : []);
  const changed = (): boolean => Object.keys(pending()).length > 0 || strengthChanges().length > 0;
  const ask = (next: Confirmation, back = "save"): void => { confirm = next; confirmReturn = back; repaint(CONFIRM_NO); };

  const commit = (): void => {
    const patch = pending();
    if (Object.keys(patch).length > 0 && !ctx.prefs) { note = "This game does not keep this mod's settings."; repaint("save"); return; }
    if (ctx.prefs) {
      const before = JSON.stringify(themeFromPrefs(ctx.prefs.get()));
      createSettingsStore({ prefs: ctx.prefs }).set(patch);
      const theme = themeFromPrefs(ctx.prefs.get());
      if (JSON.stringify(theme) !== before) broadcastTheme(ctx, theme);
    }
    // The game clamps each value to the setting's range and tells the effects.
    for (const [id, value] of strengthChanges()) { try { seam?.set(id, value); } catch { /* the setting keeps its old value */ } }
    reset();
    note = "Saved.";
    repaint("save");
  };
  const save = (): void => {
    if (!changed()) return;
    if (pending().customTheme === null) {
      ask({ question: "Saving removes your custom theme colours. Save anyway?", yes: "Save", onYes: commit });
      return;
    }
    commit();
  };
  const cancel = (focusKey: string): void => {
    if (!changed()) { reset(); note = ""; repaint(focusKey); return; }
    ask({ question: "Throw away your changes to these settings?", yes: "Discard", onYes: () => { reset(); note = "Changes discarded."; repaint(focusKey); } });
  };

  const runSession = (action: SessionAction): void => {
    leaving = true;
    pageNote = null;
    repaint(`session:${action}`);
    void runSessionAction(ctx.session, action).then((result) => {
      leaving = false;
      pageNote = { text: result.message, warn: !result.ok };
      repaint(`session:${action}`);
    });
  };
  const layoutResult = (result: { readonly ok: boolean; readonly reason?: string }, done: string, focusKey: string): void => {
    pageNote = result.ok ? { text: done, warn: false } : { text: result.reason ?? "That did not work.", warn: true };
    repaint(focusKey);
  };

  /* The Save game page: upstream's three Save menu rows. Leaving asks first,
   * since the game's calls do not. */
  const renderSession = (parent: HTMLElement, mark: (node: HTMLElement) => HTMLElement): void => {
    if (!ctx.session) { el(parent, "p", "This game does not let mods save it.").className = "muted"; return; }
    const actions = el(parent, "div");
    actions.className = "actions";
    for (const action of ["save", "close", "quit"] as const) {
      const node = button(actions, SESSION_LABELS[action], `session:${action}`, () => {
        if (action === "save") { runSession(action); return; }
        ask({ question: SESSION_QUESTIONS[action], yes: SESSION_LABELS[action], onYes: () => runSession(action) }, `session:${action}`);
      });
      mark(node);
      node.disabled = leaving || confirm !== null;
    }
    el(parent, "p", "Save and quit closes the desktop app. In a browser it returns to the main menu.").className = "muted";
  };

  /* The Layout page: Undo and Redo, then the saved layouts with Restore,
   * Rename and Delete, then a name box to save the current layout. */
  const renderLayout = (parent: HTMLElement, mark: (node: HTMLElement) => HTMLElement): void => {
    if (!history) { el(parent, "p", "This game cannot save or restore its layout.").className = "muted"; return; }
    const busy = confirm !== null;
    const refused = { ok: false, reason: "The game could not put that layout back." } as const;
    const steps = el(parent, "div");
    steps.className = "actions";
    const undo = button(steps, "Undo", "layout:undo", () => layoutResult(history.undo() ? { ok: true } : refused, "Layout change undone.", "layout:undo"));
    mark(undo);
    undo.disabled = busy || !history.canUndo();
    undo.title = "Undo the last layout change";
    const redo = button(steps, "Redo", "layout:redo", () => layoutResult(history.redo() ? { ok: true } : refused, "Layout change redone.", "layout:redo"));
    redo.disabled = busy || !history.canRedo();
    redo.title = "Redo the last undone change";
    el(parent, "div", "Saved layouts").className = "section";
    if (!saved) { el(parent, "p", "This game does not keep this mod's settings, so layouts cannot be saved.").className = "muted"; return; }
    const entries = saved.list();
    el(parent, "p", entries.length === 0 ? "No saved layouts yet." : "Choose a layout to restore it.").className = "muted";
    for (const entry of entries) {
      const row = el(parent, "div");
      row.className = "field";
      if (renaming?.from === entry.name) {
        const edit = renaming;
        const input = el(row, "input");
        input.type = "text";
        input.value = edit.text;
        input.maxLength = LAYOUT_NAME_MAX;
        input.dataset["focus"] = `layout-rename:${entry.name}`;
        input.setAttribute("aria-label", `New name for ${entry.name}`);
        const apply = (): void => {
          const named = edit.text.trim();
          const result = saved.rename(edit.from, edit.text);
          if (result.ok) renaming = null;
          layoutResult(result, `Renamed to ${named}.`, result.ok ? `layout-saved:${named}` : `layout-rename:${entry.name}`);
        };
        input.addEventListener("input", () => { edit.text = input.value; });
        input.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key === "Enter") { swallow(event); apply(); }
          else if (event.key === "Escape") { swallow(event); renaming = null; repaint(`layout-saved:${entry.name}`); }
        });
        button(row, "Rename", `layout-apply:${entry.name}`, apply).disabled = busy;
        button(row, "Cancel", `layout-keep:${entry.name}`, () => { renaming = null; repaint(`layout-saved:${entry.name}`); }).disabled = busy;
        continue;
      }
      const restore = button(row, entry.name, `layout-saved:${entry.name}`, () => layoutResult(saved.restore(entry.name), `Restored ${entry.name}.`, `layout-saved:${entry.name}`));
      restore.className = "row";
      restore.style.flex = "1";
      restore.title = `Restore ${entry.name}`;
      restore.disabled = busy;
      button(row, "Rename", `layout-rename-open:${entry.name}`, () => { renaming = { from: entry.name, text: entry.name }; pageNote = null; repaint(`layout-rename:${entry.name}`); }).disabled = busy;
      button(row, "Delete", `layout-delete:${entry.name}`, () => {
        ask({ question: `Delete the saved layout ${entry.name}?`, yes: "Delete", onYes: () => layoutResult(saved.remove(entry.name), `Deleted ${entry.name}.`, "layout:name") }, `layout-saved:${entry.name}`);
      }).disabled = busy;
    }
    el(parent, "p", "Save the current layout").className = "muted";
    const row = el(parent, "div");
    row.className = "controls";
    const name = el(row, "input");
    name.type = "text";
    name.placeholder = "Layout name";
    name.value = layoutName;
    name.maxLength = LAYOUT_NAME_MAX;
    name.dataset["focus"] = "layout:name";
    name.setAttribute("aria-label", "Layout name");
    const replacing = entries.some((entry) => entry.name === layoutName.trim());
    const store = (): void => {
      const named = layoutName.trim();
      const result = saved.save(layoutName);
      if (result.ok) layoutName = "";
      layoutResult(result, `Saved the current layout as ${named}.`, "layout:name");
    };
    name.addEventListener("input", () => { layoutName = name.value; repaint(); });
    name.addEventListener("keydown", (event: KeyboardEvent) => { if (event.key === "Enter") { swallow(event); store(); } });
    const keep = button(row, replacing ? "Replace saved layout" : "Save layout", "layout:save", store);
    keep.disabled = busy || layoutName.trim() === "" || (!replacing && entries.length >= SAVED_LAYOUT_LIMIT);
  };

  const renderPage = (parent: HTMLElement, info: Page): void => {
    el(parent, "div", info.title).className = "section";
    el(parent, "p", info.summary).className = "muted";
    let first = true;
    const mark = (node: HTMLElement): HTMLElement => { if (first) { node.dataset["first"] = "true"; first = false; } return node; };
    if (info.opens) {
      const opens = info.opens;
      if (ctx.flags?.[opens.flag] === true && hasOpener(opens.key)) {
        mark(button(parent, `Open ${info.title}`, `open:${info.id}`, () => { if (!openMenu(opens.key)) { note = `${info.title} is not open.`; repaint(); } }));
      } else el(parent, "p", `Turn on ${opens.switchTitle} on the Mods screen to use it here.`);
      return;
    }
    if (info.id === "session" || info.id === "layout") {
      if (info.id === "session") renderSession(parent, mark); else renderLayout(parent, mark);
      if (pageNote) {
        const line = el(parent, "p", pageNote.text);
        line.className = pageNote.warn ? "warn" : "note";
        line.setAttribute("role", "status");
      }
      return;
    }
    if (info.id === "interaction") {
      const presets = el(parent, "div");
      presets.className = "tabs";
      for (const [label, ms] of HOVER_PRESETS) {
        const node = mark(button(presets, `${label} (${ms} ms)`, `hover:${label}`, () => { draft.hoverDelayMs = ms; note = ""; repaint(`hover:${label}`); }));
        node.setAttribute("aria-pressed", String(draft.hoverDelayMs === ms));
      }
      const row = el(parent, "label");
      row.className = "field";
      el(row, "span", "Hover card delay");
      const range = el(row, "input");
      range.type = "range";
      range.min = "0";
      range.max = "5000";
      range.step = "50";
      range.value = String(draft.hoverDelayMs);
      range.dataset["focus"] = "hover-delay";
      range.setAttribute("aria-label", "Hover card delay");
      const readout = el(row, "span", `${draft.hoverDelayMs} ms`);
      range.addEventListener("input", () => {
        const next = Math.round(Number(range.value));
        if (!Number.isFinite(next)) return;
        draft.hoverDelayMs = Math.max(0, Math.min(5000, next));
        readout.textContent = `${draft.hoverDelayMs} ms`;
      });
      range.addEventListener("change", () => repaint());
      el(parent, "p", "How long the pointer rests on a tile before its hover card opens.").className = "muted";
      return;
    }
    if (info.id === "theme") {
      const presets = el(parent, "div");
      presets.className = "tabs";
      for (const [id, label] of themeChoices()) {
        const node = mark(button(presets, label, `theme:${id}`, () => { draft.theme = id; draft.keepCustom = false; note = ""; repaint(`theme:${id}`); }));
        node.setAttribute("aria-pressed", String(draft.theme === id && !draft.keepCustom));
      }
      if (current().customTheme) {
        const row = el(parent, "label");
        row.className = "field";
        const box = el(row, "input");
        box.type = "checkbox";
        box.checked = draft.keepCustom;
        box.dataset["focus"] = "keep-custom";
        box.setAttribute("aria-label", "Use my custom theme");
        box.addEventListener("change", () => { draft.keepCustom = box.checked; repaint(); });
        el(row, "span", "Use my custom theme").style.flex = "1";
      }
      if (ctx.flags?.["anybandui.themeEditor"] === true && hasOpener("theme-editor")) {
        button(parent, "Edit colours", "open:theme-editor", () => { openMenu("theme-editor"); });
      } else el(parent, "p", "Turn on Theme on the Mods screen to edit the colours.").className = "muted";
      return;
    }
    const presets = el(parent, "div");
    presets.className = "tabs";
    for (const [label, value] of STRENGTH_PRESETS) {
      const node = mark(button(presets, label, `strength:${label}`, () => {
        for (const id of Object.keys(draft.strengths)) draft.strengths[id] = value;
        note = ""; repaint(`strength:${label}`);
      }));
      node.setAttribute("aria-pressed", String(Object.values(draft.strengths).every((v) => v === value)));
    }
    el(parent, "p", read
      ? "A preset sets every effect to the same strength. These are the strengths under this mod on the Mods screen."
      : "A preset sets every effect to the same strength.").className = "muted";
    for (const [group, members] of STRENGTH_GROUPS) {
      el(parent, "div", group).className = "section";
      for (const setting of members) {
        const on = ctx.flags?.[setting.flag] === true;
        const row = el(parent, "label");
        row.className = "field";
        el(row, "span", on ? setting.title : `${setting.title} (effect off)`).style.flex = "1";
        const range = el(row, "input");
        range.type = "range";
        range.min = "0";
        range.max = "100";
        range.step = "10";
        range.value = String(draft.strengths[setting.id] ?? 100);
        range.dataset["focus"] = `strength:${setting.id}`;
        range.setAttribute("aria-label", setting.title);
        const readout = el(row, "span", `${draft.strengths[setting.id] ?? 100}%`);
        range.addEventListener("input", () => {
          const next = Math.round(Number(range.value) / 10) * 10;
          if (!Number.isFinite(next)) return;
          draft.strengths[setting.id] = Math.max(0, Math.min(100, next));
          readout.textContent = `${draft.strengths[setting.id]}%`;
        });
        range.addEventListener("change", () => repaint());
      }
    }
  };

  const render = (mount: HTMLElement): void => {
    rebase();
    el(mount, "h2", "Settings");
    const split = el(mount, "div");
    split.className = "split";
    const nav = el(split, "div");
    nav.className = "nav";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-orientation", "vertical");
    let group = "";
    for (const info of PAGES) {
      if (info.group !== group) { el(nav, "div", info.group === "Play" ? "PLAY" : "PRESENTATION").className = "group"; group = info.group; }
      const tab = button(nav, info.title, pageFocus(info.id), () => { if (page !== info.id) { pageNote = null; renaming = null; } page = info.id; repaint(pageFocus(info.id)); });
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(info.id === page));
    }
    el(nav, "p", "Changes apply when you save, except on Save game and Layout.").className = "muted";
    const content = el(split, "div");
    content.className = "page";
    const info = PAGES.find((p) => p.id === page) ?? PAGES[0]!;
    renderPage(content, info);
    nav.addEventListener("keydown", (event: KeyboardEvent) => {
      if (confirm) return;
      const at = PAGES.findIndex((p) => p.id === page);
      const next = listStep(event.key, at, PAGES.length);
      if (next !== null) { swallow(event); pageNote = null; renaming = null; page = PAGES[next]!.id; repaint(pageFocus(page)); return; }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        const first = Array.from(content.querySelectorAll<HTMLElement>("[data-focus]")).find((node) => node.dataset["first"] === "true")
          ?? content.querySelector<HTMLElement>("[data-focus]");
        if (first) { swallow(event); first.focus(); }
        return;
      }
      if (event.key === "Escape" && changed()) { swallow(event); cancel(pageFocus(page)); }
    });
    // Escape in a page backs out to the page list.
    content.addEventListener("keydown", (event: KeyboardEvent) => {
      if (confirm || event.key !== "Escape") return;
      swallow(event);
      repaint(pageFocus(page));
    });
    if (confirm) renderConfirm(mount, confirm, () => { confirm = null; repaint(confirmReturn); });
    const actions = el(mount, "div");
    actions.className = "actions";
    const busy = confirm !== null;
    button(actions, "Save", "save", save).disabled = busy || !changed();
    button(actions, "Cancel", "cancel", () => cancel("cancel")).disabled = busy;
    if (note) el(mount, "p", note).className = "note";
  };

  surface = openMenuSurface(ctx, { key: SETTINGS_KEY, label: "Settings", tab: "Settings", minSize: { width: 420, height: 260 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: pageFocus(page) }, render);
  if (!surface) { history?.close(); ctx.log("settings window: panel seam unavailable"); return () => {}; }
  // A theme saved elsewhere redraws this window, so its Save button and theme choice catch up at once.
  const stopTheme = onThemeChange(() => repaint());
  // So does a strength moved on the Mods screen, and a layout change for Undo and Redo.
  let stopSettings = (): void => {};
  try { stopSettings = seam?.onChange(() => repaint()) ?? stopSettings; } catch { /* the window catches up on its next redraw */ }
  const stopHistory = history?.onChange(() => { if (page === "layout") repaint(); }) ?? ((): void => {});
  return () => { stopTheme(); stopSettings(); stopHistory(); history?.close(); surface?.close(); surface = null; };
}
