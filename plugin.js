// anybandui - generated from plugin.ts by neo-angband-mod-build
// (@rpgm-tools/neo-angband-mod-sdk). Edit the TypeScript source, not this file.

// src/bridge-seams.ts
function cell(load, initial, ttlMs, now) {
  let value2 = initial;
  let at = Number.NEGATIVE_INFINITY;
  let loaded = false;
  let inflight = null;
  const reload = () => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const read = await load();
        if (read.ok) {
          value2 = read.value;
          loaded = true;
        }
        return read.ok;
      } catch {
        return false;
      } finally {
        at = now();
        inflight = null;
      }
    })();
    return inflight;
  };
  return {
    get() {
      if (now() - at > ttlMs) void reload();
      return value2;
    },
    reload,
    put(next) {
      value2 = next;
      at = now();
      loaded = true;
    },
    empty: () => !loaded
  };
}
var refusal = (read) => read.message ?? read.reason ?? "the game refused";
var saveResult = (read) => read.ok ? { ok: true } : { ok: false, reason: refusal(read) };
function createManagedSeams(mod, now = Date.now) {
  const cleanups = [];
  const manage = mod.manage;
  const log = (message) => mod.meta.log(message);
  const character = cell(() => mod.view.character(), null, 1e3, now);
  const runEnds = /* @__PURE__ */ new Set();
  let runEndHooked = false;
  const hookRunEnd = () => {
    if (runEndHooked) return;
    runEndHooked = true;
    void mod.events.on("run-end", (event) => {
      if (event.report) for (const listener of [...runEnds]) {
        try {
          listener(event.report);
        } catch (error) {
          log(`run end: ${String(error)}`);
        }
      }
    }).then((subscription) => {
      if (subscription.ok) cleanups.push(() => {
        void mod.events.off(subscription.value);
      });
    });
  };
  const characterSeam = {
    key: () => character.get()?.key ?? null,
    sheet: () => character.get()?.sheet ?? null,
    history: () => character.get()?.history ?? [],
    runReport: () => character.get()?.report ?? null,
    onRunEnd(listener) {
      hookRunEnd();
      runEnds.add(listener);
      return () => {
        runEnds.delete(listener);
      };
    }
  };
  const categories = cell(async () => {
    const read = await mod.view.knowledge();
    return read.ok ? { ok: true, value: read.value.categories } : read;
  }, [], 2e3, now);
  const lists = /* @__PURE__ */ new Map();
  const pages = /* @__PURE__ */ new Map();
  const PAGE_LIMIT = 64;
  const knowledge = {
    categories: () => categories.get(),
    list(category) {
      let entry2 = lists.get(category);
      if (!entry2) {
        entry2 = cell(async () => {
          const read = await mod.view.knowledge(category);
          return read.ok ? { ok: true, value: read.value.lists[category] ?? null } : read;
        }, null, 2e3, now);
        lists.set(category, entry2);
      }
      return entry2.get();
    },
    recall(category, id) {
      const key = `${category}\0${id}`;
      let entry2 = pages.get(key);
      if (!entry2) {
        if (pages.size >= PAGE_LIMIT) pages.delete(pages.keys().next().value);
        entry2 = cell(async () => {
          const read = await mod.view.knowledge(category, id);
          return read.ok ? { ok: true, value: read.value.recall ?? null } : read;
        }, null, 2e3, now);
        pages.set(key, entry2);
      }
      return entry2.get();
    }
  };
  const options = manage ? cell(async () => {
    const read = await manage.options.get();
    return read.ok ? { ok: true, value: read.value } : read;
  }, null, 1500, now) : null;
  const optionsSeam = manage && options ? {
    get() {
      const view = options.get();
      if (!view) throw new Error("the game has not answered with its options yet");
      return view;
    },
    set: ((change) => manage.options.set(change).then(async (read) => {
      if (!read.ok) return { ok: false, reason: refusal(read) };
      await options.reload();
      return { ok: true, changed: read.value };
    }))
  } : void 0;
  const keyset = manage ? cell(() => manage.keys.keyset(), "original", 1500, now) : null;
  const keyLists = /* @__PURE__ */ new Map();
  const keysFor = (set) => {
    let entry2 = keyLists.get(set);
    if (!entry2) {
      entry2 = cell(() => manage.keys.list(set), [], 1500, now);
      keyLists.set(set, entry2);
    }
    return entry2;
  };
  const commands = manage ? cell(() => manage.keys.commands(), [], 3e3, now) : null;
  const keybindingsSeam = manage && keyset && commands ? {
    keyset: () => keyset.get(),
    list: (set) => keysFor(set ?? keyset.get()).get(),
    set(trigger, action, set) {
      if (!trigger || !action) return false;
      const target = set ?? keyset.get();
      const entry2 = keysFor(target);
      const before = entry2.get();
      entry2.put([...before.filter((binding) => binding.trigger !== trigger), { trigger, action, owner: null }]);
      void manage.keys.set(trigger, action, target, true).then((read) => {
        if (!read.ok) log(`keymap ${trigger} was refused (${refusal(read)})`);
      }).finally(() => {
        void entry2.reload();
      });
      return true;
    },
    remove(trigger, set) {
      const target = set ?? keyset.get();
      const entry2 = keysFor(target);
      const before = entry2.get();
      if (!before.some((binding) => binding.trigger === trigger)) return false;
      entry2.put(before.filter((binding) => binding.trigger !== trigger));
      void manage.keys.remove(trigger, target).then((read) => {
        if (!read.ok) log(`removing keymap ${trigger} was refused (${refusal(read)})`);
      }).finally(() => {
        void entry2.reload();
      });
      return true;
    },
    commands: () => commands.get(),
    capture: async () => {
      const read = await manage.keys.capture();
      return read.ok ? read.value : null;
    },
    cancelCapture: () => {
      void manage.keys.cancelCapture();
      return true;
    }
  } : void 0;
  const savesSeam = manage ? {
    async list() {
      const read = await manage.saves.list();
      return read.ok ? { ok: true, entries: read.value } : { ok: false, reason: refusal(read) };
    },
    load: async (id) => saveResult(await manage.saves.load(id)),
    rename: async (id, name) => saveResult(await manage.saves.rename(id, name)),
    delete: async (id) => saveResult(await manage.saves.delete(id)),
    create: async (create) => saveResult(await manage.saves.create(create))
  } : void 0;
  const sessionSeam = manage ? {
    // The features await every session call, so a save answers with what the host said.
    save: (() => manage.session.save().then(saveResult)),
    exitToTitle: async () => saveResult(await manage.session.exitToTitle()),
    quit: async () => saveResult(await manage.session.quit())
  } : void 0;
  const titleHandle = mod.presentation?.title;
  const titleSeam = titleHandle ? {
    registerRow(row) {
      let subscription = null;
      let removed = false;
      void titleHandle.registerRow({ id: `${mod.meta.id}:${row.label}`, label: row.label, ...row.key ? { key: row.key } : {}, run: () => row.run() }).then((read) => {
        if (!read.ok) {
          log(`title row ${row.label} was refused (${refusal(read)})`);
          return;
        }
        subscription = read.value;
        if (removed) void titleHandle.removeRow(read.value);
      });
      const remove = () => {
        if (removed) return;
        removed = true;
        if (subscription) void titleHandle.removeRow(subscription);
      };
      cleanups.push(remove);
      return remove;
    },
    choose: async (label2, choices) => {
      const read = await titleHandle.choose(label2, choices);
      return read.ok ? read.value : null;
    }
  } : void 0;
  let stored = null;
  const storedCell = cell(() => mod.store.character.get(), null, 1e3, now);
  const characterStore = {
    get: () => {
      stored = storedCell.get();
      return stored;
    },
    set(value2) {
      const next = value2 === void 0 ? null : value2;
      storedCell.put(next);
      void mod.store.character.set(next).then((read) => {
        if (!read.ok) log(`saving the character record was refused (${refusal(read)})`);
      });
    }
  };
  return {
    seams: {
      character: characterSeam,
      knowledge,
      ...optionsSeam ? { options: optionsSeam } : {},
      ...keybindingsSeam ? { keybindings: keybindingsSeam } : {},
      ...savesSeam ? { saves: savesSeam } : {},
      ...sessionSeam ? { session: sessionSeam } : {},
      ...titleSeam ? { title: titleSeam } : {},
      characterStore
    },
    async prime() {
      await Promise.all([
        character.reload(),
        categories.reload(),
        storedCell.reload(),
        options?.reload(),
        keyset?.reload(),
        commands?.reload()
      ]);
      if (keyset) await keysFor(keyset.get()).reload();
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {
        }
      }
      runEnds.clear();
      lists.clear();
      pages.clear();
      keyLists.clear();
    }
  };
}

// src/bridge.ts
var MAP_ACTUAL = "state:map-actual.read";
var BRIDGE_CAPS = Object.freeze({ has: (capability) => capability !== MAP_ACTUAL });
var sameToken = (a, b) => !!a && !!b && a.epoch === b.epoch && a.revision === b.revision;
function createBridge(mod) {
  const engine = mod.engine;
  const display = mod.presentation?.display;
  let input = null;
  let prefs = null;
  let settings = {};
  let mods = [];
  let busy = false;
  let disposed = false;
  let inflight = null;
  let again = false;
  const inputListeners = /* @__PURE__ */ new Set();
  const settingListeners = /* @__PURE__ */ new Set();
  const cleanups = [];
  const log = (message) => mod.meta.log(message);
  const managed = createManagedSeams(mod);
  const stateOf2 = () => engine?.state;
  const viewOf = (state) => engine.core.createAgentView(state, void 0, { ...state.knownWorldDeps, perceivedMonstersOnly: true }, BRIDGE_CAPS);
  function applyInput(next) {
    const changed = !sameInput(input, next);
    input = next;
    if (changed) for (const listener of [...inputListeners]) listener(next);
  }
  function refresh() {
    if (disposed) return Promise.resolve();
    if (inflight) {
      again = true;
      return inflight;
    }
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
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }
  async function prime() {
    const [stored, own, list] = await Promise.all([mod.store.prefs.get(), mod.meta.settings(), mod.meta.mods(), refresh(), managed.prime()]);
    prefs = stored.ok ? stored.value : null;
    settings = own.ok ? own.value : {};
    mods = list.ok ? list.value : [];
  }
  const snapshot = () => {
    const state = stateOf2();
    if (!state || !engine) return null;
    const core = viewOf(state).capture();
    const wait = input;
    if (!sameToken(wait?.token, core.token)) void refresh();
    return Object.freeze({
      token: wait && sameToken(wait.token, core.token) ? wait.token : core.token,
      driver: wait?.driver ?? { kind: "player" },
      phase: wait?.phase ?? null,
      messagePending: wait?.messagePending ?? null,
      resting: wait?.resting ?? null,
      messages: wait?.messages ? Object.freeze({ token: core.token, entries: Object.freeze(wait.messages.map((m) => m.text)), log: Object.freeze(wait.messages.map((m) => Object.freeze({ ...m }))) }) : null,
      storeStatus: wait?.storeStatus ?? null,
      activeBlast: wait?.activeBlast ?? null,
      prompt: wait?.prompt ?? null,
      core,
      frame: null
    });
  };
  const knownLevel = () => {
    const state = stateOf2();
    return state && engine ? viewOf(state).knownLevel?.() ?? null : null;
  };
  const inspectView = () => {
    const state = stateOf2();
    return state && engine ? viewOf(state) : null;
  };
  const inspect = {
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
    terrainCatalogue: () => inspectView()?.terrainCatalogue?.() ?? null
  };
  const eventHandlers = /* @__PURE__ */ new Map();
  const events = {
    on(type, listener) {
      const state = stateOf2();
      if (!state?.events || !engine) throw new Error("no game is running");
      const guarded = (t, payload) => {
        try {
          listener(t, payload);
        } catch (error) {
          log(`event ${String(t)}: ${String(error)}`);
        }
      };
      let byListener = eventHandlers.get(type);
      if (!byListener) eventHandlers.set(type, byListener = /* @__PURE__ */ new Map());
      byListener.set(listener, guarded);
      state.events.on(type, guarded);
    },
    off(type, listener) {
      const guarded = eventHandlers.get(type)?.get(listener);
      if (!guarded) return;
      eventHandlers.get(type)?.delete(listener);
      stateOf2()?.events?.off(type, guarded);
    }
  };
  cleanups.push(() => {
    const bus = stateOf2()?.events;
    for (const [type, byListener] of eventHandlers) for (const guarded of byListener.values()) bus?.off(type, guarded);
    eventHandlers.clear();
  });
  function refusalOf(result) {
    const code = result.code === "controller-owned" ? "controller-owned" : void 0;
    return { accepted: false, reason: result.message ?? result.reason, ...code ? { code } : {} };
  }
  function precheck(token) {
    if (!input) return { accepted: false, reason: "No input wait is open." };
    if (input.driver.kind === "controller" && input.driver.owner !== mod.meta.id) return { accepted: false, reason: "Another mod holds the keyboard.", code: "controller-owned" };
    if (token && !sameToken(token, input.token)) return { accepted: false, reason: "That input wait is over." };
    if (busy) return { accepted: false, reason: "The game is still working." };
    return null;
  }
  const settle = (call, what) => {
    void call.then((result) => {
      if (!result.ok) log(`${what} was refused (${result.message ?? "no reason given"})`);
    }, (error) => log(`${what} failed (${String(error)})`)).finally(() => {
      void refresh();
    });
  };
  const intent = {
    submit(token, wanted) {
      const refused = precheck(token);
      if (refused) return refused;
      busy = true;
      settle(mod.act.submit(token, wanted), "an action");
      return { accepted: true };
    },
    catalogue: () => catalogueCache
  };
  let catalogueCache;
  const reloadCatalogue = async () => {
    const read = await mod.view.catalogue();
    if (read.ok) catalogueCache = read.value;
  };
  const prompt = {
    reply(promptId, answer) {
      const refused = precheck(null);
      if (refused) return refused;
      if (input?.prompt?.promptId !== promptId) return { accepted: false, reason: "That question is no longer open." };
      busy = true;
      settle(mod.act.answer(promptId, answer), "an answer");
      return { accepted: true };
    }
  };
  const prefsSeam = {
    get: () => prefs,
    set(value2) {
      prefs = value2 === void 0 ? null : value2;
      settle(mod.store.prefs.set(prefs), "saving preferences");
    }
  };
  const settingsSeam = {
    get: (id) => settings[id],
    all: () => settings,
    set(id, value2) {
      if (!(id in settings) || typeof value2 !== "number") return void 0;
      settings = { ...settings, [id]: value2 };
      void mod.meta.setSetting(id, value2).then((result) => {
        if (!result.ok) return;
        settings = { ...settings, [id]: result.value };
        for (const listener of [...settingListeners]) listener(id, result.value);
      });
      return value2;
    },
    onChange(listener) {
      settingListeners.add(listener);
      return () => {
        settingListeners.delete(listener);
      };
    }
  };
  const presentation = mod.presentation;
  const displayHandle = display;
  if (displayHandle?.onFrame) cleanups.push(displayHandle.onFrame(() => {
    void refresh();
  }));
  if (displayHandle) cleanups.push(displayHandle.onKey(() => {
    void refresh();
  }));
  if (presentation) cleanups.push(presentation.onPhaseChanged(() => {
    void refresh();
  }));
  void mod.events.on("driver-changed", () => {
    void refresh();
  });
  void reloadCatalogue();
  const ctx = {
    id: mod.meta.id,
    engine: mod.meta.engine,
    log,
    flags: mod.meta.flags,
    ...engine ? { core: engine.core, registries: engine.registries } : {},
    get state() {
      return stateOf2();
    },
    snapshot,
    knownLevel,
    inspect,
    intent,
    prompt,
    events,
    driver: () => input?.driver ?? { kind: "player" },
    mods: () => mods,
    prefs: prefsSeam,
    settings: settingsSeam,
    ...displayHandle ? { display: displayHandle } : {},
    ...presentation?.panels ? { ui: presentation.panels } : {},
    ...presentation?.subwindows ? { subwindows: presentation.subwindows } : {},
    ...presentation?.tiles ? { tiles: presentation.tiles } : {},
    ...presentation?.keyRepeat ? { keyRepeat: presentation.keyRepeat } : {},
    ...managed.seams
  };
  return {
    ctx,
    prime,
    refresh,
    input: () => input,
    onInput(listener) {
      inputListeners.add(listener);
      return () => {
        inputListeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      managed.dispose();
      for (const cleanup of cleanups.splice(0).reverse()) {
        try {
          cleanup();
        } catch {
        }
      }
      inputListeners.clear();
      settingListeners.clear();
    }
  };
}
function sameInput(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return sameToken(a.token, b.token) && a.phase === b.phase && a.messagePending === b.messagePending && a.driver.kind === b.driver.kind && a.driver.owner === b.driver.owner && (a.prompt?.promptId ?? null) === (b.prompt?.promptId ?? null);
}

// src/view-model/adapter.ts
function entry(frame, key) {
  return frame?.sidebar?.entries.find((item) => item.key === key) ?? frame?.status.entries.find((item) => item.key === key);
}
function value(frame, key, field) {
  return entry(frame, key)?.values?.[field];
}
function label(frame, key) {
  const item = entry(frame, key);
  if (!item || item.runs.length === 0) return void 0;
  return item.runs.map((run2) => run2.text).join("").trim();
}
function feelingIndices(frame) {
  const values = entry(frame, "level_feeling")?.values;
  if (values?.object === void 0 || values.monster === void 0 || values.squares === void 0 || values.need === void 0) return void 0;
  return {
    object: values.object,
    monster: values.monster,
    squares: values.squares,
    need: values.need
  };
}
function statPayload(source, frame) {
  return ["STR", "INT", "WIS", "DEX", "CON"].map((name, index) => {
    const key = name.toLowerCase();
    const current = value(frame, key, "cur");
    const maximum2 = value(frame, key, "max");
    return {
      label: name,
      value: value(frame, key, "use") ?? source.stats[index] ?? 0,
      drained: current === void 0 || maximum2 === void 0 ? void 0 : current < maximum2
    };
  });
}
function badgePayload(source, frame) {
  const status = source.status;
  const aliases = {
    haste: "fast",
    "paralyzed!": "paralyzed",
    graze: "cut",
    "light cut": "cut",
    "bad cut": "cut",
    "nasty cut": "cut",
    "severe cut": "cut",
    "deep gash": "cut",
    "mortal wound": "cut",
    "stunned": "stun",
    "heavy stun": "stun",
    "knocked out": "stun",
    protevil: "protEvil",
    berserk: "shero",
    blssd: "blessed",
    racid: "resAcid",
    relec: "resElec",
    rfire: "resFire",
    rcold: "resCold",
    rpois: "resPois",
    stone: "stoneskin",
    fastcast: "fastcast",
    fed: "food",
    full: "food",
    hungry: "food",
    weak: "food",
    faint: "food",
    starving: "food"
  };
  const result = [];
  for (const run2 of entry(frame, "tmd")?.runs ?? []) {
    const text = run2.text.trim();
    if (!text || /^\d+\s*%$/.test(text)) continue;
    const key = aliases[text.toLowerCase()] ?? text.toLowerCase().replace(/[^a-z]/g, "");
    result.push({
      label: text,
      name: void 0,
      visible: true,
      priority: void 0,
      kind: void 0,
      duration: status[key],
      description: void 0
    });
  }
  return result;
}
function trackedPayload(view, frame) {
  const target = view.target();
  if (target === null) return void 0;
  const monster = view.monsters().find((item) => item.id === target.midx);
  if (!monster) return void 0;
  return {
    visible: monster.visible,
    name: monster.race,
    hp: value(frame, "health", "current"),
    max_hp: value(frame, "health", "max")
  };
}
function playerPayload(view, frame, input) {
  const source = view.player();
  const experience = value(frame, "exp", "exp") ?? source.exp;
  const advance = value(frame, "exp", "advance");
  const state = label(frame, "state") ?? "";
  const moves = label(frame, "moves");
  return {
    name: input.name,
    race: label(frame, "race") ?? source.race,
    class: label(frame, "class") ?? source.cls,
    title: label(frame, "title"),
    hp: value(frame, "hp", "current") ?? source.hp,
    max_hp: value(frame, "hp", "max") ?? source.maxHp,
    sp: value(frame, "sp", "current") ?? source.sp,
    max_sp: value(frame, "sp", "max") ?? source.maxSp,
    food: source.status.food,
    food_max: input.foodMax,
    experience,
    max_experience: value(frame, "exp", "maxExp") ?? source.maxExp,
    level_start_experience: input.levelStartExperience,
    next_level_experience: advance === void 0 ? void 0 : advance === 0 ? 0 : experience + advance,
    level: value(frame, "level", "level") ?? source.level,
    max_level: value(frame, "level", "maxLevel") ?? source.maxLevel,
    stats: statPayload(source, frame),
    gold: value(frame, "gold", "au") ?? source.gold,
    armour: value(frame, "ac", "ac") ?? source.ac,
    speed: value(frame, "speed", "speed") ?? source.speed,
    extra_moves: input.extraMoves ?? (moves ? Number(moves.match(/[+-]\d+/)?.[0]) : void 0),
    tracked_creature: trackedPayload(view, frame),
    depth: value(frame, "depth", "depth") ?? source.depth,
    depth_feet: value(frame, "depth", "feet") ?? source.depth * 50,
    light: Number(label(frame, "light")?.match(/-?\d+/)?.[0] ?? source.light),
    feeling: label(frame, "level_feeling"),
    feeling_indices: feelingIndices(frame),
    feeling_description: void 0,
    floor: label(frame, "terrain"),
    trap_detected: Boolean(label(frame, "dtrap")),
    recall: input.recall ?? (label(frame, "recall") ? true : void 0),
    descent: input.descent ?? (label(frame, "descent") ? true : void 0),
    resting: input.resting ?? state.startsWith("Rest"),
    running: input.running,
    repeat: input.repeat ?? (state.startsWith("Repeat") ? Number(state.match(/\d+/)?.[0]) : void 0),
    unignoring: input.unignoring ?? (label(frame, "unignore") ? true : void 0),
    statuses: badgePayload(source, frame),
    study: input.study ?? Number(label(frame, "study")?.match(/\d+/)?.[0] ?? 0)
  };
}
function messagePayload(input) {
  return (input.history ?? []).map((item) => ({
    text: item.text,
    count: item.count,
    system: void 0,
    category: item.category,
    group: void 0,
    color: item.color
  }));
}
function dungeonPayload(player) {
  return {
    depth: player.depth,
    depth_feet: player.depth_feet,
    light: player.light,
    feeling: player.feeling,
    feeling_indices: player.feeling_indices,
    feeling_description: player.feeling_description,
    floor: player.floor
  };
}
function adapt(view, frame, input = {}) {
  const player = playerPayload(view, frame, input);
  return {
    player,
    dungeon: dungeonPayload(player),
    messages: messagePayload(input),
    message_pending: input.messagePending
  };
}

// src/input-owner.ts
var PLAYER = Object.freeze({ kind: "player" });
function currentDriver(ctx) {
  const read = ctx?.driver;
  const driver = typeof read === "function" ? read() : void 0;
  return driver?.kind === "controller" && typeof driver.owner === "string" ? driver : PLAYER;
}
function playerIsDriving(ctx) {
  return currentDriver(ctx).kind === "player";
}

// src/host-adapter.ts
var coreOf = (game) => game?.core;
var stateOf = (game) => game?.state;
function viewInput(seam) {
  return seam.snapshot?.() ?? null;
}
function viewWorld(input) {
  return input?.core;
}
function viewPlayer(input) {
  return input?.core?.player;
}
function viewMonsters(input) {
  return input?.core?.monsters;
}
function viewLevel(seam) {
  return seam.knownLevel?.() ?? null;
}
function truthLevel(level) {
  const cells = [];
  for (const cell2 of level?.cells ?? []) if (cell2.actual) cells.push({ ...cell2.actual, x: cell2.x, y: cell2.y });
  return { cells };
}
function liveGame(ctx) {
  return { liveCore: ctx.core, liveState: ctx.state };
}
function itemsGame(core, state) {
  if (!core || !state) return {};
  return { state, core: {
    createAgentView: () => core.createAgentView(state),
    floorObject: (grid, floorIndex) => listedFloorObject(core, state, grid, floorIndex)
  } };
}
function offers(game, names) {
  const core = game.core;
  return !!core && names.every((name) => typeof core[name] === "function");
}
function hasLiveState(game) {
  return !!game.state;
}
function playerGrid(game) {
  return stateOf(game)?.actor?.grid;
}
function playerHitPoints(game) {
  const player = stateOf(game)?.actor?.player;
  return { hp: player?.chp, maxHp: player?.mhp };
}
function playerHallucinating(game) {
  const core = coreOf(game);
  return core?.TMD?.IMAGE !== void 0 && (stateOf(game)?.actor?.player?.timed?.[core.TMD.IMAGE] ?? 0) > 0;
}
function playerTimedEffects(game) {
  const TMD = coreOf(game)?.TMD, timed = stateOf(game)?.actor?.player?.timed;
  if (!TMD || !timed) return null;
  return Object.entries(TMD).filter(([, index]) => (timed[index] ?? 0) > 0).map(([name]) => name);
}
function birthFacts(game) {
  const player = stateOf(game)?.actor?.player;
  if (!player) return null;
  return { raceName: player.race?.name, clsName: player.cls?.name, auBirth: player.auBirth, htBirth: player.htBirth, wtBirth: player.wtBirth };
}
function levelKey(game) {
  const state = stateOf(game);
  return state?.levelSerial ?? state?.chunk?.depth;
}
function levelDepth(game) {
  return game.state.chunk.depth;
}
function levelSize(game) {
  const chunk = stateOf(game)?.chunk;
  return chunk ? { width: chunk.width, height: chunk.height } : null;
}
function gridInView(game, grid) {
  return coreOf(game)?.squareIsSeen?.(stateOf(game)?.chunk, grid) ?? false;
}
function gridHasVisibleTrap(game, grid) {
  return !!coreOf(game)?.squareIsVisibleTrap?.(game.state, grid);
}
function gridIsShop(game, grid) {
  return (stateOf(game)?.chunk?.feature?.(grid)?.shopnum ?? 0) > 0;
}
function lookAt(game, grid) {
  const look = coreOf(game)?.describeLookGrid?.(game.state, grid, 0);
  if (!look) return null;
  return { text: look.text, creature: !!look.mon, hp: look.mon?.hp, maxHp: look.mon?.maxhp };
}
function rememberedPile(game, grid) {
  return coreOf(game)?.knownPile?.(game.state, grid) ?? [];
}
function describeObject(game, object) {
  const core = coreOf(game);
  return core?.describeObject ? core.describeObject(game.state, object) : null;
}
function apparentTerrain(game, grid) {
  return coreOf(game)?.squareApparentName?.(game.state, grid);
}
function listedFloorObject(core, state, grid, floorIndex) {
  if (!Number.isInteger(floorIndex) || floorIndex < 0) return null;
  try {
    const listed = core.floorPile(state, grid).filter((obj) => {
      const memory = core.knownFloorObject(state, grid, obj);
      return !!memory && !memory.sensed;
    });
    return listed[floorIndex] ?? null;
  } catch {
    return null;
  }
}
function floorObject(game, grid, floorIndex) {
  return coreOf(game)?.floorObject?.(grid, floorIndex) ?? null;
}
function canSimulateLoadout(game) {
  return !!coreOf(game)?.createAgentView && !!game.state;
}
function simulateLoadout(game, change) {
  return coreOf(game)?.createAgentView?.(game.state).simulateLoadout?.(change) ?? null;
}
function liveHud(game) {
  const state = game.state;
  if (state === void 0) return void 0;
  return {
    view: game.core.createAgentView(state),
    name: state.actor.player.fullName,
    messages: state.messages,
    study: state.actor.player.upkeep.newSpells,
    repeat: state.cmdQueue?.[0]?.repeatRemaining ?? 0,
    resting: state.resting !== void 0,
    running: state.run !== void 0,
    unignoring: state.unignoring ?? 0,
    recall: state.actor.player.wordRecall,
    descent: state.actor.player.deepDescent,
    extraMoves: state.playerState?.numMoves ?? 0
  };
}
function visibleMonsterRaces(game) {
  return game.core.monsterListCollect(game.state).entries.map((entry2) => entry2.race);
}
function carriedGear(game) {
  return game.state.gear.store.values();
}
function knownArtifactTest(game) {
  return game.core.liveObjectIsKnownArtifact;
}
function coreFormatters(game) {
  return { fmtDepth: game.core.fmtDepth, colorToCss: game.core.colorToCss };
}

// src/view-model/source.ts
var MATCH_WINDOW = 8;
function messageHistory(entries, log, hostLog) {
  if (hostLog) {
    const core2 = log === void 0 ? [] : Array.from({ length: log.num() }, (_, age) => ({
      text: log.str(age),
      category: log.type(age)
    }));
    const history2 = [];
    let next2 = 0;
    for (let index = hostLog.length - 1; index >= 0; index--) {
      const entry2 = hostLog[index];
      let category;
      let found = -1;
      for (let age = next2; age < Math.min(core2.length, next2 + MATCH_WINDOW); age++) {
        if (core2[age].text === entry2.text) {
          found = age;
          break;
        }
      }
      if (found >= 0) {
        category = core2[found].category;
        next2 = found + 1;
      }
      history2.push({ text: entry2.text, count: entry2.count, category, color: entry2.color });
    }
    return history2;
  }
  const core = log === void 0 ? [] : Array.from({ length: log.num() }, (_, age) => ({
    text: log.str(age),
    count: log.count(age),
    category: log.type(age),
    color: void 0
  }));
  if (!entries) return core;
  const history = [];
  let next = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const text = entries[index];
    let found = -1;
    for (let age = next; age < Math.min(core.length, next + MATCH_WINDOW); age++) {
      if (core[age].text === text) {
        found = age;
        break;
      }
    }
    if (found < 0) {
      history.push({ text, count: void 0, category: void 0, color: void 0 });
      continue;
    }
    const foundEntry = core[found];
    history.push({ text: foundEntry.text, count: foundEntry.count, category: foundEntry.category, color: void 0 });
    next = found + 1;
  }
  return history;
}
function messagePending(snap) {
  if (!snap) return void 0;
  if (snap.prompt?.kind === "ack" && snap.prompt.tag === "more") return true;
  if (snap.phase === null || snap.phase === void 0) return void 0;
  return snap.messagePending === true;
}
function createSource(ctx) {
  let latest;
  const present = (_section, frame) => {
    latest = frame;
  };
  const read = () => {
    try {
      return viewInput(ctx);
    } catch {
      return null;
    }
  };
  const acknowledge = () => {
    if (!ctx.prompt || !playerIsDriving(ctx)) return false;
    const prompt = read()?.prompt;
    if (prompt?.kind !== "ack" || prompt.tag !== "more") return false;
    return ctx.prompt.reply(prompt.promptId, { action: "acknowledge" }).accepted;
  };
  return {
    hud: { sidebar: { present }, messages: { present }, status: { present } },
    ...ctx.prompt ? { acknowledge } : {},
    snapshot(options = {}) {
      if (!hasLiveState(ctx)) return void 0;
      const snap = options.messages ? read() : null;
      const pending = messagePending(snap);
      const live = liveHud(ctx);
      return adapt(live.view, latest, {
        name: live.name,
        history: messageHistory(snap?.messages?.entries, live.messages, snap?.messages?.log),
        study: live.study,
        repeat: live.repeat,
        resting: live.resting,
        running: live.running,
        unignoring: live.unignoring,
        recall: live.recall,
        descent: live.descent,
        extraMoves: live.extraMoves,
        ...pending === void 0 ? {} : { messagePending: pending }
      });
    }
  };
}

// src/bitmap-font.ts
var FONT_16X24 = {
  w: 16,
  h: 24,
  glyphs: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 0
    [65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535, 65535],
    // 1
    [65531, 56814, 65471, 47102, 65239, 48125, 65391, 60157, 32695, 63487, 65402, 56799, 65403, 27615, 65535, 56046, 65531, 56814, 65471, 47102, 65239, 48125, 61295, 32255],
    // 2
    [65021, 21845, 44975, 21845, 48059, 21845, 60395, 38550, 65021, 21845, 44975, 21845, 48059, 21845, 60395, 38550, 65021, 21845, 44975, 21845, 48059, 21845, 60395, 38550],
    // 3
    [4, 8721, 64, 18433, 296, 17410, 144, 5378, 32840, 2048, 133, 8736, 4, 38048, 0, 9489, 4, 8721, 64, 18433, 296, 17410, 4240, 33280],
    // 4
    [16385, 512, 4128, 4, 16640, 2056, 32832, 514, 8192, 136, 0, 18464, 260, 1, 2048, 136, 16385, 512, 4128, 4, 16640, 2056, 32832, 1028],
    // 5
    [1028, 0, 0, 4096, 8, 256, 0, 16384, 2, 128, 0, 4112, 0, 0, 16384, 1024, 2, 64, 0, 0, 2056, 0, 128, 32768],
    // 6
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 384, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 7
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 896, 896, 896, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 8
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 960, 2016, 2016, 2016, 2016, 2016, 960, 0, 0, 0, 0, 0, 0, 0, 0],
    // 9
    [0, 0, 0, 0, 0, 0, 0, 960, 4080, 4080, 8184, 8184, 8184, 8184, 8184, 4080, 4080, 960, 0, 0, 0, 0, 0, 0],
    // 10
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1948, 7934, 13654, 27307, 21845, 27307, 21845, 32766, 0, 0, 0],
    // 11
    [0, 0, 0, 0, 0, 0, 0, 0, 16380, 21846, 65535, 21846, 10924, 5464, 2736, 1376, 704, 384, 0, 0, 0, 0, 0, 0],
    // 12
    [4080, 15020, 30038, 27306, 54615, 43691, 54613, 43691, 54613, 43691, 54613, 65535, 65535, 54613, 43691, 54613, 43691, 54613, 43691, 54613, 43691, 54613, 43691, 65535],
    // 13
    [4080, 12300, 16386, 16386, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 32769, 65535],
    // 14
    [2640, 8196, 16386, 0, 32769, 32769, 0, 32769, 32769, 0, 32769, 32769, 0, 32769, 32769, 0, 32769, 32769, 0, 32769, 32769, 0, 32769, 55899],
    // 15
    [0, 8196, 6744, 4080, 2512, 736, 1504, 704, 480, 1760, 448, 736, 1504, 704, 480, 1760, 448, 736, 1504, 2768, 3568, 2016, 0, 0],
    // 16
    [0, 0, 6400, 9728, 0, 0, 0, 100, 152, 0, 0, 0, 0, 12800, 19456, 0, 0, 0, 0, 200, 304, 0, 0, 0],
    // 17
    [0, 0, 0, 4064, 15032, 21844, 27308, 21844, 27308, 21844, 27308, 21844, 12008, 7088, 896, 896, 896, 896, 896, 896, 896, 0, 0, 0],
    // 18
    [0, 0, 0, 0, 160, 160, 2688, 2576, 11088, 8512, 1352, 5160, 5800, 4772, 18020, 24056, 5460, 15022, 28502, 10922, 21974, 12140, 0, 0],
    // 19
    [0, 0, 0, 0, 2336, 1344, 8200, 4112, 16388, 8200, 0, 24588, 0, 24588, 0, 8204, 16384, 4112, 8200, 1344, 2336, 0, 0, 0],
    // 20
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 21
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 22
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 23
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 24
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 25
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 26
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 27
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 28
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 29
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 30
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 31
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 32
    [0, 0, 0, 0, 384, 960, 960, 960, 960, 960, 384, 384, 384, 384, 384, 0, 384, 960, 960, 384, 0, 0, 0, 0],
    // 33
    [0, 0, 0, 0, 1632, 1632, 1632, 1632, 1632, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 34
    [0, 0, 0, 0, 792, 792, 824, 1584, 16380, 16380, 1584, 3168, 3168, 16380, 16380, 3168, 7360, 6336, 6336, 0, 0, 0, 0, 0],
    // 35
    [0, 0, 0, 256, 1984, 4064, 7536, 6448, 6400, 7424, 3968, 992, 368, 304, 304, 6448, 7536, 4064, 1984, 256, 256, 0, 0, 0],
    // 36
    [0, 0, 0, 0, 6168, 15408, 26160, 26208, 26208, 26304, 15552, 6552, 828, 870, 1638, 1638, 3174, 3132, 6168, 0, 0, 0, 0, 0],
    // 37
    [0, 0, 0, 0, 960, 2016, 3120, 3120, 3168, 1728, 1920, 3968, 6604, 12524, 12408, 12336, 14456, 8172, 3972, 0, 0, 0, 0, 0],
    // 38
    [0, 0, 0, 0, 384, 960, 960, 384, 768, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 39
    [0, 0, 0, 0, 32, 64, 192, 128, 384, 384, 768, 768, 768, 768, 768, 768, 768, 384, 384, 128, 192, 64, 32, 0],
    // 40
    [0, 0, 0, 0, 1024, 512, 768, 256, 384, 384, 192, 192, 192, 192, 192, 192, 192, 384, 384, 256, 768, 512, 1024, 0],
    // 41
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 3168, 3808, 1984, 8176, 8176, 1984, 3808, 3168, 0, 0, 0, 0, 0, 0, 0],
    // 42
    [0, 0, 0, 0, 0, 0, 0, 384, 384, 384, 384, 384, 16380, 16380, 384, 384, 384, 384, 384, 0, 0, 0, 0, 0],
    // 43
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 384, 960, 960, 384, 768, 0, 0, 0],
    // 44
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16380, 16380, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 45
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 384, 960, 960, 384, 0, 0, 0, 0],
    // 46
    [0, 0, 0, 48, 48, 96, 96, 192, 192, 384, 384, 768, 768, 1536, 1536, 3072, 3072, 6144, 6144, 0, 0, 0, 0, 0],
    // 47
    [0, 0, 0, 0, 960, 4080, 3120, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 3120, 4080, 960, 0, 0, 0, 0, 0],
    // 48
    [0, 0, 0, 0, 192, 192, 960, 1984, 3264, 192, 192, 192, 192, 192, 192, 192, 192, 192, 192, 0, 0, 0, 0, 0],
    // 49
    [0, 0, 0, 0, 2016, 4080, 7224, 6168, 24, 24, 48, 48, 96, 448, 896, 1536, 3072, 8184, 8184, 0, 0, 0, 0, 0],
    // 50
    [0, 0, 0, 0, 1984, 4064, 7280, 6192, 48, 96, 448, 496, 56, 24, 24, 6168, 7216, 4080, 1984, 0, 0, 0, 0, 0],
    // 51
    [0, 0, 0, 0, 32, 96, 224, 480, 864, 864, 1632, 3168, 6240, 8184, 8184, 96, 96, 96, 96, 0, 0, 0, 0, 0],
    // 52
    [0, 0, 0, 0, 2032, 2032, 3072, 3072, 3072, 3552, 8176, 6200, 24, 24, 24, 6168, 7216, 4080, 1984, 0, 0, 0, 0, 0],
    // 53
    [0, 0, 0, 0, 992, 2032, 3128, 3096, 6144, 6624, 8176, 7224, 6168, 6168, 6168, 6168, 3120, 2032, 960, 0, 0, 0, 0, 0],
    // 54
    [0, 0, 0, 0, 8184, 8184, 48, 96, 96, 192, 192, 384, 384, 768, 768, 768, 1536, 1536, 1536, 0, 0, 0, 0, 0],
    // 55
    [0, 0, 0, 0, 960, 2016, 3120, 3120, 3120, 3120, 2016, 2016, 3120, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 56
    [0, 0, 0, 0, 960, 4064, 3120, 6168, 6168, 6168, 6168, 3128, 4088, 1944, 24, 6192, 7216, 4064, 1984, 0, 0, 0, 0, 0],
    // 57
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 384, 960, 960, 384, 0, 0, 384, 960, 960, 384, 0, 0, 0, 0],
    // 58
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 384, 960, 960, 384, 0, 0, 384, 960, 960, 384, 768, 0, 0, 0],
    // 59
    [0, 0, 0, 0, 0, 0, 0, 0, 48, 224, 896, 3584, 6144, 6144, 3584, 896, 224, 48, 0, 0, 0, 0, 0, 0],
    // 60
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16380, 16380, 0, 0, 16380, 16380, 0, 0, 0, 0, 0, 0, 0, 0],
    // 61
    [0, 0, 0, 0, 0, 0, 0, 0, 6144, 3584, 896, 224, 48, 48, 224, 896, 3584, 6144, 0, 0, 0, 0, 0, 0],
    // 62
    [0, 0, 0, 0, 2016, 4080, 7224, 6168, 24, 56, 112, 224, 448, 384, 384, 0, 384, 960, 960, 384, 0, 0, 0, 0],
    // 63
    [0, 0, 0, 0, 992, 3096, 4100, 9178, 18426, 20082, 35890, 38962, 38946, 39014, 40172, 20472, 18288, 8194, 6156, 2032, 0, 0, 0, 0],
    // 64
    [0, 0, 0, 0, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24588, 24588, 0, 0, 0, 0, 0],
    // 65
    [0, 0, 0, 0, 16320, 16352, 12400, 12336, 12336, 12400, 16352, 16352, 12336, 12312, 12312, 12312, 12344, 16368, 16352, 0, 0, 0, 0, 0],
    // 66
    [0, 0, 0, 0, 2016, 8176, 7224, 12316, 28684, 24576, 24576, 24576, 24576, 24576, 28684, 12312, 15416, 8176, 2016, 0, 0, 0, 0, 0],
    // 67
    [0, 0, 0, 0, 16320, 16368, 12344, 12312, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12312, 12344, 16368, 16320, 0, 0, 0, 0, 0],
    // 68
    [0, 0, 0, 0, 8188, 8188, 6144, 6144, 6144, 6144, 8184, 8184, 6144, 6144, 6144, 6144, 6144, 8188, 8188, 0, 0, 0, 0, 0],
    // 69
    [0, 0, 0, 0, 8184, 8184, 6144, 6144, 6144, 6144, 8176, 8176, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 0, 0, 0, 0, 0],
    // 70
    [0, 0, 0, 0, 2016, 4080, 7224, 12316, 12296, 24576, 24576, 24828, 24828, 24588, 12300, 12300, 7228, 4088, 992, 0, 0, 0, 0, 0],
    // 71
    [0, 0, 0, 0, 12300, 12300, 12300, 12300, 12300, 12300, 16380, 16380, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 0, 0, 0, 0, 0],
    // 72
    [0, 0, 0, 0, 2016, 2016, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 2016, 2016, 0, 0, 0, 0, 0],
    // 73
    [0, 0, 0, 0, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 74
    [0, 0, 0, 0, 12344, 12400, 12512, 12736, 13184, 14080, 14080, 16128, 15232, 12736, 12512, 12384, 12400, 12344, 12316, 0, 0, 0, 0, 0],
    // 75
    [0, 0, 0, 0, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 8184, 8184, 0, 0, 0, 0, 0],
    // 76
    [0, 0, 0, 0, 28686, 30750, 30750, 26646, 27702, 27702, 25638, 26214, 26214, 25158, 25542, 25542, 24966, 24966, 24966, 0, 0, 0, 0, 0],
    // 77
    [0, 0, 0, 0, 12300, 14348, 15372, 15372, 13836, 13068, 13068, 12684, 12492, 12492, 12396, 12348, 12348, 12316, 12300, 0, 0, 0, 0, 0],
    // 78
    [0, 0, 0, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28686, 12300, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 79
    [0, 0, 0, 0, 16352, 16368, 12344, 12312, 12312, 12312, 12344, 16368, 16352, 12288, 12288, 12288, 12288, 12288, 12288, 0, 0, 0, 0, 0],
    // 80
    [0, 0, 0, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28684, 12524, 7224, 4092, 2030, 2, 0, 0, 0, 0],
    // 81
    [0, 0, 0, 0, 16352, 16368, 12344, 12312, 12312, 12344, 16368, 16352, 12480, 12512, 12384, 12400, 12344, 12312, 12316, 0, 0, 0, 0, 0],
    // 82
    [0, 0, 0, 0, 992, 4088, 7196, 6156, 6144, 7168, 4032, 1008, 56, 12, 12300, 14348, 7196, 4088, 2016, 0, 0, 0, 0, 0],
    // 83
    [0, 0, 0, 0, 16380, 16380, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 0, 0, 0, 0, 0],
    // 84
    [0, 0, 0, 0, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 14364, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 85
    [0, 0, 0, 0, 24588, 28700, 12312, 12312, 14392, 6192, 6192, 7280, 3168, 3168, 3808, 1728, 1728, 1984, 896, 0, 0, 0, 0, 0],
    // 86
    [0, 0, 0, 0, 24966, 24966, 24966, 25542, 25542, 25158, 26214, 26214, 25638, 27702, 27702, 26646, 14364, 14364, 12300, 0, 0, 0, 0, 0],
    // 87
    [0, 0, 0, 0, 14364, 7224, 3120, 1632, 1632, 960, 384, 960, 960, 1760, 3696, 3120, 6168, 14364, 28686, 0, 0, 0, 0, 0],
    // 88
    [0, 0, 0, 0, 28686, 12300, 6168, 7224, 3696, 1632, 960, 960, 384, 384, 384, 384, 384, 384, 384, 0, 0, 0, 0, 0],
    // 89
    [0, 0, 0, 0, 16380, 16380, 24, 48, 96, 96, 192, 384, 768, 1536, 1536, 3072, 6144, 16380, 16380, 0, 0, 0, 0, 0],
    // 90
    [0, 0, 0, 0, 2016, 2016, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 2016, 2016, 0, 0],
    // 91
    [0, 0, 0, 6144, 6144, 3072, 3072, 1536, 1536, 768, 768, 384, 384, 192, 192, 96, 96, 48, 48, 0, 0, 0, 0, 0],
    // 92
    [0, 0, 0, 0, 2016, 2016, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 96, 2016, 2016, 0, 0],
    // 93
    [0, 0, 0, 0, 0, 0, 0, 0, 384, 960, 1632, 3120, 6168, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 94
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 65535, 65535, 0],
    // 95
    [0, 0, 0, 0, 384, 960, 960, 384, 192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 96
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 97
    [0, 0, 0, 0, 6144, 6144, 6144, 6144, 6144, 7136, 8176, 7224, 6168, 6168, 6168, 6168, 7224, 8176, 7136, 0, 0, 0, 0, 0],
    // 98
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2016, 4080, 7192, 6144, 6144, 6144, 6144, 7192, 4080, 2016, 0, 0, 0, 0, 0],
    // 99
    [0, 0, 0, 0, 24, 24, 24, 24, 24, 2008, 4088, 7224, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 0, 0, 0, 0, 0],
    // 100
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2016, 4080, 7224, 6168, 8184, 8184, 6144, 7168, 4080, 2016, 0, 0, 0, 0, 0],
    // 101
    [0, 0, 0, 0, 960, 2016, 1536, 1536, 1536, 1536, 8128, 8128, 1536, 1536, 1536, 1536, 1536, 1536, 1536, 0, 0, 0, 0, 0],
    // 102
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2008, 4088, 7224, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 24, 6200, 8176, 4064, 0],
    // 103
    [0, 0, 0, 0, 6144, 6144, 6144, 6144, 6144, 7136, 8176, 7224, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 0, 0, 0, 0, 0],
    // 104
    [0, 0, 0, 0, 0, 384, 384, 0, 0, 896, 896, 384, 384, 384, 384, 384, 384, 960, 960, 0, 0, 0, 0, 0],
    // 105
    [0, 0, 0, 0, 48, 48, 0, 0, 112, 112, 48, 48, 48, 48, 48, 48, 48, 4144, 6256, 8176, 4064, 0, 0, 0],
    // 106
    [0, 0, 0, 0, 6144, 6144, 6144, 6144, 6256, 6368, 6592, 7040, 7936, 8064, 6528, 6336, 6368, 6240, 6256, 0, 0, 0, 0, 0],
    // 107
    [0, 0, 0, 0, 896, 896, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 960, 960, 0, 0, 0, 0, 0],
    // 108
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 13936, 16376, 15324, 12684, 12684, 12684, 12684, 12684, 12684, 12684, 0, 0, 0, 0, 0],
    // 109
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 7136, 8176, 7224, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 0, 0, 0, 0, 0],
    // 110
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2016, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 111
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 7136, 8176, 7224, 6168, 6168, 6168, 6168, 7224, 8176, 7136, 6144, 6144, 6144, 6144, 0],
    // 112
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2008, 4088, 7224, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 24, 24, 24, 24, 0],
    // 113
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 7152, 8184, 7192, 6144, 6144, 6144, 6144, 6144, 6144, 6144, 0, 0, 0, 0, 0],
    // 114
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2016, 4080, 6168, 6144, 4032, 1008, 24, 6168, 4080, 2016, 0, 0, 0, 0, 0],
    // 115
    [0, 0, 0, 0, 768, 768, 768, 768, 4064, 4064, 768, 768, 768, 768, 768, 768, 768, 960, 448, 0, 0, 0, 0, 0],
    // 116
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 0, 0, 0, 0, 0],
    // 117
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 12300, 12300, 6168, 6168, 3120, 3696, 1632, 960, 960, 384, 0, 0, 0, 0, 0],
    // 118
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 12684, 12684, 12684, 12684, 6552, 7128, 2640, 3696, 3696, 3120, 0, 0, 0, 0, 0],
    // 119
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 7224, 3120, 1632, 1632, 960, 960, 1632, 1632, 3120, 7224, 0, 0, 0, 0, 0],
    // 120
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 24, 6200, 8176, 4064, 0],
    // 121
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 8184, 8184, 112, 224, 448, 896, 1792, 3584, 8184, 8184, 0, 0, 0, 0, 0],
    // 122
    [0, 0, 0, 224, 384, 384, 384, 384, 384, 384, 384, 768, 3584, 768, 384, 384, 384, 384, 384, 384, 384, 224, 0, 0],
    // 123
    [0, 0, 0, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 0, 0],
    // 124
    [0, 0, 0, 1792, 384, 384, 384, 384, 384, 384, 384, 192, 112, 192, 384, 384, 384, 384, 384, 384, 384, 1792, 0, 0],
    // 125
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 3596, 8092, 14840, 12400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 126
    [21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690, 21845, 43690],
    // 127
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 128
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 129
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 130
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 131
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 132
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 133
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 134
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 135
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 136
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 137
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 138
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 139
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 140
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 141
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 142
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 143
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 144
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 145
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 146
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 147
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 148
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 149
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 150
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 151
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 152
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 153
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 154
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 155
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 156
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 157
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 158
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 159
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 160
    [0, 0, 0, 0, 384, 960, 960, 384, 0, 384, 384, 384, 384, 384, 960, 960, 960, 960, 960, 384, 0, 0, 0, 0],
    // 161
    [0, 0, 0, 0, 496, 1016, 1800, 3072, 3072, 6144, 16368, 6144, 16352, 6144, 3072, 3072, 1800, 1016, 496, 0, 0, 0, 0, 0],
    // 162
    [0, 0, 0, 0, 992, 2032, 3640, 3096, 3072, 3072, 3072, 16320, 16320, 1536, 1536, 3072, 8080, 16376, 8432, 0, 0, 0, 0, 0],
    // 163
    [0, 0, 0, 0, 0, 0, 0, 0, 384, 1440, 2640, 1440, 7128, 7128, 1440, 2640, 1440, 384, 0, 0, 0, 0, 0, 0],
    // 164
    [0, 0, 0, 0, 0, 12300, 14364, 7224, 3696, 2016, 960, 8184, 8184, 384, 384, 8184, 8184, 384, 384, 0, 0, 0, 0, 0],
    // 165
    [0, 0, 0, 0, 384, 384, 384, 384, 384, 384, 384, 0, 0, 0, 384, 384, 384, 384, 384, 384, 384, 0, 0, 0],
    // 166
    [0, 0, 0, 0, 0, 2032, 4088, 7176, 6144, 8160, 6128, 4120, 6152, 4072, 2040, 24, 4152, 8176, 4064, 0, 0, 0, 0, 0],
    // 167
    [0, 0, 0, 256, 256, 256, 256, 384, 384, 384, 448, 1472, 1856, 1792, 768, 768, 768, 256, 256, 256, 256, 0, 0, 0],
    // 168
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 384, 3840, 32766, 240, 384, 0, 0, 0, 0, 0, 0, 0, 0],
    // 169
    [0, 0, 0, 0, 0, 4, 8, 16, 48, 96, 192, 448, 1920, 480, 896, 768, 1536, 3072, 2048, 4096, 8192, 0, 0, 0],
    // 170
    [0, 0, 0, 0, 0, 8192, 4096, 2048, 3072, 1536, 768, 896, 480, 1920, 448, 192, 96, 48, 16, 8, 4, 0, 0, 0],
    // 171
    [0, 0, 0, 0, 0, 640, 5456, 11176, 7536, 10920, 22484, 15288, 22484, 22484, 15288, 22484, 10920, 7536, 11176, 5456, 640, 0, 0, 0],
    // 172
    [0, 0, 0, 0, 2112, 1158, 25736, 5192, 4688, 3664, 49824, 16320, 998, 16344, 51104, 7416, 9636, 51492, 4770, 4624, 1032, 0, 0, 0],
    // 173
    [0, 0, 0, 0, 16388, 8840, 13656, 6832, 7536, 12264, 22484, 12264, 12264, 22484, 12264, 7536, 6832, 13656, 8840, 16388, 0, 0, 0, 0],
    // 174
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 175
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 176
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 177
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 178
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 179
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 180
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 181
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 182
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 183
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 184
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 185
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 186
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 187
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 188
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 189
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 190
    [0, 0, 0, 384, 960, 960, 384, 0, 384, 384, 896, 1792, 3584, 7168, 6144, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 191
    [768, 384, 128, 0, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24588, 24588, 0, 0, 0, 0, 0],
    // 192
    [384, 768, 512, 0, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24588, 24588, 0, 0, 0, 0, 0],
    // 193
    [384, 960, 1632, 0, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24588, 24588, 0, 0, 0, 0, 0],
    // 194
    [1888, 4064, 3520, 0, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24588, 24588, 0, 0, 0, 0, 0],
    // 195
    [0, 3168, 3168, 0, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24590, 24590, 0, 0, 0, 0, 0],
    // 196
    [896, 1088, 1088, 1088, 896, 896, 1728, 1728, 1728, 3168, 3168, 3168, 8176, 8176, 12312, 12312, 12312, 24590, 24590, 0, 0, 0, 0, 0],
    // 197
    [0, 0, 0, 0, 2046, 2046, 3456, 3456, 6528, 6528, 6652, 12796, 12672, 32640, 32640, 24960, 49536, 49662, 49662, 0, 0, 0, 0, 0],
    // 198
    [0, 0, 0, 0, 2016, 8176, 7224, 12316, 28684, 24576, 24576, 24576, 24576, 24576, 28684, 12312, 15416, 8176, 2016, 256, 384, 192, 1920, 0],
    // 199
    [384, 192, 64, 0, 8188, 8188, 6144, 6144, 6144, 6144, 8184, 8184, 6144, 6144, 6144, 6144, 6144, 8188, 8188, 0, 0, 0, 0, 0],
    // 200
    [192, 384, 256, 0, 8188, 8188, 6144, 6144, 6144, 6144, 8184, 8184, 6144, 6144, 6144, 6144, 6144, 8188, 8188, 0, 0, 0, 0, 0],
    // 201
    [192, 480, 816, 0, 8188, 8188, 6144, 6144, 6144, 6144, 8184, 8184, 6144, 6144, 6144, 6144, 6144, 8188, 8188, 0, 0, 0, 0, 0],
    // 202
    [0, 816, 816, 0, 8188, 8188, 6144, 6144, 6144, 6144, 8184, 8184, 6144, 6144, 6144, 6144, 6144, 8188, 8188, 0, 0, 0, 0, 0],
    // 203
    [768, 384, 128, 0, 2016, 2016, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 2016, 2016, 0, 0, 0, 0, 0],
    // 204
    [192, 384, 256, 0, 2016, 2016, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 2016, 2016, 0, 0, 0, 0, 0],
    // 205
    [384, 960, 1632, 0, 2016, 2016, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 2016, 2016, 0, 0, 0, 0, 0],
    // 206
    [0, 1632, 1632, 0, 2016, 2016, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 384, 2016, 2016, 0, 0, 0, 0, 0],
    // 207
    [0, 0, 0, 0, 16320, 16368, 12344, 12312, 12300, 12300, 65292, 65292, 12300, 12300, 12300, 12312, 12344, 16368, 16320, 0, 0, 0, 0, 0],
    // 208
    [944, 2032, 1760, 0, 12300, 14348, 15372, 15372, 13836, 13068, 13068, 12684, 12492, 12492, 12396, 12348, 12348, 12316, 12300, 0, 0, 0, 0, 0],
    // 209
    [768, 384, 128, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28686, 12300, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 210
    [192, 384, 256, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28686, 12300, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 211
    [384, 960, 1632, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28686, 12300, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 212
    [944, 2032, 1760, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28686, 12300, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 213
    [0, 1632, 1632, 0, 2016, 4080, 7224, 12300, 28686, 24582, 24582, 24582, 24582, 24582, 28686, 12300, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 214
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 215
    [0, 0, 0, 0, 2022, 4092, 7224, 12348, 28798, 24774, 24710, 24966, 24838, 25350, 32270, 15372, 7224, 16368, 26592, 0, 0, 0, 0, 0],
    // 216
    [768, 384, 128, 0, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 14364, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 217
    [192, 384, 256, 0, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 14364, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 218
    [384, 960, 1632, 0, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 14364, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 219
    [0, 1632, 1632, 0, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 12300, 14364, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 220
    [192, 384, 256, 0, 28686, 12300, 6168, 7224, 3696, 1632, 960, 960, 384, 384, 384, 384, 384, 384, 384, 0, 0, 0, 0, 0],
    // 221
    [0, 0, 0, 0, 12288, 12288, 12288, 16352, 16368, 12344, 12312, 12312, 12312, 12344, 16368, 16352, 12288, 12288, 12288, 0, 0, 0, 0, 0],
    // 222
    [0, 0, 0, 0, 3968, 8128, 14560, 12384, 12384, 12480, 12672, 12672, 12512, 12400, 12312, 12312, 14136, 13296, 12768, 0, 0, 0, 0, 0],
    // 223
    [0, 0, 0, 0, 0, 768, 384, 128, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 224
    [0, 0, 0, 0, 0, 384, 768, 512, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 225
    [0, 0, 0, 0, 0, 384, 960, 1632, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 226
    [0, 0, 0, 0, 0, 1888, 4064, 3520, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 227
    [0, 0, 0, 0, 0, 0, 1632, 1632, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 228
    [0, 0, 0, 896, 1088, 1088, 1088, 896, 0, 2016, 8176, 6192, 112, 2032, 8112, 6192, 6256, 8176, 3992, 0, 0, 0, 0, 0],
    // 229
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 15984, 32764, 50060, 3846, 16382, 29694, 49920, 51084, 32508, 14448, 0, 0, 0, 0, 0],
    // 230
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2016, 4080, 7192, 6144, 6144, 6144, 6144, 7192, 4080, 2016, 256, 384, 192, 1920, 0],
    // 231
    [0, 0, 0, 0, 0, 768, 384, 128, 0, 2016, 4080, 7224, 6168, 8184, 8184, 6144, 7168, 4080, 2016, 0, 0, 0, 0, 0],
    // 232
    [0, 0, 0, 0, 0, 192, 384, 256, 0, 2016, 4080, 7224, 6168, 8184, 8184, 6144, 7168, 4080, 2016, 0, 0, 0, 0, 0],
    // 233
    [0, 0, 0, 0, 0, 384, 960, 1632, 0, 2016, 4080, 7224, 6168, 8184, 8184, 6144, 7168, 4080, 2016, 0, 0, 0, 0, 0],
    // 234
    [0, 0, 0, 0, 0, 0, 1632, 1632, 0, 2016, 4080, 7224, 6168, 8184, 8184, 6144, 7168, 4080, 2016, 0, 0, 0, 0, 0],
    // 235
    [0, 0, 0, 0, 0, 768, 384, 128, 0, 896, 896, 384, 384, 384, 384, 384, 384, 960, 960, 0, 0, 0, 0, 0],
    // 236
    [0, 0, 0, 0, 0, 384, 768, 512, 0, 896, 896, 384, 384, 384, 384, 384, 384, 960, 960, 0, 0, 0, 0, 0],
    // 237
    [0, 0, 0, 0, 0, 384, 960, 1632, 0, 896, 896, 384, 384, 384, 384, 384, 384, 960, 960, 0, 0, 0, 0, 0],
    // 238
    [0, 0, 0, 0, 0, 0, 1632, 1632, 0, 896, 896, 384, 384, 384, 384, 384, 384, 960, 960, 0, 0, 0, 0, 0],
    // 239
    [0, 0, 0, 0, 1536, 864, 960, 1728, 96, 2032, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 240
    [0, 0, 0, 0, 0, 1840, 4080, 3808, 0, 7136, 8176, 7224, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 0, 0, 0, 0, 0],
    // 241
    [0, 0, 0, 0, 0, 768, 384, 128, 0, 2016, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 242
    [0, 0, 0, 0, 0, 192, 384, 256, 0, 2016, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 243
    [0, 0, 0, 0, 0, 384, 960, 1632, 0, 2016, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 244
    [0, 0, 0, 0, 0, 1888, 4064, 3520, 0, 2016, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 245
    [0, 0, 0, 0, 0, 0, 1632, 1632, 0, 2016, 4080, 7224, 6168, 6168, 6168, 6168, 7224, 4080, 2016, 0, 0, 0, 0, 0],
    // 246
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // 247
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2024, 4080, 7224, 6232, 6296, 6424, 6680, 7224, 4080, 6112, 0, 0, 0, 0, 0],
    // 248
    [0, 0, 0, 0, 0, 768, 384, 128, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 0, 0, 0, 0, 0],
    // 249
    [0, 0, 0, 0, 0, 192, 384, 256, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 0, 0, 0, 0, 0],
    // 250
    [0, 0, 0, 0, 0, 384, 960, 1632, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 0, 0, 0, 0, 0],
    // 251
    [0, 0, 0, 0, 0, 0, 1632, 1632, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 0, 0, 0, 0, 0],
    // 252
    [0, 0, 0, 0, 0, 192, 384, 256, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 24, 6200, 8176, 4064, 0],
    // 253
    [0, 0, 0, 0, 0, 0, 0, 6144, 6144, 6144, 6144, 8160, 8176, 6168, 6168, 6168, 6168, 8176, 8160, 6144, 6144, 6144, 6144, 0],
    // 254
    [0, 0, 0, 0, 0, 0, 1632, 1632, 0, 6168, 6168, 6168, 6168, 6168, 6168, 6168, 7224, 4088, 2008, 24, 6200, 8176, 4064, 0]
    // 255
  ]
};

// src/bitmap-text.ts
var BITMAP_FALLBACK_STACK = '"Cascadia Mono", "JetBrains Mono", Consolas, "DejaVu Sans Mono", monospace';
var glyphCache = /* @__PURE__ */ new Map();
function parseRgb(css) {
  if (css.startsWith("#")) {
    const hex2 = css.slice(1);
    if (hex2.length === 3) {
      return [
        parseInt(hex2[0] + hex2[0], 16),
        parseInt(hex2[1] + hex2[1], 16),
        parseInt(hex2[2] + hex2[2], 16)
      ];
    }
    if (hex2.length === 6) {
      return [
        parseInt(hex2.slice(0, 2), 16),
        parseInt(hex2.slice(2, 4), 16),
        parseInt(hex2.slice(4, 6), 16)
      ];
    }
    return null;
  }
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/u.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function tintedGlyph(code, fg) {
  if (code < 0 || code >= FONT_16X24.glyphs.length) return null;
  const key = `${String(code)}:${fg}`;
  const cached = glyphCache.get(key);
  if (cached !== void 0) return cached;
  const rows = FONT_16X24.glyphs[code];
  const rgb2 = rows ? parseRgb(fg) : null;
  if (!rows || !rgb2 || rows.every((bits) => bits === 0)) {
    glyphCache.set(key, null);
    return null;
  }
  const { w, h } = FONT_16X24;
  const glyph = document.createElement("canvas");
  glyph.width = w;
  glyph.height = h;
  const gctx = glyph.getContext("2d");
  if (!gctx) {
    glyphCache.set(key, null);
    return null;
  }
  const img = gctx.createImageData(w, h);
  const [r, g, b] = rgb2;
  for (let ry = 0; ry < h; ry++) {
    const mask = rows[ry] ?? 0;
    for (let rx = 0; rx < w; rx++) {
      if (mask >> w - 1 - rx & 1) {
        const o = (ry * w + rx) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
  }
  gctx.putImageData(img, 0, 0);
  glyphCache.set(key, glyph);
  return glyph;
}
function paintBitmapLine(canvas, runs, cellWidth, cellHeight, dpr) {
  const chars = runs.reduce((n, run2) => n + [...run2.text].length, 0);
  const cellWDevice = cellWidth * dpr;
  const cellHDevice = Math.max(1, Math.round(cellHeight * dpr));
  const edge = (i) => Math.round(i * cellWDevice);
  const totalDevice = Math.max(1, edge(chars));
  canvas.width = totalDevice;
  canvas.height = cellHDevice;
  const cssWidth = totalDevice / dpr;
  canvas.style.width = `${String(cssWidth)}px`;
  canvas.style.height = `${String(cellHeight)}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return cssWidth;
  ctx.imageSmoothingEnabled = false;
  let col = 0;
  for (const run2 of runs) {
    for (const char of run2.text) {
      const code = char.codePointAt(0) ?? 32;
      const left = edge(col);
      const width = edge(col + 1) - left;
      const glyph = tintedGlyph(code, run2.css);
      if (glyph) {
        ctx.drawImage(glyph, left, 0, width, cellHDevice);
      } else {
        ctx.fillStyle = run2.css;
        ctx.font = `${String(Math.round(cellHDevice * 0.82))}px ${BITMAP_FALLBACK_STACK}`;
        ctx.fillText(char, left, cellHDevice * 0.9);
      }
      col++;
    }
  }
  return cssWidth;
}
function wrapBitmapText(text, maxChars) {
  if (maxChars < 1) return [text];
  const words = text.split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if ([...candidate].length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function wrapBitmapParagraphs(text, maxChars) {
  return text.split("\n").flatMap(
    (paragraph) => paragraph.trim() === "" ? [""] : wrapBitmapText(paragraph, maxChars)
  );
}
function styleAsScreenReaderOnly(el11) {
  Object.assign(el11.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap"
  });
}
function bitmapTextBlock(lines, cellWidth, cellHeight, dpr) {
  const wrap = document.createElement("div");
  for (const runs of lines) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.display = "block";
    paintBitmapLine(canvas, runs, cellWidth, cellHeight, dpr);
    wrap.appendChild(canvas);
  }
  const label2 = document.createElement("span");
  label2.textContent = lines.map((runs) => runs.map((run2) => run2.text).join("")).join(" ");
  styleAsScreenReaderOnly(label2);
  wrap.appendChild(label2);
  return wrap;
}
function paintBitmapButtonLabel(button7, text, css, cellWidth, cellHeight, dpr) {
  button7.replaceChildren();
  if (!button7.hasAttribute("aria-label")) button7.setAttribute("aria-label", text);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  paintBitmapLine(canvas, [{ text, css }], cellWidth, cellHeight, dpr);
  button7.appendChild(canvas);
}

// src/paint.ts
var PAINT_FONT = `"Angband 8x13", ${BITMAP_FALLBACK_STACK}`;
var PAINT_FONT_SIZE = 13;
var PAINT_LINE_HEIGHT = 16;
function rgb(hex2) {
  const h = hex2.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function hex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}
function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
function tint(colour, alpha) {
  return `${hex(rgb(colour))}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}
function paintColours(theme) {
  const off = "#00000000";
  const strong = theme.light_styling ? mix(theme.text, "#000000", 0.5) : mix(theme.text, "#ffffff", 0.5);
  return {
    border: mix(theme.surface, theme.text, 0.28),
    muted: mix(theme.surface, theme.text, 0.55),
    textStrong: strong,
    floatBorder: mix(theme.surface, theme.text, 0.45),
    tick: theme.decorations ? tint(theme.accent, 0.35) : off,
    wash: theme.decorations ? tint(theme.accent, 0.06) : off,
    band: theme.decorations ? tint(theme.accent, 0.12) : off,
    hover: tint(theme.accent, 0.12),
    press: tint(theme.accent, 0.25)
  };
}
function paintProperties(theme) {
  const c = paintColours(theme);
  return {
    "--anyband-font": PAINT_FONT,
    "--anyband-font-size": `${PAINT_FONT_SIZE}px`,
    "--anyband-line": `${PAINT_LINE_HEIGHT}px`,
    "--anyband-border": c.border,
    "--anyband-muted": c.muted,
    "--anyband-text-strong": c.textStrong,
    "--anyband-tick": c.tick,
    "--anyband-wash": c.wash,
    "--anyband-band": c.band,
    "--anyband-hover": c.hover,
    "--anyband-press": c.press,
    "--anyband-rounding-child": `${Math.round(theme.rounding * 0.6)}px`,
    "--anyband-rounding-frame": `${Math.round(theme.rounding * 0.4)}px`
  };
}
var FRAMES = [".surface", ".items", ".phase4", ".store", ".sheet", ".theme"].map((s) => `:host ${s}`).join(",");
var TICK = "linear-gradient(var(--anyband-tick),var(--anyband-tick))";
var CORNERS = ["left 2px top 2px", "right 2px top 2px", "left 2px bottom 2px", "right 2px bottom 2px"];
var PAINT_CSS = [
  ":host{font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font);font-synthesis:none;-webkit-font-smoothing:none}",
  ":host b,:host strong,:host th,:host summary,:host .heading,:host h2,:host h3,:host h4{font-weight:normal}",
  ":host b,:host strong{color:var(--anyband-text-strong)}",
  ":host h2,:host h3,:host h4,:host .hint{font-size:inherit}",
  ":host .muted,:host .hint{opacity:1;color:var(--anyband-muted)}",
  `${FRAMES}{border-color:var(--anyband-border);border-radius:var(--anyband-rounding-child);background-color:var(--anyband-surface);background-image:${Array(8).fill(TICK).join(",")},linear-gradient(to bottom,var(--anyband-wash),transparent);background-position:${CORNERS.flatMap((p) => [p, p]).join(",")},0 0;background-size:${Array(4).fill("9px 1px,1px 9px").join(",")},100% 7em;background-repeat:no-repeat}`,
  ":host .heading,:host h2,:host h3{color:var(--anyband-accent);background:linear-gradient(to right,var(--anyband-band),transparent);border-bottom:1px solid var(--anyband-border);padding:2px 6px;margin:0 0 4px}",
  ":host summary{color:var(--anyband-accent)}",
  ":host button:not(.row),:host input:not([type=checkbox]):not([type=radio]),:host select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-border);border-radius:var(--anyband-rounding-frame);padding:1px 6px}",
  ":host input[type=checkbox],:host input[type=radio]{accent-color:var(--anyband-accent)}",
  ":host button:not(.row):hover:not(:disabled),:host select:hover{border-color:var(--anyband-accent);color:var(--anyband-text-strong)}",
  ":host button:not(.row):active:not(:disabled),:host button:not(.row)[aria-pressed=true]{background:var(--anyband-press)}",
  ":host .row:hover:not([aria-pressed=true]):not(:disabled){background:var(--anyband-hover)}",
  ":host button:disabled{opacity:.45}",
  ":host :focus-visible{outline:1px solid var(--anyband-accent);outline-offset:1px}",
  ":host td,:host th{border-bottom-color:var(--anyband-border)}",
  ":host th{color:var(--anyband-muted)}",
  ":host .metric,:host .tip,:host .prompt,:host .menu,:host .rule,:host .bar{border-color:var(--anyband-border)}",
  ":host .metric,:host .badge,:host .tip{border-radius:var(--anyband-rounding-frame)}",
  ":host .bar{border-radius:0}",
  ":host *{scrollbar-width:thin;scrollbar-color:var(--anyband-border) transparent}"
].join("\n");
function chromeThemeFor(theme) {
  const c = paintColours(theme);
  return {
    font: "Angband 8x13",
    fontSize: PAINT_FONT_SIZE,
    page: hex(rgb(theme.background)),
    titleBackground: hex(rgb(theme.surface)),
    text: hex(rgb(theme.text)),
    textStrong: c.textStrong,
    muted: c.muted,
    border: c.border,
    divider: c.border,
    dividerHover: hex(rgb(theme.accent)),
    accent: hex(rgb(theme.accent)),
    floatBorder: c.floatBorder,
    radius: Math.round(theme.rounding * 0.6),
    shadow: false
  };
}
var PAINTED_FEATURES = [
  "anybandui.sidebar",
  "anybandui.status",
  "anybandui.messages",
  "anybandui.itemsLists",
  "anybandui.spells",
  "anybandui.quickbar",
  "anybandui.restDialog",
  "anybandui.storeWindow",
  "anybandui.characterSheet",
  "anybandui.equipmentPortrait",
  "anybandui.themeEditor"
];
function installChromePaint(display, flags, theme, log) {
  if (!PAINTED_FEATURES.some((flag) => flags[flag] === true)) return () => {
  };
  if (!display?.setChromeTheme) {
    log("This version of the game cannot repaint its window frames, so they keep their usual look.");
    return () => {
    };
  }
  try {
    display.setChromeTheme(chromeThemeFor(theme));
  } catch (err) {
    log(`Could not repaint the window frames: ${err instanceof Error ? err.message : String(err)}`);
    return () => {
    };
  }
  return () => {
    try {
      display.setChromeTheme?.(null);
    } catch {
    }
  };
}

// src/theme.ts
var THEMES = {
  "terminal-original": { background: "#070b0dff", surface: "#111a1dff", text: "#d9e3dbff", accent: "#80b891ff", rounding: 5, decorations: true, invert_dungeon: false, light_styling: false },
  "dark-graphite": { background: "#0e0f13ff", surface: "#1f2129ff", text: "#d9e3dbff", accent: "#9cadd9ff", rounding: 5, decorations: true, invert_dungeon: false, light_styling: false },
  "light-paper": { background: "#e6e8e3ff", surface: "#fafaf2ff", text: "#1f2b2eff", accent: "#215c52ff", rounding: 8, decorations: true, invert_dungeon: false, light_styling: true },
  "amber-terminal": { background: "#110b06ff", surface: "#241910ff", text: "#f0d9a6ff", accent: "#e89e42ff", rounding: 0, decorations: true, invert_dungeon: false, light_styling: false },
  "midnight-ice": { background: "#060b17ff", surface: "#0e1b2bff", text: "#cfe6f5ff", accent: "#59c2e0ff", rounding: 7, decorations: true, invert_dungeon: false, light_styling: false },
  // The theme packs. Linoleum draws tiles and has no panel colours of its own, so its preset is a dark, warm neutral with the cyan highlight of the game's own menus.
  "linoleum": { background: "#0c0b0aff", surface: "#1b1915ff", text: "#e3dccbff", accent: "#5fc8c8ff", rounding: 3, decorations: true, invert_dungeon: false, light_styling: false },
  // No paint ticks, washes or bands, and square corners: the classic terminal's grey on black.
  "plain-terminal": { background: "#000000ff", surface: "#000000ff", text: "#c0c0c0ff", accent: "#8c8c8cff", rounding: 0, decorations: false, invert_dungeon: false, light_styling: false }
};
var PACK_CHOICES = [
  ["linoleum", "Linoleum"],
  ["plain-terminal", "Plain terminal"]
];
var PACK_IDS = new Set(PACK_CHOICES.map(([id]) => id));
var packsOn = false;
function setThemePacks(on) {
  packsOn = on;
}
var COLOUR = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
function normalizeColour(value2) {
  const match = COLOUR.exec(value2.trim());
  if (!match) return null;
  const hex2 = match[1].toLowerCase();
  return `#${hex2.length === 6 ? `${hex2}ff` : hex2}`;
}
function normalizeRounding(value2) {
  return Number.isInteger(value2) && value2 >= 0 && value2 <= 16 ? value2 : null;
}
function parseCustomTheme(value2) {
  if (value2 === null || value2 === void 0) return null;
  if (typeof value2 !== "object" || Array.isArray(value2)) return null;
  const record2 = value2;
  const background = typeof record2["background"] === "string" ? normalizeColour(record2["background"]) : null;
  const surface = typeof record2["surface"] === "string" ? normalizeColour(record2["surface"]) : null;
  const text = typeof record2["text"] === "string" ? normalizeColour(record2["text"]) : null;
  const accent = typeof record2["accent"] === "string" ? normalizeColour(record2["accent"]) : null;
  const rounding = typeof record2["rounding"] === "number" ? normalizeRounding(record2["rounding"]) : null;
  if (!background || !surface || !text || !accent || rounding === null || typeof record2["invert_dungeon"] !== "boolean") return null;
  return { background, surface, text, accent, rounding, invert_dungeon: record2["invert_dungeon"] };
}
function channel(hex2, index) {
  return Number.parseInt(hex2.slice(1 + index * 2, 3 + index * 2), 16);
}
function lightFromBackground(hex2) {
  const r = channel(hex2, 0);
  const g = channel(hex2, 1);
  const b = channel(hex2, 2);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
}
function resolveTheme(name, custom) {
  const base = (PACK_IDS.has(name) && !packsOn ? void 0 : THEMES[name]) ?? THEMES["terminal-original"];
  if (!custom) return base;
  return {
    ...base,
    background: custom.background,
    surface: custom.surface,
    text: custom.text,
    accent: custom.accent,
    rounding: custom.rounding,
    invert_dungeon: custom.invert_dungeon,
    light_styling: lightFromBackground(custom.background)
  };
}
var THEME_CHOICES = [
  ["terminal-original", "Terminal (original)"],
  ["dark-graphite", "Dark / Graphite"],
  ["light-paper", "Light / Paper"],
  ["amber-terminal", "Amber terminal"],
  ["midnight-ice", "Midnight / Ice"]
];
function themeChoices() {
  return packsOn ? [...THEME_CHOICES, ...PACK_CHOICES] : THEME_CHOICES;
}
var CHROME = {
  padding: { window: [8, 8], frame: [7, 3], separator_text: [8, 3], cell: [6, 2] },
  spacing: { item: [7, 4], item_inner: [5, 4] },
  border: { window: 1, child: 1, frame: 1, tab: 0, separator_text: 1 },
  rounding: { child_factor: 0.6, frame_factor: 0.4, popup_factor: 0.8, scrollbar_size: 12 }
};
var themeChanges = /* @__PURE__ */ new Set();
function onThemeChange(listener) {
  themeChanges.add(listener);
  return () => {
    themeChanges.delete(listener);
  };
}
function notifyThemeChange(theme) {
  for (const listener of [...themeChanges]) listener(theme);
}
var painted = /* @__PURE__ */ new WeakSet();
function applyTheme(root, theme = THEMES["terminal-original"]) {
  const style = root.host instanceof HTMLElement ? root.host.style : void 0;
  if (style === void 0) return;
  for (const [key, value2] of Object.entries(theme)) {
    style.setProperty(`--anyband-${key.replaceAll("_", "-")}`, typeof value2 === "boolean" ? Number(value2).toString() : key === "rounding" ? `${value2}px` : String(value2));
  }
  for (const [group, fields] of Object.entries(CHROME)) {
    for (const [key, value2] of Object.entries(fields)) {
      style.setProperty(
        `--anyband-${group}-${key.replaceAll("_", "-")}`,
        Array.isArray(value2) ? value2.map((part) => `${part}px`).join(" ") : `${value2}px`
      );
    }
  }
  for (const [name, value2] of Object.entries(paintProperties(theme))) style.setProperty(name, value2);
  const doc = root.ownerDocument;
  if (!painted.has(root) && doc && typeof root.appendChild === "function") {
    const paint = doc.createElement("style");
    paint.textContent = PAINT_CSS;
    root.appendChild(paint);
    painted.add(root);
  }
}

// src/panels/panel-host.ts
var HOST_CSS = `:host{position:fixed;display:none;z-index:50;box-sizing:border-box;color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}`;
var PANEL_CSS = `
*{box-sizing:border-box}.surface{width:100%;height:100%;overflow:auto;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);padding:5px}
.group{min-height:0;overflow:auto}.heading{color:var(--anyband-accent);font-weight:700;border-bottom:1px solid var(--anyband-accent);margin:0 0 4px;padding-bottom:2px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.metric{text-align:center;border:1px solid var(--anyband-accent);border-radius:3px;padding:2px;min-width:0}.metric b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{height:6px;background:var(--anyband-background);border:1px solid var(--anyband-accent);margin-top:2px}.fill{height:100%}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));text-align:center}.drained{opacity:.55}
.badges{display:flex;flex-wrap:wrap;gap:4px}.badge{border:1px solid currentColor;border-left-width:2px;padding:2px 5px;border-radius:3px}
.muted{opacity:.55}.messages{overflow:auto;max-height:min(24em,50vh)}.message{white-space:pre-wrap}.message .body{white-space:inherit}.ribbon{color:#f5bc5a;border:1px solid #f5bc5a;padding:2px 5px;pointer-events:none}
.messages-filter{width:100%;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent)}
.pause{display:inline-flex;align-items:flex-end;gap:2px;height:1em;vertical-align:middle}.pause i,.pause b{display:inline-block;background:currentColor;font-style:normal;font-weight:normal}
.pause i{width:.13em;height:.7em}.pause b{width:.16em;height:.16em;border-radius:50%;animation:anyband-breathe 1.1s ease-in-out infinite}
.pause b:nth-child(4){animation-delay:.15s}.pause b:nth-child(5){animation-delay:.3s}
@keyframes anyband-breathe{0%,100%{opacity:.35}50%{opacity:1}}
.pause.still b{animation:none;opacity:.8}@media (prefers-reduced-motion:reduce){.pause b{animation:none;opacity:.8}}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cut{flex:none;margin-left:.25em}
.tip{display:none;position:absolute;z-index:2;max-width:26em;white-space:pre-wrap;pointer-events:none;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent);border-radius:3px;padding:6px}
input{width:100%;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent)}
.compact{display:flex;align-items:center;gap:10px;overflow:hidden;white-space:nowrap;padding:0 5px}.compact .group{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden}.compact .group:empty{display:none}
.compact .heading,.compact input,.compact .messages-filter{display:none}.compact .badges{flex-wrap:nowrap}.compact .badge{padding:0 4px}.compact .grid,.compact .metric-grid{display:flex;gap:8px}
.compact .metric{border:0;padding:0;display:flex;gap:3px}.compact .metric b{display:inline}.compact .messages{overflow:hidden;max-height:none;min-width:0}
.compact .message{display:flex;align-items:baseline;overflow:hidden;white-space:nowrap;min-width:0}.compact .message .body{overflow:hidden;white-space:nowrap;min-width:0;flex:1}
.compact .message~.message{display:none}.compact .ribbon{width:auto!important;flex:none}
`;
var COMPACT_ROWS = 3;
var CSS = `${HOST_CSS}${PANEL_CSS}`;
var panelHosts = /* @__PURE__ */ new Set();
var panelVisualFilter = null;
function setPanelHostVisualFilter(filter) {
  panelVisualFilter = filter;
  for (const host of panelHosts) host.style.filter = filter ?? "";
}
function node(parent, tag, className = "", value2) {
  const child = parent.ownerDocument.createElement(tag);
  child.className = className;
  if (value2 !== void 0) child.textContent = value2;
  parent.appendChild(child);
  return child;
}
function fraction(current, maximum2) {
  return maximum2 > 0 ? Math.max(0, Math.min(1, current / maximum2)) : 0;
}
function meter(parent, label2, value2, amount, colour, tip2) {
  const cell2 = node(parent, "div", "meter");
  node(cell2, "span", "", label2);
  node(cell2, "span", "", ` ${value2}`);
  const track = node(cell2, "div", "bar");
  const fill = node(track, "div", "fill");
  fill.style.width = `${Math.round(amount * 100)}%`;
  fill.style.backgroundColor = colour;
  if (tip2) cell2.dataset.tip = tip2;
}
function intersects(a, b) {
  return a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
}
function createPanelContent(surface, panels) {
  const mounts = panels.map(() => node(surface, "div", "group"));
  const tip2 = node(surface, "div", "tip");
  const signatures = [];
  surface.addEventListener("mouseover", (event) => {
    const target = event.target;
    const subject = target instanceof HTMLElement ? target.closest("[data-tip]") : null;
    tip2.textContent = subject?.dataset.tip ?? "";
    tip2.style.display = subject ? "block" : "none";
    if (subject) {
      tip2.style.left = `${Math.min(subject.offsetLeft, Math.max(0, surface.clientWidth - tip2.offsetWidth))}px`;
      tip2.style.top = `${Math.min(subject.offsetTop + subject.offsetHeight, Math.max(0, surface.clientHeight - tip2.offsetHeight))}px`;
    }
  });
  surface.addEventListener("mouseleave", () => {
    tip2.style.display = "none";
  });
  return {
    render(model) {
      panels.forEach((panel, index) => {
        const signature = JSON.stringify([surface.className, panel.select(model)]);
        if (signatures[index] === signature) return;
        signatures[index] = signature;
        panel.render(mounts[index], model);
      });
    }
  };
}
function createPanelHost(doc, panels, theme) {
  const element = doc.createElement("div");
  element.className = "anyband-panel";
  panelHosts.add(element);
  element.style.filter = panelVisualFilter ?? "";
  const shadow = element.attachShadow({ mode: "open" });
  if (theme) applyTheme(shadow, theme);
  else applyTheme(shadow);
  node(shadow, "style", "", CSS);
  const surface = node(shadow, "div", "surface");
  const content = createPanelContent(surface, panels);
  doc.body.appendChild(element);
  const stopTheme2 = onThemeChange((next) => {
    if (!element.isConnected) {
      stopTheme2();
      return;
    }
    applyTheme(shadow, next);
  });
  return {
    element,
    present(section2, frame, model) {
      const region = section2.region;
      const box = region?.pixels;
      const at = frame.stack?.findIndex((item) => item.id === region?.name) ?? -1;
      const covered = at >= 0 && frame.stack.slice(at + 1).some((item) => intersects(item.cells, region.cells));
      if (!box || box.width <= 0 || box.height <= 0 || covered || frame.stack && at < 0) {
        element.style.display = "none";
        return;
      }
      element.style.display = "block";
      element.style.left = `${box.x}px`;
      element.style.top = `${box.y}px`;
      element.style.width = `${box.width}px`;
      element.style.height = `${box.height}px`;
      surface.className = region.cells.rows < COMPACT_ROWS ? "surface compact" : "surface";
      content.render(model);
    }
  };
}

// src/preferences.ts
var DEFAULT_DISPLAY_PREFERENCE = {
  v: 2,
  /* 28px was rung 3 in the former 16-48px ladder.  Keep that familiar
   * default after adding smaller and larger manual zoom steps. */
  zoomIndex: 7,
  interfaceZoomIndex: 1,
  mapDetail: 0
};
function finiteInteger(value2, fallback, min, max) {
  return typeof value2 === "number" && Number.isInteger(value2) ? Math.max(min, Math.min(max, value2)) : fallback;
}
function isRecord(value2) {
  return !!value2 && typeof value2 === "object";
}
var LEGACY_PLAY_ZOOM_INDEX_TO_CURRENT = [4, 5, 6, 7, 8, 9, 10, 11];
function storedDisplayPreference(raw) {
  if (!isRecord(raw) || raw.v !== 2 || !isRecord(raw.display)) return null;
  const candidate = raw.display;
  const legacy = candidate.v === 1;
  if (!legacy && candidate.v !== 2) return null;
  const legacyIndex = finiteInteger(candidate.zoomIndex, 3, 0, 7);
  return {
    v: 2,
    zoomIndex: legacy ? LEGACY_PLAY_ZOOM_INDEX_TO_CURRENT[legacyIndex] ?? DEFAULT_DISPLAY_PREFERENCE.zoomIndex : finiteInteger(candidate.zoomIndex, DEFAULT_DISPLAY_PREFERENCE.zoomIndex, 0, 18),
    interfaceZoomIndex: finiteInteger(
      candidate.interfaceZoomIndex,
      DEFAULT_DISPLAY_PREFERENCE.interfaceZoomIndex,
      0,
      3
    ),
    mapDetail: finiteInteger(candidate.mapDetail, DEFAULT_DISPLAY_PREFERENCE.mapDetail, 0, 3)
  };
}
function storedRememberedSettings(raw) {
  if (!isRecord(raw)) return null;
  const candidate = raw.v === 2 ? raw.options : raw.v === 1 ? raw : void 0;
  return isRecord(candidate) && candidate.v === 1 && isRecord(candidate.values) ? candidate : null;
}
function readFirstEncounterPreference(raw) {
  if (!isRecord(raw)) return null;
  const candidate = raw.v === 2 ? raw.firstEncounter : raw.v === 1 ? raw : void 0;
  if (!isRecord(candidate) || typeof candidate.characterKey !== "string" || !Array.isArray(candidate.monsters) || !Array.isArray(candidate.artifacts)) {
    return null;
  }
  return {
    characterKey: candidate.characterKey,
    monsters: candidate.monsters.filter((value2) => typeof value2 === "number"),
    artifacts: candidate.artifacts.filter((value2) => typeof value2 === "number")
  };
}
function readSubwindowZoomPreference(raw) {
  if (!isRecord(raw) || raw.v !== 2 || !isRecord(raw.subwindowZoom)) return {};
  const steps = {};
  for (const [id, value2] of Object.entries(raw.subwindowZoom)) {
    if (typeof value2 === "number") {
      if (Number.isInteger(value2) && value2 >= 0) steps[id] = { step: value2, manual: true };
      continue;
    }
    if (isRecord(value2) && typeof value2.step === "number" && Number.isInteger(value2.step) && value2.step >= 0 && typeof value2.manual === "boolean") {
      steps[id] = { step: value2.step, manual: value2.manual };
    }
  }
  return steps;
}
function preservedPreferences(raw) {
  const options = storedRememberedSettings(raw);
  const display = storedDisplayPreference(raw);
  const firstEncounter = readFirstEncounterPreference(raw);
  const hideRepeatShortcuts = isRecord(raw) && raw.v === 2 && raw.hideRepeatShortcuts === true;
  const subwindowZoom = readSubwindowZoomPreference(raw);
  return {
    ...options ? { options } : {},
    ...display ? { display } : {},
    ...hideRepeatShortcuts ? { hideRepeatShortcuts } : {},
    ...firstEncounter ? { firstEncounter } : {},
    ...Object.keys(subwindowZoom).length > 0 ? { subwindowZoom } : {}
  };
}
function readDisplayPreference(raw) {
  return storedDisplayPreference(raw) ?? DEFAULT_DISPLAY_PREFERENCE;
}
function withDisplayPreference(raw, display) {
  return { ...isRecord(raw) ? raw : {}, v: 2, ...preservedPreferences(raw), display };
}
function withSubwindowZoomPreference(raw, subwindowZoom) {
  return { ...isRecord(raw) ? raw : {}, v: 2, ...preservedPreferences(raw), subwindowZoom };
}

// src/fonts.ts
var FONT_FILES = [
  "Cousine-Regular.ttf",
  "ConsolaMono-Book.ttf",
  "Erika Type.ttf",
  "F25_Bank_Printer.ttf",
  "Flexi_IBM_VGA_True.ttf",
  "Hack-Regular.ttf",
  "LiberationMono-Regular.ttf",
  "MonospaceTypewriter.ttf",
  "Nouveau_IBM.ttf",
  "RetraConsole.ttf",
  "Sono-Regular.ttf",
  "SVBasicManual.ttf",
  "Terminal F4.ttf",
  "Xanmono-Regular.ttf",
  "Zector.ttf"
];

// src/settings.ts
var DEFAULT_SETTINGS = {
  theme: "terminal-original",
  customTheme: null,
  interfaceFont: "Nouveau_IBM.ttf",
  dungeonFont: "",
  showHeadings: true,
  hoverDelayMs: 550,
  zoomIndex: 7,
  panelZoom: {},
  effects: {}
};
function themeFromPrefs(raw) {
  const settings = validateSettings(raw);
  return resolveTheme(settings.theme, settings.customTheme);
}
var themes = /* @__PURE__ */ new Set(["terminal-original", "dark-graphite", "light-paper", "amber-terminal", "midnight-ice", "linoleum", "plain-terminal"]);
var fonts = new Set(FONT_FILES);
function validateSettings(value2) {
  const record2 = value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : {};
  return {
    theme: typeof record2["theme"] === "string" && themes.has(record2["theme"]) ? record2["theme"] : DEFAULT_SETTINGS.theme,
    customTheme: parseCustomTheme(record2["customTheme"]),
    interfaceFont: typeof record2["interfaceFont"] === "string" && fonts.has(record2["interfaceFont"]) ? record2["interfaceFont"] : DEFAULT_SETTINGS.interfaceFont,
    dungeonFont: typeof record2["dungeonFont"] === "string" && (record2["dungeonFont"] === "" || fonts.has(record2["dungeonFont"])) ? record2["dungeonFont"] : DEFAULT_SETTINGS.dungeonFont,
    showHeadings: typeof record2["showHeadings"] === "boolean" ? record2["showHeadings"] : DEFAULT_SETTINGS.showHeadings,
    hoverDelayMs: typeof record2["hoverDelayMs"] === "number" && Number.isInteger(record2["hoverDelayMs"]) ? Math.max(0, Math.min(5e3, record2["hoverDelayMs"])) : DEFAULT_SETTINGS.hoverDelayMs,
    zoomIndex: typeof record2["zoomIndex"] === "number" && Number.isInteger(record2["zoomIndex"]) ? Math.max(0, Math.min(18, record2["zoomIndex"])) : DEFAULT_SETTINGS.zoomIndex,
    panelZoom: record2["panelZoom"] && typeof record2["panelZoom"] === "object" && !Array.isArray(record2["panelZoom"]) ? Object.fromEntries(Object.entries(record2["panelZoom"]).filter(([id, step]) => id.length > 0 && typeof step === "number" && Number.isInteger(step) && step >= 0 && step <= 6)) : DEFAULT_SETTINGS.panelZoom,
    effects: record2["effects"] && typeof record2["effects"] === "object" && !Array.isArray(record2["effects"]) ? Object.fromEntries(Object.entries(record2["effects"]).filter(([id, value3]) => id.length > 0 && typeof value3 === "number" && Number.isFinite(value3)).map(([id, value3]) => [id, Math.max(0, Math.min(100, Math.round(value3)))])) : DEFAULT_SETTINGS.effects
  };
}
function createSettingsStore(ctx) {
  let current = validateSettings(ctx.prefs.get());
  const listeners = /* @__PURE__ */ new Set();
  return {
    get: () => ({ ...current }),
    set(patch) {
      const next = validateSettings({ ...current, ...patch });
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      const stored = ctx.prefs.get();
      const preserved = stored !== null && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      ctx.prefs.set({ ...preserved, ...next });
      current = next;
      for (const listener of listeners) listener({ ...current });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

// src/zoom.ts
function pointInRect(point, rect) {
  return !!rect && pointInPixels(point.x, point.y, rect);
}
function clampOrigin(snapshot, point) {
  return {
    x: Math.max(0, Math.min(snapshot.level.width - snapshot.viewport.size.width, Math.round(point.x))),
    y: Math.max(0, Math.min(snapshot.level.height - snapshot.viewport.size.height, Math.round(point.y)))
  };
}
var PLAY_ZOOM_CELL_HEIGHTS = [
  8,
  10,
  12,
  14,
  16,
  20,
  24,
  28,
  32,
  36,
  40,
  48,
  56,
  64,
  72,
  80,
  96,
  112,
  128
];
var SUBWINDOW_ZOOM_CELL_HEIGHTS = [10, 12, 14, 16, 18, 20, 24];
var SUBWINDOW_ZOOM_MIN_COLS = 20;
var SUBWINDOW_ZOOM_MIN_ROWS = 3;
var INTERFACE_ZOOM_SCALES = [0.75, 1, 1.25, 1.5];
var MAP_DETAIL_FACTORS = [0, 4, 2, 1];
var ACCESSIBILITY_ZOOM_INDEX = 9;
var DEFAULT_PLAY_MAP_COLS = 66;
var DEFAULT_PLAY_GRID_ROWS = 24;
var RESERVED_RIGHT_COLUMN = 1;
var OWNED_DISPLAY_SETTERS = /* @__PURE__ */ new Set(["setCamera", "setMapView", "setGrid", "setSidebarExtent"]);
function trackedDisplay(display, applied) {
  return new Proxy({}, {
    get(_empty, property) {
      const member = Reflect.get(display, property);
      if (typeof member !== "function") return member;
      if (!OWNED_DISPLAY_SETTERS.has(String(property))) return member.bind(display);
      return (...args) => {
        if (args[0] == null) applied.delete(String(property));
        else applied.add(String(property));
        return Reflect.apply(member, display, args);
      };
    },
    has: (_empty, property) => Reflect.has(display, property)
  });
}
function keepsDisplayRequestsPerMod(display) {
  const read = display;
  return typeof read.getGrid === "function" && typeof read.getTileScaling === "function";
}
function releaseTileSettings(display, overviewApplied) {
  if (keepsDisplayRequestsPerMod(display)) {
    display.setTileScaling(null);
    display.setFullMapOverview?.(null);
    return;
  }
  if (overviewApplied) display.setFullMapOverview?.(false);
  display.setTileScaling("auto");
}
var configuredTileDisplay = null;
var fullOverviewApplied = false;
var SUBWINDOW_ZOOM_PREF_BLOCK_NAME = "anybandui-zoom";
var runtime = null;
function markGridState(value2) {
  if (typeof document !== "undefined" && document.body) {
    document.body.setAttribute("data-anybandui-grid-state", value2);
  }
}
function initialBootPhase() {
  if (typeof location === "undefined") return "title";
  const params = new URL(location.href).searchParams;
  if (params.has("agent")) return "game-pending";
  try {
    if (sessionStorage.getItem("neo-angband-birth-done") === "1") return "game-pending";
    if (params.has("new")) return "birth";
    if (sessionStorage.getItem("neo-angband-skip-title") === "1") return "game-pending";
  } catch {
    if (params.has("new")) return "birth";
  }
  return "title";
}
function stepIndex(index, direction, last) {
  return Math.max(0, Math.min(last, index + Math.sign(direction)));
}
function snapEven(value2) {
  return Math.round(value2 / 2) * 2;
}
function pointInPixels(x, y, pixels) {
  return !!pixels && x >= pixels.x && y >= pixels.y && x < pixels.x + pixels.width && y < pixels.y + pixels.height;
}
function evenSpan(value2, limit) {
  if (limit <= 1) return limit;
  const clamped = Math.max(2, Math.min(limit, Math.floor(value2)));
  return clamped === limit ? clamped : clamped - clamped % 2;
}
function mapViewFor(snapshot, detail, center) {
  const factor = MAP_DETAIL_FACTORS[detail] ?? 0;
  if (factor === 0) return null;
  const width = evenSpan(Math.max(2, snapshot.grid.cols - 2) * factor, snapshot.level.width);
  const height = evenSpan(Math.max(2, snapshot.grid.rows - 2) * factor, snapshot.level.height);
  const maxX = Math.max(0, snapshot.level.width - width);
  const maxY = Math.max(0, snapshot.level.height - height);
  const x = Math.max(0, Math.min(maxX, snapEven(center.x - Math.floor(width / 2))));
  const y = Math.max(0, Math.min(maxY, snapEven(center.y - Math.floor(height / 2))));
  return { origin: { x, y }, size: { width, height } };
}
function pannedOrigin(snapshot, dx, dy) {
  const maxX = Math.max(0, snapshot.level.width - snapshot.viewport.size.width);
  const maxY = Math.max(0, snapshot.level.height - snapshot.viewport.size.height);
  return {
    x: Math.max(0, Math.min(maxX, snapEven(snapshot.viewport.origin.x + dx))),
    y: Math.max(0, Math.min(maxY, snapEven(snapshot.viewport.origin.y + dy)))
  };
}
function pinchDirection(previous, next) {
  if (previous <= 0 || next <= 0) return 0;
  const change = Math.log2(next / previous);
  return change >= 0.18 ? 1 : change <= -0.18 ? -1 : 0;
}
function sidebarPagePlan(entryCount, layout, pixels, scale, requestedPage) {
  const preferredFont = Math.max(11, Math.round(14 * scale));
  let perPage = Math.max(1, entryCount);
  if (layout === "top") {
    const pagerWidth = 62;
    const entryWidth = 82 * scale;
    perPage = Math.max(1, Math.floor(Math.max(1, pixels.width - pagerWidth) / entryWidth));
  } else if (layout === "left") {
    const lineHeight = preferredFont * 1.25;
    const visibleRows = Math.max(1, Math.floor((pixels.height - preferredFont * 0.8) / lineHeight));
    perPage = entryCount > visibleRows ? Math.max(1, visibleRows - 1) : visibleRows;
  }
  const pages = Math.max(1, Math.ceil(entryCount / perPage));
  const page = Math.max(0, Math.min(pages - 1, requestedPage));
  return {
    page,
    pages,
    start: page * perPage,
    end: Math.min(entryCount, (page + 1) * perPage),
    fontSize: preferredFont
  };
}
function sidebarRowGap(layout, previousRow, row) {
  if (layout === "top" || previousRow === null || row === void 0) return 0;
  return Math.max(0, row - previousRow - 1);
}
function twoFingerGestureActive() {
  return (runtime?.touches.size ?? 0) >= 2;
}
function playerCenter(rt, snapshot) {
  const player = playerGrid(rt.ctx);
  return player ? { x: player.x, y: player.y } : {
    x: snapshot.viewport.origin.x + Math.floor(snapshot.viewport.size.width / 2),
    y: snapshot.viewport.origin.y + Math.floor(snapshot.viewport.size.height / 2)
  };
}
function subwindowZoomPreferenceEntries(rt) {
  const panels = {};
  for (const [id, step] of rt.subwindowZoomSteps) {
    panels[id] = { step, manual: rt.subwindowZoomManual.has(id) };
  }
  return panels;
}
function writePreference(rt) {
  try {
    const preferences = withDisplayPreference(rt.ctx.prefs?.get(), rt.preference);
    rt.ctx.prefs?.set(withSubwindowZoomPreference(
      preferences,
      subwindowZoomPreferenceEntries(rt)
    ));
  } catch {
    rt.ctx.log?.("could not persist the zoom and layout preference");
  }
}
function isRecord2(value2) {
  return !!value2 && typeof value2 === "object" && !Array.isArray(value2);
}
function serializeSubwindowZoomPrefBlock(rt) {
  if (rt.subwindowZoomSteps.size === 0) return null;
  return JSON.stringify({ v: 2, panels: subwindowZoomPreferenceEntries(rt) });
}
function parseSubwindowZoomPrefBlock(text) {
  try {
    const parsed = JSON.parse(text);
    if (!isRecord2(parsed) || !isRecord2(parsed.panels)) return null;
    const panels = {};
    if (parsed.v === 1) {
      for (const [id, step] of Object.entries(parsed.panels)) {
        if (id.length === 0 || typeof step !== "number" || !Number.isInteger(step) || step < 0 || step >= SUBWINDOW_ZOOM_CELL_HEIGHTS.length) {
          return null;
        }
        panels[id] = { step, manual: true };
      }
      return { panels };
    }
    if (parsed.v !== 2) return null;
    for (const [id, value2] of Object.entries(parsed.panels)) {
      if (id.length === 0 || !isRecord2(value2) || typeof value2.step !== "number" || !Number.isInteger(value2.step) || value2.step < 0 || value2.step >= SUBWINDOW_ZOOM_CELL_HEIGHTS.length || typeof value2.manual !== "boolean") {
        return null;
      }
      panels[id] = { step: value2.step, manual: value2.manual };
    }
    return { panels };
  } catch {
    return null;
  }
}
function applySubwindowZoomPrefBlock(rt, value2) {
  for (const [id, { step, manual }] of Object.entries(value2.panels)) {
    rt.subwindowZoomSteps.set(id, step);
    if (manual) rt.subwindowZoomManual.add(id);
    else rt.subwindowZoomManual.delete(id);
    rt.restoredSubwindowZoomPanels.delete(id);
  }
  syncSubwindowControls(rt);
  writePreference(rt);
}
function responsiveSidebarColumns(scale) {
  return Math.max(6, Math.round(13 * scale) - 1);
}
function defaultPlayFillCellHeight(surface, sidebarColumns) {
  let cellHeight = Math.max(
    8,
    Math.min(PLAY_ZOOM_CELL_HEIGHTS.at(-1) ?? 128, Math.floor(surface.height / DEFAULT_PLAY_GRID_ROWS))
  );
  const requiredColumns = sidebarColumns + DEFAULT_PLAY_MAP_COLS + RESERVED_RIGHT_COLUMN;
  while (cellHeight > 8) {
    const cellWidth = Math.max(4, Math.round(FONT_16X24.w / FONT_16X24.h * cellHeight));
    if (Math.floor(surface.width / cellWidth) >= requiredColumns) return cellHeight;
    cellHeight -= 1;
  }
  return 8;
}
function subwindowAutoFitIndex(bounds) {
  for (let i = SUBWINDOW_ZOOM_CELL_HEIGHTS.length - 1; i >= 0; i--) {
    const cellHeight = SUBWINDOW_ZOOM_CELL_HEIGHTS[i];
    if (cellHeight === void 0) continue;
    const cellWidth = Math.max(4, Math.round(FONT_16X24.w / FONT_16X24.h * cellHeight));
    const cols = Math.floor(bounds.width / cellWidth);
    const rows = Math.floor(bounds.height / cellHeight);
    if (cols >= SUBWINDOW_ZOOM_MIN_COLS && rows >= SUBWINDOW_ZOOM_MIN_ROWS) return i;
  }
  return 0;
}
function responsiveSurfaceFor(snapshot) {
  return snapshot.surface ? { width: snapshot.surface.width, height: snapshot.surface.height } : typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : null;
}
function sameResponsiveSurface(left, right) {
  return left !== null && right !== null && left.width === right.width && left.height === right.height;
}
function applyGridAndSidebar(rt) {
  const requestedCellHeight = PLAY_ZOOM_CELL_HEIGHTS[rt.preference.zoomIndex] ?? 28;
  const scale = INTERFACE_ZOOM_SCALES[rt.preference.interfaceZoomIndex] ?? 1;
  const snapshot = rt.display.snapshot();
  const surface = snapshot.surface;
  rt.responsiveSurface = responsiveSurfaceFor(snapshot);
  const sidebarColumns = responsiveSidebarColumns(scale);
  const sidebarVisible = rt.sidebarLayout !== "none";
  const sidebarColumnsReserved = rt.sidebarLayout === "left" ? sidebarColumns : 0;
  const narrow = surface?.width !== void 0 ? surface.width < 480 : typeof window !== "undefined" && window.innerWidth < 480;
  const defaultFill = !narrow && rt.useDefaultPlayFill && surface ? defaultPlayFillCellHeight(surface, sidebarColumnsReserved) : requestedCellHeight;
  const cellHeight = narrow ? Math.min(21, defaultFill) : defaultFill;
  rt.display.setGrid({
    cellHeight,
    /* The phone floor leaves room for complete short footer prompts and menu
     * labels. Roomy views keep the larger-cell 20-column zoom ceiling. */
    minCols: narrow ? 24 : 20,
    minRows: 12,
    snapViewportToEven: true
  });
  rt.display.setSidebarExtent(sidebarVisible ? {
    columns: sidebarColumns,
    topRows: Math.max(1, Math.ceil(scale))
  } : null);
}
function activateGameplayGrid(rt, action) {
  if (action) rt.activationActions.push(action);
  if (rt.gridActive) {
    for (const pending of rt.activationActions.splice(0)) pending();
    return;
  }
  if (rt.activationTimer !== null) return;
  rt.activationTimer = setTimeout(() => {
    rt.activationTimer = null;
    if (runtime !== rt) return;
    rt.gridActive = true;
    markGridState("game");
    applyGridAndSidebar(rt);
    rt.display.repaint();
    rt.sidebarVisibilityTimer = setInterval(() => syncSidebarVisibility(rt), 200);
    for (const pending of rt.activationActions.splice(0)) pending();
  }, 0);
}
function applyMapPreference(rt) {
  const snapshot = rt.display.snapshot();
  if (snapshot.mode !== "map") return;
  rt.display.setMapView(mapViewFor(snapshot, rt.preference.mapDetail, playerCenter(rt, snapshot)));
}
function zoomView(rt, direction) {
  if (!rt.gridActive) return;
  const snapshot = rt.display.snapshot();
  if (snapshot.mode === "map") {
    const next = stepIndex(rt.preference.mapDetail, direction, MAP_DETAIL_FACTORS.length - 1);
    if (next === rt.preference.mapDetail) return;
    rt.preference = { ...rt.preference, mapDetail: next };
    applyMapPreference(rt);
  } else {
    rt.useDefaultPlayFill = false;
    const next = stepIndex(
      rt.preference.zoomIndex,
      direction,
      PLAY_ZOOM_CELL_HEIGHTS.length - 1
    );
    if (next === rt.preference.zoomIndex) return;
    rt.preference = { ...rt.preference, zoomIndex: next };
    rt.display.setCamera(null);
    applyGridAndSidebar(rt);
  }
  writePreference(rt);
}
function zoomInterface(rt, direction) {
  if (!rt.gridActive) return;
  const next = stepIndex(
    rt.preference.interfaceZoomIndex,
    direction,
    INTERFACE_ZOOM_SCALES.length - 1
  );
  if (next === rt.preference.interfaceZoomIndex) return;
  rt.preference = { ...rt.preference, interfaceZoomIndex: next };
  applyGridAndSidebar(rt);
  writePreference(rt);
}
function subwindowZoomIndex(rt, panel) {
  const remembered = rt.subwindowZoomSteps.get(panel.id);
  if (remembered !== void 0) return remembered;
  let closest = 0;
  for (let i = 1; i < SUBWINDOW_ZOOM_CELL_HEIGHTS.length; i++) {
    const candidate = SUBWINDOW_ZOOM_CELL_HEIGHTS[i];
    const current = SUBWINDOW_ZOOM_CELL_HEIGHTS[closest];
    if (candidate !== void 0 && current !== void 0 && Math.abs(candidate - panel.grid.cellHeight) < Math.abs(current - panel.grid.cellHeight)) {
      closest = i;
    }
  }
  rt.subwindowZoomSteps.set(panel.id, closest);
  return closest;
}
function zoomSubwindow(rt, id, direction) {
  const subwindows = rt.ctx.subwindows;
  const panel = subwindows?.list().find((candidate) => candidate.id === id);
  if (!subwindows || !panel) return;
  const current = subwindowZoomIndex(rt, panel);
  const next = stepIndex(current, direction, SUBWINDOW_ZOOM_CELL_HEIGHTS.length - 1);
  if (next === current) return;
  const cellHeight = SUBWINDOW_ZOOM_CELL_HEIGHTS[next];
  if (cellHeight === void 0) return;
  rt.subwindowZoomSteps.set(id, next);
  rt.subwindowZoomManual.add(id);
  rt.restoredSubwindowZoomPanels.add(id);
  subwindows.setGrid(id, {
    cellHeight,
    minCols: SUBWINDOW_ZOOM_MIN_COLS,
    minRows: SUBWINDOW_ZOOM_MIN_ROWS,
    snapViewportToEven: false
  });
  writePreference(rt);
}
function restoreSubwindowZoom(rt, panel) {
  if (rt.restoredSubwindowZoomPanels.has(panel.id)) return;
  const step = rt.subwindowZoomSteps.get(panel.id);
  const cellHeight = step === void 0 ? void 0 : SUBWINDOW_ZOOM_CELL_HEIGHTS[step];
  if (cellHeight === void 0) return;
  rt.restoredSubwindowZoomPanels.add(panel.id);
  rt.ctx.subwindows?.setGrid(panel.id, {
    cellHeight,
    minCols: SUBWINDOW_ZOOM_MIN_COLS,
    minRows: SUBWINDOW_ZOOM_MIN_ROWS,
    snapViewportToEven: false
  });
}
function autoFitSubwindowZoom(rt, panel) {
  const size = { width: panel.bounds.width, height: panel.bounds.height };
  const previous = rt.subwindowPanelSizes.get(panel.id);
  rt.subwindowPanelSizes.set(panel.id, size);
  if (previous === void 0) return;
  if (previous.width === size.width && previous.height === size.height) return;
  if (rt.subwindowZoomManual.has(panel.id)) return;
  const next = subwindowAutoFitIndex(size);
  if (rt.subwindowZoomSteps.get(panel.id) === next) return;
  const cellHeight = SUBWINDOW_ZOOM_CELL_HEIGHTS[next];
  if (cellHeight === void 0) return;
  rt.subwindowZoomSteps.set(panel.id, next);
  rt.restoredSubwindowZoomPanels.add(panel.id);
  rt.ctx.subwindows?.setGrid(panel.id, {
    cellHeight,
    minCols: SUBWINDOW_ZOOM_MIN_COLS,
    minRows: SUBWINDOW_ZOOM_MIN_ROWS,
    snapViewportToEven: false
  });
  writePreference(rt);
}
function focusedSubwindow(rt) {
  return rt.ctx.subwindows?.list().find((panel) => panel.focused);
}
function hoveredSubwindow(rt, x, y) {
  return rt.ctx.subwindows?.list().find((panel) => pointInPixels(x, y, panel.bounds));
}
function clearSubwindowControls(rt) {
  for (const cleanups of rt.subwindowControlCleanups.values()) {
    for (const cleanup of cleanups) cleanup();
  }
  rt.subwindowControlCleanups.clear();
}
function syncSubwindowControls(rt) {
  const subwindows = rt.ctx.subwindows;
  if (!subwindows) {
    clearSubwindowControls(rt);
    return;
  }
  const panels = subwindows.list();
  const visible = new Set(panels.map((panel) => panel.id));
  for (const [id, cleanups] of rt.subwindowControlCleanups) {
    if (!visible.has(id)) {
      for (const cleanup of cleanups) cleanup();
      rt.subwindowControlCleanups.delete(id);
      rt.restoredSubwindowZoomPanels.delete(id);
      rt.subwindowPanelSizes.delete(id);
    }
  }
  for (const panel of panels) {
    restoreSubwindowZoom(rt, panel);
    autoFitSubwindowZoom(rt, panel);
    if (rt.subwindowControlCleanups.has(panel.id)) continue;
    const zoomOut = subwindows.addControl(panel.id, "zoom-out", {
      glyph: "-",
      title: "Zoom out",
      onActivate: () => zoomSubwindow(rt, panel.id, -1)
    });
    const zoomIn = subwindows.addControl(panel.id, "zoom-in", {
      glyph: "+",
      title: "Zoom in",
      onActivate: () => zoomSubwindow(rt, panel.id, 1)
    });
    rt.subwindowControlCleanups.set(panel.id, [zoomOut, zoomIn]);
  }
}
function installSubwindowControls(rt) {
  if (!rt.ctx.subwindows) return;
  syncSubwindowControls(rt);
  rt.subwindowControlsTimer = setInterval(() => syncSubwindowControls(rt), 200);
}
function installSubwindowZoomPrefBlock(rt) {
  const subwindows = rt.ctx.subwindows;
  if (!subwindows) return;
  rt.cleanups.push(subwindows.registerPrefBlock(SUBWINDOW_ZOOM_PREF_BLOCK_NAME, {
    serialize: () => serializeSubwindowZoomPrefBlock(rt),
    parse: parseSubwindowZoomPrefBlock,
    apply: (value2) => applySubwindowZoomPrefBlock(rt, value2)
  }));
}
function panView(rt, dx, dy) {
  if (!rt.gridActive) return;
  let snapshot = rt.display.snapshot();
  if (snapshot.mode === "map" && rt.preference.mapDetail === 0) {
    rt.preference = { ...rt.preference, mapDetail: 1 };
    applyMapPreference(rt);
    writePreference(rt);
    snapshot = rt.display.snapshot();
  }
  const origin = pannedOrigin(snapshot, dx, dy);
  if (snapshot.mode === "map") {
    rt.display.setMapView({ origin, size: snapshot.viewport.size });
  } else {
    rt.display.setCamera(origin);
  }
}
function zoomKeyDirection(event) {
  if (event.key === "+" || event.key === "=" || event.key === "Add") return 1;
  if (event.key === "-" || event.key === "_" || event.key === "Subtract") return -1;
  return 0;
}
function directionKey(event) {
  const directions = {
    ArrowLeft: { x: -2, y: 0 },
    ArrowRight: { x: 2, y: 0 },
    ArrowUp: { x: 0, y: -2 },
    ArrowDown: { x: 0, y: 2 }
  };
  return directions[event.key] ?? null;
}
function installKeyboard(rt) {
  rt.cleanups.push(
    rt.display.onKey((event) => {
      const zoom = event.ctrlKey && !event.altKey && !event.metaKey ? zoomKeyDirection(event) : 0;
      const direction = event.ctrlKey && !event.altKey && !event.metaKey ? directionKey(event) : null;
      if (!rt.gridActive && rt.bootPhase !== "game-pending") return;
      const focused = zoom !== 0 ? focusedSubwindow(rt) : void 0;
      if (zoom !== 0 && focused) {
        event.preventDefault();
        event.stopImmediatePropagation();
        zoomSubwindow(rt, focused.id, zoom);
        return;
      }
      if (zoom !== 0 || direction !== null) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const action = () => {
          if (zoom !== 0) {
            if (event.shiftKey) zoomInterface(rt, zoom);
            else zoomView(rt, zoom);
          } else if (direction) {
            panView(rt, direction.x, direction.y);
          }
        };
        if (!rt.gridActive) {
          markGridState("game-pending:display-shortcut");
          activateGameplayGrid(rt, action);
        } else {
          action();
        }
        return;
      }
      if (!rt.gridActive) {
        markGridState("game-pending:display-key");
        activateGameplayGrid(rt);
        return;
      }
      const modalKey = !event.altKey && !event.metaKey && (!event.ctrlKey && ["?", "C", "i", "e", "~", "=", "Escape"].includes(event.key) || event.ctrlKey && event.key.toLowerCase() === "p");
      if (modalKey && rt.display.snapshot().mode !== "map") {
        hideSidebar(rt);
        scheduleScreenFit(rt);
      }
      if (!event.ctrlKey || event.altKey || event.metaKey) {
        if (event.key === "M") {
          setTimeout(() => {
            applyMapPreference(rt);
            syncSidebarVisibility(rt);
          }, 0);
        } else if (rt.display.snapshot().mode === "map") {
          setTimeout(() => syncSidebarVisibility(rt), 0);
        }
        return;
      }
    })
  );
}
function scheduleScreenFit(rt) {
  if (rt.screenFitTimer !== null) clearTimeout(rt.screenFitTimer);
  rt.screenFitTimer = setTimeout(() => {
    rt.screenFitTimer = null;
    if (runtime !== rt || !rt.gridActive) return;
    rt.screenFitActive = true;
    hideSidebar(rt);
    rt.display.setGrid(null);
  }, 0);
}
function installTitleBoundary(rt) {
  const onKey = (event) => {
    if (rt.gridActive || event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (rt.bootPhase === "title") {
      if (key === "n") rt.bootPhase = "birth";
      else if (key === "l" || key === "r") rt.bootPhase = "game-pending";
      markGridState(rt.bootPhase);
      return;
    }
    if (rt.bootPhase === "birth") {
      if (key === "c") rt.bootPhase = "name";
      else if (key === "y") rt.bootPhase = "game-pending";
      markGridState(rt.bootPhase);
      return;
    }
    if (rt.bootPhase === "name" && (key === "enter" || key === "escape")) {
      rt.bootPhase = "birth";
      markGridState(rt.bootPhase);
    }
  };
  rt.cleanups.push(rt.display.onKey(onKey));
}
function installWheel(rt) {
  const onWheel = (event) => {
    if (!event.ctrlKey || event.deltaY === 0) return;
    if (!rt.gridActive && rt.bootPhase !== "game-pending") return;
    const hovered = hoveredSubwindow(rt, event.clientX, event.clientY);
    if (hovered) {
      event.preventDefault();
      event.stopImmediatePropagation();
      zoomSubwindow(rt, hovered.id, event.deltaY < 0 ? 1 : -1);
      return;
    }
    const snapshot = rt.display.snapshot();
    const sidebar = snapshot.regions.sidebar?.pixels;
    event.preventDefault();
    event.stopImmediatePropagation();
    const direction = event.deltaY < 0 ? 1 : -1;
    const action = pointInPixels(event.clientX, event.clientY, sidebar) ? () => zoomInterface(rt, direction) : () => zoomView(rt, direction);
    if (!rt.gridActive) {
      markGridState("game-pending:wheel");
      activateGameplayGrid(rt, action);
    } else {
      action();
    }
  };
  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  rt.cleanups.push(() => window.removeEventListener("wheel", onWheel, true));
}
function touchPair(rt) {
  const points = [...rt.touches.values()];
  return points.length === 2 && points[0] && points[1] ? [points[0], points[1]] : null;
}
function pairMetrics(pair) {
  const [a, b] = pair;
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  };
}
function installTouch(rt) {
  const onDown = (event) => {
    if (event.pointerType !== "touch") return;
    rt.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pair = touchPair(rt);
    if (!pair) return;
    const metrics = pairMetrics(pair);
    const sidebar = rt.display.snapshot().regions.sidebar?.pixels;
    rt.gesture = {
      context: pointInPixels(metrics.center.x, metrics.center.y, sidebar) ? "sidebar" : "view",
      ...metrics
    };
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onMove = (event) => {
    if (!rt.touches.has(event.pointerId)) return;
    rt.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pair = touchPair(rt);
    const gesture = rt.gesture;
    if (!pair || !gesture) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const next = pairMetrics(pair);
    const pinch = pinchDirection(gesture.distance, next.distance);
    if (pinch !== 0) {
      if (gesture.context === "sidebar") zoomInterface(rt, pinch);
      else zoomView(rt, pinch);
      gesture.distance = next.distance;
    }
    const dx = next.center.x - gesture.center.x;
    const dy = next.center.y - gesture.center.y;
    if (gesture.context === "sidebar") {
      if (rt.sidebar && (Math.abs(dx) >= 32 || Math.abs(dy) >= 32)) {
        turnSidebarPage(rt, Math.abs(dx) >= Math.abs(dy) ? -Math.sign(dx) : -Math.sign(dy));
        gesture.center = next.center;
      }
      return;
    }
    const snapshot = rt.display.snapshot();
    const cellX = Math.abs(dx) >= snapshot.grid.cellWidth * 1.25 ? snapEven(-dx / snapshot.grid.cellWidth) : 0;
    const cellY = Math.abs(dy) >= snapshot.grid.cellHeight * 1.25 ? snapEven(-dy / snapshot.grid.cellHeight) : 0;
    if (cellX !== 0 || cellY !== 0) {
      panView(rt, cellX, cellY);
      gesture.center = next.center;
    }
  };
  const onEnd = (event) => {
    rt.touches.delete(event.pointerId);
    if (rt.touches.size < 2) rt.gesture = null;
  };
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointermove", onMove, { capture: true, passive: false });
  window.addEventListener("pointerup", onEnd, true);
  window.addEventListener("pointercancel", onEnd, true);
  rt.cleanups.push(() => {
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onEnd, true);
    window.removeEventListener("pointercancel", onEnd, true);
  });
}
function installResponsiveMap(rt) {
  let timer2 = null;
  const onResize = () => {
    if (timer2 !== null) clearTimeout(timer2);
    timer2 = setTimeout(() => {
      timer2 = null;
      if (runtime !== rt) return;
      if (!rt.gridActive) {
        rt.display.setGrid(null);
        return;
      }
      if (rt.screenFitActive) {
        rt.display.setGrid(null);
        return;
      }
      const snapshot = rt.display.snapshot();
      const surface = responsiveSurfaceFor(snapshot);
      if (sameResponsiveSurface(surface, rt.responsiveSurface)) return;
      if (snapshot.mode === "map") {
        rt.responsiveSurface = surface;
        const center = {
          x: snapshot.viewport.origin.x + Math.floor(snapshot.viewport.size.width / 2),
          y: snapshot.viewport.origin.y + Math.floor(snapshot.viewport.size.height / 2)
        };
        rt.display.setMapView(mapViewFor(snapshot, rt.preference.mapDetail, center));
      } else {
        applyGridAndSidebar(rt);
        rt.display.repaint();
      }
    }, 0);
  };
  window.addEventListener("resize", onResize);
  rt.cleanups.push(() => {
    window.removeEventListener("resize", onResize);
    if (timer2 !== null) clearTimeout(timer2);
  });
}
function createSidebar(rt) {
  if (typeof document === "undefined" || !document.body) return null;
  const playView = document.getElementById("game-view");
  if (!playView) return null;
  const host = document.createElement("div");
  host.setAttribute("data-anybandui-responsive-sidebar", "");
  host.setAttribute("role", "complementary");
  host.setAttribute("aria-label", "Character status");
  Object.assign(host.style, {
    position: "absolute",
    zIndex: "1",
    boxSizing: "border-box",
    overflow: "hidden",
    overscrollBehavior: "contain",
    pointerEvents: "auto",
    background: "rgba(0,0,0,0.96)",
    color: "#c8c8d4",
    scrollbarWidth: "none"
  });
  const body = document.createElement("div");
  host.appendChild(body);
  playView.appendChild(host);
  rt.cleanups.push(() => host.remove());
  return {
    host,
    body,
    page: 0,
    layout: "none",
    entryCount: 0,
    section: null,
    frame: null
  };
}
function hidesSidebar(mode) {
  return mode === "map" || mode === "store" || mode === "modal";
}
function syncSidebarVisibility(rt) {
  if (!rt.sidebar) return;
  rt.sidebar.host.style.display = hidesSidebar(rt.display.snapshot().mode) ? "none" : "block";
}
function hideSidebar(rt) {
  if (rt.sidebar) rt.sidebar.host.style.display = "none";
}
function turnSidebarPage(rt, direction) {
  const sidebar = rt.sidebar;
  if (!sidebar?.section || !sidebar.frame) return;
  const pixels = sidebar.section.region?.pixels;
  if (!pixels) return;
  const scale = INTERFACE_ZOOM_SCALES[rt.preference.interfaceZoomIndex] ?? 1;
  const plan = sidebarPagePlan(sidebar.entryCount, sidebar.layout, pixels, scale, sidebar.page);
  if (plan.pages <= 1) return;
  sidebar.page = (plan.page + Math.sign(direction) + plan.pages) % plan.pages;
  paintSidebar(rt, sidebar.section, sidebar.frame);
}
function paintSidebar(rt, section2, frame) {
  const layoutChanged = rt.sidebarLayout !== frame.layout;
  rt.sidebarLayout = frame.layout;
  if (!rt.gridActive) {
    if (rt.bootPhase === "game-pending") activateGameplayGrid(rt);
    return;
  }
  if (layoutChanged) {
    applyGridAndSidebar(rt);
    rt.display.repaint();
  }
  if (rt.screenFitActive) {
    rt.screenFitActive = false;
    applyGridAndSidebar(rt);
    rt.display.repaint();
    return;
  }
  rt.sidebar ??= createSidebar(rt);
  const sidebar = rt.sidebar;
  const pixels = section2.region?.pixels;
  const surface = rt.display.snapshot().surface;
  if (!sidebar || !pixels || !surface || frame.layout === "none" || hidesSidebar(rt.display.snapshot().mode)) {
    if (sidebar) sidebar.host.style.display = "none";
    return;
  }
  const scale = INTERFACE_ZOOM_SCALES[rt.preference.interfaceZoomIndex] ?? 1;
  if (sidebar.layout !== frame.layout || sidebar.entryCount !== section2.entries.length) {
    sidebar.page = 0;
  }
  sidebar.layout = frame.layout;
  sidebar.entryCount = section2.entries.length;
  sidebar.section = section2;
  sidebar.frame = frame;
  const plan = sidebarPagePlan(section2.entries.length, frame.layout, pixels, scale, sidebar.page);
  sidebar.page = plan.page;
  const visible = section2.entries.slice(plan.start, plan.end);
  let cellHeight = plan.fontSize * 1.25;
  let cellWidth = cellHeight * (FONT_16X24.w / FONT_16X24.h);
  if (frame.layout !== "top") {
    let totalRows = 0;
    let maxChars = 0;
    let scanRow = null;
    for (const entry2 of visible) {
      totalRows += sidebarRowGap(frame.layout, scanRow, entry2.screen?.row) + 1;
      if (entry2.screen) scanRow = entry2.screen.row;
      maxChars = Math.max(maxChars, entry2.runs.reduce((n, run2) => n + [...run2.text].length, 0));
    }
    const heightScale = pixels.height / Math.max(1, totalRows * cellHeight);
    const widthScale = pixels.width / Math.max(1, maxChars * cellWidth);
    const shrink = Math.min(1, heightScale, widthScale);
    if (shrink < 1) {
      cellHeight *= shrink;
      cellWidth *= shrink;
    }
  }
  Object.assign(sidebar.host.style, {
    display: "block",
    left: `${String(pixels.x - surface.x)}px`,
    top: `${String(pixels.y - surface.y)}px`,
    width: `${String(pixels.width)}px`,
    height: `${String(pixels.height)}px`,
    /* Still the em basis for the layout below's gap/padding - only the
     * glyph cells themselves are sized from cellWidth/cellHeight now. */
    fontSize: `${String(cellHeight / 1.25)}px`,
    lineHeight: "1.25"
  });
  Object.assign(sidebar.body.style, {
    display: frame.layout === "top" ? "flex" : "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    /* Rows are auto-sized (one line of vitals text each), and with no
     * alignContent a CSS grid stretches those auto tracks to fill its own
     * height:100% - which on a tall "left" sidebar spread thirteen one-line
     * rows across the whole window height instead of packing them at the
     * top the way the original terminal layout does. "start" packs each row
     * at its own content height, matching vanilla Angband's tight vitals
     * column; the "top" strip is unaffected, since flex containers were
     * never subject to this in the first place. */
    alignContent: frame.layout === "top" ? "normal" : "start",
    alignItems: "center",
    justifyContent: frame.layout === "top" ? "space-between" : "normal",
    gap: frame.layout === "top" ? "0 0.55em" : "0.2em",
    padding: frame.layout === "top" ? "0.25em 0.5em" : "0.4em 0.55em",
    width: "100%",
    height: "100%",
    minWidth: "0",
    overflow: "hidden",
    boxSizing: "border-box"
  });
  sidebar.body.replaceChildren();
  const dpr = window.devicePixelRatio || 1;
  let previousRow = null;
  for (const entry2 of visible) {
    const skipped = sidebarRowGap(frame.layout, previousRow, entry2.screen?.row);
    for (let i = 0; i < skipped; i++) {
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      spacer.style.height = "1em";
      sidebar.body.appendChild(spacer);
    }
    if (entry2.screen) previousRow = entry2.screen.row;
    const row = document.createElement("div");
    row.setAttribute("data-anybandui-vital", entry2.key);
    row.title = entry2.key;
    Object.assign(row.style, {
      minWidth: "0",
      overflow: "hidden",
      flex: "0 1 auto"
    });
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { display: "block" });
    paintBitmapLine(canvas, entry2.runs, cellWidth, cellHeight, dpr);
    row.appendChild(canvas);
    const label2 = document.createElement("span");
    label2.textContent = entry2.runs.map((run2) => run2.text).join("");
    Object.assign(label2.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clip: "rect(0,0,0,0)",
      whiteSpace: "nowrap"
    });
    row.appendChild(label2);
    sidebar.body.appendChild(row);
  }
  if (plan.pages > 1) {
    const button7 = document.createElement("button");
    button7.type = "button";
    button7.setAttribute("data-anybandui-sidebar-page", "");
    button7.setAttribute("aria-label", `Show status page ${String((plan.page + 1) % plan.pages + 1)} of ${String(plan.pages)}`);
    Object.assign(button7.style, {
      appearance: "none",
      background: "transparent",
      border: "1px solid #686878",
      borderRadius: "2px",
      cursor: "pointer",
      flex: "0 0 auto",
      lineHeight: "inherit",
      padding: "0 0.35em"
    });
    paintBitmapButtonLabel(
      button7,
      `${String(plan.page + 1)}/${String(plan.pages)} >`,
      "#d8d87c",
      cellWidth,
      cellHeight,
      dpr
    );
    button7.addEventListener("click", () => turnSidebarPage(rt, 1));
    sidebar.body.appendChild(button7);
  }
}
function cameraOrigin(snapshot, point) {
  return pannedOrigin(
    snapshot,
    point.x - snapshot.viewport.origin.x - Math.floor(snapshot.viewport.size.width / 2),
    point.y - snapshot.viewport.origin.y - Math.floor(snapshot.viewport.size.height / 2)
  );
}
function installFreeCamera(rt) {
  const flags = rt.ctx.flags;
  if (!flags["anybandui.dragPan"] && !flags["anybandui.followPlayer"] && !flags["anybandui.keepTargetInView"] && !flags["anybandui.recentreOnFloor"]) return;
  if (flags["anybandui.keepTargetInView"] && !rt.ctx.snapshot) rt.ctx.log?.("keep target in view: interaction snapshot unavailable");
  rt.cleanups.push(rt.display.onKey((event) => {
    if (flags["anybandui.followPlayer"] && event.ctrlKey && event.key === "Home") {
      rt.cameraDetached = false;
      const player = playerGrid(rt.ctx);
      if (player) rt.display.setCamera(cameraOrigin(rt.display.snapshot(), player));
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (flags["anybandui.followPlayer"] && event.ctrlKey && event.key.startsWith("Arrow")) {
      rt.cameraDetached = true;
    }
  }));
  let down = null;
  if (flags["anybandui.dragPan"] && typeof window !== "undefined") {
    const onDown = (event) => {
      if (event.button !== 0 || rt.display.snapshot().mode !== "play") return;
      const map = rt.display.snapshot().regions.map?.pixels;
      if (pointInPixels(event.clientX, event.clientY, map)) down = { x: event.clientX, y: event.clientY };
    };
    const onMove = (event) => {
      if (!down) return;
      const snap = rt.display.snapshot();
      const dx = Math.trunc((down.x - event.clientX) / snap.grid.cellWidth);
      const dy = Math.trunc((down.y - event.clientY) / snap.grid.cellHeight);
      if (!dx && !dy) return;
      rt.display.setCamera(pannedOrigin(snap, dx, dy));
      rt.cameraDetached = true;
      down = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    };
    const onUp = () => {
      down = null;
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    rt.cleanups.push(() => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
    });
  }
  rt.cameraTimer = setInterval(() => {
    const snap = rt.display.snapshot();
    const player = playerGrid(rt.ctx);
    if (flags["anybandui.recentreOnFloor"]) {
      const floor = levelKey(rt.ctx);
      const key = floor === void 0 ? null : String(floor);
      if (rt.lastFloor !== null && key !== rt.lastFloor && player) {
        rt.cameraDetached = false;
        rt.display.setCamera(cameraOrigin(snap, player));
      }
      rt.lastFloor = key;
    }
    const target = viewInput(rt.ctx)?.prompt?.cursor;
    if (flags["anybandui.keepTargetInView"] && target && (target.x < snap.viewport.origin.x || target.y < snap.viewport.origin.y || target.x >= snap.viewport.origin.x + snap.viewport.size.width || target.y >= snap.viewport.origin.y + snap.viewport.size.height)) {
      rt.display.setCamera(cameraOrigin(snap, target));
    } else if (flags["anybandui.followPlayer"] && !rt.cameraDetached && player && snap.mode === "play" && (player.x < snap.viewport.origin.x + 2 || player.y < snap.viewport.origin.y + 2 || player.x >= snap.viewport.origin.x + snap.viewport.size.width - 2 || player.y >= snap.viewport.origin.y + snap.viewport.size.height - 2)) {
      rt.display.setCamera(cameraOrigin(snap, player));
    }
  }, 100);
}
function installZoomPan(ctx) {
  uninstallZoomPan();
  const display = ctx.display;
  const enabled = ctx.flags["anybandui.zoom"] === true || ctx.flags["anybandui.enlargedDisplay"] === true;
  const cameraEnabled = ctx.flags["anybandui.dragPan"] || ctx.flags["anybandui.followPlayer"] || ctx.flags["anybandui.keepTargetInView"] || ctx.flags["anybandui.recentreOnFloor"];
  if (!display) {
    if (enabled || cameraEnabled) ctx.log?.("this game is too old for display conveniences");
    return;
  }
  if (ctx.flags["anybandui.crispTiles"] === true && ctx.manageTileSettings !== false) {
    display.setTileScaling("crisp");
    configuredTileDisplay = display;
    if (display.setFullMapOverview) {
      display.setFullMapOverview(true);
      fullOverviewApplied = true;
    }
  }
  if (!enabled && !cameraEnabled) return;
  const appliedDisplaySettings = /* @__PURE__ */ new Set();
  const storedSubwindowZoom = readSubwindowZoomPreference(ctx.prefs?.get());
  const rt = {
    ctx,
    display: keepsDisplayRequestsPerMod(display) ? display : trackedDisplay(display, appliedDisplaySettings),
    preference: {
      ...readDisplayPreference(ctx.prefs?.get()),
      ...ctx.flags["anybandui.enlargedDisplay"] === true ? { zoomIndex: Math.max(readDisplayPreference(ctx.prefs?.get()).zoomIndex, ACCESSIBILITY_ZOOM_INDEX) } : {}
    },
    useDefaultPlayFill: ctx.flags["anybandui.enlargedDisplay"] !== true && readDisplayPreference(ctx.prefs?.get()).zoomIndex === DEFAULT_DISPLAY_PREFERENCE.zoomIndex,
    cleanups: [],
    touches: /* @__PURE__ */ new Map(),
    gesture: null,
    sidebar: null,
    sidebarLayout: "left",
    gridActive: false,
    bootPhase: initialBootPhase(),
    activationTimer: null,
    activationActions: [],
    screenFitActive: false,
    screenFitTimer: null,
    responsiveSurface: null,
    sidebarVisibilityTimer: null,
    subwindowZoomSteps: new Map(
      Object.entries(storedSubwindowZoom).filter(([, value2]) => value2.step < SUBWINDOW_ZOOM_CELL_HEIGHTS.length).map(([id, value2]) => [id, value2.step])
    ),
    subwindowZoomManual: new Set(
      Object.entries(storedSubwindowZoom).filter(([, value2]) => value2.manual && value2.step < SUBWINDOW_ZOOM_CELL_HEIGHTS.length).map(([id]) => id)
    ),
    subwindowPanelSizes: /* @__PURE__ */ new Map(),
    restoredSubwindowZoomPanels: /* @__PURE__ */ new Set(),
    subwindowControlCleanups: /* @__PURE__ */ new Map(),
    subwindowControlsTimer: null,
    cameraTimer: null,
    cameraDetached: false,
    lastFloor: null,
    appliedDisplaySettings
  };
  runtime = rt;
  if (enabled) markGridState(rt.bootPhase);
  if (enabled && typeof document !== "undefined" && document.body) {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const htmlBackground = document.documentElement.style.backgroundColor;
    const bodyBackground = document.body.style.backgroundColor;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.backgroundColor = "#000";
    document.body.style.backgroundColor = "#000";
    rt.cleanups.push(() => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.backgroundColor = htmlBackground;
      document.body.style.backgroundColor = bodyBackground;
    });
  }
  if (enabled) installKeyboard(rt);
  installFreeCamera(rt);
  if (enabled) {
    installSubwindowZoomPrefBlock(rt);
    installSubwindowControls(rt);
  }
  if (enabled && typeof window !== "undefined") {
    installTitleBoundary(rt);
    installWheel(rt);
    installTouch(rt);
    installResponsiveMap(rt);
  }
}
function zoomPanHud(ctx) {
  if (ctx.flags["anybandui.zoom"] !== true && ctx.flags["anybandui.enlargedDisplay"] !== true || !runtime) {
    return void 0;
  }
  const rt = runtime;
  return { sidebar: { present: (section2, frame) => {
    if (ctx.flags["anybandui.sidebar"] === true) {
      rt.sidebarLayout = frame.layout;
      if (!rt.gridActive && rt.bootPhase === "game-pending") activateGameplayGrid(rt);
      return;
    }
    paintSidebar(rt, section2, frame);
  } } };
}
function uninstallZoomPan() {
  if (configuredTileDisplay) releaseTileSettings(configuredTileDisplay, fullOverviewApplied);
  configuredTileDisplay = null;
  fullOverviewApplied = false;
  const rt = runtime;
  runtime = null;
  if (!rt) return;
  markGridState("off");
  if (rt.activationTimer !== null) clearTimeout(rt.activationTimer);
  if (rt.screenFitTimer !== null) clearTimeout(rt.screenFitTimer);
  if (rt.sidebarVisibilityTimer !== null) clearInterval(rt.sidebarVisibilityTimer);
  if (rt.subwindowControlsTimer !== null) clearInterval(rt.subwindowControlsTimer);
  if (rt.cameraTimer !== null) clearInterval(rt.cameraTimer);
  clearSubwindowControls(rt);
  for (const cleanup of rt.cleanups.splice(0).reverse()) cleanup();
  if (keepsDisplayRequestsPerMod(rt.display)) {
    rt.display.setMapView(null);
    rt.display.setCamera(null);
    rt.display.setSidebarExtent(null);
    rt.display.setGrid(null);
    return;
  }
  for (const setting of rt.appliedDisplaySettings) {
    if (setting === "setMapView") rt.display.setMapView(null);
    else if (setting === "setCamera") rt.display.setCamera(null);
    else if (setting === "setSidebarExtent") rt.display.setSidebarExtent(null);
    else if (setting === "setGrid") rt.display.setGrid(null);
  }
}

// src/panels/surface.ts
var PANE_FILL_CSS = ":host{display:block;height:100%;overflow:auto}section.pane{position:relative;inset:auto;width:auto;max-width:none;height:auto;max-height:none;overflow:visible}";
function interfaceScale(ctx) {
  if (ctx.flags?.["anybandui.zoom"] !== true) return 1;
  return INTERFACE_ZOOM_SCALES[readDisplayPreference(ctx.prefs?.get()).interfaceZoomIndex] ?? 1;
}
function prepare(ctx, root, css) {
  applyTheme(root, themeFromPrefs(ctx.prefs?.get()));
  const style = root.ownerDocument.createElement("style");
  style.textContent = css;
  root.appendChild(style);
}
function section(root, className) {
  const container = root.ownerDocument.createElement("section");
  container.className = className;
  root.appendChild(container);
  return container;
}
function openSurfaces(ctx, specs, overlay, css, onChange) {
  const entries = /* @__PURE__ */ new Map();
  const themeStops = /* @__PURE__ */ new Set();
  const scale = (container) => {
    container.style.zoom = String(interfaceScale(ctx));
  };
  const register = ctx.ui?.registerPanelKind;
  if (register) {
    const unregister = specs.map((spec) => register({
      kind: spec.key,
      label: spec.label,
      ...spec.tab ? { tab: spec.tab } : {},
      ...spec.minSize ? { minSize: spec.minSize } : {},
      ...spec.placement ? { preferredPlacement: spec.placement } : {},
      ...spec.fitHeight !== void 0 ? { fitHeight: spec.fitHeight } : {},
      mount(host) {
        prepare(ctx, host.root, `${css}${PANE_FILL_CSS}`);
        const stopTheme3 = onThemeChange((theme) => applyTheme(host.root, theme));
        themeStops.add(stopTheme3);
        const entry2 = { container: section(host.root, `${overlay.className} pane`), host, active: host.active, fitted: spec.fitHeight ?? null };
        entries.set(spec.key, entry2);
        let size = `${host.bounds.width}x${host.bounds.height}`;
        const stop = host.onStateChange((state) => {
          const next = `${state.bounds.width}x${state.bounds.height}`;
          if (state.active === entry2.active && next === size) return;
          entry2.active = state.active;
          size = next;
          onChange();
        });
        onChange();
        return () => {
          stop();
          themeStops.delete(stopTheme3);
          stopTheme3();
          entries.delete(spec.key);
          onChange();
        };
      }
    }));
    return {
      mounts: () => new Map([...entries].filter(([, entry2]) => entry2.active).map(([key, entry2]) => {
        scale(entry2.container);
        return [key, entry2.container];
      })),
      fit: (key, px) => {
        const entry2 = entries.get(key);
        const next = Math.ceil(px);
        if (entry2?.host && entry2.fitted !== next) {
          entry2.fitted = next;
          entry2.host.setFitHeight(next);
        }
      },
      focus: (key) => entries.get(key)?.host?.requestFocus(),
      close: () => {
        for (const stop of unregister) stop();
        for (const stopTheme3 of themeStops) stopTheme3();
        themeStops.clear();
        entries.clear();
        onChange();
      }
    };
  }
  if (!ctx.ui?.openPanel) return null;
  const panel = ctx.ui.openPanel({ id: overlay.id, modal: false, label: overlay.label });
  prepare(ctx, panel.root, css);
  const stopTheme2 = onThemeChange((theme) => applyTheme(panel.root, theme));
  for (const spec of specs) entries.set(spec.key, { container: section(panel.root, overlay.className), host: null, active: true, fitted: null });
  let open = true;
  const release = () => {
    if (!open) return;
    open = false;
    stopTheme2();
    entries.clear();
    onChange();
  };
  void panel.closed.then(release);
  return {
    mounts: () => open ? new Map([...entries].map(([key, entry2]) => {
      scale(entry2.container);
      return [key, entry2.container];
    })) : /* @__PURE__ */ new Map(),
    fit: () => {
    },
    focus: () => {
    },
    close: () => {
      if (open) panel.close();
      release();
    }
  };
}

// src/panels/character-pane.ts
var PANE_SIDEBAR_EXTENT = { columns: 0, topRows: 0 };
var PANE_CSS = `:host{display:block;height:100%;color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}${PANEL_CSS}.surface{position:relative}`;
var paneOwnsSidebar = false;
function gateSidebarExtent(display) {
  return new Proxy({}, {
    get(_empty, property) {
      const member = Reflect.get(display, property);
      if (typeof member !== "function") return member;
      if (property !== "setSidebarExtent") return member.bind(display);
      return (extent) => Reflect.apply(member, display, [extent && paneOwnsSidebar ? PANE_SIDEBAR_EXTENT : extent]);
    },
    has: (_empty, property) => Reflect.has(display, property)
  });
}
function installCharacterPane(ctx, panels) {
  if (!ctx.ui?.registerPanelKind) return null;
  let latest;
  const contents = /* @__PURE__ */ new WeakMap();
  let surfaces = null;
  const render = () => {
    if (!latest || !surfaces) return;
    for (const container of surfaces.mounts().values()) {
      let content = contents.get(container);
      if (!content) {
        content = createPanelContent(container, panels);
        contents.set(container, content);
      }
      content.render(latest);
    }
  };
  surfaces = openSurfaces(
    ctx,
    [{
      key: "character",
      label: "Character",
      tab: "Character",
      minSize: { width: 180, height: 160 },
      placement: { kind: "dock", target: "main", edge: "left" }
    }],
    { id: "character", label: "Character", className: "surface" },
    PANE_CSS,
    render
  );
  if (!surfaces) return null;
  const opened = surfaces;
  let claimed = false;
  return {
    claimSidebar() {
      if (claimed) return;
      claimed = true;
      paneOwnsSidebar = true;
      ctx.display?.setSidebarExtent?.(PANE_SIDEBAR_EXTENT);
    },
    paint(model) {
      latest = model;
      render();
    },
    close() {
      opened.close();
      if (claimed) ctx.display?.setSidebarExtent?.(null);
      claimed = false;
      paneOwnsSidebar = false;
      latest = void 0;
    }
  };
}

// src/panels/character-card.ts
function stat(value2) {
  return value2 > 18 ? `18/${String(value2 - 18).padStart(2, "0")}` : String(value2);
}
function renderCharacterCard(mount, model) {
  mount.replaceChildren();
  const p = model.player;
  node(mount, "div", "heading", [p.name || "Adventurer", [p.race, p.class].filter(Boolean).join(" "), p.title].filter(Boolean).join(" - ")).dataset.tip = [p.name || "Adventurer", `Race: ${p.race}`, `Class: ${p.class}`, p.title ? `Title: ${p.title}` : ""].filter(Boolean).join("\n");
  const grid = node(mount, "div", "grid");
  meter(grid, "HP", `${Math.max(0, p.hp)} / ${Math.max(0, p.max_hp)}`, fraction(p.hp, p.max_hp), "#a82630", `HP: ${Math.max(0, p.hp)} / ${Math.max(0, p.max_hp)}`);
  meter(grid, "SP", `${Math.max(0, p.sp)} / ${Math.max(0, p.max_sp)}`, fraction(p.sp, p.max_sp), "#244f9e", `SP: ${Math.max(0, p.sp)} / ${Math.max(0, p.max_sp)}`);
  if (p.food_max !== void 0) {
    const food = `${(p.food_max > 0 ? 100 * p.food / p.food_max : 0).toFixed(1)}% (${p.food})`;
    meter(grid, "Food", food, fraction(p.food, p.food_max), "#246b3b", food);
  } else {
    node(grid, "div", "metric", `Food ${p.food}`);
  }
  if (p.next_level_experience !== void 0) {
    const next = p.next_level_experience;
    const base = p.level_start_experience;
    const progress = next > 0 && base !== void 0 ? fraction(p.experience - base, next - base) : 0;
    const value2 = next <= 0 ? "MAX" : base === void 0 ? `${p.experience} - Lv ${p.level}` : `${Math.round(progress * 100)}% - Lv ${p.level}`;
    const tip2 = [`Level ${p.level}`, `Experience: ${p.experience}`, next <= 0 ? "Maximum level reached" : `Next level: ${next}
Remaining: ${Math.max(0, next - p.experience)}`].join("\n");
    if (next <= 0 || base !== void 0) meter(grid, "XP", value2, progress, "#8f5e1f", tip2);
    else node(grid, "div", "metric", `XP ${value2}`).dataset.tip = tip2;
  } else {
    node(grid, "div", "metric", `XP ${p.experience} - Lv ${p.level}`);
  }
  if (p.stats.length) {
    const stats = node(mount, "div", "stats");
    for (const item of p.stats) {
      const cell2 = node(stats, "div", item.drained ? "drained" : "");
      node(cell2, "div", "", `${item.label}${item.drained ? "*" : ""}`);
      node(cell2, "div", "", stat(item.value));
      cell2.dataset.tip = `${item.label}: ${stat(item.value)}`;
    }
  }
  const metrics = node(mount, "div", "metric-grid");
  for (const [label2, value2] of [["Gold", p.gold], ["Armour", p.armour], ["Speed", p.speed]]) {
    const tile = node(metrics, "div", "metric", label2);
    node(tile, "b", "", String(value2));
  }
  if (p.extra_moves) node(mount, "div", "", `Extra moves: ${p.extra_moves > 0 ? "+" : ""}${p.extra_moves}`);
}

// src/panels/message-log.ts
var ink = { system: "#64a0b5b4", combat: "#c88f5fb4", loot: "#b1a962b4", other: "#5b8a71a0" };
var COMBAT_TYPES = /* @__PURE__ */ new Set([
  2,
  3,
  4,
  6,
  11,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  85,
  92,
  93,
  94,
  95,
  96,
  97,
  98,
  99,
  100,
  101,
  102,
  103,
  104,
  105,
  106,
  107,
  108,
  109,
  110,
  139,
  140,
  141,
  142,
  143,
  144,
  145,
  148,
  149
]);
var LOOT_TYPES = /* @__PURE__ */ new Set([5, 33, 82, 83, 84]);
var KINDS = /* @__PURE__ */ new Set(["combat", "loot", "system", "other"]);
var FILTERS = [["all", "All"], ["combat", "Combat"], ["loot", "Loot"], ["other", "Other"]];
function messageKind(message) {
  if (message.system === true) return "system";
  if (message.group && KINDS.has(message.group)) return message.group;
  if (message.category !== void 0 && COMBAT_TYPES.has(message.category)) return "combat";
  if (message.category !== void 0 && LOOT_TYPES.has(message.category)) return "loot";
  return "other";
}
function messageLine(message) {
  const count = message.count ?? 1;
  return count > 1 ? `${message.text} (x${count})` : message.text;
}
function lineIsCut(node2) {
  return node2.clientWidth > 0 && node2.scrollWidth > node2.clientWidth;
}
function childWithClass(parent, className) {
  const children = parent.children;
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (child && child.className === className) return child;
  }
  return null;
}
function refreshLineCues(list) {
  const children = list.children;
  for (let index = 0; index < children.length; index++) {
    const row = children[index];
    if (!row || row.className !== "message") continue;
    const body = childWithClass(row, "body");
    if (!body) continue;
    const cue = childWithClass(row, "cut");
    if (lineIsCut(body)) {
      if (!cue) {
        const mark = node(row, "span", "cut", "...");
        mark.setAttribute("aria-hidden", "true");
      }
    } else if (cue) cue.remove();
  }
}
function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
function appendPauseEmblem(parent, label2) {
  const mark = node(parent, "span", prefersReducedMotion() ? "pause still" : "pause");
  mark.setAttribute("aria-hidden", "true");
  node(mark, "i");
  node(mark, "i");
  node(mark, "b");
  node(mark, "b");
  node(mark, "b");
  node(parent, "span", "sr", label2);
}
function renderMessageLog(mount, model, options = {}) {
  const previous = mount.querySelector("input")?.value ?? "";
  const previousFilter = mount.querySelector("select")?.value || "all";
  mount.replaceChildren();
  const heading = node(mount, "div", "heading", "Messages");
  if (model.message_pending === true) {
    heading.style.color = "#ffba4d";
    const acknowledge = options.acknowledge;
    if (acknowledge) {
      const ribbon = node(mount, "button", "ribbon");
      ribbon.type = "button";
      ribbon.style.pointerEvents = "auto";
      ribbon.style.cursor = "pointer";
      ribbon.style.background = "transparent";
      ribbon.style.font = "inherit";
      ribbon.style.width = "100%";
      ribbon.style.textAlign = "left";
      appendPauseEmblem(ribbon, "Messages waiting");
      ribbon.addEventListener("click", () => {
        if (!acknowledge()) ribbon.disabled = true;
      });
    } else {
      const ribbon = node(mount, "div", "ribbon");
      appendPauseEmblem(ribbon, "Messages waiting");
    }
  }
  const filter = node(mount, "select", "messages-filter");
  filter.setAttribute("aria-label", "Filter messages");
  for (const [value2, label2] of FILTERS) {
    const option = node(filter, "option", "", label2);
    option.value = value2;
  }
  filter.value = FILTERS.some(([value2]) => value2 === previousFilter) ? previousFilter : "all";
  const search = node(mount, "input");
  search.type = "search";
  search.placeholder = "Search messages";
  search.setAttribute("aria-label", "Search messages");
  search.value = previous;
  const list = node(mount, "div", "messages");
  const draw = () => {
    list.replaceChildren();
    const match = search.value.toLocaleLowerCase();
    const compact2 = mount.closest(".compact") !== null;
    const selected = compact2 ? "all" : filter.value || "all";
    if (!model.messages.length) {
      node(list, "div", "muted", "No messages yet.");
      return;
    }
    for (const message of model.messages) {
      if (message.text.trim() === "") continue;
      const bucket = messageKind(message);
      if (selected !== "all" && (bucket === "system" ? "other" : bucket) !== selected) continue;
      if (!compact2 && !message.text.toLocaleLowerCase().includes(match)) continue;
      const row = node(list, "div", "message");
      node(row, "span", "body", messageLine(message));
      row.style.color = message.color ?? ink[bucket];
    }
    refreshLineCues(list);
  };
  filter.addEventListener("change", draw);
  search.addEventListener("input", draw);
  draw();
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => refreshLineCues(list));
}

// src/panels/dungeon-card.ts
function renderDungeonCard(mount, model) {
  mount.replaceChildren();
  node(mount, "div", "heading", "Dungeon");
  const p = model.player;
  const d = model.dungeon;
  const grid = node(mount, "div", "grid");
  for (const [label2, value2, tip2] of [["Depth", String(d.depth), `Depth: ${d.depth_feet} feet`], ["Light", String(d.light), ""], ["Feel", d.feeling || "-", d.feeling_description ?? ""], ["", d.floor ?? "", ""]]) {
    const tile = node(grid, "div", "metric", label2);
    node(tile, "b", "", value2);
    if (tip2) tile.dataset.tip = tip2;
  }
  for (const [condition, label2] of [[p.trap_detected, "Trap-detected area"], [p.recall, "Recall pending"], [p.descent, "Descent pending"], [p.resting, "Resting"], [p.running, "Running"], [p.repeat, `Repeating: ${p.repeat}`], [p.unignoring, "Showing ignored items"]]) {
    if (!condition) continue;
    if (label2 === "Resting") appendPauseEmblem(node(mount, "div"), "Resting");
    else node(mount, "div", "", label2);
  }
}

// src/panels/status-badges.ts
var colours = { harm: "#ff7559", mixed: "#ffc259", benefit: "#66e0b3", neutral: "#8cbfff", study: "#8cbfff" };
var kinds = { harm: "Harmful effect", mixed: "Benefits and drawbacks", benefit: "Beneficial effect", neutral: "Active effect", study: "Learning available" };
function renderStatusBadges(mount, model) {
  mount.replaceChildren();
  const statuses = model.player.statuses.filter((item) => item.visible !== false && item.label !== "FOOD");
  statuses.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
  if (model.player.study && model.player.study > 0) statuses.push({ label: "Study", name: "Study", visible: true, priority: void 0, kind: "study", duration: model.player.study, description: void 0 });
  if (!statuses.length) return;
  node(mount, "div", "heading", "Status effects");
  const wrap = node(mount, "div", "badges");
  for (const effect of statuses) {
    const kind = effect.kind ?? "neutral";
    const name = effect.name || effect.label || "Effect";
    const badge = node(wrap, "span", "badge", kind === "study" && effect.duration !== void 0 ? `${name} - ${effect.duration}` : name);
    badge.style.color = colours[kind];
    badge.style.backgroundColor = `${colours[kind]}29`;
    const lines = [effect.duration === void 0 ? name : `${name} (${effect.duration})`, kinds[kind]];
    if (effect.description) lines.push("---------", effect.description);
    badge.dataset.tip = lines.join("\n");
  }
}
var DRIVER_NAMES = { borg: "Borg", squire: "Squire", "core:demo-wanderer": "Demo wanderer" };
var driverColour = "#f5bc5a";
function driverName(owner) {
  return DRIVER_NAMES[owner] ?? "Autoplayer";
}
function renderDriverBadge(mount, driver) {
  mount.replaceChildren();
  if (driver.kind !== "controller") return;
  const name = driverName(driver.owner);
  const label2 = driver.label?.trim();
  const reason = driver.reason?.trim();
  const wrap = node(mount, "div", "badges");
  const badge = node(wrap, "span", "badge driver", label2 ? `${name}: ${label2}` : `${name} is playing`);
  badge.style.color = driverColour;
  badge.style.backgroundColor = `${driverColour}29`;
  const lines = [`${name} is playing.`];
  if (label2) lines.push(label2);
  if (reason) lines.push(reason);
  lines.push("Map clicks and panel buttons do nothing until it stops.");
  badge.dataset.tip = lines.join("\n");
}

// src/panels/tracked-creature.ts
function renderTrackedCreature(mount, model) {
  mount.replaceChildren();
  node(mount, "div", "heading", "Tracked creature");
  const target = model.player.tracked_creature;
  if (!target || !target.visible) {
    node(mount, "div", "muted", target ? "Out of sight" : "No creature tracked");
    meter(mount, "HP", "-- / --", 0, "#8f5e1f");
    return;
  }
  node(mount, "div", "", target.name).dataset.tip = target.name;
  if (target.hp !== void 0 && target.max_hp !== void 0) {
    meter(mount, "HP", `${Math.max(0, target.hp)} / ${target.max_hp}`, fraction(target.hp, target.max_hp), "#8f5e1f");
  }
}

// src/accessibility.ts
var COLORBLIND_FILTER_ID = "anybandui-accessibility-colorblind";
var HIGH_CONTRAST_FILTER = "contrast(1.55) saturate(1.2)";
var COLORBLIND_MATRIX = "0.812 0.199 -0.011 0 0 0 1 0 0 0 -0.188 0.199 0.989 0 0 0 0 0 1 0";
function setFilter(display, filter, scope) {
  if (typeof display.getVisualFilter === "function" || display.setVisualFilter.length >= 2) display.setVisualFilter(filter, { scope });
  else display.setVisualFilter(filter);
}
function visualTreatment(flags, invertDungeon = false) {
  const access = accessibilityFilter(flags);
  if (invertDungeon && access) return { filter: `${access} invert(1)`, scope: "game" };
  if (invertDungeon) return { filter: "invert(1)", scope: "canvas" };
  if (access) return { filter: access, scope: "game" };
  return null;
}
function accessibilityFilter(flags) {
  const filters = [];
  if (flags["anybandui.colourblind"] === true) filters.push(`url("#${COLORBLIND_FILTER_ID}")`);
  else if (flags["anybandui.highContrast"] === true) filters.push(HIGH_CONTRAST_FILTER);
  if (flags["anybandui.crt"] === true) filters.push("contrast(1.08) saturate(1.25) brightness(1.02)");
  return filters.length ? filters.join(" ") : null;
}
function ensureColorblindFilter() {
  if (typeof document === "undefined" || document.getElementById(COLORBLIND_FILTER_ID)) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", COLORBLIND_FILTER_ID);
  const matrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
  matrix.setAttribute("type", "matrix");
  matrix.setAttribute("values", COLORBLIND_MATRIX);
  filter.appendChild(matrix);
  svg.appendChild(filter);
  document.body?.appendChild(svg);
}
var configuredDisplay = null;
var configuredScope = "game";
function installAccessibilityAccommodations(ctx) {
  uninstallAccessibilityAccommodations();
  const treatment = visualTreatment(ctx.flags, ctx.invertDungeon === true);
  if (!treatment) return;
  if (!ctx.display) {
    ctx.log?.(ctx.invertDungeon === true && !accessibilityFilter(ctx.flags) ? "this game is too old to invert the dungeon view" : "this game is too old for visual accessibility filters");
    return;
  }
  if (ctx.flags["anybandui.colourblind"] === true) ensureColorblindFilter();
  configuredDisplay = ctx.display;
  configuredScope = treatment.scope;
  setFilter(ctx.display, treatment.filter, treatment.scope);
  setPanelHostVisualFilter(treatment.scope === "game" ? treatment.filter : null);
}
function uninstallAccessibilityAccommodations() {
  const display = configuredDisplay;
  const scope = configuredScope;
  configuredDisplay = null;
  if (display) setFilter(display, null, scope);
  setPanelHostVisualFilter(null);
}

// src/encounter-preference.ts
function record(value2) {
  return value2 !== null && typeof value2 === "object" && !Array.isArray(value2);
}
function readFirstEncounterPreference2(raw) {
  if (!record(raw)) return null;
  const candidate = raw.v === 2 ? raw.firstEncounter : raw.v === 1 ? raw : void 0;
  if (!record(candidate) || typeof candidate.characterKey !== "string" || !Array.isArray(candidate.monsters) || !Array.isArray(candidate.artifacts)) return null;
  return {
    characterKey: candidate.characterKey,
    monsters: candidate.monsters.filter((value2) => typeof value2 === "number"),
    artifacts: candidate.artifacts.filter((value2) => typeof value2 === "number")
  };
}
function withFirstEncounterPreference(raw, firstEncounter) {
  const existing = record(raw) && raw.v === 2 ? raw : {};
  return { ...existing, v: 2, firstEncounter };
}

// src/first-encounter.ts
var DEADLY_OUT_OF_DEPTH_LEVELS = 5;
function classifyMonsterThreat(race, currentDepth) {
  if (race.unique ?? race.maxNum === 1) return "unique";
  const over = race.level - currentDepth;
  if (over >= DEADLY_OUT_OF_DEPTH_LEVELS) return "deadly";
  if (over >= 1) return "outOfDepth";
  return "ordinary";
}
function characterKey(fingerprint) {
  return [
    fingerprint.raceName,
    fingerprint.clsName,
    fingerprint.auBirth,
    fingerprint.htBirth,
    fingerprint.wtBirth
  ].join("|");
}
function readFirstEncounterNotebook(raw, key) {
  const stored = readFirstEncounterPreference2(raw);
  if (stored?.characterKey === key) {
    return {
      monsters: new Set(stored.monsters),
      artifacts: new Set(stored.artifacts)
    };
  }
  return { monsters: /* @__PURE__ */ new Set(), artifacts: /* @__PURE__ */ new Set() };
}
function withFirstEncounterNotebook(raw, key, notebook) {
  const firstEncounter = {
    characterKey: key,
    monsters: [...notebook.monsters],
    artifacts: [...notebook.artifacts]
  };
  return withFirstEncounterPreference(raw, firstEncounter);
}
function newMonsterSightings(visible, alreadySeen) {
  const found = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const race of visible) {
    if (alreadySeen.has(race.ridx) || claimed.has(race.ridx)) continue;
    claimed.add(race.ridx);
    found.push(race);
  }
  return found;
}
function newArtifactFinds(carried, alreadySeen) {
  const found = [];
  const claimed = /* @__PURE__ */ new Set();
  for (const artifact of carried) {
    if (alreadySeen.has(artifact.aidx) || claimed.has(artifact.aidx)) continue;
    claimed.add(artifact.aidx);
    found.push(artifact);
  }
  return found;
}
function carriedKnownArtifacts(gear, liveObjectIsKnownArtifact) {
  const found = [];
  for (const obj of gear) {
    if (obj.artifact && liveObjectIsKnownArtifact(obj)) found.push(obj.artifact);
  }
  return found;
}
var TIER_LABEL = {
  unique: "Unique!",
  deadly: "Deadly - well out of depth",
  outOfDepth: "Out of depth",
  ordinary: "First sighting"
};
var TIER_COLOR = {
  unique: "#e8c34a",
  deadly: "#e05a4e",
  outOfDepth: "#e0954e",
  ordinary: "#7fd88f"
};
function monsterCardContent(race, currentDepth, fmtDepth, colorToCss, tiles) {
  const tier = classifyMonsterThreat(race, currentDepth);
  const useTile = tiles !== void 0 && tiles.active && tiles.hasMonsterTile(race.ridx);
  return {
    kind: "monster",
    title: TIER_LABEL[tier],
    name: race.name,
    depthText: fmtDepth(race.level),
    tier,
    glyphChar: race.dChar,
    glyphColor: colorToCss(race.dAttr),
    ...useTile ? { tilePaint: { ridx: race.ridx, tiles } } : {}
  };
}
function artifactCardContent(artifact, fmtDepth) {
  return {
    kind: "artifact",
    title: "Artifact found!",
    name: artifact.name,
    depthText: fmtDepth(artifact.level)
  };
}
var POLL_MS = 750;
var AUTO_DISMISS_MS = 9e3;
var timer = null;
var queue = [];
var activePanel = null;
var activeContent = null;
var activeTimeout = null;
var activeTheme = THEMES["terminal-original"];
var stopTheme = null;
function showEncounter(theme) {
  activeTheme = theme;
  if (!activePanel || !activeContent) return;
  activePanel.root.replaceChildren();
  drawCard(activePanel, activeContent, activeTheme);
}
function showNext(ui) {
  if (activePanel) return;
  const content = queue.shift();
  if (!content) return;
  let panel;
  try {
    panel = ui.openPanel({ id: "first-encounter", modal: false, label: content.title });
  } catch {
    return;
  }
  activePanel = panel;
  activeContent = content;
  drawCard(panel, content, activeTheme);
  const advance = () => {
    if (activePanel !== panel) return;
    activePanel = null;
    activeContent = null;
    showNext(ui);
  };
  void panel.closed.then(advance);
  activeTimeout = setTimeout(() => {
    activeTimeout = null;
    panel.close();
  }, AUTO_DISMISS_MS);
}
var TILE_PORTRAIT_SIZE = 24;
function paintTilePortrait(tilePaint, dpr) {
  const canvas = document.createElement("canvas");
  const device = Math.max(1, Math.round(TILE_PORTRAIT_SIZE * dpr));
  canvas.width = device;
  canvas.height = device;
  canvas.style.width = `${String(TILE_PORTRAIT_SIZE)}px`;
  canvas.style.height = `${String(TILE_PORTRAIT_SIZE)}px`;
  canvas.setAttribute("aria-hidden", "true");
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return null;
  ctx2d.imageSmoothingEnabled = false;
  const drew = tilePaint.tiles.drawMonster(ctx2d, tilePaint.ridx, 0, 0, device, device);
  return drew ? canvas : null;
}
function drawCard(panel, content, theme) {
  const root = panel.root;
  applyTheme(root, theme);
  const style = document.createElement("style");
  const accent = content.tier ? TIER_COLOR[content.tier] : TIER_COLOR.ordinary;
  style.textContent = ":host { all: initial; }.wrap { position: fixed; inset: auto 1rem 1rem auto; display: flex; justify-content: flex-end; pointer-events: none; }.card { position: relative; pointer-events: auto; width: 19rem; max-width: calc(100vw - 2rem); background: var(--anyband-surface); color: var(--anyband-text); border-radius: var(--anyband-rounding); padding: .8rem 1rem; box-shadow: 0 6px 22px rgba(0,0,0,.45); border: 2px solid " + accent + "; animation: anyband-first-encounter-in .3s ease-out; }@keyframes anyband-first-encounter-in { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }.head { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; }.glyph { flex: none; width: 2.1rem; height: 2.1rem; display: flex; align-items: center; justify-content: center; background: var(--anyband-background); border-radius: var(--anyband-rounding); }.depth { margin-top: .3rem; }.close { position: absolute; top: .3rem; right: .45rem; pointer-events: auto; background: none; border: none; opacity: .55; padding: .2rem; }.close:hover { opacity: 1; }";
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "status");
  const dpr = window.devicePixelRatio || 1;
  const cellHeight = 16;
  const cellWidth = cellHeight * (16 / 24);
  const titleCellHeight = 12;
  const titleCellWidth = titleCellHeight * (16 / 24);
  const nameCellHeight = 20;
  const nameCellWidth = nameCellHeight * (16 / 24);
  const maxChars = Math.max(10, Math.floor((19 * 16 - 32 - 34) / nameCellWidth));
  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.addEventListener("click", () => panel.close());
  paintBitmapButtonLabel(close, "X", theme.text, cellWidth, cellHeight, dpr);
  close.setAttribute("aria-label", "Dismiss");
  const head = document.createElement("div");
  head.className = "head";
  if (content.tilePaint || content.glyphChar) {
    const glyph = document.createElement("span");
    glyph.className = "glyph";
    const portrait = content.tilePaint ? paintTilePortrait(content.tilePaint, dpr) : null;
    if (portrait) {
      glyph.appendChild(portrait);
    } else if (content.glyphChar) {
      glyph.appendChild(
        bitmapTextBlock(
          [[{ text: content.glyphChar, css: content.glyphColor ?? theme.text }]],
          24,
          24,
          dpr
        )
      );
    }
    head.append(glyph);
  }
  const titleBlock = document.createElement("div");
  const title = bitmapTextBlock(
    [[{ text: content.title.toUpperCase(), css: accent }]],
    titleCellWidth,
    titleCellHeight,
    dpr
  );
  const name = bitmapTextBlock(
    wrapBitmapText(content.name, maxChars).map((line) => [{ text: line, css: theme.text }]),
    nameCellWidth,
    nameCellHeight,
    dpr
  );
  name.style.marginTop = ".15rem";
  titleBlock.append(title, name);
  head.append(titleBlock);
  const depth = document.createElement("div");
  depth.className = "depth";
  depth.appendChild(
    bitmapTextBlock(
      [[{ text: `Native depth: ${content.depthText}`, css: theme.text }]],
      cellWidth,
      cellHeight,
      dpr
    )
  );
  card.append(close, head, depth);
  wrap.append(card);
  root.append(style, wrap);
}
function installFirstEncounter(ctx) {
  uninstallFirstEncounter();
  if (!ctx.ui || !offers(ctx, ["monsterListCollect", "liveObjectIsKnownArtifact", "fmtDepth", "colorToCss"])) {
    ctx.log?.("this game is too old for first-encounter alerts");
    return;
  }
  const ui = ctx.ui;
  activeTheme = ctx.theme ?? THEMES["terminal-original"];
  stopTheme = onThemeChange(showEncounter);
  const key = characterKey(birthFacts(ctx));
  const notebook = readFirstEncounterNotebook(ctx.prefs?.get(), key);
  const save = () => ctx.prefs?.set(withFirstEncounterNotebook(ctx.prefs?.get(), key, notebook));
  timer = setInterval(() => {
    let visible;
    try {
      visible = visibleMonsterRaces(ctx);
    } catch (error) {
      ctx.log?.(`first-encounter alerts: could not read visible monsters: ${String(error)}`);
      return;
    }
    const newMonsters = newMonsterSightings(visible, notebook.monsters);
    let carried;
    try {
      carried = carriedKnownArtifacts(carriedGear(ctx), knownArtifactTest(ctx));
    } catch (error) {
      ctx.log?.(`first-encounter alerts: could not read carried gear: ${String(error)}`);
      return;
    }
    const newArtifacts = newArtifactFinds(carried, notebook.artifacts);
    if (newMonsters.length === 0 && newArtifacts.length === 0) return;
    for (const race of newMonsters) notebook.monsters.add(race.ridx);
    for (const artifact of newArtifacts) notebook.artifacts.add(artifact.aidx);
    save();
    const depth = levelDepth(ctx);
    const { fmtDepth, colorToCss } = coreFormatters(ctx);
    for (const race of newMonsters) {
      queue.push(monsterCardContent(race, depth, fmtDepth, colorToCss, ctx.tiles));
    }
    for (const artifact of newArtifacts) {
      queue.push(artifactCardContent(artifact, fmtDepth));
    }
    showNext(ui);
  }, POLL_MS);
}
function uninstallFirstEncounter() {
  stopTheme?.();
  stopTheme = null;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (activeTimeout !== null) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  activePanel?.close();
  activePanel = null;
  activeContent = null;
  queue = [];
}

// src/map-overview.ts
function mapProjection(snapshot) {
  if (snapshot.mode === "map" && typeof document !== "undefined") {
    const graphics = Array.from(document.querySelectorAll('body > canvas[aria-hidden="true"]')).find((canvas) => canvas.style.zIndex === "1");
    if (graphics) {
      const rect = graphics.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    }
  }
  return snapshot.regions.map?.pixels;
}
function featureCode(cell2) {
  const builtIn = [
    "NONE",
    "FLOOR",
    "CLOSED",
    "OPEN",
    "BROKEN",
    "LESS",
    "MORE",
    "STORE_GENERAL",
    "STORE_ARMOR",
    "STORE_WEAPON",
    "STORE_BOOK",
    "STORE_ALCHEMY",
    "STORE_MAGIC",
    "STORE_BLACK",
    "HOME",
    "SECRET",
    "RUBBLE",
    "MAGMA",
    "QUARTZ",
    "MAGMA_K",
    "QUARTZ_K",
    "GRANITE",
    "PERM",
    "LAVA",
    "PASS_RUBBLE"
  ];
  return cell2.remembered.featCode ?? builtIn[cell2.remembered.feat];
}
function landmarkKind(code) {
  if (!code) return null;
  if (/(?:LESS|STAIR_UP|UP_STAIR)/i.test(code)) return "up";
  if (/(?:MORE|STAIR_DOWN|DOWN_STAIR)/i.test(code)) return "down";
  if (/(?:STORE|SHOP)/i.test(code)) return "shop";
  return null;
}
function schematicColour(code) {
  if (!code) return "#1b2732";
  if (/(?:WALL|GRANITE|PERM)/i.test(code)) return "#435265";
  if (/DOOR/i.test(code)) return "#a4774a";
  return "#263b48";
}
function drawMarker(g, x, y, r, kind) {
  const color = kind === "up" ? "#5fcdff" : kind === "down" ? "#ffc155" : kind === "shop" ? "#da8dff" : "#f5faff";
  g.fillStyle = "rgba(8,13,20,0.92)";
  g.beginPath();
  g.arc(x, y, r + 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  if (kind === "shop") g.rect(x - r, y - r, 2 * r, 2 * r);
  else if (kind === "player") {
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
  } else if (kind === "up") {
    g.moveTo(x, y - r);
    g.lineTo(x - r, y + r);
    g.lineTo(x + r, y + r);
    g.closePath();
  } else {
    g.moveTo(x, y + r);
    g.lineTo(x - r, y - r);
    g.lineTo(x + r, y - r);
    g.closePath();
  }
  g.fill();
}
function fitView(snapshot) {
  return { origin: { x: 0, y: 0 }, size: { width: snapshot.level.width, height: snapshot.level.height } };
}
function zoomMapAt(snapshot, direction, pointer) {
  const rect = mapProjection(snapshot);
  const old = snapshot.viewport.size;
  const width = Math.max(2, Math.min(snapshot.level.width, Math.round(old.width * (direction > 0 ? 0.8 : 1.25))));
  const height = Math.max(2, Math.min(snapshot.level.height, Math.round(old.height * (direction > 0 ? 0.8 : 1.25))));
  if (!rect || !pointInRect(pointer, rect)) return { origin: clampOrigin({ ...snapshot, viewport: { ...snapshot.viewport, size: { width, height } } }, snapshot.viewport.origin), size: { width, height } };
  const fx = (pointer.x - rect.x) / rect.width, fy = (pointer.y - rect.y) / rect.height;
  const caveX = snapshot.viewport.origin.x + fx * old.width;
  const caveY = snapshot.viewport.origin.y + fy * old.height;
  const resized = { ...snapshot, viewport: { ...snapshot.viewport, size: { width, height } } };
  return { origin: clampOrigin(resized, { x: caveX - fx * width, y: caveY - fy * height }), size: { width, height } };
}
function installMapOverview(ctx) {
  const display = ctx.display;
  if (!display || !ctx.flags["anybandui.mapOverview"] && !ctx.flags["anybandui.mapSchematic"] && !ctx.flags["anybandui.crispTiles"]) return () => {
  };
  let appliedMapView = false;
  const setMapView = (view) => {
    display.setMapView(view);
    appliedMapView = view !== null;
  };
  display.setFullMapOverview(true);
  const appliedTileScaling = ctx.flags["anybandui.crispTiles"] === true;
  if (appliedTileScaling) display.setTileScaling("crisp");
  const restoreDisplay = () => {
    if (appliedMapView) display.setMapView(null);
    const perMod = keepsDisplayRequestsPerMod(display);
    display.setFullMapOverview(perMod ? null : false);
    if (appliedTileScaling) display.setTileScaling(perMod ? null : "auto");
  };
  if (!ctx.flags["anybandui.mapOverview"] && !ctx.flags["anybandui.mapSchematic"] || typeof document === "undefined" || typeof window === "undefined") {
    return restoreDisplay;
  }
  let theme = themeFromPrefs(ctx.prefs?.get());
  const strip = document.createElement("div");
  strip.style.cssText = `position:fixed;z-index:900;display:none;height:24px;align-items:center;gap:8px;padding:0 6px;background:${theme.surface};color:${theme.text};font:${PAINT_FONT_SIZE}px/${PAINT_LINE_HEIGHT}px ${PAINT_FONT};border-bottom:1px solid ${paintColours(theme).border}`;
  const fit = document.createElement("button");
  fit.textContent = "Fit floor";
  const center = document.createElement("button");
  center.textContent = "Centre on player";
  const readout = document.createElement("span");
  for (const control of [fit, center]) control.style.cssText = `font:inherit;color:inherit;background:${theme.background};border:1px solid ${paintColours(theme).border};border-radius:${Math.round(theme.rounding * 0.4)}px;padding:1px 6px;cursor:pointer`;
  strip.append(fit, center, readout);
  const legend = document.createElement("span");
  legend.style.cssText = "display:inline-flex;align-items:center;gap:8px";
  for (const [kind, label2] of [["player", "You"], ["up", "Up"], ["down", "Down"], ["shop", "Shop"]]) {
    const item = document.createElement("span");
    item.style.cssText = "display:inline-flex;align-items:center;gap:3px";
    const swatch = document.createElement("canvas");
    swatch.width = 16;
    swatch.height = 16;
    const ink2 = swatch.getContext("2d");
    if (ink2) drawMarker(ink2, 8, 8, 4, kind);
    item.append(swatch, document.createTextNode(label2));
    legend.appendChild(item);
  }
  strip.appendChild(legend);
  document.body.appendChild(strip);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "Map controls";
  toggle.setAttribute("aria-label", "Show map controls");
  toggle.style.cssText = `position:fixed;z-index:901;display:none;background:${theme.surface};color:${theme.text}`;
  document.body.appendChild(toggle);
  const paintChrome = () => {
    const colours2 = paintColours(theme);
    const radius = `${Math.round(theme.rounding * 0.4)}px`;
    strip.style.background = theme.surface;
    strip.style.color = theme.text;
    strip.style.borderBottom = `1px solid ${colours2.border}`;
    for (const control of [fit, center]) {
      control.style.background = theme.background;
      control.style.border = `1px solid ${colours2.border}`;
      control.style.borderRadius = radius;
    }
    toggle.style.background = theme.surface;
    toggle.style.color = theme.text;
  };
  const stopTheme2 = onThemeChange((next) => {
    theme = next;
    paintChrome();
  });
  let controlsOpen = false;
  toggle.addEventListener("click", () => {
    controlsOpen = !controlsOpen;
    update();
  });
  const overlay = document.createElement("canvas");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = "position:fixed;z-index:899;display:none;pointer-events:none";
  document.body.appendChild(overlay);
  let known = null;
  let playView = null;
  let marginReported = false;
  let lastMode = "";
  let drag = null;
  const update = () => {
    const snap = display.snapshot();
    if (snap.mode !== "map") {
      strip.style.display = "none";
      toggle.style.display = "none";
      controlsOpen = false;
      overlay.style.display = "none";
      if (snap.mode === "play") playView = snap.viewport;
      lastMode = snap.mode;
      return;
    }
    if (lastMode !== "map") {
      if (!ctx.flags["anybandui.zoom"] && !ctx.flags["anybandui.enlargedDisplay"]) setMapView(fitView(snap));
      try {
        known = viewLevel(ctx);
      } catch {
        known = null;
      }
    }
    lastMode = "map";
    const rect = mapProjection(snap);
    if (rect && known) {
      overlay.style.display = "block";
      overlay.style.left = `${rect.x}px`;
      overlay.style.top = `${rect.y}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.width = Math.max(1, Math.round(rect.width));
      overlay.height = Math.max(1, Math.round(rect.height));
      const g = overlay.getContext("2d");
      if (g) {
        const cw = rect.width / snap.viewport.size.width, ch = rect.height / snap.viewport.size.height;
        for (const cell2 of known.cells) {
          const x = (cell2.x - snap.viewport.origin.x) * cw, y = (cell2.y - snap.viewport.origin.y) * ch;
          if (x + cw < 0 || y + ch < 0 || x >= rect.width || y >= rect.height) continue;
          if (ctx.flags["anybandui.mapSchematic"]) {
            g.fillStyle = schematicColour(featureCode(cell2));
            g.fillRect(x, y, Math.ceil(cw), Math.ceil(ch));
          }
          const kind = landmarkKind(featureCode(cell2));
          if (kind) drawMarker(g, x + cw / 2, y + ch / 2, Math.max(3, Math.min(7, Math.min(cw, ch) * 0.4)), kind);
        }
        if (playView) {
          g.strokeStyle = "#7aacd4";
          g.lineWidth = 2;
          g.strokeRect(
            (playView.origin.x - snap.viewport.origin.x) * cw,
            (playView.origin.y - snap.viewport.origin.y) * ch,
            playView.size.width * cw,
            playView.size.height * ch
          );
        }
        const player = playerGrid(ctx);
        if (player) drawMarker(
          g,
          (player.x + 0.5 - snap.viewport.origin.x) * cw,
          (player.y + 0.5 - snap.viewport.origin.y) * ch,
          Math.max(4, Math.min(8, Math.min(cw, ch) * 0.45)),
          "player"
        );
      }
    } else overlay.style.display = "none";
    if (!rect || rect.y < 24 || rect.width < 480) {
      toggle.style.display = rect ? "block" : "none";
      if (rect) {
        toggle.style.left = `${rect.x + 4}px`;
        toggle.style.top = `${rect.y + 4}px`;
      }
      strip.style.display = controlsOpen && rect ? "flex" : "none";
      if (controlsOpen && rect) {
        strip.style.left = `${rect.x}px`;
        strip.style.top = `${rect.y + 30}px`;
      }
      if (!marginReported) {
        marginReported = true;
        ctx.log?.("map controls: host provides no clear margin above this map size");
      }
      return;
    }
    toggle.style.display = "none";
    strip.style.display = "flex";
    strip.style.left = `${rect.x}px`;
    strip.style.top = `${rect.y - 24}px`;
    const zoom = Math.round(100 * snap.level.width / Math.max(1, snap.viewport.size.width));
    readout.textContent = `${zoom}%`;
  };
  fit.addEventListener("click", () => setMapView(fitView(display.snapshot())));
  center.addEventListener("click", () => {
    const player = playerGrid(ctx);
    if (!player) return;
    const snap = display.snapshot();
    setMapView({ origin: clampOrigin(snap, { x: player.x - snap.viewport.size.width / 2, y: player.y - snap.viewport.size.height / 2 }), size: snap.viewport.size });
  });
  const wheel = (event) => {
    if (ctx.flags["anybandui.zoom"] || ctx.flags["anybandui.enlargedDisplay"]) return;
    const snap = display.snapshot();
    const point = { x: event.clientX, y: event.clientY };
    if (snap.mode !== "map" || !pointInRect(point, mapProjection(snap))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setMapView(zoomMapAt(snap, event.deltaY < 0 ? 1 : -1, point));
  };
  const down = (event) => {
    if (event.button === 0 && display.snapshot().mode === "map" && pointInRect({ x: event.clientX, y: event.clientY }, mapProjection(display.snapshot()))) drag = { x: event.clientX, y: event.clientY };
  };
  const move = (event) => {
    if (!drag) return;
    const snap = display.snapshot();
    if (snap.mode !== "map") {
      drag = null;
      return;
    }
    const rect = mapProjection(snap);
    if (!rect) return;
    const dx = Math.trunc((event.clientX - drag.x) * snap.viewport.size.width / rect.width);
    const dy = Math.trunc((event.clientY - drag.y) * snap.viewport.size.height / rect.height);
    if (!dx && !dy) return;
    setMapView({ origin: clampOrigin(snap, { x: snap.viewport.origin.x - dx, y: snap.viewport.origin.y - dy }), size: snap.viewport.size });
    drag = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  };
  const up = () => {
    drag = null;
  };
  const offKey = display.onKey((event) => {
    const snap = display.snapshot();
    if (snap.mode === "play" && event.key === "M" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      playView = snap.viewport;
      return;
    }
    if (ctx.flags["anybandui.zoom"] || ctx.flags["anybandui.enlargedDisplay"]) return;
    if (snap.mode !== "map" || !event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key;
    const dx = key === "ArrowLeft" ? -2 : key === "ArrowRight" ? 2 : 0;
    const dy = key === "ArrowUp" ? -2 : key === "ArrowDown" ? 2 : 0;
    if (dx || dy) setMapView({ origin: clampOrigin(snap, { x: snap.viewport.origin.x + dx, y: snap.viewport.origin.y + dy }), size: snap.viewport.size });
    else if (key === "=" || key === "+" || key === "-" || key === "_") {
      const rect = mapProjection(snap);
      const at = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: 0, y: 0 };
      setMapView(zoomMapAt(snap, key === "-" || key === "_" ? -1 : 1, at));
    } else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  window.addEventListener("wheel", wheel, { capture: true, passive: false });
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  const timer2 = setInterval(update, 150);
  return () => {
    stopTheme2();
    clearInterval(timer2);
    offKey();
    strip.remove();
    toggle.remove();
    overlay.remove();
    restoreDisplay();
    window.removeEventListener("wheel", wheel, true);
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
  };
}

// src/panels/item-comparison.ts
var METRICS = [["speed", "Speed", 1], ["ac", "Armour", 1], ["toH", "To hit", 1], ["toD", "To damage", 1], ["blows", "Blows", 100], ["shots", "Shots", 10], ["maxHp", "Max HP", 1], ["maxSp", "Max SP", 1], ["totalWeight", "Weight", 10]];
var tip = "Whole-character preview. The replaced item stays in your pack; an item from outside your belongings adds its weight.";
function readableFlag(flag) {
  const words = flag.replace(/^(OF|OBJ_MOD|ELEM)_/, "").replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function el(parent, tag, value2) {
  const node2 = parent.ownerDocument.createElement(tag);
  if (value2 !== void 0) node2.textContent = value2;
  parent.appendChild(node2);
  return node2;
}
function comparisonSummary(sim) {
  if (!sim || sim.unresolved.length || !sim.placements.length) return null;
  const parts = [];
  for (const [key, label2, scale] of METRICS) {
    if (key === "totalWeight") continue;
    const delta = sim.after.stats[key] - sim.before.stats[key];
    if (delta) parts.push(`${label2} ${delta > 0 ? "+" : ""}${delta / scale}`);
  }
  for (const [index, name] of ["STR", "INT", "WIS", "DEX", "CON"].entries()) {
    const before = sim.before.stats.statUse[index], after = sim.after.stats.statUse[index];
    if (before !== void 0 && after !== void 0 && after !== before) parts.push(`${name} ${after > before ? "+" : ""}${after - before}`);
  }
  return parts.length ? `If worn: ${parts.join(", ")}` : "If worn: no change to known stats";
}
function slotOptionLabel(name, displaced) {
  const slot = name ? name.charAt(0).toUpperCase() + name.slice(1) : "Slot";
  return `${slot}: ${displaced ?? "empty"}`;
}
function renderItemComparison(parent, sim, unchanged, toggle, choice) {
  if (sim.unresolved.length) return;
  const details = el(parent, "details");
  details.open = true;
  el(details, "summary", "Equipment comparison");
  if (!sim.placements.length) {
    el(details, "p", "No compatible equipment slot.");
    return;
  }
  if (choice && choice.options.length > 1) {
    const label2 = el(details, "label", "Replace slot ");
    const select = el(label2, "select");
    for (const option of choice.options) {
      const entry2 = el(select, "option", option.label);
      entry2.value = String(option.slot);
      entry2.selected = option.slot === choice.chosen;
    }
    select.addEventListener("change", () => choice.choose(Number(select.value)));
  }
  const placement = (choice ? sim.placements.find((entry2) => entry2.slot === choice.chosen) : void 0) ?? sim.placements[0];
  el(details, "p", `Replacing: ${placement.displaced?.label ?? "empty slot"}`);
  el(details, "p", "Known properties only; unidentified effects may differ.");
  const checkbox = el(details, "input");
  checkbox.type = "checkbox";
  checkbox.checked = unchanged;
  checkbox.addEventListener("change", () => toggle(checkbox.checked));
  el(details, "span", " Show unchanged stats");
  const table = el(details, "table");
  const head = el(table, "tr");
  for (const label2 of ["Stat", "Current", "Selected", "Change"]) el(head, "th", label2);
  for (const [key, label2, scale] of METRICS) {
    const before = sim.before.stats[key];
    const after = sim.after.stats[key];
    const delta = after - before;
    if (!unchanged && !delta && !["speed", "ac", "blows"].includes(key)) continue;
    const row = el(table, "tr");
    const name = el(row, "td", label2);
    name.title = tip;
    el(row, "td", String(before / scale));
    el(row, "td", String(after / scale));
    const change = el(row, "td", delta ? `${delta > 0 ? "+" : ""}${delta / scale}` : "-");
    change.className = delta === 0 ? "muted" : key === "totalWeight" ? delta < 0 ? "gain" : "loss" : delta > 0 ? "gain" : "loss";
  }
  for (const [index, name] of ["STR", "INT", "WIS", "DEX", "CON"].entries()) {
    const before = sim.before.stats.statUse[index], after = sim.after.stats.statUse[index];
    if (before === void 0 || after === void 0 || !unchanged && before === after) continue;
    const row = el(table, "tr");
    for (const value2 of [name, String(before), String(after), after === before ? "-" : `${after > before ? "+" : ""}${after - before}`]) el(row, "td", value2);
  }
  el(details, "h4", "Resistances and abilities");
  sim.after.stats.resists.forEach((after, index) => {
    const before = sim.before.stats.resists[index] ?? 0;
    if (unchanged || after !== before) el(details, "div", `${sim.after.stats.resistElements[index] ?? `Element ${index + 1}`}: ${before} to ${after}`);
  });
  for (const flag of /* @__PURE__ */ new Set([...sim.before.stats.objectFlags, ...sim.after.stats.objectFlags])) {
    const before = sim.before.stats.objectFlags.includes(flag), after = sim.after.stats.objectFlags.includes(flag);
    if (unchanged || before !== after) el(details, "div", `${readableFlag(flag)}: ${before ? "Yes" : "No"} to ${after ? "Yes" : "No"}`);
  }
}

// src/hover-cards.ts
function hoverGrid(snapshot, point) {
  const rect = mapProjection(snapshot);
  if (!pointInRect(point, rect) || !rect) return null;
  const col = Math.floor((point.x - rect.x) * snapshot.viewport.size.width / rect.width);
  const row = Math.floor((point.y - rect.y) * snapshot.viewport.size.height / rect.height);
  if (col < 0 || row < 0 || col >= snapshot.viewport.size.width || row >= snapshot.viewport.size.height) return null;
  return { x: snapshot.viewport.origin.x + col, y: snapshot.viewport.origin.y + row };
}
function snapLandmark(snapshot, point, cells) {
  const rect = mapProjection(snapshot);
  if (!rect) return null;
  const cellW = rect.width / snapshot.viewport.size.width, cellH = rect.height / snapshot.viewport.size.height;
  let nearest = 64;
  let chosen = null;
  for (const cell2 of cells) {
    if (!landmarkKind(featureCode(cell2))) continue;
    const x = rect.x + (cell2.x - snapshot.viewport.origin.x + 0.5) * cellW;
    const y = rect.y + (cell2.y - snapshot.viewport.origin.y + 0.5) * cellH;
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance < nearest) {
      nearest = distance;
      chosen = { x: cell2.x, y: cell2.y };
    }
  }
  return chosen;
}
var NO_BATTLES = "No battles to the death are recalled.";
var RECALL_LIMIT = 90;
function recallLine(recall) {
  const body = recall?.text.split("\n").slice(1).join(" ").replace(/\s+/g, " ").trim();
  if (!body) return null;
  const sentences = body.split(/(?<=[.!?])\s+/).filter((sentence) => sentence && sentence !== NO_BATTLES);
  const first = sentences[0];
  if (!first) return null;
  if (first.length <= RECALL_LIMIT) return first;
  const cut = first.slice(0, RECALL_LIMIT - 3);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[,;:]$/, "")}...`;
}
function creatureRecall(ctx, grid) {
  if (!ctx.inspect?.monsterRecall || !ctx.snapshot) return null;
  try {
    const monster = viewMonsters(viewInput(ctx))?.find((entry2) => entry2.visible && entry2.grid.x === grid.x && entry2.grid.y === grid.y);
    return monster ? recallLine(ctx.inspect.monsterRecall(monster.raceIndex)) : null;
  } catch {
    return null;
  }
}
function gameWornLine(game, object) {
  try {
    return comparisonSummary(simulateLoadout(game, { wield: [{ from: "object", object }] }));
  } catch {
    return null;
  }
}
function gameCard(game, grid, map, recall, pickupPreview = false) {
  const look = lookAt(game, grid);
  const text = look?.text?.trim();
  if (!look || !text) return null;
  const at = playerGrid(game);
  const self = at?.x === grid.x && at?.y === grid.y;
  const hallucinating = playerHallucinating(game);
  const pile = hallucinating ? [] : rememberedPile(game, grid);
  const kind = self ? "You are here" : look.creature ? "Creature" : pile.length > 0 ? "Items" : "Terrain";
  const lines = [`${map ? `(${grid.x}, ${grid.y}) - ` : ""}${kind}`, text];
  if (hallucinating) {
    lines.push("Appearance unreliable (hallucinating)");
    return lines.join("\n");
  }
  const own = self ? playerHitPoints(game) : null;
  const hp = own ? own.hp : look.hp;
  const max = own ? own.maxHp : look.maxHp;
  if (typeof hp === "number" && typeof max === "number" && max > 0) {
    const count = Math.max(0, Math.min(10, Math.round(10 * hp / max)));
    lines.push(`[${"#".repeat(count)}${"-".repeat(10 - count)}]`);
  }
  if (!self && look.creature && recall) lines.push(recall);
  const timed = self ? playerTimedEffects(game) : null;
  if (timed) {
    const statuses = timed.map((name) => name.toLowerCase().replaceAll("_", " "));
    if (statuses.length) lines.push(`Statuses: ${statuses.join(", ")}`);
  }
  const terrain = apparentTerrain(game, grid);
  if (terrain) lines.push(`Terrain: ${terrain}`);
  const visible = gridInView(game, grid);
  for (const entry2 of pile.slice(0, 5)) {
    const name = entry2.sensed || !entry2.obj ? null : describeObject(game, entry2.obj);
    lines.push(name === null ? "Remembered item" : `${visible ? "Ground" : "Remembered"}: ${name}`);
    const worn = pickupPreview && (visible || self) && !entry2.sensed && entry2.obj ? gameWornLine(game, entry2.obj) : null;
    if (worn) lines.push(`  ${worn}`);
  }
  if (pile.length > 5) lines.push("More items; use Look");
  return lines.join("\n");
}
function installHoverCards(ctx) {
  if (!ctx.flags["anybandui.mapHoverCards"] && !ctx.flags["anybandui.dungeonHoverCards"]) return () => {
  };
  if (!offers(ctx, ["describeLookGrid"]) || !ctx.display || typeof document === "undefined" || typeof window === "undefined") {
    ctx.log?.("hover cards: look or display API unavailable");
    return () => {
    };
  }
  const display = ctx.display;
  const settings = validateSettings(ctx.prefs?.get());
  let theme = themeFromPrefs(ctx.prefs?.get());
  const card = document.createElement("div");
  card.setAttribute("role", "tooltip");
  card.style.cssText = `position:fixed;z-index:1000;display:none;pointer-events:none;white-space:pre-wrap;max-width:320px;padding:8px 10px;border:1px solid ${paintColours(theme).border};border-radius:${Math.round(theme.rounding * 0.6)}px;background:${theme.surface};color:${theme.text};font:${PAINT_FONT_SIZE}px/${PAINT_LINE_HEIGHT}px ${PAINT_FONT};box-shadow:0 4px 16px #0008`;
  const paintCard = () => {
    const colours2 = paintColours(theme);
    card.style.background = theme.surface;
    card.style.color = theme.text;
    card.style.border = `1px solid ${colours2.border}`;
    card.style.borderRadius = `${Math.round(theme.rounding * 0.6)}px`;
  };
  const stopTheme2 = onThemeChange((next) => {
    theme = next;
    paintCard();
  });
  const preview = document.createElement("canvas");
  preview.width = 64;
  preview.height = 64;
  preview.style.cssText = "display:none;width:64px;height:64px;float:right;margin:0 0 4px 8px;image-rendering:pixelated";
  const body = document.createElement("span");
  card.append(preview, body);
  document.body.appendChild(card);
  let timer2 = null;
  let key = "";
  let pinned = false;
  let holdId = null;
  let down = null;
  let known = null;
  let mapWasOpen = false;
  const cancel = () => {
    if (timer2) clearTimeout(timer2);
    timer2 = null;
  };
  const hide = () => {
    cancel();
    card.style.display = "none";
    key = "";
    pinned = false;
  };
  const resolve2 = (point) => {
    const input = viewInput(ctx);
    if (ctx.snapshot && (!input || input.phase !== "play" || input.messagePending || input.prompt)) return null;
    const snap = display.snapshot();
    const map = snap.mode === "map";
    if (!pointInRect(point, mapProjection(snap))) return null;
    if (!map) {
      known = null;
      mapWasOpen = false;
    } else if (!mapWasOpen) {
      mapWasOpen = true;
      try {
        known = viewLevel(ctx);
      } catch {
        known = null;
      }
    }
    if (map ? !ctx.flags["anybandui.mapHoverCards"] : snap.mode !== "play" || !ctx.flags["anybandui.dungeonHoverCards"]) return null;
    const grid = map && known ? snapLandmark(snap, point, known.cells) ?? hoverGrid(snap, point) : hoverGrid(snap, point);
    if (!grid || grid.x >= snap.level.width || grid.y >= snap.level.height) return null;
    return { grid, map };
  };
  const show = (point, grid, map) => {
    const current = resolve2(point);
    if (!current || current.grid.x !== grid.x || current.grid.y !== grid.y || current.map !== map) {
      hide();
      return;
    }
    if (!hasLiveState(ctx)) return;
    const content = gameCard(ctx, grid, map, map ? null : creatureRecall(ctx, grid), !map && ctx.flags["anybandui.itemsPickupPreview"] === true);
    if (!content) return;
    body.textContent = content;
    preview.style.display = paintPreview(display.snapshot(), grid, map, preview) ? "block" : "none";
    card.style.display = "block";
    card.style.left = `${Math.max(0, Math.min(window.innerWidth - card.offsetWidth, point.x + 14))}px`;
    card.style.top = `${Math.max(0, Math.min(window.innerHeight - card.offsetHeight, point.y + 14))}px`;
  };
  const onMove = (event) => {
    const point = { x: event.clientX, y: event.clientY };
    if (event.pointerType === "mouse" && event.buttons) {
      if (!pinned) hide();
      return;
    }
    if (holdId === event.pointerId && down && Math.hypot(point.x - down.x, point.y - down.y) > 8) {
      holdId = null;
      cancel();
    }
    if (event.pointerType === "touch" || pinned) return;
    const resolved = resolve2(point);
    const next = resolved ? `${resolved.map}:${resolved.grid.x},${resolved.grid.y}` : "";
    if (next === key) return;
    hide();
    if (!resolved) return;
    key = next;
    timer2 = setTimeout(() => {
      if (key === next) show(point, resolved.grid, resolved.map);
    }, settings.hoverDelayMs);
  };
  const onDown = (event) => {
    hide();
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const point = { x: event.clientX, y: event.clientY };
    const resolved = resolve2(point);
    if (!resolved) return;
    if (resolved.map) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    down = point;
    holdId = event.pointerId;
    timer2 = setTimeout(() => {
      if (holdId === event.pointerId) {
        show(point, resolved.grid, resolved.map);
        pinned = true;
      }
    }, 1e3);
  };
  const onUp = (event) => {
    if (holdId === event.pointerId) {
      holdId = null;
      cancel();
    }
  };
  const onKey = () => hide();
  const onBlur = () => hide();
  document.addEventListener("pointermove", onMove);
  window.addEventListener("pointerdown", onDown, true);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
  document.addEventListener("keydown", onKey);
  window.addEventListener("blur", onBlur);
  return () => {
    stopTheme2();
    hide();
    card.remove();
    document.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("blur", onBlur);
  };
}
function paintPreview(snapshot, grid, map, preview) {
  const graphics = map ? Array.from(document.querySelectorAll('body > canvas[aria-hidden="true"]')).find((canvas) => canvas.style.zIndex === "1") : null;
  const source = graphics ?? document.getElementById("game");
  if (!(source instanceof HTMLCanvasElement)) return false;
  const projection = mapProjection(snapshot);
  if (!projection || !projection.width || !projection.height) return false;
  const cellW = projection.width / snapshot.viewport.size.width;
  const cellH = projection.height / snapshot.viewport.size.height;
  const x = projection.x + (grid.x - snapshot.viewport.origin.x) * cellW;
  const y = projection.y + (grid.y - snapshot.viewport.origin.y) * cellH;
  const sourceRect = source.getBoundingClientRect();
  if (!sourceRect.width || !sourceRect.height) return false;
  const ctx = preview.getContext("2d");
  if (!ctx) return false;
  try {
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      source,
      (x - sourceRect.left) * source.width / sourceRect.width,
      (y - sourceRect.top) * source.height / sourceRect.height,
      cellW * source.width / sourceRect.width,
      cellH * source.height / sourceRect.height,
      0,
      0,
      64,
      64
    );
    return true;
  } catch {
    return false;
  }
}

// src/qol-map-hover.ts
var TERM_COLS = 80;
var TERM_ROWS = 24;
var GLYPH_W = 16;
var GLYPH_H = 24;
function hoverDwellMs(read) {
  return validateSettings(read?.()).hoverDelayMs;
}
var TOUCH_HOLD_MS = 1e3;
var TILE_PREVIEW_PX = 64;
function pointInRect2(rect, x, y) {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}
function hoverCellAt(rect, clientX, clientY) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scale = Math.min(rect.width / (GLYPH_W * TERM_COLS), rect.height / (GLYPH_H * TERM_ROWS));
  const cellW = Math.max(4, Math.floor(GLYPH_W * scale));
  const cellH = Math.max(6, Math.floor(GLYPH_H * scale));
  const offsetX = Math.max(0, Math.floor((rect.width - cellW * TERM_COLS) / 2));
  const offsetY = Math.max(0, Math.floor((rect.height - cellH * TERM_ROWS) / 2));
  const col = Math.floor((clientX - rect.left - offsetX) / cellW);
  const row = Math.floor((clientY - rect.top - offsetY) / cellH);
  if (col < 0 || col >= TERM_COLS || row < 0 || row >= TERM_ROWS) return null;
  return { col, row };
}
function hoverCaveGrid(col, row, width, height) {
  if (width < 1 || height < 1) return null;
  const mapW = Math.min(TERM_COLS - 2, width);
  const mapH = Math.min(TERM_ROWS - 2, height);
  if (mapW < 1 || mapH < 1) return null;
  const bx = col - 1;
  const by = row - 1;
  if (bx < 0 || bx >= mapW || by < 0 || by >= mapH) return null;
  return hoverCaveGridInView(
    bx,
    by,
    mapW,
    mapH,
    { x: 0, y: 0 },
    { width, height }
  );
}
function hoverCaveGridInView(bucketX, bucketY, mapCols, mapRows, origin, size) {
  if (mapCols < 1 || mapRows < 1 || size.width < 1 || size.height < 1 || bucketX < 0 || bucketY < 0 || bucketX >= mapCols || bucketY >= mapRows) return null;
  return {
    x: origin.x + Math.min(size.width - 1, Math.floor((bucketX + 0.5) * size.width / mapCols)),
    y: origin.y + Math.min(size.height - 1, Math.floor((bucketY + 0.5) * size.height / mapRows))
  };
}
var KIND_TITLE = {
  character: "Character",
  creature: "Creature",
  item: "Item",
  trap: "Trap",
  shop: "Shop",
  terrain: "Terrain"
};
function gameCardContent(game, grid) {
  const result = lookAt(game, grid);
  const text = result?.text?.trim() ?? "";
  if (!result || !text) return null;
  const player = playerGrid(game);
  let kind;
  if (player && player.x === grid.x && player.y === grid.y) {
    kind = "character";
  } else if (result.creature) {
    kind = "creature";
  } else if (rememberedPile(game, grid).length > 0) {
    kind = "item";
  } else if (gridHasVisibleTrap(game, grid)) {
    kind = "trap";
  } else if (gridIsShop(game, grid)) {
    kind = "shop";
  } else {
    kind = "terrain";
  }
  return { kind, text, title: KIND_TITLE[kind] };
}
var hoverCardsWired = false;
function positionHoverCard(el11, clientX, clientY) {
  const GAP = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el11.offsetWidth;
  const h = el11.offsetHeight;
  let left = clientX + GAP;
  let top = clientY + GAP;
  if (left + w > vw) left = clientX - GAP - w;
  if (top + h > vh) top = clientY - GAP - h;
  el11.style.left = `${String(Math.max(0, left))}px`;
  el11.style.top = `${String(Math.max(0, top))}px`;
}
var HOVER_CARD_CELL_HEIGHT = 14;
var HOVER_CARD_CELL_WIDTH = HOVER_CARD_CELL_HEIGHT * (16 / 24);
var HOVER_CARD_BODY_MAX_CHARS = Math.max(
  10,
  Math.floor((360 - 20 - TILE_PREVIEW_PX - 10) / HOVER_CARD_CELL_WIDTH)
);
var HOVER_CARD_TITLE_MAX_CHARS = Math.max(10, Math.floor((360 - 20) / HOVER_CARD_CELL_WIDTH));
function paintHoverCardText(container, text, css, maxChars, multiParagraph) {
  const lines = multiParagraph ? wrapBitmapParagraphs(text, maxChars) : wrapBitmapText(text, maxChars);
  container.replaceChildren(
    bitmapTextBlock(
      lines.map((line) => [{ text: line, css }]),
      HOVER_CARD_CELL_WIDTH,
      HOVER_CARD_CELL_HEIGHT,
      window.devicePixelRatio || 1
    )
  );
}
function buildHoverCardElement() {
  const root = document.createElement("div");
  root.setAttribute("data-anybandui-map-hover-card", "");
  Object.assign(root.style, {
    position: "fixed",
    zIndex: "2100",
    pointerEvents: "none",
    display: "none",
    maxWidth: "360px",
    padding: "8px 10px",
    borderRadius: "6px",
    background: "rgba(12,12,16,0.94)",
    border: "1px solid #777",
    boxShadow: "0 4px 16px rgba(0,0,0,0.45)"
  });
  const title = document.createElement("div");
  title.style.marginBottom = "6px";
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start"
  });
  const img = document.createElement("canvas");
  img.width = TILE_PREVIEW_PX;
  img.height = TILE_PREVIEW_PX;
  Object.assign(img.style, {
    width: `${String(TILE_PREVIEW_PX)}px`,
    height: `${String(TILE_PREVIEW_PX)}px`,
    imageRendering: "pixelated",
    flex: "0 0 auto",
    background: "#000",
    border: "1px solid #555"
  });
  const body = document.createElement("div");
  Object.assign(body.style, {
    flex: "1 1 auto",
    minWidth: "0"
  });
  row.appendChild(img);
  row.appendChild(body);
  root.appendChild(title);
  root.appendChild(row);
  document.body.appendChild(root);
  return { root, title, img, body };
}
function paintTilePreview(canvas, grid, termCell, view, termSize) {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return false;
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  const overlays = Array.from(
    document.querySelectorAll('body > canvas[aria-hidden="true"]')
  );
  for (const src of overlays) {
    if (src === canvas || src.id === "game") continue;
    if (src.width < 1 || src.height < 1) continue;
    if (view.size.width < 1 || view.size.height < 1) continue;
    const cellW2 = src.width / view.size.width;
    const cellH2 = src.height / view.size.height;
    if (cellW2 < 1 || cellH2 < 1) continue;
    const sourceX = grid.x - view.origin.x;
    const sourceY = grid.y - view.origin.y;
    if (sourceX < 0 || sourceY < 0 || sourceX >= view.size.width || sourceY >= view.size.height) {
      continue;
    }
    try {
      ctx2d.drawImage(
        src,
        sourceX * cellW2,
        sourceY * cellH2,
        cellW2,
        cellH2,
        0,
        0,
        canvas.width,
        canvas.height
      );
      return true;
    } catch {
    }
  }
  const game = document.getElementById("game");
  if (!(game instanceof HTMLCanvasElement) || !termCell) return false;
  if (game.width < 1 || game.height < 1) return false;
  const cellW = game.width / termSize.cols;
  const cellH = game.height / termSize.rows;
  if (cellW < 1 || cellH < 1) return false;
  try {
    ctx2d.drawImage(
      game,
      termCell.col * cellW,
      termCell.row * cellH,
      cellW,
      cellH,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return true;
  } catch {
    return false;
  }
}
function installMapHoverCards(ctx) {
  if (ctx.flags["anybandui.mapHoverCards"] !== true) return () => {
  };
  if (hoverCardsWired) return () => {
  };
  if (typeof document === "undefined" || typeof window === "undefined") return () => {
  };
  if (!offers(ctx, ["describeLookGrid", "knownPile"])) return () => {
  };
  hoverCardsWired = true;
  const abort = new AbortController();
  const card = buildHoverCardElement();
  let mapOpenGuess = false;
  let touchPinned = false;
  let dwellTimer = null;
  let holdTimer = null;
  let dwellGridKey = null;
  let holdPointerId = null;
  let shownGridKey = null;
  let lastClientX = 0;
  let lastClientY = 0;
  const gridKey = (g) => `${String(g.x)},${String(g.y)}`;
  const clearDwell = () => {
    if (dwellTimer !== null) clearTimeout(dwellTimer);
    dwellTimer = null;
    dwellGridKey = null;
  };
  const clearHold = () => {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    holdPointerId = null;
  };
  const hide = () => {
    card.root.style.display = "none";
    shownGridKey = null;
    touchPinned = false;
  };
  const resolveCaveGrid = (clientX, clientY) => {
    const game = document.getElementById("game");
    if (!game) return null;
    const chunk = levelSize(ctx);
    if (!chunk || chunk.width < 1 || chunk.height < 1) return null;
    const snapshot = ctx.display?.snapshot();
    if (snapshot?.mode === "map") {
      const region = snapshot.regions.map;
      const pixels = region?.pixels;
      const cells = region?.cells;
      if (!pixels || !cells) return null;
      const view = {
        origin: { x: snapshot.viewport.origin.x, y: snapshot.viewport.origin.y },
        size: { width: snapshot.viewport.size.width, height: snapshot.viewport.size.height }
      };
      let projection = pixels;
      let mapCols = cells.cols;
      let mapRows = cells.rows;
      const graphics = Array.from(
        document.querySelectorAll('body > canvas[aria-hidden="true"]')
      ).filter((candidate) => candidate !== card.img && candidate.id !== "game");
      if (graphics.length > 0) {
        const rect = graphics[graphics.length - 1].getBoundingClientRect();
        projection = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
        mapCols = view.size.width;
        mapRows = view.size.height;
      }
      if (!pointInRect2(projection, clientX, clientY) || projection.width <= 0 || projection.height <= 0) {
        return null;
      }
      const bucketX = Math.floor((clientX - projection.x) * mapCols / projection.width);
      const bucketY = Math.floor((clientY - projection.y) * mapRows / projection.height);
      const grid2 = hoverCaveGridInView(
        bucketX,
        bucketY,
        mapCols,
        mapRows,
        view.origin,
        view.size
      );
      if (!grid2) return null;
      const regionCol = Math.max(0, Math.min(
        cells.cols - 1,
        Math.floor((clientX - pixels.x) * cells.cols / pixels.width)
      ));
      const regionRow = Math.max(0, Math.min(
        cells.rows - 1,
        Math.floor((clientY - pixels.y) * cells.rows / pixels.height)
      ));
      return {
        grid: grid2,
        cell: { col: cells.col + regionCol, row: cells.row + regionRow },
        view,
        termSize: { cols: snapshot.grid.cols, rows: snapshot.grid.rows }
      };
    }
    const cell2 = hoverCellAt(game.getBoundingClientRect(), clientX, clientY);
    if (!cell2) return null;
    const grid = hoverCaveGrid(cell2.col, cell2.row, chunk.width, chunk.height);
    if (!grid) return null;
    return {
      grid,
      cell: cell2,
      view: { origin: { x: 0, y: 0 }, size: { width: chunk.width, height: chunk.height } },
      termSize: { cols: TERM_COLS, rows: TERM_ROWS }
    };
  };
  const showAt = (clientX, clientY, resolved) => {
    if (!hasLiveState(ctx)) return false;
    const content = gameCardContent(ctx, resolved.grid);
    if (!content) return false;
    paintHoverCardText(card.title, content.title, "#f0d878", HOVER_CARD_TITLE_MAX_CHARS, false);
    paintHoverCardText(card.body, content.text, "#e8e8e8", HOVER_CARD_BODY_MAX_CHARS, true);
    const painted2 = paintTilePreview(
      card.img,
      resolved.grid,
      resolved.cell,
      resolved.view,
      resolved.termSize
    );
    card.img.style.display = painted2 ? "block" : "none";
    card.root.style.display = "block";
    positionHoverCard(card.root, clientX, clientY);
    shownGridKey = gridKey(resolved.grid);
    return true;
  };
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "M") {
      mapOpenGuess = true;
      return;
    }
    mapOpenGuess = false;
    clearDwell();
    clearHold();
    hide();
  }, { signal: abort.signal });
  window.addEventListener(
    "pointerdown",
    (ev) => {
      if (ctx.display?.snapshot().mode !== "map" && !mapOpenGuess) return;
      const resolved = resolveCaveGrid(ev.clientX, ev.clientY);
      if (touchPinned) {
        const same4 = resolved !== null && shownGridKey !== null && gridKey(resolved.grid) === shownGridKey;
        if (same4) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          return;
        }
        hide();
        clearHold();
        if (!resolved) {
          mapOpenGuess = false;
          return;
        }
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (ev.pointerType === "touch" || ev.pointerType === "pen") {
          holdPointerId = ev.pointerId;
          const atDown = resolved;
          holdTimer = setTimeout(() => {
            holdTimer = null;
            if (twoFingerGestureActive()) return;
            if (showAt(ev.clientX, ev.clientY, atDown)) touchPinned = true;
          }, TOUCH_HOLD_MS);
        }
        return;
      }
      if (!resolved) {
        mapOpenGuess = false;
        clearDwell();
        clearHold();
        hide();
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      clearDwell();
      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        clearHold();
        holdPointerId = ev.pointerId;
        const atDown = resolved;
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (twoFingerGestureActive()) return;
          if (showAt(ev.clientX, ev.clientY, atDown)) touchPinned = true;
        }, TOUCH_HOLD_MS);
      }
    },
    { capture: true, signal: abort.signal }
  );
  window.addEventListener("pointerup", (ev) => {
    if (holdPointerId !== null && ev.pointerId === holdPointerId && holdTimer !== null) {
      clearHold();
    }
  }, { signal: abort.signal });
  window.addEventListener("pointercancel", (ev) => {
    if (holdPointerId !== null && ev.pointerId === holdPointerId) clearHold();
  }, { signal: abort.signal });
  document.addEventListener("pointermove", (ev) => {
    if (ctx.display?.snapshot().mode !== "map" && !mapOpenGuess) return;
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    if (ev.pointerType === "touch" || ev.pointerType === "pen") {
      if (holdTimer !== null && holdPointerId === ev.pointerId) {
        const resolved2 = resolveCaveGrid(ev.clientX, ev.clientY);
        if (!resolved2) clearHold();
      }
      return;
    }
    if (touchPinned) return;
    const resolved = resolveCaveGrid(ev.clientX, ev.clientY);
    if (!resolved) {
      clearDwell();
      if (shownGridKey !== null) hide();
      return;
    }
    const key = gridKey(resolved.grid);
    if (shownGridKey === key) {
      positionHoverCard(card.root, ev.clientX, ev.clientY);
      return;
    }
    if (shownGridKey !== null) hide();
    if (dwellGridKey === key) return;
    clearDwell();
    dwellGridKey = key;
    dwellTimer = setTimeout(() => {
      dwellTimer = null;
      const still = resolveCaveGrid(lastClientX, lastClientY);
      if (!still || gridKey(still.grid) !== key) return;
      showAt(lastClientX, lastClientY, still);
    }, hoverDwellMs(() => ctx.prefs?.get()));
  }, { signal: abort.signal });
  return () => {
    abort.abort();
    clearDwell();
    clearHold();
    card.root.remove();
    hoverCardsWired = false;
  };
}

// src/item-rules.ts
function itemRuleLines(rules) {
  return [
    ...rules.quality.filter((rule) => rule.threshold > 0).map((rule) => `${rule.name}: ${rule.thresholdName}`),
    ...rules.kinds.flatMap((rule) => {
      const note = rule.noteAware ?? rule.noteUnaware;
      const parts = [rule.ignoreAware || rule.ignoreUnaware ? "ignored" : "", note ? `inscribed ${note}` : ""].filter(Boolean);
      return parts.length ? [`${rule.name}: ${parts.join(", ")}`] : [];
    }),
    ...rules.egos.filter((rule) => rule.ignored).map((rule) => `${rule.name}: ignored`)
  ];
}
var QUALITY_NAMES = ["no ignore", "bad", "average", "good", "non-artifact"];
var LIMITED_QUALITY = /* @__PURE__ */ new Set([24, 25]);
var NOTE_LIMIT = 79;
function qualityChoices(row) {
  return row.levels ?? (LIMITED_QUALITY.has(row.itype) ? QUALITY_NAMES.slice(0, 2) : QUALITY_NAMES);
}
function ruleEditorRows(rules, filter, limit = 30) {
  const needle = filter.trim().toLowerCase();
  const typeName = new Map(rules.quality.map((row) => [row.itype, row.name]));
  const kinds2 = rules.kinds.filter((row) => needle ? row.name.toLowerCase().includes(needle) : row.ignoreAware || row.ignoreUnaware || row.noteAware !== null || row.noteUnaware !== null);
  const egos = rules.egos.map((row) => ({ ...row, typeName: typeName.get(row.itype) ?? "" })).filter((row) => needle ? `${row.name} ${row.typeName}`.toLowerCase().includes(needle) : row.ignored);
  const quality = needle ? rules.quality.filter((row) => row.name.toLowerCase().includes(needle)) : rules.quality;
  const shownKinds = kinds2.slice(0, limit);
  const shownEgos = egos.slice(0, Math.max(0, limit - shownKinds.length));
  return { quality, kinds: shownKinds, egos: shownEgos, hidden: kinds2.length + egos.length - shownKinds.length - shownEgos.length };
}
function ruleIntent(rules, rule, index, value2, itype) {
  if (rule === "quality") {
    const row = rules.quality.find((entry2) => entry2.itype === index);
    if (!row || typeof value2 !== "number" || !Number.isInteger(value2) || value2 < 0 || value2 >= qualityChoices(row).length) return { reason: "That ignore level is not available for this item type." };
    return { intent: { kind: "item-rule", rule, index, value: value2 } };
  }
  if (rule === "ego") {
    if (typeof value2 !== "boolean" || itype === void 0 || !rules.egos.some((row) => row.eidx === index && row.itype === itype)) return { reason: "That ego is not in your knowledge list." };
    return { intent: { kind: "item-rule", rule, index, itype, value: value2 } };
  }
  if (!rules.kinds.some((row) => row.kidx === index)) return { reason: "That item kind is not in your knowledge list." };
  if (rule === "note-aware" || rule === "note-unaware") {
    if (typeof value2 !== "string") return { reason: "An inscription must be text." };
    const note = value2.trim();
    if (note.length > NOTE_LIMIT) return { reason: `An inscription can be at most ${NOTE_LIMIT} characters.` };
    return { intent: { kind: "item-rule", rule, index, value: note } };
  }
  if (typeof value2 !== "boolean") return { reason: "Choose on or off." };
  return { intent: { kind: "item-rule", rule, index, value: value2 } };
}
function intentAvailable(ctx, kind) {
  try {
    return ctx.intent?.catalogue?.()?.intents.some((entry2) => entry2.kind === kind) ?? false;
  } catch {
    return false;
  }
}
function submitItemIntent(ctx, token, intent) {
  const result = ctx.intent?.submit(token, intent) ?? { accepted: false, reason: "Intent seam unavailable." };
  return result.code === "controller-owned" ? { ...result, quiet: true } : result;
}
function rulesEditable(ctx, phase, promptOpen) {
  return phase === "play" && !promptOpen && playerIsDriving(ctx) && intentAvailable(ctx, "item-rule");
}

// src/view-model/items.ts
var NAME_COLOURS = {
  slate: "#808080",
  orange: "#ff8000",
  red: "#c00000",
  green: "#008040",
  blue: "#0040ff",
  umber: "#804000",
  "light dark": "#606060",
  "light slate": "#c0c0c0",
  "light purple": "#ff00ff",
  yellow: "#ffff00",
  "light red": "#ff4040",
  "light green": "#00ff00",
  "light blue": "#00ffff",
  "light umber": "#c08040",
  purple: "#900090",
  violet: "#9020ff",
  teal: "#00a0a0",
  mud: "#6c6c30",
  "light yellow": "#ffff90",
  "magenta pink": "#ff00a0",
  "light teal": "#20ffdc",
  "light violet": "#b8a8ff",
  "light pink": "#ff8080",
  mustard: "#b4b400",
  "blue slate": "#a0c0d0",
  "deep light blue": "#00b0ff"
};
var ATTR_LETTERS = {
  s: "slate",
  o: "orange",
  r: "red",
  g: "green",
  b: "blue",
  u: "umber",
  D: "light dark",
  W: "light slate",
  P: "light purple",
  y: "yellow",
  R: "light red",
  G: "light green",
  B: "light blue",
  U: "light umber",
  p: "purple",
  v: "violet",
  t: "teal",
  m: "mud",
  Y: "light yellow",
  i: "magenta pink",
  T: "light teal",
  V: "light violet",
  I: "light pink",
  M: "mustard",
  z: "blue slate",
  Z: "deep light blue"
};
function itemColour(item) {
  const raw = item.nameColor;
  if (raw) {
    const name = raw.length === 1 ? ATTR_LETTERS[raw] : raw.toLowerCase().replace(/[-_]+/g, " ").trim();
    if (name === "white" || name === "dark" || raw === "w" || raw === "d") return "inherit";
    const colour = name ? NAME_COLOURS[name] : void 0;
    if (colour) return colour;
  }
  return item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit";
}
function slotLabel(slots, slot) {
  const name = slots?.[slot]?.name;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : void 0;
}
function adaptItems(snap) {
  const world = viewWorld(snap);
  if (!world.inventory || !world.equipment) return null;
  const row = (item, location2, extra = {}) => {
    const family = item.kindKey ?? item.kindId ?? `${item.tval}:${item.sval}`;
    const slotName = extra.slot === void 0 ? void 0 : slotLabel(world.equipmentSlots, extra.slot);
    const key = location2 === "floor" ? item.itemKey ?? `floor:${extra.floorIndex}:${family}` : item.itemKey ?? `gear:${item.handle}`;
    const label2 = item.name ?? item.label;
    return {
      handle: item.handle,
      key,
      label: label2,
      quantity: item.number,
      location: location2,
      ...extra.slot === void 0 ? {} : { slot: extra.slot },
      ...slotName === void 0 ? {} : { slotName },
      ...extra.floorIndex === void 0 ? {} : { floorIndex: extra.floorIndex },
      colour: itemColour(item),
      inscription: item.inscription,
      family,
      ...item.ignored === void 0 ? {} : { ignored: item.ignored }
    };
  };
  return {
    token: snap.token,
    phase: snap.phase,
    prompt: snap.prompt,
    rows: [
      ...world.inventory.map((item) => row(item, "pack")),
      ...world.equipment.flatMap((item, slot) => item ? [row(item, "equipment", { slot })] : [])
    ],
    quiver: world.quiver ? world.quiver.map((item) => row(item, "quiver")) : null,
    floor: world.floorHere ? world.floorHere.map((item, floorIndex) => row(item, "floor", { floorIndex })) : null,
    player: world.player?.grid ? { x: world.player.grid.x, y: world.player.grid.y } : null
  };
}
function panelRows(model) {
  return [...model.rows, ...model.quiver ?? [], ...model.floor ?? []];
}
function compareItem(ctx, token, handle) {
  if (!canSimulateLoadout(ctx)) return null;
  const before = viewInput(ctx);
  if (!before || before.token.epoch !== token.epoch || before.token.revision !== token.revision) return null;
  const ref = typeof handle === "number" ? { from: "gear", handle } : { from: "store", ...handle };
  return simulateLoadout(ctx, { wield: [ref] });
}
function compareSlots(ctx, token, handle) {
  const same4 = (other) => other.epoch === token.epoch && other.revision === token.revision;
  if (ctx.inspect?.compareLoadoutSlots) {
    const ref = typeof handle === "number" ? { from: "gear", handle } : { from: "store", ...handle };
    let result = null;
    try {
      result = ctx.inspect.compareLoadoutSlots(ref);
    } catch {
      result = null;
    }
    if (result) return same4(result.token) ? result.slots : null;
  }
  const sim = compareItem(ctx, token, handle);
  if (!sim) return null;
  const placement = sim.placements[0];
  if (!placement || sim.unresolved.length) return [];
  const slots = viewWorld(viewInput(ctx))?.equipmentSlots;
  return [{ slot: placement.slot, name: slots?.[placement.slot]?.name ?? "", comparison: sim }];
}
function defaultSlot(slots) {
  const empty = slots.find((entry2) => entry2.comparison.placements.some((placement) => placement.slot === entry2.slot && !placement.displaced));
  return (empty ?? slots[0])?.slot ?? null;
}
var AcquisitionChanges = class {
  previous = /* @__PURE__ */ new Map();
  families = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  epoch;
  // The first look at a game only records what is carried, as upstream's
  // InventoryChanges does, so a loaded character's pack is not all marked new.
  initialized = false;
  reset() {
    this.previous.clear();
    this.families.clear();
    this.pending.clear();
    this.initialized = false;
  }
  update(model) {
    if (model.phase !== "play" && model.phase !== "store") {
      this.reset();
      this.epoch = void 0;
      return;
    }
    if (this.epoch !== model.token.epoch) {
      this.reset();
      this.epoch = model.token.epoch;
    }
    const current = /* @__PURE__ */ new Map();
    const totals = /* @__PURE__ */ new Map();
    const familyOf = /* @__PURE__ */ new Map();
    for (const item of [...model.rows, ...model.quiver ?? []]) {
      if (!item.handle) continue;
      const key = this.keyOf(item);
      const count = Math.max(0, item.quantity);
      current.set(key, (current.get(key) ?? 0) + count);
      totals.set(item.family, (totals.get(item.family) ?? 0) + count);
      familyOf.set(key, item.family);
    }
    if (this.initialized) {
      const gains = new Map([...totals].map(([family, count]) => [family, Math.max(0, count - (this.families.get(family) ?? 0))]));
      for (const [key, count] of current) {
        const family = familyOf.get(key);
        const before = this.previous.get(key) ?? 0;
        const added = Math.min(Math.max(0, count - before), gains.get(family) ?? 0);
        if (added > 0) {
          const entry2 = this.pending.get(key);
          this.pending.set(key, { amount: (entry2?.amount ?? 0) + added, fresh: (entry2?.fresh ?? false) || before === 0 });
          gains.set(family, (gains.get(family) ?? 0) - added);
        }
      }
    }
    for (const [key, value2] of this.pending) {
      const count = current.get(key) ?? 0;
      if (!count) this.pending.delete(key);
      else if (value2.amount > count) this.pending.set(key, { ...value2, amount: count });
    }
    this.previous = current;
    this.families = totals;
    this.initialized = true;
  }
  badge(item) {
    const entry2 = this.pending.get(this.keyOf(item));
    return entry2 ? entry2.fresh ? "NEW" : `+${entry2.amount}` : null;
  }
  acknowledge(item) {
    this.pending.delete(this.keyOf(item));
  }
  // The kind key and the gear key: a stack keeps its mark when its letter changes,
  // and a handle reused for another kind is a new item.
  keyOf(item) {
    return `${item.family}|${item.key}`;
  }
};

// src/item-interactions.ts
function quantityShortcut(prompt, shortcut) {
  return shortcut === "One" ? 1 : shortcut === "Half" ? Math.max(1, Math.floor(prompt.max / 2)) : prompt.max;
}
function answerQuantity(seam, prompt, amount) {
  if (!Number.isSafeInteger(amount) || amount < prompt.min || amount > prompt.max) return { accepted: false, reason: `Choose an amount from ${prompt.min} to ${prompt.max}.` };
  return seam?.reply(prompt.promptId, amount) ?? { accepted: false, reason: "Prompt reply unavailable." };
}
function answerItem(seam, prompt, handle) {
  if (!prompt.choices.some((choice) => choice.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return seam?.reply(prompt.promptId, handle) ?? { accepted: false, reason: "Prompt reply unavailable." };
}
function buildItemCommand(code, handle, inscription) {
  if (code === "wield" || code === "takeoff" || code === "drop") return { code, args: { handle } };
  return { code, args: inscription === void 0 ? { handle } : { handle, inscription } };
}
function buildFloorCommand(code, floorIndex, inscription) {
  return { code, args: inscription === void 0 ? { floor: floorIndex } : { floor: floorIndex, inscription } };
}
function submitItem(intent, inspect, token, code, handle, command) {
  const tester = inspect?.itemTester(code);
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "handle" in item && item.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return intent?.submit(token, { kind: "command", command }) ?? { accepted: false, reason: "Intent seam unavailable." };
}
function submitFloorItem(intent, inspect, token, code, floor, command) {
  const tester = inspect?.itemTester(code);
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "floor" in item && item.floor.x === floor.x && item.floor.y === floor.y && item.floor.index === floor.index)) return { accepted: false, reason: "Item is unavailable for this action." };
  return intent?.submit(token, { kind: "command", command }) ?? { accepted: false, reason: "Intent seam unavailable." };
}
function submitIgnore(ctx, token, kind, handle) {
  const tester = ctx.inspect?.itemTester("ignore");
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "handle" in item && item.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return submitItemIntent(ctx, token, { kind, handle });
}
function floorChoiceIndex(handle) {
  return handle < 0 ? -handle - 1 : null;
}

// src/item-inspection.ts
var LABEL = /^([^\n:]{1,40}):[ \t]*\n/u;
function inspectionBlocks(result) {
  const sections = result.sections;
  if (!sections?.length) return [{ heading: result.title, body: result.text, open: true }];
  const title = sections.find((section2) => section2.kind === "title")?.text ?? result.title;
  const description = sections.filter((section2) => section2.kind === "description").map((section2) => section2.text).join("\n\n");
  const blocks = [{ heading: title, body: description, open: true }];
  for (const section2 of sections) {
    if (section2.kind !== "info") continue;
    const label2 = LABEL.exec(section2.text);
    if (label2) {
      blocks.push({ heading: label2[1].trim(), body: section2.text.slice(label2[0].length), open: true });
      continue;
    }
    const [first = "", ...rest2] = section2.text.split("\n");
    blocks.push(rest2.length ? { heading: first.trim(), body: rest2.join("\n"), open: true, lead: true } : { heading: "", body: first, open: true });
  }
  return blocks;
}

// src/panels/equipment-portrait.ts
var ANCHORS = [
  { slot: "head", label: "Head", right: false, row: 0, x: 8, y: 1 },
  { slot: "neck", label: "Neck", right: false, row: 1, x: 9, y: 3 },
  { slot: "body", label: "Body", right: false, row: 2, x: 7, y: 6 },
  { slot: "weapon", label: "Weapon", right: false, row: 3, x: 3, y: 8 },
  { slot: "right hand", label: "Right ring", right: false, row: 4, x: 3, y: 8.6 },
  { slot: "feet", label: "Feet", right: false, row: 5, x: 7, y: 16 },
  { slot: "back", label: "Cloak", right: true, row: 0, x: 14, y: 4 },
  { slot: "shooting", label: "Ranged", right: true, row: 1, x: 15, y: 5 },
  { slot: "arm", label: "Shield", right: true, row: 2, x: 17, y: 6.5 },
  { slot: "hands", label: "Hands", right: true, row: 3, x: 17, y: 8 },
  { slot: "left hand", label: "Left ring", right: true, row: 4, x: 17, y: 8.6 },
  { slot: "light", label: "Light", right: true, row: 5, x: 13, y: 9 }
];
var FIGURE = [
  "        .---.        ",
  "        |o o|        ",
  "        '---'        ",
  "      ___| |___      ",
  "     /   | |   \\     ",
  "    / /| : : |\\ \\    ",
  "   / / | : : | \\ \\   ",
  "  |_|  |=====|  |_|  ",
  "  [ ]  | : : |  [ ]  ",
  "       /-----\\       ",
  "       | | | |       ",
  "       | | | |       ",
  "       | | | |       ",
  "       | | | |       ",
  "       | | | |       ",
  "     __|_| |_|__     ",
  "    |____| |____|    "
];
function displayName(name, anchor, index) {
  if (anchor) return anchor.label;
  if (!name) return `Slot ${index + 1}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
function layoutPortrait(slots, worn) {
  const defined = slots?.length ? slots.map((slot, index) => ({ index, name: slot.name })) : worn.flatMap((item) => item.slot === void 0 ? [] : [{ index: item.slot, name: (item.slotName ?? "").toLowerCase() }]);
  return defined.map(({ index, name }) => {
    const anchor = ANCHORS.find((entry2) => entry2.slot === name.trim().toLowerCase()) ?? null;
    const item = worn.find((row) => row.slot === index) ?? null;
    return {
      index,
      name,
      label: displayName(name, anchor, index),
      item: item?.label ?? null,
      colour: item?.colour ?? null,
      inscription: item?.inscription ?? null,
      key: item?.key ?? `empty:${index}`,
      right: anchor?.right ?? null,
      row: anchor?.row ?? null,
      x: anchor?.x ?? null,
      y: anchor?.y ?? null
    };
  });
}
function stepSelection(count, index, key) {
  if (count <= 0) return null;
  if (index < 0) {
    if (key === "End") return count - 1;
    if (key === "Home" || key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") return 0;
    return null;
  }
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  return null;
}
function el2(parent, tag, text) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  parent.appendChild(child);
  return child;
}
function renderEquipmentPortrait(parent, slots, worn, selectedKey, onSelect) {
  const cards = layoutPortrait(slots, worn);
  const occupied = cards.filter((card) => card.item).length;
  const wrap = el2(parent, "div");
  wrap.className = "portrait";
  el2(wrap, "p", `${occupied} / ${cards.length} slots occupied`).className = "muted";
  const body = el2(wrap, "div");
  body.className = "body";
  const figure = el2(body, "pre", FIGURE.join("\n"));
  figure.className = "figure";
  const extras = el2(wrap, "div");
  extras.className = "extras";
  const selected = Math.max(0, cards.findIndex((card) => card.key === selectedKey));
  cards.forEach((card, index) => {
    const button7 = el2(card.row === null ? extras : body, "button");
    button7.type = "button";
    button7.className = card.row === null ? "slotcard" : `slotcard ${card.right ? "right" : "left"}`;
    if (card.row !== null) button7.style.gridRow = String(card.row + 1);
    button7.setAttribute("aria-pressed", String(card.key === selectedKey));
    if (index === selected) button7.dataset["focus"] = "portrait-slot";
    const title = el2(button7, "b", card.label);
    if (!card.item) title.className = "muted";
    const name = el2(button7, "span", card.item ?? "Empty");
    if (card.colour) name.style.color = card.colour;
    if (!card.item) name.className = "muted";
    if (card.inscription) button7.title = card.inscription;
    button7.addEventListener("click", () => onSelect(card.key));
  });
  wrap.addEventListener("keydown", (event) => {
    const next = stepSelection(cards.length, cards.findIndex((card2) => card2.key === selectedKey), event.key);
    if (next === null) return;
    event.preventDefault();
    const card = cards[next];
    if (card) onSelect(card.key);
  });
}

// src/pickup-preview.ts
function previewFloorItem(ctx, token, grid, floorIndex) {
  const before = viewInput(ctx);
  if (!before || before.token.epoch !== token.epoch || before.token.revision !== token.revision) return null;
  let object = null;
  try {
    object = floorObject(ctx, grid, floorIndex);
  } catch {
    object = null;
  }
  if (!object || !canSimulateLoadout(ctx)) return null;
  let sim = null;
  try {
    sim = simulateLoadout(ctx, { wield: [{ from: "object", object }] });
  } catch {
    sim = null;
  }
  return sim && !sim.unresolved.length && sim.placements.length ? sim : null;
}
function carriedCount(model, item) {
  return [...model.rows, ...model.quiver ?? []].filter((row) => row.family === item.family).reduce((sum, row) => sum + row.quantity, 0);
}
function carriedText(count) {
  return count === 0 ? "You carry none of these." : count === 1 ? "You already carry one of these." : `You already carry ${count} of these.`;
}

// src/panels/items.ts
var CSS2 = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}.items{position:absolute;right:12px;top:12px;width:min(440px,44vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 5px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}input[type=search]{width:100%}.tabs,.actions,.quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}table{width:100%;border-collapse:collapse}th{text-align:left;position:sticky;top:0;background:var(--anyband-surface)}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}tr.new{background:#437d5541}tr.chosen{outline:1px solid var(--anyband-accent)}.row{width:100%;text-align:left;border:0;background:transparent}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer;font-weight:bold}.muted{opacity:.65}.gain{color:#80b891}.loss{color:#ff7559}.error{color:#ff7559}.prompt{border:1px solid var(--anyband-accent);padding:8px;margin:8px 0}.rule{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;padding:3px 0;border-bottom:1px solid var(--anyband-accent)}.rule .name{flex:1 1 12em}.rule input[type=text]{width:9em}.info{white-space:pre-wrap;margin:4px 0}summary.lead{font-weight:normal;color:inherit}.portrait .body{display:grid;grid-template-columns:minmax(8em,auto) auto minmax(8em,auto);align-items:center;column-gap:8px;margin:8px 0}.portrait .figure{grid-column:2;grid-row:1 / span 6;margin:0;white-space:pre;font:inherit}.portrait .left{grid-column:1;justify-self:end;text-align:right}.portrait .right{grid-column:3;justify-self:start;text-align:left}.slotcard{display:flex;flex-direction:column;gap:2px;max-width:14em}.portrait .extras{margin-top:8px}`;
var ACTIONS = ["wield", "takeoff", "drop", "inscribe", "use"];
var ACTION_LABELS = { wield: "Wield", takeoff: "Take off", drop: "Drop", inscribe: "Inscribe", use: "Use" };
var USE_CODES = ["activate", "use-staff", "aim-wand", "zap-rod", "eat", "quaff", "read"];
var TAB_NAMES = { pack: "Pack", equipment: "Equipment", quiver: "Quiver" };
function el3(parent, tag, text) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  parent.appendChild(child);
  return child;
}
function button(parent, label2, action) {
  const b = el3(parent, "button", label2);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function same(a, b) {
  return a.epoch === b.epoch && a.revision === b.revision;
}
function textControl(node2) {
  const name = typeof node2.tagName === "string" ? node2.tagName.toLowerCase() : "";
  if (name !== "input" && name !== "textarea") return null;
  return node2;
}
function installItems(ctx) {
  const flags = ctx.flags ?? {};
  const portraitOn = flags["anybandui.equipmentPortrait"] === true;
  if (!portraitOn && !Object.entries(flags).some(([key, on]) => key.startsWith("anybandui.items") && on && (key !== "anybandui.itemsRules" || !!ctx.inspect?.itemRules))) return () => {
  };
  if (!ctx.snapshot) {
    ctx.log("items: snapshot seam unavailable");
    return () => {
    };
  }
  let repaint = () => {
  };
  const surfaces = openSurfaces(
    ctx,
    [{ key: "items", label: "Items", tab: "Items", minSize: { width: 280, height: 220 }, placement: { kind: "dock", target: "main", edge: "right" } }],
    { id: "items", label: "Items", className: "items" },
    CSS2,
    () => repaint()
  );
  if (!surfaces) {
    ctx.log("items: panel seam unavailable");
    return () => {
    };
  }
  let mount = document.createElement("section");
  const changes = new AcquisitionChanges();
  let tab = "pack";
  let figure = portraitOn;
  let search = "";
  let selected = null;
  let promptChoice = null;
  let unchanged = false;
  let quantity = 1;
  let promptId = -1;
  let error = "";
  let signature = "";
  let closed = false;
  let slotChoice = null;
  const ignoredHere = /* @__PURE__ */ new Set();
  let ignoreEpoch;
  let ruleFilter = "";
  let rulesOpen = false;
  const drafts = /* @__PURE__ */ new Map();
  const folded = /* @__PURE__ */ new Set();
  const enabled = (name) => flags[`anybandui.items${name}`] === true;
  const preview = enabled("PickupPreview");
  const read = () => {
    const snap = viewInput(ctx);
    return viewWorld(snap) ? adaptItems(snap) : null;
  };
  const current = (model) => {
    const latest = read();
    return !!latest && same(latest.token, model.token) && latest.phase === "play" && !latest.prompt && playerIsDriving(ctx);
  };
  const usable = (model, item, code) => {
    const tester = ctx.inspect?.itemTester(code);
    if (!tester || !same(tester.token, model.token)) return false;
    if (item.location === "floor") {
      if (item.floorIndex === void 0 || !model.player) return false;
      const x = model.player.x, y = model.player.y, index = item.floorIndex;
      return tester.items.some((ref) => "floor" in ref && ref.floor.index === index && ref.floor.x === x && ref.floor.y === y);
    }
    return tester.items.some((ref) => "handle" in ref && ref.handle === item.handle);
  };
  const readCatalogue = () => {
    try {
      return ctx.intent?.catalogue?.() ?? null;
    } catch {
      return null;
    }
  };
  const codeAcceptsFloor = (code) => {
    const entry2 = readCatalogue()?.commands?.find((c) => c.code === code);
    return !!entry2 && entry2.args.includes("floor:");
  };
  const report = (result, fallback) => {
    error = result.accepted || result.quiet ? "" : result.reason ?? fallback;
  };
  const act = (model, item, code) => {
    if (!current(model) || !ctx.intent?.submit) {
      error = "Action unavailable at this input wait.";
      paint(true);
      return;
    }
    const actualCode = code === "use" ? USE_CODES.find((candidate) => usable(model, item, candidate)) : code;
    if (!actualCode) {
      error = "No usable command is available for this item.";
      paint(true);
      return;
    }
    let inscription;
    if (code === "inscribe") {
      const input = globalThis.prompt?.("Inscription", item.inscription ?? "");
      if (input === null || input === void 0) return;
      inscription = input;
    }
    if (item.location === "floor") {
      if (item.floorIndex === void 0 || !model.player) {
        error = "Action unavailable at this input wait.";
        paint(true);
        return;
      }
      const command2 = buildFloorCommand(actualCode, item.floorIndex, inscription);
      const floor = { x: model.player.x, y: model.player.y, index: item.floorIndex };
      const result2 = submitFloorItem(ctx.intent, ctx.inspect, model.token, actualCode, floor, command2);
      report({ ...result2, quiet: result2.code === "controller-owned" }, "Action rejected.");
      paint(true);
      return;
    }
    const command = buildItemCommand(actualCode, item.handle, inscription);
    const result = submitItem(ctx.intent, ctx.inspect, model.token, actualCode, item.handle, command);
    report({ ...result, quiet: result.code === "controller-owned" }, "Action rejected.");
    paint(true);
  };
  const pickup = (model, item) => {
    if (!current(model) || !ctx.intent?.submit) {
      error = "Action unavailable at this input wait.";
      paint(true);
      return;
    }
    if (item.location !== "floor" || item.floorIndex === void 0 || !model.player) {
      error = "Action unavailable at this input wait.";
      paint(true);
      return;
    }
    const command = buildFloorCommand("pickup", item.floorIndex);
    const result = ctx.intent.submit(model.token, { kind: "command", command });
    report({ ...result, quiet: result.code === "controller-owned" }, "You cannot pick that up right now.");
    paint(true);
  };
  const ignore = (model, item, kind) => {
    if (!current(model)) {
      error = "Action unavailable at this input wait.";
      paint(true);
      return;
    }
    const result = submitIgnore(ctx, model.token, kind, item.handle);
    if (result.accepted) {
      if (kind === "ignore") ignoredHere.add(item.key);
      else ignoredHere.delete(item.key);
      error = "";
    } else if (!result.quiet && result.reason === "invalid item action") {
      if (kind === "ignore") ignoredHere.add(item.key);
      else ignoredHere.delete(item.key);
      error = kind === "ignore" ? "This item is already ignored." : "This item is not ignored.";
    } else report(result, "Action rejected.");
    paint(true);
  };
  const isIgnored = (item) => item.ignored ?? ignoredHere.has(item.key);
  const editRule = (model, rules, rule, index, value2, itype) => {
    if (!current(model)) {
      error = "Rules can be changed only while the game waits for a command.";
      paint(true);
      return;
    }
    const built = ruleIntent(rules, rule, index, value2, itype);
    if ("reason" in built) {
      error = built.reason;
      paint(true);
      return;
    }
    report(submitItemIntent(ctx, model.token, built.intent), "The game did not accept that rule.");
    paint(true);
  };
  const inspectRef = (model, item) => item.location === "floor" ? model.player && item.floorIndex !== void 0 ? { floor: { x: model.player.x, y: model.player.y, index: item.floorIndex } } : null : item.handle;
  const showPrompt = (model) => {
    if (model.phase !== "play" || !playerIsDriving(ctx)) return;
    const prompt = model.prompt;
    if (!prompt || !ctx.prompt?.reply) return;
    if (prompt.kind === "quantity" && enabled("Quantity")) {
      const q = prompt;
      if (promptId !== q.promptId) {
        promptId = q.promptId;
        quantity = q.defaultValue;
      }
      const box = el3(mount, "section");
      box.className = "prompt";
      el3(box, "h3", "Choose quantity");
      el3(box, "p", q.label);
      el3(box, "p", `Available for this action: ${q.max}`);
      const input = el3(box, "input");
      input.type = "number";
      input.min = String(q.min);
      input.max = String(q.max);
      input.value = String(quantity);
      input.addEventListener("input", () => {
        quantity = Number(input.value);
      });
      const quick = el3(box, "div");
      quick.className = "quick";
      for (const label2 of ["One", "Half", "All"]) button(quick, label2, () => {
        quantity = quantityShortcut(q, label2);
        input.value = String(quantity);
      });
      button(box, "Confirm", () => {
        const result = answerQuantity(ctx.prompt, q, quantity);
        report({ ...result, quiet: result.code === "controller-owned" }, "Prompt rejected.");
        paint(true);
      });
    } else if (prompt.kind === "item" && enabled("Choice")) {
      const p = prompt;
      if (promptId !== p.promptId) {
        promptId = p.promptId;
        promptChoice = p.choices[0]?.handle ?? null;
      }
      const box = el3(mount, "section");
      box.className = "prompt";
      el3(box, "h3", "Angband asks");
      el3(box, "p", p.label);
      const table = el3(box, "table");
      const head = el3(table, "tr");
      for (const name of ["Key", "Item", "Location", "Qty"]) el3(head, "th", name);
      const rowFor = (handle) => {
        const floor = floorChoiceIndex(handle);
        return floor === null ? panelRows(model).find((row) => row.handle === handle && row.location !== "floor") : model.floor?.[floor];
      };
      for (const choice of p.choices) {
        const item = rowFor(choice.handle);
        const row = el3(table, "tr");
        el3(row, "td", choice.letter);
        if (choice.handle === promptChoice) row.className = "chosen";
        const cell2 = el3(row, "td");
        const b = button(cell2, item ? item.label : choice.label, () => {
          promptChoice = choice.handle;
          paint(true);
        });
        b.className = "row";
        if (item) b.style.color = item.colour;
        el3(row, "td", item ? TAB_NAMES[item.location] ?? "Floor" : "Floor");
        el3(row, "td", item ? String(item.quantity) : "");
      }
      const chosen = p.choices.find((choice) => choice.handle === promptChoice);
      if (chosen) {
        const item = rowFor(chosen.handle);
        const ref = item ? inspectRef(model, item) : chosen.handle > 0 ? chosen.handle : null;
        const inspection = ref === null ? null : ctx.inspect?.inspectItem(ref);
        if (inspection && same(inspection.token, model.token)) el3(box, "p", inspection.text);
      }
      const choose = button(box, "Choose", () => {
        if (chosen) {
          const result = answerItem(ctx.prompt, p, chosen.handle);
          report({ ...result, quiet: result.code === "controller-owned" }, "Prompt rejected.");
          paint(true);
        }
      });
      choose.disabled = !chosen;
    }
  };
  const showRules = (model) => {
    const rules = enabled("Rules") ? ctx.inspect?.itemRules?.() ?? null : null;
    if (!rules || !same(rules.token, model.token)) return;
    const section2 = el3(mount, "details");
    section2.open = rulesOpen;
    section2.addEventListener("toggle", () => {
      rulesOpen = section2.open;
    });
    el3(section2, "summary", "Ignore settings and inscriptions");
    if (!rulesEditable(ctx, model.phase, !!model.prompt)) {
      const lines = itemRuleLines(rules);
      if (!lines.length) el3(section2, "p", "No ignore settings or inscriptions yet.");
      for (const line of lines) el3(section2, "div", line);
      return;
    }
    const filter = el3(section2, "input");
    filter.type = "search";
    filter.placeholder = "Find an item kind or ego";
    filter.value = ruleFilter;
    filter.dataset["focus"] = "rule-filter";
    filter.addEventListener("input", () => {
      ruleFilter = filter.value;
      paint(true);
    });
    const rows = ruleEditorRows(rules, ruleFilter);
    if (rows.quality.length) {
      el3(section2, "h4", "Ignore by quality");
      for (const row of rows.quality) {
        const line = el3(section2, "div");
        line.className = "rule";
        el3(line, "span", row.name).className = "name";
        const select = el3(line, "select");
        select.setAttribute("aria-label", `Ignore ${row.name}`);
        qualityChoices(row).forEach((name, value2) => {
          const option = el3(select, "option", name);
          option.value = String(value2);
          option.selected = value2 === row.threshold;
        });
        select.addEventListener("change", () => editRule(model, rules, "quality", row.itype, Number(select.value)));
      }
    }
    const checkbox = (line, label2, checked, change) => {
      const wrap = el3(line, "label");
      const box = el3(wrap, "input");
      box.type = "checkbox";
      box.checked = checked;
      box.addEventListener("change", () => change(box.checked));
      wrap.append(` ${label2}`);
    };
    if (rows.kinds.length) {
      el3(section2, "h4", "Item kinds");
      for (const row of rows.kinds) {
        const line = el3(section2, "div");
        line.className = "rule";
        el3(line, "span", row.name).className = "name";
        checkbox(line, "Ignore", row.ignoreAware, (value2) => editRule(model, rules, "kind-aware", row.kidx, value2));
        if (row.ignoreUnaware) checkbox(line, "Ignore unidentified", true, (value2) => editRule(model, rules, "kind-unaware", row.kidx, value2));
        const key = `note:${row.kidx}`;
        const note = el3(line, "input");
        note.type = "text";
        note.maxLength = NOTE_LIMIT;
        note.placeholder = "Inscription";
        note.dataset["focus"] = key;
        note.setAttribute("aria-label", `Auto-inscription for ${row.name}`);
        note.value = drafts.get(key) ?? row.noteAware ?? "";
        note.addEventListener("input", () => {
          drafts.set(key, note.value);
        });
        button(line, "Save", () => {
          drafts.delete(key);
          editRule(model, rules, "note-aware", row.kidx, note.value);
        });
        if (row.noteUnaware) {
          el3(line, "span", `Unidentified: ${row.noteUnaware}`);
          button(line, "Clear", () => editRule(model, rules, "note-unaware", row.kidx, ""));
        }
      }
    }
    if (rows.egos.length) {
      el3(section2, "h4", "Egos");
      for (const row of rows.egos) {
        const line = el3(section2, "div");
        line.className = "rule";
        el3(line, "span", row.typeName ? `${row.name} (${row.typeName})` : row.name).className = "name";
        checkbox(line, "Ignore", row.ignored, (value2) => editRule(model, rules, "ego", row.eidx, value2, row.itype));
      }
    }
    if (rows.hidden) el3(section2, "p", `${rows.hidden} more match. Type more of the name to narrow the list.`).className = "muted";
    else if (!ruleFilter.trim() && !rows.kinds.length && !rows.egos.length) el3(section2, "p", "No kind or ego rules yet. Type a name above to add one.").className = "muted";
  };
  const showComparison = (model, item) => {
    if (!enabled("Comparison") || item.location !== "pack") return;
    const slots = compareSlots(ctx, model.token, item.handle);
    if (!slots?.length) return;
    if (!slotChoice || slotChoice.key !== item.key || !slots.some((entry2) => entry2.slot === slotChoice.slot)) {
      const slot = defaultSlot(slots);
      slotChoice = slot === null ? null : { key: item.key, slot };
    }
    const chosen = slots.find((entry2) => entry2.slot === slotChoice?.slot) ?? slots[0];
    renderItemComparison(mount, chosen.comparison, unchanged, (value2) => {
      unchanged = value2;
      paint(true);
    }, {
      options: slots.map((entry2) => ({ slot: entry2.slot, label: slotOptionLabel(entry2.name, entry2.comparison.placements.find((placement) => placement.slot === entry2.slot)?.displaced?.label ?? null) })),
      chosen: chosen.slot,
      choose: (slot) => {
        slotChoice = { key: item.key, slot };
        paint(true);
      }
    });
  };
  const showPickupPreview = (model, item) => {
    if (!preview || item.location !== "floor" || item.floorIndex === void 0 || !model.player) return;
    el3(mount, "p", carriedText(carriedCount(model, item))).className = "muted";
    const sim = previewFloorItem(ctx, model.token, model.player, item.floorIndex);
    if (sim) renderItemComparison(mount, sim, unchanged, (value2) => {
      unchanged = value2;
      paint(true);
    });
  };
  const showInspection = (model, item) => {
    if (!enabled("Inspection") && !(preview && item.location === "floor")) return;
    const ref = inspectRef(model, item);
    const inspection = ref === null ? null : ctx.inspect?.inspectItem(ref);
    if (!inspection || !same(inspection.token, model.token)) return;
    for (const block2 of inspectionBlocks(inspection)) {
      if (!block2.heading) {
        el3(mount, "p", block2.body).className = "info";
        continue;
      }
      const details = el3(mount, "details");
      details.open = !folded.has(block2.heading);
      details.addEventListener("toggle", () => {
        if (details.open) folded.delete(block2.heading);
        else folded.add(block2.heading);
      });
      const summary = el3(details, "summary", block2.heading);
      if (block2.lead) summary.className = "lead";
      if (block2.body) el3(details, "p", block2.body).className = "info";
    }
  };
  const itemButton = (cell2, item, badge) => {
    const b = button(cell2, `${item.label}${badge ? ` ${badge}` : ""}`, () => {
      selected = item.key;
      changes.acknowledge(item);
      paint(true);
    });
    b.className = "row";
    b.style.color = item.colour;
    b.setAttribute("aria-pressed", String(selected === item.key));
    b.title = [badge === "NEW" ? "Newly acquired" : badge ? `${badge.slice(1)} acquired` : "", item.inscription ? `Inscription: ${item.inscription}` : ""].filter(Boolean).join("\n");
    return b;
  };
  const paint = (force = false) => {
    if (closed) return;
    const host = surfaces.mounts().get("items");
    if (!host) return;
    if (host !== mount) {
      mount = host;
      signature = "";
    }
    const model = read();
    mount.getRootNode().host.style.display = model?.phase === "store" ? "none" : "";
    if (model?.phase === "store") return;
    if (model && ignoreEpoch !== model.token.epoch) {
      ignoredHere.clear();
      ignoreEpoch = model.token.epoch;
    }
    const next = JSON.stringify([model, tab, search, selected, promptChoice, unchanged, quantity, error, slotChoice, [...ignoredHere], ruleFilter, figure]);
    if (!force && next === signature) return;
    signature = next;
    const active = mount.getRootNode().activeElement;
    const focusKey = active && mount.contains(active) ? active.dataset?.["focus"] : void 0;
    const editing = focusKey && active ? textControl(active) : null;
    const caret = editing ? [editing.selectionStart, editing.selectionEnd] : null;
    mount.replaceChildren();
    build(model);
    if (focusKey) {
      const field = mount.querySelector(`[data-focus="${focusKey}"]`);
      field?.focus();
      const restored = field ? textControl(field) : null;
      if (restored && caret && caret[0] !== null) restored.setSelectionRange(caret[0], caret[1]);
    }
  };
  const build = (model) => {
    el3(mount, "h2", "Items");
    if (!model) {
      el3(mount, "p", "Inventory read unavailable.");
      return;
    }
    if (enabled("Highlights")) changes.update(model);
    showPrompt(model);
    showRules(model);
    if (!enabled("Lists") && !portraitOn && !preview) return;
    if ((enabled("Lists") || preview) && model.floor?.length) {
      el3(mount, "h3", "On this tile");
      const table = el3(mount, "table");
      const head = el3(table, "tr");
      for (const name of ["Item", "Qty"]) el3(head, "th", name);
      for (const item2 of model.floor) {
        const row = el3(table, "tr");
        const b = itemButton(el3(row, "td"), item2, null);
        el3(row, "td", String(item2.quantity));
        const worn = preview && model.player && item2.floorIndex !== void 0 ? comparisonSummary(previewFloorItem(ctx, model.token, model.player, item2.floorIndex)) : null;
        if (worn) b.title = [b.title, worn].filter(Boolean).join("\n");
      }
    }
    if (enabled("Lists")) {
      const tabs = el3(mount, "div");
      tabs.className = "tabs";
      for (const name of ["pack", "equipment", "quiver"]) {
        const b = button(tabs, TAB_NAMES[name], () => {
          tab = name;
          paint(true);
        });
        b.setAttribute("aria-pressed", String(tab === name));
      }
    }
    const showFigure = portraitOn && figure && (tab === "equipment" || !enabled("Lists"));
    if (portraitOn && enabled("Lists") && tab === "equipment") {
      const views = el3(mount, "div");
      views.className = "tabs";
      const figureButton = button(views, "Figure", () => {
        figure = true;
        paint(true);
      });
      figureButton.setAttribute("aria-pressed", String(figure));
      const listButton = button(views, "List", () => {
        figure = false;
        paint(true);
      });
      listButton.setAttribute("aria-pressed", String(!figure));
    }
    if (showFigure) {
      const slots = viewWorld(viewInput(ctx))?.equipmentSlots;
      const worn = model.rows.filter((item2) => item2.location === "equipment").map((item2) => ({
        ...item2.slot === void 0 ? {} : { slot: item2.slot },
        ...item2.slotName === void 0 ? {} : { slotName: item2.slotName },
        label: item2.label,
        colour: item2.colour,
        inscription: item2.inscription,
        key: item2.key
      }));
      renderEquipmentPortrait(mount, slots, worn, selected, (key) => {
        selected = key;
        paint(true);
      });
    } else if (enabled("Lists")) {
      const searchBox = el3(mount, "input");
      searchBox.type = "search";
      searchBox.placeholder = "Search items";
      searchBox.value = search;
      searchBox.dataset["focus"] = "item-search";
      searchBox.addEventListener("input", () => {
        search = searchBox.value;
        paint(true);
      });
      const listed = tab === "quiver" ? model.quiver ?? [] : model.rows.filter((item2) => item2.location === tab);
      const rows = listed.filter((item2) => item2.label.toLowerCase().includes(search.toLowerCase()));
      if (!rows.length) el3(mount, "p", tab === "pack" ? "Your pack is empty." : tab === "equipment" ? "Nothing equipped." : model.quiver ? "Your quiver is empty." : "No quiver items available.");
      const table = el3(mount, "table");
      const head = el3(table, "tr");
      for (const name of tab === "equipment" ? ["Item", "Slot", "Qty"] : ["Item", "Qty"]) el3(head, "th", name);
      for (const item2 of rows) {
        const row = el3(table, "tr");
        const badge = enabled("Highlights") ? changes.badge(item2) : null;
        if (badge) row.className = "new";
        itemButton(el3(row, "td"), item2, badge);
        if (tab === "equipment") el3(row, "td", item2.slotName ?? String(item2.slot ?? ""));
        el3(row, "td", String(item2.quantity));
      }
    }
    const item = panelRows(model).find((row) => row.key === selected);
    if (item) {
      el3(mount, "h3", "Inspection");
      el3(mount, "strong", item.label).style.color = item.colour;
      if (enabled("Actions") && (item.handle > 0 || item.location === "floor") && model.phase === "play" && !model.prompt && ctx.intent?.submit && playerIsDriving(ctx)) {
        const actions = el3(mount, "div");
        actions.className = "actions";
        if (item.location === "floor") {
          if (codeAcceptsFloor("pickup")) button(actions, "Pick up", () => pickup(model, item));
          for (const code of ACTIONS) {
            if (code === "takeoff" || code === "drop") continue;
            if (code === "use") {
              const candidate = USE_CODES.find((entry2) => codeAcceptsFloor(entry2) && usable(model, item, entry2));
              if (candidate) button(actions, ACTION_LABELS[code], () => act(model, item, code));
            } else if (codeAcceptsFloor(code) && usable(model, item, code)) {
              button(actions, ACTION_LABELS[code], () => act(model, item, code));
            }
          }
        } else {
          for (const code of ACTIONS) {
            if (code === "use" ? USE_CODES.some((candidate) => usable(model, item, candidate)) : usable(model, item, code)) button(actions, ACTION_LABELS[code], () => act(model, item, code));
          }
        }
        const kind = isIgnored(item) ? "unignore" : "ignore";
        if (item.location !== "floor" && intentAvailable(ctx, kind) && usable(model, item, "ignore")) {
          button(actions, kind === "ignore" ? "Ignore" : "Unignore", () => ignore(model, item, kind));
        }
      }
      showComparison(model, item);
      showPickupPreview(model, item);
      showInspection(model, item);
    } else if (showFigure && selected?.startsWith("empty:")) {
      el3(mount, "h3", "Inspection");
      el3(mount, "p", "Empty").className = "muted";
    }
    if (error) {
      const message = el3(mount, "p", error);
      message.className = "error";
    }
  };
  paint(true);
  const timer2 = globalThis.setInterval(() => paint(), 200);
  repaint = () => paint(true);
  return () => {
    closed = true;
    globalThis.clearInterval(timer2);
    surfaces.close();
  };
}

// src/panels/character-sheet.ts
var STAT_HEADERS = ["Stat", "Base", "Race", "Class", "Gear", "Best", "Current"];
var SHEET_PAGES = ["Overview", "Combat", "Flags", "History"];
var OVERVIEW = /* @__PURE__ */ new Set(["topleft", "misc", "midleft"]);
var COMBAT = /* @__PURE__ */ new Set(["combat", "skills"]);
var PANEL_TITLE = {
  topleft: "Name",
  misc: "Age",
  midleft: "Level",
  combat: "Combat",
  skills: "Skills"
};
var CSS3 = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.sheet{position:absolute;left:12px;right:12px;bottom:12px;max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
button{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px;cursor:pointer}
button:focus-visible{outline:2px solid var(--anyband-accent)}
.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}
table{width:100%;border-collapse:collapse}td,th{padding:2px 4px;border-bottom:1px solid var(--anyband-accent);text-align:right}
td:first-child,th:first-child{text-align:left}
.drained{opacity:.55}.history{white-space:pre-wrap}.muted{opacity:.65}
.grid{overflow:auto;margin:8px 0}.cells{font:inherit;letter-spacing:.2em}`;
function statLabel(label2, naturalMax) {
  if (!naturalMax || label2.includes("!")) return label2;
  const colon = label2.indexOf(":");
  if (colon < 0) return `${label2}!`;
  return `${label2.slice(0, colon)}!${label2.slice(colon + 1)}`;
}
function statCells(row) {
  return {
    label: statLabel(row.label, row.naturalMax),
    base: row.natural,
    race: row.raceBonus,
    classBonus: row.classBonus,
    gear: row.equipBonus,
    best: row.best,
    current: row.reduced ?? row.best,
    drained: row.drained
  };
}
function stepSheetPage(index, key) {
  const count = SHEET_PAGES.length;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  return null;
}
function pageFocus(index) {
  const name = SHEET_PAGES[index] ?? "Overview";
  return `sheet-page-${name.toLowerCase()}`;
}
function el4(parent, tag, text) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  parent.appendChild(child);
  return child;
}
function panelTitle(key) {
  return PANEL_TITLE[key] ?? key;
}
function drawPanel(parent, panel) {
  el4(parent, "h3", panelTitle(panel.key));
  const table = el4(parent, "table");
  for (const line of panel.lines) {
    if (!line.label && !line.value) continue;
    const row = el4(table, "tr");
    el4(row, "td", line.label);
    const value2 = el4(row, "td", line.value);
    if (line.css) value2.style.color = line.css;
  }
}
function drawStats(parent, data) {
  el4(parent, "h3", "Attributes");
  const table = el4(parent, "table");
  const head = el4(table, "tr");
  for (const name of STAT_HEADERS) el4(head, "th", name);
  for (const row of data.stats) {
    const cells = statCells(row);
    const tr = el4(table, "tr");
    if (cells.drained) tr.className = "drained";
    for (const value2 of [cells.label, cells.base, cells.race, cells.classBonus, cells.gear, cells.best, cells.current]) el4(tr, "td", value2);
  }
}
function drawGrids(parent, data) {
  if (!data.grids) {
    el4(parent, "p", "The flag grid is not available in this game.").className = "muted";
    return;
  }
  if (!data.grids.length) {
    el4(parent, "p", "No flags.").className = "muted";
    return;
  }
  for (const grid of data.grids) {
    el4(parent, "h3", panelTitle(grid.key));
    const table = el4(parent, "table");
    table.className = "grid";
    for (const row of grid.rows) {
      const tr = el4(table, "tr");
      const label2 = el4(tr, "td", row.label);
      if (row.labelColor.css) label2.style.color = row.labelColor.css;
      const symbols = el4(tr, "td");
      symbols.className = "cells";
      for (const cell2 of row.cells) {
        const mark = el4(symbols, "span", cell2.symbol || " ");
        if (cell2.css) mark.style.color = cell2.css;
      }
    }
  }
}
function renderCharacterSheet(parent, data, page, onPage) {
  el4(parent, "h2", data?.name ? data.name : "Character");
  const tabs = el4(parent, "div");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");
  SHEET_PAGES.forEach((name2, index) => {
    const button7 = el4(tabs, "button", name2);
    button7.type = "button";
    button7.setAttribute("role", "tab");
    button7.setAttribute("aria-selected", String(index === page));
    button7.dataset["focus"] = pageFocus(index);
    button7.addEventListener("click", () => onPage(index));
  });
  tabs.addEventListener("keydown", (event) => {
    const next = stepSheetPage(page, event.key);
    if (next === null) return;
    event.preventDefault();
    onPage(next, true);
  });
  if (!data) {
    el4(parent, "p", "Character sheet unavailable.").className = "muted";
    return;
  }
  const name = SHEET_PAGES[page] ?? "Overview";
  if (name === "Overview") {
    for (const panel of data.panels) if (OVERVIEW.has(panel.key)) drawPanel(parent, panel);
    for (const panel of data.panels) if (!OVERVIEW.has(panel.key) && !COMBAT.has(panel.key)) drawPanel(parent, panel);
    drawStats(parent, data);
  } else if (name === "Combat") {
    const panels = data.panels.filter((panel) => COMBAT.has(panel.key));
    if (!panels.length) el4(parent, "p", "No combat details.").className = "muted";
    for (const panel of panels) drawPanel(parent, panel);
  } else if (name === "Flags") drawGrids(parent, data);
  else {
    el4(parent, "h3", "History");
    el4(parent, "p", data.history || "No background.").className = data.history ? "history" : "history muted";
  }
}
function installCharacterSheet(ctx) {
  if (ctx.flags?.["anybandui.characterSheet"] !== true) return () => {
  };
  if (!ctx.character?.sheet) ctx.log("character sheet: this game has no sheet read");
  let page = 0;
  let repaint = () => {
  };
  const surfaces = openSurfaces(
    ctx,
    [{ key: "character-sheet", label: "Character sheet", tab: "Character", minSize: { width: 360, height: 220 }, placement: { kind: "dock", target: "main", edge: "bottom" } }],
    { id: "character-sheet", label: "Character sheet", className: "sheet" },
    CSS3,
    () => repaint()
  );
  if (!surfaces) {
    ctx.log("character sheet: panel seam unavailable");
    return () => {
    };
  }
  let mount = null;
  let signature = "";
  let closed = false;
  let timer2 = null;
  const read = () => {
    try {
      return ctx.character?.sheet?.() ?? null;
    } catch {
      return null;
    }
  };
  const stopTimer = () => {
    if (timer2 === null) return;
    globalThis.clearInterval(timer2);
    timer2 = null;
  };
  const ensureTimer = () => {
    if (timer2 !== null || closed) return;
    timer2 = globalThis.setInterval(() => paint(), 200);
  };
  const paint = (force = false, nextFocus) => {
    if (closed) return;
    const host = surfaces.mounts().get("character-sheet");
    if (!host) {
      stopTimer();
      return;
    }
    ensureTimer();
    if (host !== mount) {
      mount = host;
      signature = "";
    }
    const data = read();
    const next = JSON.stringify([page, data]);
    if (!force && next === signature) return;
    signature = next;
    const active = mount.getRootNode().activeElement;
    const focusKey = nextFocus ?? (active && mount.contains(active) ? active.dataset?.["focus"] : void 0);
    mount.replaceChildren();
    renderCharacterSheet(mount, data, page, (index, moveFocus) => {
      page = index;
      paint(true, moveFocus ? pageFocus(index) : void 0);
    });
    if (focusKey) mount.querySelector(`[data-focus="${focusKey}"]`)?.focus();
  };
  paint(true);
  repaint = () => paint(true);
  return () => {
    closed = true;
    stopTimer();
    surfaces.close();
  };
}

// src/menus/openers.ts
var openers = /* @__PURE__ */ new Map();
function registerOpener(key, open) {
  openers.set(key, open);
  return () => {
    if (openers.get(key) === open) openers.delete(key);
  };
}
function openMenu(key) {
  const open = openers.get(key);
  if (!open) return false;
  open();
  return true;
}
function hasOpener(key) {
  return openers.has(key);
}

// src/theme-editor.ts
var CSS4 = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.theme{position:absolute;right:12px;top:12px;width:min(420px,44vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
button,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
button{cursor:pointer}button:focus-visible,input:focus-visible{outline:2px solid var(--anyband-accent)}
.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}.actions{display:flex;gap:6px;margin-top:8px}
.preview{margin-top:8px;padding:8px;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
.preview b{color:var(--anyband-accent)}.note{opacity:.7}`;
function draftFromTheme(theme, preset) {
  return {
    background: theme.background,
    surface: theme.surface,
    text: theme.text,
    accent: theme.accent,
    rounding: theme.rounding,
    invert_dungeon: theme.invert_dungeon,
    preset
  };
}
function customFromDraft(draft) {
  const background = normalizeColour(draft.background);
  const surface = normalizeColour(draft.surface);
  const text = normalizeColour(draft.text);
  const accent = normalizeColour(draft.accent);
  const rounding = normalizeRounding(draft.rounding);
  if (!background || !surface || !text || !accent || rounding === null) return null;
  return { background, surface, text, accent, rounding, invert_dungeon: draft.invert_dungeon };
}
function el5(parent, tag, text) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  parent.appendChild(child);
  return child;
}
function colourField(parent, label2, key, draft, onPreview) {
  const row = el5(parent, "label", label2);
  const input = el5(row, "input");
  input.type = "color";
  input.value = draft[key].slice(0, 7);
  input.setAttribute("aria-label", label2);
  input.dataset["focus"] = key;
  input.addEventListener("input", () => {
    const next = normalizeColour(input.value);
    if (next) draft[key] = next;
    onPreview();
  });
}
function renderThemeEditor(parent, draft, note, onPreview, onRebuild, onSave, onDrop) {
  el5(parent, "h2", "Theme");
  const presets = el5(parent, "div");
  presets.className = "tabs";
  for (const [id, label2] of themeChoices()) {
    const button7 = el5(presets, "button", label2);
    button7.type = "button";
    button7.setAttribute("aria-pressed", String(draft.preset === id && !draft.invert_dungeon && draft.rounding === THEMES[id].rounding && draft.background === THEMES[id].background));
    button7.addEventListener("click", () => {
      const theme = THEMES[id];
      draft.preset = id;
      draft.background = theme.background;
      draft.surface = theme.surface;
      draft.text = theme.text;
      draft.accent = theme.accent;
      draft.rounding = theme.rounding;
      draft.invert_dungeon = theme.invert_dungeon;
      onRebuild();
    });
  }
  colourField(parent, "Background", "background", draft, onPreview);
  colourField(parent, "Surface", "surface", draft, onPreview);
  colourField(parent, "Text", "text", draft, onPreview);
  colourField(parent, "Accent", "accent", draft, onPreview);
  const rounding = el5(parent, "label", "Corner rounding");
  const range = el5(rounding, "input");
  range.type = "range";
  range.min = "0";
  range.max = "16";
  range.step = "1";
  range.value = String(draft.rounding);
  range.setAttribute("aria-label", "Corner rounding");
  range.dataset["focus"] = "rounding";
  const readout = el5(rounding, "span", `${draft.rounding} px`);
  range.addEventListener("input", () => {
    const next = normalizeRounding(Number(range.value));
    if (next !== null) {
      draft.rounding = next;
      readout.textContent = `${next} px`;
      onPreview();
    }
  });
  const invert = el5(parent, "label", "Invert dungeon colours");
  const box = el5(invert, "input");
  box.type = "checkbox";
  box.checked = draft.invert_dungeon;
  box.setAttribute("aria-label", "Invert dungeon colours");
  box.dataset["focus"] = "invert";
  box.addEventListener("change", () => {
    draft.invert_dungeon = box.checked;
    onPreview();
  });
  const preview = el5(parent, "div");
  preview.className = "preview";
  el5(preview, "b", "Adventurer");
  el5(preview, "p", "A new chapter awaits.");
  const actions = el5(parent, "div");
  actions.className = "actions";
  const save = el5(actions, "button", "Save");
  save.type = "button";
  save.addEventListener("click", onSave);
  const drop = el5(actions, "button", "Drop custom theme");
  drop.type = "button";
  drop.addEventListener("click", onDrop);
  if (note) el5(parent, "p", note).className = "note";
}
function broadcastTheme(ctx, theme) {
  try {
    ctx.display?.setChromeTheme?.(chromeThemeFor(theme));
  } catch (err) {
    ctx.log(`Could not repaint the window frames: ${err instanceof Error ? err.message : String(err)}`);
  }
  installAccessibilityAccommodations({ flags: ctx.flags ?? {}, invertDungeon: theme.invert_dungeon, ...ctx.display ? { display: ctx.display } : {}, log: ctx.log });
  notifyThemeChange(theme);
}
function installThemeEditor(ctx) {
  if (ctx.flags?.["anybandui.themeEditor"] !== true) return () => {
  };
  const settings = ctx.prefs ? createSettingsStore({ prefs: ctx.prefs }) : null;
  let draft = draftFromTheme(themeFromPrefs(ctx.prefs?.get()), settings?.get().theme ?? "terminal-original");
  let note = "";
  let repaint = () => {
  };
  const surfaces = openSurfaces(
    ctx,
    [{ key: "theme-editor", label: "Theme", tab: "Theme", minSize: { width: 280, height: 220 }, placement: { kind: "dock", target: "main", edge: "right" } }],
    { id: "theme-editor", label: "Theme", className: "theme" },
    CSS4,
    () => repaint()
  );
  if (!surfaces) {
    ctx.log("theme: panel seam unavailable");
    return () => {
    };
  }
  const stopOpener = registerOpener("theme-editor", () => {
    surfaces.focus("theme-editor");
    repaint();
  });
  let mount = null;
  let closed = false;
  const tokens = () => themeFromPrefs(customFromDraft(draft) ? { theme: draft.preset, customTheme: customFromDraft(draft) } : { theme: draft.preset });
  const paintedRoot = () => {
    const root = mount?.getRootNode();
    return typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot ? root : null;
  };
  const preview = () => {
    const root = paintedRoot();
    if (root) applyTheme(root, tokens());
  };
  const applySaved = (theme) => {
    const root = paintedRoot();
    if (root) applyTheme(root, theme);
    broadcastTheme(ctx, theme);
  };
  const paint = () => {
    if (closed) return;
    const host = surfaces.mounts().get("theme-editor");
    if (!host) return;
    mount = host;
    const active = mount.getRootNode().activeElement;
    const focusKey = active && mount.contains(active) ? active.dataset?.["focus"] : void 0;
    const caret = focusKey && active ? [active.selectionStart, active.selectionEnd] : null;
    mount.replaceChildren();
    preview();
    renderThemeEditor(mount, draft, note, preview, () => paint(), () => {
      const custom = customFromDraft(draft);
      if (!custom || !settings) {
        note = "Theme preferences are unavailable.";
        paint();
        return;
      }
      settings.set({ theme: draft.preset, customTheme: custom });
      note = "Saved.";
      applySaved(themeFromPrefs(settings.get()));
      paint();
    }, () => {
      if (!settings) {
        note = "Theme preferences are unavailable.";
        paint();
        return;
      }
      settings.set({ customTheme: null });
      const theme = themeFromPrefs(settings.get());
      draft = draftFromTheme(theme, settings.get().theme);
      note = "Using the preset.";
      applySaved(theme);
      paint();
    });
    if (focusKey) {
      const field = mount.querySelector(`[data-focus="${focusKey}"]`);
      field?.focus();
      if (field && caret && caret[0] !== null) field.setSelectionRange(caret[0], caret[1]);
    }
  };
  paint();
  repaint = () => paint();
  return () => {
    closed = true;
    stopOpener();
    surfaces.close();
  };
}

// src/menus/keys.ts
function listStep(key, index, length) {
  if (length <= 0) return null;
  const at = index < 0 ? -1 : Math.min(index, length - 1);
  switch (key) {
    case "ArrowDown":
      return at < 0 ? 0 : Math.min(length - 1, at + 1);
    case "ArrowUp":
      return at < 0 ? 0 : Math.max(0, at - 1);
    case "Home":
      return 0;
    case "End":
      return length - 1;
    case "PageDown":
      return at < 0 ? 0 : Math.min(length - 1, at + 10);
    case "PageUp":
      return at < 0 ? 0 : Math.max(0, at - 10);
    default:
      return null;
  }
}
function swallow(event) {
  event.preventDefault();
  event.stopPropagation?.();
}
function el6(parent, tag, text) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  parent.appendChild(child);
  return child;
}
function button2(parent, label2, focus, onClick) {
  const node2 = el6(parent, "button", label2);
  node2.type = "button";
  node2.dataset["focus"] = focus;
  node2.addEventListener("click", onClick);
  return node2;
}
function matches(text, query) {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

// src/menus/menu-surface.ts
var MENU_CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.menu{position:absolute;right:12px;top:12px;width:min(620px,62vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);box-sizing:border-box}
h2{margin:0 0 6px;font-size:inherit;color:var(--anyband-accent)}
button,input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
button{cursor:pointer}button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--anyband-accent)}
[aria-pressed=true],[aria-selected=true]{background:var(--anyband-accent);color:var(--anyband-background)}
.tabs,.actions,.controls{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0;align-items:center}
.controls input[type=search]{flex:1 1 55%}
.section{margin:10px 0 4px;padding-bottom:2px;color:var(--anyband-accent);border-bottom:1px solid var(--anyband-accent)}
.list{display:flex;flex-direction:column;gap:1px}
.row{display:flex;gap:8px;justify-content:space-between;text-align:left;border-color:transparent;background:transparent}
.row .cells{opacity:.85}
.field{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:3px 0}
.field .name{opacity:.6;font-size:.9em}
.split{display:grid;grid-template-columns:minmax(150px,38%) 1fr;gap:10px;align-items:start}
.nav{display:flex;flex-direction:column;gap:2px}
.nav .group{margin-top:6px;opacity:.6}
.detail{padding:4px;border-left:1px solid var(--anyband-accent);min-height:4em;white-space:normal}
.detail pre{margin:0;white-space:pre}
.detail table{border-collapse:collapse}.detail td,.detail th{padding:0 6px 0 0;text-align:left}
.muted{opacity:.7}.warn{color:var(--anyband-accent);font-weight:bold}
.confirm{margin:8px 0;padding:8px;border:1px solid var(--anyband-accent);background:var(--anyband-background);border-radius:var(--anyband-rounding)}
.note{margin-top:6px}`;
function findFocus(mount, key) {
  for (const node2 of Array.from(mount.querySelectorAll("[data-focus]"))) {
    if (node2.dataset["focus"] === key) return node2;
  }
  return null;
}
function openMenuSurface(ctx, spec, render) {
  let closed = false;
  let shown = false;
  let paint = (_focus) => {
  };
  const surfaces = openSurfaces(ctx, [spec], { id: spec.key, label: spec.label, className: "menu" }, MENU_CSS, () => paint());
  if (!surfaces) return null;
  const stopOpener = registerOpener(spec.key, () => {
    surfaces.focus(spec.key);
    paint(spec.firstFocus);
  });
  paint = (focusKey) => {
    if (closed) return;
    const mount = surfaces.mounts().get(spec.key);
    if (!mount) {
      if (shown) {
        shown = false;
        spec.onHidden?.();
      }
      return;
    }
    shown = true;
    const root = mount.getRootNode();
    const active = root.activeElement ?? null;
    const kept = active && mount.contains(active) ? active.dataset?.["focus"] : void 0;
    const target = focusKey === null ? void 0 : focusKey ?? kept;
    const caret = focusKey === void 0 && active && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd ?? null] : null;
    mount.replaceChildren();
    const frame = mount.ownerDocument.createElement("div");
    mount.appendChild(frame);
    render(frame);
    if (!target) return;
    const field = findFocus(mount, target);
    field?.focus();
    if (field && caret && typeof field.setSelectionRange === "function") {
      try {
        field.setSelectionRange(caret[0], caret[1]);
      } catch {
      }
    }
  };
  paint();
  return {
    repaint: (focusKey) => paint(focusKey),
    mounted: () => !closed && surfaces.mounts().has(spec.key),
    close: () => {
      if (closed) return;
      closed = true;
      stopOpener();
      surfaces.close();
    }
  };
}

// src/menus/screen-view.ts
function run(parent, text, color) {
  const span = el6(parent, "span", text);
  if (color) span.style.color = color;
}
function block(parent, item) {
  if (item.kind === "text") {
    for (const paragraph of item.paragraphs) {
      const p = el6(parent, "p");
      if (item.color) p.style.color = item.color;
      for (const part of paragraph) run(p, part.text, part.color);
    }
    return;
  }
  if (item.kind === "lines") {
    const pre = el6(parent, "pre");
    item.lines.forEach((line, index) => {
      if (index > 0) pre.appendChild(pre.ownerDocument.createTextNode("\n"));
      if (line.runs && line.runs.length > 0) for (const part of line.runs) run(pre, part.text, part.color);
      else run(pre, line.text, line.color);
    });
    return;
  }
  if (item.kind === "art") {
    const pre = el6(parent, "pre", item.lines.join("\n"));
    if (item.color) pre.style.color = item.color;
    for (const field of item.fields ?? []) el6(parent, "p", field.text);
    return;
  }
  if (item.caption) {
    const caption = el6(parent, "p");
    run(caption, item.caption.text, item.caption.color);
  }
  if (item.rows.length === 0) {
    if (item.empty) {
      const empty = el6(parent, "p");
      run(empty, item.empty.text, item.empty.color);
    }
    return;
  }
  const table = el6(parent, "table");
  if (item.columns.some((column) => column.label)) {
    const head = el6(table, "tr");
    for (const column of item.columns) {
      const cell2 = el6(head, "th", column.label ?? "");
      if (item.headerColor) cell2.style.color = item.headerColor;
    }
  }
  for (const row of item.rows) {
    const tr = el6(table, "tr");
    if (row.color) tr.style.color = row.color;
    for (const column of item.columns) {
      const value2 = row.cells[column.key];
      const td = el6(tr, "td", value2?.text ?? "");
      if (value2?.color) td.style.color = value2.color;
      if (column.align === "right") td.style.textAlign = "right";
    }
  }
}
function renderScreenView(parent, view) {
  for (const item of view.blocks) block(parent, item);
}

// src/menus/knowledge-browser.ts
var KNOWLEDGE_KEY = "knowledge-browser";
var REFRESH_MS = 1e3;
function visibleEntries(list, group, search, knownOnly = false) {
  const out = [];
  for (const g of list?.groups ?? []) {
    if (group && g.name !== group) continue;
    for (const entry2 of g.entries) {
      if (knownOnly && !entry2.known) continue;
      if (matches(`${entry2.name} ${g.name}`, search)) out.push({ group: g.name, entry: entry2 });
    }
  }
  return out;
}
var entryFocus = (id) => `entry:${id}`;
var tabFocus = (id) => `tab:${id}`;
function installKnowledgeBrowser(ctx) {
  if (ctx.flags?.["anybandui.knowledgeBrowser"] !== true) return () => {
  };
  if (!ctx.knowledge) ctx.log("knowledge browser: this game does not share its knowledge lists");
  const state = { category: "", group: "", search: "", selected: null, knownOnly: true };
  let signature = "";
  let timer2 = null;
  const read = () => {
    const seam = ctx.knowledge;
    if (!seam) return { categories: [], list: null, visible: [], recall: null, error: "This game does not share its knowledge lists." };
    try {
      const categories = seam.categories();
      if (!categories.some((c) => c.id === state.category)) {
        state.category = (categories.find((c) => c.count > 0) ?? categories[0])?.id ?? "";
        state.group = "";
        state.selected = null;
      }
      const list = state.category ? seam.list(state.category) : null;
      if (state.group && !list?.groups.some((g) => g.name === state.group)) state.group = "";
      const visible = visibleEntries(list, state.group, state.search, state.knownOnly);
      if (!visible.some((v) => v.entry.id === state.selected)) state.selected = visible[0]?.entry.id ?? null;
      const recall = state.selected ? seam.recall(state.category, state.selected) : null;
      return { categories, list, visible, recall, error: "" };
    } catch (err) {
      return { categories: [], list: null, visible: [], recall: null, error: `The knowledge lists could not be read: ${err instanceof Error ? err.message : String(err)}` };
    }
  };
  let surface = null;
  const repaint = (focusKey) => surface?.repaint(focusKey);
  const choose = (category, focusKey) => {
    if (category === state.category) {
      repaint(focusKey);
      return;
    }
    state.category = category;
    state.group = "";
    state.selected = null;
    repaint(focusKey);
  };
  const render = (mount) => {
    const model = read();
    signature = JSON.stringify([state, model]);
    el6(mount, "h2", "Knowledge");
    if (model.error) {
      el6(mount, "p", model.error).className = "muted";
      return;
    }
    const tabs = el6(mount, "div");
    tabs.className = "tabs";
    tabs.setAttribute("role", "tablist");
    const usable = model.categories.filter((c) => c.count > 0 || c.id === state.category);
    for (const category of model.categories) {
      const tab = button2(tabs, category.title, tabFocus(category.id), () => choose(category.id, tabFocus(category.id)));
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(category.id === state.category));
      tab.disabled = category.count === 0 && category.id !== state.category;
    }
    tabs.addEventListener("keydown", (event) => {
      const at = usable.findIndex((c) => c.id === state.category);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        swallow(event);
        const next = usable[(at + (event.key === "ArrowRight" ? 1 : usable.length - 1)) % usable.length];
        if (next) choose(next.id, tabFocus(next.id));
      } else if (event.key === "ArrowDown") {
        swallow(event);
        repaint(state.selected ? entryFocus(state.selected) : "search");
      }
    });
    const controls = el6(mount, "div");
    controls.className = "controls";
    const knownLabel = el6(controls, "label");
    const known = el6(knownLabel, "input");
    known.type = "checkbox";
    known.checked = state.knownOnly;
    known.dataset["focus"] = "known-only";
    known.title = "Hide item types whose identity you have not learned.";
    known.addEventListener("change", () => {
      state.knownOnly = known.checked;
      repaint("known-only");
    });
    el6(knownLabel, "span", " Known only");
    const search = el6(controls, "input");
    search.type = "search";
    search.placeholder = "Search by name or group";
    search.value = state.search;
    search.dataset["focus"] = "search";
    search.setAttribute("aria-label", "Search knowledge");
    search.addEventListener("input", () => {
      state.search = search.value;
      repaint();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        swallow(event);
        if (state.selected) repaint(entryFocus(state.selected));
      } else if (event.key === "Escape") {
        swallow(event);
        repaint(tabFocus(state.category));
      }
    });
    const groups = el6(controls, "select");
    groups.dataset["focus"] = "group";
    groups.setAttribute("aria-label", "Group");
    const all = el6(groups, "option", "All groups");
    all.value = "";
    for (const g of model.list?.groups ?? []) {
      const option = el6(groups, "option", g.name);
      option.value = g.name;
    }
    groups.value = state.group;
    groups.addEventListener("change", () => {
      state.group = groups.value;
      repaint();
    });
    groups.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        swallow(event);
        repaint(tabFocus(state.category));
      }
    });
    const split = el6(mount, "div");
    split.className = "split";
    const left = el6(split, "div");
    const count = model.visible.length;
    el6(left, "p", `${count} ${count === 1 ? "entry" : "entries"}`).className = "muted";
    const list = el6(left, "div");
    list.className = "list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", model.list?.title ?? "Entries");
    if (count === 0) {
      const empty = (model.list?.groups.length ?? 0) === 0 ? "No entries discovered yet. Your knowledge grows as you explore." : "No matching entries.";
      el6(left, "p", empty).className = "muted";
    }
    let lastGroup = "";
    for (const { group, entry: entry2 } of model.visible) {
      if (!state.group && group !== lastGroup) {
        el6(list, "div", group).className = "section";
        lastGroup = group;
      }
      const row = button2(list, "", entryFocus(entry2.id), () => {
        state.selected = entry2.id;
        repaint(entryFocus(entry2.id));
      });
      row.className = "row";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(entry2.id === state.selected));
      const name = el6(row, "span", entry2.name);
      name.style.color = entry2.color;
      if (entry2.cells && entry2.cells.length > 0) {
        const cells = el6(row, "span");
        cells.className = "cells";
        for (const cell2 of entry2.cells) {
          const part = el6(cells, "span", ` ${cell2.text}`);
          part.style.color = cell2.color;
        }
      }
    }
    list.addEventListener("keydown", (event) => {
      const ids = model.visible.map((v) => v.entry.id);
      const at = state.selected ? ids.indexOf(state.selected) : -1;
      const next = listStep(event.key, at, ids.length);
      if (next !== null) {
        swallow(event);
        state.selected = ids[next] ?? null;
        repaint(state.selected ? entryFocus(state.selected) : void 0);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        swallow(event);
        repaint("detail");
        return;
      }
      if (event.key === "Escape") {
        swallow(event);
        repaint("search");
      }
    });
    const detail = el6(split, "div");
    detail.className = "detail";
    detail.tabIndex = 0;
    detail.dataset["focus"] = "detail";
    detail.setAttribute("aria-live", "polite");
    if (!state.selected) el6(detail, "p", "Select an entry to read about it.").className = "muted";
    else if (!model.recall) el6(detail, "p", "Nothing more is known about this yet.").className = "muted";
    else renderScreenView(detail, model.recall);
    detail.addEventListener("keydown", (event) => {
      if (event.key === "Escape" || event.key === "ArrowLeft") {
        swallow(event);
        repaint(state.selected ? entryFocus(state.selected) : "search");
      }
    });
  };
  surface = openMenuSurface(ctx, { key: KNOWLEDGE_KEY, label: "Knowledge", tab: "Knowledge", minSize: { width: 420, height: 260 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: "search" }, render);
  if (!surface) {
    ctx.log("knowledge browser: panel seam unavailable");
    return () => {
    };
  }
  timer2 = globalThis.setInterval(() => {
    if (!surface?.mounted()) return;
    const before = signature;
    const model = read();
    if (JSON.stringify([state, model]) !== before) repaint();
  }, REFRESH_MS);
  return () => {
    if (timer2 !== null) globalThis.clearInterval(timer2);
    timer2 = null;
    surface?.close();
    surface = null;
  };
}

// src/menus/inline-confirm.ts
var CONFIRM_YES = "confirm-yes";
var CONFIRM_NO = "confirm-no";
function renderConfirm(parent, confirmation, onClose) {
  const box = el6(parent, "div");
  box.className = "confirm";
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-label", confirmation.question);
  el6(box, "p", confirmation.question);
  const row = el6(box, "div");
  row.className = "actions";
  const yes = () => {
    onClose();
    confirmation.onYes();
  };
  const yesButton = button2(row, confirmation.yes, CONFIRM_YES, yes);
  const noButton = button2(row, "No", CONFIRM_NO, onClose);
  box.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key === "Escape" || key === "n" || key === "N") {
      swallow(event);
      onClose();
      return;
    }
    if (key === "y" || key === "Y") {
      swallow(event);
      yes();
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "Tab") {
      swallow(event);
      const root = box.getRootNode();
      (root.activeElement === yesButton ? noButton : yesButton).focus();
    }
  });
  return box;
}

// src/menus/options-editor.ts
var OPTIONS_KEY = "options-editor";
var GROUP_OF = {
  rogue_like_commands: "Input and targeting",
  use_old_target: "Input and targeting",
  mouse_movement: "Input and targeting",
  disturb_near: "Input and targeting",
  autoexplore_commands: "Input and targeting",
  pickup_always: "Items",
  pickup_inven: "Items",
  show_flavors: "Items",
  show_damage: "Messages",
  auto_more: "Messages",
  notify_recharge: "Messages",
  show_target: "Display",
  highlight_player: "Display",
  solid_walls: "Display",
  hybrid_walls: "Display",
  view_yellow_light: "Display",
  animate_flicker: "Display",
  center_player: "Display",
  purple_uniques: "Display",
  hp_changes_color: "Display",
  effective_speed: "Display"
};
var GROUPS = ["Input and targeting", "Items", "Messages", "Display", "Other"];
var READ_ONLY_PAGES = [["birth", "Birth options"], ["cheat", "Cheat options"], ["score", "Score options"]];
function optionGroup(name) {
  return GROUP_OF[name] ?? "Other";
}
var NUMBER_SETTINGS = [
  { key: "hitpointWarn", label: "Low hit point warning", help: "Warns you when your hit points fall below this share of the maximum.", max: 9, scale: 10, unit: "%" },
  { key: "delayFactor", label: "Animation delay", help: "How long the game pauses on each step of a missile or spell animation.", max: 255, scale: 1, unit: " ms" },
  { key: "lazymoveDelay", label: "Movement key delay", help: "How long the game waits to combine two direction keys into a diagonal. 0 turns this off.", max: 255, scale: 1, unit: " ms" }
];
function draftFromView(view) {
  return {
    values: Object.fromEntries(view.entries.map((entry2) => [entry2.name, entry2.value])),
    hitpointWarn: view.hitpointWarn,
    delayFactor: view.delayFactor,
    lazymoveDelay: view.lazymoveDelay
  };
}
function draftChanges(view, draft) {
  const values = {};
  for (const entry2 of view.entries) {
    const next = draft.values[entry2.name];
    if (entry2.writable && next !== void 0 && next !== entry2.value) values[entry2.name] = next;
  }
  return {
    ...Object.keys(values).length > 0 ? { values } : {},
    ...draft.hitpointWarn !== view.hitpointWarn ? { hitpointWarn: draft.hitpointWarn } : {},
    ...draft.delayFactor !== view.delayFactor ? { delayFactor: draft.delayFactor } : {},
    ...draft.lazymoveDelay !== view.lazymoveDelay ? { lazymoveDelay: draft.lazymoveDelay } : {}
  };
}
function changeCount(change) {
  return Object.keys(change.values ?? {}).length + ["hitpointWarn", "delayFactor", "lazymoveDelay"].filter((key) => change[key] !== void 0).length;
}
var optionFocus = (name) => `opt:${name}`;
function installOptionsEditor(ctx) {
  if (ctx.flags?.["anybandui.optionsEditor"] !== true) return () => {
  };
  if (!ctx.options) ctx.log("options editor: this game does not share its options");
  let view = null;
  let draft = null;
  let search = "";
  let note = "";
  let confirm2 = null;
  const writable = typeof ctx.options?.set === "function";
  const reload = () => {
    try {
      view = ctx.options?.get() ?? null;
    } catch (err) {
      view = null;
      note = `The options could not be read: ${err instanceof Error ? err.message : String(err)}`;
    }
    draft = view ? draftFromView(view) : null;
  };
  reload();
  const pending = () => view && draft ? draftChanges(view, draft) : {};
  let surface = null;
  const repaint = (focusKey) => surface?.repaint(focusKey);
  const ask = (next) => {
    confirm2 = next;
    repaint(CONFIRM_NO);
  };
  const save = () => {
    const change = pending();
    const count = changeCount(change);
    if (count === 0 || !ctx.options?.set) return;
    ask({ question: `Save ${count} changed ${count === 1 ? "option" : "options"}? This replaces the game's current values.`, yes: "Save", onYes: async () => {
      let result;
      try {
        result = await ctx.options.set(change);
      } catch (err) {
        result = { ok: false, reason: err instanceof Error ? err.message : String(err) };
      }
      if (result.ok) {
        reload();
        note = "Saved.";
      } else note = result.reason;
      repaint("save");
    } });
  };
  const cancel = (focusKey = "cancel") => {
    if (changeCount(pending()) === 0) {
      reload();
      note = "";
      repaint(focusKey);
      return;
    }
    ask({ question: "Throw away your changes to the options?", yes: "Discard", onYes: () => {
      reload();
      note = "Changes discarded.";
      repaint(focusKey);
    } });
  };
  const render = (mount) => {
    el6(mount, "h2", "Game options");
    if (!view || !draft) {
      el6(mount, "p", note || "This game does not share its options.").className = "muted";
      return;
    }
    const current = view;
    const edits = draft;
    el6(mount, "p", writable ? "For this character. Your changes are a draft until you press Save, and Cancel throws them away." : "This game lets this mod read the options but not change them.").className = "muted";
    const searchBox = el6(mount, "input");
    searchBox.type = "search";
    searchBox.placeholder = "Search options";
    searchBox.value = search;
    searchBox.dataset["focus"] = "search";
    searchBox.setAttribute("aria-label", "Search options");
    searchBox.addEventListener("input", () => {
      search = searchBox.value;
      repaint();
    });
    const body = el6(mount, "div");
    body.className = "list";
    let any = false;
    const toggles = (entries, group, readOnly) => {
      const shown = entries.filter((entry2) => matches(`${entry2.description} ${entry2.name} ${group}`, search));
      if (shown.length === 0) return;
      any = true;
      el6(body, "div", readOnly ? `${group} (read only)` : group).className = "section";
      for (const entry2 of shown) {
        const row = el6(body, "label");
        row.className = "field";
        const box = el6(row, "input");
        box.type = "checkbox";
        box.checked = edits.values[entry2.name] ?? entry2.value;
        box.disabled = readOnly || !entry2.writable || !writable;
        box.dataset["focus"] = optionFocus(entry2.name);
        box.setAttribute("aria-label", entry2.description);
        box.addEventListener("change", () => {
          edits.values[entry2.name] = box.checked;
          note = "";
          repaint();
        });
        const text = el6(row, "span", entry2.description);
        text.style.flex = "1";
        el6(row, "span", entry2.name).className = "name";
      }
    };
    for (const group of GROUPS) toggles(current.entries.filter((entry2) => entry2.page === "interface" && optionGroup(entry2.name) === group), group, false);
    const numbers = NUMBER_SETTINGS.filter((setting) => matches(`${setting.label} ${setting.help} Warnings and timing`, search));
    if (numbers.length > 0) {
      any = true;
      el6(body, "div", "Warnings and timing").className = "section";
    }
    for (const setting of numbers) {
      const row = el6(body, "label");
      row.className = "field";
      row.title = setting.help;
      el6(row, "span", setting.label);
      const range = el6(row, "input");
      range.type = "range";
      range.min = "0";
      range.max = String(setting.max);
      range.step = "1";
      range.value = String(edits[setting.key]);
      range.disabled = !writable;
      range.dataset["focus"] = `num:${setting.key}`;
      range.setAttribute("aria-label", setting.label);
      const readout = el6(row, "span", `${edits[setting.key] * setting.scale}${setting.unit}`);
      range.addEventListener("input", () => {
        const next = Math.round(Number(range.value));
        if (!Number.isFinite(next)) return;
        edits[setting.key] = Math.max(0, Math.min(setting.max, next));
        readout.textContent = `${edits[setting.key] * setting.scale}${setting.unit}`;
        note = "";
      });
      range.addEventListener("change", () => repaint());
    }
    for (const [page, title] of READ_ONLY_PAGES) toggles(current.entries.filter((entry2) => entry2.page === page), title, true);
    if (!any) el6(body, "p", "No matching options.").className = "muted";
    body.addEventListener("keydown", (event) => {
      if (confirm2 || event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const controls = Array.from(body.querySelectorAll("[data-focus]"));
      const root = body.getRootNode();
      const at = controls.findIndex((node2) => node2 === root.activeElement);
      const next = controls[event.key === "ArrowDown" ? Math.min(controls.length - 1, at + 1) : Math.max(0, at - 1)];
      if (next) {
        swallow(event);
        next.focus();
      }
    });
    const count = changeCount(pending());
    if (confirm2) {
      const active = confirm2;
      renderConfirm(mount, active, () => {
        confirm2 = null;
        repaint(writable ? "save" : "search");
      });
    }
    const actions = el6(mount, "div");
    actions.className = "actions";
    if (writable) {
      const saveButton = button2(actions, count > 0 ? `Save (${count})` : "Save", "save", save);
      saveButton.disabled = count === 0 || confirm2 !== null;
      button2(actions, "Cancel", "cancel", () => {
        cancel();
      }).disabled = confirm2 !== null;
    }
    if (note) el6(mount, "p", note).className = "note";
    mount.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || confirm2 || changeCount(pending()) === 0) return;
      swallow(event);
      cancel(writable ? "cancel" : "search");
    });
  };
  surface = openMenuSurface(ctx, { key: OPTIONS_KEY, label: "Game options", tab: "Settings", minSize: { width: 360, height: 240 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: "search" }, render);
  if (!surface) {
    ctx.log("options editor: panel seam unavailable");
    return () => {
    };
  }
  return () => {
    surface?.close();
    surface = null;
  };
}

// src/menus/keybinding-editor.ts
var KEYBINDINGS_KEY = "keybinding-editor";
function draftFromList(list) {
  return new Map(list.map((binding) => [binding.trigger, { action: binding.action, owner: binding.owner }]));
}
function bindingDiff(original, draft) {
  const before = draftFromList(original);
  const remove = [...before.keys()].filter((trigger) => !draft.has(trigger));
  const set = [...draft].filter(([trigger, binding]) => {
    const stored = before.get(trigger);
    return stored?.action !== binding.action || stored.owner !== null && binding.owner === null;
  }).map(([trigger, binding]) => [trigger, binding.action]);
  return { remove, set };
}
var KEYSET_NAMES = { original: "Original", roguelike: "Roguelike" };
function commandOnKey(commands, trigger, keyset) {
  return commands.find((command) => command.keys[keyset] === trigger) ?? null;
}
function commandKeys(command) {
  const parts = [];
  for (const keyset of ["original", "roguelike"]) {
    const key = command.keys[keyset];
    if (key !== null) parts.push(`${key} in ${KEYSET_NAMES[keyset]}`);
  }
  if (command.control) parts.push(`Ctrl-${command.control}`);
  return parts.length > 0 ? parts.join(", ") : "no key";
}
function conflictNote(trigger, draft, editing, command = null) {
  const current = draft.get(trigger);
  if (current) {
    const owner = current.owner ? ` It was set by the ${current.owner} mod, and saving makes it yours.` : "";
    const replaces = trigger === editing ? "" : " This keymap replaces it.";
    return `Currently: ${trigger} runs ${current.action}.${replaces}${owner}`;
  }
  if (/^[0-9]$/u.test(trigger)) return `Currently: ${trigger} moves your character or enters a number. A keymap here replaces that.`;
  if (command) return `Currently: ${trigger} runs the game command ${command.name}. A keymap here runs instead.`;
  return `Currently: ${trigger} has no keymap and runs no game command.`;
}
var COMMAND_LIMIT = 40;
var rowFocus = (trigger) => `key:${trigger}`;
function installKeybindingEditor(ctx) {
  if (ctx.flags?.["anybandui.keybindingEditor"] !== true) return () => {
  };
  if (!ctx.keybindings) ctx.log("keybinding editor: this game does not share its keymaps");
  let keyset = "original";
  let started = false;
  let commands = [];
  let showCommands = false;
  let original = [];
  let draft = /* @__PURE__ */ new Map();
  let selected = null;
  let form = null;
  let confirm2 = null;
  let search = "";
  let note = "";
  let closed = false;
  let captureRun = 0;
  const reload = () => {
    const seam = ctx.keybindings;
    if (!seam) return;
    try {
      if (!started) {
        keyset = seam.keyset();
        started = true;
      }
      original = seam.list(keyset);
      commands = seam.commands();
    } catch (err) {
      original = [];
      note = `The keymaps could not be read: ${err instanceof Error ? err.message : String(err)}`;
    }
    draft = draftFromList(original);
    form = null;
  };
  reload();
  const changes = () => {
    const diff = bindingDiff(original, draft);
    return diff.remove.length + diff.set.length;
  };
  let surface = null;
  const repaint = (focusKey) => surface?.repaint(focusKey);
  const ask = (next) => {
    confirm2 = next;
    repaint(CONFIRM_NO);
  };
  const capture = () => {
    const seam = ctx.keybindings;
    if (!seam || !form) return;
    form.capturing = true;
    form.error = "";
    const run2 = ++captureRun;
    repaint(null);
    void seam.capture().then((key) => {
      if (closed || run2 !== captureRun || !form) return;
      form.capturing = false;
      if (key === null) {
        if (form.trigger === null) {
          form = null;
          repaint(selected ? rowFocus(selected) : "add");
          return;
        }
        repaint("action");
        return;
      }
      form.trigger = key;
      repaint("action");
    }, () => {
      if (closed || run2 !== captureRun || !form) return;
      form.capturing = false;
      form.error = "The key could not be read.";
      repaint("capture");
    });
  };
  const dropCapture = () => {
    if (!form?.capturing) return;
    captureRun++;
    form.capturing = false;
    if (form.trigger === null) form = null;
    try {
      ctx.keybindings?.cancelCapture();
    } catch {
    }
  };
  const openForm = (binding) => {
    form = binding ? { trigger: binding[0], action: binding[1].action, editing: binding[0], capturing: false, error: "" } : { trigger: null, action: "", editing: null, capturing: false, error: "" };
    if (binding) repaint("action");
    else capture();
  };
  const closeForm = () => {
    dropCapture();
    form = null;
    repaint(selected ? rowFocus(selected) : "add");
  };
  const applyForm = () => {
    if (!form) return;
    if (!form.trigger) {
      form.error = "Press a key for this keymap first.";
      repaint("capture");
      return;
    }
    const action = form.action.trim();
    if (!action) {
      form.error = "Type the keys this keymap presses.";
      repaint("action");
      return;
    }
    if (form.editing && form.editing !== form.trigger) draft.delete(form.editing);
    draft.set(form.trigger, { action, owner: null });
    selected = form.trigger;
    form = null;
    note = "";
    repaint(rowFocus(selected));
  };
  const removeRow = (trigger) => {
    const triggers = [...draft.keys()];
    const at = triggers.indexOf(trigger);
    draft.delete(trigger);
    const rest2 = [...draft.keys()];
    selected = rest2[Math.min(at, rest2.length - 1)] ?? null;
    note = "";
    repaint(selected ? rowFocus(selected) : "add");
  };
  const save = () => {
    const seam = ctx.keybindings;
    const diff = bindingDiff(original, draft);
    const count = diff.remove.length + diff.set.length;
    if (!seam || count === 0) return;
    ask({ question: `Save ${count} ${count === 1 ? "change" : "changes"} to your ${keyset} keymaps? This replaces what is stored now.`, yes: "Save", onYes: () => {
      let failed = [];
      try {
        for (const trigger of diff.remove) seam.remove(trigger, keyset);
        failed = diff.set.filter(([trigger, action]) => !seam.set(trigger, action, keyset)).map(([trigger]) => trigger);
      } catch (err) {
        note = `The keymaps could not be saved: ${err instanceof Error ? err.message : String(err)}`;
        repaint("save");
        return;
      }
      reload();
      note = failed.length > 0 ? `The game refused a keymap for ${failed.join(", ")}.` : "Saved.";
      repaint("save");
    } });
  };
  const cancel = () => {
    if (changes() === 0) {
      reload();
      note = "";
      repaint("add");
      return;
    }
    ask({ question: "Throw away your changes to the keymaps?", yes: "Discard", onYes: () => {
      reload();
      note = "Changes discarded.";
      repaint("add");
    } });
  };
  const switchKeyset = (next) => {
    if (next === keyset) return;
    const go = () => {
      dropCapture();
      keyset = next;
      selected = null;
      reload();
      note = "";
      repaint(`keyset:${next}`);
    };
    if (changes() === 0) {
      go();
      return;
    }
    ask({ question: `Throw away your changes to the ${keyset} keymaps and edit the ${next} ones?`, yes: "Discard", onYes: go });
  };
  const clearKeyset = () => {
    for (const [trigger, binding] of [...draft]) if (binding.owner === null) draft.delete(trigger);
    selected = null;
    note = "Your keymaps are removed from the draft. Save to apply this, or Cancel to keep them.";
    repaint("save");
  };
  const render = (mount) => {
    el6(mount, "h2", "Keybindings");
    if (!ctx.keybindings) {
      el6(mount, "p", "This game does not share its keymaps.").className = "muted";
      return;
    }
    let inUse = null;
    try {
      inUse = ctx.keybindings.keyset();
    } catch {
      inUse = null;
    }
    const sets = el6(mount, "div");
    sets.className = "tabs";
    sets.setAttribute("aria-label", "Keyset to edit");
    for (const choice of ["original", "roguelike"]) {
      const tab = button2(sets, `${KEYSET_NAMES[choice]} keyset`, `keyset:${choice}`, () => switchKeyset(choice));
      tab.setAttribute("aria-pressed", String(choice === keyset));
      tab.disabled = form?.capturing === true || confirm2 !== null;
    }
    el6(mount, "p", `Editing: ${KEYSET_NAMES[keyset]}.${inUse ? ` In use: ${KEYSET_NAMES[inUse]}.` : ""} The roguelike keys option chooses which one is in use. Your changes apply when you press Save.`).className = "muted";
    if (form) {
      const active = form;
      const box = el6(mount, "div");
      box.className = "confirm";
      el6(box, "div", active.editing ? "Change keymap" : "New keymap").className = "section";
      if (active.capturing) {
        el6(box, "p", "Press the key to bind. Escape cancels.").setAttribute("role", "status");
      } else {
        el6(box, "p", `Key: ${active.trigger ?? "none yet"}`);
        if (active.trigger) el6(box, "p", conflictNote(active.trigger, draft, active.editing, commandOnKey(commands, active.trigger, keyset))).className = "warn";
      }
      const field = el6(box, "label");
      field.className = "field";
      el6(field, "span", "Keys it presses");
      const input = el6(field, "input");
      input.type = "text";
      input.placeholder = "Such as R&[Enter]";
      input.value = active.action;
      input.dataset["focus"] = "action";
      input.disabled = active.capturing;
      input.setAttribute("aria-label", "Keys the keymap presses");
      input.addEventListener("input", () => {
        active.action = input.value;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          swallow(event);
          applyForm();
        }
      });
      if (active.error) el6(box, "p", active.error).className = "warn";
      const actions2 = el6(box, "div");
      actions2.className = "actions";
      button2(actions2, "Use this key", "apply", applyForm).disabled = active.capturing;
      button2(actions2, active.trigger ? "Choose another key" : "Choose a key", "capture", capture).disabled = active.capturing;
      button2(actions2, "Cancel keymap", "form-cancel", closeForm);
      box.addEventListener("keydown", (event) => {
        if (active.capturing) return;
        if (event.key === "Escape") {
          swallow(event);
          closeForm();
        }
      });
    }
    const controls = el6(mount, "div");
    controls.className = "controls";
    const searchBox = el6(controls, "input");
    searchBox.type = "search";
    searchBox.placeholder = "Search keys and actions";
    searchBox.value = search;
    searchBox.dataset["focus"] = "search";
    searchBox.setAttribute("aria-label", "Search keymaps");
    searchBox.addEventListener("input", () => {
      search = searchBox.value;
      repaint();
    });
    button2(controls, "Add keymap", "add", () => openForm(null)).disabled = form !== null || confirm2 !== null;
    const rows = [...draft].filter(([trigger, binding]) => matches(`${trigger} ${binding.action} ${binding.owner ?? ""}`, search));
    const list = el6(mount, "div");
    list.className = "list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Keymaps");
    if (rows.length === 0) el6(list, "p", draft.size === 0 ? "No keymaps in this keyset yet." : "No matching keymaps.").className = "muted";
    for (const [trigger, binding] of rows) {
      const row = button2(list, "", rowFocus(trigger), () => {
        selected = trigger;
        openForm([trigger, binding]);
      });
      row.disabled = form?.capturing === true;
      row.className = "row";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(trigger === selected));
      el6(row, "span", trigger);
      el6(row, "span", binding.action);
      const hidden = commandOnKey(commands, trigger, keyset);
      el6(row, "span", `${binding.owner ? `from ${binding.owner}` : "yours"}${hidden ? `, hides ${hidden.name}` : ""}`).className = "muted";
      row.addEventListener("focus", () => {
        selected = trigger;
      });
    }
    list.addEventListener("keydown", (event) => {
      if (form || confirm2) return;
      const triggers = rows.map(([trigger]) => trigger);
      const root = list.getRootNode();
      const focused = root.activeElement?.dataset?.["focus"];
      const current = focused?.startsWith("key:") ? focused.slice(4) : selected;
      const at = current ? triggers.indexOf(current) : -1;
      const next = listStep(event.key, at, triggers.length);
      if (next !== null) {
        swallow(event);
        selected = triggers[next] ?? null;
        repaint(selected ? rowFocus(selected) : void 0);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && current && draft.has(current)) {
        swallow(event);
        removeRow(current);
      }
    });
    if (confirm2) renderConfirm(mount, confirm2, () => {
      confirm2 = null;
      repaint("save");
    });
    const count = changes();
    const actions = el6(mount, "div");
    actions.className = "actions";
    const busy = form !== null || confirm2 !== null;
    button2(actions, count > 0 ? `Save (${count})` : "Save", "save", save).disabled = count === 0 || busy;
    button2(actions, "Cancel", "cancel", cancel).disabled = busy;
    button2(actions, "Remove my keymaps", "clear", clearKeyset).disabled = busy || ![...draft.values()].some((binding) => binding.owner === null);
    if (selected && draft.has(selected) && !busy) {
      const chosen = selected;
      button2(actions, `Remove ${chosen}`, "remove", () => removeRow(chosen));
    }
    if (note) el6(mount, "p", note).className = "note";
    if (commands.length > 0) {
      const toggle = button2(mount, showCommands ? "Hide game commands" : "Show game commands", "commands", () => {
        showCommands = !showCommands;
        repaint("commands");
      });
      toggle.setAttribute("aria-expanded", String(showCommands));
      if (showCommands) {
        const shown = commands.filter((command) => matches(`${command.name} ${command.group} ${commandKeys(command)}`, search));
        const table = el6(mount, "div");
        table.className = "list";
        table.setAttribute("aria-label", "Game commands");
        if (shown.length === 0) el6(table, "p", "No matching game commands.").className = "muted";
        let group = "";
        for (const command of shown.slice(0, COMMAND_LIMIT)) {
          if (command.group !== group) {
            el6(table, "div", command.group).className = "section";
            group = command.group;
          }
          const row = el6(table, "div");
          row.className = "field";
          el6(row, "span", command.name);
          el6(row, "span", commandKeys(command)).className = "muted";
        }
        if (shown.length > COMMAND_LIMIT) el6(table, "p", `${shown.length - COMMAND_LIMIT} more. Search to narrow the list.`).className = "muted";
      }
    }
    mount.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || form || confirm2 || changes() === 0) return;
      swallow(event);
      cancel();
    });
  };
  surface = openMenuSurface(ctx, { key: KEYBINDINGS_KEY, label: "Keybindings", tab: "Settings", minSize: { width: 360, height: 240 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: "add", onHidden: dropCapture }, render);
  if (!surface) {
    ctx.log("keybinding editor: panel seam unavailable");
    return () => {
    };
  }
  return () => {
    dropCapture();
    closed = true;
    surface?.close();
    surface = null;
  };
}

// src/view-model/spells.ts
var sameToken2 = (a, b) => a.epoch === b.epoch && a.revision === b.revision;
var itemKey = (item) => item.kindId ?? `${item.tval}:${item.sval}`;
function bookFor(snap, item, books, inspect) {
  if (!books.some((book) => book.tval === item.tval)) return null;
  if (inspect?.bookForItem) {
    let mapped = null;
    try {
      mapped = inspect.bookForItem(item.handle);
    } catch {
      mapped = null;
    }
    if (!mapped || !sameToken2(mapped.token, snap.token)) return null;
    return books[mapped.bookIndex] ?? null;
  }
  const siblings = books.filter((book) => book.tval === item.tval);
  return siblings.length === 1 ? siblings[0] : null;
}
function adaptSpells(snap, inspect) {
  const world = viewWorld(snap), player = viewPlayer(snap);
  if (!world.spellbooks || !world.inventory || !player) return null;
  const learnable = typeof player.learnableSpells === "number" ? player.learnableSpells : null;
  const books = [];
  for (const item of world.inventory) {
    const book = bookFor(snap, item, world.spellbooks, inspect);
    if (!book || books.some((entry2) => entry2.key === itemKey(item))) continue;
    const spells = book.spells.map((spell) => {
      const info = inspect?.spellInfo?.(spell.sidx);
      const detail = info && sameToken2(info.token, snap.token) ? info : null;
      const canCast = !!detail?.canCastNow && spell.learned && !spell.forgotten;
      const eligible = spell.studyEligible ?? (!spell.learned && !spell.forgotten && spell.level <= (player.level ?? 0));
      const canStudy = eligible && learnable !== 0;
      return {
        index: spell.sidx,
        name: spell.name,
        level: spell.level,
        mana: detail?.mana ?? spell.mana,
        fail: detail?.failChance ?? spell.chance ?? spell.fail,
        canCast,
        canStudy,
        state: spell.forgotten ? "Forgotten" : spell.learned ? canCast ? "Castable" : "Unavailable" : canStudy ? "Learnable" : "Unknown",
        description: detail?.description ?? "Description unavailable.",
        infoLine: (spell.infoLine ?? "").trim()
      };
    });
    books.push({ key: itemKey(item), handle: item.handle, name: item.label, chooseSpells: player.classFlags?.includes("CHOOSE_SPELLS") ?? true, spells });
  }
  return { token: snap.token, books, learnable };
}

// src/blast-preview.ts
var ELEMENT_COLORS = Object.freeze({
  FIRE: ["rgba(245,110,40,.12)", "rgba(250,130,60,.8)"],
  PLASMA: ["rgba(245,110,40,.12)", "rgba(250,130,60,.8)"],
  COLD: ["rgba(120,190,245,.12)", "rgba(140,205,250,.8)"],
  ICE: ["rgba(120,190,245,.12)", "rgba(140,205,250,.8)"],
  ACID: ["rgba(150,220,70,.12)", "rgba(165,230,90,.8)"],
  POIS: ["rgba(110,200,110,.12)", "rgba(125,215,125,.8)"],
  ELEC: ["rgba(140,150,250,.12)", "rgba(160,170,255,.85)"],
  DARK: ["rgba(150,110,200,.12)", "rgba(170,130,220,.8)"]
});
var DEFAULT_COLORS = ["rgba(245,185,70,.095)", "rgba(245,190,80,.745)"];
var elementEdgeColour = (element) => (element ? ELEMENT_COLORS[element]?.[1] : void 0) ?? DEFAULT_COLORS[1];
function blastGrids(ctx, snap, hovered) {
  const blast = snap?.activeBlast, prompt = snap?.prompt;
  if (!snap || !blast || !sameToken2(blast.token, snap.token) || blast.radius < 1) return null;
  if (prompt?.kind !== "target" && prompt?.kind !== "direction") return null;
  const at = (prompt.kind === "target" ? prompt.cursor : null) ?? hovered;
  if (!at) return null;
  let area = null;
  try {
    area = ctx.inspect?.blastArea?.(at, blast.radius, blast.arc) ?? null;
  } catch {
    area = null;
  }
  if (!area || !sameToken2(area.token, snap.token) || !area.grids.length) return null;
  return { grids: area.grids, element: area.element ?? blast.element ?? null };
}
function installBlastPreview(ctx) {
  if (!ctx.snapshot || !ctx.inspect?.blastArea || !ctx.display?.snapshot) {
    ctx.log("blast preview: snapshot, blast inspection or display seam unavailable");
    return () => {
    };
  }
  const display = ctx.display;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;z-index:50;pointer-events:none";
  document.body.append(canvas);
  let hovered = null;
  const onMove = (event) => {
    const view = display.snapshot();
    const grid = view.mode === "play" || view.mode === "modal" ? hoverGrid(view, { x: event.clientX, y: event.clientY }) : null;
    hovered = grid && grid.x < view.level.width && grid.y < view.level.height ? grid : null;
  };
  const render = () => {
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(window.innerWidth * scale);
    canvas.height = Math.ceil(window.innerHeight * scale);
    const paint = canvas.getContext("2d");
    if (!paint) return;
    paint.scale(scale, scale);
    const snap = viewInput(ctx);
    const blast = blastGrids(ctx, snap, hovered);
    if (!blast) return;
    const view = display.snapshot();
    const rect = mapProjection(view);
    if (!rect) return;
    const width = rect.width / view.viewport.size.width, height = rect.height / view.viewport.size.height;
    const [fill, edge] = blast.element && ELEMENT_COLORS[blast.element] || DEFAULT_COLORS;
    paint.beginPath();
    paint.rect(rect.x, rect.y, rect.width, rect.height);
    paint.clip();
    const cells = new Set(blast.grids.map((grid) => `${grid.x},${grid.y}`));
    for (const grid of blast.grids) {
      const x = rect.x + (grid.x - view.viewport.origin.x) * width, y = rect.y + (grid.y - view.viewport.origin.y) * height;
      paint.fillStyle = fill;
      paint.fillRect(x, y, width, height);
      paint.strokeStyle = edge;
      paint.lineWidth = 1;
      paint.beginPath();
      if (!cells.has(`${grid.x - 1},${grid.y}`)) {
        paint.moveTo(x, y);
        paint.lineTo(x, y + height);
      }
      if (!cells.has(`${grid.x + 1},${grid.y}`)) {
        paint.moveTo(x + width, y);
        paint.lineTo(x + width, y + height);
      }
      if (!cells.has(`${grid.x},${grid.y - 1}`)) {
        paint.moveTo(x, y);
        paint.lineTo(x + width, y);
      }
      if (!cells.has(`${grid.x},${grid.y + 1}`)) {
        paint.moveTo(x, y + height);
        paint.lineTo(x + width, y + height);
      }
      paint.stroke();
    }
  };
  window.addEventListener("mousemove", onMove, true);
  const timer2 = window.setInterval(render, 50);
  return () => {
    window.clearInterval(timer2);
    window.removeEventListener("mousemove", onMove, true);
    canvas.remove();
  };
}

// src/effects.ts
function healthIntensity(hp, maxHp, warning) {
  if (!(hp !== void 0 && maxHp && maxHp > 0 && hp > 0)) return 0;
  const threshold = warning !== void 0 && warning > 0 ? warning : maxHp * 0.3;
  return hp >= threshold ? 0 : Math.min(1, (threshold - hp) / threshold + 0.12);
}
function chooseEffectMotion(reduced) {
  return reduced ? "static" : "motion";
}
var AURA_ORDER = ["cursed", "artifact", "rune"];
var AURA_COLOURS = { cursed: "#ff4f6d", artifact: "#ffd36a", rune: "#7fd8ff" };
function actualAura(o) {
  if (o.curses.length > 0) return "cursed";
  if (o.artifact) return "artifact";
  const magical = o.ego || o.flags.length > 0 || o.modifiers.length > 0 || o.brands.length > 0 || o.slays.length > 0 || o.resists.length > 0 || o.toH !== 0 || o.toD !== 0 || o.toA !== 0;
  return magical ? "rune" : void 0;
}
function effectGrids(s, known, revealHidden = false) {
  const asleep = [], afraid = [], uniques = [], glows = [];
  for (const m of viewMonsters(s) ?? []) if (m.visible) {
    if (m.asleep) asleep.push(m.grid);
    if (m.afraid) afraid.push(m.grid);
    if (m.unique ?? m.raceFlags.includes("UNIQUE")) uniques.push({ grid: m.grid, final: m.finalGuardian ?? m.race === "Morgoth, Lord of Darkness" });
  }
  const truth = revealHidden ? new Map(truthLevel(known).cells.map((cell2) => [cell2.y * 65536 + cell2.x, cell2])) : null;
  for (const c of known?.cells ?? []) {
    const auras = /* @__PURE__ */ new Set();
    const actual = truth?.get(c.y * 65536 + c.x);
    if (actual && c.visible === true && actual.monster === 0 && c.remembered.objects.length > 0) {
      for (const o of actual.objects) {
        const aura2 = actualAura(o);
        if (aura2) auras.add(aura2);
      }
    }
    for (const o of c.remembered.objects) {
      if (!o || typeof o !== "object") continue;
      const read = o;
      const aura2 = read.aura ?? (read.artifact === true ? "artifact" : void 0);
      if (aura2 === "cursed" || aura2 === "artifact" || aura2 === "rune") auras.add(aura2);
    }
    const aura = AURA_ORDER.find((a) => auras.has(a));
    if (aura) glows.push({ grid: { x: c.x, y: c.y }, aura });
  }
  return { asleep, afraid, uniques, glows };
}
function markGrids(asleep, afraid, fearOn) {
  if (!fearOn) return { sleep: [...asleep], fear: [] };
  const fearAt = new Set(afraid.map((p) => `${p.x},${p.y}`));
  return { sleep: asleep.filter((p) => !fearAt.has(`${p.x},${p.y}`)), fear: [...afraid] };
}
function actorGrid(s, who) {
  if (who === null) return null;
  if (who === "player") return viewPlayer(s)?.grid ?? null;
  return viewMonsters(s)?.find((m) => m.id === who && m.visible)?.grid ?? null;
}
function eventCue(e, locate = () => null) {
  if (!e.seen) return [];
  if (e.event === "combat-outcome") {
    const caster = e.kind === "spell" ? locate(e.attacker) : null;
    return [...caster ? [{ grid: caster, kind: "cast" }] : [], { grid: e.grid, kind: e.died ? "death" : e.hit ? "hit" : "miss" }];
  }
  if (e.event === "heal") return [{ grid: e.grid, kind: "heal" }];
  return e.kind === "teleport" ? [{ grid: e.from, kind: "departure" }, { grid: e.to, kind: "arrival" }] : [];
}
function blastCues(e, limit = 200) {
  const colour = elementEdgeColour(e.element);
  const out = [];
  e.blastGrid.forEach((grid, i) => {
    if (out.length < limit && e.playerSeesGrid[i]) out.push({ grid: { x: grid.x, y: grid.y }, kind: "blast", colour });
  });
  return out;
}
var NUMBER_COLOUR = { heal: "#64ffa0", player: "#ff6152", monster: "#ffce63" };
function numberCues(e) {
  if (!e.seen || !e.grid) return [];
  if (e.event === "heal") {
    if (!(typeof e.amount === "number" && e.amount > 0)) return [];
    return [{ grid: e.grid, kind: "number", text: `+${e.amount}`, colour: NUMBER_COLOUR.heal, life: 720 }];
  }
  if (!e.hit || !(typeof e.damage === "number" && e.damage > 0)) return [];
  return [{ grid: e.grid, kind: "number", text: `-${e.damage}`, colour: e.target === "player" ? NUMBER_COLOUR.player : NUMBER_COLOUR.monster, life: 720 }];
}
function walkCues(e, visible = () => true) {
  if (!e?.seen || e.kind !== "walk" || !e.from || !e.to || !visible(e.from)) return [];
  if (Math.max(Math.abs(e.to.x - e.from.x), Math.abs(e.to.y - e.from.y)) !== 1) return [];
  return [{ grid: e.to, from: e.from, kind: "slide", life: 100 }];
}
function slidePlace(from, to, t) {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const remain = (1 - clamped) * (1 - clamped);
  return { x: to.x + (from.x - to.x) * remain, y: to.y + (from.y - to.y) * remain };
}
function blinkCues(e) {
  if (!e?.seen || e.kind !== "teleport" || !e.to) return [];
  return [{ grid: e.to, kind: "ripple", life: 340, span: 3.8 }];
}
function rippleAlpha(distance, radius, age) {
  return Math.max(0, 1 - Math.abs(distance - radius) / 0.85) * (1 - age) * 0.3;
}
function rippleCells(centre, known, radius) {
  const out = [];
  for (const c of known?.cells ?? []) {
    if (c.visible !== true) continue;
    if (Math.hypot(c.x - centre.x, c.y - centre.y) <= radius + 0.85) out.push({ x: c.x, y: c.y });
  }
  return out;
}
function boltGlyph(dx, dy, element, x, y) {
  if (element === "ELEC") return (x + y) % 2 ? "~" : "*";
  if (dy === 0) return dx === 0 ? "*" : "-";
  if (dx === 0) return "|";
  return dx * dy > 0 ? "\\" : "/";
}
function boltCue(e, delay = 0) {
  if (!e?.seen || typeof e.x !== "number" || typeof e.y !== "number" || typeof e.ox !== "number" || typeof e.oy !== "number") return null;
  return {
    grid: { x: e.x, y: e.y },
    from: { x: e.ox, y: e.oy },
    kind: "bolt",
    delay,
    life: 200,
    glyph: boltGlyph(e.x - e.ox, e.y - e.oy, e.element ?? "", e.x, e.y),
    colour: elementEdgeColour(e.element)
  };
}
function nextBoltDelay(now, reduced, state) {
  if (now - state.at > 50) {
    state.count = 0;
    state.at = now;
  }
  const delay = reduced ? 0 : Math.min(state.count, 48) * 40;
  state.count += 1;
  return delay;
}
var CONE_GLYPH = { COLD: "+", ICE: "+", ELEC: "*", POIS: "~", ACID: "~" };
function coneCues(e, limit = 200) {
  if (!e?.arc || !Array.isArray(e.blastGrid) || !Array.isArray(e.playerSeesGrid)) return [];
  const colour = elementEdgeColour(e.element);
  const glyph = CONE_GLYPH[e.element] ?? "^";
  const span = Math.max(1, e.radius || 0);
  const out = [];
  e.blastGrid.forEach((grid, i) => {
    if (out.length >= limit || !e.playerSeesGrid[i]) return;
    const distance = Array.isArray(e.distanceToGrid) ? e.distanceToGrid[i] ?? 0 : 0;
    out.push({ grid: { x: grid.x, y: grid.y }, kind: "cone", colour, glyph, distance, span, delay: 240 * distance / span, life: 360 });
  });
  return out;
}
var STRENGTH_SETTINGS = {
  crt: "anybandui.crtStrength",
  lowHealth: "anybandui.lowHealthStrength",
  death: "anybandui.deathStrength",
  itemGlow: "anybandui.itemGlowStrength",
  sleepMarks: "anybandui.sleepMarksStrength",
  fearMarks: "anybandui.fearMarksStrength",
  presenceHaze: "anybandui.presenceHazeStrength",
  cast: "anybandui.spellEffectsStrength",
  hit: "anybandui.spellEffectsStrength",
  miss: "anybandui.spellEffectsStrength",
  heal: "anybandui.spellEffectsStrength",
  departure: "anybandui.spellEffectsStrength",
  arrival: "anybandui.spellEffectsStrength",
  blast: "anybandui.spellEffectsStrength",
  number: "anybandui.damageNumbersStrength",
  slide: "anybandui.walkSlideStrength",
  ripple: "anybandui.blinkRippleStrength",
  bolt: "anybandui.boltGlyphsStrength",
  cone: "anybandui.coneWashStrength",
  lava: "anybandui.lavaEmbersStrength",
  stairs: "anybandui.stairEmbersStrength",
  recall: "anybandui.recallRingStrength",
  level: "anybandui.levelFlashStrength",
  scene: "anybandui.sceneFadeStrength",
  crtGlow: "anybandui.crtGlowStrength",
  crtFringe: "anybandui.crtFringeStrength",
  crtSweep: "anybandui.crtSweepStrength"
};
var EFFECT_FLAGS = [
  "anybandui.crt",
  "anybandui.lowHealthEffect",
  "anybandui.deathEffect",
  "anybandui.itemGlow",
  "anybandui.sleepMarks",
  "anybandui.fearMarks",
  "anybandui.presenceHaze",
  "anybandui.damageNumbers",
  "anybandui.walkSlide",
  "anybandui.blinkRipple",
  "anybandui.boltGlyphs",
  "anybandui.coneWash",
  "anybandui.spellEffects",
  "anybandui.lavaEmbers",
  "anybandui.stairEmbers",
  "anybandui.recallRing",
  "anybandui.levelFlash",
  "anybandui.sceneFade",
  "anybandui.crtGlow",
  "anybandui.crtFringe",
  "anybandui.crtSweep"
];
function effectStrength(settings, stored, key) {
  const id = STRENGTH_SETTINGS[key];
  let value2;
  try {
    value2 = id ? settings?.get(id) : void 0;
  } catch {
    value2 = void 0;
  }
  const raw = typeof value2 === "number" && Number.isFinite(value2) ? value2 : stored[key] ?? 100;
  return Math.max(0, Math.min(100, raw));
}
function sceneTerrain(code) {
  if (!code) return null;
  const local = (code.split(":").pop() ?? code).toLowerCase().replace(/_/g, "-");
  if (local === "less" || local === "stair-up" || local === "up-stair") return "up";
  if (local === "more" || local === "stair-down" || local === "down-stair") return "down";
  if (local === "lava" || local.startsWith("lava-") || local.endsWith("-lava")) return "lava";
  return null;
}
function sceneCells(known) {
  const out = [];
  for (const cell2 of known?.cells ?? []) {
    const kind = sceneTerrain(featureCode(cell2));
    if (kind) out.push({ grid: { x: cell2.x, y: cell2.y }, kind });
  }
  return out;
}
function playerOnStairs(known, grid) {
  if (!grid) return false;
  const cell2 = known?.cells?.find((entry2) => entry2.x === grid.x && entry2.y === grid.y);
  if (!cell2) return false;
  const kind = sceneTerrain(featureCode(cell2));
  return kind === "up" || kind === "down";
}
function recallGrid(player) {
  if (!player?.grid || !(player.recall === true || typeof player.recall === "number" && player.recall > 0)) return null;
  return player.grid;
}
function driftingEmbers(now, seed, count, reduced) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = (reduced ? 0 : now / 1e3 * 0.65) + seed + i * 0.25;
    const frac = t - Math.floor(t);
    out.push({ x: Math.sin(seed + i * 2 + frac * 3) * 0.4, y: 0.35 - frac * 1.05, alpha: Math.sin(frac * Math.PI) });
  }
  return out;
}
var IDLE_LEVEL = { highest: 0, flashedLevel: 0, started: -1 };
var LEVEL_PHASES = /* @__PURE__ */ new Set(["play", "store", "more", "modal"]);
function observeLevel(watch, sample, now) {
  const phase = sample.phase;
  if (!phase) return watch;
  if (!LEVEL_PHASES.has(phase)) return IDLE_LEVEL;
  if (typeof sample.level !== "number" || !Number.isFinite(sample.level)) return watch;
  const current = sample.level;
  const recorded = typeof sample.maxLevel === "number" && Number.isFinite(sample.maxLevel) ? sample.maxLevel : current;
  const best = Math.max(current, recorded);
  const flashed = watch.highest > 0 && current > watch.highest && sample.dead !== true ? { highest: watch.highest, flashedLevel: current, started: now } : watch;
  return { ...flashed, highest: Math.max(flashed.highest, best) };
}
function levelFlashIntensity(started, now, reduced = false) {
  if (started < 0) return 0;
  const duration = reduced ? 200 : 2200;
  const t = (now - started) / duration;
  if (t < 0 || t >= 1) return 0;
  if (reduced) return 0.7;
  return Math.min(1, t * 12) * Math.max(0, 1 - t) * 1.15;
}
var IDLE_SCENE = { established: false, levelId: null, depth: 0, inShop: false, onStairs: false, kind: null, started: 0 };
function sceneDuration(kind) {
  return kind === "death" ? 900 : kind === "load" ? 420 : kind === "shop" ? 300 : 340;
}
function observeScene(watch, sample, now) {
  const phase = sample.phase;
  if (!phase) return watch;
  if (phase === "pregame") return IDLE_SCENE;
  if (sample.dead === true || phase === "dead") {
    return watch.kind === "death" ? watch : { ...watch, kind: "death", started: now };
  }
  let current = watch.kind === "death" ? { ...watch, kind: null, started: 0 } : watch;
  const shop = phase === "store";
  if (current.established && shop && !current.inShop) current = { ...current, kind: "shop", started: now, inShop: true };
  else current = { ...current, inShop: shop };
  if (typeof sample.levelId !== "number" || !Number.isFinite(sample.levelId)) return current;
  const nextDepth = typeof sample.depth === "number" && Number.isFinite(sample.depth) ? sample.depth : current.depth;
  const onStairs = sample.onStairs === true;
  if (!current.established) {
    return { ...current, established: true, kind: "load", started: now, levelId: sample.levelId, depth: nextDepth, onStairs };
  }
  if (current.levelId !== null && sample.levelId !== current.levelId && current.onStairs) {
    current = { ...current, kind: "stairs", started: now };
  }
  return { ...current, levelId: sample.levelId, depth: nextDepth, onStairs };
}
function sceneOpacity(watch, now, reduced = false) {
  if (!watch.kind) return 0;
  const duration = reduced ? 80 : sceneDuration(watch.kind);
  const t = (now - watch.started) / duration;
  if (t < 0 || t >= 1) return 0;
  const remain = 1 - t;
  return remain * remain * (3 - 2 * remain);
}
function phosphorKeep(r, g, b) {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const x = (lum - 0.08) / (0.45 - 0.08);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}
function fringeOffset(strength, width) {
  if (!(strength > 0) || !(width > 0)) return 0;
  return Math.max(1, Math.round(strength * Math.min(6, width * 6e-3)));
}
function sweepTrail(y, front, height) {
  if (!(height > 0)) return 0;
  const behind = (front - y) / height;
  const wrapped = behind - Math.floor(behind);
  if (wrapped >= 0.24) return 0;
  const t = 1 - wrapped / 0.24;
  return t * t * t;
}
function glowFigure(aura) {
  return aura === "artifact" ? "sunburst" : "disc";
}
function sunburstAngles(spin) {
  return Array.from({ length: 6 }, (_, ray) => ray * (Math.PI / 3) + spin);
}
function cellAnchor(origin, size, rect, grid) {
  const cellW = rect.width / size.width, cellH = rect.height / size.height;
  return { x: (grid.x - origin.x + 0.5) * cellW, y: (grid.y - origin.y + 0.5) * cellH };
}
function terminalCanvas(doc = typeof document === "undefined" ? void 0 : document) {
  const node2 = doc?.getElementById("game");
  return typeof HTMLCanvasElement !== "undefined" && node2 instanceof HTMLCanvasElement ? node2 : null;
}
function blitRegion(game, css, dest) {
  const bounds = game.getBoundingClientRect();
  if (!(bounds.width > 0) || !(bounds.height > 0) || !(css.width > 1) || !(css.height > 1)) return false;
  const scaleX = game.width / bounds.width, scaleY = game.height / bounds.height;
  const sx = (css.x - bounds.left) * scaleX, sy = (css.y - bounds.top) * scaleY;
  const sw = css.width * scaleX, sh = css.height * scaleY;
  if (!(sw > 1) || !(sh > 1)) return false;
  const dw = Math.max(1, Math.round(css.width)), dh = Math.max(1, Math.round(css.height));
  if (dest.width !== dw) dest.width = dw;
  if (dest.height !== dh) dest.height = dh;
  const cg = dest.getContext("2d");
  if (!cg) return false;
  try {
    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.drawImage(game, sx, sy, sw, sh, 0, 0, dw, dh);
    return true;
  } catch {
    return false;
  }
}
function installEffects(ctx) {
  const flags = ctx.flags ?? {};
  const enabled = EFFECT_FLAGS.some((x) => flags[x]);
  const display = ctx.display;
  if (!enabled || !display || typeof document === "undefined") return () => {
  };
  const activeDisplay = display;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", pointerEvents: "none", zIndex: "2", display: "none" });
  document.body.append(canvas);
  const maybeContext = canvas.getContext("2d");
  if (!maybeContext) {
    canvas.remove();
    return () => {
    };
  }
  const g = maybeContext;
  const cues = [];
  let raf = 0, wasDead = false, deadBurstAt = 0;
  let levelWatch = IDLE_LEVEL, sceneWatch = IDLE_SCENE;
  const held = document.createElement("canvas"), sample = document.createElement("canvas");
  const glowScratch = document.createElement("canvas"), fringeScratch = document.createElement("canvas");
  let heldReady = false;
  let lastRect = null;
  const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const push = (list) => {
    const effects = validateSettings(ctx.prefs?.get()).effects;
    for (const cue of list) {
      const strength = effectStrength(ctx.settings, effects, cue.kind);
      if (strength > 0) cues.push({ ...cue, started: performance.now(), strength });
    }
    request();
  };
  const add = (e) => push(eventCue(e, (who) => actorGrid(viewInput(ctx), who)));
  const spell = flags["anybandui.spellEffects"] === true, numbers = flags["anybandui.damageNumbers"] === true;
  const slides = flags["anybandui.walkSlide"] === true, ripples = flags["anybandui.blinkRipple"] === true;
  const bolts = flags["anybandui.boltGlyphs"] === true, cones = flags["anybandui.coneWash"] === true;
  const boltState = { count: 0, at: 0 };
  const combat = (_type, e) => {
    if (spell) add({ event: "combat-outcome", ...e });
    if (numbers) push(numberCues({ event: "combat-outcome", ...e }));
  };
  const heal = (_type, e) => {
    if (spell) add({ event: "heal", ...e });
    if (numbers) push(numberCues({ event: "heal", ...e }));
  };
  const motion = (_type, e) => {
    if (spell) add({ event: "motion", ...e });
    if (slides) push(walkCues(e, (p) => (viewLevel(ctx)?.cells ?? []).some((c) => c.x === p.x && c.y === p.y && c.visible === true)));
    if (ripples) push(blinkCues(e));
  };
  const explosion = (_type, e) => {
    if (!e || !Array.isArray(e.blastGrid) || !Array.isArray(e.playerSeesGrid)) return;
    if (e.arc && cones) push(coneCues(e));
    else if (spell) push(blastCues(e));
  };
  const bolt = (_type, e) => {
    const delay = nextBoltDelay(performance.now(), reduced(), boltState);
    const cue = boltCue(e, delay);
    if (cue) push([cue]);
  };
  const listenCombat = spell || numbers, listenMotion = spell || slides || ripples, listenBlast = spell || cones, listenBolt = bolts;
  if (listenCombat) {
    ctx.events?.on("combat-outcome", combat);
    ctx.events?.on("heal", heal);
  }
  if (listenMotion) ctx.events?.on("motion", motion);
  if (listenBlast) ctx.events?.on("explosion", explosion);
  if (listenBolt) ctx.events?.on("bolt", bolt);
  function request() {
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function draw(now) {
    raf = 0;
    const view = activeDisplay.snapshot(), rect = mapProjection(view);
    const snap = viewInput(ctx);
    const player = viewPlayer(snap) ?? null;
    const known = viewLevel(ctx);
    const staticMode = chooseEffectMotion(reduced()) === "static";
    if (flags["anybandui.levelFlash"]) {
      levelWatch = observeLevel(levelWatch, { phase: snap?.phase, level: player?.level, maxLevel: player?.maxLevel, dead: player?.dead === true }, now);
    }
    if (flags["anybandui.sceneFade"]) {
      sceneWatch = observeScene(sceneWatch, {
        phase: snap?.phase,
        dead: player?.dead === true || snap?.phase === "dead",
        ...known ? { levelId: known.levelId, depth: known.depth } : {},
        onStairs: playerOnStairs(known, player?.grid)
      }, now);
    }
    const fade = flags["anybandui.sceneFade"] ? sceneOpacity(sceneWatch, now, staticMode) : 0;
    const live = rect && view.mode === "play" ? rect : null;
    if (live) lastRect = live;
    const drawRect = live ?? (fade > 0 ? lastRect : null);
    if (!drawRect) {
      canvas.style.display = "none";
      if (fade > 0) request();
      return;
    }
    canvas.style.display = "block";
    canvas.style.left = `${drawRect.x}px`;
    canvas.style.top = `${drawRect.y}px`;
    canvas.style.width = `${drawRect.width}px`;
    canvas.style.height = `${drawRect.height}px`;
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(drawRect.width * dpr);
    canvas.height = Math.round(drawRect.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, drawRect.width, drawRect.height);
    const effectSettings = validateSettings(ctx.prefs?.get()).effects;
    const intensity = (key) => effectStrength(ctx.settings, effectSettings, key) / 100;
    const sceneAlpha = fade * intensity("scene");
    if (live && view.viewport.size.width > 0 && view.viewport.size.height > 0) {
      let paint2 = function(p, color, a, aura) {
        if (!a) return;
        const q = cell2(p);
        if (aura && glowFigure(aura) === "sunburst") {
          const unit = Math.max(cellW, cellH), spin = staticMode ? 0 : now / 8e3;
          const beat = staticMode ? 0.65 : 0.5 + 0.5 * Math.sin(now / 420);
          g.save();
          g.strokeStyle = color;
          g.globalAlpha = a;
          g.lineWidth = Math.max(1, unit * 0.055);
          for (const angle of sunburstAngles(spin)) {
            const length = unit * (0.55 + 0.65 * beat), inner = unit * 0.22;
            g.beginPath();
            g.moveTo(q.x + Math.cos(angle) * inner, q.y + Math.sin(angle) * inner);
            g.lineTo(q.x + Math.cos(angle) * (inner + length), q.y + Math.sin(angle) * (inner + length));
            g.stroke();
          }
          g.restore();
          return;
        }
        g.fillStyle = color;
        g.globalAlpha = a * (staticMode ? 1 : 0.5 + 0.5 * Math.sin(now / 180));
        g.beginPath();
        g.arc(q.x, q.y, Math.max(3, cellW * 0.42), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }, embers2 = function(p, kind, a) {
        if (!a || !seen(p)) return;
        const q = cell2(p), seed = p.x * 0.173 + p.y * 0.317;
        if (kind === "lava") {
          g.fillStyle = `rgba(255,70,12,${0.28 * a})`;
          g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH);
          for (const dot of driftingEmbers(now, seed, 4, staticMode)) {
            g.fillStyle = `rgba(255,140,30,${dot.alpha * a})`;
            g.fillRect(q.x + dot.x * cellW, q.y + dot.y * cellH, 2, 2);
          }
        } else {
          const ink2 = kind === "up" ? "255,133,41" : "217,145,255";
          g.fillStyle = `rgba(${ink2},${0.22 * a})`;
          g.beginPath();
          g.arc(q.x, q.y, Math.max(cellW, cellH) * 0.7, 0, Math.PI * 2);
          g.fill();
          for (const dot of driftingEmbers(now, seed, 5, staticMode)) {
            const reach = Math.max(cellW, cellH) * (0.25 + (1 - dot.alpha) * 0.4);
            g.fillStyle = `rgba(${ink2},${dot.alpha * 0.7 * a})`;
            g.fillRect(q.x + Math.cos(seed + dot.x) * reach, q.y + Math.sin(seed + dot.y) * reach, 2, 2);
          }
        }
      }, ring2 = function(p, a) {
        if (!a) return;
        const q = cell2(p), unit = Math.max(cellW, cellH), spin = staticMode ? 0 : now / 2800;
        g.strokeStyle = `rgba(64,191,255,${0.75 * a})`;
        g.lineWidth = Math.max(1, unit * 0.06);
        const radius = unit * 0.62;
        for (let i = 0; i < 8; i++) {
          const a0 = spin + i * Math.PI * 2 / 8;
          g.beginPath();
          g.arc(q.x, q.y, radius, a0, a0 + 1.7 / 8);
          g.stroke();
        }
      };
      var paint = paint2, embers = embers2, ring = ring2;
      const cellW = live.width / view.viewport.size.width, cellH = live.height / view.viewport.size.height;
      const cell2 = (p) => cellAnchor(view.viewport.origin, view.viewport.size, live, p);
      const seen = (p) => {
        const q = cell2(p);
        return q.x >= -cellW && q.y >= -cellH && q.x <= live.width + cellW && q.y <= live.height + cellH;
      };
      if (flags["anybandui.lowHealthEffect"] && intensity("lowHealth") > 0) {
        const v = healthIntensity(player?.hp, player?.maxHp, player?.hpWarning) * intensity("lowHealth");
        if (v) {
          g.fillStyle = `rgba(255,20,25,${v * (staticMode ? 0.1 : 0.08 + 0.08 * Math.sin(now / 45))})`;
          g.fillRect(0, 0, live.width, live.height);
        }
      }
      const dead = snap?.phase === "dead" || player?.dead === true;
      if (dead && !wasDead && flags["anybandui.deathEffect"] && intensity("death") > 0) {
        deadBurstAt = now;
        const at = player?.grid;
        if (at) cues.push({ grid: at, kind: "death", started: now, strength: 100 });
      }
      wasDead = dead;
      const grids = effectGrids(snap, known, flags["anybandui.itemGlowReveals"] === true);
      if (flags["anybandui.itemGlow"]) for (const glow of grids.glows) paint2(glow.grid, AURA_COLOURS[glow.aura], intensity("itemGlow"), glow.aura);
      const marked = markGrids(grids.asleep, grids.afraid, flags["anybandui.fearMarks"] === true && intensity("fearMarks") > 0);
      if (flags["anybandui.sleepMarks"]) for (const p of marked.sleep) {
        const q = cell2(p);
        g.strokeStyle = `rgba(190,220,255,${intensity("sleepMarks")})`;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(q.x - 3, q.y - cellH * 0.38);
        g.lineTo(q.x, q.y - cellH * 0.52);
        g.lineTo(q.x + 3, q.y - cellH * 0.38);
        g.stroke();
      }
      if (flags["anybandui.fearMarks"]) for (const p of marked.fear) {
        const q = cell2(p);
        const bob = staticMode ? 0 : Math.sin(now / 200) * cellH * 0.06;
        g.globalAlpha = intensity("fearMarks");
        g.fillStyle = "#f5ba69";
        g.font = `${Math.max(12, cellH * 0.55)}px sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("!", q.x, q.y - cellH * 0.42 + bob);
        g.globalAlpha = 1;
      }
      if (flags["anybandui.presenceHaze"]) for (const u of grids.uniques) paint2(u.grid, "#b45cff", intensity("presenceHaze") * (u.final ? 1 : 0.65));
      const places = flags["anybandui.lavaEmbers"] || flags["anybandui.stairEmbers"] ? sceneCells(known) : [];
      if (flags["anybandui.lavaEmbers"]) {
        for (const place of places) if (place.kind === "lava" && seen(place.grid)) embers2(place.grid, "lava", intensity("lava"));
      }
      if (flags["anybandui.stairEmbers"]) {
        for (const place of places) if (place.kind !== "lava" && seen(place.grid)) embers2(place.grid, place.kind, intensity("stairs"));
      }
      const recallAt = flags["anybandui.recallRing"] ? recallGrid(player) : null;
      if (recallAt && seen(recallAt)) ring2(recallAt, intensity("recall"));
      const flash = flags["anybandui.levelFlash"] ? levelFlashIntensity(levelWatch.started, now, staticMode) * intensity("level") : 0;
      if (flash > 0 && player?.grid && seen(player.grid)) {
        const q = cell2(player.grid);
        g.fillStyle = `rgba(255,196,80,${0.45 * flash})`;
        g.beginPath();
        g.arc(q.x, q.y, Math.max(cellW, cellH) * 0.9, 0, Math.PI * 2);
        g.fill();
      }
      let active = false;
      for (const c of cues) {
        const life = c.life ?? 650, delay = staticMode ? 0 : c.delay ?? 0, elapsed = now - c.started - delay;
        if (elapsed < 0) {
          active = true;
          continue;
        }
        const age = elapsed / life;
        if (age >= (staticMode ? 0.08 : 1)) continue;
        active = true;
        const q = cell2(c.grid), a = staticMode ? 0.45 : (1 - age) * c.strength / 100;
        if (c.kind === "blast") {
          g.fillStyle = c.colour ?? "#ffbe5a";
          g.globalAlpha = a * 0.55;
          g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH);
          g.globalAlpha = 1;
          continue;
        }
        if (c.kind === "number") {
          const rise = staticMode ? 0 : age * cellH * 0.65;
          g.globalAlpha = a;
          g.fillStyle = c.colour ?? "#ffce63";
          g.font = `${Math.max(13, cellH * 0.7)}px sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "bottom";
          g.fillText(c.text ?? "", q.x, q.y - cellH * 0.15 - rise);
          g.globalAlpha = 1;
          continue;
        }
        if (c.kind === "slide" && c.from) {
          const at = slidePlace(c.from, c.grid, staticMode ? 1 : age);
          const s = cell2(at);
          g.globalAlpha = a;
          g.fillStyle = "#d7e6f5";
          g.beginPath();
          g.arc(s.x, s.y, Math.max(3, cellW * 0.22), 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          continue;
        }
        if (c.kind === "ripple") {
          const radius = staticMode ? 0 : age * (c.span ?? 3.8);
          const cells = rippleCells(c.grid, known, radius);
          for (const p of cells) {
            const band = staticMode ? 0.3 : rippleAlpha(Math.hypot(p.x - c.grid.x, p.y - c.grid.y), radius, age);
            if (band <= 0) continue;
            const s = cell2(p);
            g.globalAlpha = band * c.strength / 100;
            g.fillStyle = "#a6d4ff";
            g.fillRect(s.x - cellW / 2, s.y - cellH / 2, cellW, cellH);
          }
          g.globalAlpha = 1;
          continue;
        }
        if (c.kind === "bolt" || c.kind === "cone") {
          const ink2 = c.colour ?? "#ffbe5a";
          g.fillStyle = ink2;
          g.globalAlpha = a * (c.kind === "cone" ? 0.42 : 0.34);
          g.fillRect(q.x - cellW / 2, q.y - cellH / 2, cellW, cellH);
          g.globalAlpha = a;
          g.font = `${Math.max(12, cellH * 0.8)}px sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(c.glyph ?? "*", q.x, q.y);
          g.globalAlpha = 1;
          continue;
        }
        g.strokeStyle = `rgba(${c.kind === "heal" ? "100,255,160" : c.kind === "cast" ? "100,190,255" : "255,190,90"},${a})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(q.x, q.y, staticMode ? 5 : 4 + age * cellH * 0.55, 0, Math.PI * 2);
        g.stroke();
      }
      cues.splice(0, cues.length, ...cues.filter((c) => now - c.started < (c.life ?? 650) + (staticMode ? 0 : c.delay ?? 0)));
      if (flags["anybandui.deathEffect"] && deadBurstAt && now - deadBurstAt < 900) active = true;
      if (sceneAlpha > 0) cover(drawRect, sceneAlpha);
      if (sceneAlpha === 0) hold(live);
      const crtOn = flags["anybandui.crt"] && intensity("crt") > 0;
      if (crtOn) {
        g.fillStyle = `rgba(0,0,0,${0.1 * intensity("crt")})`;
        for (let y = 0; y < live.height; y += 3) g.fillRect(0, y, live.width, 1);
        if (!staticMode) {
          const y = now / 14 % live.height;
          g.fillStyle = "rgba(120,220,255,.08)";
          g.fillRect(0, y, live.width, Math.max(2, cellH * 0.18));
        }
      }
      if (sceneAlpha === 0) sampled(live, intensity("crtGlow"), intensity("crtFringe"));
      if (flags["anybandui.crtSweep"] && !staticMode && intensity("crtSweep") > 0) sweep(live.height, live.width, intensity("crtSweep"));
      const moving = !staticMode && (crtOn || flags["anybandui.crtSweep"] && intensity("crtSweep") > 0 || flags["anybandui.lowHealthEffect"] && healthIntensity(player?.hp, player?.maxHp, player?.hpWarning) > 0 || flags["anybandui.sleepMarks"] && grids.asleep.length > 0 || flags["anybandui.fearMarks"] && grids.afraid.length > 0 || flags["anybandui.itemGlow"] && grids.glows.length > 0 || flags["anybandui.presenceHaze"] && grids.uniques.length > 0 || places.length > 0 || recallAt !== null || flags["anybandui.crtGlow"] && intensity("crtGlow") > 0 || flags["anybandui.crtFringe"] && intensity("crtFringe") > 0);
      if (active || sceneAlpha > 0 || flash > 0 || moving) request();
    } else if (sceneAlpha > 0) {
      cover(drawRect, sceneAlpha);
      request();
    }
    function cover(area, alpha) {
      if (heldReady) {
        g.globalAlpha = alpha;
        g.drawImage(held, 0, 0, area.width, area.height);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = `rgba(8,12,17,${alpha})`;
        g.fillRect(0, 0, area.width, area.height);
      }
    }
    function hold(area) {
      const game = terminalCanvas();
      if (game && blitRegion(game, area, held)) heldReady = true;
    }
    function sampled(area, glow, fringe) {
      if (!(flags["anybandui.crtGlow"] && glow > 0) && !(flags["anybandui.crtFringe"] && fringe > 0)) return;
      const game = terminalCanvas();
      if (!game || !blitRegion(game, area, sample)) return;
      if (flags["anybandui.crtFringe"] && fringe > 0) fringeChannels(fringeOffset(fringe, area.width), fringe, area.width, area.height);
      if (flags["anybandui.crtGlow"] && glow > 0) phosphor(glow, area.width, area.height);
    }
    function fringeChannels(shift, amount, width, height) {
      if (shift <= 0) return;
      const channel2 = (color, dx) => {
        fringeScratch.width = sample.width;
        fringeScratch.height = sample.height;
        const sg = fringeScratch.getContext("2d");
        if (!sg) return;
        sg.setTransform(1, 0, 0, 1, 0, 0);
        sg.globalCompositeOperation = "source-over";
        sg.clearRect(0, 0, fringeScratch.width, fringeScratch.height);
        sg.drawImage(sample, dx, 0);
        sg.globalCompositeOperation = "multiply";
        sg.fillStyle = color;
        sg.fillRect(0, 0, fringeScratch.width, fringeScratch.height);
        sg.globalCompositeOperation = "destination-in";
        sg.drawImage(sample, dx, 0);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 0.85 * amount;
        g.drawImage(fringeScratch, 0, 0, width, height);
        g.restore();
      };
      try {
        channel2("#ff0000", shift);
        channel2("#0000ff", -shift);
      } catch {
      }
    }
    function phosphor(amount, width, height) {
      const sg = sample.getContext("2d");
      if (!sg || !(sample.width > 0) || !(sample.height > 0)) return;
      let image;
      try {
        image = sg.getImageData(0, 0, sample.width, sample.height);
      } catch {
        return;
      }
      const px = image.data;
      let lit = false;
      for (let i = 0; i < px.length; i += 4) {
        const keep = phosphorKeep(px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0);
        px[i + 3] = Math.round(255 * keep);
        if (keep > 0.05) lit = true;
      }
      if (!lit) return;
      glowScratch.width = sample.width;
      glowScratch.height = sample.height;
      const gg = glowScratch.getContext("2d");
      if (!gg) return;
      gg.putImageData(image, 0, 0);
      g.save();
      g.globalAlpha = 0.55 * amount;
      try {
        g.filter = `blur(${Math.max(1, Math.round(1 + 3 * amount))}px)`;
      } catch {
        g.filter = "none";
      }
      g.drawImage(glowScratch, 0, 0, width, height);
      g.filter = "none";
      g.restore();
    }
    function sweep(height, width, amount) {
      const front = now / 4e3 % 1 * height, trail = height * 0.24, yStart = front - trail;
      const band = (y0, y1) => {
        if (y1 - y0 < 1) return;
        const grad = g.createLinearGradient(0, y0, 0, y1);
        for (let i = 0; i <= 4; i++) {
          const y = y0 + (y1 - y0) * i / 4;
          grad.addColorStop(i / 4, `rgba(170,220,255,${sweepTrail(y, front, height) * 0.18 * amount})`);
        }
        g.fillStyle = grad;
        g.fillRect(0, y0, width, y1 - y0);
      };
      if (yStart >= 0) band(yStart, front);
      else {
        band(0, front);
        band(height + yStart, height);
      }
    }
  }
  const tick = globalThis.setInterval(request, 250);
  request();
  return () => {
    globalThis.clearInterval(tick);
    if (raf) cancelAnimationFrame(raf);
    if (listenCombat) {
      ctx.events?.off("combat-outcome", combat);
      ctx.events?.off("heal", heal);
    }
    if (listenMotion) ctx.events?.off("motion", motion);
    if (listenBlast) ctx.events?.off("explosion", explosion);
    if (listenBolt) ctx.events?.off("bolt", bolt);
    canvas.remove();
    cues.length = 0;
  };
}

// src/menus/game-session.ts
var SESSION_LABELS = {
  save: "Save and continue",
  close: "Save and return to main menu",
  quit: "Save and quit"
};
var SESSION_QUESTIONS = {
  close: "Save this character and return to the main menu?",
  quit: "Save this character and quit?"
};
var DONE = {
  save: "Game saved.",
  close: "Game saved. Returning to the main menu.",
  quit: "Game saved. Quitting."
};
function outcome(action, result) {
  if (result.ok) return { ok: true, message: DONE[action] };
  return { ok: false, message: `The game was not saved: ${result.reason}` };
}
async function runSessionAction(session, action) {
  if (!session) return { ok: false, message: "This game does not let mods save it." };
  try {
    if (action === "save") return outcome(action, await session.save());
    return outcome(action, await (action === "close" ? session.exitToTitle() : session.quit()));
  } catch (err) {
    return { ok: false, message: `The game was not saved: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// src/menus/layout-history.ts
var HISTORY_LIMIT = 50;
function createLayoutHistory(seam, limit = HISTORY_LIMIT) {
  const undoSteps = [];
  const redoSteps = [];
  const listeners = /* @__PURE__ */ new Set();
  let last = seam.layout();
  let restoring = null;
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const stop = seam.onLayoutChange((text) => {
    if (restoring !== null && text === restoring) {
      restoring = null;
      last = text;
      return;
    }
    restoring = null;
    if (text === last) return;
    undoSteps.push(last);
    if (undoSteps.length > limit) undoSteps.splice(0, undoSteps.length - limit);
    redoSteps.length = 0;
    last = text;
    notify();
  });
  const step = (from, to) => {
    const target = from.pop();
    if (target === void 0) return false;
    const previous = last;
    restoring = target;
    let ok = false;
    try {
      ok = seam.setLayout(target);
    } catch {
      ok = false;
    }
    if (!ok) {
      restoring = null;
      notify();
      return false;
    }
    to.push(previous);
    last = target;
    notify();
    return true;
  };
  return {
    canUndo: () => undoSteps.length > 0,
    canRedo: () => redoSteps.length > 0,
    undo: () => step(undoSteps, redoSteps),
    redo: () => step(redoSteps, undoSteps),
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      stop();
      listeners.clear();
    }
  };
}
var SAVED_LAYOUTS_KEY = "savedLayouts";
var SAVED_LAYOUT_LIMIT = 32;
var LAYOUT_NAME_MAX = 40;
function readSavedLayouts(raw) {
  const root = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const block2 = root[SAVED_LAYOUTS_KEY];
  const entries = block2 !== null && typeof block2 === "object" && !Array.isArray(block2) ? block2.entries : void 0;
  if (!Array.isArray(entries)) return [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const entry2 of entries) {
    if (entry2 === null || typeof entry2 !== "object") continue;
    const { name, layout } = entry2;
    if (typeof name !== "string" || typeof layout !== "string" || !name.trim() || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, layout });
  }
  return out.slice(0, SAVED_LAYOUT_LIMIT);
}
var refuse = (reason) => ({ ok: false, reason });
function createSavedLayouts(seam, prefs) {
  const write = (entries) => {
    const stored = prefs.get();
    const root = stored !== null && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    prefs.set({ ...root, [SAVED_LAYOUTS_KEY]: { v: 1, entries: entries.map(({ name, layout }) => ({ name, layout })) } });
  };
  const check = (name) => {
    if (!name) return "Type a name for the layout.";
    if (name.length > LAYOUT_NAME_MAX) return `Use a name of ${LAYOUT_NAME_MAX} characters or fewer.`;
    return null;
  };
  return {
    list: () => readSavedLayouts(prefs.get()),
    save(raw) {
      const name = raw.trim();
      const problem = check(name);
      if (problem) return refuse(problem);
      const entries = readSavedLayouts(prefs.get());
      const at = entries.findIndex((entry2) => entry2.name === name);
      if (at < 0 && entries.length >= SAVED_LAYOUT_LIMIT) return refuse(`You can keep ${SAVED_LAYOUT_LIMIT} saved layouts. Delete one first.`);
      const saved = { name, layout: seam.layout() };
      if (at < 0) entries.push(saved);
      else entries[at] = saved;
      write(entries);
      return { ok: true };
    },
    restore(name) {
      const entry2 = readSavedLayouts(prefs.get()).find((saved) => saved.name === name);
      if (!entry2) return refuse(`There is no saved layout called ${name}.`);
      return seam.setLayout(entry2.layout) ? { ok: true } : refuse(`The game could not use the layout saved as ${name}.`);
    },
    rename(from, raw) {
      const to = raw.trim();
      const problem = check(to);
      if (problem) return refuse(problem);
      const entries = readSavedLayouts(prefs.get());
      const at = entries.findIndex((entry2) => entry2.name === from);
      if (at < 0) return refuse(`There is no saved layout called ${from}.`);
      if (to === from) return { ok: true };
      if (entries.some((entry2) => entry2.name === to)) return refuse(`A layout called ${to} is already saved.`);
      entries[at] = { name: to, layout: entries[at].layout };
      write(entries);
      return { ok: true };
    },
    remove(name) {
      const entries = readSavedLayouts(prefs.get());
      const rest2 = entries.filter((entry2) => entry2.name !== name);
      if (rest2.length === entries.length) return refuse(`There is no saved layout called ${name}.`);
      write(rest2);
      return { ok: true };
    }
  };
}

// src/menus/settings-window.ts
var SETTINGS_KEY = "settings-window";
var STRENGTH_GROUPS = [
  ["Atmosphere and milestones", [
    { id: "anybandui.lowHealthStrength", title: "Low health tint strength", flag: "anybandui.lowHealthEffect" },
    { id: "anybandui.sceneFadeStrength", title: "Scene fade strength", flag: "anybandui.sceneFade" },
    { id: "anybandui.levelFlashStrength", title: "Level flash strength", flag: "anybandui.levelFlash" },
    { id: "anybandui.deathStrength", title: "Death burst strength", flag: "anybandui.deathEffect" }
  ]],
  ["Movement and combat", [
    { id: "anybandui.walkSlideStrength", title: "Walk slide strength", flag: "anybandui.walkSlide" },
    { id: "anybandui.blinkRippleStrength", title: "Teleport ripple strength", flag: "anybandui.blinkRipple" },
    { id: "anybandui.boltGlyphsStrength", title: "Bolt glyph strength", flag: "anybandui.boltGlyphs" },
    { id: "anybandui.coneWashStrength", title: "Breath cone strength", flag: "anybandui.coneWash" },
    { id: "anybandui.spellEffectsStrength", title: "Combat ring strength", flag: "anybandui.spellEffects" },
    { id: "anybandui.damageNumbersStrength", title: "Damage number strength", flag: "anybandui.damageNumbers" }
  ]],
  ["Dungeon indicators", [
    { id: "anybandui.itemGlowStrength", title: "Floor item glow strength", flag: "anybandui.itemGlow" },
    { id: "anybandui.presenceHazeStrength", title: "Presence haze strength", flag: "anybandui.presenceHaze" },
    { id: "anybandui.stairEmbersStrength", title: "Stair ember strength", flag: "anybandui.stairEmbers" },
    { id: "anybandui.lavaEmbersStrength", title: "Lava ember strength", flag: "anybandui.lavaEmbers" },
    { id: "anybandui.recallRingStrength", title: "Recall ring strength", flag: "anybandui.recallRing" },
    { id: "anybandui.sleepMarksStrength", title: "Sleep mark strength", flag: "anybandui.sleepMarks" },
    { id: "anybandui.fearMarksStrength", title: "Fear mark strength", flag: "anybandui.fearMarks" }
  ]],
  ["CRT effects", [
    { id: "anybandui.crtStrength", title: "CRT strength", flag: "anybandui.crt" },
    { id: "anybandui.crtGlowStrength", title: "Phosphor glow strength", flag: "anybandui.crtGlow" },
    { id: "anybandui.crtFringeStrength", title: "Colour fringe strength", flag: "anybandui.crtFringe" },
    { id: "anybandui.crtSweepStrength", title: "CRT sweep strength", flag: "anybandui.crtSweep" }
  ]]
];
var STRENGTH_PRESETS = [["Subtle", 30], ["Classic", 60], ["Vivid", 80], ["Zero Cool", 100]];
var HOVER_PRESETS = [["Quick", 250], ["Standard", 550], ["Patient", 1e3]];
function cueKindsFor(id) {
  return Object.entries(STRENGTH_SETTINGS).filter(([, setting]) => setting === id).map(([kind]) => kind);
}
var PAGES = [
  { id: "interaction", group: "Play", title: "Interaction", summary: "How the mouse and hover cards behave." },
  { id: "keys", group: "Play", title: "Keybindings", summary: "Your keymaps for the current keyset.", opens: { key: KEYBINDINGS_KEY, flag: "anybandui.keybindingEditor", switchTitle: "Keybinding editor" } },
  { id: "options", group: "Play", title: "Game options", summary: "The game's own options for this character.", opens: { key: OPTIONS_KEY, flag: "anybandui.optionsEditor", switchTitle: "Game options editor" } },
  { id: "knowledge", group: "Play", title: "Knowledge", summary: "What your character has learned about the world.", opens: { key: KNOWLEDGE_KEY, flag: "anybandui.knowledgeBrowser", switchTitle: "Knowledge browser" } },
  { id: "session", group: "Play", title: "Save game", summary: "Save this character, or save and leave. These act at once." },
  { id: "theme", group: "Presentation", title: "Theme", summary: "The colours of this mod's panels and window frames." },
  { id: "effects", group: "Presentation", title: "Effects", summary: "How strongly each dungeon effect is drawn." },
  { id: "layout", group: "Presentation", title: "Layout", summary: "Undo and redo changes to the panel layout, and keep layouts by name. These act at once." }
];
function draftFromSettings(settings, read) {
  const strengths = {};
  for (const [, members] of STRENGTH_GROUPS) for (const setting of members) {
    let stored;
    if (read) {
      try {
        stored = read(setting.id);
      } catch {
        stored = void 0;
      }
    } else stored = cueKindsFor(setting.id).map((kind) => settings.effects[kind]).find((value2) => typeof value2 === "number");
    strengths[setting.id] = typeof stored === "number" ? stored : 100;
  }
  return { theme: settings.theme, keepCustom: settings.customTheme !== null, hoverDelayMs: settings.hoverDelayMs, strengths };
}
function rebaseDraft(base, draft, fresh) {
  const themeTouched = draft.theme !== base.theme || draft.keepCustom !== base.keepCustom;
  const strengths = {};
  for (const id of /* @__PURE__ */ new Set([...Object.keys(fresh.strengths), ...Object.keys(draft.strengths)])) {
    const value2 = draft.strengths[id] === base.strengths[id] ? fresh.strengths[id] : draft.strengths[id];
    if (value2 !== void 0) strengths[id] = value2;
  }
  return {
    theme: themeTouched ? draft.theme : fresh.theme,
    keepCustom: themeTouched ? draft.keepCustom : fresh.keepCustom,
    hoverDelayMs: draft.hoverDelayMs === base.hoverDelayMs ? fresh.hoverDelayMs : draft.hoverDelayMs,
    strengths
  };
}
function strengthWrites(draft, read) {
  return Object.entries(draft.strengths).filter(([id, value2]) => {
    let stored;
    try {
      stored = read(id);
    } catch {
      stored = void 0;
    }
    return (typeof stored === "number" ? stored : 100) !== value2;
  });
}
function settingsPatch(current, draft, writeStrengths) {
  const patch = {};
  if (draft.theme !== current.theme) patch.theme = draft.theme;
  if (!draft.keepCustom && current.customTheme !== null) patch.customTheme = null;
  if (draft.hoverDelayMs !== current.hoverDelayMs) patch.hoverDelayMs = draft.hoverDelayMs;
  if (writeStrengths) {
    const effects = { ...current.effects };
    let moved = false;
    for (const [id, value2] of Object.entries(draft.strengths)) for (const kind of cueKindsFor(id)) {
      if ((current.effects[kind] ?? 100) === value2) continue;
      effects[kind] = value2;
      moved = true;
    }
    if (moved) patch.effects = effects;
  }
  return patch;
}
var pageFocus2 = (id) => `page:${id}`;
function installSettingsWindow(ctx) {
  if (ctx.flags?.["anybandui.settingsWindow"] !== true) return () => {
  };
  const current = () => validateSettings(ctx.prefs?.get());
  const seam = ctx.settings;
  const read = seam ? (id) => seam.get(id) : void 0;
  let base = draftFromSettings(current(), read);
  let draft = draftFromSettings(current(), read);
  const rebase = () => {
    const fresh = draftFromSettings(current(), read);
    if (JSON.stringify(fresh) === JSON.stringify(base)) return;
    draft = rebaseDraft(base, draft, fresh);
    base = fresh;
  };
  const reset = () => {
    base = draftFromSettings(current(), read);
    draft = draftFromSettings(current(), read);
  };
  let page = PAGES[0].id;
  let confirm2 = null;
  let confirmReturn = "save";
  let note = "";
  let pageNote = null;
  let leaving = false;
  let layoutName = "";
  let renaming = null;
  const history = ctx.subwindows ? createLayoutHistory(ctx.subwindows) : null;
  const saved = ctx.subwindows && ctx.prefs ? createSavedLayouts(ctx.subwindows, ctx.prefs) : null;
  let surface = null;
  const repaint = (focusKey) => surface?.repaint(focusKey);
  const pending = () => {
    rebase();
    return settingsPatch(current(), draft, !read);
  };
  const strengthChanges = () => read ? strengthWrites(draft, read) : [];
  const changed = () => Object.keys(pending()).length > 0 || strengthChanges().length > 0;
  const ask = (next, back = "save") => {
    confirm2 = next;
    confirmReturn = back;
    repaint(CONFIRM_NO);
  };
  const commit = () => {
    const patch = pending();
    if (Object.keys(patch).length > 0 && !ctx.prefs) {
      note = "This game does not keep this mod's settings.";
      repaint("save");
      return;
    }
    if (ctx.prefs) {
      const before = JSON.stringify(themeFromPrefs(ctx.prefs.get()));
      createSettingsStore({ prefs: ctx.prefs }).set(patch);
      const theme = themeFromPrefs(ctx.prefs.get());
      if (JSON.stringify(theme) !== before) broadcastTheme(ctx, theme);
    }
    for (const [id, value2] of strengthChanges()) {
      try {
        seam?.set(id, value2);
      } catch {
      }
    }
    reset();
    note = "Saved.";
    repaint("save");
  };
  const save = () => {
    if (!changed()) return;
    if (pending().customTheme === null) {
      ask({ question: "Saving removes your custom theme colours. Save anyway?", yes: "Save", onYes: commit });
      return;
    }
    commit();
  };
  const cancel = (focusKey) => {
    if (!changed()) {
      reset();
      note = "";
      repaint(focusKey);
      return;
    }
    ask({ question: "Throw away your changes to these settings?", yes: "Discard", onYes: () => {
      reset();
      note = "Changes discarded.";
      repaint(focusKey);
    } });
  };
  const runSession = (action) => {
    leaving = true;
    pageNote = null;
    repaint(`session:${action}`);
    void runSessionAction(ctx.session, action).then((result) => {
      leaving = false;
      pageNote = { text: result.message, warn: !result.ok };
      repaint(`session:${action}`);
    });
  };
  const layoutResult = (result, done, focusKey) => {
    pageNote = result.ok ? { text: done, warn: false } : { text: result.reason ?? "That did not work.", warn: true };
    repaint(focusKey);
  };
  const renderSession = (parent, mark) => {
    if (!ctx.session) {
      el6(parent, "p", "This game does not let mods save it.").className = "muted";
      return;
    }
    const actions = el6(parent, "div");
    actions.className = "actions";
    for (const action of ["save", "close", "quit"]) {
      const node2 = button2(actions, SESSION_LABELS[action], `session:${action}`, () => {
        if (action === "save") {
          runSession(action);
          return;
        }
        ask({ question: SESSION_QUESTIONS[action], yes: SESSION_LABELS[action], onYes: () => runSession(action) }, `session:${action}`);
      });
      mark(node2);
      node2.disabled = leaving || confirm2 !== null;
    }
    el6(parent, "p", "Save and quit closes the desktop app. In a browser it returns to the main menu.").className = "muted";
  };
  const renderLayout = (parent, mark) => {
    if (!history) {
      el6(parent, "p", "This game cannot save or restore its layout.").className = "muted";
      return;
    }
    const busy = confirm2 !== null;
    const refused = { ok: false, reason: "The game could not put that layout back." };
    const steps = el6(parent, "div");
    steps.className = "actions";
    const undo = button2(steps, "Undo", "layout:undo", () => layoutResult(history.undo() ? { ok: true } : refused, "Layout change undone.", "layout:undo"));
    mark(undo);
    undo.disabled = busy || !history.canUndo();
    undo.title = "Undo the last layout change";
    const redo = button2(steps, "Redo", "layout:redo", () => layoutResult(history.redo() ? { ok: true } : refused, "Layout change redone.", "layout:redo"));
    redo.disabled = busy || !history.canRedo();
    redo.title = "Redo the last undone change";
    el6(parent, "div", "Saved layouts").className = "section";
    if (!saved) {
      el6(parent, "p", "This game does not keep this mod's settings, so layouts cannot be saved.").className = "muted";
      return;
    }
    const entries = saved.list();
    el6(parent, "p", entries.length === 0 ? "No saved layouts yet." : "Choose a layout to restore it.").className = "muted";
    for (const entry2 of entries) {
      const row2 = el6(parent, "div");
      row2.className = "field";
      if (renaming?.from === entry2.name) {
        const edit = renaming;
        const input = el6(row2, "input");
        input.type = "text";
        input.value = edit.text;
        input.maxLength = LAYOUT_NAME_MAX;
        input.dataset["focus"] = `layout-rename:${entry2.name}`;
        input.setAttribute("aria-label", `New name for ${entry2.name}`);
        const apply = () => {
          const named = edit.text.trim();
          const result = saved.rename(edit.from, edit.text);
          if (result.ok) renaming = null;
          layoutResult(result, `Renamed to ${named}.`, result.ok ? `layout-saved:${named}` : `layout-rename:${entry2.name}`);
        };
        input.addEventListener("input", () => {
          edit.text = input.value;
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            swallow(event);
            apply();
          } else if (event.key === "Escape") {
            swallow(event);
            renaming = null;
            repaint(`layout-saved:${entry2.name}`);
          }
        });
        button2(row2, "Rename", `layout-apply:${entry2.name}`, apply).disabled = busy;
        button2(row2, "Cancel", `layout-keep:${entry2.name}`, () => {
          renaming = null;
          repaint(`layout-saved:${entry2.name}`);
        }).disabled = busy;
        continue;
      }
      const restore = button2(row2, entry2.name, `layout-saved:${entry2.name}`, () => layoutResult(saved.restore(entry2.name), `Restored ${entry2.name}.`, `layout-saved:${entry2.name}`));
      restore.className = "row";
      restore.style.flex = "1";
      restore.title = `Restore ${entry2.name}`;
      restore.disabled = busy;
      button2(row2, "Rename", `layout-rename-open:${entry2.name}`, () => {
        renaming = { from: entry2.name, text: entry2.name };
        pageNote = null;
        repaint(`layout-rename:${entry2.name}`);
      }).disabled = busy;
      button2(row2, "Delete", `layout-delete:${entry2.name}`, () => {
        ask({ question: `Delete the saved layout ${entry2.name}?`, yes: "Delete", onYes: () => layoutResult(saved.remove(entry2.name), `Deleted ${entry2.name}.`, "layout:name") }, `layout-saved:${entry2.name}`);
      }).disabled = busy;
    }
    el6(parent, "p", "Save the current layout").className = "muted";
    const row = el6(parent, "div");
    row.className = "controls";
    const name = el6(row, "input");
    name.type = "text";
    name.placeholder = "Layout name";
    name.value = layoutName;
    name.maxLength = LAYOUT_NAME_MAX;
    name.dataset["focus"] = "layout:name";
    name.setAttribute("aria-label", "Layout name");
    const replacing = entries.some((entry2) => entry2.name === layoutName.trim());
    const store = () => {
      const named = layoutName.trim();
      const result = saved.save(layoutName);
      if (result.ok) layoutName = "";
      layoutResult(result, `Saved the current layout as ${named}.`, "layout:name");
    };
    name.addEventListener("input", () => {
      layoutName = name.value;
      repaint();
    });
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        swallow(event);
        store();
      }
    });
    const keep = button2(row, replacing ? "Replace saved layout" : "Save layout", "layout:save", store);
    keep.disabled = busy || layoutName.trim() === "" || !replacing && entries.length >= SAVED_LAYOUT_LIMIT;
  };
  const renderPage = (parent, info) => {
    el6(parent, "div", info.title).className = "section";
    el6(parent, "p", info.summary).className = "muted";
    let first = true;
    const mark = (node2) => {
      if (first) {
        node2.dataset["first"] = "true";
        first = false;
      }
      return node2;
    };
    if (info.opens) {
      const opens = info.opens;
      if (ctx.flags?.[opens.flag] === true && hasOpener(opens.key)) {
        mark(button2(parent, `Open ${info.title}`, `open:${info.id}`, () => {
          if (!openMenu(opens.key)) {
            note = `${info.title} is not open.`;
            repaint();
          }
        }));
      } else el6(parent, "p", `Turn on ${opens.switchTitle} on the Mods screen to use it here.`);
      return;
    }
    if (info.id === "session" || info.id === "layout") {
      if (info.id === "session") renderSession(parent, mark);
      else renderLayout(parent, mark);
      if (pageNote) {
        const line = el6(parent, "p", pageNote.text);
        line.className = pageNote.warn ? "warn" : "note";
        line.setAttribute("role", "status");
      }
      return;
    }
    if (info.id === "interaction") {
      const presets2 = el6(parent, "div");
      presets2.className = "tabs";
      for (const [label2, ms] of HOVER_PRESETS) {
        const node2 = mark(button2(presets2, `${label2} (${ms} ms)`, `hover:${label2}`, () => {
          draft.hoverDelayMs = ms;
          note = "";
          repaint(`hover:${label2}`);
        }));
        node2.setAttribute("aria-pressed", String(draft.hoverDelayMs === ms));
      }
      const row = el6(parent, "label");
      row.className = "field";
      el6(row, "span", "Hover card delay");
      const range = el6(row, "input");
      range.type = "range";
      range.min = "0";
      range.max = "5000";
      range.step = "50";
      range.value = String(draft.hoverDelayMs);
      range.dataset["focus"] = "hover-delay";
      range.setAttribute("aria-label", "Hover card delay");
      const readout = el6(row, "span", `${draft.hoverDelayMs} ms`);
      range.addEventListener("input", () => {
        const next = Math.round(Number(range.value));
        if (!Number.isFinite(next)) return;
        draft.hoverDelayMs = Math.max(0, Math.min(5e3, next));
        readout.textContent = `${draft.hoverDelayMs} ms`;
      });
      range.addEventListener("change", () => repaint());
      el6(parent, "p", "How long the pointer rests on a tile before its hover card opens.").className = "muted";
      return;
    }
    if (info.id === "theme") {
      const presets2 = el6(parent, "div");
      presets2.className = "tabs";
      for (const [id, label2] of themeChoices()) {
        const node2 = mark(button2(presets2, label2, `theme:${id}`, () => {
          draft.theme = id;
          draft.keepCustom = false;
          note = "";
          repaint(`theme:${id}`);
        }));
        node2.setAttribute("aria-pressed", String(draft.theme === id && !draft.keepCustom));
      }
      if (current().customTheme) {
        const row = el6(parent, "label");
        row.className = "field";
        const box = el6(row, "input");
        box.type = "checkbox";
        box.checked = draft.keepCustom;
        box.dataset["focus"] = "keep-custom";
        box.setAttribute("aria-label", "Use my custom theme");
        box.addEventListener("change", () => {
          draft.keepCustom = box.checked;
          repaint();
        });
        el6(row, "span", "Use my custom theme").style.flex = "1";
      }
      if (ctx.flags?.["anybandui.themeEditor"] === true && hasOpener("theme-editor")) {
        button2(parent, "Edit colours", "open:theme-editor", () => {
          openMenu("theme-editor");
        });
      } else el6(parent, "p", "Turn on Theme on the Mods screen to edit the colours.").className = "muted";
      return;
    }
    const presets = el6(parent, "div");
    presets.className = "tabs";
    for (const [label2, value2] of STRENGTH_PRESETS) {
      const node2 = mark(button2(presets, label2, `strength:${label2}`, () => {
        for (const id of Object.keys(draft.strengths)) draft.strengths[id] = value2;
        note = "";
        repaint(`strength:${label2}`);
      }));
      node2.setAttribute("aria-pressed", String(Object.values(draft.strengths).every((v) => v === value2)));
    }
    el6(parent, "p", read ? "A preset sets every effect to the same strength. These are the strengths under this mod on the Mods screen." : "A preset sets every effect to the same strength.").className = "muted";
    for (const [group, members] of STRENGTH_GROUPS) {
      el6(parent, "div", group).className = "section";
      for (const setting of members) {
        const on = ctx.flags?.[setting.flag] === true;
        const row = el6(parent, "label");
        row.className = "field";
        el6(row, "span", on ? setting.title : `${setting.title} (effect off)`).style.flex = "1";
        const range = el6(row, "input");
        range.type = "range";
        range.min = "0";
        range.max = "100";
        range.step = "10";
        range.value = String(draft.strengths[setting.id] ?? 100);
        range.dataset["focus"] = `strength:${setting.id}`;
        range.setAttribute("aria-label", setting.title);
        const readout = el6(row, "span", `${draft.strengths[setting.id] ?? 100}%`);
        range.addEventListener("input", () => {
          const next = Math.round(Number(range.value) / 10) * 10;
          if (!Number.isFinite(next)) return;
          draft.strengths[setting.id] = Math.max(0, Math.min(100, next));
          readout.textContent = `${draft.strengths[setting.id]}%`;
        });
        range.addEventListener("change", () => repaint());
      }
    }
  };
  const render = (mount) => {
    rebase();
    el6(mount, "h2", "Settings");
    const split = el6(mount, "div");
    split.className = "split";
    const nav = el6(split, "div");
    nav.className = "nav";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-orientation", "vertical");
    let group = "";
    for (const info2 of PAGES) {
      if (info2.group !== group) {
        el6(nav, "div", info2.group === "Play" ? "PLAY" : "PRESENTATION").className = "group";
        group = info2.group;
      }
      const tab = button2(nav, info2.title, pageFocus2(info2.id), () => {
        if (page !== info2.id) {
          pageNote = null;
          renaming = null;
        }
        page = info2.id;
        repaint(pageFocus2(info2.id));
      });
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(info2.id === page));
    }
    el6(nav, "p", "Changes apply when you save, except on Save game and Layout.").className = "muted";
    const content = el6(split, "div");
    content.className = "page";
    const info = PAGES.find((p) => p.id === page) ?? PAGES[0];
    renderPage(content, info);
    nav.addEventListener("keydown", (event) => {
      if (confirm2) return;
      const at = PAGES.findIndex((p) => p.id === page);
      const next = listStep(event.key, at, PAGES.length);
      if (next !== null) {
        swallow(event);
        pageNote = null;
        renaming = null;
        page = PAGES[next].id;
        repaint(pageFocus2(page));
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        const first = Array.from(content.querySelectorAll("[data-focus]")).find((node2) => node2.dataset["first"] === "true") ?? content.querySelector("[data-focus]");
        if (first) {
          swallow(event);
          first.focus();
        }
        return;
      }
      if (event.key === "Escape" && changed()) {
        swallow(event);
        cancel(pageFocus2(page));
      }
    });
    content.addEventListener("keydown", (event) => {
      if (confirm2 || event.key !== "Escape") return;
      swallow(event);
      repaint(pageFocus2(page));
    });
    if (confirm2) renderConfirm(mount, confirm2, () => {
      confirm2 = null;
      repaint(confirmReturn);
    });
    const actions = el6(mount, "div");
    actions.className = "actions";
    const busy = confirm2 !== null;
    button2(actions, "Save", "save", save).disabled = busy || !changed();
    button2(actions, "Cancel", "cancel", () => cancel("cancel")).disabled = busy;
    if (note) el6(mount, "p", note).className = "note";
  };
  surface = openMenuSurface(ctx, { key: SETTINGS_KEY, label: "Settings", tab: "Settings", minSize: { width: 420, height: 260 }, placement: { kind: "dock", target: "main", edge: "right" }, firstFocus: pageFocus2(page) }, render);
  if (!surface) {
    history?.close();
    ctx.log("settings window: panel seam unavailable");
    return () => {
    };
  }
  const stopTheme2 = onThemeChange(() => repaint());
  let stopSettings = () => {
  };
  try {
    stopSettings = seam?.onChange(() => repaint()) ?? stopSettings;
  } catch {
  }
  const stopHistory = history?.onChange(() => {
    if (page === "layout") repaint();
  }) ?? (() => {
  });
  return () => {
    stopTheme2();
    stopSettings();
    stopHistory();
    history?.close();
    surface?.close();
    surface = null;
  };
}

// src/map-mouse.ts
function ready(snap) {
  return !!snap && snap.phase === "play" && !snap.messagePending && !snap.prompt && !!viewPlayer(snap);
}
function sameToken3(a, b) {
  return a.epoch === b.epoch && a.revision === b.revision;
}
function walkIntent(player, at) {
  const dx = at.x - player.x, dy = at.y - player.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
    return { kind: "command", command: { code: "walk", dir: 5 + Math.sign(dx) - 3 * Math.sign(dy) } };
  }
  return { kind: "travel", x: at.x, y: at.y };
}
function clickIntent(player, at, modifiers = {}) {
  if (modifiers.shift && modifiers.ctrl) return null;
  if (modifiers.ctrl) return { kind: "travel", x: at.x, y: at.y, modifiers: { ctrl: true } };
  if (modifiers.shift) {
    const adjacent = Math.max(Math.abs(at.x - player.x), Math.abs(at.y - player.y)) === 1;
    return adjacent ? { kind: "travel", x: at.x, y: at.y, modifiers: { shift: true } } : null;
  }
  return walkIntent(player, at);
}
var PRE_MODIFIER_REFUSAL = "malformed travel destination";
var TILE_ACTION_LABELS = {
  tunnel: "Tunnel",
  open: "Open",
  close: "Close",
  disarm: "Disarm",
  ascend: "Go up the stairs",
  descend: "Go down the stairs",
  pickup: "Pick up"
};
var DIRECTED_CODES = /* @__PURE__ */ new Set(["tunnel", "open", "close", "disarm"]);
function tileMenuActions(ctx, snap, at) {
  if (snap.prompt?.kind === "target") return ctx.prompt ? [{ label: "Select tile", promptAction: "select" }, { label: "Cancel", promptAction: "cancel" }] : [];
  if (!ready(snap)) return [];
  const actions = [];
  const walk = walkIntent(viewPlayer(snap).grid, at);
  if (walk) actions.push({ label: "Walk here", intent: walk });
  actions.push({ label: "Look", intent: { kind: "command", command: { code: "look", args: { x: at.x, y: at.y } } } });
  actions.push({ label: "Target", intent: { kind: "target", ...at } });
  const known = viewLevel(ctx);
  if (known && sameToken3(known.token, snap.token) && known.cells.some((cell2) => cell2.x === at.x && cell2.y === at.y && cell2.remembered.objects.length > 0)) {
    actions.push({ label: "Pick up", pickup: true });
  }
  const offered = ctx.inspect?.tileActions?.(at);
  if (offered && sameToken3(offered.token, snap.token)) {
    const player = viewPlayer(snap).grid;
    const dx = at.x - player.x, dy = at.y - player.y;
    const dir = 5 + Math.sign(dx) - 3 * Math.sign(dy);
    for (const code of offered.codes) {
      const label2 = TILE_ACTION_LABELS[code];
      if (!label2 || actions.some((action) => action.label === label2)) continue;
      if (code === "pickup") actions.push({ label: label2, pickup: true });
      else actions.push({ label: label2, intent: { kind: "command", command: DIRECTED_CODES.has(code) ? { code, dir } : { code } } });
    }
  }
  return actions;
}
function clickTile(ctx, at, modifiers = {}) {
  if (!playerIsDriving(ctx)) return false;
  const snap = viewInput(ctx);
  if (snap?.prompt?.kind === "target") return !!ctx.prompt?.reply(snap.prompt.promptId, { action: "move", ...at }).accepted;
  if (!ready(snap) || !snap || !ctx.intent) return false;
  const player = viewPlayer(snap).grid;
  const intent = clickIntent(player, at, modifiers);
  if (!intent) return false;
  const result = ctx.intent.submit(snap.token, intent);
  if (result.accepted) return true;
  if (intent.kind !== "travel" || !intent.modifiers || result.reason !== PRE_MODIFIER_REFUSAL) return false;
  const plain = walkIntent(player, at);
  return !!plain && ctx.intent.submit(snap.token, plain).accepted;
}
function runMenuAction(ctx, at, label2) {
  if (!playerIsDriving(ctx)) return false;
  const snap = viewInput(ctx);
  if (!snap) return false;
  const action = tileMenuActions(ctx, snap, at).find((item) => item.label === label2);
  if (!action) return false;
  if (action.promptAction) return !!ctx.prompt?.reply(snap.prompt.promptId, { action: action.promptAction }).accepted;
  if (!ctx.intent) return false;
  if (action.pickup) {
    const grid = viewPlayer(snap).grid;
    if (grid.x === at.x && grid.y === at.y) return ctx.intent.submit(snap.token, { kind: "command", command: { code: "pickup" } }).accepted;
    const travel = { kind: "travel", ...at };
    return ctx.intent.submit(snap.token, travel).accepted;
  }
  return !!action.intent && ctx.intent.submit(snap.token, action.intent).accepted;
}
function finishPickup(ctx, at, previous) {
  if (!playerIsDriving(ctx)) return false;
  const next = viewInput(ctx);
  if (!ready(next) || !next || sameToken3(previous.token, next.token) || !ctx.intent) return false;
  const grid = viewPlayer(next).grid;
  if (grid.x !== at.x || grid.y !== at.y) return false;
  const level = viewLevel(ctx);
  if (!level || !sameToken3(level.token, next.token) || !level.cells.some((cell2) => cell2.x === at.x && cell2.y === at.y && cell2.remembered.objects.length > 0)) return false;
  return ctx.intent.submit(next.token, { kind: "command", command: { code: "pickup" } }).accepted;
}
function aimingPath(ctx, snap, hovered) {
  if (snap?.prompt?.kind !== "target" && snap?.prompt?.kind !== "direction") return [];
  if (snap.prompt.kind === "target") return snap.prompt.path;
  const cursor = hovered;
  const path = cursor ? ctx.inspect?.projectionPath?.(cursor) : null;
  return path && sameToken3(path.token, snap.token) ? path.grids : [];
}
function walkingPath(ctx, snap, hovered) {
  if (!ready(snap) || !snap || !hovered) return [];
  const path = ctx.inspect?.travelPath?.(hovered);
  return path && sameToken3(path.token, snap.token) ? path.grids : [];
}
function installMapMouse(ctx) {
  const flags = ctx.flags;
  if (!flags["anybandui.clickToWalk"] && !flags["anybandui.dungeonActions"] && !flags["anybandui.aimPath"] && !flags["anybandui.walkRoutePreview"]) return () => {
  };
  if (!ctx.display || !ctx.snapshot || typeof document === "undefined" || typeof window === "undefined") {
    ctx.log?.("map mouse: display or snapshot unavailable");
    return () => {
    };
  }
  const display = ctx.display;
  let theme = themeFromPrefs(ctx.prefs?.get());
  const menu2 = document.createElement("div");
  menu2.setAttribute("role", "menu");
  menu2.setAttribute("aria-label", "Dungeon actions");
  menu2.style.cssText = `display:none;position:fixed;z-index:1002;background:${theme.surface};color:${theme.text};border:1px solid ${paintColours(theme).border};border-radius:${Math.round(theme.rounding * 0.6)}px;padding:4px;font:${PAINT_FONT_SIZE}px/${PAINT_LINE_HEIGHT}px ${PAINT_FONT}`;
  const paintMenu = () => {
    const colours2 = paintColours(theme);
    menu2.style.background = theme.surface;
    menu2.style.color = theme.text;
    menu2.style.border = `1px solid ${colours2.border}`;
    menu2.style.borderRadius = `${Math.round(theme.rounding * 0.6)}px`;
    const buttons = menu2.querySelectorAll("button");
    for (let index = 0; index < buttons.length; index += 1) {
      const button7 = buttons[index];
      if (!button7) continue;
      button7.style.background = theme.surface;
      button7.style.color = theme.text;
    }
  };
  const stopTheme2 = onThemeChange((next) => {
    theme = next;
    paintMenu();
  });
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:49";
  document.body.append(menu2, canvas);
  let menuAt = null;
  let menuToken = null;
  let menuPromptId = null;
  let pickupAt = null;
  let pickupSnap = null;
  let targetAt = null;
  let targetPromptId = null;
  let hovered = null;
  const hide = () => {
    menu2.style.display = "none";
    menu2.replaceChildren();
    menuAt = null;
  };
  const locate = (event) => {
    const snap = display.snapshot();
    const input = viewInput(ctx);
    if (snap.mode !== "play" && !(snap.mode === "modal" && (input?.prompt?.kind === "target" || input?.prompt?.kind === "direction"))) return null;
    const grid = hoverGrid(snap, { x: event.clientX, y: event.clientY });
    return grid && grid.x < snap.level.width && grid.y < snap.level.height ? grid : null;
  };
  const onClick = (event) => {
    if (event.button !== 0) return;
    if (menu2.contains(event.target)) return;
    hide();
    if (!flags["anybandui.clickToWalk"]) return;
    const at = locate(event);
    const prompt = viewInput(ctx)?.prompt;
    if (at && clickTile(ctx, at, { shift: event.shiftKey, ctrl: event.ctrlKey })) {
      if (prompt?.kind === "target") {
        targetAt = at;
        targetPromptId = prompt.promptId;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const onContext = (event) => {
    hide();
    if (!flags["anybandui.dungeonActions"]) return;
    const at = locate(event), snap = viewInput(ctx);
    if (!at || !snap || !playerIsDriving(ctx) || !(ready(snap) || snap.prompt?.kind === "target")) return;
    const actions = tileMenuActions(ctx, snap, at);
    if (!actions.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    menuAt = at;
    menuToken = snap.token;
    menuPromptId = snap.prompt?.promptId ?? null;
    for (const action of actions) {
      const button7 = document.createElement("button");
      button7.type = "button";
      button7.setAttribute("role", "menuitem");
      button7.textContent = action.label;
      button7.style.cssText = `display:block;width:100%;text-align:left;background:${theme.surface};color:${theme.text};border:0;padding:3px 9px;cursor:pointer;font:inherit`;
      button7.addEventListener("pointerenter", () => {
        button7.style.background = paintColours(theme).hover;
      });
      button7.addEventListener("pointerleave", () => {
        button7.style.background = theme.surface;
      });
      button7.addEventListener("click", () => {
        const current = viewInput(ctx);
        if (!menuAt || !current || !menuToken || !sameToken3(menuToken, current.token) || menuPromptId !== (current.prompt?.promptId ?? null)) {
          hide();
          return;
        }
        const selected = menuAt, currentPlayer = viewPlayer(current);
        if (action.promptAction === "select" && current.prompt?.kind === "target") {
          if (ctx.prompt?.reply(current.prompt.promptId, { action: "move", ...selected }).accepted) {
            targetAt = selected;
            targetPromptId = current.prompt.promptId;
          }
        } else if (action.pickup && currentPlayer && (currentPlayer.grid.x !== selected.x || currentPlayer.grid.y !== selected.y)) {
          if (runMenuAction(ctx, selected, action.label)) {
            pickupAt = selected;
            pickupSnap = current;
          }
        } else runMenuAction(ctx, selected, action.label);
        hide();
      });
      menu2.appendChild(button7);
    }
    menu2.style.display = "block";
    menu2.style.left = `${Math.min(event.clientX, window.innerWidth - menu2.offsetWidth)}px`;
    menu2.style.top = `${Math.min(event.clientY, window.innerHeight - menu2.offsetHeight)}px`;
    menu2.firstElementChild?.focus();
  };
  const onKey = (event) => {
    if (event.key === "Escape") hide();
  };
  const onMove = (event) => {
    hovered = locate(event);
  };
  const render = () => {
    if (pickupAt && pickupSnap) {
      const next = viewInput(ctx);
      if (next && !sameToken3(next.token, pickupSnap.token)) {
        finishPickup(ctx, pickupAt, pickupSnap);
        pickupAt = null;
        pickupSnap = null;
      }
    }
    if (targetAt && targetPromptId !== null) {
      const next = viewInput(ctx)?.prompt;
      if (!next || next.kind !== "target") {
        targetAt = null;
        targetPromptId = null;
      } else if (next.promptId !== targetPromptId && next.cursor?.x === targetAt.x && next.cursor.y === targetAt.y) {
        if (playerIsDriving(ctx)) ctx.prompt?.reply(next.promptId, { action: "select" });
        targetAt = null;
        targetPromptId = null;
      }
    }
    if (!flags["anybandui.aimPath"] && !flags["anybandui.walkRoutePreview"]) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.ceil(window.innerWidth * ratio), height = Math.ceil(window.innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }
    const paint = canvas.getContext("2d");
    if (!paint) return;
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.clearRect(0, 0, width, height);
    const snap = viewInput(ctx);
    const path = snap?.prompt ? flags["anybandui.aimPath"] ? aimingPath(ctx, snap, hovered) : [] : flags["anybandui.walkRoutePreview"] ? walkingPath(ctx, snap, hovered) : [];
    const view = display.snapshot();
    const rect = view.mode === "play" || view.mode === "modal" && (snap?.prompt?.kind === "target" || snap?.prompt?.kind === "direction") ? mapProjection(view) : null;
    if (!rect || !path.length) return;
    paint.scale(ratio, ratio);
    paint.beginPath();
    paint.rect(rect.x, rect.y, rect.width, rect.height);
    paint.clip();
    paint.strokeStyle = "#f0cd64";
    paint.lineWidth = 2;
    paint.beginPath();
    path.forEach((grid, index) => {
      const x = rect.x + (grid.x - view.viewport.origin.x + 0.5) * rect.width / view.viewport.size.width;
      const y = rect.y + (grid.y - view.viewport.origin.y + 0.5) * rect.height / view.viewport.size.height;
      if (index === 0) paint.moveTo(x, y);
      else paint.lineTo(x, y);
    });
    paint.stroke();
  };
  window.addEventListener("click", onClick, true);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("contextmenu", onContext, true);
  window.addEventListener("keydown", onKey);
  const timer2 = window.setInterval(render, 100);
  return () => {
    stopTheme2();
    window.clearInterval(timer2);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("contextmenu", onContext, true);
    window.removeEventListener("keydown", onKey);
    hide();
    menu2.remove();
    canvas.remove();
  };
}

// src/spell-actions.ts
function actionReady(ctx, snap) {
  const next = viewInput(ctx);
  return !!next && sameToken2(next.token, snap.token) && next.phase === "play" && !next.prompt && !next.messagePending && playerIsDriving(ctx);
}
function castSpell(ctx, snap, spell) {
  if (!spell.canCast || !actionReady(ctx, snap)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "cast", args: { spell: spell.index } } }).accepted ?? false;
}
function studySpell(ctx, snap, book, spell) {
  if (!book.spells.some((entry2) => entry2.canStudy) || book.chooseSpells && !spell.canStudy || !actionReady(ctx, snap)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "study", args: book.chooseSpells ? { handle: book.handle, spell: spell.index } : { handle: book.handle } } }).accepted ?? false;
}
function answerSpell(ctx, snap, index) {
  const next = viewInput(ctx);
  if (snap.prompt?.kind !== "spell" || !next || !sameToken2(next.token, snap.token) || next.prompt?.promptId !== snap.prompt.promptId || !playerIsDriving(ctx)) return false;
  if (!snap.prompt.choices.some((choice) => choice.index === index)) return false;
  return ctx.prompt?.reply(snap.prompt.promptId, index).accepted ?? false;
}
function cancelSpell(ctx, snap) {
  const next = viewInput(ctx);
  if (snap.prompt?.kind !== "spell" || !next || !sameToken2(next.token, snap.token) || next.prompt?.promptId !== snap.prompt.promptId || !playerIsDriving(ctx) || !ctx.prompt?.reply) return false;
  return ctx.prompt.reply(snap.prompt.promptId, { action: "cancel" }).accepted ?? false;
}
var validRest = (count) => [-3, -2, -1].includes(count) || Number.isInteger(count) && count >= 1 && count <= 9999;
function rest(ctx, snap, count) {
  if (!actionReady(ctx, snap) || !validRest(count)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "rest", args: { count } } }).accepted ?? false;
}
function restPrompt(snap) {
  const prompt = snap?.prompt;
  return prompt?.kind === "text" && prompt.tag === "rest" ? prompt : null;
}
function restAnswer(count) {
  if (!validRest(count)) return null;
  return count === -2 ? "&" : count === -1 ? "*" : count === -3 ? "!" : String(count);
}
function answerRest(ctx, snap, count) {
  const prompt = restPrompt(snap), next = viewInput(ctx);
  if (!prompt || !next || restPrompt(next)?.promptId !== prompt.promptId || !playerIsDriving(ctx) || !ctx.prompt?.reply) return false;
  if (count === null) {
    const cancel = ctx.prompt.reply(prompt.promptId, { action: "cancel" });
    if (cancel.accepted) return true;
  }
  const answer = count === null ? "" : restAnswer(count);
  if (answer === null || answer.length > prompt.maxLength) return false;
  return ctx.prompt.reply(prompt.promptId, answer).accepted ?? false;
}
function stopResting(ctx) {
  const next = viewInput(ctx);
  if (!next?.resting?.active || !playerIsDriving(ctx)) return false;
  return ctx.intent?.submit(next.token, { kind: "stop-resting" }).accepted ?? false;
}

// src/quickbar.ts
var COMMAND_LABELS = Object.freeze({
  hold: "Stay still",
  pickup: "Pick up",
  descend: "Go down stairs",
  ascend: "Go up stairs",
  explore: "Explore",
  "navigate-down": "Walk to down stairs",
  "navigate-up": "Walk to up stairs",
  "fire-at-nearest": "Fire at nearest",
  look: "Look around"
});
var TILE_COMMANDS = /* @__PURE__ */ new Set(["pickup", "ascend", "descend"]);
var verbLabel = (verb) => verb.charAt(0).toUpperCase() + verb.slice(1);
function catalogueCommands(ctx) {
  let catalogue = null;
  try {
    catalogue = ctx.intent?.catalogue?.() ?? null;
  } catch {
    catalogue = null;
  }
  return (catalogue?.commands ?? []).filter((entry2) => entry2.phase === "play" && entry2.args.startsWith("args?") && entry2.code !== "rest").flatMap((entry2) => {
    const verb = typeof entry2.verb === "string" && entry2.verb.length > 0 ? verbLabel(entry2.verb) : null;
    const table = Object.hasOwn(COMMAND_LABELS, entry2.code) ? COMMAND_LABELS[entry2.code] : null;
    const name = verb ?? table;
    return name ? [{ type: "command", code: entry2.code, name }] : [];
  });
}
var slotIndex = (code, shift, ctrl) => {
  if (!/^Digit[0-9]$/.test(code)) return -1;
  return (ctrl ? 20 : shift ? 10 : 0) + (Number(code.slice(-1)) + 9) % 10;
};
function quickbarOwnsKey(enabled, snap, code, shift, ctrl, menuOpen) {
  return enabled && !menuOpen && !!snap && snap.phase === "play" && !snap.prompt && !snap.messagePending && slotIndex(code, shift, ctrl) >= 0;
}
function readSlots(raw, character) {
  const root = raw && typeof raw === "object" ? raw : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] : {};
  const slots = profiles[character];
  return Array.from({ length: 30 }, (_, i) => {
    const entry2 = Array.isArray(slots) ? slots[i] : null;
    if (!entry2 || typeof entry2 !== "object") return null;
    const b = entry2;
    if (b.type === "spell" && typeof b.key === "string" && Number.isInteger(b.index) && typeof b.name === "string") return b;
    if (b.type === "item" && typeof b.key === "string" && ["quaff", "read", "aim-wand", "activate"].includes(String(b.code)) && typeof b.name === "string") return b;
    if (b.type === "command" && typeof b.name === "string" && b.name.length > 0 && typeof b.code === "string") return b;
    return null;
  });
}
function writeSlots(ctx, character, slots) {
  if (!ctx.prefs?.set) return;
  const raw = ctx.prefs.get();
  const root = raw && typeof raw === "object" ? raw : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] : {};
  ctx.prefs.set({ ...root, quickbar: { ...profiles, [character]: slots } });
}
function migrateSlots(raw, from, to) {
  const root = raw && typeof raw === "object" ? raw : {};
  const profiles = root["quickbar"] && typeof root["quickbar"] === "object" ? root["quickbar"] : {};
  if (from === to || !Array.isArray(profiles[from]) || Object.hasOwn(profiles, to)) return null;
  const { [from]: moved, ...rest2 } = profiles;
  return { ...root, quickbar: { ...rest2, [to]: moved } };
}
function itemBindings(snap, ctx) {
  const codes = ["quaff", "read", "aim-wand", "activate"];
  return (viewWorld(snap).inventory ?? []).flatMap((item) => codes.filter((code) => {
    const result = ctx.inspect?.itemTester?.(code);
    return result?.token.epoch === snap.token.epoch && result.token.revision === snap.token.revision && result.items.some((entry2) => "handle" in entry2 && entry2.handle === item.handle);
  }).map((code) => ({ type: "item", key: itemKey(item), code, name: item.label })));
}
function resolve(snap, binding, spells, ctx) {
  if (!binding) return { label: "Empty", detail: "Right-click to assign.", usable: false };
  if (binding.type === "command" && binding.code === "rest") return { label: "Rest", detail: "Rest until fully recovered.", usable: true, command: { code: "rest", args: { count: -2 } } };
  if (binding.type === "command") {
    const listed = catalogueCommands(ctx).find((entry2) => entry2.code === binding.code);
    const name = listed?.name ?? COMMAND_LABELS[binding.code] ?? binding.name;
    if (!listed) return { label: name, detail: "This command is not available in this game.", usable: false };
    let usable2 = true;
    const grid = viewPlayer(snap)?.grid;
    if (TILE_COMMANDS.has(binding.code) && grid && ctx.inspect?.tileActions) {
      const actions = ctx.inspect.tileActions(grid);
      if (actions && actions.token.epoch === snap.token.epoch && actions.token.revision === snap.token.revision) usable2 = actions.codes.includes(binding.code);
    }
    return { label: name, detail: usable2 ? `${name}.` : `${name}. Not possible on this square.`, usable: usable2, ...usable2 ? { command: { code: binding.code } } : {} };
  }
  if (binding.type === "spell") {
    const book = spells?.books.find((b) => b.key === binding.key);
    const spell = book?.spells.find((s) => s.index === binding.index && s.name === binding.name);
    if (!spell) return { label: binding.name, detail: "Spellbook no longer carried.", usable: false };
    return {
      label: spell.name,
      amount: `${spell.mana} SP`,
      detail: `Mana ${spell.mana}, fail ${spell.fail}%. ${spell.state}. ${spell.description}`,
      usable: spell.canCast,
      ...spell.canCast ? { command: { code: "cast", args: { spell: spell.index } } } : {}
    };
  }
  const item = viewWorld(snap).inventory?.find((entry2) => itemKey(entry2) === binding.key);
  if (!item) return { label: binding.name, detail: "Item no longer carried.", usable: false };
  const tester = ctx.inspect?.itemTester?.(binding.code);
  const usable = !!tester && tester.token.epoch === snap.token.epoch && tester.token.revision === snap.token.revision && tester.items.some((entry2) => "handle" in entry2 && entry2.handle === item.handle);
  const inspection = ctx.inspect?.inspectItem?.(item.handle);
  const description = inspection?.token.epoch === snap.token.epoch && inspection.token.revision === snap.token.revision ? ` ${inspection.text.slice(0, 600)}` : "";
  const charge = binding.code === "aim-wand" ? ` Charges ${item.pval ?? 0}.` : binding.code === "activate" ? ` Recharge ${item.timeout ?? 0}.` : "";
  return { label: item.label, amount: binding.code === "aim-wand" ? `${item.pval ?? 0} charges` : binding.code === "activate" ? item.timeout ? "Recharging" : "Ready" : `${item.number} carried`, detail: `${item.number} carried.${charge}${description}`, usable, ...usable ? { command: { code: binding.code, args: { handle: item.handle } } } : {} };
}
function activate(ctx, snap, binding) {
  if (!actionReady(ctx, snap)) return false;
  const resolved = resolve(snap, binding, adaptSpells(snap, ctx.inspect), ctx);
  return !!resolved.usable && !!resolved.command && !!ctx.intent?.submit(snap.token, { kind: "command", command: resolved.command }).accepted;
}

// src/phase4.ts
var CSS5 = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}.phase4{position:fixed;left:12px;bottom:12px;width:min(680px,calc(100vw - 24px));max-height:55vh;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,select,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:4px}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--anyband-accent)}button:disabled{opacity:.45}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:3px;border-bottom:1px solid var(--anyband-accent)}.slots{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px}.slot{min-height:42px;overflow:hidden;word-break:break-word}.muted{opacity:.55}.row{width:100%;text-align:left;border:0;background:transparent}.menu{margin:6px 0;padding:6px;border:1px solid var(--anyband-accent)}.menu button{margin:2px}.hint{font-size:12px}`;
function el7(parent, tag, content) {
  const node2 = parent.ownerDocument.createElement(tag);
  if (content !== void 0) node2.textContent = content;
  parent.append(node2);
  return node2;
}
function button3(parent, label2, callback) {
  const node2 = el7(parent, "button", label2);
  node2.type = "button";
  node2.addEventListener("click", callback);
  return node2;
}
var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
function drawIcon(parent, style) {
  const svg = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true");
  const path = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", style === "potion" ? "M9 2h6v3h-1v5l5 8c1 2 0 4-2 4H7c-2 0-3-2-2-4l5-8V5H9z" : style === "scroll" ? "M5 3h13v14a4 4 0 0 1-4 4H6a3 3 0 0 1-3-3c0-2 1-3 3-3h8M6 15V3" : "M4 20 19 4l2 2L6 22z");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  svg.append(path);
  parent.prepend(svg);
}
function lineageFor(ctx) {
  try {
    return ctx.character?.key?.() || null;
  } catch {
    return null;
  }
}
function fingerprintFor(ctx) {
  const player = birthFacts(ctx);
  if (!player || typeof player.raceName !== "string" || typeof player.clsName !== "string" || typeof player.auBirth !== "number" || typeof player.htBirth !== "number" || typeof player.wtBirth !== "number") return null;
  return characterKey({ raceName: player.raceName, clsName: player.clsName, auBirth: player.auBirth, htBirth: player.htBirth, wtBirth: player.wtBirth });
}
function characterFor(ctx) {
  return lineageFor(ctx) ?? fingerprintFor(ctx);
}
function adoptLineage(ctx, snap) {
  const lineage = lineageFor(ctx), fingerprint = fingerprintFor(ctx), player = viewPlayer(snap);
  if (!lineage || !fingerprint || !ctx.prefs?.set || !player?.race || !player.cls || !fingerprint.startsWith(`${player.race}|${player.cls}|`)) return false;
  const moved = migrateSlots(ctx.prefs.get(), fingerprint, lineage);
  if (moved) ctx.prefs.set(moved);
  return !!moved;
}
var assignLabel = (binding) => binding.type === "command" ? binding.name : binding.type === "spell" ? `Cast: ${binding.name}` : `${binding.code === "quaff" ? "Drink" : binding.code === "read" ? "Read" : binding.code === "aim-wand" ? "Aim" : "Activate"}: ${binding.name}`;
function restingText(resting) {
  if (typeof resting.mode === "string") {
    if (resting.mode === "turns") {
      const left = resting.turnsRemaining ?? 0;
      const total = resting.turnsRequested ?? left;
      if (left <= 0) return "Resting.";
      return `Resting: ${left} of ${total} turns left.`;
    }
    if (resting.mode === "complete") return "Resting until fully recovered.";
    if (resting.mode === "all-points") return "Resting until hit points and mana are full.";
    if (resting.mode === "some-points") return "Resting until hit points or mana are full.";
  }
  return "Resting.";
}
function installPhase4(ctx) {
  const flags = ctx.flags ?? {};
  const spellOn = flags["anybandui.spells"] === true;
  const quickOn = flags["anybandui.quickbar"] === true;
  const restOn = flags["anybandui.restDialog"] === true;
  const blastCleanup = flags["anybandui.blastPreview"] ? installBlastPreview(ctx) : () => {
  };
  if (!spellOn && !quickOn && !restOn) return blastCleanup;
  if (!ctx.snapshot) {
    ctx.log("phase 4: snapshot seam unavailable");
    return blastCleanup;
  }
  let repaint = () => {
  };
  const surfaces = openSurfaces(ctx, [
    ...spellOn ? [{ key: "spells", label: "Spells", tab: "Spells", minSize: { width: 280, height: 220 }, placement: { kind: "dock", target: "main", edge: "right" } }] : [],
    ...quickOn ? [{ key: "quickbar", label: "Quickbar", tab: "Bar", minSize: { width: 320, height: 60 }, placement: { kind: "dock", target: "main", edge: "bottom" }, fitHeight: 140 }] : [],
    ...restOn ? [{ key: "rest", label: "Rest", tab: "Rest", minSize: { width: 220, height: 120 }, placement: { kind: "dock", target: "main", edge: "right" } }] : []
  ], { id: "phase4", label: "Spells and quickbar", className: "phase4" }, CSS5, () => repaint());
  if (!surfaces) {
    ctx.log("phase 4: panel seam unavailable");
    return blastCleanup;
  }
  let bookKey = "", spellIndex = -1, menu2 = -1, customize = -1, restOpen = false, restMode = -2, turns = 10, promptChoice = -1, error = "", signature = "", closed = false;
  let appearance = { style: "automatic", text: "", color: "#7abaf4" };
  let adopted = "";
  const identify = (snap) => {
    const pair = `${lineageFor(ctx) ?? ""}
${fingerprintFor(ctx) ?? ""}
${viewPlayer(snap)?.race ?? ""}`;
    if (pair !== adopted) {
      adopted = pair;
      adoptLineage(ctx, snap);
    }
    return characterFor(ctx);
  };
  let character = identify(viewInput(ctx));
  let slots = character ? readSlots(ctx.prefs?.get(), character) : Array(30).fill(null);
  const save = () => {
    if (character) writeSlots(ctx, character, slots);
  };
  const fail = (message) => {
    if (playerIsDriving(ctx)) error = message;
  };
  const assign = (index, binding) => {
    const next = [...slots];
    next[index] = binding;
    slots = next;
    save();
    menu2 = -1;
    paint(true);
  };
  const paint = (force = false) => {
    if (closed) return;
    const mounts = surfaces.mounts();
    const spellMount = spellOn ? mounts.get("spells") : void 0, quickMount = quickOn ? mounts.get("quickbar") : void 0, restMount = restOn ? mounts.get("rest") : void 0;
    if (!mounts.size) return;
    const snap = viewInput(ctx);
    const key = identify(snap);
    if (key !== character) {
      character = key;
      slots = key ? readSlots(ctx.prefs?.get(), key) : Array(30).fill(null);
    }
    const model = snap ? adaptSpells(snap, ctx.inspect) : null;
    const sig = JSON.stringify([[...mounts.keys()], snap, slots, bookKey, spellIndex, menu2, customize, appearance, restOpen, restMode, turns, promptChoice, error]);
    if (!force && sig === signature) return;
    signature = sig;
    for (const target of mounts.values()) target.replaceChildren();
    if (!snap) {
      for (const target of mounts.values()) el7(target, "p", "Game state unavailable.");
      return;
    }
    if (spellOn && spellMount) {
      el7(spellMount, "h2", "Spells");
      if (model?.learnable) el7(spellMount, "p", model.learnable === 1 ? "You can learn 1 new spell." : `You can learn ${model.learnable} new spells.`);
      if (!model) el7(spellMount, "p", "Spell list unavailable.");
      else if (!model.books.length) el7(spellMount, "p", "No readable spellbooks carried.");
      else {
        const picker = el7(spellMount, "select");
        picker.setAttribute("aria-label", "Spellbook");
        for (const book2 of model.books) {
          const opt = el7(picker, "option", book2.name);
          opt.value = book2.key;
        }
        if (!model.books.some((book2) => book2.key === bookKey)) bookKey = model.books[0].key;
        picker.value = bookKey;
        picker.addEventListener("change", () => {
          bookKey = picker.value;
          spellIndex = -1;
          paint(true);
        });
        const book = model.books.find((entry2) => entry2.key === bookKey);
        const table = el7(spellMount, "table");
        const head = el7(table, "tr");
        for (const label2 of ["Spell", "Mana", "Fail", "State"]) el7(head, "th", label2);
        for (const spell of book.spells) {
          const row = el7(table, "tr");
          if (!spell.canCast && !spell.canStudy) row.className = "muted";
          const cell2 = el7(row, "td");
          const pick = button3(cell2, spell.name, () => {
            spellIndex = spell.index;
            paint(true);
          });
          pick.className = "row";
          pick.title = spell.name;
          pick.draggable = quickOn;
          pick.addEventListener("dblclick", () => {
            if (castSpell(ctx, snap, spell)) error = "";
            paint(true);
          });
          pick.addEventListener("dragstart", (event) => {
            if (quickOn) event.dataTransfer?.setData("application/x-anybandui-binding", JSON.stringify({ type: "spell", key: book.key, index: spell.index, name: spell.name }));
          });
          pick.addEventListener("contextmenu", (event) => {
            if (!quickOn) return;
            event.preventDefault();
            menu2 = -2;
            spellIndex = spell.index;
            paint(true);
          });
          el7(row, "td", String(spell.mana));
          el7(row, "td", `${spell.fail}%`);
          el7(row, "td", spell.state);
        }
        const selected = book.spells.find((entry2) => entry2.index === spellIndex) ?? book.spells[0];
        if (selected) {
          const cast = button3(spellMount, "Cast", () => {
            if (!castSpell(ctx, snap, selected)) fail("Cast unavailable.");
            paint(true);
          });
          cast.disabled = !selected.canCast || !ctx.intent?.submit;
          const study = button3(spellMount, book.chooseSpells ? "Study" : "Study book", () => {
            if (!studySpell(ctx, snap, book, selected)) fail("Study unavailable.");
            paint(true);
          });
          study.disabled = !(book.chooseSpells ? selected.canStudy : book.spells.some((entry2) => entry2.canStudy)) || !ctx.intent?.submit;
          if (!book.chooseSpells) study.title = "Your class learns a random eligible spell from this book.";
          el7(spellMount, "h3", selected.name);
          el7(spellMount, "p", `Level ${selected.level}. Mana ${selected.mana}. Failure ${selected.fail}%. ${selected.state}.`);
          if (selected.canCast && (viewPlayer(snap)?.sp ?? 0) < selected.mana) el7(spellMount, "p", "Not enough mana. Confirmation may be required.");
          el7(spellMount, "p", selected.description);
          if (selected.infoLine) el7(spellMount, "p", `Info: ${selected.infoLine}`);
          if (quickOn && menu2 === -2) {
            const box = el7(spellMount, "div");
            box.className = "menu";
            el7(box, "strong", "Assign spell to quickbar");
            for (let i = 0; i < 30; i++) button3(box, `${i < 10 ? "" : i < 20 ? "Shift+" : "Ctrl+"}${keys[i % 10]}`, () => assign(i, { type: "spell", key: book.key, index: selected.index, name: selected.name }));
          }
        }
      }
      if (snap.prompt?.kind === "spell" && ctx.prompt?.reply && playerIsDriving(ctx)) {
        const prompt = snap.prompt;
        const box = el7(spellMount, "div");
        box.className = "menu";
        el7(box, "h3", "Choose spell");
        el7(box, "p", prompt.label);
        for (const choice of prompt.choices) button3(box, choice.name, () => {
          promptChoice = choice.index;
          paint(true);
        });
        button3(box, "Choose", () => {
          if (!answerSpell(ctx, snap, promptChoice)) fail("Choice unavailable.");
          paint(true);
        });
        button3(box, "Cancel", () => {
          if (cancelSpell(ctx, snap)) promptChoice = -1;
          else fail("Press Escape to cancel.");
          paint(true);
        });
      }
    }
    if (quickOn && quickMount && snap.phase === "play") {
      el7(quickMount, "h2", "Quickbar");
      if (!character) el7(quickMount, "p", "Assignments last for this game session.");
      for (let row = 0; row < 3; row++) {
        el7(quickMount, "h3", row === 0 ? "Number keys" : row === 1 ? "Shift and number" : "Ctrl and number");
        const line = el7(quickMount, "div");
        line.className = "slots";
        for (let col = 0; col < 10; col++) {
          const index = row * 10 + col;
          const binding = slots[index] ?? null;
          const result = resolve(snap, binding, model, ctx);
          const custom = binding?.appearance;
          const shown = custom?.style === "text" && custom.text ? custom.text : result.label;
          const slot = button3(line, `${keys[col]} ${shown}${result.amount ? ` - ${result.amount}` : ""}`, () => {
            if (!activate(ctx, snap, binding)) fail(result.detail);
            paint(true);
          });
          slot.className = "slot" + (result.usable ? "" : " muted");
          slot.title = `Quickbar ${row === 0 ? "" : row === 1 ? "Shift+" : "Ctrl+"}${keys[col]}. ${result.detail}`;
          if (custom?.color && /^#[0-9a-f]{6}$/i.test(custom.color)) slot.style.borderColor = custom.color;
          if (custom && ["potion", "scroll", "wand"].includes(custom.style)) drawIcon(slot, custom.style);
          slot.setAttribute("aria-label", slot.title);
          slot.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            menu2 = index;
            paint(true);
          });
          slot.addEventListener("dragstart", (event) => {
            if (binding) event.dataTransfer?.setData("application/x-anybandui-slot", JSON.stringify({ index, binding }));
          });
          slot.draggable = !!binding;
          slot.addEventListener("dragover", (event) => {
            event.preventDefault();
          });
          slot.addEventListener("drop", (event) => {
            event.preventDefault();
            const origin = event.dataTransfer?.getData("application/x-anybandui-slot");
            const external = event.dataTransfer?.getData("application/x-anybandui-binding");
            if (origin) {
              try {
                const parsed = JSON.parse(origin);
                if (parsed.index >= 0 && parsed.index < 30 && JSON.stringify(slots[parsed.index]) === JSON.stringify(parsed.binding)) {
                  const next = [...slots];
                  [next[index], next[parsed.index]] = [next[parsed.index] ?? null, next[index] ?? null];
                  slots = next;
                  save();
                  paint(true);
                }
              } catch {
              }
            } else if (external) {
              try {
                const parsed = JSON.parse(external);
                if (parsed.type === "spell" && model?.books.some((book) => book.key === parsed.key && book.spells.some((spell) => spell.index === parsed.index))) assign(index, parsed);
              } catch {
              }
            }
          });
        }
      }
      if (menu2 >= 0) {
        const box = el7(quickMount, "div");
        box.className = "menu";
        el7(box, "strong", `Assign ${keys[menu2 % 10]}`);
        if (slots[menu2]) button3(box, "Customize", () => {
          customize = menu2;
          appearance = slots[menu2]?.appearance ?? { style: "automatic", text: "", color: "#7abaf4" };
          menu2 = -1;
          paint(true);
        });
        button3(box, "Rest until recovered", () => assign(menu2, { type: "command", code: "rest", name: "Rest" }));
        for (const binding of catalogueCommands(ctx)) button3(box, assignLabel(binding), () => assign(menu2, binding));
        for (const binding of itemBindings(snap, ctx)) {
          const choice = button3(box, assignLabel(binding), () => assign(menu2, binding));
          choice.draggable = true;
          choice.addEventListener("dragstart", (event) => event.dataTransfer?.setData("application/x-anybandui-binding", JSON.stringify(binding)));
        }
        for (const book of model?.books ?? []) for (const spell of book.spells) button3(box, `Cast: ${spell.name}`, () => assign(menu2, { type: "spell", key: book.key, index: spell.index, name: spell.name }));
        button3(box, "Clear", () => assign(menu2, null));
        button3(box, "Close", () => {
          menu2 = -1;
          paint(true);
        });
      }
      if (customize >= 0 && slots[customize]) {
        const box = el7(quickMount, "div");
        box.className = "menu";
        el7(box, "h3", "Customize slot");
        const style = el7(box, "select");
        style.setAttribute("aria-label", "Appearance");
        for (const [value2, label2] of [["automatic", "Automatic"], ["text", "Custom text"], ["potion", "Potion icon"], ["scroll", "Scroll icon"], ["wand", "Wand icon"]]) {
          const opt = el7(style, "option", label2);
          opt.value = value2;
        }
        style.value = appearance.style;
        style.addEventListener("change", () => {
          appearance = { ...appearance, style: style.value };
          paint(true);
        });
        const input = el7(box, "input");
        input.value = appearance.text;
        input.placeholder = "Text wraps to fit the slot.";
        input.setAttribute("aria-label", "Slot text");
        input.addEventListener("input", () => {
          appearance = { ...appearance, text: input.value.slice(0, 60) };
        });
        const color = el7(box, "input");
        color.type = "color";
        color.value = appearance.color;
        color.setAttribute("aria-label", "Slot color");
        color.addEventListener("input", () => {
          appearance = { ...appearance, color: color.value };
        });
        button3(box, "Reset appearance", () => {
          appearance = { style: "automatic", text: "", color: "#7abaf4" };
          paint(true);
        });
        button3(box, "Save and close", () => {
          const binding = slots[customize];
          if (binding) assign(customize, { ...binding, appearance });
          customize = -1;
          paint(true);
        });
        button3(box, "Cancel", () => {
          customize = -1;
          paint(true);
        });
      }
    }
    const asking = restPrompt(snap) && ctx.prompt?.reply && playerIsDriving(ctx) ? restPrompt(snap) : null;
    const resting = snap.resting?.active ? snap.resting : null;
    if (restOn && restMount && (snap.phase === "play" || asking || resting)) {
      if (resting) {
        const status = el7(restMount, "p", restingText(resting));
        status.setAttribute("role", "status");
        const stop = button3(restMount, "Stop resting", () => {
          if (!stopResting(ctx)) fail("Stop unavailable.");
          paint(true);
        });
        stop.disabled = !ctx.intent?.submit || !playerIsDriving(ctx);
      } else if (!asking) button3(restMount, "Rest", () => {
        restOpen = !restOpen;
        paint(true);
      });
      if (restOpen && !resting || asking) {
        const box = el7(restMount, "div");
        box.className = "menu";
        el7(box, "h3", "Rest");
        for (const [count, label2, description] of [[-2, "Fully recovered", "Recover HP and mana and wait out harmful conditions."], [-1, "HP and mana", "Stop when both are full."], [-3, "HP or mana", "Stop as soon as either is full."], [1, "Number of turns", "Rest for a set number of turns."]]) {
          const choice = button3(box, label2, () => {
            restMode = count;
            paint(true);
          });
          choice.setAttribute("aria-pressed", String(restMode === count));
          el7(box, "p", description);
        }
        if (restMode === 1) {
          const input = el7(box, "input");
          input.type = "number";
          input.min = "1";
          input.max = "9999";
          input.value = String(turns);
          input.setAttribute("aria-label", "Turns");
          input.addEventListener("input", () => {
            turns = Number(input.value);
          });
        }
        if (restMode === 1 && (!Number.isInteger(turns) || turns < 1 || turns > 9999)) el7(box, "p", "Enter between 1 and 9999 turns.");
        el7(box, "p", "Danger interrupts rest normally.");
        const confirm2 = button3(box, "Rest", () => {
          const count = restMode === 1 ? turns : restMode;
          if (!(asking ? answerRest(ctx, snap, count) : rest(ctx, snap, count))) fail("Rest unavailable.");
          else restOpen = false;
          paint(true);
        });
        confirm2.disabled = restMode === 1 && (!Number.isInteger(turns) || turns < 1 || turns > 9999);
        button3(box, "Cancel", () => {
          if (asking) answerRest(ctx, snap, null);
          restOpen = false;
          paint(true);
        });
      }
    }
    const first = spellMount ?? quickMount ?? restMount;
    if (error && first) {
      const p = el7(first, "p", error);
      p.setAttribute("role", "status");
    }
    if (quickMount) surfaces.fit("quickbar", quickMount.getBoundingClientRect().height + 16);
  };
  const keydown = (event) => {
    if (!quickOn || menu2 >= 0 || customize >= 0 || restOpen || event.repeat || event.altKey || event.metaKey || event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLElement && event.target.isContentEditable) return;
    const index = slotIndex(event.code, event.shiftKey, event.ctrlKey);
    const snap = viewInput(ctx);
    if (!quickbarOwnsKey(quickOn, snap ?? null, event.code, event.shiftKey, event.ctrlKey, menu2 >= 0 || restOpen) || !snap || !actionReady(ctx, snap)) return;
    const binding = slots[index] ?? null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (resolve(snap, binding, adaptSpells(snap, ctx.inspect), ctx).usable) activate(ctx, snap, binding);
    paint(true);
  };
  paint(true);
  window.addEventListener("keydown", keydown, true);
  const timer2 = window.setInterval(() => paint(), 200);
  repaint = () => paint(true);
  return () => {
    closed = true;
    window.clearInterval(timer2);
    window.removeEventListener("keydown", keydown, true);
    surfaces.close();
    blastCleanup();
  };
}

// src/view-model/stores.ts
var same2 = (a, b) => a.epoch === b.epoch && a.revision === b.revision;
var STORE_NAMES = {
  STORE_GENERAL: "General Store",
  STORE_ARMOR: "Armoury",
  STORE_WEAPON: "Weapon Smiths",
  STORE_BOOK: "Bookseller",
  STORE_ALCHEMY: "Alchemy Shop",
  STORE_MAGIC: "Magic Shop",
  STORE_BLACK: "Black Market",
  HOME: "Home"
};
function storeName(featName) {
  const known = STORE_NAMES[featName];
  if (known) return known;
  const words = featName.replace(/^STORE_/, "").toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function bookForStock(item, books) {
  const sameTval = books.filter((book) => book.tval === item.tval);
  const text = `${item.name ?? ""} ${item.label}`.toLowerCase();
  const named = sameTval.filter((book) => book.name.length > 0 && text.includes(book.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
  if (named.length === 0) return null;
  if (named.length > 1 && named[0].name.length === named[1].name.length) return null;
  return named[0];
}
function stockSpells(item, books) {
  const book = bookForStock(item, books ?? []);
  if (!book || book.spells.length === 0) return void 0;
  return book.spells.map((spell) => ({
    index: spell.sidx,
    name: spell.name,
    level: spell.level,
    mana: spell.mana,
    fail: spell.chance ?? spell.fail,
    learned: spell.learned,
    infoLine: spell.infoLine
  }));
}
function adaptStore(snap, known) {
  const world = viewWorld(snap);
  if (snap.phase !== "store" || !world.stores || !world.player || !world.inventory) return null;
  const status = snap.storeStatus && same2(snap.storeStatus.token, snap.token) ? snap.storeStatus : null;
  const cell2 = known && same2(known.token, snap.token) ? known.cells.find((entry2) => entry2.x === world.player.grid.x && entry2.y === world.player.grid.y) : null;
  const feat = status?.feat ?? cell2?.remembered.feat;
  if (feat === void 0) return null;
  const index = world.stores.findIndex((store2) => store2.feat === feat);
  if (index < 0) return null;
  const store = world.stores[index];
  const items = adaptItems(snap);
  const quotes = new Map(status?.inventory.map((entry2) => [entry2.handle, entry2]));
  const located = status !== null && status.inventory.some((entry2) => entry2.location !== void 0);
  const byHandle = new Map((items?.rows ?? []).map((item) => [item.handle, item]));
  const pack = located ? status.inventory.map((entry2) => {
    const item = byHandle.get(entry2.handle);
    return {
      key: entry2.handle,
      quantity: item?.quantity ?? 1,
      colour: item?.colour ?? "inherit",
      // PROSE
      label: item?.label ?? "Item",
      // PROSE
      location: entry2.location === "equipment" ? "Equipment" : entry2.location === "quiver" ? "Quiver" : "Pack",
      eligible: entry2.eligible,
      ...entry2.eligible && entry2.price !== null ? { price: entry2.price } : {}
    };
  }) : (items?.rows ?? []).map((item) => {
    const quote = quotes.get(item.handle);
    return {
      key: item.handle,
      label: item.label,
      quantity: item.quantity,
      colour: item.colour,
      location: item.location === "pack" ? "Pack" : "Equipment",
      eligible: quote?.eligible ?? true,
      ...quote && quote.eligible && quote.price !== null ? { price: quote.price } : {}
    };
  });
  return {
    token: snap.token,
    index,
    name: store.isHome ? "Home" : storeName(store.featName),
    owner: store.isHome ? "" : store.owner.name,
    home: store.isHome,
    ...world.player.gold === void 0 ? {} : { gold: world.player.gold },
    ready: status?.ready ?? true,
    noSelling: status?.noSelling ?? false,
    transactionPrompts: status !== null,
    // ItemView.name, when published, is the game's own object name; label is the kind's raw template.
    stock: store.stock.map((item) => {
      const spells = stockSpells(item, world.spellbooks);
      return {
        key: item.index,
        kind: itemKey(item),
        label: item.name ?? item.label,
        quantity: item.number,
        colour: item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit",
        eligible: true,
        ...item.price === void 0 ? {} : { price: item.price },
        ...spells ? { spells } : {}
      };
    }),
    pack,
    prompt: snap.prompt
  };
}

// src/panels/stores.ts
var CSS6 = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}.store{position:absolute;inset:12px;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}.sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.side{min-width:0;overflow:auto}h2,h3{color:var(--anyband-accent);border-bottom:1px solid var(--anyband-accent)}table{width:100%;border-collapse:collapse}th{text-align:left}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}button,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}.row{width:100%;text-align:left;border:0;background:transparent}.row[aria-pressed=true]{background:var(--anyband-accent);color:var(--anyband-background)!important}.actions{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.prompt{border:1px solid var(--anyband-accent);padding:8px;max-width:30em}.prompt input{width:100%}.muted{opacity:.65}.gain{color:#80b891}.loss,.error,.unaffordable{color:#ff7559}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer}@media(max-width:650px){.sides{grid-template-columns:1fr}}`;
var same3 = (a, b) => a.epoch === b.epoch && a.revision === b.revision;
function el8(parent, tag, value2) {
  const node2 = parent.ownerDocument.createElement(tag);
  if (value2 !== void 0) node2.textContent = value2;
  parent.appendChild(node2);
  return node2;
}
function button4(parent, label2, click) {
  const node2 = el8(parent, "button", label2);
  node2.type = "button";
  node2.addEventListener("click", click);
  return node2;
}
var REFUSED = { accepted: false, quiet: false };
var STANDING_DOWN = { accepted: false, quiet: true };
function outcome2(result) {
  return { accepted: result.accepted, quiet: !result.accepted && result.code === "controller-owned" };
}
function tradeAllowed(model, side, row) {
  if (!row || !model.transactionPrompts || !model.ready || model.prompt || !row.eligible) return false;
  return side === "pack" || model.home || row.price === void 0 || model.gold === void 0 || row.price <= model.gold;
}
function storeAction(ctx, model, side, key) {
  const snap = viewInput(ctx);
  if (!snap || snap.phase !== "store" || snap.prompt || !same3(snap.token, model.token) || !model.ready || !ctx.intent?.submit) return REFUSED;
  if (!playerIsDriving(ctx)) return STANDING_DOWN;
  if (side !== "leave" && !tradeAllowed(model, side, (side === "stock" ? model.stock : model.pack).find((row) => row.key === key))) return REFUSED;
  const command = side === "leave" ? { code: "shop-exit" } : side === "stock" ? { code: "shop-buy", args: { index: key } } : { code: "shop-sell", args: { handle: key } };
  return outcome2(ctx.intent.submit(snap.token, { kind: "command", command }));
}
function storePromptReply(ctx, model, answer) {
  const snap = viewInput(ctx);
  if (!snap || snap.phase !== "store" || !same3(snap.token, model.token) || !snap.prompt || snap.prompt.promptId !== model.prompt?.promptId || !ctx.prompt?.reply) return REFUSED;
  if (!playerIsDriving(ctx)) return STANDING_DOWN;
  const cancel = typeof answer === "object" && answer.action === "cancel";
  if (snap.prompt.kind === "quantity") {
    const quantity = snap.prompt;
    if (!cancel && (typeof answer !== "number" || !Number.isInteger(answer) || answer < quantity.min || answer > quantity.max)) return REFUSED;
  } else if (snap.prompt.kind === "confirm") {
    if (!cancel && typeof answer !== "boolean") return REFUSED;
  } else return REFUSED;
  return outcome2(ctx.prompt.reply(snap.prompt.promptId, answer));
}
function storeComparisons(ctx, model, side, key) {
  if (ctx.inspect?.compareLoadoutSlots) {
    try {
      const result = ctx.inspect.compareLoadoutSlots(side === "stock" ? { from: "store", store: model.index, index: key } : { from: "gear", handle: key });
      if (result) return same3(result.token, model.token) ? result.slots.map((entry2) => ({ name: entry2.name, sim: entry2.comparison })) : [];
    } catch {
    }
  }
  const sim = compareItem(ctx, model.token, side === "stock" ? { store: model.index, index: key } : key);
  return sim ? [{ name: "", sim }] : [];
}
function storeInspection(ctx, model, side, key) {
  if (!ctx.inspect?.inspectItem) return null;
  let result;
  try {
    result = ctx.inspect.inspectItem(side === "stock" ? { store: model.index, index: key } : key);
  } catch {
    return null;
  }
  if (!result || !same3(result.token, model.token)) return null;
  if (side === "stock" && !result.sections) return null;
  return result;
}
function cleanLabel(label2) {
  return (label2 ?? "").replace(/\s*\[[^\]]*\]\s*$/u, "").replace(/\s*\(0-\d+, \*=all\)/u, "").replace(/[\s:]+$/u, "").trim();
}
function installStores(ctx) {
  const flags = ctx.flags ?? {};
  if (!Object.entries(flags).some(([flag, on2]) => flag.startsWith("anybandui.store") && on2)) return () => {
  };
  if (!ctx.ui?.openPanel || !ctx.snapshot) {
    ctx.log("stores: panel or snapshot seam unavailable");
    return () => {
    };
  }
  let panel = null;
  let stopTheme2 = null;
  let stockSelection = null, packSelection = null, unchanged = false, amount = 1, lastPrompt = -1, split = 50;
  let browsing = null, spellPick = -1;
  let place = "", signature = "", error = "";
  let pending = null;
  let mount = null;
  const on = (part) => flags[`anybandui.store${part}`] === true;
  const read = () => {
    const snap = viewInput(ctx);
    if (snap?.phase !== "store") return null;
    return adaptStore(snap, viewLevel(ctx));
  };
  const paint = (force = false) => {
    const model = read();
    if (!model) {
      if (panel) {
        stopTheme2?.();
        stopTheme2 = null;
        panel.close();
        panel = null;
        mount = null;
      }
      pending = null;
      return;
    }
    if (!panel) {
      panel = ctx.ui.openPanel({ id: "store", modal: false, label: "Store" });
      applyTheme(panel.root, themeFromPrefs(ctx.prefs?.get()));
      const open = panel;
      stopTheme2 = onThemeChange((theme) => {
        if (panel) applyTheme(open.root, theme);
      });
      el8(panel.root, "style", CSS6);
      mount = el8(panel.root, "section");
      mount.className = "store";
    }
    const name = `${model.index}:${model.name}`;
    if (name !== place) {
      place = name;
      stockSelection = null;
      packSelection = null;
      error = "";
      pending = null;
      browsing = null;
    }
    if (browsing) {
      const kind = browsing.kind;
      const book = model.stock.find((row) => row.key === browsing.key && row.kind === kind) ?? model.stock.find((row) => row.kind === kind && row.spells);
      if (!book) browsing = null;
      else if (book.key !== browsing.key) {
        browsing = { key: book.key, kind };
        stockSelection = book.key;
      }
    }
    if (!model.stock.some((row) => row.key === stockSelection)) {
      stockSelection = null;
      browsing = null;
    }
    if (!model.pack.some((row) => row.key === packSelection)) packSelection = null;
    if (pending) {
      if (model.prompt) pending.seen = true;
      else if (pending.seen) pending = null;
    }
    const asked = model.prompt?.kind === "quantity" ? model.prompt : null;
    if (pending && asked?.unitPrice !== void 0) pending.unitPrice = asked.unitPrice;
    const next = JSON.stringify([model, stockSelection, packSelection, unchanged, error, pending, browsing, spellPick]);
    if (!force && next === signature) return;
    signature = next;
    const host = mount;
    host.replaceChildren();
    const width = el8(host, "input");
    width.type = "range";
    width.min = "25";
    width.max = "75";
    width.value = String(split);
    width.setAttribute("aria-label", "Stock column width");
    width.title = "Resize stock and inventory columns";
    width.addEventListener("input", () => {
      split = Number(width.value);
      sides.style.gridTemplateColumns = `${split}% ${100 - split}%`;
    });
    const sides = el8(host, "div");
    sides.className = "sides";
    sides.style.gridTemplateColumns = `${split}% ${100 - split}%`;
    const show = (result, failure) => {
      error = result.accepted || result.quiet ? "" : failure;
    };
    const action = (side, key) => {
      const result = storeAction(ctx, model, side, key);
      if (result.accepted && side !== "leave" && key !== void 0) pending = { side, key, amount: 1, seen: false };
      show(result, "The store cannot do that right now.");
      paint(true);
    };
    const draw = (side) => {
      const box = el8(sides, "section");
      box.className = "side";
      el8(box, "h2", side === "stock" ? `${model.name}${model.owner ? ` - ${model.owner}` : ""}` : `Your inventory${model.gold === void 0 ? "" : ` (Gold: ${model.gold})`}`);
      if (side === "pack" && model.noSelling && !model.home) {
        const note = el8(box, "p", "Stores take items as gifts and pay no gold for them.");
        note.className = "muted";
      }
      const rows = side === "stock" ? model.stock : model.pack;
      const selected = side === "stock" ? stockSelection : packSelection;
      const prices = on("Prices") && !model.home && !(side === "pack" && model.noSelling);
      const table = el8(box, "table");
      const head = el8(table, "tr");
      for (const label2 of ["Item", "Qty", ...side === "pack" ? ["Location"] : [], ...prices ? [side === "stock" ? "Gold each" : "Offer each"] : []]) el8(head, "th", label2);
      if (!rows.length) el8(box, "p", side === "stock" ? "No stock here." : "No items in your pack.");
      for (const row of rows) {
        const tr = el8(table, "tr");
        const cell2 = el8(tr, "td");
        if (!row.eligible) tr.className = "muted";
        const pick = button4(cell2, row.label, () => {
          if (side === "stock") {
            if (stockSelection !== row.key) browsing = null;
            stockSelection = row.key;
          } else packSelection = row.key;
          paint(true);
        });
        pick.className = "row";
        pick.style.color = row.colour;
        pick.title = row.eligible ? row.label : `${row.label}. This store will not buy it.`;
        pick.setAttribute("aria-pressed", String(selected === row.key));
        el8(tr, "td", String(row.quantity));
        if (side === "pack") el8(tr, "td", row.location ?? "Pack");
        if (prices) {
          const price = el8(tr, "td", row.price === void 0 ? "" : String(row.price));
          if (side === "stock" && row.price !== void 0 && model.gold !== void 0 && row.price > model.gold) price.className = "unaffordable";
        }
      }
      if (on("Transactions")) {
        const actions = el8(box, "div");
        actions.className = "actions";
        const label2 = side === "stock" ? model.home ? "Retrieve" : "Buy" : model.home ? "Stash" : model.noSelling ? "Give" : "Sell";
        const active = rows.find((row) => row.key === selected);
        const drive = playerIsDriving(ctx);
        const submit = button4(actions, label2, () => action(side, selected ?? void 0));
        submit.disabled = !drive || !ctx.intent?.submit || !tradeAllowed(model, side, active);
        if (!model.transactionPrompts) submit.title = "This version of the game cannot run store trades from here.";
        else if (active && !active.eligible) submit.title = "This store will not buy that item.";
        else if (side === "stock" && active && !model.home && active.price !== void 0 && model.gold !== void 0 && active.price > model.gold) submit.title = "You cannot afford this.";
        if (side === "stock") {
          const leave = button4(actions, model.home ? "Leave home" : "Leave store", () => action("leave"));
          leave.disabled = !drive || !ctx.intent?.submit || !model.ready || !!model.prompt;
        }
        if (side === "stock" && model.transactionPrompts && !model.ready && !model.prompt) {
          const wait = el8(box, "p", "Waiting for the store.");
          wait.className = "muted";
        }
      }
      el8(box, "h3", "Inspection");
      const chosen = rows.find((row) => row.key === selected);
      if (!chosen) {
        const empty = el8(box, "p", "Select an item to inspect it.");
        empty.className = "muted";
        return;
      }
      el8(box, "strong", chosen.label).style.color = chosen.colour;
      if (on("Comparison")) {
        const slots = storeComparisons(ctx, model, side, chosen.key);
        for (const slot of slots) {
          if (slots.length > 1 && slot.name) el8(box, "h4", slot.name.charAt(0).toUpperCase() + slot.name.slice(1));
          renderItemComparison(box, slot.sim, unchanged, (value2) => {
            unchanged = value2;
            paint(true);
          });
        }
      }
      const inspection = storeInspection(ctx, model, side, chosen.key);
      if (inspection) {
        const details = el8(box, "details");
        details.open = true;
        el8(details, "summary", inspection.title);
        const parts = inspection.sections?.filter((part) => part.kind !== "title");
        if (parts) for (const part of parts) el8(details, "p", part.text);
        else el8(details, "p", inspection.text);
      }
      if (side === "stock" && chosen.spells && chosen.spells.length > 0) {
        const spells = chosen.spells;
        button4(box, "Browse spells", () => {
          browsing = { key: chosen.key, kind: chosen.kind };
          if (!spells.some((spell) => spell.index === spellPick)) spellPick = spells[0].index;
          paint(true);
        });
        if (browsing?.key === chosen.key) {
          const detail = (index) => {
            try {
              const info2 = ctx.inspect?.spellInfo?.(index);
              return info2 && same3(info2.token, model.token) ? info2 : null;
            } catch {
              return null;
            }
          };
          const table2 = el8(box, "table");
          const head2 = el8(table2, "tr");
          for (const label2 of ["Spell", "Level", "Mana", "Fail"]) el8(head2, "th", label2);
          for (const spell of spells) {
            const tr = el8(table2, "tr");
            const cell2 = el8(tr, "td");
            button4(cell2, spell.name, () => {
              spellPick = spell.index;
              paint(true);
            });
            el8(tr, "td", String(spell.level));
            el8(tr, "td", String(spell.mana));
            el8(tr, "td", `${detail(spell.index)?.failChance ?? spell.fail}%`);
          }
          const shown = spells.find((spell) => spell.index === spellPick) ?? spells[0];
          const info = detail(shown.index);
          el8(box, "p", `Level ${shown.level}. Mana ${shown.mana}. Failure ${info?.failChance ?? shown.fail}%.`);
          if (shown.infoLine) el8(box, "p", shown.infoLine);
          if (info?.description) el8(box, "p", info.description);
          button4(box, "Close", () => {
            browsing = null;
            paint(true);
          });
        }
      }
    };
    draw("stock");
    draw("pack");
    if (model.prompt) drawPrompt(host, model);
    if (error) {
      const line = el8(host, "p", error);
      line.className = "error";
    }
  };
  const drawPrompt = (host, model) => {
    const prompt = model.prompt;
    const box = el8(host, "section");
    box.className = "prompt";
    const interactive = on("Prompts") && !!ctx.prompt?.reply && (prompt.kind === "quantity" || prompt.kind === "confirm");
    if (!interactive) {
      el8(box, "p", cleanLabel(prompt.label) || "The game is asking a question.");
      const hint = el8(box, "p", "Answer it with the keyboard.");
      hint.className = "muted";
      return;
    }
    const reply = (answer) => {
      const result = storePromptReply(ctx, model, answer);
      if (result.accepted) {
        if (typeof answer === "number" && pending) pending.amount = answer;
        if (typeof answer !== "number" && answer !== true) pending = null;
      }
      error = result.accepted || result.quiet ? "" : "That answer was not accepted.";
      paint(true);
    };
    const selling = pending?.side === "pack";
    if (prompt.kind === "quantity") {
      const quantity = prompt;
      if (quantity.promptId !== lastPrompt) {
        lastPrompt = quantity.promptId;
        amount = Math.max(1, Math.min(quantity.max, quantity.defaultValue));
      }
      const low = Math.max(1, quantity.min);
      el8(box, "h3", "How many?");
      const text2 = cleanLabel(quantity.label);
      if (text2) el8(box, "p", text2);
      el8(box, "p", `Up to ${quantity.max}`);
      const priced = quantity.unitPrice !== void 0 && !(selling && model.noSelling);
      if (selling && model.noSelling) el8(box, "p", "The store pays no gold for this.");
      if (priced) el8(box, "p", `${selling ? "Offer" : "Price"} each: ${quantity.unitPrice} gold`);
      const total = priced ? el8(box, "p") : null;
      if (quantity.gold !== void 0) el8(box, "p", `Your gold: ${quantity.gold}`);
      const input = el8(box, "input");
      input.type = "number";
      input.min = String(low);
      input.max = String(quantity.max);
      input.value = String(amount);
      input.setAttribute("aria-label", "Amount");
      const slider = quantity.max > 1 ? el8(box, "input") : null;
      if (slider) {
        slider.type = "range";
        slider.min = String(low);
        slider.max = String(quantity.max);
        slider.value = String(amount);
        slider.setAttribute("aria-label", "Quantity");
      }
      const actions2 = el8(box, "div");
      actions2.className = "actions";
      const update = () => {
        const valid = Number.isInteger(amount) && amount >= low && amount <= quantity.max;
        if (slider) slider.value = String(amount);
        let over = false;
        if (total) {
          const exact = quantity.totals?.[amount];
          const hasExact = typeof exact === "number";
          const sum = hasExact ? exact : amount === 1 && quantity.totalPrice !== void 0 ? quantity.totalPrice : quantity.unitPrice * amount;
          const about = !hasExact && amount !== 1;
          total.textContent = valid ? `Total: ${about ? "about " : ""}${sum} gold` : "";
          over = !about && !selling && quantity.gold !== void 0 && sum > quantity.gold;
          total.className = over ? "unaffordable" : "";
        }
        confirm2.disabled = !valid || over;
      };
      input.addEventListener("input", () => {
        amount = Number(input.value);
        update();
      });
      slider?.addEventListener("input", () => {
        amount = Number(slider.value);
        input.value = String(amount);
        update();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.stopPropagation();
          if (!confirm2.disabled) reply(amount);
        }
      });
      for (const [label2, value2] of [["One", 1], ["Half", Math.max(1, Math.floor(quantity.max / 2))], ["All", quantity.max]]) button4(actions2, label2, () => {
        amount = value2;
        input.value = String(value2);
        update();
      });
      const confirm2 = button4(actions2, "OK", () => {
        if (!confirm2.disabled) reply(amount);
      });
      button4(actions2, "Cancel", () => reply({ action: "cancel" }));
      update();
      return;
    }
    el8(box, "h3", pending && !model.home ? selling ? "Accept this offer?" : "Accept this price?" : "Confirm");
    const text = cleanLabel(prompt.label);
    if (text) el8(box, "p", text);
    const price = prompt.price;
    if (pending && !model.home) {
      const row = (pending.side === "stock" ? model.stock : model.pack).find((entry2) => entry2.key === pending.key);
      const unit = pending.unitPrice ?? row?.price;
      if (selling && model.noSelling) el8(box, "p", "You get no gold for this.");
      else if (price !== void 0) el8(box, "p", `${selling ? "You receive" : "Price"}: ${price} gold`);
      else if (unit !== void 0) el8(box, "p", `${selling ? "You receive" : "Price"}: ${pending.amount === 1 ? "" : "about "}${unit * pending.amount} gold`);
    }
    const actions = el8(box, "div");
    actions.className = "actions";
    button4(actions, "Accept", () => reply(true));
    button4(actions, "Decline", () => reply(false));
    button4(actions, "Cancel", () => reply({ action: "cancel" }));
  };
  paint(true);
  const timer2 = globalThis.setInterval(() => paint(), 200);
  return () => {
    globalThis.clearInterval(timer2);
    stopTheme2?.();
    stopTheme2 = null;
    panel?.close();
    panel = null;
  };
}

// src/mod-coexistence.ts
var MOVED_FROM_QOL = [
  { flag: "anybandui.zoom", qolFlag: "qol.zoomPan", name: "zoom and pan" },
  { flag: "anybandui.enlargedDisplay", qolFlag: "qol.accessibilityZoom", name: "the enlarged display" },
  { flag: "anybandui.crispTiles", qolFlag: "qol.sharpenZoomedTiles", name: "sharper tiles" },
  { flag: "anybandui.mapHoverCards", qolFlag: "qol.mapHoverCards", name: "map overview hover cards" },
  { flag: "anybandui.firstEncounter", qolFlag: "qol.firstEncounterAlerts", name: "first-encounter alerts" },
  { flag: "anybandui.quiverItemization", qolFlag: "qol.quiverItemization", name: "the itemized quiver" },
  { flag: "anybandui.highContrast", qolFlag: "qol.accessibilityHighContrast", name: "high contrast" },
  { flag: "anybandui.colourblind", qolFlag: "qol.accessibilityColorblind", name: "the colourblind filter" }
];
var QOL_MOD_ID = "qol";
var LAST_QOL_WITH_MOVED_FEATURES = [1, 12, 0];
function qolKeepsMovedFeatures(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  for (let i = 0; i < 3; i++) {
    if (parts[i] !== LAST_QOL_WITH_MOVED_FEATURES[i]) return parts[i] < LAST_QOL_WITH_MOVED_FEATURES[i];
  }
  return true;
}
function coexistingFlags(flags, mods, log) {
  let list = [];
  try {
    list = typeof mods === "function" ? mods() : [];
  } catch {
    list = [];
  }
  const qol = list.find((mod) => mod.id === QOL_MOD_ID);
  if (!qol || !qolKeepsMovedFeatures(qol.version)) return flags;
  const yielded = MOVED_FROM_QOL.filter((feature) => flags[feature.flag] === true && qol.flags?.[feature.qolFlag] !== false);
  if (!yielded.length) return flags;
  log?.(`Quality of Life ${qol.version} still draws ${yielded.map((feature) => feature.name).join(", ")}, so AnybandUI leaves them to it`);
  return Object.freeze({ ...flags, ...Object.fromEntries(yielded.map((feature) => [feature.flag, false])) });
}

// src/menus/dialog.ts
var DIALOG_CSS = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:max-content;min-width:min(320px,calc(100vw - 24px));max-width:min(900px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:10px 12px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
.dialog.wide{width:min(900px,calc(100vw - 24px))}
h2{margin:0 0 6px;font-size:1.15em}h3{margin:8px 0 4px;font-size:1em;opacity:.8;text-transform:uppercase;letter-spacing:.05em}
p{margin:4px 0}
button{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 8px;cursor:pointer}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--anyband-accent)}
input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
.actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.muted{opacity:.65}.error{color:#e8806f}
.tabs{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}
.tabs button[aria-selected="true"]{border-width:2px}
table{width:100%;border-collapse:collapse}td,th{padding:2px 6px;border-bottom:1px solid var(--anyband-accent);text-align:left;vertical-align:top}
th{opacity:.8;font-weight:normal}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin:8px 0}
.metric{border:1px solid var(--anyband-accent);border-radius:calc(var(--anyband-rounding) * .6);padding:4px 6px}
.metric .label{display:block;opacity:.65;font-size:.85em;text-transform:uppercase}
.metric .value{display:block;font-size:1.2em}`;
var serial = 0;
function openDialog(ctx, spec) {
  const ui = ctx.ui;
  if (!ui?.openPanel) return null;
  let panel;
  serial += 1;
  try {
    panel = ui.openPanel({ id: `${spec.id}-${serial}`, modal: true, label: spec.label });
  } catch (error) {
    ctx.log(`${spec.label}: the panel could not open (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
  const root = panel.root;
  applyTheme(root, themeFromPrefs(ctx.prefs?.get()));
  const style = root.ownerDocument.createElement("style");
  style.textContent = `${DIALOG_CSS}${spec.css ?? ""}`;
  root.appendChild(style);
  const body = root.ownerDocument.createElement("section");
  body.className = `dialog${spec.className ? ` ${spec.className}` : ""}`;
  body.setAttribute("role", "dialog");
  body.setAttribute("aria-label", spec.label);
  root.appendChild(body);
  const stopTheme2 = onThemeChange((theme) => applyTheme(root, theme));
  let open = true;
  let byPlayer = false;
  void panel.closed.then(() => {
    if (open) byPlayer = true;
    open = false;
    stopTheme2();
  });
  return {
    root,
    body,
    closed: panel.closed,
    dismissedByPlayer: () => byPlayer,
    isOpen: () => open,
    close: () => {
      if (!open) return;
      open = false;
      stopTheme2();
      panel.close();
    }
  };
}
function el9(parent, tag, text, className) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  if (className) child.className = className;
  parent.appendChild(child);
  return child;
}
function button5(parent, label2, onClick, focusKey) {
  const node2 = el9(parent, "button", label2);
  node2.type = "button";
  if (focusKey) node2.dataset["focus"] = focusKey;
  node2.addEventListener("click", () => {
    if (!node2.disabled) onClick();
  });
  return node2;
}
function stepFocus(items, current, key, axis = "vertical") {
  const forward = axis === "horizontal" ? ["ArrowRight"] : axis === "vertical" ? ["ArrowDown"] : ["ArrowDown", "ArrowRight"];
  const back = axis === "horizontal" ? ["ArrowLeft"] : axis === "vertical" ? ["ArrowUp"] : ["ArrowUp", "ArrowLeft"];
  const ends = key === "Home" ? 0 : key === "End" ? items.length - 1 : null;
  if (!forward.includes(key) && !back.includes(key) && ends === null) return null;
  if (!items.length) return null;
  const at = current ? items.indexOf(current) : -1;
  const next = ends !== null ? ends : at < 0 ? 0 : forward.includes(key) ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
  items[next]?.focus();
  return next;
}
function metric(parent, label2, value2, tooltip) {
  const box = el9(parent, "div", void 0, "metric");
  el9(box, "span", label2, "label");
  el9(box, "span", value2, "value");
  if (tooltip) box.title = tooltip;
  return box;
}
function formatWhen(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "Unknown";
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function matches2(text, query) {
  return text.toLowerCase().includes(query.toLowerCase());
}

// src/menus/confirm.ts
function openConfirm(ctx, options) {
  const dialog = openDialog(ctx, { id: "confirm", label: options.title, className: "confirm" });
  if (!dialog) return { answer: Promise.resolve(false), opened: false, dismiss: () => {
  } };
  let settle = () => {
  };
  const answer = new Promise((resolve2) => {
    settle = resolve2;
  });
  let done = false;
  const finish = (value2) => {
    if (done) return;
    done = true;
    dialog.close();
    settle(value2);
  };
  void dialog.closed.then(() => finish(false));
  el9(dialog.body, "h2", options.title);
  el9(dialog.body, "p", options.message);
  if (options.detail) el9(dialog.body, "p", options.detail, "muted");
  const row = el9(dialog.body, "div", void 0, "actions");
  const yes = button5(row, options.yes ?? "Yes", () => finish(true), "yes");
  const no = button5(row, options.no ?? "No", () => finish(false), "no");
  row.addEventListener("keydown", (event) => {
    if (stepFocus([yes, no], dialog.root.activeElement, event.key, "horizontal") !== null) event.preventDefault();
  });
  dialog.body.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  (options.danger ? no : yes).focus();
  return { answer, opened: true, dismiss: () => finish(false) };
}
function confirm(ctx, options) {
  return openConfirm(ctx, options).answer;
}
function confirmPrompt(prompt) {
  if (!prompt || typeof prompt !== "object") return null;
  const p = prompt;
  return p.kind === "confirm" && typeof p.promptId === "number" && typeof p.label === "string" ? p : null;
}
function installYesNoPrompts(ctx) {
  if (ctx.flags?.["anybandui.yesNoPrompts"] !== true) return () => {
  };
  const reply = ctx.prompt;
  if (!ctx.snapshot || !reply || !ctx.ui?.openPanel) {
    ctx.log("yes/no prompts: this game has no prompt reply or panel seam");
    return () => {
    };
  }
  let shown = null;
  let skipped = null;
  const poll = () => {
    let snap = null;
    try {
      snap = viewInput(ctx);
    } catch {
      snap = null;
    }
    const prompt = snap && snap.phase !== "store" ? confirmPrompt(snap.prompt) : null;
    if (shown && shown.id !== prompt?.promptId) {
      const stale = shown;
      shown = null;
      stale.handle.dismiss();
    }
    if (!prompt || shown || skipped === prompt.promptId) return;
    const id = prompt.promptId;
    const handle = openConfirm(ctx, { title: "Angband asks", message: prompt.label.trim(), yes: "Yes", no: "No" });
    if (!handle.opened) {
      skipped = id;
      return;
    }
    shown = { id, handle };
    void handle.answer.then((value2) => {
      if (shown?.id !== id) return;
      shown = null;
      try {
        reply.reply(id, value2);
      } catch (error) {
        ctx.log(`yes/no prompts: reply refused (${String(error)})`);
      }
    });
  };
  const timer2 = globalThis.setInterval(poll, 200);
  poll();
  return () => {
    globalThis.clearInterval(timer2);
    const open = shown;
    shown = null;
    open?.handle.dismiss();
  };
}

// src/menus/journal.ts
var JOURNAL_CATEGORIES = ["All milestones", "Level-ups", "New depths", "Unique victories", "Artifacts"];
var CATEGORY_KIND = [null, "level", "depth", "unique", "artifact"];
function journalSymbol(kind) {
  return kind === "level" ? "+" : kind === "depth" ? ">" : kind === "unique" ? "!" : kind === "artifact" ? "*" : kind === "ending" ? "X" : "@";
}
function journalTint(kind) {
  return kind === "artifact" ? "#ebc266" : kind === "unique" || kind === "ending" ? "#e8806e" : kind === "depth" ? "#80bae3" : "#80c299";
}
function depthText(depth) {
  return `Reached ${depth * 50} ft (dungeon level ${depth}).`;
}
function journalFromHistory(history, depths = []) {
  const marks = [...depths].sort((a, b) => a.after - b.after);
  const merged = [];
  const levels = /* @__PURE__ */ new Set();
  let d = 0;
  const depthsUpTo = (count) => {
    while (d < marks.length && marks[d].after <= count) {
      const mark = marks[d++];
      merged.push({ kind: "depth", text: depthText(mark.depth), turn: null, depth: mark.depth, level: mark.level, lost: false });
    }
  };
  history.forEach((entry2, index) => {
    depthsUpTo(index);
    const kind = entry2.kind === "level" ? "level" : entry2.kind === "unique" ? "unique" : entry2.kind === "artifact" || entry2.kind === "artifact-unknown" ? "artifact" : "other";
    if (kind === "level") {
      if (levels.has(entry2.level)) return;
      levels.add(entry2.level);
    }
    merged.push({ kind, text: entry2.text, turn: entry2.turn, depth: entry2.depth, level: entry2.level, lost: entry2.lost });
  });
  depthsUpTo(Number.POSITIVE_INFINITY);
  return merged;
}
function endingText(report) {
  if (report.outcome === "winner") return "Won the game.";
  if (report.outcome === "retired") return "Retired.";
  return `Killed by ${report.cause}.`;
}
function endingEntry(report) {
  return { kind: "ending", text: endingText(report), turn: report.turn, depth: report.depth, level: report.level, lost: false };
}
function journalMeta(entry2) {
  const where = `Lv ${entry2.level}  /  ${entry2.depth === 0 ? "Town" : `Depth ${entry2.depth}`}`;
  return entry2.turn === null ? where : `${where}  /  Turn ${entry2.turn}`;
}
function newJournalFilter() {
  return { search: "", newest: true, category: 0 };
}
function filterJournal(entries, filter) {
  const kind = CATEGORY_KIND[filter.category] ?? null;
  const shown = entries.filter((entry2) => (kind === null || entry2.kind === kind) && matches2(entry2.text, filter.search));
  return filter.newest ? shown.reverse() : shown;
}
var JOURNAL_CSS = `.journal-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.timeline{list-style:none;margin:0;padding:0}
.timeline li{display:grid;grid-template-columns:2em 1fr;gap:8px;margin:0 0 6px}
.timeline .mark{display:flex;align-items:center;justify-content:center;height:2em;border:1px solid currentColor;border-radius:3px}
.timeline .entry{border:1px solid var(--anyband-accent);border-radius:calc(var(--anyband-rounding) * .6);padding:3px 8px}
.timeline .meta{display:block;font-size:.8em;opacity:.65}`;
function createJournalView(parent, filter, focusPrefix = "journal") {
  const controls = el9(parent, "div", void 0, "journal-controls");
  const search = el9(controls, "input");
  search.type = "search";
  search.placeholder = "Search milestones";
  search.setAttribute("aria-label", "Search milestones");
  search.value = filter.search;
  search.dataset["focus"] = `${focusPrefix}-search`;
  const newestLabel = el9(controls, "label");
  const newest = el9(newestLabel, "input");
  newest.type = "checkbox";
  newest.checked = filter.newest;
  newest.dataset["focus"] = `${focusPrefix}-newest`;
  el9(newestLabel, "span", " Newest first");
  const category = el9(controls, "select");
  category.setAttribute("aria-label", "Milestone type");
  category.dataset["focus"] = `${focusPrefix}-category`;
  JOURNAL_CATEGORIES.forEach((name, index) => {
    const option = el9(category, "option", name);
    option.value = String(index);
  });
  category.value = String(filter.category);
  const list = el9(parent, "ol", void 0, "timeline");
  let last = null;
  const draw = () => {
    list.replaceChildren();
    if (last === null) {
      el9(list, "li", "No journal was recorded for this run.", "muted");
      return;
    }
    const shown = filterJournal(last, filter);
    if (!shown.length) {
      el9(list, "li", "No matching milestones yet.", "muted");
      return;
    }
    for (const entry2 of shown) {
      const item = el9(list, "li");
      const mark = el9(item, "span", journalSymbol(entry2.kind), "mark");
      mark.style.color = journalTint(entry2.kind);
      mark.setAttribute("aria-hidden", "true");
      const box = el9(item, "span", void 0, "entry");
      el9(box, "span", entry2.lost ? `${entry2.text} (lost)` : entry2.text);
      el9(box, "span", journalMeta(entry2), "meta");
    }
  };
  search.addEventListener("input", () => {
    filter.search = search.value;
    draw();
  });
  newest.addEventListener("change", () => {
    filter.newest = newest.checked;
    draw();
  });
  category.addEventListener("change", () => {
    filter.category = Number(category.value) || 0;
    draw();
  });
  return { update(entries) {
    last = entries;
    draw();
  } };
}

// src/menus/run-journal.ts
var DEPTH_KEY = "journalDepths";
var DEPTH_POLL_MS = 1e3;
function readDepthMarks(store) {
  let bag;
  try {
    bag = store?.get();
  } catch {
    return [];
  }
  const raw = bag && typeof bag === "object" ? bag[DEPTH_KEY] : void 0;
  if (!Array.isArray(raw)) return [];
  return raw.filter((mark) => !!mark && typeof mark === "object" && Number.isFinite(mark.depth) && Number.isFinite(mark.level) && Number.isInteger(mark.after) && mark.after >= 0);
}
function recordDepth(ctx) {
  const store = ctx.characterStore;
  if (!store) return false;
  let snap = null;
  try {
    snap = viewInput(ctx);
  } catch {
    snap = null;
  }
  const player = viewPlayer(snap);
  const depth = player?.depth;
  if (typeof depth !== "number" || depth <= 0) return false;
  const marks = readDepthMarks(store);
  if (marks.some((mark) => mark.depth >= depth)) return false;
  let bag;
  try {
    bag = store.get();
  } catch {
    bag = null;
  }
  const root = bag && typeof bag === "object" && !Array.isArray(bag) ? bag : {};
  let after = 0;
  try {
    after = ctx.character?.history().length ?? 0;
  } catch {
    after = 0;
  }
  try {
    store.set({ ...root, [DEPTH_KEY]: [...marks, { depth, level: player?.level ?? 0, after }] });
    return true;
  } catch (error) {
    ctx.log(`run journal: the depth could not be stored (${String(error)})`);
    return false;
  }
}
function installDepthRecorder(ctx) {
  const events = ctx.events;
  if (!ctx.characterStore) return () => {
  };
  const onLevel = () => {
    recordDepth(ctx);
  };
  let listening = false;
  if (events) {
    try {
      events.on("dungeonlevel", onLevel);
      listening = true;
    } catch {
      ctx.log("run journal: this game does not report level changes, so new depths are read once a second");
    }
  }
  const timer2 = ctx.snapshot ? globalThis.setInterval(onLevel, DEPTH_POLL_MS) : null;
  if (!listening && timer2 === null) ctx.log("run journal: this game reports no depth, so new depths are not recorded");
  recordDepth(ctx);
  return () => {
    if (timer2 !== null) globalThis.clearInterval(timer2);
    if (listening) events?.off("dungeonlevel", onLevel);
  };
}
function liveJournal(ctx) {
  const character = ctx.character;
  if (!character) return null;
  let history = [];
  try {
    history = character.history();
  } catch {
    return null;
  }
  const entries = journalFromHistory(history, readDepthMarks(ctx.characterStore));
  let report = null;
  try {
    report = character.runReport?.() ?? null;
  } catch {
    report = null;
  }
  if (report) entries.push(endingEntry(report));
  return entries;
}
var CSS7 = `${DIALOG_CSS}${JOURNAL_CSS}
.journal-pane{position:absolute;left:12px;right:12px;bottom:12px;max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}`;
function installRunJournal(ctx) {
  if (ctx.flags?.["anybandui.runJournal"] !== true) return () => {
  };
  if (!ctx.character) ctx.log("run journal: this game has no character history read");
  let repaint = () => {
  };
  const surfaces = openSurfaces(
    ctx,
    [{ key: "run-journal", label: "Run journal", tab: "Character", minSize: { width: 320, height: 200 }, placement: { kind: "dock", target: "main", edge: "bottom" } }],
    { id: "run-journal", label: "Run journal", className: "journal-pane" },
    CSS7,
    () => repaint()
  );
  if (!surfaces) {
    ctx.log("run journal: panel seam unavailable");
    return () => {
    };
  }
  const filter = newJournalFilter();
  let mount = null;
  let view = null;
  let actions = null;
  let status = null;
  let signature = "";
  let closed = false;
  let timer2 = null;
  const stopTimer = () => {
    if (timer2 !== null) {
      globalThis.clearInterval(timer2);
      timer2 = null;
    }
  };
  const playAgain = async () => {
    const report = ctx.character?.runReport?.() ?? null;
    if (!report || !ctx.saves?.create) return;
    const result = await ctx.saves.create({ like: report.birth });
    if (!result.ok && status) status.textContent = result.reason;
  };
  const paint = (force = false) => {
    if (closed) return;
    const host = surfaces.mounts().get("run-journal");
    if (!host) {
      stopTimer();
      return;
    }
    if (timer2 === null) timer2 = globalThis.setInterval(() => paint(), 200);
    if (host !== mount) {
      mount = host;
      host.replaceChildren();
      el9(host, "h3", "Run summary");
      view = createJournalView(host, filter, "run-journal");
      actions = el9(host, "div", void 0, "actions");
      status = el9(host, "p", "", "muted");
      signature = "";
    }
    const entries = liveJournal(ctx);
    const ended = !!entries?.length && entries[entries.length - 1].kind === "ending";
    const next = JSON.stringify([entries, ended]);
    if (!force && next === signature) return;
    signature = next;
    view?.update(entries);
    if (actions) {
      actions.replaceChildren();
      if (ended && ctx.saves?.create) button5(actions, "Play Again", () => {
        void playAgain();
      }, "play-again");
    }
  };
  paint(true);
  repaint = () => paint(true);
  return () => {
    closed = true;
    stopTimer();
    surfaces.close();
  };
}

// src/menus/death-recap.ts
var BLOW_BUFFER = 40;
var RECAP_BLOWS = 8;
var RECAP_MESSAGES = 6;
var RECAP_MILESTONES = 4;
function attackerName(attacker, kind, snapshot) {
  if (attacker === "player") return "You";
  if (attacker === null) return kind === "trap" ? "A trap" : "Something unseen";
  const monster = viewMonsters(snapshot)?.find((entry2) => entry2.id === attacker);
  return monster?.visible && monster.race ? monster.race : "Something unseen";
}
function createBlowLog(snapshot, limit = BLOW_BUFFER) {
  const kept = [];
  const push = (blow) => {
    kept.push(blow);
    if (kept.length > limit) kept.splice(0, kept.length - limit);
  };
  return {
    combat(payload) {
      if (!payload || payload.target !== "player") return;
      let snap = null;
      if (typeof payload.attacker === "number") {
        try {
          snap = snapshot();
        } catch {
          snap = null;
        }
      }
      push({ by: attackerName(payload.attacker, payload.kind, snap), kind: payload.kind, hit: payload.hit === true, amount: Math.max(0, Math.round(payload.damage || 0)) });
    },
    heal(payload) {
      if (!payload || payload.who !== "player" || !(payload.amount > 0)) return;
      push({ by: "You", kind: "heal", hit: true, amount: Math.round(payload.amount) });
    },
    entries: () => [...kept],
    clear: () => {
      kept.length = 0;
    }
  };
}
function buildRecap(report, blows, depthStore, driver) {
  if (report.outcome !== "death") return null;
  const journal = journalFromHistory(report.history, readDepthMarks(depthStore)).filter((entry2) => entry2.kind !== "other");
  return {
    v: 1,
    killer: report.cause,
    depth: report.depth,
    maxDepth: report.maxDepth,
    level: report.level,
    turn: report.turn,
    blows: blows.slice(-RECAP_BLOWS),
    messages: report.messages.slice(-RECAP_MESSAGES).map((message) => message.count > 1 ? `${message.text} (x${message.count})` : message.text),
    milestones: journal.slice(-RECAP_MILESTONES),
    driver: driver?.kind === "controller" ? driver.owner : null
  };
}
function readRecap(value2) {
  if (!value2 || typeof value2 !== "object") return null;
  const recap = value2;
  return recap.v === 1 && typeof recap.killer === "string" && Array.isArray(recap.blows) && Array.isArray(recap.messages) && Array.isArray(recap.milestones) && [recap.depth, recap.maxDepth, recap.level, recap.turn].every((n) => typeof n === "number") && (recap.driver === null || typeof recap.driver === "string") ? recap : null;
}
var KIND_WORDS = { melee: "melee", ranged: "missile", spell: "spell", effect: "effect", trap: "trap", heal: "healing" };
function blowRow(blow) {
  if (blow.kind === "heal") return [blow.by, KIND_WORDS.heal, `+${blow.amount}`];
  return [blow.by, KIND_WORDS[blow.kind], blow.hit ? `-${blow.amount}` : "missed"];
}
function driverNote(owner) {
  if (owner === null) return null;
  const name = driverName(owner);
  return owner === "squire" ? "Squire was playing when this character died. Its own report of the run is on the Report tab of the Squire panel." : `${name} was playing when this character died.`;
}
var RECAP_CSS = `.recap .killer{font-size:1.2em;margin:2px 0 6px}
.recap .loss{color:#e8806f}.recap .gain{color:#80c299}
.recap ol.milestones{list-style:none;margin:0;padding:0}
.recap ol.milestones li{display:grid;grid-template-columns:1.6em 1fr;gap:6px;margin:0 0 4px}
.recap .meta{display:block;font-size:.8em;opacity:.65}`;
function renderRecap(parent, recap) {
  const box = el9(parent, "div", void 0, "recap");
  el9(box, "p", `Killed by ${recap.killer}`, "killer");
  const note = driverNote(recap.driver);
  if (note) el9(box, "p", note, "muted");
  const metrics = el9(box, "div", void 0, "metrics");
  metric(metrics, "Depth", recap.depth === 0 ? "Town" : `${recap.depth} (${recap.depth * 50} ft)`);
  metric(metrics, "Deepest", `${recap.maxDepth} (${recap.maxDepth * 50} ft)`);
  metric(metrics, "Level", String(recap.level));
  metric(metrics, "Turns", String(recap.turn));
  el9(box, "h3", "Last blows");
  if (!recap.blows.length) el9(box, "p", "No blows were seen in the last moments.", "muted");
  else {
    const table = el9(box, "table");
    const head = el9(el9(table, "thead"), "tr");
    for (const name of ["From", "How", "Hit points"]) el9(head, "th", name);
    const rows = el9(table, "tbody");
    for (const blow of recap.blows) {
      const tr = el9(rows, "tr");
      const [by, how, change] = blowRow(blow);
      el9(tr, "td", by);
      el9(tr, "td", how);
      el9(tr, "td", change, blow.kind === "heal" ? "gain" : blow.hit ? "loss" : "muted");
    }
    const taken = recap.blows.reduce((sum, blow) => sum + (blow.kind !== "heal" && blow.hit ? blow.amount : 0), 0);
    el9(box, "p", `${taken} hit points lost in these blows.`, "muted");
  }
  el9(box, "h3", "Last messages");
  if (!recap.messages.length) el9(box, "p", "No messages were recorded.", "muted");
  for (const message of recap.messages) el9(box, "p", message);
  el9(box, "h3", "Last milestones");
  if (!recap.milestones.length) {
    el9(box, "p", "No milestones were recorded.", "muted");
    return;
  }
  const list = el9(box, "ol", void 0, "milestones");
  for (const entry2 of recap.milestones) {
    const item = el9(list, "li");
    const mark = el9(item, "span", journalSymbol(entry2.kind));
    mark.style.color = journalTint(entry2.kind);
    mark.setAttribute("aria-hidden", "true");
    const text = el9(item, "span", entry2.lost ? `${entry2.text} (lost)` : entry2.text);
    el9(text, "span", journalMeta(entry2), "meta");
  }
}
function openRecapDialog(ctx, recap, name) {
  const dialog = openDialog(ctx, { id: "death-recap", label: `${name || "Unnamed"}: death recap`, css: RECAP_CSS });
  if (!dialog) return Promise.resolve();
  el9(dialog.body, "h2", "Death recap");
  renderRecap(dialog.body, recap);
  const actions = el9(dialog.body, "div", void 0, "actions");
  button5(actions, "Close", () => dialog.close(), "close").focus();
  return dialog.closed;
}
function installDeathRecap(ctx, ownDialog) {
  if (ctx.flags?.["anybandui.deathRecap"] !== true) return { cleanup: () => {
  } };
  const cleanups = [];
  const log = createBlowLog(() => viewInput(ctx));
  const combat = (_type, payload) => log.combat(payload);
  const heal = (_type, payload) => log.heal(payload);
  const events = ctx.events;
  if (events?.on) {
    try {
      events.on("combat-outcome", combat);
      cleanups.push(() => events.off("combat-outcome", combat));
      events.on("heal", heal);
      cleanups.push(() => events.off("heal", heal));
    } catch (error) {
      ctx.log(`death recap: combat events unavailable (${String(error)})`);
    }
  } else ctx.log("death recap: this game sends no combat events, so the recap has no blows");
  const recap = (report) => {
    const built = buildRecap(report, log.entries(), ctx.characterStore, currentDriver(ctx));
    log.clear();
    return built;
  };
  if (ownDialog) {
    if (ctx.character?.onRunEnd) {
      try {
        cleanups.push(ctx.character.onRunEnd((report) => {
          const built = recap(report);
          if (built) void openRecapDialog(ctx, built, report.name);
        }));
      } catch (error) {
        ctx.log(`death recap: run end unavailable (${String(error)})`);
      }
    } else ctx.log("death recap: this game does not report the end of a run");
  }
  return { recap, cleanup: () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  } };
}

// src/menus/graveyard.ts
var GRAVEYARD_KEY = "graveyard";
var MAX_RECORDS = 20;
var MAX_ARCHIVE_SIZE = 6e5;
function runId(report) {
  return `${report.endedAt}-${report.key ?? report.name}`;
}
function validRecord(value2) {
  if (!value2 || typeof value2 !== "object") return false;
  const record2 = value2;
  const report = record2.report;
  return typeof record2.id === "string" && !!report && typeof report === "object" && typeof report.name === "string" && typeof report.outcome === "string" && typeof report.endedAt === "number" && Array.isArray(report.history) && Array.isArray(report.messages) && Array.isArray(report.belongings) && !!report.birth && typeof report.birth === "object" && (record2.journal === null || Array.isArray(record2.journal));
}
function prefsRoot(prefs) {
  let raw;
  try {
    raw = prefs?.get();
  } catch {
    raw = null;
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function readArchive(prefs) {
  const stored = prefsRoot(prefs)[GRAVEYARD_KEY];
  const list = stored && typeof stored === "object" && Array.isArray(stored.records) ? stored.records : [];
  const records = [];
  const unreadable = [];
  for (const entry2 of list) (validRecord(entry2) ? records : unreadable).push(entry2);
  records.sort((a, b) => b.report.endedAt - a.report.endedAt);
  return { records, unreadable };
}
function compact(record2, step) {
  const report = { ...record2.report, belongings: record2.report.belongings.map((item) => ({ ...item, recall: null })) };
  return { ...record2, report: step > 1 ? { ...report, sheet: null } : report };
}
function trimArchive(records, unreadable = []) {
  const kept = [...records].sort((a, b) => b.report.endedAt - a.report.endedAt).slice(0, MAX_RECORDS);
  const size = () => JSON.stringify([...kept, ...unreadable]).length;
  while (kept.length > 1 && size() > MAX_ARCHIVE_SIZE) kept.pop();
  for (let step = 1; step <= 2 && kept.length === 1 && size() > MAX_ARCHIVE_SIZE; step += 1) kept[0] = compact(kept[0], step);
  return kept;
}
function archiveRun(prefs, record2) {
  if (!prefs) return false;
  try {
    const { records, unreadable } = readArchive(prefs);
    const merged = records.some((existing) => existing.id === record2.id) ? records : [record2, ...records];
    const root = prefsRoot(prefs);
    prefs.set({ ...root, [GRAVEYARD_KEY]: { v: 1, records: [...trimArchive(merged, unreadable), ...unreadable] } });
    return readArchive(prefs).records.some((existing) => existing.id === record2.id);
  } catch {
    return false;
  }
}
function recordFor(report, store, recap) {
  const journal = [...journalFromHistory(report.history, readDepthMarks(store)), endingEntry(report)];
  return recap ? { id: runId(report), report, journal, recap } : { id: runId(report), report, journal };
}
var UNREADABLE = "Some run records could not be read. They have been left untouched.";
var NOT_ARCHIVED = "This run could not be added to the graveyard. Its summary is still available here.";
var CSS8 = `${JOURNAL_CSS}
${RECAP_CSS}
.graveyard-head{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.runs button{background:none;border:none;padding:0;text-align:left;width:100%}
.runs button:focus-visible{outline:2px solid var(--anyband-accent)}
.verdict{color:#e6ad59;letter-spacing:.1em}
.name{font-size:1.5em;margin:2px 0}
.moments p:first-child{color:#ffa673}
.split{display:grid;grid-template-columns:1.7fr 1fr;gap:10px}
.belongings button{background:none;border:none;padding:0;text-align:left}
.belongings tr[aria-selected="true"] td{background:rgba(128,128,128,.18)}
.inspection{white-space:pre-wrap}`;
function verdict(report) {
  return report.outcome === "winner" ? "VICTORY" : report.outcome === "retired" ? "RETIRED" : "GAME OVER";
}
function runLabel(report) {
  return `${report.name || "Unnamed"} - ${report.race} ${report.cls}`;
}
var POST_MORTEM_PAGES = ["Final moments", "Journal", "Final belongings", "Character sheet"];
function postMortemPages(record2) {
  return readRecap(record2.recap) ? ["Recap", ...POST_MORTEM_PAGES] : [...POST_MORTEM_PAGES];
}
function locationLabel(location2) {
  return location2 ? location2[0].toUpperCase() + location2.slice(1) : "";
}
function openPostMortem(ctx, record2, options) {
  const dialog = openDialog(ctx, { id: "post-mortem", label: `${record2.report.name || "Unnamed"}: post-mortem`, className: "wide", css: CSS8 });
  if (!dialog) return Promise.resolve();
  const report = record2.report;
  const body = dialog.body;
  el9(body, "div", verdict(report), "verdict");
  el9(body, "div", report.name || "Unnamed", "name");
  el9(body, "p", `${report.race} ${report.cls}  |  Level ${report.level}  |  ${formatWhen(report.endedAt)}`);
  el9(body, "p", report.outcome === "death" ? `Killed by ${report.cause}` : report.cause);
  const metrics = el9(body, "div", void 0, "metrics");
  metric(metrics, "Deepest", `${report.maxDepth} (${report.maxDepth * 50} ft)`);
  metric(metrics, "Turns", String(report.turn));
  metric(metrics, "Score", String(report.score), "Angband's calculated points. High-score eligibility remains governed by the engine.");
  metric(metrics, "Gold", String(report.gold));
  const archiveRow = el9(body, "div");
  let notArchived = options.notArchived === true && !options.archived;
  const drawArchive = () => {
    archiveRow.replaceChildren();
    if (!notArchived) return;
    el9(archiveRow, "p", NOT_ARCHIVED, "error");
    button5(archiveRow, "Retry archiving", () => {
      notArchived = !archiveRun(ctx.prefs, record2);
      drawArchive();
    }, "retry");
  };
  drawArchive();
  const tabs = el9(body, "div", void 0, "tabs");
  tabs.setAttribute("role", "tablist");
  const page = el9(body, "div");
  const tabButtons = [];
  let sheetPage = 0;
  const journalFilter = newJournalFilter();
  const pages = postMortemPages(record2);
  const recap = readRecap(record2.recap);
  const show = (index, moveFocus = false) => {
    tabButtons.forEach((tab, at) => tab.setAttribute("aria-selected", String(at === index)));
    if (moveFocus) tabButtons[index]?.focus();
    page.replaceChildren();
    const name = pages[index];
    if (name === "Recap" && recap) {
      renderRecap(page, recap);
    } else if (name === "Final moments") {
      const moments = el9(page, "div", void 0, "moments");
      const messages = [...report.messages].reverse();
      if (!messages.length) el9(moments, "p", "No messages were recorded.", "muted");
      for (const message of messages) el9(moments, "p", message.count > 1 ? `${message.text} (x${message.count})` : message.text);
    } else if (name === "Journal") {
      createJournalView(page, journalFilter, "post-mortem-journal").update(record2.journal);
    } else if (name === "Final belongings") {
      drawBelongings(page, report, dialog.root);
    } else {
      const sheet = el9(page, "div");
      const draw = () => {
        sheet.replaceChildren();
        renderCharacterSheet(sheet, report.sheet, sheetPage, (next, focus) => {
          sheetPage = next;
          draw();
          if (focus) sheet.querySelector(`[data-focus="sheet-page-${(SHEET_PAGES[next] ?? "Overview").toLowerCase()}"]`)?.focus();
        });
      };
      draw();
    }
  };
  pages.forEach((name, index) => {
    const tab = button5(tabs, name, () => show(index), `post-mortem-tab-${index}`);
    tab.setAttribute("role", "tab");
    tabButtons.push(tab);
  });
  tabs.addEventListener("keydown", (event) => {
    const next = stepFocus(tabButtons, dialog.root.activeElement, event.key, "horizontal");
    if (next === null) return;
    event.preventDefault();
    show(next, true);
  });
  const actions = el9(body, "div", void 0, "actions");
  const leave = button5(actions, options.archived ? "Back to graveyard" : "Close", () => dialog.close(), "leave");
  const status = el9(body, "p", "", "muted");
  if (ctx.saves?.create) {
    const create = ctx.saves.create.bind(ctx.saves);
    button5(actions, options.archived ? "New character like this" : "Play Again", () => {
      void create({ like: report.birth }).then((result) => {
        if (!result.ok) status.textContent = result.reason;
      });
    }, "play-again");
  }
  show(0);
  leave.focus();
  return dialog.closed;
}
function drawBelongings(parent, report, root) {
  const split = el9(parent, "div", void 0, "split");
  const listSide = el9(split, "div");
  const inspection = el9(split, "div", "Select an item to inspect its final, identified properties.", "inspection");
  if (!report.belongings.length) {
    el9(listSide, "p", "No belongings were recorded.", "muted");
    return;
  }
  const table = el9(listSide, "table", void 0, "belongings");
  const head = el9(el9(table, "thead"), "tr");
  for (const name of ["Name", "Location", "Qty"]) el9(head, "th", name);
  const rows = el9(table, "tbody");
  const buttons = [];
  const trs = [];
  const select = (index) => {
    const item = report.belongings[index];
    if (!item) return;
    trs.forEach((tr, at) => tr.setAttribute("aria-selected", String(at === index)));
    inspection.replaceChildren();
    if (!item.recall) {
      el9(inspection, "p", "No description was recorded for this item.", "muted");
      return;
    }
    el9(inspection, "h3", item.recall.title);
    el9(inspection, "p", item.recall.text);
  };
  report.belongings.forEach((item, index) => {
    const tr = el9(rows, "tr");
    trs.push(tr);
    const name = button5(el9(tr, "td"), item.name, () => select(index), `belonging-${index}`);
    name.style.color = item.color;
    buttons.push(name);
    el9(tr, "td", locationLabel(item.location));
    el9(tr, "td", String(item.quantity));
  });
  table.addEventListener("keydown", (event) => {
    const next = stepFocus(buttons, root.activeElement, event.key);
    if (next === null) return;
    event.preventDefault();
    select(next);
  });
}
function openGraveyard(ctx, backLabel = "Back to characters") {
  const dialog = openDialog(ctx, { id: "graveyard", label: "Graveyard", className: "wide", css: CSS8 });
  if (!dialog) return Promise.resolve();
  const body = dialog.body;
  el9(body, "h2", "Graveyard");
  const head = el9(body, "div", void 0, "graveyard-head");
  const back = button5(head, backLabel, () => dialog.close(), "back");
  const search = el9(head, "input");
  search.type = "search";
  search.placeholder = "Search characters";
  search.setAttribute("aria-label", "Search characters");
  search.dataset["focus"] = "search";
  const { records, unreadable } = readArchive(ctx.prefs);
  if (unreadable.length) el9(body, "p", UNREADABLE, "error");
  const list = el9(body, "div");
  let rowButtons = [];
  const draw = () => {
    list.replaceChildren();
    rowButtons = [];
    if (!records.length) {
      el9(list, "p", "Your completed runs will appear here.", "muted");
      return;
    }
    const shown = records.filter((record2) => matches2(`${runLabel(record2.report)} ${record2.report.cause}`, search.value));
    if (!shown.length) {
      el9(list, "p", "No matching runs.", "muted");
      return;
    }
    const table = el9(list, "table", void 0, "runs");
    const header = el9(el9(table, "thead"), "tr");
    for (const name of ["Character", "Outcome", "Depth", "Ended"]) el9(header, "th", name);
    const rows = el9(table, "tbody");
    for (const record2 of shown) {
      const tr = el9(rows, "tr");
      rowButtons.push(button5(el9(tr, "td"), runLabel(record2.report), () => {
        void openPostMortem(ctx, record2, { archived: true });
      }, `run-${record2.id}`));
      el9(tr, "td", record2.report.outcome === "death" ? record2.report.cause : endingText(record2.report));
      el9(tr, "td", String(record2.report.maxDepth));
      el9(tr, "td", formatWhen(record2.report.endedAt));
    }
  };
  search.addEventListener("input", draw);
  list.addEventListener("keydown", (event) => {
    if (stepFocus(rowButtons, dialog.root.activeElement, event.key) !== null) event.preventDefault();
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && rowButtons.length) {
      event.preventDefault();
      rowButtons[0].focus();
    }
  });
  draw();
  (rowButtons[0] ?? back).focus();
  return dialog.closed;
}
function installGraveyard(ctx, recapFor) {
  if (ctx.flags?.["anybandui.graveyard"] !== true) return () => {
  };
  const cleanups = [];
  const character = ctx.character;
  if (character?.onRunEnd) {
    try {
      cleanups.push(character.onRunEnd((report) => {
        let recap = null;
        try {
          recap = recapFor?.(report) ?? null;
        } catch (error) {
          ctx.log(`graveyard: death recap failed (${String(error)})`);
        }
        const record2 = recordFor(report, ctx.characterStore, recap);
        const stored = archiveRun(ctx.prefs, record2);
        void openPostMortem(ctx, record2, { archived: false, notArchived: !stored });
      }));
    } catch (error) {
      ctx.log(`graveyard: run end unavailable (${String(error)})`);
    }
  } else ctx.log("graveyard: this game does not report the end of a run");
  try {
    const ended = character?.runReport?.() ?? null;
    if (ended && !readArchive(ctx.prefs).records.some((record2) => record2.id === runId(ended))) archiveRun(ctx.prefs, recordFor(ended, ctx.characterStore));
  } catch {
  }
  if (ctx.title) {
    try {
      cleanups.push(ctx.title.registerRow({ label: "Graveyard", run: () => openGraveyard(ctx, "Back to title") }));
    } catch (error) {
      ctx.log(`graveyard: title row refused (${String(error)})`);
    }
  }
  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}

// src/menus/hall-of-fame.ts
var HALL_OF_FAME_ID = "core:hall-of-fame";
var HEADINGS = {
  rank: "#",
  points: "Points",
  who: "Name",
  race: "Race",
  class: "Class",
  level: "Level",
  depth: "Depth",
  how: "How it ended",
  date: "Date",
  gold: "Gold",
  turns: "Turns"
};
var CSS9 = `.scores td.num,.scores th.num{text-align:right}
.scores tr.you td{color:var(--anyband-accent);font-weight:bold}`;
function cellText(cell2) {
  if (!cell2) return "";
  const current = cell2.values?.["current"], max = cell2.values?.["max"];
  if (typeof current === "number" && typeof max === "number" && max > current) return `${current} (max ${max})`;
  return cell2.text;
}
function hallOfFamePart(ctx) {
  if (ctx.flags?.["anybandui.hallOfFame"] !== true) return null;
  return {
    show(view) {
      if (view.id !== HALL_OF_FAME_ID) return void 0;
      const table = view.blocks.find((block2) => block2.kind === "table" && block2.key === "scores");
      if (!table) return void 0;
      const dialog = openDialog(ctx, { id: "hall-of-fame", label: "Hall of Fame", className: "wide", css: CSS9 });
      if (!dialog) return void 0;
      const body = dialog.body;
      el9(body, "h2", view.title);
      const columns = table.columns.filter((column) => column.key !== "uid");
      if (!table.rows.length) el9(body, "p", table.empty?.text ?? "No scores yet.", "muted");
      else {
        const grid = el9(body, "table", void 0, "scores");
        const head = el9(el9(grid, "thead"), "tr");
        for (const column of columns) el9(head, "th", column.label ?? HEADINGS[column.key] ?? column.key, column.align === "right" ? "num" : void 0);
        const rows = el9(grid, "tbody");
        for (const row of table.rows) {
          const you = row.values?.["highlighted"] === 1;
          const tr = el9(rows, "tr", void 0, you ? "you" : void 0);
          if (you) tr.setAttribute("aria-current", "true");
          for (const column of columns) el9(tr, "td", cellText(row.cells[column.key]), column.align === "right" ? "num" : void 0);
        }
      }
      const actions = el9(body, "div", void 0, "actions");
      const close = button5(actions, "Close", () => dialog.close(), "close");
      body.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          body.scrollTop += event.key === "ArrowDown" ? 40 : -40;
        } else if (event.key === "Escape") {
          event.preventDefault();
          dialog.close();
        }
      });
      close.focus();
      return { dismissed: dialog.closed.then(() => void 0) };
    }
  };
}

// src/menus/presenters.ts
function composeMenus(parts, log) {
  const live = parts.filter((part) => part !== null);
  if (!live.length) return void 0;
  return {
    ask(question) {
      for (const part of live) {
        try {
          const answer = part.ask(question);
          if (answer !== void 0) return answer;
        } catch (error) {
          log(`menus: ${question.id} declined after an error (${String(error)})`);
          return void 0;
        }
      }
      return void 0;
    }
  };
}
function composeScreens(parts, log) {
  const live = parts.filter((part) => part !== null);
  if (!live.length) return void 0;
  return {
    show(view, host) {
      for (const part of live) {
        try {
          const shown = part.show(view, host);
          if (shown !== void 0) return shown;
        } catch (error) {
          log(`screens: ${view.id} declined after an error (${String(error)})`);
          return void 0;
        }
      }
      return void 0;
    }
  };
}

// src/menus/save-dialogs.ts
var NAME_LIMIT = 15;
function nameProblem(entered) {
  const name = entered.trim();
  if (!name) return "Enter a name.";
  if (name.length > NAME_LIMIT) return `Use ${NAME_LIMIT} characters or fewer.`;
  return null;
}
function askRename(ctx, current) {
  const dialog = openDialog(ctx, { id: "rename-save", label: "Rename save" });
  if (!dialog) return Promise.resolve(null);
  return new Promise((resolve2) => {
    let done = false;
    const finish = (value2) => {
      if (done) return;
      done = true;
      dialog.close();
      resolve2(value2);
    };
    void dialog.closed.then(() => finish(null));
    el9(dialog.body, "h2", "Rename save");
    el9(dialog.body, "p", `Rename ${current}`);
    const label2 = el9(dialog.body, "label", "Save name ");
    const input = el9(label2, "input");
    input.type = "text";
    input.value = current;
    input.maxLength = 40;
    input.dataset["focus"] = "name";
    const problem = el9(dialog.body, "p", "", "muted");
    const row = el9(dialog.body, "div", void 0, "actions");
    const submit = () => {
      if (nameProblem(input.value) === null) finish(input.value.trim());
    };
    const rename = button5(row, "Rename", submit, "rename");
    const cancel = button5(row, "Cancel", () => finish(null), "cancel");
    const check = () => {
      const why = nameProblem(input.value);
      problem.textContent = why ?? "";
      rename.disabled = why !== null;
    };
    input.addEventListener("input", check);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
    row.addEventListener("keydown", (event) => {
      if (stepFocus([rename, cancel], dialog.root.activeElement, event.key, "horizontal") !== null) event.preventDefault();
    });
    dialog.body.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    });
    check();
    input.focus();
    input.select?.();
  });
}
function confirmDeleteSave(ctx, name) {
  return confirm(ctx, { title: "Delete save", message: `Permanently delete ${name}?`, detail: "This cannot be undone.", yes: "Delete save", no: "Cancel", danger: true });
}

// src/menus/save-cards.ts
var CHARACTER_SELECT_ID = "core:character-select";
function hsvToRgb(h, s, v) {
  if (s === 0) return [v, v, v];
  const scaled = h % 1 / (60 / 360);
  const i = Math.floor(scaled), f = scaled - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}
function accentColour(id, light) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(id)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2146121005) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2221713035) >>> 0;
  hash ^= hash >>> 16;
  hash >>>= 0;
  const hue = (hash & 16777215) / 16777216;
  const scale = light ? 0.52 : 1;
  const channels = hsvToRgb(hue, 55 / 183, 183 / 255).map((value2) => Math.round(Math.min(1, Math.max(0, value2 * scale)) * 255));
  return `#${channels.map((value2) => value2.toString(16).padStart(2, "0")).join("")}`;
}
function statusLine(entry2) {
  const where = entry2.dead ? "DEAD" : entry2.depth === 0 ? "IN TOWN" : `DEPTH ${entry2.depth}`;
  return `${where}    /    LEVEL ${entry2.level}`;
}
function identity(entry2) {
  return `${entry2.race} ${entry2.cls}`.trim();
}
var CSS10 = `.roster{display:grid;grid-template-columns:minmax(220px,.42fr) minmax(260px,.58fr);gap:12px}
@media (max-width:640px){.roster{grid-template-columns:1fr}}
.cards{display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto;margin:6px 0}
.card{display:grid;grid-template-columns:2.4em 1fr;align-items:center;text-align:left;padding:6px 8px;border-radius:4px;background:var(--anyband-background)}
.card .at{font-size:1.8em;text-align:center}
.card .who{font-size:1.15em;display:block}
.card .identity{display:block;opacity:.65}
.card .status{display:block;font-size:.85em;letter-spacing:.04em}
.roster-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.roster-actions button{padding:10px 6px}
.profile .emblem{font-size:3em;line-height:1.2}
.profile .who{font-size:1.8em;margin:0}
.label{opacity:.65;font-size:.85em;text-transform:uppercase;margin-top:8px}
.primary{width:100%;padding:8px;margin-top:10px}
.search{width:100%;box-sizing:border-box}`;
function saveCardsPart(ctx) {
  if (ctx.flags?.["anybandui.saveCards"] !== true) return null;
  return {
    ask(question) {
      if (question.id !== CHARACTER_SELECT_ID || !ctx.saves || !ctx.ui?.openPanel) return void 0;
      return runRoster(ctx, ctx.saves, question);
    }
  };
}
async function runRoster(ctx, saves, question) {
  let listed;
  try {
    listed = await saves.list();
  } catch {
    return void 0;
  }
  if (!listed.ok) {
    ctx.log(`save cards: ${listed.reason}`);
    return void 0;
  }
  const questionIds = listed.entries.map((entry2) => entry2.id);
  const commands = new Set(question.commands.filter((command) => !command.ctrl).map((command) => command.key));
  const light = themeFromPrefs(ctx.prefs?.get()).light_styling;
  let entries = listed.entries;
  let selected = entries[0]?.id ?? null;
  let search = "";
  let status = "";
  let busy = false;
  let dialog = null;
  return new Promise((resolve2) => {
    let settled = false;
    const answer = (value2) => {
      if (settled) return;
      settled = true;
      dialog?.close();
      resolve2(value2);
    };
    const refresh = async () => {
      try {
        const next = await saves.list();
        if (next.ok) entries = next.entries;
      } catch {
      }
      if (!entries.some((entry2) => entry2.id === selected)) selected = entries[0]?.id ?? null;
    };
    const chosen = () => entries.find((entry2) => entry2.id === selected);
    const run2 = async (work) => {
      if (busy) return;
      busy = true;
      draw();
      try {
        await work();
      } finally {
        busy = false;
        if (dialog?.isOpen()) draw();
      }
    };
    const report = (result, done) => {
      status = result.ok ? done : result.reason;
    };
    const play = (entry2) => {
      if (entry2.dead) {
        if (!saves.create) return;
        const create = saves.create.bind(saves);
        void run2(async () => {
          status = "Starting a new character...";
          const result = await create({ like: { race: entry2.race, cls: entry2.cls, name: entry2.name } });
          if (!result.ok) status = result.reason;
        });
        return;
      }
      void run2(async () => {
        status = "Loading...";
        const result = await saves.load(entry2.id);
        if (!result.ok) status = result.reason;
      });
    };
    const newCharacter = () => {
      if (!saves.create) {
        const row = question.choices[question.choices.length - 1];
        if (row) answer({ kind: "choose", choice: row.id });
        return;
      }
      const create = saves.create.bind(saves);
      void run2(async () => {
        status = "Starting a new character...";
        const result = await create();
        if (!result.ok) status = result.reason;
      });
    };
    const rename = (entry2) => {
      void run2(async () => {
        const name = await askRename(ctx, entry2.name);
        if (name === null || name === entry2.name) return;
        report(await saves.rename(entry2.id, name), `Renamed to ${name}.`);
        await refresh();
      }).then(() => focus("rename"));
    };
    const remove = (entry2) => {
      void run2(async () => {
        const who = entry2.name || "this character";
        if (!await confirmDeleteSave(ctx, who)) return;
        dialog?.close();
        const result = await saves.delete(entry2.id);
        report(result, `${who} was deleted.`);
        await refresh();
        if (!open()) answer({ kind: "cancel" });
      }).then(() => focus(selected ? `card-${selected}` : "new"));
    };
    const graveyard = () => {
      const show = ctx.graveyard;
      if (!show) return;
      void run2(show).then(() => focus("graveyard"));
    };
    const command = (key, cursor) => answer({ kind: "command", key, cursor });
    const focus = (key) => {
      const target = dialog?.body.querySelector(`[data-focus="${key}"]`);
      target?.focus();
    };
    let cards = null;
    let profile = null;
    let statusLineNode = null;
    let extras = null;
    let cardButtons = [];
    const drawCards = () => {
      if (!cards) return;
      cards.replaceChildren();
      cardButtons = [];
      const shown = entries.filter((entry2) => matches2(`${entry2.name} ${entry2.id} ${identity(entry2)}`, search));
      if (!shown.length) {
        el9(cards, "p", "No matching characters.", "muted");
        return;
      }
      for (const entry2 of shown) {
        const ink2 = accentColour(entry2.id, light);
        const card = button5(cards, "", () => {
          selected = entry2.id;
          draw();
          focus(`card-${entry2.id}`);
        }, `card-${entry2.id}`);
        card.className = "card";
        card.style.borderColor = entry2.id === selected ? ink2 : "";
        card.setAttribute("aria-pressed", String(entry2.id === selected));
        card.setAttribute("aria-label", `${entry2.name}, ${identity(entry2)}, ${statusLine(entry2).replace(/\s+\/\s+/, ", ").toLowerCase()}`);
        const at = el9(card, "span", "@", "at");
        at.style.color = ink2;
        const text = el9(card, "span");
        el9(text, "span", entry2.name || "Unnamed", "who");
        el9(text, "span", identity(entry2), "identity");
        el9(text, "span", statusLine(entry2), "status").style.color = ink2;
        cardButtons.push(card);
      }
    };
    const drawProfile = () => {
      if (!profile) return;
      profile.replaceChildren();
      const entry2 = chosen();
      if (!entry2) return;
      const ink2 = accentColour(entry2.id, light);
      el9(profile, "div", "@", "emblem").style.color = ink2;
      el9(profile, "p", entry2.name || "Unnamed", "who");
      el9(profile, "p", identity(entry2) || "Character details unavailable.");
      el9(profile, "h3", entry2.dead ? "Final character" : "Character summary");
      const metrics = el9(profile, "div", void 0, "metrics");
      metric(metrics, "Level", String(entry2.level));
      metric(metrics, "Depth", entry2.depth === 0 ? "Town" : String(entry2.depth));
      el9(profile, "div", "LAST SAVED", "label");
      el9(profile, "p", formatWhen(entry2.lastPlayed));
      const primary = button5(profile, entry2.dead ? "Play Again" : "Continue", () => play(entry2), "primary");
      primary.className = "primary";
      primary.disabled = busy || entry2.dead && !saves.create;
      const row = el9(profile, "div", void 0, "actions");
      const renameButton = button5(row, "Rename", () => rename(entry2), "rename");
      renameButton.disabled = busy || entry2.dead;
      button5(row, "Delete", () => remove(entry2), "delete").disabled = busy;
    };
    const drawExtras = () => {
      if (!extras) return;
      extras.replaceChildren();
      const entry2 = chosen();
      const cursor = entry2 ? questionIds.indexOf(entry2.id) : -1;
      if (commands.has("X")) {
        const exportButton = button5(extras, "Export character", () => command("X", cursor), "export");
        exportButton.disabled = busy || !entry2 || entry2.dead || cursor < 0;
      }
      if (commands.has("M")) button5(extras, "Import character", () => command("M", Math.max(0, Math.min(cursor, questionIds.length))), "import").disabled = busy;
      if (commands.has("W")) button5(extras, "Storage", () => command("W", Math.max(0, Math.min(cursor, questionIds.length))), "storage").disabled = busy;
    };
    function draw() {
      drawCards();
      drawProfile();
      drawExtras();
      if (statusLineNode) statusLineNode.textContent = status;
    }
    function build(target) {
      const body = target.body;
      el9(body, "h2", question.title || "Select a character");
      if (question.subtitle) el9(body, "p", question.subtitle, "muted");
      const layout = el9(body, "div", void 0, "roster");
      const left = el9(layout, "div");
      if (entries.length) {
        const input = el9(left, "input", void 0, "search");
        input.type = "search";
        input.placeholder = "Find a character";
        input.setAttribute("aria-label", "Find a character");
        input.dataset["focus"] = "search";
        input.value = search;
        input.addEventListener("input", () => {
          search = input.value;
          drawCards();
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "ArrowDown" && cardButtons.length) {
            event.preventDefault();
            cardButtons[0].focus();
          }
        });
      }
      cards = el9(left, "div", void 0, "cards");
      if (!entries.length) el9(left, "p", "No saved characters.", "muted");
      cards.addEventListener("keydown", (event) => {
        const at = cardButtons.indexOf(target.root.activeElement);
        if (event.key === "Enter" && at >= 0) {
          event.preventDefault();
          const entry2 = entries.find((candidate) => `card-${candidate.id}` === cardButtons[at].dataset["focus"]);
          if (entry2 && !busy) {
            selected = entry2.id;
            play(entry2);
          }
          return;
        }
        if (event.key === "Delete" && at >= 0) {
          event.preventDefault();
          const entry2 = chosen();
          if (entry2) remove(entry2);
          return;
        }
        const next = stepFocus(cardButtons, target.root.activeElement, event.key);
        if (next === null) return;
        event.preventDefault();
        const id = cardButtons[next]?.dataset["focus"]?.slice(5);
        if (id) {
          selected = id;
          draw();
          focus(`card-${id}`);
        }
      });
      const rosterActions = el9(left, "div", void 0, "roster-actions");
      if (ctx.graveyard) button5(rosterActions, "Graveyard", graveyard, "graveyard");
      button5(rosterActions, "New character", newCharacter, "new");
      profile = el9(layout, "div", void 0, "profile");
      extras = el9(body, "div", void 0, "actions");
      statusLineNode = el9(body, "p", "", "muted");
      statusLineNode.setAttribute("role", "status");
      draw();
    }
    function open() {
      const next = openDialog(ctx, { id: "character-select", label: "Select a character", className: "wide", css: CSS10 });
      dialog = next;
      if (!next) return false;
      void next.closed.then(() => {
        if (next.dismissedByPlayer()) answer({ kind: "cancel" });
      });
      build(next);
      return true;
    }
    if (!open()) {
      settled = true;
      resolve2(void 0);
      return;
    }
    focus(selected ? `card-${selected}` : "new");
  });
}

// src/menus/menus.ts
function installMenus(ctx) {
  const flags = ctx.flags ?? {};
  const cleanups = [];
  cleanups.push(installYesNoPrompts(ctx));
  const graveyard = flags["anybandui.graveyard"] === true;
  if (flags["anybandui.runJournal"] === true || graveyard || flags["anybandui.deathRecap"] === true) cleanups.push(installDepthRecorder(ctx));
  cleanups.push(installRunJournal(ctx));
  const recap = installDeathRecap(ctx, !graveyard);
  cleanups.push(recap.cleanup);
  cleanups.push(installGraveyard(ctx, recap.recap));
  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}
function menuPresenter(ctx) {
  const graveyard = ctx.flags?.["anybandui.graveyard"] === true ? () => openGraveyard(ctx) : void 0;
  return composeMenus([saveCardsPart({ ...ctx, graveyard })], ctx.log);
}
function screenPresenter(ctx) {
  return composeScreens([hallOfFamePart(ctx)], ctx.log);
}

// src/menus/birth-model.ts
var WIZARD_STEPS = ["race", "class", "attributes", "identity", "review"];
var STEP_LABELS = {
  previous: "Play again",
  race: "Race",
  class: "Class",
  attributes: "Attributes",
  identity: "Identity",
  review: "Review"
};
function stepNumber(step) {
  return WIZARD_STEPS.indexOf(step) + 1;
}
function nextStep(step) {
  if (step === "previous") return "identity";
  const index = WIZARD_STEPS.indexOf(step);
  return WIZARD_STEPS[index + 1] ?? null;
}
function signed(value2) {
  return value2 >= 0 ? `+${value2}` : String(value2);
}
var SKILL_LABELS = {
  DISARM_PHYS: "Disarm (physical)",
  DISARM_MAGIC: "Disarm (magic)",
  DEVICE: "Magic devices",
  SAVE: "Saving throw",
  STEALTH: "Stealth",
  SEARCH: "Searching",
  TO_HIT_MELEE: "Melee",
  TO_HIT_BOW: "Shooting",
  TO_HIT_THROW: "Throwing",
  DIGGING: "Digging"
};
function skillLabel(key) {
  const known = SKILL_LABELS[key];
  if (known) return known;
  const words = key.toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? `${words[0].toUpperCase()}${words.slice(1)}` : key;
}
function choiceView(entry2, race = null) {
  const added = "magic" in entry2 ? race : null;
  const note = added ? { note: "Includes your race." } : {};
  const traits = [
    { label: "Hit die", value: String(entry2.hitDie + (added?.hitDie ?? 0)), ...note },
    { label: "XP modifier", value: `${entry2.expFactor + (added?.expFactor ?? 0)}%`, ...note }
  ];
  if ("infravisionFeet" in entry2) traits.push({ label: "Infravision", value: `${entry2.infravisionFeet} ft` });
  if ("magic" in entry2) {
    const casts = entry2.magic.length > 0;
    traits.push({ label: "Magic", value: casts ? "Yes" : "No", note: casts ? `Can learn spells: ${entry2.magic.join(", ")}.` : "Does not cast spells." });
  }
  return {
    name: entry2.name,
    modifiers: [...entry2.statAdj],
    traits,
    abilities: entry2.abilities.map((ability) => ({ name: ability.name, description: ability.description })),
    skills: Object.entries(entry2.skills).map(([key, value2]) => ({ label: skillLabel(key), value: signed(value2) }))
  };
}
function formatStat(value2) {
  if (value2 <= 18) return String(value2);
  const bonus = value2 - 18;
  return bonus >= 220 ? "18/***" : `18/${String(bonus).padStart(2, "0")}`;
}
function statRows(draft, catalogue) {
  return catalogue.stats.map((name, index) => {
    const preview = draft.preview?.stats[index];
    const natural = draft.stats[index] ?? 0;
    const spent = draft.pointsSpent[index] ?? 0;
    const cost = draft.statCosts[index];
    return {
      index,
      name,
      base: preview?.natural.trim() || formatStat(natural),
      race: preview?.raceBonus.trim() || "-",
      cls: preview?.classBonus.trim() || "-",
      total: preview?.best.trim() || "-",
      spent,
      buyCost: cost?.buyCost ?? null,
      sellRefund: cost?.sellRefund ?? null,
      canBuy: cost?.canBuy ?? false,
      canSell: cost?.canSell ?? false,
      atMaximum: natural >= 18
    };
  });
}
function maximum(value2) {
  if (!value2) return "-";
  const slash = value2.lastIndexOf("/");
  return (slash >= 0 ? value2.slice(slash + 1) : value2).trim() || "-";
}
function previewSummary(draft) {
  const lines = draft.preview?.panels.flatMap((panel) => panel.lines) ?? [];
  const find = (label2) => lines.find((line) => line.label.trim() === label2)?.value;
  return { hp: maximum(find("HP")), sp: maximum(find("SP")), gold: draft.preview ? draft.preview.gold : null };
}
function stepChoice(names, current, key) {
  if (!names.length) return null;
  const index = current === null ? -1 : names.indexOf(current);
  if (key === "Home") return names[0];
  if (key === "End") return names[names.length - 1];
  if (key === "ArrowDown") return names[Math.min(names.length - 1, index + 1)];
  if (key === "ArrowUp") return names[Math.max(0, index - 1)];
  return null;
}
function statKey(key) {
  if (key === "ArrowRight" || key === "+" || key === "=") return "buy";
  if (key === "ArrowLeft" || key === "-" || key === "_") return "sell";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
}
var BirthWizard = class {
  constructor(session) {
    this.session = session;
    this.catalogue = session.catalogue();
  }
  session;
  catalogue;
  /** The last refusal, shown under the step as upstream shows menu_error (:202). */
  error = "";
  cached = null;
  /** Something other than the name, background or options changed after the previous character was applied. */
  changedSincePrevious = true;
  finished = false;
  draft() {
    if (!this.cached) this.cached = this.session.draft();
    return this.cached;
  }
  /** Run one session change, keep its refusal, and read the draft again. */
  run(change, build = true) {
    if (this.finished) return false;
    let result;
    try {
      result = change(this.session);
    } catch (error) {
      result = { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    this.cached = null;
    this.error = result.ok ? "" : result.reason;
    if (result.ok && build) this.changedSincePrevious = true;
    return result.ok;
  }
  /** Upstream's engine always has a race and a class picked; Core starts with neither, so the first of each is chosen. */
  start() {
    const draft = this.draft();
    const race = this.catalogue.races[0]?.name;
    const cls = this.catalogue.classes[0]?.name;
    if (draft.race === null && race !== void 0) this.run((s) => s.chooseRace(race));
    if (this.draft().cls === null && cls !== void 0) this.run((s) => s.chooseClass(cls));
  }
  /** The previous character's race, class and stats (Core's quick start), unless they are already in the draft. */
  usePrevious() {
    if (!this.catalogue.previous) return false;
    if (!this.changedSincePrevious) return true;
    const ok = this.run((s) => s.usePrevious());
    if (ok) this.changedSincePrevious = false;
    return ok;
  }
  accept() {
    const ok = this.run((s) => s.accept(), false);
    if (ok) this.finished = true;
    return ok;
  }
  cancel() {
    if (this.finished) return;
    this.finished = true;
    try {
      this.session.cancel();
    } catch {
    }
  }
};

// src/menus/birth.ts
var BIRTH_FLAG = "anybandui.birthWizard";
var CSS11 = `:host{color:var(--anyband-text);font:var(--anyband-font-size)/var(--anyband-line) var(--anyband-font)}
.backdrop{position:absolute;inset:0;overflow:auto;background:var(--anyband-background);padding:16px;box-sizing:border-box}
.birth{max-width:1100px;margin:0 auto;padding:12px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding)}
h2,h3,h4{margin:6px 0;color:var(--anyband-accent)}h4{font-size:1em}
button,input,textarea{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}
button{cursor:pointer}button:disabled,button[aria-disabled="true"]{opacity:.45;cursor:default}
button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible,li:focus-visible{outline:2px solid var(--anyband-accent)}
.progress{height:4px;background:var(--anyband-background);border-radius:2px;margin:4px 0 10px}.progress>div{height:100%;background:var(--anyband-accent);border-radius:2px}
.layout{display:grid;grid-template-columns:minmax(0,62fr) minmax(0,38fr);gap:14px}
@media (max-width:760px){.layout{grid-template-columns:minmax(0,1fr)}}
.preview{border-left:1px solid var(--anyband-accent);padding-left:12px}
@media (max-width:760px){.preview{border-left:0;padding-left:0;border-top:1px solid var(--anyband-accent)}}
ul.choices{list-style:none;margin:0 0 8px;padding:0;max-height:220px;overflow:auto;border:1px solid var(--anyband-accent);border-radius:3px}
ul.choices li{padding:3px 8px;cursor:pointer}ul.choices li[aria-selected="true"]{background:var(--anyband-accent);color:var(--anyband-background)}
table{width:100%;border-collapse:collapse}td,th{padding:2px 4px;text-align:right}td:first-child,th:first-child{text-align:left}
th{opacity:.7;font-weight:normal}tr:nth-child(even) td{background:color-mix(in srgb,var(--anyband-background) 55%,transparent)}
.metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin:4px 0}
.metric{padding:4px 6px;border:1px solid var(--anyband-accent);border-radius:3px}.metric b{display:block}
.ability{margin:6px 0;padding:6px;border:1px solid var(--anyband-accent);border-radius:4px}.ability h4{margin:0 0 4px}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.footer{display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--anyband-accent);margin-top:10px;padding-top:8px}
.footer .nav{margin-left:auto;display:flex;gap:6px}
.error{color:var(--anyband-accent);font-weight:bold}.muted{opacity:.7}.history{white-space:pre-wrap}
.adjust button{min-width:2em;padding:0 4px}
label.field{display:block;margin:6px 0 2px}input.name{width:100%;box-sizing:border-box}textarea{width:100%;box-sizing:border-box;resize:vertical}
details{margin:8px 0}summary{cursor:pointer}details label{display:flex;gap:6px;align-items:flex-start;margin:3px 0}`;
function el10(parent, tag, text, className) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  if (className) child.className = className;
  parent.appendChild(child);
  return child;
}
function button6(parent, label2, focus, onClick, disabled = false) {
  const node2 = el10(parent, "button", label2);
  node2.type = "button";
  node2.dataset["focus"] = focus;
  if (disabled) node2.disabled = true;
  node2.addEventListener("click", () => {
    if (!node2.disabled) onClick();
  });
  return node2;
}
function collapsible(parent, key, title, actions) {
  const details = el10(parent, "details");
  if (actions.expanded.has(key)) details.open = true;
  const summary = el10(details, "summary", title);
  summary.dataset["focus"] = `section-${key}`;
  details.addEventListener("toggle", () => {
    if (details.open) actions.expanded.add(key);
    else actions.expanded.delete(key);
  });
  return details;
}
function birthOptions(parent, draft, actions) {
  if (!draft.options.length) return;
  const details = collapsible(parent, "options", "Birth options", actions);
  for (const option of draft.options) {
    const label2 = el10(details, "label");
    const box = el10(label2, "input");
    box.type = "checkbox";
    box.checked = option.value;
    box.dataset["focus"] = `option-${option.name}`;
    box.setAttribute("aria-label", option.description || option.name);
    box.addEventListener("change", () => actions.act((s) => s.setOption(option.name, box.checked), false));
    el10(label2, "span", option.description || option.name);
  }
}
function statTable(parent, rows, editable, pointsLeft, actions) {
  const table = el10(parent, "table");
  const head = el10(table, "tr");
  for (const name of ["Stat", "Base", "Race", "Class", "Total", ...editable ? ["Spent", "Cost", "Adjust"] : []]) el10(head, "th", name);
  for (const row of rows) {
    const tr = el10(table, "tr");
    for (const value2 of [row.name, row.base, row.race, row.cls, row.total]) el10(tr, "td", value2);
    if (!editable) continue;
    el10(tr, "td", String(row.spent));
    el10(tr, "td", row.buyCost === null ? "-" : String(row.buyCost));
    const cell2 = el10(tr, "td", void 0, "adjust");
    const canBuy = row.canBuy;
    const sell = button6(cell2, "-", `sell-${row.index}`, () => {
      if (row.canSell) actions.act((s) => s.sell(row.index));
    });
    sell.setAttribute("aria-label", `Refund a point from ${row.name}`);
    if (row.sellRefund !== null) sell.title = `Refunds ${row.sellRefund} ${row.sellRefund === 1 ? "point" : "points"}.`;
    if (!row.canSell) sell.setAttribute("aria-disabled", "true");
    const buy = button6(cell2, "+", `buy-${row.index}`, () => {
      if (canBuy) actions.act((s) => s.buy(row.index));
    });
    buy.setAttribute("aria-label", `Spend points on ${row.name}`);
    buy.title = row.atMaximum || row.buyCost === null ? "Base stat is at its maximum." : `Costs ${row.buyCost} ${row.buyCost === 1 ? "point" : "points"}. ${pointsLeft} remaining.${canBuy ? "" : " Reduce another stat to free points."}`;
    if (!canBuy) buy.setAttribute("aria-disabled", "true");
    for (const [node2, kind] of [[sell, "sell"], [buy, "buy"]]) {
      node2.addEventListener("keydown", (event) => {
        const action = statKey(event.key);
        if (!action) return;
        event.preventDefault();
        if (action === "up" || action === "down") {
          const next = row.index + (action === "up" ? -1 : 1);
          if (next >= 0 && next < rows.length) actions.repaint(`${kind}-${next}`);
          return;
        }
        if (action === "buy") {
          if (canBuy) actions.act((s) => s.buy(row.index), true, `${kind}-${row.index}`);
        } else if (row.canSell) actions.act((s) => s.sell(row.index), true, `${kind}-${row.index}`);
      });
    }
  }
}
function previewColumn(parent, wizard, draft, actions) {
  const column = el10(parent, "div", void 0, "preview");
  column.setAttribute("aria-label", "Character preview");
  el10(column, "h3", "Character preview");
  el10(column, "p", draft.name || "No name yet", draft.name ? void 0 : "muted");
  el10(column, "p", [draft.race, draft.cls].filter(Boolean).join(" ") || "Choose a race and a class.");
  if (!draft.preview) {
    el10(column, "p", "The preview appears once a race and a class are chosen.", "muted");
    return;
  }
  const summary = previewSummary(draft);
  el10(column, "p", `HP ${summary.hp}    SP ${summary.sp}`);
  el10(column, "p", `Starting funds: ${summary.gold ?? 0} gold`);
  el10(column, "p", "Starting equipment is deducted from these funds.", "muted");
  statTable(column, statRows(draft, wizard.catalogue), false, draft.pointsLeft, actions);
  if (draft.history) el10(column, "p", draft.history, "history");
}
function choiceStep(parent, wizard, draft, list, actions) {
  const entries = wizard.catalogue[list];
  const current = list === "races" ? draft.race : draft.cls;
  const choose = (name) => actions.act((s) => list === "races" ? s.chooseRace(name) : s.chooseClass(name), true, `choice-${name}`);
  const names = entries.map((entry2) => entry2.name);
  const ul = el10(parent, "ul", void 0, "choices");
  ul.setAttribute("role", "listbox");
  ul.setAttribute("aria-label", list === "races" ? "Race" : "Class");
  for (const name of names) {
    const li = el10(ul, "li", name);
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(name === current));
    li.setAttribute("tabindex", name === current || current === null && name === names[0] ? "0" : "-1");
    li.dataset["focus"] = `choice-${name}`;
    li.addEventListener("click", () => choose(name));
    li.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose(name);
        return;
      }
      const next = stepChoice(names, current ?? name, event.key);
      if (next === null) return;
      event.preventDefault();
      if (next !== current) choose(next);
      else actions.repaint(`choice-${next}`);
    });
  }
  const selected = entries.find((entry2) => entry2.name === current);
  if (!selected) {
    el10(parent, "p", list === "races" ? "Choose a race." : "Choose a class.", "muted");
    return;
  }
  const view = choiceView(selected, list === "classes" ? wizard.catalogue.races.find((race) => race.name === draft.race) ?? null : null);
  const modifiers = el10(parent, "table");
  const head = el10(modifiers, "tr");
  const values = el10(modifiers, "tr");
  wizard.catalogue.stats.forEach((stat2, index) => {
    el10(head, "th", stat2);
    el10(values, "td", signed(view.modifiers[index] ?? 0));
  });
  el10(parent, "h3", "Traits");
  const metrics = el10(parent, "div", void 0, "metrics");
  for (const trait of view.traits) {
    const metric2 = el10(metrics, "div", void 0, "metric");
    el10(metric2, "span", trait.label, "muted");
    el10(metric2, "b", trait.value);
    if (trait.note) el10(metric2, "span", trait.note, "muted");
  }
  if (view.abilities.length) {
    el10(parent, "h3", "Abilities");
    for (const ability of view.abilities) {
      const card = el10(parent, "div", void 0, "ability");
      el10(card, "h4", ability.name);
      if (ability.description) el10(card, "p", ability.description);
    }
  }
  if (view.skills.length) {
    const details = collapsible(parent, `skills-${list}`, "Skill modifiers", actions);
    const table = el10(details, "table");
    for (const skill of view.skills) {
      const tr = el10(table, "tr");
      el10(tr, "td", skill.label);
      el10(tr, "td", skill.value);
    }
  }
}
function attributesStep(parent, wizard, draft, actions) {
  const methods = el10(parent, "div", void 0, "row");
  methods.setAttribute("role", "radiogroup");
  methods.setAttribute("aria-label", "How to set your stats");
  for (const [method, label2] of [["point", "Point buy"], ["roller", "Random rolls"]]) {
    const wrap = el10(methods, "label");
    const radio = el10(wrap, "input");
    radio.type = "radio";
    radio.name = "method";
    radio.checked = draft.method === method;
    radio.dataset["focus"] = `method-${method}`;
    radio.addEventListener("change", () => {
      if (!radio.checked || draft.method === method) return;
      actions.act((s) => method === "point" ? s.usePointBuy() : s.roll(), true, `method-${method}`);
    });
    el10(wrap, "span", label2);
  }
  const rows = statRows(draft, wizard.catalogue);
  if (draft.method === "point") {
    el10(parent, "p", `Points remaining: ${draft.pointsLeft}`);
    el10(parent, "p", draft.pointsLeft === 0 ? "All points are allocated. Use - to free points, or Reset points to start from scratch." : "Use + to spend points and - to refund them. Race and class bonuses are added automatically.", "muted");
    statTable(parent, rows, true, draft.pointsLeft, actions);
    const row = el10(parent, "div", void 0, "row");
    button6(row, "Suggested allocation", "suggest", () => actions.act((s) => s.suggest()));
    button6(row, "Reset points", "reset", () => actions.act((s) => s.reset()));
  } else {
    statTable(parent, rows, false, 0, actions);
    const row = el10(parent, "div", void 0, "row");
    button6(row, "Roll again", "roll", () => actions.act((s) => s.roll()));
    button6(row, "Previous roll", "previous-roll", () => actions.act((s) => s.previousRoll()), !draft.canPreviousRoll);
  }
}
function identityStep(parent, wizard, draft, actions) {
  el10(parent, "label", "Name", "field");
  const name = el10(parent, "input", void 0, "name");
  name.type = "text";
  name.value = draft.name;
  name.maxLength = wizard.catalogue.nameMax;
  name.dataset["focus"] = "name";
  name.setAttribute("aria-label", "Name");
  if (wizard.catalogue.namePinned) {
    name.disabled = true;
    name.title = "The name is set for this game.";
  }
  name.addEventListener("input", () => actions.act((s) => s.setName(name.value), false));
  name.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    actions.open("review");
  });
  const nameRow = el10(parent, "div", void 0, "row");
  button6(nameRow, "Random name", "random-name", () => actions.act((s) => s.randomName(), false), wizard.catalogue.namePinned);
  el10(parent, "label", "Background", "field");
  const history = el10(parent, "textarea");
  history.rows = 8;
  history.value = draft.history;
  history.dataset["focus"] = "history";
  history.setAttribute("aria-label", "Background");
  history.addEventListener("input", () => actions.act((s) => s.setHistory(history.value), false));
  const row = el10(parent, "div", void 0, "row");
  button6(row, "Restore generated background", "restore-history", () => actions.act((s) => s.restoreHistory(), false), !draft.historyEdited);
  button6(row, "New background", "new-history", () => actions.act((s) => s.regenerateHistory(), false), draft.race === null);
}
function reviewStep(parent, draft, actions) {
  el10(parent, "p", `${draft.name || "No name yet"} - ${[draft.race, draft.cls].filter(Boolean).join(" ")}`);
  if (draft.history) el10(parent, "p", draft.history, "history");
  if (!draft.ready) el10(parent, "p", "Give your character a name before you start.", "muted");
  if (!draft.preview) return;
  const details = collapsible(parent, "sheet", "Character sheet", actions);
  for (const panel of draft.preview.panels) {
    const table = el10(details, "table");
    for (const line of panel.lines) {
      if (!line.label.trim() && !line.value.trim()) continue;
      const tr = el10(table, "tr");
      el10(tr, "td", line.label);
      el10(tr, "td", line.value);
    }
  }
}
function errorLine(parent, wizard) {
  if (!wizard.error) return;
  const line = el10(parent, "p", wizard.error, "error");
  line.setAttribute("role", "alert");
}
function previousScreen(parent, wizard, draft, actions) {
  el10(parent, "h2", "Play again");
  el10(parent, "p", draft.name || "No name yet");
  el10(parent, "p", [draft.race, draft.cls].filter(Boolean).join(" "));
  el10(parent, "p", "Reuse this character's starting choices or create a new character.");
  el10(parent, "h3", "Starting attributes");
  statTable(parent, statRows(draft, wizard.catalogue), false, draft.pointsLeft, actions);
  if (draft.history) el10(parent, "p", draft.history, "history");
  el10(parent, "h3", "New character");
  button6(parent, "Use previous character", "use-previous", () => actions.usePrevious(), !draft.ready);
  el10(parent, "p", "Begin at level 1 with the same race, class and starting attributes.", "muted");
  button6(parent, "Change name / background", "rename", () => actions.open("identity"));
  el10(parent, "p", "Keep the character's starting build and give them a new identity.", "muted");
  button6(parent, "Create a different character", "different", () => {
    actions.act((s) => s.suggest());
    actions.open("race");
  });
  el10(parent, "p", "Choose race, class, attributes and identity in character creation.", "muted");
  birthOptions(parent, draft, actions);
  errorLine(parent, wizard);
  const footer = el10(parent, "div", void 0, "footer");
  button6(footer, "Return to main menu", "cancel", () => actions.cancel());
}
function renderBirthStep(mount, wizard, step, actions) {
  const draft = wizard.draft();
  const backdrop = el10(mount, "div", void 0, "backdrop");
  const frame = el10(backdrop, "section", void 0, "birth");
  if (step === "previous") {
    previousScreen(frame, wizard, draft, actions);
    return;
  }
  el10(frame, "h2", "Create a character");
  const number = stepNumber(step);
  el10(frame, "p", `Step ${number} of ${WIZARD_STEPS.length} - ${STEP_LABELS[step]}`);
  const bar = el10(frame, "div", void 0, "progress");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "1");
  bar.setAttribute("aria-valuemax", String(WIZARD_STEPS.length));
  bar.setAttribute("aria-valuenow", String(number));
  el10(bar, "div").style.width = `${number / WIZARD_STEPS.length * 100}%`;
  const layout = el10(frame, "div", void 0, "layout");
  const choices = el10(layout, "div");
  el10(choices, "h3", STEP_LABELS[step]);
  if (step === "race" && wizard.catalogue.previous) button6(choices, "Use previous character", "quick-start", () => {
    if (wizard.usePrevious()) actions.open("review");
    else actions.repaint();
  });
  if (step === "race") choiceStep(choices, wizard, draft, "races", actions);
  else if (step === "class") choiceStep(choices, wizard, draft, "classes", actions);
  else if (step === "attributes") attributesStep(choices, wizard, draft, actions);
  else if (step === "identity") identityStep(choices, wizard, draft, actions);
  else reviewStep(choices, draft, actions);
  birthOptions(choices, draft, actions);
  previewColumn(layout, wizard, draft, actions);
  errorLine(frame, wizard);
  const footer = el10(frame, "div", void 0, "footer");
  button6(footer, "Return to main menu", "cancel", () => actions.cancel());
  const nav = el10(footer, "div", void 0, "nav");
  button6(nav, "Back", "back", () => actions.back(), !actions.canGoBack);
  const next = nextStep(step);
  if (next) button6(nav, "Next", "next", () => actions.open(next));
  else button6(nav, "Start game", "start", () => actions.accept(), !draft.ready);
}
function firstFocus(step, wizard) {
  const draft = wizard.draft();
  if (step === "race") return `choice-${draft.race ?? wizard.catalogue.races[0]?.name ?? ""}`;
  if (step === "class") return `choice-${draft.cls ?? wizard.catalogue.classes[0]?.name ?? ""}`;
  if (step === "attributes") return draft.method === "point" ? "buy-0" : "roll";
  if (step === "identity") return wizard.catalogue.namePinned ? "random-name" : "name";
  if (step === "review") return draft.ready ? "start" : "back";
  return draft.ready ? "use-previous" : "rename";
}
var BirthStack = class {
  constructor(ctx, wizard, theme) {
    this.ctx = ctx;
    this.wizard = wizard;
    this.theme = theme;
    this.stopTheme = onThemeChange((next) => {
      this.theme = next;
      for (const level of this.levels) applyTheme(level.panel.root, next);
    });
  }
  ctx;
  wizard;
  theme;
  levels = [];
  expanded = /* @__PURE__ */ new Set();
  stopTheme;
  serial = 0;
  get depth() {
    return this.levels.length;
  }
  /** Open a step on top. Throws when the host refuses a panel. */
  push(step) {
    const panel = this.ctx.ui.openPanel({ id: `birth-${++this.serial}`, modal: true, label: `Character creation: ${STEP_LABELS[step]}` });
    applyTheme(panel.root, this.theme);
    const style = panel.root.ownerDocument.createElement("style");
    style.textContent = CSS11;
    panel.root.appendChild(style);
    const mount = panel.root.ownerDocument.createElement("div");
    panel.root.appendChild(mount);
    const level = { step, panel, mount };
    this.levels.push(level);
    void panel.closed.then(() => this.closedElsewhere(level));
    this.paint(level, firstFocus(step, this.wizard));
  }
  /** The player (Escape or the close control) or the host closed a panel. */
  closedElsewhere(level) {
    const index = this.levels.indexOf(level);
    if (index < 0) return;
    for (const above of this.levels.splice(index).slice(1)) above.panel.close();
    if (this.wizard.finished) return;
    if (!this.levels.length) {
      this.dispose();
      this.wizard.cancel();
      return;
    }
    this.leaveStep();
    this.showTop();
  }
  /** Draw the top step again, after the draft changed under it. */
  showTop() {
    const top = this.levels[this.levels.length - 1];
    if (top) this.paint(top, firstFocus(top.step, this.wizard));
  }
  /** Back: close the top step and show the one under it. */
  pop() {
    if (this.levels.length < 2) return;
    this.levels.pop().panel.close();
    this.leaveStep();
    this.showTop();
  }
  /** A refusal belongs to the step that caused it, so moving to another step drops it. */
  leaveStep() {
    this.wizard.error = "";
  }
  /** Close every panel; used once creation is accepted or cancelled. */
  closeAll() {
    for (const level of this.levels.splice(0).reverse()) level.panel.close();
    this.dispose();
  }
  dispose() {
    this.stopTheme();
  }
  paint(level, focus) {
    const root = level.mount.getRootNode();
    const active = root.activeElement;
    const keep = focus ?? (active && level.mount.contains(active) ? active.dataset?.["focus"] : void 0);
    const caret = !focus && active && keep && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") ? [active.selectionStart, active.selectionEnd] : null;
    level.mount.replaceChildren();
    const isTop = this.levels[this.levels.length - 1] === level;
    const actions = {
      act: (change, build, next) => {
        this.wizard.run(change, build);
        this.paint(level, next);
      },
      open: (step) => {
        this.leaveStep();
        if (step === "race") this.wizard.start();
        try {
          this.push(step);
        } catch (error) {
          this.wizard.error = `The next step could not open: ${error instanceof Error ? error.message : String(error)}`;
          this.paint(level);
        }
      },
      back: () => {
        if (isTop) this.pop();
      },
      canGoBack: this.levels.indexOf(level) > 0,
      usePrevious: () => {
        if (this.wizard.usePrevious() && this.wizard.accept()) {
          this.closeAll();
          return;
        }
        this.paint(level);
      },
      accept: () => {
        if (this.wizard.accept()) this.closeAll();
        else this.paint(level);
      },
      cancel: () => {
        this.wizard.cancel();
        this.closeAll();
      },
      repaint: (next) => this.paint(level, next),
      expanded: this.expanded
    };
    renderBirthStep(level.mount, this.wizard, level.step, actions);
    if (!keep) return;
    const target = Array.from(level.mount.querySelectorAll("[data-focus]")).find((node2) => node2.dataset["focus"] === keep) ?? level.mount.querySelector("button:not([disabled])");
    target?.focus();
    if (target && caret && caret[0] !== null && typeof target.setSelectionRange === "function") target.setSelectionRange(caret[0], caret[1]);
  }
};
function installBirthWizard(ctx) {
  if (ctx.flags?.[BIRTH_FLAG] !== true) return void 0;
  const ui = ctx.ui;
  if (!ui) {
    ctx.log("character creation: panel seam unavailable, so the game shows its own birth screens");
    return void 0;
  }
  let live = null;
  return {
    show(session) {
      live?.closeAll();
      live = null;
      let wizard;
      try {
        wizard = new BirthWizard(session);
      } catch (error) {
        ctx.log(`character creation: could not read the birth session (${error instanceof Error ? error.message : String(error)})`);
        return false;
      }
      const previous = wizard.catalogue.previous !== null;
      const stack = new BirthStack({ ...ctx, ui }, wizard, themeFromPrefs(ctx.prefs?.get()));
      try {
        stack.push(previous ? "previous" : "race");
      } catch (error) {
        stack.closeAll();
        ctx.log(`character creation: could not open its window (${error instanceof Error ? error.message : String(error)}), so the game shows its own birth screens`);
        return false;
      }
      try {
        if (previous) wizard.usePrevious();
        else wizard.start();
        stack.showTop();
      } catch (error) {
        stack.closeAll();
        ctx.log(`character creation: could not draw its first step (${error instanceof Error ? error.message : String(error)}), so the game shows its own birth screens`);
        return false;
      }
      live = stack;
      return true;
    }
  };
}

// src/minimap-travel.ts
var TRAVEL_WAIT_MS = 2e3;
var TRAVEL_POLL_MS = 50;
function mapTarget(snap, point, known, player) {
  if (snap.mode !== "map" || !known) return null;
  const grid = snapLandmark(snap, point, known.cells) ?? hoverGrid(snap, point);
  if (!grid || grid.x >= snap.level.width || grid.y >= snap.level.height) return null;
  if (player && player.x === grid.x && player.y === grid.y) return null;
  const cell2 = known.cells.find((entry2) => entry2.x === grid.x && entry2.y === grid.y);
  return cell2 && cell2.remembered.feat > 0 && cell2.remembered.featCode !== "NONE" ? { x: grid.x, y: grid.y } : null;
}
function installMinimapTravel(ctx) {
  if (ctx.flags["anybandui.minimapTravel"] !== true) return () => {
  };
  if (!ctx.display || !ctx.snapshot || !ctx.knownLevel || !ctx.intent || typeof window === "undefined") {
    ctx.log?.("minimap travel: display, map or intent seam unavailable");
    return () => {
    };
  }
  const display = ctx.display;
  let poll = null;
  const stop = () => {
    if (poll) clearInterval(poll);
    poll = null;
  };
  const onDown = (event) => {
    if (event.button !== 0 || !playerIsDriving(ctx)) return;
    const snap = display.snapshot();
    if (snap.mode !== "map") return;
    let known = null;
    try {
      known = viewLevel(ctx);
    } catch {
      known = null;
    }
    const target = mapTarget(snap, { x: event.clientX, y: event.clientY }, known, viewPlayer(viewInput(ctx))?.grid);
    stop();
    if (!target) return;
    const deadline = Date.now() + TRAVEL_WAIT_MS;
    poll = setInterval(() => {
      if (Date.now() > deadline || !playerIsDriving(ctx)) {
        stop();
        return;
      }
      const input = viewInput(ctx);
      if (display.snapshot().mode === "map" || !input || input.phase !== "play" || input.messagePending || input.prompt) return;
      stop();
      if (!clickTile(ctx, target)) ctx.log?.(`minimap travel: the game refused travel to ${target.x},${target.y}`);
    }, TRAVEL_POLL_MS);
  };
  window.addEventListener("pointerdown", onDown, true);
  return () => {
    stop();
    window.removeEventListener("pointerdown", onDown, true);
  };
}

// plugin.ts
var quiverDisplay;
var tileDisplay;
var tileFullOverviewApplied = false;
var displayCleanups = [];
var characterPane = null;
var statusRepaint = null;
function registerAll(ctx) {
  uninstall();
  ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
  const flags = coexistingFlags(ctx.flags ?? {}, ctx.mods?.bind(ctx), ctx.log);
  setThemePacks(flags["anybandui.themePacks"] === true);
  if (ctx.events) {
    const events = ctx.events;
    const repaint = () => statusRepaint?.();
    try {
      events.on("driver-changed", repaint);
      displayCleanups.push(() => events.off("driver-changed", repaint));
    } catch {
    }
  }
  displayCleanups.push(installEffects({ flags, ...ctx.snapshot ? { snapshot: ctx.snapshot } : {}, ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {}, ...ctx.events ? { events: ctx.events } : {}, ...ctx.display?.snapshot ? { display: { snapshot: ctx.display.snapshot.bind(ctx.display) } } : {}, ...ctx.prefs ? { prefs: ctx.prefs } : {}, ...ctx.settings ? { settings: ctx.settings } : {} }));
  const theme = themeFromPrefs(ctx.prefs?.get());
  displayCleanups.push(installChromePaint(ctx.display, flags, theme, ctx.log));
  const { liveCore, liveState } = liveGame(ctx);
  const itemContext = {
    flags,
    log: ctx.log,
    ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
    ...ctx.inspect ? { inspect: ctx.inspect } : {},
    ...ctx.intent ? { intent: ctx.intent } : {},
    ...ctx.prompt ? { prompt: ctx.prompt } : {},
    ...ctx.ui ? { ui: ctx.ui } : {},
    ...ctx.prefs ? { prefs: ctx.prefs } : {},
    ...itemsGame(liveCore, liveState)
  };
  displayCleanups.push(installItems(itemContext));
  displayCleanups.push(installStores({ ...itemContext, ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {}, ...ctx.driver ? { driver: ctx.driver } : {} }));
  displayCleanups.push(installCharacterSheet({
    flags,
    log: ctx.log,
    ...ctx.ui ? { ui: ctx.ui } : {},
    ...ctx.prefs ? { prefs: ctx.prefs } : {},
    ...ctx.character ? { character: ctx.character } : {}
  }));
  displayCleanups.push(installThemeEditor({
    flags,
    log: ctx.log,
    ...ctx.ui ? { ui: ctx.ui } : {},
    ...ctx.prefs ? { prefs: ctx.prefs } : {},
    ...ctx.display ? { display: ctx.display } : {}
  }));
  displayCleanups.push(installMenus({ ...ctx, flags }));
  const menuContext = { flags, log: ctx.log, ...ctx.ui ? { ui: ctx.ui } : {}, ...ctx.prefs ? { prefs: ctx.prefs } : {} };
  displayCleanups.push(installKnowledgeBrowser({ ...menuContext, ...ctx.knowledge ? { knowledge: ctx.knowledge } : {} }));
  displayCleanups.push(installOptionsEditor({ ...menuContext, ...ctx.options ? { options: ctx.options } : {} }));
  displayCleanups.push(installKeybindingEditor({ ...menuContext, ...ctx.keybindings ? { keybindings: ctx.keybindings } : {} }));
  displayCleanups.push(installSettingsWindow({
    ...menuContext,
    ...ctx.settings ? { settings: ctx.settings } : {},
    ...ctx.display ? { display: ctx.display } : {},
    ...ctx.session ? { session: ctx.session } : {},
    ...ctx.subwindows ? { subwindows: ctx.subwindows } : {}
  }));
  if (flags["anybandui.highContrast"] || flags["anybandui.colourblind"] || flags["anybandui.crt"] || theme.invert_dungeon) {
    installAccessibilityAccommodations({ flags, invertDungeon: theme.invert_dungeon, ...ctx.display ? { display: ctx.display } : {}, log: ctx.log });
  }
  if (flags["anybandui.quiverItemization"]) {
    if (!ctx.display) ctx.log("this game is too old for display conveniences");
    else {
      if (flags["anybandui.quiverItemization"] && ctx.display.setQuiverItemization) {
        quiverDisplay = ctx.display;
        ctx.display.setQuiverItemization(true);
      }
    }
  }
  if (ctx.display?.snapshot && ctx.display.onKey && ctx.display.setGrid && ctx.display.setCamera && ctx.display.setSidebarExtent && ctx.display.repaint) {
    const display = ctx.display;
    installZoomPan({
      flags,
      display: gateSidebarExtent(display),
      manageTileSettings: false,
      ...ctx.prefs ? { prefs: ctx.prefs } : {},
      ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
      ...ctx.subwindows ? { subwindows: ctx.subwindows } : {},
      ...liveState ? { state: liveState } : {},
      log: ctx.log
    });
    displayCleanups.push(uninstallZoomPan);
    if (ctx.display.setFullMapOverview && ctx.display.setMapView && ctx.display.setTileScaling) {
      displayCleanups.push(installMapOverview({
        flags,
        display: ctx.display,
        ...liveState ? { state: liveState } : {},
        ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {},
        ...ctx.prefs ? { prefs: ctx.prefs } : {},
        log: ctx.log
      }));
    }
    displayCleanups.push(installMapHoverCards({
      flags,
      ...liveCore ? { core: liveCore } : { core: null },
      ...liveState ? { state: liveState } : {},
      ...ctx.prefs ? { prefs: ctx.prefs } : {},
      display
    }));
    displayCleanups.push(installHoverCards({
      flags: { ...flags, "anybandui.mapHoverCards": false },
      display,
      ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
      ...ctx.inspect ? { inspect: ctx.inspect } : {},
      ...liveCore ? { core: liveCore } : {},
      ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {},
      ...liveState ? { state: liveState } : {},
      ...ctx.prefs ? { prefs: ctx.prefs } : {},
      log: ctx.log
    }));
  } else if (flags["anybandui.crispTiles"] && ctx.display?.setTileScaling) {
    tileDisplay = ctx.display;
    ctx.display.setTileScaling("crisp");
    if (ctx.display.setFullMapOverview) {
      ctx.display.setFullMapOverview(true);
      tileFullOverviewApplied = true;
    }
  }
  if (flags["anybandui.mapHoverCards"] && !(ctx.display?.snapshot && ctx.display.onKey && ctx.display.setGrid && ctx.display.setCamera && ctx.display.setSidebarExtent && ctx.display.repaint)) {
    displayCleanups.push(installMapHoverCards({
      flags,
      core: liveCore ?? null,
      ...liveState ? { state: liveState } : {},
      ...ctx.prefs ? { prefs: ctx.prefs } : {},
      ...ctx.display?.snapshot ? { display: ctx.display } : {}
    }));
  }
  displayCleanups.push(installMapMouse({
    flags,
    ...ctx.display?.snapshot ? { display: ctx.display } : {},
    ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
    ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {},
    ...ctx.intent ? { intent: ctx.intent } : {},
    ...ctx.prompt ? { prompt: ctx.prompt } : {},
    ...ctx.inspect ? { inspect: ctx.inspect } : {},
    ...ctx.prefs ? { prefs: ctx.prefs } : {},
    log: ctx.log
  }));
  displayCleanups.push(installMinimapTravel({
    flags,
    ...ctx.display?.snapshot ? { display: { snapshot: ctx.display.snapshot.bind(ctx.display) } } : {},
    ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
    ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {},
    ...ctx.intent ? { intent: ctx.intent } : {},
    ...ctx.prompt ? { prompt: ctx.prompt } : {},
    ...ctx.driver ? { driver: ctx.driver.bind(ctx) } : {},
    log: ctx.log
  }));
  displayCleanups.push(installPhase4({
    flags,
    log: ctx.log,
    ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
    ...ctx.intent ? { intent: ctx.intent } : {},
    ...ctx.prompt ? { prompt: ctx.prompt } : {},
    ...ctx.inspect ? { inspect: ctx.inspect } : {},
    ...ctx.ui ? { ui: ctx.ui } : {},
    ...ctx.prefs ? { prefs: ctx.prefs } : {},
    ...ctx.display?.snapshot ? { display: { snapshot: ctx.display.snapshot.bind(ctx.display) } } : {},
    ...ctx.driver ? { driver: ctx.driver } : {},
    ...ctx.character ? { character: ctx.character } : {},
    ...liveState ? { state: liveState } : {}
  }));
  if (flags["anybandui.firstEncounter"]) {
    if (liveCore && liveState) {
      const theme2 = themeFromPrefs(ctx.prefs?.get());
      installFirstEncounter({
        core: liveCore,
        state: liveState,
        theme: theme2,
        ...ctx.ui ? { ui: ctx.ui } : {},
        ...ctx.prefs ? { prefs: ctx.prefs } : {},
        ...ctx.tiles ? { tiles: ctx.tiles } : {},
        log: ctx.log
      });
    } else ctx.log("first-encounter alerts: no live game at register time");
  }
}
function uninstall() {
  characterPane?.close();
  characterPane = null;
  for (const cleanup of displayCleanups.splice(0).reverse()) cleanup();
  setThemePacks(false);
  uninstallFirstEncounter();
  uninstallAccessibilityAccommodations();
  quiverDisplay?.setQuiverItemization?.(false);
  if (tileDisplay?.setTileScaling) releaseTileSettings(tileDisplay, tileFullOverviewApplied);
  quiverDisplay = void 0;
  tileDisplay = void 0;
  tileFullOverviewApplied = false;
}
function menu(ctx) {
  return menuPresenter({ ...ctx, flags: coexistingFlags(ctx.flags ?? {}, ctx.mods?.bind(ctx)) });
}
function screen(ctx) {
  return screenPresenter({ ...ctx, flags: coexistingFlags(ctx.flags ?? {}, ctx.mods?.bind(ctx)) });
}
function birth(ctx) {
  return installBirthWizard(ctx);
}
function hud(ctx) {
  characterPane?.close();
  characterPane = null;
  const doc = globalThis.document;
  if (!doc?.body) return void 0;
  const enabled = {
    sidebar: ctx.flags["anybandui.sidebar"] === true,
    status: ctx.flags["anybandui.status"] === true,
    messages: ctx.flags["anybandui.messages"] === true
  };
  const zoomSidebar = !enabled.sidebar && (ctx.flags["anybandui.zoom"] || ctx.flags["anybandui.enlargedDisplay"]);
  if (!enabled.sidebar && !enabled.status && !enabled.messages && !zoomSidebar) return void 0;
  const source = createSource(ctx);
  const theme = themeFromPrefs(ctx.prefs?.get());
  const output = {};
  const cardPanels = [
    { key: "character", render: renderCharacterCard, select: (m) => {
      const p = m.player;
      return [p.name, p.race, p.class, p.title, p.hp, p.max_hp, p.sp, p.max_sp, p.food, p.food_max, p.experience, p.level_start_experience, p.next_level_experience, p.level, p.stats, p.gold, p.armour, p.speed, p.extra_moves];
    } },
    { key: "tracked", render: renderTrackedCreature, select: (m) => m.player.tracked_creature }
  ];
  const pane = enabled.sidebar ? installCharacterPane({ flags: ctx.flags, ui: ctx.ui, prefs: ctx.prefs, display: ctx.display, log: ctx.log ?? (() => {
  }) }, cardPanels) : null;
  characterPane = pane;
  if (pane) {
    output.sidebar = { present(section2, frame) {
      zoomPanHud({ flags: ctx.flags })?.sidebar?.present(section2, frame);
      source.hud.sidebar.present(section2, frame);
      pane.claimSidebar();
      const model = source.snapshot();
      if (model) pane.paint(model);
    } };
  } else if (enabled.sidebar) {
    const host = createPanelHost(doc, cardPanels, theme);
    output.sidebar = { present(section2, frame) {
      zoomPanHud({ flags: ctx.flags })?.sidebar?.present(section2, frame);
      source.hud.sidebar.present(section2, frame);
      const model = source.snapshot();
      if (model) host.present(section2, frame, model);
    } };
  } else if (zoomSidebar) {
    const sink = zoomPanHud({ flags: ctx.flags })?.sidebar;
    if (sink) output.sidebar = sink;
  }
  if (enabled.status) {
    const host = createPanelHost(doc, [
      { key: "driver", render: (mount) => renderDriverBadge(mount, currentDriver(ctx)), select: () => currentDriver(ctx) },
      { key: "status", render: renderStatusBadges, select: (m) => [m.player.statuses, m.player.study] },
      { key: "dungeon", render: renderDungeonCard, select: (m) => [m.dungeon, m.player.trap_detected, m.player.recall, m.player.descent, m.player.resting, m.player.running, m.player.repeat, m.player.unignoring] }
    ], theme);
    let last = null;
    output.status = { present(section2, frame) {
      last = [section2, frame];
      source.hud.status.present(section2, frame);
      const model = source.snapshot();
      if (model) host.present(section2, frame, model);
      if (model) pane?.paint(model);
    } };
    statusRepaint = () => {
      if (last) output.status.present(last[0], last[1]);
    };
  }
  if (enabled.messages) {
    const acknowledge = source.acknowledge;
    const host = createPanelHost(doc, [{ key: "messages", render: (mount, model) => renderMessageLog(mount, model, acknowledge ? { acknowledge } : {}), select: (m) => [m.messages, m.message_pending] }], theme);
    output.messages = { present(section2, frame) {
      source.hud.messages.present(section2, frame);
      const model = source.snapshot({ messages: true });
      if (model) host.present(section2, frame, model);
      if (model) pane?.paint(model);
    } };
  }
  return output;
}
var shared = null;
var primed = null;
function bridgeFor(mod) {
  if (!shared) {
    shared = createBridge(mod);
    primed = shared.prime();
  }
  return shared;
}
var definition = {
  api: ">=2.0.0 <3.0.0",
  /* Stored preferences keep their API 1 shape; the version only starts counting. */
  prefs: { version: 1, migrate: (value2) => value2 },
  async start(mod) {
    const bridge = bridgeFor(mod);
    await primed;
    registerAll(bridge.ctx);
  },
  stop() {
    uninstall();
    shared?.dispose();
    shared = null;
    primed = null;
  },
  presentation: {
    menu: (mod) => menu(bridgeFor(mod).ctx),
    screen: (mod) => screen(bridgeFor(mod).ctx),
    birth: (mod) => birth(bridgeFor(mod).ctx),
    hud: (mod) => hud(bridgeFor(mod).ctx)
  }
};
var plugin_default = definition;
var internals = { register: registerAll, uninstall, menu, screen, birth, hud };
export {
  plugin_default as default,
  internals
};
