import type { ModApi2 } from "@rpgm-tools/neo-angband-mod-sdk";
import { registerOpener } from "../menus/openers.js";
import { mountNeoManager, type NeoManagerHandle } from "./components.js";
import type { ManagerTab } from "./model.js";
import type { ManageHost } from "./types.js";

/** The name the settings window uses to bring the manager forward. */
export const NEO_MANAGER_KEY = "neo-manager";
const PANEL_ID = "neo-angband-manager";
const TITLE = "Mods";

type Panels = NonNullable<NonNullable<ModApi2["presentation"]>["panels"]>;
type Title = NonNullable<NonNullable<ModApi2["presentation"]>["title"]>;
type Screens = NonNullable<ModApi2["manage"]>["screens"];

export interface NeoManagerInstall {
  readonly host: ManageHost;
  readonly panels: Panels | undefined;
  readonly title: Title | undefined;
  /** The game's screen seam. When it hands over the Mods screen, the game menu and the title open the manager and no title row is added. */
  readonly screens?: Screens | undefined;
  readonly log: (message: string) => void;
}

/**
 * Open the manager in one modal panel, or bring the open one forward. The panel
 * and the manager close together: the manager's own Escape and Back close the
 * panel, and the host's close (its frame, its Escape) disposes the manager.
 */
export function installNeoManager(deps: NeoManagerInstall): () => void {
  let handle: NeoManagerHandle | null = null;
  let panel: ReturnType<Panels["openPanel"]> | null = null;
  let stopped = false;

  let done: Promise<void> | null = null;

  /** Shows the manager and resolves when the panel closes; rejects when it cannot open, so the game keeps its own screen. */
  const show = (tab?: ManagerTab): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (handle && done) { handle.open(tab); return done; }
    if (!deps.panels) {
      deps.log("neo-manager: this host has no panels to open it in");
      return Promise.reject(new Error("no panels"));
    }
    try {
      const shown = deps.panels.openPanel({ id: PANEL_ID, modal: true, label: TITLE });
      panel = shown;
      const frame = shown.root.ownerDocument.createElement("div");
      shown.root.appendChild(frame);
      const mounted = mountNeoManager(deps.host, frame, () => { if (panel === shown) shown.close(); });
      handle = mounted;
      done = shown.closed.then(() => {
        if (panel !== shown) return;
        panel = null;
        handle = null;
        done = null;
        mounted.dispose();
      });
      mounted.open(tab);
      return done;
    } catch (error) {
      handle?.dispose();
      handle = null;
      panel = null;
      done = null;
      deps.log(`neo-manager: could not open (${String(error)})`);
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };
  const open = (tab?: ManagerTab): void => { void show(tab).catch(() => {}); };

  const stopOpener = registerOpener(NEO_MANAGER_KEY, () => open());
  let row: Awaited<ReturnType<Title["registerRow"]>> | null = null;
  const addRow = (): void => {
    if (!deps.title || stopped) return;
    void deps.title.registerRow({ id: "anybandui:mods", label: TITLE, run: () => open() }).then((result) => {
      if (!result.ok) { deps.log(`neo-manager: title row refused (${result.message})`); return; }
      if (stopped) void deps.title?.removeRow(result.value);
      else row = result;
    }).catch((error: unknown) => deps.log(`neo-manager: title row failed (${String(error)})`));
  };
  if (deps.screens) {
    void deps.screens.take({ mods: () => show() }).then((result) => {
      if (result.ok) { deps.log("neo-manager: took the game's Mods screen"); return; }
      deps.log(`neo-manager: the game kept its own Mods screen (${result.message})`);
      addRow();
    }).catch((error: unknown) => {
      deps.log(`neo-manager: taking the Mods screen failed (${String(error)})`);
      addRow();
    });
  } else addRow();

  return () => {
    if (stopped) return;
    stopped = true;
    stopOpener();
    if (row && row.ok && deps.title) void deps.title.removeRow(row.value);
    const shown = panel;
    panel = null;
    handle?.dispose();
    handle = null;
    shown?.close();
  };
}
