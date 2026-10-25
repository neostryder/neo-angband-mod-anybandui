import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModGameCommand, ModKeybinding, ModKeybindings } from "@rpgm-tools/neo-angband-core";
import { bindingDiff, commandKeys, commandOnKey, conflictNote, draftFromList, installKeybindingEditor } from "./keybinding-editor.js";
import { installDomGlobals, overlayUi, paneUi } from "./test-dom.js";
import { openMenu } from "./openers.js";

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

type Keyset = "original" | "roguelike";

const COMMANDS: readonly ModGameCommand[] = [
  { id: "0", name: "Cast a spell", group: "Action commands", keys: { original: "m", roguelike: "m" }, control: null },
  { id: "1", name: "Tunnel through a wall", group: "Action commands", keys: { original: "T", roguelike: "^T" }, control: "T" },
  { id: "2", name: "Aim a wand", group: "Items", keys: { original: "a", roguelike: "z" }, control: null },
  { id: "3", name: "Center the map", group: "Information", keys: { original: null, roguelike: null }, control: "L" },
];

function seam(keys: (string | null)[] = []): ModKeybindings & { set: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; cancelCapture: ReturnType<typeof vi.fn>; stored: Map<string, ModKeybinding>; rogue: Map<string, ModKeybinding>; mode: { keyset: Keyset } } {
  const stored = new Map<string, ModKeybinding>([
    ["F1", { trigger: "F1", action: "R&\\e", owner: null }],
    ["F2", { trigger: "F2", action: "maa", owner: null }],
    ["F5", { trigger: "F5", action: "v1", owner: "Squire" }],
  ]);
  const rogue = new Map<string, ModKeybinding>([["F3", { trigger: "F3", action: "zaa", owner: null }]]);
  const mode = { keyset: "original" as Keyset };
  const pick = (keyset?: Keyset): Map<string, ModKeybinding> => ((keyset ?? mode.keyset) === "roguelike" ? rogue : stored);
  const set = vi.fn((trigger: string, action: string, keyset?: Keyset) => { if (trigger === "Pause") return false; pick(keyset).set(trigger, { trigger, action, owner: null }); return true; });
  const remove = vi.fn((trigger: string, keyset?: Keyset) => pick(keyset).delete(trigger));
  return {
    keyset: () => mode.keyset,
    list: (keyset?: Keyset) => [...pick(keyset).values()],
    set,
    remove,
    commands: () => COMMANDS,
    capture: () => Promise.resolve(keys.length > 0 ? keys.shift()! : null),
    cancelCapture: vi.fn(() => false),
    stored,
    rogue,
    mode,
  };
}

