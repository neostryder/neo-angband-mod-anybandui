import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModOptionsChange, ModOptionsView } from "@rpgm-tools/neo-angband-core";
import { draftChanges, draftFromView, installOptionsEditor, optionGroup } from "./options-editor.js";
import { installDomGlobals, overlayUi } from "./test-dom.js";

function game() {
  const state = {
    values: { rogue_like_commands: false, pickup_always: true, show_damage: false, birth_randarts: false, cheat_hear: false } as Record<string, boolean>,
    hitpointWarn: 3, delayFactor: 40, lazymoveDelay: 0,
  };
  const entries = (): ModOptionsView["entries"] => [
    { name: "rogue_like_commands", description: "Use the roguelike command keyset", page: "interface", value: state.values["rogue_like_commands"]!, writable: true },
    { name: "pickup_always", description: "Always pickup items matching inventory", page: "interface", value: state.values["pickup_always"]!, writable: true },
    { name: "show_damage", description: "Show damage player deals to monsters", page: "interface", value: state.values["show_damage"]!, writable: true },
    { name: "birth_randarts", description: "Generate a new, random artifact set", page: "birth", value: false, writable: false },
    { name: "cheat_hear", description: "Cheat: Peek into monster creation", page: "cheat", value: false, writable: false },
  ];
  const get = (): ModOptionsView => ({ entries: entries(), hitpointWarn: state.hitpointWarn, delayFactor: state.delayFactor, lazymoveDelay: state.lazymoveDelay });
  const set = vi.fn((change: ModOptionsChange) => {
    for (const [name, value] of Object.entries(change.values ?? {})) state.values[name] = value;
    if (change.hitpointWarn !== undefined) state.hitpointWarn = change.hitpointWarn;
    if (change.delayFactor !== undefined) state.delayFactor = change.delayFactor;
    return { ok: true as const, changed: Object.keys(change.values ?? {}) };
  });
  return { view: get(), get, set };
}

describe("game options editor", () => {
  let restore = (): void => {};
  let cleanup = (): void => {};
  beforeEach(() => { restore = installDomGlobals(); });
  afterEach(() => { cleanup(); cleanup = () => {}; restore(); });

  it("installs nothing with its switch off", () => {
    const openPanel = vi.fn();
    const { get, set } = game();
    cleanup = installOptionsEditor({ flags: {}, log: () => {}, ui: { openPanel }, options: { get, set } });
    expect(openPanel).not.toHaveBeenCalled();
  });

  it("groups options as upstream does and sends only what changed and may change", () => {
    expect(optionGroup("rogue_like_commands")).toBe("Input and targeting");
    expect(optionGroup("show_damage")).toBe("Messages");
    expect(optionGroup("something_new")).toBe("Other");
    const { view } = game();
    const draft = draftFromView(view);
    draft.values["pickup_always"] = false;
    draft.values["birth_randarts"] = true;
    draft.hitpointWarn = 5;
    expect(draftChanges(view, draft)).toEqual({ values: { pickup_always: false }, hitpointWarn: 5 });
  });

  it("keeps changes as a draft and saves them only after Yes", async () => {
    const { root, ui } = overlayUi();
    const { get, set } = game();
    cleanup = installOptionsEditor({ flags: { "anybandui.optionsEditor": true }, log: () => {}, ui, options: { get, set } });
    expect(root.text()).toContain("Input and targeting");
    expect(root.text()).toContain("Birth options (read only)");
    expect(root.byFocus("opt:birth_randarts")?.disabled).toBe(true);
    expect(root.byFocus("save")?.disabled).toBe(true);
    const box = root.byFocus("opt:rogue_like_commands")!;
    box.checked = true;
    box.fire("change");
    const range = root.byFocus("num:hitpointWarn")!;
    range.value = "5";
    range.fire("input");
    range.fire("change");
    expect(root.text()).toContain("50%");
    expect(set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    expect(root.text()).toContain("Save 2 changed options?");
    expect(root.focused()).toBe("confirm-no");
    root.byFocus("confirm-no")!.click();
    expect(set).not.toHaveBeenCalled();
    root.byFocus("save")!.click();
    root.byFocus("confirm-yes")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(set).toHaveBeenCalledWith({ values: { rogue_like_commands: true }, hitpointWarn: 5 });
    expect(root.text()).toContain("Saved.");
    expect(root.byFocus("save")?.disabled).toBe(true);
  });

  it("shows the reason when the game refuses a change", async () => {
    const { root, ui } = overlayUi();
    const { get } = game();
    const set = vi.fn(() => ({ ok: false as const, reason: "No game is running." }));
    cleanup = installOptionsEditor({ flags: { "anybandui.optionsEditor": true }, log: () => {}, ui, options: { get, set } });
    const box = root.byFocus("opt:show_damage")!;
    box.checked = true;
    box.fire("change");
    root.byFocus("save")!.click();
    root.walk().find((node) => node.attributes["role"] === "alertdialog")!.fire("keydown", "y");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.text()).toContain("No game is running.");
  });

  it("asks before Cancel or Escape throws a draft away, and Escape on the question keeps it", () => {
    const { root, ui } = overlayUi();
    const { get, set } = game();
    cleanup = installOptionsEditor({ flags: { "anybandui.optionsEditor": true }, log: () => {}, ui, options: { get, set } });
    const box = root.byFocus("opt:pickup_always")!;
    box.checked = false;
    box.fire("change");
    root.byFocus("opt:pickup_always")!.fire("keydown", "Escape");
    expect(root.text()).toContain("Throw away your changes to the options?");
    root.walk().find((node) => node.attributes["role"] === "alertdialog")!.fire("keydown", "Escape");
    expect(root.byFocus("opt:pickup_always")!.checked).toBe(false);
    root.byFocus("cancel")!.click();
    root.byFocus("confirm-yes")!.click();
    expect(root.byFocus("opt:pickup_always")!.checked).toBe(true);
    expect(root.text()).toContain("Changes discarded.");
    expect(set).not.toHaveBeenCalled();
  });

  it("moves between rows with Up and Down", () => {
    const { root, ui } = overlayUi();
    const { get, set } = game();
    cleanup = installOptionsEditor({ flags: { "anybandui.optionsEditor": true }, log: () => {}, ui, options: { get, set } });
    root.byFocus("opt:rogue_like_commands")!.focus();
    root.byFocus("opt:rogue_like_commands")!.fire("keydown", "ArrowDown");
    expect(root.focused()).toBe("opt:pickup_always");
    root.byFocus("opt:pickup_always")!.fire("keydown", "ArrowUp");
    expect(root.focused()).toBe("opt:rogue_like_commands");
  });

  it("filters by search", () => {
    const { root, ui } = overlayUi();
    const { get, set } = game();
    cleanup = installOptionsEditor({ flags: { "anybandui.optionsEditor": true }, log: () => {}, ui, options: { get, set } });
    root.byFocus("search")!.enter("damage");
    expect(root.byFocus("opt:show_damage")).toBeDefined();
    expect(root.byFocus("opt:pickup_always")).toBeUndefined();
    root.byFocus("search")!.enter("nothing like this");
    expect(root.text()).toContain("No matching options.");
  });

  it("is read-only without options:write", () => {
    const { root, ui } = overlayUi();
    const { get } = game();
    cleanup = installOptionsEditor({ flags: { "anybandui.optionsEditor": true }, log: () => {}, ui, options: { get } });
    expect(root.text()).toContain("This game lets this mod read the options but not change them.");
    expect(root.byFocus("opt:rogue_like_commands")?.disabled).toBe(true);
    expect(root.byFocus("save")).toBeUndefined();
  });
});
