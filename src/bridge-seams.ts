/**
 * The management and record seams of the bridge: the character, the knowledge
 * lists, the options, the keymaps, the roster, the session, the title rows and
 * the character store.
 *
 * API 2 answers each of these with a promise. The features read them in
 * the middle of drawing a panel, so each read is served from a cache that is
 * filled when the bridge starts and refilled in the background once it is
 * older than its time limit. A caller that reads an old value also starts the
 * refill, and the panels that repaint on a timer pick the new value up. Changes
 * go out at once and the cache is read again when the host has answered.
 */
import type {
  Api2Call,
  Api2Character,
  Api2Keyset,
  JsonValue,
  ModApi2,
} from "@rpgm-tools/neo-angband-mod-sdk";
import type {
  CharacterHistoryEntry,
  CharacterSheetData,
  KnowledgeCategoryView,
  KnowledgeListView,
  ModCharacterStore,
  ModGameCommand,
  ModGameSession,
  ModKeybinding,
  ModKeybindings,
  ModKnowledge,
  ModOptions,
  ModOptionsChange,
  ModOptionsResult,
  ModOptionsView,
  ModSaves,
  ModTitle,
  RunReport,
  SaveListResult,
  SaveResult,
} from "@rpgm-tools/neo-angband-core";

type ScreenView = ReturnType<ModKnowledge["recall"]>;
type Read<T> = Awaited<Api2Call<T>>;

interface Cell<T> {
  /** The cached value. Starts a refill when the value is older than its time limit. */
  get(): T;
  /** Reads again now. */
  reload(): Promise<boolean>;
  /** Replaces the cached value, as a change that has just gone out would. */
  put(value: T): void;
  /** True when the host has never answered this read with a value. */
  empty(): boolean;
}

function cell<T>(load: () => Promise<Read<T>>, initial: T, ttlMs: number, now: () => number): Cell<T> {
  let value = initial;
  let at = Number.NEGATIVE_INFINITY;
  let loaded = false;
  let inflight: Promise<boolean> | null = null;
  const reload = (): Promise<boolean> => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const read = await load();
        if (read.ok) { value = read.value; loaded = true; }
        return read.ok;
      } catch { return false; } finally { at = now(); inflight = null; }
    })();
    return inflight;
  };
  return {
    get() { if (now() - at > ttlMs) void reload(); return value; },
    reload,
    put(next) { value = next; at = now(); loaded = true; },
    empty: () => !loaded,
  };
}

const refusal = (read: { readonly ok: false; readonly message?: string; readonly reason?: string }): string =>
  read.message ?? read.reason ?? "the game refused";

/** Builds the `SaveResult` the features expect from an API 2 result. */
const saveResult = (read: Read<unknown>): SaveResult => (read.ok ? { ok: true } : { ok: false, reason: refusal(read) });

export interface ManagedSeams {
  readonly seams: {
    readonly character: NonNullable<import("@rpgm-tools/neo-angband-core").ModPluginContext["character"]>;
    readonly knowledge: ModKnowledge;
    readonly options?: ModOptions;
    readonly keybindings?: ModKeybindings;
    readonly saves?: ModSaves;
    readonly session?: ModGameSession;
    readonly title?: ModTitle;
    readonly characterStore: ModCharacterStore;
  };
  /** Fills every cache. Safe to call more than once. */
  prime(): Promise<void>;
  dispose(): void;
}

