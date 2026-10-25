import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BirthCatalogue, BirthDraftView, BirthResult, ModBirthSession, ModPanelSpec } from "@rpgm-tools/neo-angband-core";
import plugin from "../../plugin.js";
import { notifyThemeChange, THEMES } from "../theme.js";
import { BIRTH_FLAG, installBirthWizard, type BirthWizardContext } from "./birth.js";

type Listener = (event: { key: string; preventDefault(): void }) => void;

class FakeNode {
  children: FakeNode[] = [];
  className = "";
  textContent = "";
  type = "";
  value = "";
  name = "";
  title = "";
  checked = false;
  disabled = false;
  open = false;
  rows = 0;
  maxLength = -1;
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  style = { width: "", properties: new Map<string, string>(), setProperty(name: string, value: string) { this.properties.set(name, value); } };
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  host?: FakeNode;
  activeElement: FakeNode | null = null;
  rootNode: FakeNode;
  parent: FakeNode | null = null;
  private listeners = new Map<string, Listener[]>();
  constructor(readonly tag = "div") { this.rootNode = this; }
  get tagName(): string { return this.tag.toUpperCase(); }
  get ownerDocument() {
    const root = this.rootNode;
    return { createElement: (tag: string) => { const node = new FakeNode(tag); node.rootNode = root; return node; } };
  }
  getRootNode(): FakeNode { return this.rootNode; }
  appendChild(child: FakeNode): FakeNode {
    child.parent = this;
    for (const node of child.walk()) node.rootNode = this.rootNode;
    this.children.push(child);
    return child;
  }
  replaceChildren(): void { for (const child of this.children) child.parent = null; this.children = []; }
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
  addEventListener(type: string, listener: Listener): void { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  fire(type: string, key = ""): void { for (const listener of this.listeners.get(type) ?? []) listener({ key, preventDefault() {} }); }
  click(): void { this.fire("click"); }
  contains(node: FakeNode): boolean { return this.walk().includes(node); }
  querySelector(selector: string): FakeNode | null {
    if (selector.startsWith("[")) {
      /* A browser throws on a selector it cannot parse, such as an unescaped quote inside the value. */
      const focus = /^\[data-focus="((?:[^"\\]|\\.)*)"\]$/.exec(selector);
      if (!focus) throw new SyntaxError(`'${selector}' is not a valid selector.`);
      return this.walk().find((node) => node.dataset["focus"] === focus[1]!.replace(/\\(.)/g, "$1")) ?? null;
    }
    return this.walk().find((node) => node.tag === selector) ?? null;
  }
  querySelectorAll(selector: string): FakeNode[] {
    if (selector !== "[data-focus]") throw new Error(`the fake DOM does not handle ${selector}`);
    return this.walk().filter((node) => node !== this && "focus" in node.dataset);
  }
  focus(): void { this.rootNode.activeElement = this; }
  setSelectionRange(start: number, end: number): void { this.selectionStart = start; this.selectionEnd = end; }
  walk(): FakeNode[] { return [this, ...this.children.flatMap((child) => child.walk())]; }
  text(): string { return [this.textContent, ...this.children.map((child) => child.text())].filter(Boolean).join(" "); }
  byFocus(key: string): FakeNode | undefined { return this.walk().find((node) => node.dataset["focus"] === key); }
  byText(label: string): FakeNode | undefined { return this.walk().find((node) => node.tag === "button" && node.textContent === label); }
}

interface FakePanel { spec: ModPanelSpec; root: FakeNode; open: boolean; closed: Promise<void>; close(): void; playerClose(): Promise<void> }

function fakeUi(refuse = false) {
  const panels: FakePanel[] = [];
  const ui = {
    panels,
    openPanel: vi.fn((spec: ModPanelSpec) => {
      if (refuse) throw new Error("no document to mount into");
      const host = new FakeNode("div");
      const root = new FakeNode("#shadow");
      root.host = host;
      let settle!: () => void;
      const closed = new Promise<void>((resolve) => { settle = resolve; });
      const panel: FakePanel = {
        spec, root, open: true, closed,
        close() { if (!panel.open) return; panel.open = false; panels.splice(panels.indexOf(panel), 1); settle(); },
        async playerClose() { panel.close(); await Promise.resolve(); await Promise.resolve(); },
      };
      panels.push(panel);
      return panel;
    }),
  };
  return ui;
}

