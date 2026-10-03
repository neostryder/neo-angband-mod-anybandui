/**
 * Undo and redo for the panel layout, and layouts saved by name (AnybandUI
 * workspace_layout.h:82-110 and :318-335), over the game's own window manager.
 *
 * The game owns the arrangement. ctx.subwindows.layout() hands it out as the
 * text of a layout export, setLayout() puts one back, and onLayoutChange()
 * reports each finished change, a drag once at pointer-up. The history keeps
 * the last text it saw and pushes it when different text arrives. Undo puts
 * the previous text back and skips the report that restore causes, since a
 * layout reads back byte for byte.
 *
 * Upstream records history only while its Customize layout mode is on, and
 * keeps 64 steps. The game's manager has no such mode, so every change counts
 * and the last 50 are kept. Saved layouts sit in this mod's own storage, 32 at
 * most, as upstream allows.
 */
import type { ModSubwindows } from "@rpgm-tools/neo-angband-core";

export type LayoutSeam = Pick<ModSubwindows, "layout" | "setLayout" | "onLayoutChange">;

export const HISTORY_LIMIT = 50;

export interface LayoutHistory {
  canUndo(): boolean;
  canRedo(): boolean;
  /** False when there is nothing to undo, or the game refused the old layout. */
  undo(): boolean;
  redo(): boolean;
  /** Runs after the history changes, for a window that shows Undo and Redo. */
  onChange(listener: () => void): () => void;
  close(): void;
}

export function createLayoutHistory(seam: LayoutSeam, limit = HISTORY_LIMIT): LayoutHistory {
  const undoSteps: string[] = [];
  const redoSteps: string[] = [];
  const listeners = new Set<() => void>();
  let last = seam.layout();
  /* The text this history just restored. Its own report comes back with that
   * text, and is not a new change. */
  let restoring: string | null = null;
  const notify = (): void => { for (const listener of [...listeners]) listener(); };

  const stop = seam.onLayoutChange((text) => {
    if (restoring !== null && text === restoring) { restoring = null; last = text; return; }
    restoring = null;
    if (text === last) return;
    undoSteps.push(last);
    if (undoSteps.length > limit) undoSteps.splice(0, undoSteps.length - limit);
    redoSteps.length = 0;
    last = text;
    notify();
  });

  /* Move one step from `from` to `to`. A layout the game refuses is dropped,
   * so a step that cannot be restored does not block the ones under it. The
   * restore's own report may come during setLayout or after it. */
  const step = (from: string[], to: string[]): boolean => {
    const target = from.pop();
    if (target === undefined) return false;
    const previous = last;
    restoring = target;
    let ok = false;
    try { ok = seam.setLayout(target); } catch { ok = false; }
    if (!ok) { restoring = null; notify(); return false; }
    to.push(previous);
    last = target;
    notify();
    return true;
  };

  return {
    canUndo: () => undoSteps.length > 0,
    canRedo: () => redoSteps.length > 0,
    undo: () => step(undoSteps, redoSteps),
    redo: () => step(redoSteps, undoSteps),
    onChange(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    close() { stop(); listeners.clear(); },
  };
}

export const SAVED_LAYOUTS_KEY = "savedLayouts";
export const SAVED_LAYOUT_LIMIT = 32;
export const LAYOUT_NAME_MAX = 40;

export interface SavedLayout { readonly name: string; readonly layout: string }

interface PrefsSeam { get(): unknown; set(value: unknown): void }

/** The saved layouts in the order they were first saved. Anything unreadable is left out. */
export function readSavedLayouts(raw: unknown): SavedLayout[] {
  const root = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const block = root[SAVED_LAYOUTS_KEY];
  const entries = block !== null && typeof block === "object" && !Array.isArray(block) ? (block as { entries?: unknown }).entries : undefined;
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: SavedLayout[] = [];
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object") continue;
    const { name, layout } = entry as { name?: unknown; layout?: unknown };
    if (typeof name !== "string" || typeof layout !== "string" || !name.trim() || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, layout });
  }
  return out.slice(0, SAVED_LAYOUT_LIMIT);
}

export type SavedLayoutResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface SavedLayouts {
  list(): readonly SavedLayout[];
  /** Save the current layout under a name, replacing a layout already saved under it. */
  save(name: string): SavedLayoutResult;
  restore(name: string): SavedLayoutResult;
  rename(from: string, to: string): SavedLayoutResult;
  remove(name: string): SavedLayoutResult;
}

const refuse = (reason: string): SavedLayoutResult => ({ ok: false, reason });

export function createSavedLayouts(seam: Pick<LayoutSeam, "layout" | "setLayout">, prefs: PrefsSeam): SavedLayouts {
  const write = (entries: readonly SavedLayout[]): void => {
    const stored = prefs.get();
    const root = stored !== null && typeof stored === "object" && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
    prefs.set({ ...root, [SAVED_LAYOUTS_KEY]: { v: 1, entries: entries.map(({ name, layout }) => ({ name, layout })) } });
  };
  const check = (name: string): string | null => {
    if (!name) return "Type a name for the layout.";
    if (name.length > LAYOUT_NAME_MAX) return `Use a name of ${LAYOUT_NAME_MAX} characters or fewer.`;
    return null;
  };
  return {
    list: () => readSavedLayouts(prefs.get()),
    save(raw) {
      const name = raw.trim();
      const problem = check(name);
      if (problem) return refuse(problem);
      const entries = readSavedLayouts(prefs.get());
      const at = entries.findIndex((entry) => entry.name === name);
      if (at < 0 && entries.length >= SAVED_LAYOUT_LIMIT) return refuse(`You can keep ${SAVED_LAYOUT_LIMIT} saved layouts. Delete one first.`);
      const saved = { name, layout: seam.layout() };
      if (at < 0) entries.push(saved); else entries[at] = saved;
      write(entries);
      return { ok: true };
    },
    restore(name) {
      const entry = readSavedLayouts(prefs.get()).find((saved) => saved.name === name);
      if (!entry) return refuse(`There is no saved layout called ${name}.`);
      return seam.setLayout(entry.layout) ? { ok: true } : refuse(`The game could not use the layout saved as ${name}.`);
    },
    rename(from, raw) {
      const to = raw.trim();
      const problem = check(to);
      if (problem) return refuse(problem);
      const entries = readSavedLayouts(prefs.get());
      const at = entries.findIndex((entry) => entry.name === from);
      if (at < 0) return refuse(`There is no saved layout called ${from}.`);
      if (to === from) return { ok: true };
      if (entries.some((entry) => entry.name === to)) return refuse(`A layout called ${to} is already saved.`);
      entries[at] = { name: to, layout: entries[at]!.layout };
      write(entries);
      return { ok: true };
    },
    remove(name) {
      const entries = readSavedLayouts(prefs.get());
      const rest = entries.filter((entry) => entry.name !== name);
      if (rest.length === entries.length) return refuse(`There is no saved layout called ${name}.`);
      write(rest);
      return { ok: true };
    },
  };
}
