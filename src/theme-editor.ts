/**
 * Edits the current theme's background, surface, text, accent and rounding,
 * and whether the dungeon view is inverted. Save stores a custom theme.
 */
import type { ModDisplay } from "@rpgm-tools/neo-angband-core";
import { installAccessibilityAccommodations } from "./accessibility.js";
import { chromeThemeFor } from "./paint.js";
import { createSettingsStore, themeFromPrefs, type Settings } from "./settings.js";
import { applyTheme, normalizeColour, normalizeRounding, notifyThemeChange, themeChoices, THEMES, type CustomTheme, type ThemeTokens } from "./theme.js";
import { openSurfaces, type SurfaceContext } from "./panels/surface.js";
import { registerOpener } from "./menus/openers.js";

const CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.theme{position:absolute;right:12px;top:12px;width:min(420px,44vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
button,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid var(--anyband-accent)}
.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}.actions{display:flex;gap:6px;margin-top:8px}
.preview{margin-top:8px;padding:8px;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
.preview b{color:var(--anyband-accent)}.note{opacity:.7}`;

export interface ThemeEditorContext extends Omit<SurfaceContext, "prefs"> {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly prefs?: { get(): unknown; set(value: unknown): void } | undefined;
  readonly display?: Pick<ModDisplay, "setVisualFilter"> & Partial<Pick<ModDisplay, "getVisualFilter" | "setChromeTheme">> | undefined;
}

export interface ThemeDraft {
  background: string;
  surface: string;
  text: string;
  accent: string;
  rounding: number;
  invert_dungeon: boolean;
  preset: Settings["theme"];
}

export function draftFromTheme(theme: ThemeTokens, preset: Settings["theme"]): ThemeDraft {
  return {
    background: theme.background, surface: theme.surface, text: theme.text, accent: theme.accent,
    rounding: theme.rounding, invert_dungeon: theme.invert_dungeon, preset,
  };
}

export function customFromDraft(draft: ThemeDraft): CustomTheme | null {
  const background = normalizeColour(draft.background);
  const surface = normalizeColour(draft.surface);
  const text = normalizeColour(draft.text);
  const accent = normalizeColour(draft.accent);
  const rounding = normalizeRounding(draft.rounding);
  if (!background || !surface || !text || !accent || rounding === null) return null;
  return { background, surface, text, accent, rounding, invert_dungeon: draft.invert_dungeon };
}

function el(parent: Element, tag: string, text?: string): HTMLElement {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== undefined) child.textContent = text;
  parent.appendChild(child);
  return child;
}

function colourField(parent: HTMLElement, label: string, key: "background" | "surface" | "text" | "accent", draft: ThemeDraft, onPreview: () => void): void {
  const row = el(parent, "label", label);
  const input = el(row, "input") as HTMLInputElement;
  input.type = "color";
  input.value = draft[key].slice(0, 7);
  input.setAttribute("aria-label", label);
  input.dataset["focus"] = key;
  input.addEventListener("input", () => {
    const next = normalizeColour(input.value);
    if (next) draft[key] = next;
    onPreview();
  });
}

export function renderThemeEditor(parent: HTMLElement, draft: ThemeDraft, note: string, onPreview: () => void, onRebuild: () => void, onSave: () => void, onDrop: () => void): void {
  el(parent, "h2", "Theme");
  const presets = el(parent, "div");
  presets.className = "tabs";
  for (const [id, label] of themeChoices()) {
    const button = el(presets, "button", label) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("aria-pressed", String(draft.preset === id && !draft.invert_dungeon && draft.rounding === THEMES[id]!.rounding && draft.background === THEMES[id]!.background));
    button.addEventListener("click", () => {
      const theme = THEMES[id]!;
      draft.preset = id;
      draft.background = theme.background;
      draft.surface = theme.surface;
      draft.text = theme.text;
      draft.accent = theme.accent;
      draft.rounding = theme.rounding;
      draft.invert_dungeon = theme.invert_dungeon;
      onRebuild();
    });
  }
  colourField(parent, "Background", "background", draft, onPreview);
  colourField(parent, "Surface", "surface", draft, onPreview);
  colourField(parent, "Text", "text", draft, onPreview);
  colourField(parent, "Accent", "accent", draft, onPreview);
  const rounding = el(parent, "label", "Corner rounding");
  const range = el(rounding, "input") as HTMLInputElement;
  range.type = "range";
  range.min = "0";
  range.max = "16";
  range.step = "1";
  range.value = String(draft.rounding);
  range.setAttribute("aria-label", "Corner rounding");
  range.dataset["focus"] = "rounding";
  const readout = el(rounding, "span", `${draft.rounding} px`);
  range.addEventListener("input", () => {
    const next = normalizeRounding(Number(range.value));
    if (next !== null) { draft.rounding = next; readout.textContent = `${next} px`; onPreview(); }
  });
  const invert = el(parent, "label", "Invert dungeon colours");
  const box = el(invert, "input") as HTMLInputElement;
  box.type = "checkbox";
  box.checked = draft.invert_dungeon;
  box.setAttribute("aria-label", "Invert dungeon colours");
  box.dataset["focus"] = "invert";
  box.addEventListener("change", () => { draft.invert_dungeon = box.checked; onPreview(); });
  const preview = el(parent, "div");
  preview.className = "preview";
  el(preview, "b", "Adventurer");
  el(preview, "p", "A new chapter awaits.");
  const actions = el(parent, "div");
  actions.className = "actions";
  const save = el(actions, "button", "Save") as HTMLButtonElement;
  save.type = "button";
  save.addEventListener("click", onSave);
  const drop = el(actions, "button", "Drop custom theme") as HTMLButtonElement;
  drop.type = "button";
  drop.addEventListener("click", onDrop);
  if (note) el(parent, "p", note).className = "note";
}

/** Tells the window frames, the dungeon inversion and every open card about a saved theme. */
export function broadcastTheme(ctx: Pick<ThemeEditorContext, "flags" | "display" | "log">, theme: ThemeTokens): void {
  try { ctx.display?.setChromeTheme?.(chromeThemeFor(theme)); } catch (err) { ctx.log(`Could not repaint the window frames: ${err instanceof Error ? err.message : String(err)}`); }
  installAccessibilityAccommodations({ flags: ctx.flags ?? {}, invertDungeon: theme.invert_dungeon, ...(ctx.display ? { display: ctx.display } : {}), log: ctx.log });
  notifyThemeChange(theme);
}

export function installThemeEditor(ctx: ThemeEditorContext): () => void {
  if (ctx.flags?.["anybandui.themeEditor"] !== true) return () => {};
  const settings = ctx.prefs ? createSettingsStore({ prefs: ctx.prefs }) : null;
  let draft = draftFromTheme(themeFromPrefs(ctx.prefs?.get()), settings?.get().theme ?? "terminal-original");
  let note = "";
  let repaint = (): void => {};
  const surfaces = openSurfaces(ctx, [{ key: "theme-editor", label: "Theme", tab: "Theme", minSize: { width: 280, height: 220 }, placement: { kind: "dock", target: "main", edge: "right" } }],
    { id: "theme-editor", label: "Theme", className: "theme" }, CSS, () => repaint());
  if (!surfaces) { ctx.log("theme: panel seam unavailable"); return () => {}; }
  // The settings window opens this panel rather than drawing a second colour editor.
  const stopOpener = registerOpener("theme-editor", () => { surfaces.focus("theme-editor"); repaint(); });
  let mount: HTMLElement | null = null;
  let closed = false;
  const tokens = (): ThemeTokens => themeFromPrefs(customFromDraft(draft) ? { theme: draft.preset, customTheme: customFromDraft(draft) } : { theme: draft.preset });
  // A host without the ShadowRoot global still stores the theme.
  const paintedRoot = (): ShadowRoot | null => {
    const root = mount?.getRootNode();
    return typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root : null;
  };
  const preview = (): void => {
    const root = paintedRoot();
    if (root) applyTheme(root, tokens());
  };
  const applySaved = (theme: ThemeTokens): void => {
    const root = paintedRoot();
    if (root) applyTheme(root, theme);
    broadcastTheme(ctx, theme);
  };
  const paint = (): void => {
    if (closed) return;
    const host = surfaces.mounts().get("theme-editor");
    if (!host) return;
    mount = host;
    const active = (mount.getRootNode() as ShadowRoot).activeElement as HTMLInputElement | null;
    const focusKey = active && mount.contains(active) ? active.dataset?.["focus"] : undefined;
    const caret = focusKey && active ? [active.selectionStart, active.selectionEnd] as const : null;
    mount.replaceChildren();
    preview();
    renderThemeEditor(mount, draft, note, preview, () => paint(), () => {
      const custom = customFromDraft(draft);
      if (!custom || !settings) { note = "Theme preferences are unavailable."; paint(); return; }
      settings.set({ theme: draft.preset, customTheme: custom });
      note = "Saved.";
      applySaved(themeFromPrefs(settings.get()));
      paint();
    }, () => {
      if (!settings) { note = "Theme preferences are unavailable."; paint(); return; }
      settings.set({ customTheme: null });
      const theme = themeFromPrefs(settings.get());
      draft = draftFromTheme(theme, settings.get().theme);
      note = "Using the preset.";
      applySaved(theme);
      paint();
    });
    if (focusKey) {
      const field = mount.querySelector<HTMLInputElement>(`[data-focus="${focusKey}"]`);
      field?.focus();
      if (field && caret && caret[0] !== null) field.setSelectionRange(caret[0], caret[1]);
    }
  };
  paint();
  repaint = () => paint();
  return () => { closed = true; stopOpener(); surfaces.close(); };
}
