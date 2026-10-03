import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModKeybinding, ModKeybindings } from "@rpgm-tools/neo-angband-core";
import { bindingDiff, conflictNote, draftFromList, installKeybindingEditor } from "./keybinding-editor.js";
import { installDomGlobals, overlayUi, paneUi } from "./test-dom.js";
import { openMenu } from "./openers.js";

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function seam(keys: (string | null)[] = []): ModKeybindings & { set: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; stored: Map<string, ModKeybinding>; mode: { keyset: "original" | "roguelike" } } {
  const stored = new Map<string, ModKeybinding>([
    ["F1", { trigger: "F1", action: "R&\\e", owner: null }],
    ["F2", { trigger: "F2", action: "maa", owner: null }],
    ["F5", { trigger: "F5", action: "v1", owner: "Squire" }],
  ]);
  const mode = { keyset: "original" as "original" | "roguelike" };
  const set = vi.fn((trigger: string, action: string) => { if (trigger === "Pause") return false; stored.set(trigger, { trigger, action, owner: null }); return true; });
  const remove = vi.fn((trigger: string) => stored.delete(trigger));
  return {
    keyset: () => mode.keyset,
    list: () => [...stored.values()],
    set,
    remove,
    capture: () => Promise.resolve(keys.length > 0 ? keys.shift()! : null),
    stored,
    mode,
  };
}

/** A seam whose captures wait until the test ends them, with the newer host's cancel when asked for. */
function waitingSeam(withCancel = false): ReturnType<typeof seam> & { waits: ((key: string | null) => void)[]; cancelCapture?: ReturnType<typeof vi.fn> } {
  const base = seam();
  const waits: ((key: string | null) => void)[] = [];
  const capture = (): Promise<string | null> => new Promise((resolve) => { waits.push(resolve); });
  const extra = withCancel ? { cancelCapture: vi.fn(() => { const wait = waits.shift(); wait?.(null); return wait !== undefined; }) } : {};
  return Object.assign(base, { capture, waits }, extra);
}

