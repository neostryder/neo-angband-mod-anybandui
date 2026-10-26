/**
 * The bridge from mod API 2 to the plugin context the features were written
 * against.
 *
 * AnybandUI's features read the game through one synchronous context
 * (snapshot, knownLevel, inspect, intent, prompt, events, prefs and so on).
 * API 2 answers the same questions with promises. Rewriting forty features and
 * their tests to await every read would change what they do, so the bridge
 * answers them from two places:
 *
 * - The engine domain (first-party, in-process) hands over the core and the live
 *   state. Anything that is a plain read of that state (the known world, the
 *   known level, item inspection, game events) is computed synchronously with
 *   the engine's own functions, exactly as the host does for an API 1 mod. The
 *   real map is never read here: knownLevel is asked for with every domain
 *   except state:map-actual.read, and the glow reads the real map through the
 *   truth domain and its own consent.
 * - API 2 calls fill a cache after each frame, event and action. The input wait
 *   (phase, prompt, who holds the keyboard, the message pause), the stored
 *   preferences, the settings and the mod list come from there. Acting is
 *   optimistic: a submit that passes the checks the cache can make answers
 *   accepted at once and the real answer is read back on the next refresh.
 *
 * API2-MIGRATION.md lists, per feature, the API 2 read that will replace each
 * bridge member as Core grows them.
 */
import type {
  Api2Display,
  Api2InputState,
  Api2Intent,
  Api2ModSummary,
  Api2PromptAnswer,
  Api2Subscription,
  JsonValue,
  KnownToken,
  ModApi2,
} from "@rpgm-tools/neo-angband-mod-sdk";
import { createManagedSeams } from "./bridge-seams.js";
import type { GameEventType, GameState, InputDriver, InputSnapshot, IntentResult, ModPluginContext, PlayerIntent, PromptAnswer, PromptReplyResult } from "@rpgm-tools/neo-angband-core";

/** What the features read, as the register callback has always received it. */
export type BridgeContext = Pick<ModPluginContext, "id" | "engine" | "log" | "flags"> & Partial<Omit<ModPluginContext, "id" | "engine" | "log" | "flags">>;

export interface Bridge {
  readonly ctx: BridgeContext;
  /** Fills the caches the synchronous reads answer from. Awaited once, before the features register. */
  prime(): Promise<void>;
  /** Reads the input wait again. Calls coalesce; the returned promise settles when the cache is current. */
  refresh(): Promise<void>;
  /** The input wait as last read, or null before the first read. */
  input(): Api2InputState | null;
  /** Runs when the cache changes: after a refresh that read a new token, phase, prompt or owner. */
  onInput(listener: (input: Api2InputState | null) => void): () => void;
  dispose(): void;
}

const MAP_ACTUAL = "state:map-actual.read";
/** Every read domain except the real map. The glow asks the truth domain for that, under Core's own consent. */
const BRIDGE_CAPS = Object.freeze({ has: (capability: string): boolean => capability !== MAP_ACTUAL });

const sameToken = (a: KnownToken | null | undefined, b: KnownToken | null | undefined): boolean =>
  !!a && !!b && a.epoch === b.epoch && a.revision === b.revision;

type Listener = (type: string, payload: unknown) => void;