/** Builds the seams over a started API 2 mod. */
export function createManagedSeams(mod: ModApi2, now: () => number = Date.now): ManagedSeams {
  const cleanups: Array<() => void> = [];
  const manage = mod.manage;
  const log = (message: string): void => mod.meta.log(message);

  // The character.

  const character = cell<Api2Character | null>(() => mod.view.character(), null, 1000, now);
  const runEnds = new Set<(report: RunReport) => void>();
  let runEndHooked = false;
  const hookRunEnd = (): void => {
    if (runEndHooked) return;
    runEndHooked = true;
    void mod.events.on("run-end", (event) => {
      if (event.report) for (const listener of [...runEnds]) { try { listener(event.report as RunReport); } catch (error) { log(`run end: ${String(error)}`); } }
    }).then((subscription) => {
      if (subscription.ok) cleanups.push(() => { void mod.events.off(subscription.value); });
    });
  };
  const characterSeam: ManagedSeams["seams"]["character"] = {
    key: () => character.get()?.key ?? null,
    sheet: () => (character.get()?.sheet ?? null) as CharacterSheetData | null,
    history: () => (character.get()?.history ?? []) as readonly CharacterHistoryEntry[],
    runReport: () => (character.get()?.report ?? null) as RunReport | null,
    onRunEnd(listener) {
      hookRunEnd();
      runEnds.add(listener);
      return () => { runEnds.delete(listener); };
    },
  };

  // The knowledge lists: the categories, each category's list and each recall page.

  const categories = cell<readonly KnowledgeCategoryView[]>(async () => {
    const read = await mod.view.knowledge();
    return read.ok ? { ok: true as const, value: read.value.categories as readonly KnowledgeCategoryView[] } : read;
  }, [], 2000, now);
  const lists = new Map<string, Cell<KnowledgeListView | null>>();
  const pages = new Map<string, Cell<ScreenView | null>>();
  const PAGE_LIMIT = 64;
  const knowledge: ModKnowledge = {
    categories: () => categories.get(),
    list(category) {
      let entry = lists.get(category);
      if (!entry) {
        entry = cell<KnowledgeListView | null>(async () => {
          const read = await mod.view.knowledge(category);
          return read.ok ? { ok: true as const, value: (read.value.lists as Record<string, KnowledgeListView | undefined>)[category] ?? null } : read;
        }, null, 2000, now);
        lists.set(category, entry);
      }
      return entry.get();
    },
    recall(category, id) {
      const key = `${category}\u0000${id}`;
      let entry = pages.get(key);
      if (!entry) {
        if (pages.size >= PAGE_LIMIT) pages.delete(pages.keys().next().value as string);
        entry = cell<ScreenView | null>(async () => {
          const read = await mod.view.knowledge(category, id);
          return read.ok ? { ok: true as const, value: (read.value.recall ?? null) as ScreenView | null } : read;
        }, null, 2000, now);
        pages.set(key, entry);
      }
      return entry.get();
    },
  };

  // The options.

  const options = manage ? cell<ModOptionsView | null>(async () => {
    const read = await manage.options.get();
    return read.ok ? { ok: true as const, value: read.value as ModOptionsView } : read;
  }, null, 1500, now) : null;
  const optionsSeam: ModOptions | undefined = manage && options ? {
    get() {
      const view = options.get();
      if (!view) throw new Error("the game has not answered with its options yet");
      return view;
    },
    set: ((change: ModOptionsChange): Promise<ModOptionsResult> => manage.options.set(change).then(async (read) => {
      if (!read.ok) return { ok: false as const, reason: refusal(read) };
      await options.reload();
      return { ok: true as const, changed: read.value };
    })) as unknown as NonNullable<ModOptions["set"]>,
  } : undefined;

  // The keymaps.

  const keyset = manage ? cell<Api2Keyset>(() => manage.keys.keyset(), "original", 1500, now) : null;
  const keyLists = new Map<Api2Keyset, Cell<readonly ModKeybinding[]>>();
  const keysFor = (set: Api2Keyset): Cell<readonly ModKeybinding[]> => {
    let entry = keyLists.get(set);
    if (!entry) {
      entry = cell<readonly ModKeybinding[]>(() => manage!.keys.list(set), [], 1500, now);
      keyLists.set(set, entry);
    }
    return entry;
  };
  const commands = manage ? cell<readonly ModGameCommand[]>(() => manage.keys.commands(), [], 3000, now) : null;
  const keybindingsSeam: ModKeybindings | undefined = manage && keyset && commands ? {
    keyset: () => keyset.get(),
    list: (set) => keysFor(set ?? keyset.get()).get(),
    set(trigger, action, set) {
      if (!trigger || !action) return false;
      const target = set ?? keyset.get();
      const entry = keysFor(target);
      const before = entry.get();
      entry.put([...before.filter((binding) => binding.trigger !== trigger), { trigger, action, owner: null }]);
      void manage.keys.set(trigger, action, target, true).then((read) => {
        if (!read.ok) log(`keymap ${trigger} was refused (${refusal(read)})`);
      }).finally(() => { void entry.reload(); });
      return true;
    },
    remove(trigger, set) {
      const target = set ?? keyset.get();
      const entry = keysFor(target);
      const before = entry.get();
      if (!before.some((binding) => binding.trigger === trigger)) return false;
      entry.put(before.filter((binding) => binding.trigger !== trigger));
      void manage.keys.remove(trigger, target).then((read) => {
        if (!read.ok) log(`removing keymap ${trigger} was refused (${refusal(read)})`);
      }).finally(() => { void entry.reload(); });
      return true;
    },
    commands: () => commands.get(),
    capture: async () => {
      const read = await manage.keys.capture();
      return read.ok ? read.value : null;
    },
    cancelCapture: () => { void manage.keys.cancelCapture(); return true; },
  } : undefined;

  // The roster.

  const savesSeam: ModSaves | undefined = manage ? {
    async list(): Promise<SaveListResult> {
      const read = await manage.saves.list();
      return read.ok ? { ok: true, entries: read.value } : { ok: false, reason: refusal(read) };
    },
    load: async (id) => saveResult(await manage.saves.load(id)),
    rename: async (id, name) => saveResult(await manage.saves.rename(id, name)),
    delete: async (id) => saveResult(await manage.saves.delete(id)),
    create: async (create) => saveResult(await manage.saves.create(create as Parameters<typeof manage.saves.create>[0])),
  } : undefined;

  // The session.

  const sessionSeam: ModGameSession | undefined = manage ? {
    // The features await every session call, so a save answers with what the host said.
    save: (() => manage.session.save().then(saveResult)) as unknown as ModGameSession["save"],
    exitToTitle: async () => saveResult(await manage.session.exitToTitle()),
    quit: async () => saveResult(await manage.session.quit()),
  } : undefined;

  // The title screen.

  const titleHandle = mod.presentation?.title;
  const titleSeam: ModTitle | undefined = titleHandle ? {
    registerRow(row) {
      let subscription: { readonly id: string } | null = null;
      let removed = false;
      void titleHandle.registerRow({ id: `${mod.meta.id}:${row.label}`, label: row.label, ...(row.key ? { key: row.key } : {}), run: () => row.run() }).then((read) => {
        if (!read.ok) { log(`title row ${row.label} was refused (${refusal(read)})`); return; }
        subscription = read.value;
        if (removed) void titleHandle.removeRow(read.value);
      });
      const remove = (): void => {
        if (removed) return;
        removed = true;
        if (subscription) void titleHandle.removeRow(subscription as never);
      };
      cleanups.push(remove);
      return remove;
    },
    choose: async (label, choices) => {
      const read = await titleHandle.choose(label, choices);
      return read.ok ? read.value : null;
    },
  } : undefined;

  // The character's own record on its save.

  let stored: JsonValue | null = null;
  const storedCell = cell<JsonValue | null>(() => mod.store.character.get(), null, 1000, now);
  const characterStore: ModCharacterStore = {
    get: () => { stored = storedCell.get(); return stored; },
    set(value) {
      const next = (value === undefined ? null : value) as JsonValue | null;
      storedCell.put(next);
      void mod.store.character.set(next).then((read) => {
        if (!read.ok) log(`saving the character record was refused (${refusal(read)})`);
      });
    },
  };

  return {
    seams: {
      character: characterSeam,
      knowledge,
      ...(optionsSeam ? { options: optionsSeam } : {}),
      ...(keybindingsSeam ? { keybindings: keybindingsSeam } : {}),
      ...(savesSeam ? { saves: savesSeam } : {}),
      ...(sessionSeam ? { session: sessionSeam } : {}),
      ...(titleSeam ? { title: titleSeam } : {}),
      characterStore,
    },
    async prime() {
      await Promise.all([
        character.reload(), categories.reload(), storedCell.reload(),
        options?.reload(), keyset?.reload(), commands?.reload(),
      ]);
      if (keyset) await keysFor(keyset.get()).reload();
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) { try { cleanup(); } catch { /* a handle already gone */ } }
      runEnds.clear();
      lists.clear();
      pages.clear();
      keyLists.clear();
    },
  };
}
