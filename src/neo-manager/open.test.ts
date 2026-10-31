import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeNode } from "../menus/test-dom.js";
import { hasOpener, openMenu } from "../menus/openers.js";
import { installNeoManager, NEO_MANAGER_KEY } from "./open.js";
import { testHost } from "./test-host.js";

const flush = async (): Promise<void> => { for (let index = 0; index < 30; index += 1) await Promise.resolve(); };
const stops: (() => void)[] = [];
afterEach(() => { for (const stop of stops.splice(0)) stop(); });

function fakePanels() {
  const opened: { spec: unknown; root: FakeNode; close: ReturnType<typeof vi.fn>; finish: () => void }[] = [];
  const panels = {
    openPanel(spec: unknown) {
      const root = new FakeNode("root");
      let finish = (): void => {};
      const closed = new Promise<void>((resolve) => { finish = resolve; });
      const close = vi.fn(() => finish());
      opened.push({ spec, root, close, finish });
      return { id: "p", root, open: true, closed, close };
    },
    registerPanelKind: () => () => {},
    openPanels: [],
  };
  return { panels: panels as never, opened };
}

function fakeTitle() {
  const rows: { id: string; label: string; run(): void | Promise<void> }[] = [];
  const removed: unknown[] = [];
  const title = {
    registerRow: async (row: { id: string; label: string; run(): void | Promise<void> }) => { rows.push(row); return { ok: true as const, value: { id: row.id } }; },
    removeRow: async (subscription: unknown) => { removed.push(subscription); return { ok: true as const, value: null }; },
    choose: async () => ({ ok: true as const, value: null }),
  };
  return { title: title as never, rows, removed };
}

describe("opening the Neo Angband manager", () => {
  it("registers an opener and a title row, and opens one modal panel for both", async () => {
    const { panels, opened } = fakePanels();
    const { title, rows } = fakeTitle();
    stops.push(installNeoManager({ host: testHost().host, panels, title, log: vi.fn() }));
    await flush();
    expect(hasOpener(NEO_MANAGER_KEY)).toBe(true);
    expect(rows.map((row) => row.label)).toEqual(["Mods"]);
    await rows[0]!.run();
    expect(openMenu(NEO_MANAGER_KEY)).toBe(true);
    expect(opened).toHaveLength(1);
    expect(opened[0]!.spec).toMatchObject({ modal: true, label: "Mods" });
    await flush();
    expect(opened[0]!.root.children[0]!.children[0]!.hidden).toBe(false);
  });

  it("opens a fresh panel after the host closes the last one", async () => {
    const { panels, opened } = fakePanels();
    stops.push(installNeoManager({ host: testHost().host, panels, title: undefined, log: vi.fn() }));
    openMenu(NEO_MANAGER_KEY);
    opened[0]!.finish();
    await flush();
    openMenu(NEO_MANAGER_KEY);
    expect(opened).toHaveLength(2);
  });

  it("closes the panel when the manager is closed from inside", async () => {
    const { panels, opened } = fakePanels();
    stops.push(installNeoManager({ host: testHost().host, panels, title: undefined, log: vi.fn() }));
    openMenu(NEO_MANAGER_KEY);
    await flush();
    const manager = opened[0]!.root.children[0]!.children[0]!;
    manager.fire("keydown", "Escape");
    expect(opened[0]!.close).toHaveBeenCalled();
  });

  it("removes its opener, its title row and its panel when the mod stops", async () => {
    const { panels, opened } = fakePanels();
    const { title, removed } = fakeTitle();
    const stop = installNeoManager({ host: testHost().host, panels, title, log: vi.fn() });
    await flush();
    openMenu(NEO_MANAGER_KEY);
    stop();
    expect(hasOpener(NEO_MANAGER_KEY)).toBe(false);
    expect(removed).toHaveLength(1);
    expect(opened[0]!.close).toHaveBeenCalled();
  });

  it("says in the log, and does nothing, when the host has no panels", () => {
    const log = vi.fn();
    stops.push(installNeoManager({ host: testHost().host, panels: undefined, title: undefined, log }));
    openMenu(NEO_MANAGER_KEY);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("no panels"));
  });

  describe("taking the game's Mods screen", () => {
    const fakeScreens = (answer: "ok" | "taken") => {
      const taken: Record<string, () => void | Promise<void>>[] = [];
      const screens = {
        take: async (handlers: Record<string, () => void | Promise<void>>) => {
          if (answer === "taken") return { ok: false as const, code: "taken", message: "another mod holds it" };
          taken.push(handlers);
          return { ok: true as const, value: null };
        },
      };
      return { screens: screens as never, taken };
    };

    it("hands over a handler that opens the panel and resolves when it closes, and adds no title row", async () => {
      const { panels, opened } = fakePanels();
      const { title, rows } = fakeTitle();
      const { screens, taken } = fakeScreens("ok");
      stops.push(installNeoManager({ host: testHost().host, panels, title, screens, log: vi.fn() }));
      await flush();
      expect(Object.keys(taken[0]!)).toEqual(["mods"]);
      expect(rows).toHaveLength(0);
      let resolved = false;
      const shown = Promise.resolve(taken[0]!.mods!()).then(() => { resolved = true; });
      await flush();
      expect(opened).toHaveLength(1);
      expect(resolved).toBe(false);
      opened[0]!.finish();
      await shown;
      expect(resolved).toBe(true);
    });

    it("resolves a second call with the panel already open when that panel closes", async () => {
      const { panels, opened } = fakePanels();
      const { screens, taken } = fakeScreens("ok");
      stops.push(installNeoManager({ host: testHost().host, panels, title: undefined, screens, log: vi.fn() }));
      await flush();
      const first = Promise.resolve(taken[0]!.mods!());
      const second = Promise.resolve(taken[0]!.mods!());
      await flush();
      expect(opened).toHaveLength(1);
      opened[0]!.finish();
      await Promise.all([first, second]);
    });

    it("rejects when the host has no panels, so the game keeps its own screen", async () => {
      const { screens, taken } = fakeScreens("ok");
      stops.push(installNeoManager({ host: testHost().host, panels: undefined, title: undefined, screens, log: vi.fn() }));
      await flush();
      await expect(Promise.resolve(taken[0]!.mods!())).rejects.toThrow("no panels");
    });

    it("falls back to the title row when the game refuses the screen", async () => {
      const { panels } = fakePanels();
      const { title, rows } = fakeTitle();
      const { screens } = fakeScreens("taken");
      const log = vi.fn();
      stops.push(installNeoManager({ host: testHost().host, panels, title, screens, log }));
      await flush();
      expect(rows.map((row) => row.label)).toEqual(["Mods"]);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("kept its own Mods screen"));
    });
  });
});