const OPTIONS = [{ name: "birth_randarts", description: "Generate a new, random artifact set", value: false }];

/** A small stand-in for Core's birth session: point-buy at one point a step, a counter for rolls. */
function fakeSession(previous: BirthCatalogue["previous"] = null, pinned = false, raceNames: readonly [string, string] = ["Human", "Dwarf"]) {
  let race: string | null = null, cls: string | null = null, method: "point" | "roller" = "point";
  let stats = [10, 10, 10, 10, 10], spent = [0, 0, 0, 0, 0], left = 20;
  let rolled: number[] | null = null, previousRolled: number[] | null = null, rolls = 0;
  let name = previous ? previous.name : "", history = "", historyEdited = false, generated = "";
  const options: Record<string, boolean> = { birth_randarts: false };
  const ok: BirthResult = { ok: true };
  const refuse = (reason: string): BirthResult => ({ ok: false, reason });
  const catalogue: BirthCatalogue = {
    races: [
      { name: raceNames[0], statAdj: [0, 0, 0, 0, 0], hitDie: 10, expFactor: 100, infravisionFeet: 0, skills: { STEALTH: 0 }, abilities: [] },
      { name: raceNames[1], statAdj: [2, -2, 2, -2, 2], hitDie: 11, expFactor: 120, infravisionFeet: 50, skills: { DISARM_PHYS: 2 }, abilities: [{ name: "Rock sense", description: "Sees in the dark." }] },
    ],
    classes: [
      { name: "Warrior", statAdj: [3, -2, -2, 2, 2], hitDie: 9, expFactor: 0, skills: {}, magic: [], abilities: [] },
      { name: "Mage", statAdj: [-3, 3, 0, 1, -2], hitDie: 0, expFactor: 0, skills: { DEVICE: 13 }, magic: ["arcane"], abilities: [] },
    ],
    stats: ["STR", "INT", "WIS", "DEX", "CON"], pointBudget: 20, nameMax: 31, previous, namePinned: pinned,
  };
  const suggested = (): void => { method = "point"; rolled = null; previousRolled = null; stats = [14, 12, 10, 14, 14]; spent = [4, 2, 0, 4, 4]; left = 6; };
  const current = (): number[] => method === "roller" && rolled ? rolled : stats;
  const session = {
    catalogue: vi.fn(() => catalogue),
    draft: vi.fn((): BirthDraftView => ({
      race, cls, method, stats: [...current()], pointsLeft: method === "point" ? left : 0, pointsSpent: method === "point" ? [...spent] : [0, 0, 0, 0, 0],
      statCosts: stats.map((value) => {
        const point = method === "point", buying = point && race !== null && cls !== null;
        const buyCost = point && value < 18 ? 1 : null, sellRefund = point && value > 10 ? 1 : null;
        return { buyCost, sellRefund, canBuy: buying && buyCost !== null && buyCost <= left, canSell: buying && sellRefund !== null };
      }),
      canPreviousRoll: method === "roller" && previousRolled !== null, name, history, historyEdited,
      options: OPTIONS.map((o) => ({ ...o, value: options[o.name] ?? false })),
      preview: race && cls ? {
        stats: current().map((value, i) => ({ key: String(i), label: `${catalogue.stats[i]}: `, natural: String(value), raceBonus: " +0", classBonus: " +0", best: ` ${value}` })),
        panels: [{ key: "topleft", lines: [{ label: "HP", value: "12/12", color: 14 }, { label: "SP", value: "0/0", color: 14 }] }, { key: "skills", lines: [{ label: "Stealth", value: "Fair", color: 13 }] }],
        gold: 100 + left * 50,
      } : null,
      ready: race !== null && cls !== null && name.trim() !== "",
    })),
    chooseRace: vi.fn((n: string) => { race = n; suggested(); history = generated = `${n} history ${++rolls}`; historyEdited = false; return ok; }),
    chooseClass: vi.fn((n: string) => { cls = n; suggested(); return ok; }),
    usePointBuy: vi.fn(() => { suggested(); return ok; }),
    buy: vi.fn((i: number) => {
      if (method !== "point") return refuse("Switch to point-buy first.");
      if (left <= 0 || (stats[i] ?? 0) >= 18) return refuse("That stat cannot go higher with the points left.");
      stats[i]! += 1; spent[i]! += 1; left -= 1; return ok;
    }),
    sell: vi.fn((i: number) => {
      if ((stats[i] ?? 0) <= 10) return refuse("That stat is already at its lowest.");
      stats[i]! -= 1; spent[i]! -= 1; left += 1; return ok;
    }),
    suggest: vi.fn(() => { suggested(); return ok; }),
    reset: vi.fn(() => { method = "point"; stats = [10, 10, 10, 10, 10]; spent = [0, 0, 0, 0, 0]; left = 20; return ok; }),
    roll: vi.fn(() => { if (method === "roller" && rolled) previousRolled = rolled; method = "roller"; rolls += 1; rolled = [8 + rolls, 9, 10, 11, 12]; return ok; }),
    previousRoll: vi.fn(() => { if (!rolled || !previousRolled) return refuse("There is no earlier roll to go back to."); [rolled, previousRolled] = [previousRolled, rolled]; return ok; }),
    setName: vi.fn((n: string) => { if (pinned) return refuse("The name is set for this game and cannot be changed."); name = n; return ok; }),
    randomName: vi.fn(() => { name = "Random"; return ok; }),
    setHistory: vi.fn((text: string) => { history = text; historyEdited = true; return ok; }),
    restoreHistory: vi.fn(() => { history = generated; historyEdited = false; return ok; }),
    regenerateHistory: vi.fn(() => { history = generated = `${race} history ${++rolls}`; historyEdited = false; return ok; }),
    setOption: vi.fn((n: string, value: boolean) => { options[n] = value; return ok; }),
    usePrevious: vi.fn(() => { if (!previous) return refuse("There is no previous character to reuse."); race = previous.race; cls = previous.cls; stats = [16, 10, 10, 12, 15]; spent = [6, 0, 0, 2, 5]; left = 7; method = "point"; history = "Previous history"; return ok; }),
    accept: vi.fn(() => (race && cls && name.trim() ? ok : refuse("The character needs a name."))),
    cancel: vi.fn(),
  };
  return session as typeof session & ModBirthSession;
}