/** A seam whose captures wait until the test ends them. cancelCapture resolves the waiting one with null, or, with cancels off, fails as a host whose capture already ended would. */
function waitingSeam(cancels = true): ReturnType<typeof seam> & { waits: ((key: string | null) => void)[] } {
  const base = seam();
  const waits: ((key: string | null) => void)[] = [];
  const capture = (): Promise<string | null> => new Promise((resolve) => { waits.push(resolve); });
  const cancelCapture = vi.fn(() => { if (!cancels) return false; const wait = waits.shift(); wait?.(null); return wait !== undefined; });
  return Object.assign(base, { capture, waits, cancelCapture });
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
    expect(keybindings.set).toHaveBeenCalledWith("F5", "v1", "original");
    expect(keybindings.stored.get("F5")?.owner).toBeNull();
  });

  it("says what a key runs now before it is bound", () => {
    const draft = draftFromList(seam().list());
    expect(conflictNote("F2", draft, null)).toBe("Currently: F2 runs maa. This keymap replaces it.");
    expect(conflictNote("F5", draft, null)).toContain("set by the Squire mod");
    expect(conflictNote("F2", draft, "F2")).toBe("Currently: F2 runs maa.");
    expect(conflictNote("F5", draft, "F5")).toBe("Currently: F5 runs v1. It was set by the Squire mod, and saving makes it yours.");
    expect(conflictNote("4", draft, null)).toContain("moves your character");
    expect(conflictNote("F9", draft, null)).toBe("Currently: F9 has no keymap and runs no game command.");
    expect(conflictNote("a", draft, null, commandOnKey(COMMANDS, "a", "original"))).toBe("Currently: a runs the game command Aim a wand. A keymap here runs instead.");
  });

  it("finds the game command on a key in each keyset and lists its keys", () => {
    expect(commandOnKey(COMMANDS, "z", "roguelike")?.name).toBe("Aim a wand");
    expect(commandOnKey(COMMANDS, "z", "original")).toBeNull();
    expect(commandKeys(COMMANDS[1]!)).toBe("T in Original, ^T in Roguelike, Ctrl-T");
    expect(commandKeys(COMMANDS[3]!)).toBe("Ctrl-L");
    expect(commandKeys({ ...COMMANDS[3]!, control: null })).toBe("no key");
  });

  it("names the game command a captured key would hide, and on a keymap's row", async () => {
    const { root, ui } = overlayUi();
    const keybindings = seam(["a"]);
    keybindings.stored.set("m", { trigger: "m", action: "maa", owner: null });
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    expect(root.text()).toContain("yours, hides Cast a spell");
    root.byFocus("add")!.click();
    await flush();
    expect(root.text()).toContain("Currently: a runs the game command Aim a wand. A keymap here runs instead.");
  });

  it("lists the game commands with their keys, narrowed by the search box", () => {
    const { root, ui } = overlayUi();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings: seam() });
    expect(root.text()).not.toContain("Aim a wand");
    root.byFocus("commands")!.click();
    expect(root.byFocus("commands")!.attributes["aria-expanded"]).toBe("true");
    expect(root.text()).toContain("Aim a wand");
    expect(root.text()).toContain("a in Original, z in Roguelike");
    expect(root.text()).toContain("Items");
    root.byFocus("search")!.enter("wand");
    expect(root.text()).not.toContain("Cast a spell");
    expect(root.text()).toContain("Aim a wand");
    root.byFocus("search")!.enter("nothing like it");
    expect(root.text()).toContain("No matching game commands.");
    root.byFocus("commands")!.click();
    expect(root.text()).not.toContain("No matching game commands.");
  });

  it("edits the roguelike keymaps while the original keyset is in use, asking before it drops changes", () => {
    const { root, ui } = overlayUi();
    const keybindings = seam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    expect(root.text()).toContain("Editing: Original. In use: Original.");
    expect(root.byFocus("keyset:original")!.attributes["aria-pressed"]).toBe("true");
    root.byFocus("key:F1")!.focus();
    root.byFocus("key:F1")!.fire("keydown", "Delete");
    root.byFocus("keyset:roguelike")!.click();
    expect(root.text()).toContain("Throw away your changes to the original keymaps and edit the roguelike ones?");
    root.byFocus("confirm-yes")!.click();
    expect(root.text()).toContain("Editing: Roguelike. In use: Original.");
    expect(root.byFocus("keyset:roguelike")!.attributes["aria-pressed"]).toBe("true");
    expect(root.byFocus("key:F3")).toBeDefined();
    expect(root.byFocus("key:F2")).toBeUndefined();
    root.byFocus("key:F3")!.focus();
    root.byFocus("key:F3")!.fire("keydown", "Delete");
    root.byFocus("save")!.click();
    expect(root.text()).toContain("to your roguelike keymaps?");
    root.byFocus("confirm-yes")!.click();
    expect(keybindings.remove).toHaveBeenCalledWith("F3", "roguelike");
    expect(keybindings.rogue.has("F3")).toBe(false);
    expect(keybindings.stored.has("F1")).toBe(true);
  });

  it("adds a keymap from a captured key, warns about a conflict, and saves only after Yes", async () => {
    const { root, ui } = overlayUi();
    const keybindings = seam(["F2"]);
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    expect(root.text()).toContain("Editing: Original.");
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
    expect(keybindings.set).toHaveBeenCalledWith("F2", "mbb", "original");
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

  it("leaves the panel unfocused while a capture waits, so Escape ends it", async () => {
    const { root, ui } = overlayUi();
    const keybindings = waitingSeam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("add")!.focus();
    root.byFocus("add")!.click();
    expect(root.text()).toContain("Press the key to bind. Escape cancels.");
    expect(root.focused()).toBeUndefined();
    expect(root.byFocus("key:F1")?.disabled).toBe(true);
    expect(root.byFocus("keyset:roguelike")?.disabled).toBe(true);
    keybindings.waits.shift()!(null);
    await flush();
    expect(root.text()).not.toContain("New keymap");
    expect(root.focused()).toBe("add");
  });

  it("stops a waiting capture through the game when Cancel keymap is pressed", async () => {
    const { root, ui } = overlayUi();
    const keybindings = waitingSeam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("add")!.click();
    expect(root.byFocus("form-cancel")?.disabled).toBe(false);
    root.byFocus("form-cancel")!.click();
    expect(keybindings.cancelCapture).toHaveBeenCalledTimes(1);
    expect(keybindings.waits).toHaveLength(0);
    await flush();
    expect(root.text()).not.toContain("New keymap");
    expect(root.focused()).toBe("add");
  });

  it("drops a capture the host interrupts by hiding the pane, and ignores a key that still ends it", async () => {
    const pane = paneUi();
    const keybindings = waitingSeam(false);
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

  it("stops a waiting capture when the panel goes away", () => {
    const pane = paneUi();
    const keybindings = waitingSeam();
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
    expect(keybindings.remove).toHaveBeenCalledWith("F2", "original");
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

  it("saves to the keyset being edited after the one in use changes, and names refused keys", () => {
    const { root, ui } = overlayUi();
    const keybindings = seam();
    cleanup = installKeybindingEditor({ flags: { "anybandui.keybindingEditor": true }, log: () => {}, ui, keybindings });
    root.byFocus("key:F1")!.focus();
    root.byFocus("key:F1")!.fire("keydown", "Delete");
    keybindings.mode.keyset = "roguelike";
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(keybindings.remove).toHaveBeenCalledWith("F1", "original");
    expect(keybindings.stored.has("F1")).toBe(false);
    expect(keybindings.rogue.has("F3")).toBe(true);
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