describe("keybinding editor", () => {
  let restore = (): void => {};
  let cleanup = (): void => {};
  beforeEach(() => { restore = installDomGlobals(); });
  afterEach(() => { cleanup(); cleanup = () => {}; restore(); });

  it("installs nothing with its switch off", () => {
    const openPanel = vi.fn();
    cleanup = installKeybindingEditor({ flags: {}, log: () => {}, ui: { openPanel }, keybindings: seam() });
    expect(openPanel).not.toHaveBeenCalled();
    expect(openMenu("keybinding-editor")).toBe(false);
  });

  it("works out what Save removes and sets", () => {
    const original = seam().list();
    const draft = draftFromList(original);
    draft.delete("F1");
    draft.set("F2", { action: "mab", owner: null });
    draft.set("F6", { action: "q1", owner: null });
    expect(bindingDiff(original, draft)).toEqual({ remove: ["F1"], set: [["F2", "mab"], ["F6", "q1"]] });
  });

  it("counts taking over a mod's keymap as a change even with the same keys", () => {
    const original = seam().list();
    const draft = draftFromList(original);
    draft.set("F5", { action: "v1", owner: null });
    expect(bindingDiff(original, draft)).toEqual({ remove: [], set: [["F5", "v1"]] });
  });

  it("saves a mod's keymap as the player's when its form is applied unchanged", () => {
    const { root, ui } = overlayUi();
    const keybindings = seam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("key:F5")!.click();
    expect(root.text()).toContain("saving makes it yours");
    root.byFocus("apply")!.click();
    expect(root.byFocus("save")?.disabled).toBe(false);
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(keybindings.set).toHaveBeenCalledWith("F5", "v1");
    expect(keybindings.stored.get("F5")?.owner).toBeNull();
  });

  it("says what a key runs now before it is bound", () => {
    const draft = draftFromList(seam().list());
    expect(conflictNote("F2", draft, null)).toBe("Currently: F2 runs maa. This keymap replaces it.");
    expect(conflictNote("F5", draft, null)).toContain("set by the Squire mod");
    expect(conflictNote("F2", draft, "F2")).toBe("Currently: F2 runs maa.");
    expect(conflictNote("F5", draft, "F5")).toBe("Currently: F5 runs v1. It was set by the Squire mod, and saving makes it yours.");
    expect(conflictNote("4", draft, null)).toContain("moves your character");
    expect(conflictNote("F9", draft, null)).toBe("Currently: F9 has no keymap. A keymap runs instead of the game's own command for that key.");
  });

  it("adds a keymap from a captured key, warns about a conflict, and saves only after Yes", async () => {
    const { root, ui } = overlayUi();
    const keybindings = seam(["F2"]);
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    expect(root.text()).toContain("Keyset: Original.");
    root.byFocus("add")!.click();
    expect(root.text()).toContain("Press the key to bind.");
    await flush();
    expect(root.text()).toContain("Currently: F2 runs maa. This keymap replaces it.");
    expect(root.focused()).toBe("action");
    root.byFocus("action")!.enter("mbb");
    root.byFocus("action")!.fire("keydown", "Enter");
    expect(root.focused()).toBe("key:F2");
    expect(keybindings.set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    expect(root.text()).toContain("Save 1 change to your original keymaps?");
    expect(root.focused()).toBe("confirm-no");
    root.byFocus("confirm-no")!.click();
    expect(keybindings.set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(keybindings.set).toHaveBeenCalledWith("F2", "mbb");
    expect(keybindings.stored.get("F2")?.action).toBe("mbb");
    expect(root.text()).toContain("Saved.");
  });

  it("closes a new keymap when the capture is cancelled", async () => {
    const { root, ui } = overlayUi();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings: seam([null]) });
    root.byFocus("add")!.click();
    await flush();
    expect(root.text()).not.toContain("New keymap");
    expect(root.focused()).toBe("add");
  });

  it("leaves the panel unfocused and its Cancel off while a capture waits, so Escape ends it", async () => {
    const { root, ui } = overlayUi();
    const keybindings = waitingSeam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("add")!.focus();
    root.byFocus("add")!.click();
    expect(root.text()).toContain("Press the key to bind. Escape cancels.");
    expect(root.focused()).toBeUndefined();
    expect(root.byFocus("form-cancel")?.disabled).toBe(true);
    expect(root.byFocus("key:F1")?.disabled).toBe(true);
    root.byFocus("form-cancel")!.fire("click");
    expect(root.text()).toContain("New keymap");
    keybindings.waits.shift()!(null);
    await flush();
    expect(root.text()).not.toContain("New keymap");
    expect(root.focused()).toBe("add");
  });

  it("drops a capture the host interrupts by hiding the pane, and ignores the key that ends it", async () => {
    const pane = paneUi();
    const keybindings = waitingSeam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui: pane.ui, keybindings });
    pane.root.byFocus("key:F1")!.click();
    pane.root.byFocus("capture")!.click();
    expect(pane.root.text()).toContain("Press the key to bind.");
    pane.unmount();
    keybindings.waits.shift()!("F9");
    await flush();
    pane.remount();
    expect(pane.root.text()).toContain("Change keymap");
    expect(pane.root.text()).toContain("Key: F1");
    expect(pane.root.text()).not.toContain("F9");
    expect(pane.root.byFocus("form-cancel")?.disabled).toBe(false);
    pane.root.byFocus("form-cancel")!.click();
    pane.root.byFocus("add")!.click();
    pane.unmount();
    keybindings.waits.shift()!("F9");
    await flush();
    pane.remount();
    expect(pane.root.text()).not.toContain("New keymap");
    expect(pane.root.byFocus("add")?.disabled).toBe(false);
  });

  it("stops a waiting capture when the panel goes away, on a host that can", () => {
    const pane = paneUi();
    const keybindings = waitingSeam(true);
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui: pane.ui, keybindings });
    pane.root.byFocus("add")!.click();
    pane.unmount();
    expect(keybindings.cancelCapture).toHaveBeenCalledTimes(1);
    pane.remount();
    pane.root.byFocus("add")!.click();
    cleanup(); cleanup = () => {};
    expect(keybindings.cancelCapture).toHaveBeenCalledTimes(2);
    expect(keybindings.waits).toHaveLength(0);
  });

  it("removes rows with Delete, moves with arrows, and runs removals on Save", () => {
    const { root, ui } = overlayUi();
    const keybindings = seam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("key:F1")!.focus();
    root.byFocus("key:F1")!.fire("keydown", "ArrowDown");
    expect(root.focused()).toBe("key:F2");
    root.byFocus("key:F2")!.fire("keydown", "Delete");
    expect(root.byFocus("key:F2")).toBeUndefined();
    expect(root.focused()).toBe("key:F5");
    expect(keybindings.remove).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(keybindings.remove).toHaveBeenCalledWith("F2");
    expect(keybindings.stored.has("F2")).toBe(false);
  });

  it("edits a keymap from its row and Escape closes the form", () => {
    const { root, ui } = overlayUi();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings: seam() });
    root.byFocus("key:F1")!.click();
    expect(root.text()).toContain("Change keymap");
    expect(root.focused()).toBe("action");
    root.byFocus("action")!.fire("keydown", "Escape");
    expect(root.text()).not.toContain("Change keymap");
    expect(root.focused()).toBe("key:F1");
  });

  it("asks before Cancel or Escape throws a draft away", () => {
    const { root, ui } = overlayUi();
    const keybindings = seam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("clear")!.click();
    expect(root.byFocus("key:F1")).toBeUndefined();
    expect(root.byFocus("key:F5")).toBeDefined();
    root.byFocus("save")!.fire("keydown", "Escape");
    expect(root.text()).toContain("Throw away your changes to the keymaps?");
    root.byFocus("confirm-no")!.click();
    expect(root.byFocus("key:F1")).toBeUndefined();
    root.byFocus("cancel")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(root.byFocus("key:F1")).toBeDefined();
    expect(root.text()).toContain("Changes discarded.");
    expect(keybindings.remove).not.toHaveBeenCalled();
  });

  it("refuses to save over a keyset that changed, and names refused keys", () => {
    const { root, ui } = overlayUi();
    const keybindings = seam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("key:F1")!.focus();
    root.byFocus("key:F1")!.fire("keydown", "Delete");
    keybindings.mode.keyset = "roguelike";
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(root.text()).toContain("The keyset changed while you were editing.");
    expect(keybindings.remove).not.toHaveBeenCalled();
    keybindings.mode.keyset = "original";
    cleanup(); cleanup = () => {};
    const second = overlayUi();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui: second.ui, keybindings: seam(["Pause"]) });
    second.root.byFocus("add")!.click();
    return flush().then(() => {
      second.root.byFocus("action")!.enter("z");
      second.root.byFocus("apply")!.click();
      second.root.byFocus("save")!.click();
      second.root.byFocus("confirm-yes")!.click();
      expect(second.root.text()).toContain("The game refused a keymap for Pause.");
    });
  });

  it("says when the game shares no keymaps", () => {
    const { root, ui } = overlayUi();
    const log = vi.fn();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log, ui });
    expect(log).toHaveBeenCalledWith("keybinding editor: this game does not share its keymaps");
    expect(root.text()).toContain("This game does not share its keymaps.");
  });
});