/** Builds the bridge for a started API 2 mod. */
export function createBridge(mod: ModApi2): Bridge {
  const engine = mod.engine;
  const display = mod.presentation?.display;
  let input: Api2InputState | null = null;
  let prefs: JsonValue | null = null;
  let settings: Readonly<Record<string, number>> = {};
  let mods: readonly Api2ModSummary[] = [];
  let busy = false;
  let disposed = false;
  let inflight: Promise<void> | null = null;
  let again = false;
  const inputListeners = new Set<(value: Api2InputState | null) => void>();
  const settingListeners = new Set<(id: string, value: number) => void>();
  const cleanups: Array<() => void> = [];
  const log = (message: string): void => mod.meta.log(message);
  const managed = createManagedSeams(mod);

  const stateOf = (): GameState | undefined => engine?.state;
  const viewOf = (state: GameState) =>
    engine!.core.createAgentView(state, undefined, { ...state.knownWorldDeps, perceivedMonstersOnly: true }, BRIDGE_CAPS);

  // The input wait.

  function applyInput(next: Api2InputState | null): void {
    const changed = !sameInput(input, next);
    input = next;
    if (changed) for (const listener of [...inputListeners]) listener(next);
  }

  function refresh(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (inflight) { again = true; return inflight; }
    inflight = (async () => {
      try {
        do {
          again = false;
          const read = await mod.view.input();
          if (disposed) return;
          applyInput(read.ok ? read.value : null);
          busy = false;
        } while (again);
      } catch (error) {
        log(`bridge: reading the input wait failed (${String(error)})`);
        busy = false;
      } finally { inflight = null; }
    })();
    return inflight;
  }

  async function prime(): Promise<void> {
    const [stored, own, list] = await Promise.all([mod.store.prefs.get(), mod.meta.settings(), mod.meta.mods(), refresh(), managed.prime()]);
    prefs = stored.ok ? stored.value : null;
    settings = own.ok ? own.value : {};
    mods = list.ok ? list.value : [];
  }

  // Reads of the live state, answered from the engine.

  const snapshot = (): InputSnapshot | null => {
    const state = stateOf();
    if (!state || !engine) return null;
    const core = viewOf(state).capture!();
    const wait = input;
    // A cache that lags the live capture is one frame behind; read it again and answer with what is known.
    if (!sameToken(wait?.token, core.token as KnownToken)) void refresh();
    return Object.freeze({
      token: (wait && sameToken(wait.token, core.token as KnownToken) ? wait.token : core.token) as InputSnapshot["token"],
      driver: (wait?.driver ?? { kind: "player" }) as InputDriver,
      phase: (wait?.phase ?? null) as InputSnapshot["phase"],
      messagePending: wait?.messagePending ?? null,
      resting: (wait?.resting ?? null) as InputSnapshot["resting"],
      messages: wait?.messages
        ? Object.freeze({ token: core.token, entries: Object.freeze(wait.messages.map((m) => m.text)), log: Object.freeze(wait.messages.map((m) => Object.freeze({ ...m }))) })
        : null,
      storeStatus: (wait?.storeStatus ?? null) as InputSnapshot["storeStatus"],
      activeBlast: (wait?.activeBlast ?? null) as InputSnapshot["activeBlast"],
      prompt: (wait?.prompt ?? null) as InputSnapshot["prompt"],
      core,
      frame: null,
    }) as InputSnapshot;
  };

  const knownLevel = (): ReturnType<NonNullable<ModPluginContext["knownLevel"]>> => {
    const state = stateOf();
    return state && engine ? viewOf(state).knownLevel?.() ?? null : null;
  };

  const inspectView = () => {
    const state = stateOf();
    return state && engine ? viewOf(state) : null;
  };
  const inspect: NonNullable<ModPluginContext["inspect"]> = {
    inspectItem: (ref) => inspectView()?.inspectItem?.(ref) ?? null,
    bookForItem: (handle) => inspectView()?.bookForItem?.(handle) ?? null,
    compareLoadoutSlots: (ref) => inspectView()?.compareLoadoutSlots?.(ref) ?? null,
    monsterRecall: (raceIndex) => inspectView()?.monsterRecall?.(raceIndex) ?? null,
    spellInfo: (spellIndex) => inspectView()?.spellInfo?.(spellIndex) ?? null,
    itemTester: (code) => inspectView()?.itemTester?.(code) ?? null,
    projectionPath: (to) => inspectView()?.projectionPath?.(to) ?? null,
    blastArea: (to, radius, arc) => inspectView()?.blastArea?.(to, radius, arc) ?? null,
    travelPath: (to) => inspectView()?.travelPath?.(to) ?? null,
    tileActions: (to) => inspectView()?.tileActions?.(to) ?? null,
    itemRules: () => inspectView()?.itemRules?.() ?? null,
    terrainCatalogue: () => inspectView()?.terrainCatalogue?.() ?? null,
  };

  // Game events, from the engine's own bus, subscribed lazily and per listener.

  const eventHandlers = new Map<string, Map<Listener, Listener>>();
  const events: NonNullable<ModPluginContext["events"]> = {
    on(type: GameEventType, listener: Listener) {
      const state = stateOf();
      if (!state?.events || !engine) throw new Error("no game is running");
      const guarded: Listener = (t, payload) => { try { listener(t, payload); } catch (error) { log(`event ${String(t)}: ${String(error)}`); } };
      let byListener = eventHandlers.get(type);
      if (!byListener) eventHandlers.set(type, byListener = new Map());
      byListener.set(listener, guarded);
      state.events.on(type, guarded as never);
    },
    off(type: GameEventType, listener: Listener) {
      const guarded = eventHandlers.get(type)?.get(listener);
      if (!guarded) return;
      eventHandlers.get(type)?.delete(listener);
      stateOf()?.events?.off(type, guarded as never);
    },
  } as unknown as NonNullable<ModPluginContext["events"]>;
  cleanups.push(() => {
    const bus = stateOf()?.events;
    for (const [type, byListener] of eventHandlers) for (const guarded of byListener.values()) bus?.off(type as GameEventType, guarded as never);
    eventHandlers.clear();
  });

  // Acting.

  function refusalOf(result: { readonly ok: false; readonly reason: string; readonly message?: string; readonly code?: string }): IntentResult {
    const code = result.code === "controller-owned" ? "controller-owned" : undefined;
    return { accepted: false, reason: result.message ?? result.reason, ...(code ? { code } : {}) };
  }

  /** The checks the cache can make before a submit or reply goes out. */
  function precheck(token: KnownToken | null): IntentResult | null {
    if (!input) return { accepted: false, reason: "No input wait is open." };
    if (input.driver.kind === "controller" && input.driver.owner !== mod.meta.id) return { accepted: false, reason: "Another mod holds the keyboard.", code: "controller-owned" };
    if (token && !sameToken(token, input.token)) return { accepted: false, reason: "That input wait is over." };
    if (busy) return { accepted: false, reason: "The game is still working." };
    return null;
  }

  const settle = (call: Promise<{ readonly ok: boolean }>, what: string): void => {
    void call.then((result) => {
      if (!result.ok) log(`${what} was refused (${(result as { message?: string }).message ?? "no reason given"})`);
    }, (error) => log(`${what} failed (${String(error)})`)).finally(() => { void refresh(); });
  };

  const intent: NonNullable<ModPluginContext["intent"]> = {
    submit(token, wanted: PlayerIntent): IntentResult {
      const refused = precheck(token as KnownToken);
      if (refused) return refused;
      busy = true;
      settle(mod.act.submit(token as KnownToken, wanted as Api2Intent), "an action");
      return { accepted: true };
    },
    catalogue: () => catalogueCache as never,
  };
  let catalogueCache: unknown;
  const reloadCatalogue = async (): Promise<void> => {
    const read = await mod.view.catalogue();
    if (read.ok) catalogueCache = read.value;
  };

  const prompt: NonNullable<ModPluginContext["prompt"]> = {
    reply(promptId: number, answer: PromptAnswer): PromptReplyResult {
      const refused = precheck(null);
      if (refused) return refused as PromptReplyResult;
      if (input?.prompt?.promptId !== promptId) return { accepted: false, reason: "That question is no longer open." } as PromptReplyResult;
      busy = true;
      settle(mod.act.answer(promptId, answer as Api2PromptAnswer), "an answer");
      return { accepted: true } as PromptReplyResult;
    },
  };

  // Stored values and the mod list.

  const prefsSeam: NonNullable<ModPluginContext["prefs"]> = {
    get: () => prefs,
    set(value: unknown) {
      prefs = (value === undefined ? null : value) as JsonValue | null;
      settle(mod.store.prefs.set(prefs), "saving preferences");
    },
  };

  const settingsSeam: NonNullable<ModPluginContext["settings"]> = {
    get: (id) => settings[id],
    all: () => settings,
    set(id, value) {
      if (!(id in settings) || typeof value !== "number") return undefined;
      settings = { ...settings, [id]: value };
      void mod.meta.setSetting(id, value).then((result) => {
        if (!result.ok) return;
        settings = { ...settings, [id]: result.value };
        for (const listener of [...settingListeners]) listener(id, result.value);
      });
      return value;
    },
    onChange(listener) {
      settingListeners.add(listener);
      return () => { settingListeners.delete(listener); };
    },
  };

  // Presentation: the same shapes, handed through.

  const presentation = mod.presentation;
  const displayHandle = display as Api2Display | undefined;
  if (displayHandle?.onFrame) cleanups.push(displayHandle.onFrame(() => { void refresh(); }));
  if (displayHandle) cleanups.push(displayHandle.onKey(() => { void refresh(); }));
  if (presentation) cleanups.push(presentation.onPhaseChanged(() => { void refresh(); }));
  // The driver and the end of the world can change with no frame to follow.
  void mod.events.on("driver-changed", () => { void refresh(); });
  void reloadCatalogue();

  const ctx = {
    id: mod.meta.id,
    engine: mod.meta.engine,
    log,
    flags: mod.meta.flags,
    ...(engine ? { core: engine.core, registries: engine.registries } : {}),
    get state() { return stateOf(); },
    snapshot,
    knownLevel,
    inspect,
    intent,
    prompt,
    events,
    driver: (): InputDriver => (input?.driver ?? { kind: "player" }) as InputDriver,
    mods: () => mods as never,
    prefs: prefsSeam,
    settings: settingsSeam,
    ...(displayHandle ? { display: displayHandle } : {}),
    ...(presentation?.panels ? { ui: presentation.panels } : {}),
    ...(presentation?.subwindows ? { subwindows: presentation.subwindows } : {}),
    ...(presentation?.tiles ? { tiles: presentation.tiles } : {}),
    ...(presentation?.keyRepeat ? { keyRepeat: presentation.keyRepeat } : {}),
    ...managed.seams,
  } as unknown as BridgeContext;

  return {
    ctx,
    prime,
    refresh,
    input: () => input,
    onInput(listener) { inputListeners.add(listener); return () => { inputListeners.delete(listener); }; },
    dispose() {
      disposed = true;
      managed.dispose();
      for (const cleanup of cleanups.splice(0).reverse()) { try { cleanup(); } catch { /* a handle already gone */ } }
      inputListeners.clear();
      settingListeners.clear();
    },
  };
}

function sameInput(a: Api2InputState | null, b: Api2InputState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return sameToken(a.token, b.token) && a.phase === b.phase && a.messagePending === b.messagePending
    && a.driver.kind === b.driver.kind && (a.driver as { owner?: string }).owner === (b.driver as { owner?: string }).owner
    && (a.prompt?.promptId ?? null) === (b.prompt?.promptId ?? null);
}

export type { Api2Subscription };
