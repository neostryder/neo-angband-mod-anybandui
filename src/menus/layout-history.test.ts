import { describe, expect, it, vi } from "vitest";
import { createLayoutHistory, createSavedLayouts, HISTORY_LIMIT, readSavedLayouts, SAVED_LAYOUT_LIMIT, SAVED_LAYOUTS_KEY } from "./layout-history.js";

/** The game's window manager in small: a layout is any text that starts with "layout", and putting one back reports it as a change, at once or, as the game does, a microtask later. */
function fakeSubwindows(initial = "layout A", deferred = false) {
  let current = initial;
  const listeners = new Set<(text: string) => void>();
  const emit = (text: string): void => { for (const listener of [...listeners]) listener(text); };
  return {
    layout: vi.fn(() => current),
    setLayout: vi.fn((text: string) => {
      if (!text.startsWith("layout")) return false;
      current = text;
      if (deferred) queueMicrotask(() => emit(text)); else emit(text);
      return true;
    }),
    onLayoutChange: vi.fn((listener: (text: string) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }),
    /** The player dragging a panel: the game reports the new arrangement. */
    move(text: string) { current = text; emit(text); },
    listeners,
  };
}

function prefs(initial: Record<string, unknown> = {}) {
  let stored: Record<string, unknown> = { ...initial };
  return { get: (): unknown => stored, set: vi.fn((value: unknown) => { stored = value as Record<string, unknown>; }), value: () => stored };
}

