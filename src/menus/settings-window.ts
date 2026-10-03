/**
 * The settings window (AnybandUI client.cpp:760-1010): a page list on the left
 * in Play and Presentation groups, the page on the right, and Save and Cancel
 * under both. It gathers this mod's own settings: the theme preset, the hover
 * delay and the effect strengths, each with presets. Everything is a draft
 * until Save. The game options, keybindings, knowledge and colour editors are
 * their own panels, and their pages here open them.
 */
import type { ModDisplay, ModPluginContext } from "@rpgm-tools/neo-angband-core";
import type { SurfaceContext } from "../panels/surface.js";
import { STRENGTH_SETTINGS } from "../effects.js";
import { createSettingsStore, themeFromPrefs, validateSettings, type Settings } from "../settings.js";
import { broadcastTheme } from "../theme-editor.js";
import { onThemeChange, themeChoices } from "../theme.js";
import { CONFIRM_NO, renderConfirm, type Confirmation } from "./inline-confirm.js";
import { button, el, listStep, swallow } from "./keys.js";
import { KEYBINDINGS_KEY } from "./keybinding-editor.js";
import { KNOWLEDGE_KEY } from "./knowledge-browser.js";
import { openMenuSurface } from "./menu-surface.js";
import { hasOpener, openMenu } from "./openers.js";
import { OPTIONS_KEY } from "./options-editor.js";

export const SETTINGS_KEY = "settings-window";

export interface SettingsWindowContext extends SurfaceContext {
  readonly prefs?: { get(): unknown; set(value: unknown): void } | undefined;
  readonly settings?: Pick<NonNullable<ModPluginContext["settings"]>, "get"> | undefined;
  readonly display?: Pick<ModDisplay, "setVisualFilter"> & Partial<Pick<ModDisplay, "getVisualFilter" | "setChromeTheme">> | undefined;
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
  { id: "theme", group: "Presentation", title: "Theme", summary: "The colours of this mod's panels and window frames." },
  { id: "effects", group: "Presentation", title: "Effects", summary: "How strongly each dungeon effect is drawn." },
];

export interface SettingsDraft {
  theme: Settings["theme"];
  keepCustom: boolean;
  hoverDelayMs: number;
  /** By setting id; used only where the game has no numeric settings of its own. */
  strengths: Record<string, number>;
}

export function draftFromSettings(settings: Readonly<Settings>): SettingsDraft {
  const strengths: Record<string, number> = {};
  for (const [, members] of STRENGTH_GROUPS) for (const setting of members) {
    const stored = cueKindsFor(setting.id).map((kind) => settings.effects[kind]).find((value) => typeof value === "number");
    strengths[setting.id] = stored ?? 100;
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
  // The game's Mods screen owns the strengths where it has numeric settings; this mod's own copy is only a fallback.
  const gameOwnsStrengths = ctx.settings !== undefined;
  /* The stored settings the draft was made from. When they change elsewhere,
   * the draft follows them for every field the player has not touched here. */
  let base = draftFromSettings(current());
  let draft = draftFromSettings(current());
  const rebase = (): void => {
    const fresh = draftFromSettings(current());
    if (JSON.stringify(fresh) === JSON.stringify(base)) return;
    draft = rebaseDraft(base, draft, fresh);
    base = fresh;
  };
  const reset = (): void => { base = draftFromSettings(current()); draft = draftFromSettings(current()); };
  let page = PAGES[0]!.id;
  let confirm: Confirmation | null = null;
  let note = "";

  let surface: ReturnType<typeof openMenuSurface> = null;
  const repaint = (focusKey?: string): void => surface?.repaint(focusKey);
  const pending = (): Partial<Settings> => { rebase(); return settingsPatch(current(), draft, !gameOwnsStrengths); };
  const changed = (): boolean => Object.keys(pending()).length > 0;
  const ask = (next: Confirmation): void => { confirm = next; repaint(CONFIRM_NO); };

  const commit = (): void => {
    if (!ctx.prefs) { note = "This game does not keep this mod's settings."; repaint("save"); return; }
    const before = JSON.stringify(themeFromPrefs(ctx.prefs.get()));
    const store = createSettingsStore({ prefs: ctx.prefs });
    store.set(pending());
    reset();
    const theme = themeFromPrefs(ctx.prefs?.get());
    if (JSON.stringify(theme) !== before) broadcastTheme(ctx, theme);
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
    if (gameOwnsStrengths) el(parent, "p", "The game keeps these on its Mods screen, under this mod. Change them there.").className = "muted";
    else {
      const presets = el(parent, "div");
      presets.className = "tabs";
      for (const [label, value] of STRENGTH_PRESETS) {
        const node = mark(button(presets, label, `strength:${label}`, () => {
          for (const id of Object.keys(draft.strengths)) draft.strengths[id] = value;
          note = ""; repaint(`strength:${label}`);
        }));
        node.setAttribute("aria-pressed", String(Object.values(draft.strengths).every((v) => v === value)));
      }
      el(parent, "p", "A preset sets every effect to the same strength.").className = "muted";
    }
    for (const [group, members] of STRENGTH_GROUPS) {
      el(parent, "div", group).className = "section";
      for (const setting of members) {
        const on = ctx.flags?.[setting.flag] === true;
        const row = el(parent, "label");
        row.className = "field";
        el(row, "span", on ? setting.title : `${setting.title} (effect off)`).style.flex = "1";
        if (gameOwnsStrengths) {
          let value: number | undefined;
          try { value = ctx.settings?.get(setting.id); } catch { value = undefined; }
          el(row, "span", typeof value === "number" ? `${value}%` : "100%");
          continue;
        }
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
      const tab = button(nav, info.title, pageFocus(info.id), () => { page = info.id; repaint(pageFocus(info.id)); });
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(info.id === page));
    }
    el(nav, "p", "Changes apply when you save.").className = "muted";
    const content = el(split, "div");
    content.className = "page";
    const info = PAGES.find((p) => p.id === page) ?? PAGES[0]!;
    renderPage(content, info);
    nav.addEventListener("keydown", (event: KeyboardEvent) => {
      if (confirm) return;
      const at = PAGES.findIndex((p) => p.id === page);
      const next = listStep(event.key, at, PAGES.length);
      if (next !== null) { swallow(event); page = PAGES[next]!.id; repaint(pageFocus(page)); return; }
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
    if (confirm) renderConfirm(mount, confirm, () => { confirm = null; repaint("save"); });
    const actions = el(mount, "div");
    actions.className = "actions";
    const busy = confirm !== null;
    button(actions, "Save", "save", save).disabled = busy || !changed();
    button(actions, "Cancel", "cancel", () => cancel("cancel")).disabled = busy;
    if (note) el(mount, "p", note).className = "note";
  };

  surface = openMenuSurface(ctx, { key: SETTINGS_KEY, label: "Settings", tab: "Settings", minSize: { width: 420, height: 260 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: pageFocus(page) }, render);
  if (!surface) { ctx.log("settings window: panel seam unavailable"); return () => {}; }
  // A theme saved elsewhere redraws this window, so its Save button and theme choice catch up at once.
  const stopTheme = onThemeChange(() => repaint());
  return () => { stopTheme(); surface?.close(); surface = null; };
}
