import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import { cellText, hallOfFamePart, HALL_OF_FAME_ID } from "./hall-of-fame.js";
import { fakeUi, flush, press, withHtmlElement } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => restore());

const COLUMNS = ["rank", "points", "who", "race", "class", "level", "depth", "how", "date", "gold", "turns", "uid"].map((key) => ({ key, ...(["rank", "points", "level", "depth", "gold", "turns", "uid"].includes(key) ? { align: "right" as const } : {}) }));

function row(rank: number, who: string, highlighted: boolean) {
  return { id: `core:score:${rank}`, semantic: { kind: "score" as const, ref: rank, data: { who, how: "Grip" } },
    values: { rank, highlighted: highlighted ? 1 : 0 },
    cells: { rank: { text: `${rank})` }, points: { text: "1200" }, who: { text: who }, race: { text: "Human" }, class: { text: "Warrior" },
      level: { text: "20", values: { current: 20, max: 21 } }, depth: { text: "5", values: { current: 5, max: 5 } },
      how: { text: "Grip" }, date: { text: "2026-10-01" }, gold: { text: "50" }, turns: { text: "900" }, uid: { text: "0" } } };
}

function view(rows = [row(1, "Alpha", false), row(2, "Beta", true)]): ScreenView {
  return { id: HALL_OF_FAME_ID, title: "Angband Hall of Fame", footer: "", blocks: [{ kind: "table", key: "scores", tagged: false, columns: COLUMNS, rows, empty: { text: "(no scores yet)" } }] } as unknown as ScreenView;
}

describe("the hall of fame", () => {
  it("is absent with its switch off", () => {
    expect(hallOfFamePart({ flags: {}, ui: fakeUi().ui, log: () => {} })).toBeNull();
  });

  it("declines every other screen, and declines when no panel can open", () => {
    const part = hallOfFamePart({ flags: { "anybandui.hallOfFame": true }, ui: fakeUi({ refuse: () => true }).ui, log: () => {} })!;
    expect(part.show({ ...view(), id: "core:inventory" })).toBeUndefined();
    expect(part.show(view())).toBeUndefined();
  });

  it("draws Core's scores as a table with the player's row marked, and closes on Escape", async () => {
    const host = fakeUi();
    const part = hallOfFamePart({ flags: { "anybandui.hallOfFame": true }, ui: host.ui, log: () => {} })!;
    const shown = part.show(view())!;
    const root = host.top()!.root;
    expect(root.text()).toContain("Angband Hall of Fame");
    expect(root.text()).toContain("How it ended");
    expect(root.text()).toContain("20 (max 21)");
    const marked = root.all("tr").filter((tr) => tr.attributes["aria-current"] === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0]!.text()).toContain("Beta");
    // The uid column is left out.
    expect(root.all("th")).toHaveLength(11);
    press(root, "ArrowDown");
    host.escape();
    await flush();
    await expect(shown.dismissed).resolves.toBeUndefined();
  });

  it("shows Core's empty text when there are no scores", () => {
    const host = fakeUi();
    hallOfFamePart({ flags: { "anybandui.hallOfFame": true }, ui: host.ui, log: () => {} })!.show(view([]));
    expect(host.top()!.root.text()).toContain("(no scores yet)");
  });

  it("writes a level below its maximum with the maximum", () => {
    expect(cellText({ text: "5", values: { current: 5, max: 5 } })).toBe("5");
    expect(cellText({ text: "4", values: { current: 4, max: 6 } })).toBe("4 (max 6)");
    expect(cellText(undefined)).toBe("");
  });
});