describe("layout undo and redo", () => {
  it("undoes and redoes each reported change, and drops redo on a new one", () => {
    const seam = fakeSubwindows();
    const history = createLayoutHistory(seam);
    expect(history.canUndo()).toBe(false);
    seam.move("layout B");
    seam.move("layout C");
    expect(history.undo()).toBe(true);
    expect(seam.layout()).toBe("layout B");
    expect(history.undo()).toBe(true);
    expect(seam.layout()).toBe("layout A");
    expect(history.canUndo()).toBe(false);
    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(true);
    expect(seam.layout()).toBe("layout B");
    seam.move("layout D");
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toBe(true);
    expect(seam.layout()).toBe("layout B");
  });

  it("does not count the change its own restore reports, or a report of the same text", () => {
    const seam = fakeSubwindows();
    const history = createLayoutHistory(seam);
    const changed = vi.fn();
    history.onChange(changed);
    seam.move("layout B");
    expect(changed).toHaveBeenCalledTimes(1);
    history.undo();
    expect(seam.setLayout).toHaveBeenCalledWith("layout A");
    expect(changed).toHaveBeenCalledTimes(2);
    // The restore reported "layout A" back; it is not a step of its own.
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    seam.move("layout A");
    expect(history.canUndo()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("skips its own restore's report when the game sends it after setLayout returns", async () => {
    const seam = fakeSubwindows("layout A", true);
    const history = createLayoutHistory(seam);
    seam.move("layout B");
    expect(history.undo()).toBe(true);
    await Promise.resolve();
    expect(history.canUndo()).toBe(false);
    expect(history.redo()).toBe(true);
    await Promise.resolve();
    expect(seam.layout()).toBe("layout B");
    expect(history.canRedo()).toBe(false);
    expect(history.undo()).toBe(true);
    await Promise.resolve();
    expect(seam.layout()).toBe("layout A");
  });

  it("drops a step the game refuses, so the steps under it still work", () => {
    const seam = fakeSubwindows("not a layout");
    const history = createLayoutHistory(seam);
    seam.move("layout B");
    seam.move("layout C");
    expect(history.undo()).toBe(true);
    expect(seam.layout()).toBe("layout B");
    expect(history.undo()).toBe(false);
    expect(seam.layout()).toBe("layout B");
    expect(history.canUndo()).toBe(false);
    expect(history.redo()).toBe(true);
    expect(seam.layout()).toBe("layout C");
  });

  it("keeps the last 50 steps", () => {
    const seam = fakeSubwindows("layout 0");
    const history = createLayoutHistory(seam);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) seam.move(`layout ${i}`);
    let undone = 0;
    while (history.undo()) undone++;
    expect(undone).toBe(HISTORY_LIMIT);
    expect(seam.layout()).toBe("layout 10");
  });

  it("stops listening when closed", () => {
    const seam = fakeSubwindows();
    const history = createLayoutHistory(seam);
    const changed = vi.fn();
    history.onChange(changed);
    history.close();
    expect(seam.listeners.size).toBe(0);
    seam.move("layout B");
    expect(changed).not.toHaveBeenCalled();
    expect(history.canUndo()).toBe(false);
  });
});

describe("saved layouts", () => {
  it("saves, replaces, restores, renames and deletes layouts by name, keeping other settings", () => {
    const seam = fakeSubwindows();
    const store = prefs({ theme: "dark" });
    const saved = createSavedLayouts(seam, store);
    expect(saved.list()).toEqual([]);
    expect(saved.save("  Wide  ")).toEqual({ ok: true });
    seam.move("layout B");
    expect(saved.save("Tall")).toEqual({ ok: true });
    expect(saved.list()).toEqual([{ name: "Wide", layout: "layout A" }, { name: "Tall", layout: "layout B" }]);
    expect(store.value()["theme"]).toBe("dark");
    expect(store.value()[SAVED_LAYOUTS_KEY]).toMatchObject({ v: 1 });
    seam.move("layout C");
    expect(saved.save("Wide")).toEqual({ ok: true });
    expect(saved.list()[0]).toEqual({ name: "Wide", layout: "layout C" });
    expect(saved.restore("Tall")).toEqual({ ok: true });
    expect(seam.layout()).toBe("layout B");
    expect(saved.rename("Tall", "Narrow")).toEqual({ ok: true });
    expect(saved.rename("Narrow", "Wide")).toEqual({ ok: false, reason: "A layout called Wide is already saved." });
    expect(saved.remove("Wide")).toEqual({ ok: true });
    expect(saved.list()).toEqual([{ name: "Narrow", layout: "layout B" }]);
    expect(saved.remove("Wide")).toEqual({ ok: false, reason: "There is no saved layout called Wide." });
  });

  it("refuses an empty or long name, a missing layout, and a layout the game cannot use", () => {
    const seam = fakeSubwindows();
    const saved = createSavedLayouts(seam, prefs({ [SAVED_LAYOUTS_KEY]: { v: 1, entries: [{ name: "Old", layout: "broken" }] } }));
    expect(saved.save("   ")).toEqual({ ok: false, reason: "Type a name for the layout." });
    expect(saved.save("x".repeat(41))).toEqual({ ok: false, reason: "Use a name of 40 characters or fewer." });
    expect(saved.restore("Gone")).toEqual({ ok: false, reason: "There is no saved layout called Gone." });
    expect(saved.restore("Old")).toEqual({ ok: false, reason: "The game could not use the layout saved as Old." });
    expect(saved.rename("Gone", "New")).toEqual({ ok: false, reason: "There is no saved layout called Gone." });
  });

  it("keeps at most 32, though one already saved can still be replaced", () => {
    const seam = fakeSubwindows();
    const saved = createSavedLayouts(seam, prefs());
    for (let i = 0; i < SAVED_LAYOUT_LIMIT; i++) expect(saved.save(`L${i}`).ok).toBe(true);
    expect(saved.save("One more")).toEqual({ ok: false, reason: "You can keep 32 saved layouts. Delete one first." });
    expect(saved.save("L3").ok).toBe(true);
  });

  it("reads only well-formed entries, once per name", () => {
    expect(readSavedLayouts(null)).toEqual([]);
    expect(readSavedLayouts({ [SAVED_LAYOUTS_KEY]: { v: 1, entries: [{ name: "A", layout: "x" }, { name: "A", layout: "y" }, { name: "", layout: "z" }, { name: "B" }, 7] } }))
      .toEqual([{ name: "A", layout: "x" }]);
  });
});
