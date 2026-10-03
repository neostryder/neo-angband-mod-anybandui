import { describe, expect, it, vi } from "vitest";
import type { MenuQuestion, ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import { composeMenus, composeScreens } from "./presenters.js";
import { installMenus, menuPresenter, screenPresenter } from "./menus.js";

const question = (id: string): MenuQuestion => ({ id, title: "", footer: "", choices: [], style: "screen", cursor: 0, browseOnly: false, commands: [], detail: () => [] });
const view = (id: string): ScreenView => ({ id, title: "", footer: "", blocks: [] });

describe("the composed presenters", () => {
  it("is absent when every part is off", () => {
    expect(composeMenus([null, null], () => {})).toBeUndefined();
    expect(composeScreens([null], () => {})).toBeUndefined();
  });

  it("asks each part in turn and declines what none of them claims", () => {
    const first = { ask: vi.fn((q: MenuQuestion) => q.id === "a" ? { kind: "cancel" as const } : undefined) };
    const second = { ask: vi.fn((q: MenuQuestion) => q.id === "b" ? { kind: "options" as const } : undefined) };
    const menus = composeMenus([first, null, second], () => {})!;
    expect(menus.ask(question("a"))).toEqual({ kind: "cancel" });
    expect(menus.ask(question("b"))).toEqual({ kind: "options" });
    expect(menus.ask(question("c"))).toBeUndefined();
  });

  it("declines rather than throws when a part fails", () => {
    const log = vi.fn();
    const menus = composeMenus([{ ask: () => { throw new Error("boom"); } }], log)!;
    expect(menus.ask(question("a"))).toBeUndefined();
    expect(log).toHaveBeenCalled();
    const screens = composeScreens([{ show: () => { throw new Error("boom"); } }], log)!;
    expect(screens.show(view("a"))).toBeUndefined();
  });

  it("has no presenters and installs nothing with every phase 8 switch off", () => {
    const openPanel = vi.fn();
    const onRunEnd = vi.fn(() => () => {});
    const ctx = { flags: {}, log: () => {}, ui: { openPanel }, character: { history: () => [], onRunEnd } };
    expect(menuPresenter(ctx)).toBeUndefined();
    expect(screenPresenter(ctx)).toBeUndefined();
    installMenus(ctx)();
    expect(openPanel).not.toHaveBeenCalled();
    expect(onRunEnd).not.toHaveBeenCalled();
  });

  it("offers a presenter only for the switches that are on", () => {
    expect(menuPresenter({ flags: { "anybandui.saveCards": true }, log: () => {} })).toBeDefined();
    expect(screenPresenter({ flags: { "anybandui.saveCards": true }, log: () => {} })).toBeUndefined();
    expect(screenPresenter({ flags: { "anybandui.hallOfFame": true }, log: () => {} })).toBeDefined();
  });
});