function setup(flags: Record<string, boolean> = { [BIRTH_FLAG]: true }, refuse = false) {
  const ui = fakeUi(refuse);
  const log = vi.fn();
  const ctx: BirthWizardContext = { flags, ui: ui as unknown as NonNullable<BirthWizardContext["ui"]>, prefs: { get: () => ({}) }, log };
  return { ui, log, presenter: installBirthWizard(ctx) };
}

const top = (ui: ReturnType<typeof fakeUi>): FakeNode => ui.panels[ui.panels.length - 1]!.root;
const active = (ui: ReturnType<typeof fakeUi>): string | undefined => top(ui).activeElement?.dataset["focus"];

describe("the character creation wizard", () => {
  const original = globalThis.HTMLElement;
  beforeEach(() => { Object.assign(globalThis, { HTMLElement: FakeNode }); });
  afterEach(() => { Object.assign(globalThis, { HTMLElement: original }); });

  it("installs nothing with its switch off, so the game shows its own birth screens", () => {
    expect(setup({}).presenter).toBeUndefined();
    expect(setup({ [BIRTH_FLAG]: false }).presenter).toBeUndefined();
    expect(plugin.birth({ log: () => {}, flags: {} })).toBeUndefined();
  });

  it("declines without the panel seam, and when the panel cannot open, leaving the session untouched", () => {
    const log = vi.fn();
    expect(installBirthWizard({ flags: { [BIRTH_FLAG]: true }, log })).toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("panel seam unavailable"));
    const { presenter, log: refusedLog } = setup(undefined, true);
    const session = fakeSession();
    expect(presenter!.show(session)).toBe(false);
    expect(session.chooseRace).not.toHaveBeenCalled();
    expect(session.cancel).not.toHaveBeenCalled();
    expect(refusedLog).toHaveBeenCalledWith(expect.stringContaining("could not open its window"));
  });

  it("opens on the race step with the first race and class chosen through the game, and a live preview", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    expect(presenter!.show(session)).toBe(true);
    expect(ui.panels).toHaveLength(1);
    expect(ui.panels[0]!.spec).toMatchObject({ modal: true, label: "Character creation: Race" });
    expect(session.chooseRace).toHaveBeenCalledWith("Human");
    expect(session.chooseClass).toHaveBeenCalledWith("Warrior");
    const text = top(ui).text();
    expect(text).toContain("Step 1 of 5 - Race");
    expect(text).toContain("Character preview");
    expect(text).toContain("HP 12");
    expect(text).toContain("Starting funds: 400 gold");
    expect(top(ui).byText("Back")!.disabled).toBe(true);
    expect(active(ui)).toBe("choice-Human");
  });

  it("moves through races with the arrow keys, each choice going through the session", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byFocus("choice-Human")!.fire("keydown", "ArrowDown");
    expect(session.chooseRace).toHaveBeenLastCalledWith("Dwarf");
    expect(active(ui)).toBe("choice-Dwarf");
    const text = top(ui).text();
    expect(text).toContain("Infravision");
    expect(text).toContain("50 ft");
    expect(text).toContain("Rock sense");
    top(ui).byFocus("choice-Dwarf")!.fire("keydown", "ArrowDown");
    expect(session.chooseRace).toHaveBeenCalledTimes(2);
    expect(active(ui)).toBe("choice-Dwarf");
    top(ui).byFocus("choice-Human")!.click();
    expect(session.chooseRace).toHaveBeenLastCalledWith("Human");
  });

  it("stacks a panel per step; Back closes the top one and Escape does the same", async () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byText("Next")!.click();
    expect(ui.panels).toHaveLength(2);
    expect(top(ui).text()).toContain("Step 2 of 5 - Class");
    top(ui).byFocus("choice-Warrior")!.fire("keydown", "ArrowDown");
    expect(session.chooseClass).toHaveBeenLastCalledWith("Mage");
    expect(top(ui).text()).toContain("Can learn spells: arcane.");
    top(ui).byText("Back")!.click();
    expect(ui.panels).toHaveLength(1);
    expect(top(ui).text()).toContain("Mage");
    top(ui).byText("Next")!.click();
    top(ui).byText("Next")!.click();
    expect(ui.panels).toHaveLength(3);
    await ui.panels[2]!.playerClose();
    expect(ui.panels).toHaveLength(2);
    expect(top(ui).text()).toContain("Step 2 of 5 - Class");
    expect(active(ui)).toBe("choice-Mage");
    expect(session.cancel).not.toHaveBeenCalled();
    await ui.panels[1]!.playerClose();
    await ui.panels[0]!.playerClose();
    expect(session.cancel).toHaveBeenCalledTimes(1);
    expect(ui.panels).toHaveLength(0);
  });

  it("spends and refunds points with buttons and keys, and shows the game's refusals", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byText("Next")!.click();
    top(ui).byText("Next")!.click();
    let text = top(ui).text();
    expect(text).toContain("Step 3 of 5 - Attributes");
    expect(text).toContain("Points remaining: 6");
    expect(active(ui)).toBe("buy-0");
    top(ui).byFocus("buy-0")!.click();
    expect(session.buy).toHaveBeenCalledWith(0);
    expect(top(ui).text()).toContain("Points remaining: 5");
    top(ui).byFocus("buy-0")!.fire("keydown", "ArrowRight");
    expect(session.buy).toHaveBeenCalledTimes(2);
    expect(active(ui)).toBe("buy-0");
    top(ui).byFocus("buy-0")!.fire("keydown", "ArrowDown");
    expect(active(ui)).toBe("buy-1");
    top(ui).byFocus("buy-1")!.fire("keydown", "-");
    expect(session.sell).toHaveBeenCalledWith(1);
    expect(active(ui)).toBe("buy-1");
    session.buy.mockReturnValueOnce({ ok: false, reason: "That stat cannot go higher with the points left." });
    top(ui).byFocus("buy-2")!.click();
    expect(top(ui).text()).toContain("That stat cannot go higher with the points left.");
    top(ui).byText("Reset points")!.click();
    expect(session.reset).toHaveBeenCalled();
    text = top(ui).text();
    expect(text).toContain("Points remaining: 20");
    expect(text).not.toContain("cannot go higher");
    top(ui).byText("Suggested allocation")!.click();
    expect(session.suggest).toHaveBeenCalled();
  });

  it("leaves a control drawn as unavailable inert, by click and by key", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byText("Next")!.click();
    top(ui).byText("Next")!.click();
    expect(top(ui).byFocus("sell-2")!.attributes["aria-disabled"]).toBe("true");
    top(ui).byFocus("sell-2")!.click();
    top(ui).byFocus("buy-2")!.fire("keydown", "-");
    expect(session.sell).not.toHaveBeenCalled();
    expect(top(ui).text()).not.toContain("already at its lowest");
    expect(top(ui).byFocus("buy-2")!.title).toBe("Costs 1 point. 6 remaining.");
    expect(top(ui).byFocus("sell-0")!.title).toBe("Refunds 1 point.");
    for (const stat of [0, 0, 0, 0, 1, 1]) top(ui).byFocus(`buy-${stat}`)!.click();
    expect(top(ui).text()).toContain("Points remaining: 0");
    expect(top(ui).byFocus("buy-0")!.title).toBe("Base stat is at its maximum.");
    expect(top(ui).byFocus("buy-2")!.title).toBe("Costs 1 point. 0 remaining. Reduce another stat to free points.");
    for (const stat of [0, 2]) {
      expect(top(ui).byFocus(`buy-${stat}`)!.attributes["aria-disabled"]).toBe("true");
      top(ui).byFocus(`buy-${stat}`)!.click();
      top(ui).byFocus(`sell-${stat}`)!.fire("keydown", "+");
    }
    expect(session.buy).toHaveBeenCalledTimes(6);
  });

  it("clears a refusal once the player moves to another step", async () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byText("Next")!.click();
    top(ui).byText("Next")!.click();
    const refusal = "That stat cannot go higher with the points left.";
    const refuseOnce = (): void => {
      session.buy.mockReturnValueOnce({ ok: false, reason: refusal });
      top(ui).byFocus("buy-0")!.fire("keydown", "+");
      expect(top(ui).text()).toContain(refusal);
    };
    refuseOnce();
    top(ui).byText("Next")!.click();
    expect(top(ui).text()).toContain("Step 4 of 5 - Identity");
    expect(top(ui).text()).not.toContain(refusal);
    top(ui).byText("Back")!.click();
    expect(top(ui).text()).not.toContain(refusal);
    refuseOnce();
    top(ui).byText("Back")!.click();
    expect(top(ui).text()).toContain("Step 2 of 5 - Class");
    expect(top(ui).text()).not.toContain(refusal);
    top(ui).byText("Next")!.click();
    refuseOnce();
    await ui.panels[2]!.playerClose();
    expect(top(ui).text()).not.toContain(refusal);
  });

  it("keeps the caret on a race whose name holds selector characters", () => {
    const { ui, presenter } = setup();
    const odd = 'Half-"Elf"] [x';
    const session = fakeSession(null, false, ["Human", odd]);
    presenter!.show(session);
    expect(() => top(ui).byFocus("choice-Human")!.fire("keydown", "ArrowDown")).not.toThrow();
    expect(session.chooseRace).toHaveBeenLastCalledWith(odd);
    expect(active(ui)).toBe(`choice-${odd}`);
  });

  it("closes its window and stops following the theme when the first step cannot be drawn", () => {
    const { ui, presenter, log } = setup();
    const session = fakeSession();
    const draft = session.draft.getMockImplementation()!;
    let calls = 0;
    session.draft.mockImplementation(() => { if (++calls > 1) throw new Error("preview failed"); return draft(); });
    expect(presenter!.show(session)).toBe(false);
    expect(ui.panels).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("preview failed"));
    const root = ui.openPanel.mock.results[0]!.value as FakePanel;
    const before = root.root.host!.style.properties.get("--anyband-accent");
    notifyThemeChange(THEMES["amber-terminal"]!);
    expect(root.root.host!.style.properties.get("--anyband-accent")).toBe(before);
  });

  it("shows hit die and XP modifier as the game's own birth screen does", () => {
    const { ui, presenter } = setup();
    presenter!.show(fakeSession());
    let text = top(ui).text();
    expect(text).toContain("Hit die 10");
    expect(text).toContain("XP modifier 100%");
    top(ui).byText("Next")!.click();
    text = top(ui).text();
    expect(text).toContain("Hit die 19 Includes your race.");
    expect(text).toContain("XP modifier 100% Includes your race.");
  });

  it("switches to random rolls, rolls again and swaps back to the previous roll", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byText("Next")!.click();
    top(ui).byText("Next")!.click();
    const radio = top(ui).byFocus("method-roller")!;
    radio.checked = true;
    radio.fire("change");
    expect(session.roll).toHaveBeenCalledTimes(1);
    expect(top(ui).text()).not.toContain("Points remaining");
    expect(top(ui).byText("Previous roll")!.disabled).toBe(true);
    top(ui).byText("Roll again")!.click();
    expect(session.roll).toHaveBeenCalledTimes(2);
    expect(top(ui).byText("Previous roll")!.disabled).toBe(false);
    top(ui).byText("Previous roll")!.click();
    expect(session.previousRoll).toHaveBeenCalled();
    const point = top(ui).byFocus("method-point")!;
    point.checked = true;
    point.fire("change");
    expect(session.usePointBuy).toHaveBeenCalled();
    expect(top(ui).text()).toContain("Points remaining");
  });

  it("sets the name and background through the game and starts it from Review", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    for (let i = 0; i < 3; i++) top(ui).byText("Next")!.click();
    expect(top(ui).text()).toContain("Step 4 of 5 - Identity");
    expect(active(ui)).toBe("name");
    const name = top(ui).byFocus("name")!;
    expect(name.maxLength).toBe(31);
    name.value = "Ari";
    name.selectionStart = 3; name.selectionEnd = 3;
    name.fire("input");
    expect(session.setName).toHaveBeenCalledWith("Ari");
    expect(active(ui)).toBe("name");
    expect(top(ui).byFocus("name")!.selectionStart).toBe(3);
    const history = top(ui).byFocus("history")!;
    expect(top(ui).byText("Restore generated background")!.disabled).toBe(true);
    history.value = "Raised by wolves.";
    history.fire("input");
    expect(session.setHistory).toHaveBeenCalledWith("Raised by wolves.");
    expect(top(ui).byText("Restore generated background")!.disabled).toBe(false);
    top(ui).byText("Restore generated background")!.click();
    expect(session.restoreHistory).toHaveBeenCalledTimes(1);
    expect(session.setHistory).toHaveBeenCalledTimes(1);
    expect(top(ui).byFocus("history")!.value).toBe("Human history 1");
    expect(top(ui).byText("Restore generated background")!.disabled).toBe(true);
    top(ui).byText("New background")!.click();
    expect(session.regenerateHistory).toHaveBeenCalled();
    top(ui).byText("Random name")!.click();
    expect(session.randomName).toHaveBeenCalled();
    top(ui).byFocus("name")!.fire("keydown", "Enter");
    expect(ui.panels).toHaveLength(5);
    const review = top(ui);
    expect(review.text()).toContain("Step 5 of 5 - Review");
    expect(review.text()).toContain("Random - Human Warrior");
    expect(review.text()).toContain("Stealth");
    review.byText("Start game")!.click();
    expect(session.accept).toHaveBeenCalledTimes(1);
    expect(ui.panels).toHaveLength(0);
    expect(session.cancel).not.toHaveBeenCalled();
  });

  it("keeps Start game off without a name, and a pinned name cannot be edited", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    for (let i = 0; i < 4; i++) top(ui).byText("Next")!.click();
    expect(top(ui).byText("Start game")!.disabled).toBe(true);
    expect(top(ui).text()).toContain("Give your character a name before you start.");
    const pinned = setup();
    pinned.presenter!.show(fakeSession(null, true));
    for (let i = 0; i < 3; i++) top(pinned.ui).byText("Next")!.click();
    expect(top(pinned.ui).byFocus("name")!.disabled).toBe(true);
    expect(top(pinned.ui).byText("Random name")!.disabled).toBe(true);
  });

  it("changes birth options through the game", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    const box = top(ui).byFocus("option-birth_randarts")!;
    box.checked = true;
    box.fire("change");
    expect(session.setOption).toHaveBeenCalledWith("birth_randarts", true);
    expect(top(ui).byFocus("option-birth_randarts")!.checked).toBe(true);
  });

  it("offers the previous character first: reuse it, rename it, or start over", () => {
    const previous = { race: "Dwarf", cls: "Mage", name: "Ari II" };
    const reuse = setup();
    const first = fakeSession(previous);
    expect(reuse.presenter!.show(first)).toBe(true);
    expect(first.usePrevious).toHaveBeenCalledTimes(1);
    expect(first.chooseRace).not.toHaveBeenCalled();
    const text = top(reuse.ui).text();
    expect(text).toContain("Play again");
    expect(text).toContain("Ari II");
    expect(text).toContain("Dwarf Mage");
    expect(text).toContain("Previous history");
    top(reuse.ui).byText("Use previous character")!.click();
    expect(first.accept).toHaveBeenCalledTimes(1);
    expect(first.usePrevious).toHaveBeenCalledTimes(1);
    expect(reuse.ui.panels).toHaveLength(0);

    const rename = setup();
    const second = fakeSession(previous);
    rename.presenter!.show(second);
    top(rename.ui).byText("Change name / background")!.click();
    expect(top(rename.ui).text()).toContain("Step 4 of 5 - Identity");
    top(rename.ui).byText("Back")!.click();
    expect(top(rename.ui).text()).toContain("Play again");

    const over = setup();
    const third = fakeSession(previous);
    over.presenter!.show(third);
    top(over.ui).byText("Create a different character")!.click();
    expect(third.suggest).toHaveBeenCalled();
    expect(top(over.ui).text()).toContain("Step 1 of 5 - Race");
    expect(top(over.ui).byText("Back")!.disabled).toBe(false);
    top(over.ui).byText("Use previous character")!.click();
    expect(third.usePrevious).toHaveBeenCalledTimes(2);
    expect(top(over.ui).text()).toContain("Step 5 of 5 - Review");
  });

  it("returns to the main menu from any step", () => {
    const { ui, presenter } = setup();
    const session = fakeSession();
    presenter!.show(session);
    top(ui).byText("Next")!.click();
    top(ui).byText("Return to main menu")!.click();
    expect(session.cancel).toHaveBeenCalledTimes(1);
    expect(ui.panels).toHaveLength(0);
    expect(session.accept).not.toHaveBeenCalled();
  });

  it("repaints every open step when the theme changes", () => {
    const { ui, presenter } = setup();
    presenter!.show(fakeSession());
    top(ui).byText("Next")!.click();
    notifyThemeChange(THEMES["amber-terminal"]!);
    for (const panel of ui.panels) expect(panel.root.host!.style.properties.get("--anyband-accent")).toBe(THEMES["amber-terminal"]!.accent);
    top(ui).byText("Return to main menu")!.click();
    notifyThemeChange(THEMES["midnight-ice"]!);
    expect(ui.panels).toHaveLength(0);
  });
});
