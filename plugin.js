// anybandui - generated from plugin.ts by neo-angband-mod-build
// (@rpgm-tools/neo-angband-mod-sdk). Edit the TypeScript source, not this file.

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
  return item.runs.map((run) => run.text).join("").trim();
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
    const maximum = value(frame, key, "max");
    return {
      label: name,
      value: value(frame, key, "use") ?? source.stats[index] ?? 0,
      drained: current === void 0 || maximum === void 0 ? void 0 : current < maximum
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
  for (const run of entry(frame, "tmd")?.runs ?? []) {
    const text = run.text.trim();
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
    group: void 0
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
    message_pending: void 0
  };
}

// src/view-model/source.ts
function createSource(ctx) {
  let latest;
  const present = (_section, frame) => {
    latest = frame;
  };
  return {
    hud: { sidebar: { present }, messages: { present }, status: { present } },
    snapshot() {
      if (ctx.state === void 0) return void 0;
      const state = ctx.state;
      const log = state.messages;
      const history = log === void 0 ? [] : Array.from({ length: log.num() }, (_, age) => ({
        text: log.str(age),
        count: log.count(age),
        category: log.type(age)
      }));
      return adapt(ctx.core.createAgentView(state), latest, {
        name: state.actor.player.fullName,
        history,
        study: state.actor.player.upkeep.newSpells,
        repeat: state.cmdQueue?.[0]?.repeatRemaining ?? 0,
        resting: state.resting !== void 0,
        running: state.run !== void 0,
        unignoring: state.unignoring ?? 0,
        recall: state.actor.player.wordRecall,
        descent: state.actor.player.deepDescent,
        extraMoves: state.playerState?.numMoves ?? 0
      });
    }
  };
}

// src/theme.ts
var THEMES = {
  "terminal-original": { background: "#070b0dff", surface: "#111a1dff", text: "#d9e3dbff", accent: "#80b891ff", rounding: 5, decorations: true, invert_dungeon: false, light_styling: false },
  "dark-graphite": { background: "#0e0f13ff", surface: "#1f2129ff", text: "#d9e3dbff", accent: "#9cadd9ff", rounding: 5, decorations: true, invert_dungeon: false, light_styling: false },
  "light-paper": { background: "#e6e8e3ff", surface: "#fafaf2ff", text: "#1f2b2eff", accent: "#215c52ff", rounding: 8, decorations: true, invert_dungeon: false, light_styling: true },
  "amber-terminal": { background: "#110b06ff", surface: "#241910ff", text: "#f0d9a6ff", accent: "#e89e42ff", rounding: 0, decorations: true, invert_dungeon: false, light_styling: false },
  "midnight-ice": { background: "#060b17ff", surface: "#0e1b2bff", text: "#cfe6f5ff", accent: "#59c2e0ff", rounding: 7, decorations: true, invert_dungeon: false, light_styling: false }
};
var CHROME = {
  padding: { window: [8, 8], frame: [7, 3], separator_text: [8, 3], cell: [6, 2] },
  spacing: { item: [7, 4], item_inner: [5, 4] },
  border: { window: 1, child: 1, frame: 1, tab: 0, separator_text: 1 },
  rounding: { child_factor: 0.6, frame_factor: 0.4, popup_factor: 0.8, scrollbar_size: 12 }
};
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
}

// src/panels/panel-host.ts
var HOST_CSS = `:host{position:fixed;display:none;z-index:50;box-sizing:border-box;color:var(--anyband-text);font:12px/1.35 system-ui,sans-serif}`;
var PANEL_CSS = `
*{box-sizing:border-box}.surface{width:100%;height:100%;overflow:auto;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);padding:5px}
.group{min-height:0;overflow:auto}.heading{color:var(--anyband-accent);font-weight:700;border-bottom:1px solid var(--anyband-accent);margin:0 0 4px;padding-bottom:2px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.metric{text-align:center;border:1px solid var(--anyband-accent);border-radius:3px;padding:2px;min-width:0}.metric b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{height:6px;background:var(--anyband-background);border:1px solid var(--anyband-accent);margin-top:2px}.fill{height:100%}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));text-align:center}.drained{opacity:.55}
.badges{display:flex;flex-wrap:wrap;gap:4px}.badge{border:1px solid currentColor;border-left-width:2px;padding:2px 5px;border-radius:3px}
.muted{opacity:.55}.messages{overflow:auto}.message{white-space:pre-wrap}.ribbon{color:#f5bc5a;border:1px solid #f5bc5a;padding:2px 5px;pointer-events:none}
.tip{display:none;position:absolute;z-index:2;max-width:26em;white-space:pre-wrap;pointer-events:none;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent);border-radius:3px;padding:6px}
input{width:100%;background:var(--anyband-background);color:var(--anyband-text);border:1px solid var(--anyband-accent)}
`;
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
function fraction(current, maximum) {
  return maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0;
}
function meter(parent, label2, value2, amount, colour, tip2) {
  const cell = node(parent, "div", "meter");
  node(cell, "span", "", label2);
  node(cell, "span", "", ` ${value2}`);
  const track = node(cell, "div", "bar");
  const fill = node(track, "div", "fill");
  fill.style.width = `${Math.round(amount * 100)}%`;
  fill.style.backgroundColor = colour;
  if (tip2) cell.dataset.tip = tip2;
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
        const signature = JSON.stringify(panel.select(model));
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
  const content = createPanelContent(node(shadow, "div", "surface"), panels);
  doc.body.appendChild(element);
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
  interfaceFont: "Nouveau_IBM.ttf",
  dungeonFont: "",
  showHeadings: true,
  hoverDelayMs: 550,
  zoomIndex: 7,
  panelZoom: {},
  effects: {}
};
var themes = /* @__PURE__ */ new Set(["terminal-original", "dark-graphite", "light-paper", "amber-terminal", "midnight-ice"]);
var fonts = new Set(FONT_FILES);
function validateSettings(value2) {
  const record2 = value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : {};
  return {
    theme: typeof record2["theme"] === "string" && themes.has(record2["theme"]) ? record2["theme"] : DEFAULT_SETTINGS.theme,
    interfaceFont: typeof record2["interfaceFont"] === "string" && fonts.has(record2["interfaceFont"]) ? record2["interfaceFont"] : DEFAULT_SETTINGS.interfaceFont,
    dungeonFont: typeof record2["dungeonFont"] === "string" && (record2["dungeonFont"] === "" || fonts.has(record2["dungeonFont"])) ? record2["dungeonFont"] : DEFAULT_SETTINGS.dungeonFont,
    showHeadings: typeof record2["showHeadings"] === "boolean" ? record2["showHeadings"] : DEFAULT_SETTINGS.showHeadings,
    hoverDelayMs: typeof record2["hoverDelayMs"] === "number" && Number.isInteger(record2["hoverDelayMs"]) ? Math.max(0, Math.min(5e3, record2["hoverDelayMs"])) : DEFAULT_SETTINGS.hoverDelayMs,
    zoomIndex: typeof record2["zoomIndex"] === "number" && Number.isInteger(record2["zoomIndex"]) ? Math.max(0, Math.min(18, record2["zoomIndex"])) : DEFAULT_SETTINGS.zoomIndex,
    panelZoom: record2["panelZoom"] && typeof record2["panelZoom"] === "object" && !Array.isArray(record2["panelZoom"]) ? Object.fromEntries(Object.entries(record2["panelZoom"]).filter(([id, step]) => id.length > 0 && typeof step === "number" && Number.isInteger(step) && step >= 0 && step <= 6)) : DEFAULT_SETTINGS.panelZoom,
    effects: record2["effects"] && typeof record2["effects"] === "object" && !Array.isArray(record2["effects"]) ? Object.fromEntries(Object.entries(record2["effects"]).filter(([id, value3]) => id.length > 0 && typeof value3 === "number" && Number.isFinite(value3)).map(([id, value3]) => [id, Math.max(0, Math.min(100, Math.round(value3)))])) : DEFAULT_SETTINGS.effects
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
    const hex = css.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
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
  const rgb = rows ? parseRgb(fg) : null;
  if (!rows || !rgb || rows.every((bits) => bits === 0)) {
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
  const [r, g, b] = rgb;
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
  const chars = runs.reduce((n, run) => n + [...run.text].length, 0);
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
  for (const run of runs) {
    for (const char of run.text) {
      const code = char.codePointAt(0) ?? 32;
      const left = edge(col);
      const width = edge(col + 1) - left;
      const glyph = tintedGlyph(code, run.css);
      if (glyph) {
        ctx.drawImage(glyph, left, 0, width, cellHDevice);
      } else {
        ctx.fillStyle = run.css;
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
function styleAsScreenReaderOnly(el5) {
  Object.assign(el5.style, {
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
  label2.textContent = lines.map((runs) => runs.map((run) => run.text).join("")).join(" ");
  styleAsScreenReaderOnly(label2);
  wrap.appendChild(label2);
  return wrap;
}
function paintBitmapButtonLabel(button4, text, css, cellWidth, cellHeight, dpr) {
  button4.replaceChildren();
  if (!button4.hasAttribute("aria-label")) button4.setAttribute("aria-label", text);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  paintBitmapLine(canvas, [{ text, css }], cellWidth, cellHeight, dpr);
  button4.appendChild(canvas);
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
  return new Proxy(display, { get(target, property) {
    const member = Reflect.get(target, property);
    if (typeof member !== "function") return member;
    if (!OWNED_DISPLAY_SETTERS.has(String(property))) return member.bind(target);
    return (...args) => {
      if (args[0] == null) applied.delete(String(property));
      else applied.add(String(property));
      return Reflect.apply(member, target, args);
    };
  } });
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
  const player = rt.ctx.state?.actor?.grid;
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
      maxChars = Math.max(maxChars, entry2.runs.reduce((n, run) => n + [...run.text].length, 0));
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
    label2.textContent = entry2.runs.map((run) => run.text).join("");
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
    const button4 = document.createElement("button");
    button4.type = "button";
    button4.setAttribute("data-anybandui-sidebar-page", "");
    button4.setAttribute("aria-label", `Show status page ${String((plan.page + 1) % plan.pages + 1)} of ${String(plan.pages)}`);
    Object.assign(button4.style, {
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
      button4,
      `${String(plan.page + 1)}/${String(plan.pages)} >`,
      "#d8d87c",
      cellWidth,
      cellHeight,
      dpr
    );
    button4.addEventListener("click", () => turnSidebarPage(rt, 1));
    sidebar.body.appendChild(button4);
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
      const player = rt.ctx.state?.actor?.grid;
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
    const player = rt.ctx.state?.actor?.grid;
    if (flags["anybandui.recentreOnFloor"]) {
      const floor = rt.ctx.state?.levelSerial ?? rt.ctx.state?.chunk?.depth;
      const key = floor === void 0 ? null : String(floor);
      if (rt.lastFloor !== null && key !== rt.lastFloor && player) {
        rt.cameraDetached = false;
        rt.display.setCamera(cameraOrigin(snap, player));
      }
      rt.lastFloor = key;
    }
    const target = rt.ctx.snapshot?.()?.prompt?.cursor;
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
    display: trackedDisplay(display, appliedDisplaySettings),
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
  if (fullOverviewApplied) configuredTileDisplay?.setFullMapOverview?.(false);
  configuredTileDisplay?.setTileScaling("auto");
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
  for (const setting of rt.appliedDisplaySettings) {
    if (setting === "setMapView") rt.display.setMapView(null);
    else if (setting === "setCamera") rt.display.setCamera(null);
    else if (setting === "setSidebarExtent") rt.display.setSidebarExtent(null);
    else if (setting === "setGrid") rt.display.setGrid(null);
  }
}

// src/panels/surface.ts
function interfaceScale(ctx) {
  if (ctx.flags?.["anybandui.zoom"] !== true) return 1;
  return INTERFACE_ZOOM_SCALES[readDisplayPreference(ctx.prefs?.get()).interfaceZoomIndex] ?? 1;
}
function prepare(ctx, root, css) {
  applyTheme(root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
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
        prepare(ctx, host.root, css);
        const entry2 = { container: section(host.root, overlay.className), host, active: host.active, fitted: spec.fitHeight ?? null };
        entries.set(spec.key, entry2);
        const stop = host.onStateChange((state) => {
          entry2.active = state.active;
          onChange();
        });
        onChange();
        return () => {
          stop();
          entries.delete(spec.key);
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
        entries.clear();
      }
    };
  }
  if (!ctx.ui?.openPanel) return null;
  const panel = ctx.ui.openPanel({ id: overlay.id, modal: false, label: overlay.label });
  prepare(ctx, panel.root, css);
  for (const spec of specs) entries.set(spec.key, { container: section(panel.root, overlay.className), host: null, active: true, fitted: null });
  let open = true;
  void panel.closed.then(() => {
    open = false;
    entries.clear();
  });
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
      open = false;
      entries.clear();
    }
  };
}

// src/panels/character-pane.ts
var PANE_SIDEBAR_EXTENT = { columns: 0, topRows: 0 };
var PANE_CSS = `:host{display:block;height:100%;color:var(--anyband-text);font:12px/1.35 system-ui,sans-serif}${PANEL_CSS}.surface{position:relative}`;
var paneOwnsSidebar = false;
function gateSidebarExtent(display) {
  return new Proxy(display, { get(target, property) {
    const member = Reflect.get(target, property);
    if (typeof member !== "function") return member;
    if (property !== "setSidebarExtent") return member.bind(target);
    return (extent) => Reflect.apply(member, target, [extent && paneOwnsSidebar ? PANE_SIDEBAR_EXTENT : extent]);
  } });
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
      const cell = node(stats, "div", item.drained ? "drained" : "");
      node(cell, "div", "", `${item.label}${item.drained ? "*" : ""}`);
      node(cell, "div", "", stat(item.value));
      cell.dataset.tip = `${item.label}: ${stat(item.value)}`;
    }
  }
  const metrics = node(mount, "div", "metric-grid");
  for (const [label2, value2] of [["Gold", p.gold], ["Armour", p.armour], ["Speed", p.speed]]) {
    const tile = node(metrics, "div", "metric", label2);
    node(tile, "b", "", String(value2));
  }
  if (p.extra_moves) node(mount, "div", "", `Extra moves: ${p.extra_moves > 0 ? "+" : ""}${p.extra_moves}`);
}

// src/panels/dungeon-card.ts
function renderDungeonCard(mount, model) {
  mount.replaceChildren();
  node(mount, "div", "heading", "Dungeon");
  const p = model.player;
  const d = model.dungeon;
  const grid = node(mount, "div", "grid");
  for (const [label2, value2, tip2] of [["Depth", String(d.depth), `Depth: ${d.depth_feet} feet`], ["Light", String(d.light), ""], ["Feel", d.feeling || "?", d.feeling_description ?? ""], ["", d.floor ?? "", ""]]) {
    const tile = node(grid, "div", "metric", label2);
    node(tile, "b", "", value2);
    if (tip2) tile.dataset.tip = tip2;
  }
  for (const [condition, label2] of [[p.trap_detected, "Trap-detected area"], [p.recall, "Recall pending"], [p.descent, "Descent pending"], [p.resting, "Resting"], [p.running, "Running"], [p.repeat, `Repeating: ${p.repeat}`], [p.unignoring, "Showing ignored items"]]) {
    if (condition) node(mount, "div", "", label2);
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

// src/panels/message-log.ts
var ink = { system: "#64a0b5b4", combat: "#c88f5fb4", loot: "#b1a962b4", other: "#5b8a71a0" };
function renderMessageLog(mount, model) {
  const previous = mount.querySelector("input")?.value ?? "";
  mount.replaceChildren();
  const heading = node(mount, "div", "heading", "Messages");
  if (model.message_pending === true) {
    heading.style.color = "#ffba4d";
    node(mount, "div", "ribbon", "Messages waiting");
  }
  const search = node(mount, "input");
  search.type = "search";
  search.placeholder = "Search messages";
  search.setAttribute("aria-label", "Search messages");
  search.value = previous;
  const list = node(mount, "div", "messages");
  const recent = model.messages.slice(0, 20);
  const draw = () => {
    list.replaceChildren();
    const match = search.value.toLocaleLowerCase();
    if (!recent.length) {
      node(list, "div", "muted", "No messages yet.");
      return;
    }
    for (const [index, message] of recent.entries()) {
      if (!message.text.toLocaleLowerCase().includes(match)) continue;
      const row = node(list, "div", "message", `${message.text}${index === 0 && (message.count ?? 1) > 1 ? ` (x${message.count})` : ""}`);
      const group = message.system ? "system" : message.group === "combat" ? "combat" : message.group === "loot" ? "loot" : "other";
      row.style.color = ink[group];
    }
  };
  search.addEventListener("input", draw);
  draw();
}

// src/accessibility.ts
var COLORBLIND_FILTER_ID = "anybandui-accessibility-colorblind";
var HIGH_CONTRAST_FILTER = "contrast(1.55) saturate(1.2)";
var COLORBLIND_MATRIX = "0.812 0.199 -0.011 0 0 0 1 0 0 0 -0.188 0.199 0.989 0 0 0 0 0 1 0";
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
function installAccessibilityAccommodations(ctx) {
  uninstallAccessibilityAccommodations();
  const filter = accessibilityFilter(ctx.flags);
  if (!filter) return;
  if (!ctx.display) {
    ctx.log?.("this game is too old for visual accessibility filters");
    return;
  }
  if (ctx.flags["anybandui.colourblind"] === true) ensureColorblindFilter();
  configuredDisplay = ctx.display;
  if (ctx.display.setVisualFilter.length >= 2) ctx.display.setVisualFilter(filter, { scope: "game" });
  else ctx.display.setVisualFilter(filter);
  setPanelHostVisualFilter(filter);
}
function uninstallAccessibilityAccommodations() {
  const display = configuredDisplay;
  configuredDisplay = null;
  if (display) {
    if (display.setVisualFilter.length >= 2) display.setVisualFilter(null, { scope: "game" });
    else display.setVisualFilter(null);
  }
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
  if (race.unique) return "unique";
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
var activeTimeout = null;
var activeTheme = THEMES["terminal-original"];
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
  drawCard(panel, content, activeTheme);
  const advance = () => {
    activePanel = null;
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
function characterKeyFor(player) {
  return characterKey({
    raceName: player.race.name,
    clsName: player.cls.name,
    auBirth: player.auBirth,
    htBirth: player.htBirth,
    wtBirth: player.wtBirth
  });
}
function installFirstEncounter(ctx) {
  uninstallFirstEncounter();
  if (!ctx.ui || typeof ctx.core.monsterListCollect !== "function" || typeof ctx.core.liveObjectIsKnownArtifact !== "function" || typeof ctx.core.fmtDepth !== "function" || typeof ctx.core.colorToCss !== "function") {
    ctx.log?.("this game is too old for first-encounter alerts");
    return;
  }
  const ui = ctx.ui;
  activeTheme = ctx.theme ?? THEMES["terminal-original"];
  const core = ctx.core;
  const key = characterKeyFor(ctx.state.actor.player);
  const notebook = readFirstEncounterNotebook(ctx.prefs?.get(), key);
  const save = () => ctx.prefs?.set(withFirstEncounterNotebook(ctx.prefs?.get(), key, notebook));
  timer = setInterval(() => {
    let visible;
    try {
      visible = core.monsterListCollect(ctx.state).entries.map((entry2) => entry2.race);
    } catch (error) {
      ctx.log?.(`first-encounter alerts: could not read visible monsters: ${String(error)}`);
      return;
    }
    const newMonsters = newMonsterSightings(visible, notebook.monsters);
    let carried;
    try {
      carried = carriedKnownArtifacts(ctx.state.gear.store.values(), core.liveObjectIsKnownArtifact);
    } catch (error) {
      ctx.log?.(`first-encounter alerts: could not read carried gear: ${String(error)}`);
      return;
    }
    const newArtifacts = newArtifactFinds(carried, notebook.artifacts);
    if (newMonsters.length === 0 && newArtifacts.length === 0) return;
    for (const race of newMonsters) notebook.monsters.add(race.ridx);
    for (const artifact of newArtifacts) notebook.artifacts.add(artifact.aidx);
    save();
    const depth = ctx.state.chunk.depth;
    for (const race of newMonsters) {
      queue.push(monsterCardContent(race, depth, core.fmtDepth, core.colorToCss, ctx.tiles));
    }
    for (const artifact of newArtifacts) {
      queue.push(artifactCardContent(artifact, core.fmtDepth));
    }
    showNext(ui);
  }, POLL_MS);
}
function uninstallFirstEncounter() {
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
function featureCode(cell) {
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
  return cell.remembered.featCode ?? builtIn[cell.remembered.feat];
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
    display.setFullMapOverview(false);
    if (appliedTileScaling) display.setTileScaling("auto");
  };
  if (!ctx.flags["anybandui.mapOverview"] && !ctx.flags["anybandui.mapSchematic"] || typeof document === "undefined" || typeof window === "undefined") {
    return restoreDisplay;
  }
  const theme = THEMES[validateSettings(ctx.prefs?.get()).theme];
  const strip = document.createElement("div");
  strip.style.cssText = `position:fixed;z-index:900;display:none;height:24px;align-items:center;gap:8px;padding:0 6px;background:${theme.surface};color:${theme.text};font:12px sans-serif`;
  const fit = document.createElement("button");
  fit.textContent = "Fit floor";
  const center = document.createElement("button");
  center.textContent = "Centre on player";
  const readout = document.createElement("span");
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
        known = ctx.knownLevel?.() ?? null;
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
        for (const cell of known.cells) {
          const x = (cell.x - snap.viewport.origin.x) * cw, y = (cell.y - snap.viewport.origin.y) * ch;
          if (x + cw < 0 || y + ch < 0 || x >= rect.width || y >= rect.height) continue;
          if (ctx.flags["anybandui.mapSchematic"]) {
            g.fillStyle = schematicColour(featureCode(cell));
            g.fillRect(x, y, Math.ceil(cw), Math.ceil(ch));
          }
          const kind = landmarkKind(featureCode(cell));
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
        const player = ctx.state?.actor?.grid;
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
    const player = ctx.state?.actor?.grid;
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
  for (const cell of cells) {
    if (!landmarkKind(featureCode(cell))) continue;
    const x = rect.x + (cell.x - snapshot.viewport.origin.x + 0.5) * cellW;
    const y = rect.y + (cell.y - snapshot.viewport.origin.y + 0.5) * cellH;
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance < nearest) {
      nearest = distance;
      chosen = { x: cell.x, y: cell.y };
    }
  }
  return chosen;
}
function knownCard(core, state, grid, map) {
  const look = core.describeLookGrid(state, grid, 0);
  const text = look?.text?.trim();
  if (!text) return null;
  const self = state.actor?.grid?.x === grid.x && state.actor?.grid?.y === grid.y;
  const hallucinating = core.TMD?.IMAGE !== void 0 && (state.actor?.player?.timed?.[core.TMD.IMAGE] ?? 0) > 0;
  const pile = hallucinating ? [] : core.knownPile?.(state, grid) ?? [];
  const kind = self ? "You are here" : look.mon ? "Creature" : pile.length > 0 ? "Items" : "Terrain";
  const lines = [`${map ? `(${grid.x}, ${grid.y}) - ` : ""}${kind}`, text];
  if (hallucinating) {
    lines.push("Appearance unreliable (hallucinating)");
    return lines.join("\n");
  }
  const hp = self ? state.actor?.player?.chp : look.mon?.hp;
  const max = self ? state.actor?.player?.mhp : look.mon?.maxhp;
  if (typeof hp === "number" && typeof max === "number" && max > 0) {
    const count = Math.max(0, Math.min(10, Math.round(10 * hp / max)));
    lines.push(`[${"#".repeat(count)}${"-".repeat(10 - count)}]`);
  }
  if (self && core.TMD && state.actor?.player?.timed) {
    const statuses = Object.entries(core.TMD).filter(([, index]) => (state.actor?.player?.timed?.[index] ?? 0) > 0).map(([name]) => name.toLowerCase().replaceAll("_", " "));
    if (statuses.length) lines.push(`Statuses: ${statuses.join(", ")}`);
  }
  const terrain = core.squareApparentName?.(state, grid);
  if (terrain) lines.push(`Terrain: ${terrain}`);
  const visible = core.squareIsSeen?.(state.chunk, grid) ?? false;
  for (const entry2 of pile.slice(0, 5)) {
    lines.push(entry2.sensed || !entry2.obj || !core.describeObject ? "Remembered item" : `${visible ? "Ground" : "Remembered"}: ${core.describeObject(state, entry2.obj)}`);
  }
  if (pile.length > 5) lines.push("More items; use Look");
  return lines.join("\n");
}
function installHoverCards(ctx) {
  if (!ctx.flags["anybandui.mapHoverCards"] && !ctx.flags["anybandui.dungeonHoverCards"]) return () => {
  };
  if (!ctx.core?.describeLookGrid || !ctx.display || typeof document === "undefined" || typeof window === "undefined") {
    ctx.log?.("hover cards: look or display API unavailable");
    return () => {
    };
  }
  const core = ctx.core, display = ctx.display;
  const settings = validateSettings(ctx.prefs?.get());
  const theme = THEMES[settings.theme];
  const card = document.createElement("div");
  card.setAttribute("role", "tooltip");
  card.style.cssText = `position:fixed;z-index:1000;display:none;pointer-events:none;white-space:pre-wrap;max-width:320px;padding:8px 10px;border:1px solid ${theme.accent};border-radius:${theme.rounding}px;background:${theme.surface};color:${theme.text};font:13px/1.35 sans-serif;box-shadow:0 4px 16px #0008`;
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
    const input = ctx.snapshot?.();
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
        known = ctx.knownLevel?.() ?? null;
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
    if (!ctx.state) return;
    const content = knownCard(core, ctx.state, grid, map);
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
var HOVER_DWELL_MS = 2e3;
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
function hoverCardContent(core, state, grid) {
  const result = core.describeLookGrid(state, grid, 0);
  const text = result?.text?.trim() ?? "";
  if (!text) return null;
  const player = state.actor?.grid;
  let kind;
  if (player && player.x === grid.x && player.y === grid.y) {
    kind = "character";
  } else if (result.mon) {
    kind = "creature";
  } else if (core.knownPile(state, grid).length > 0) {
    kind = "item";
  } else if (core.squareIsVisibleTrap?.(state, grid)) {
    kind = "trap";
  } else if ((state.chunk?.feature?.(grid)?.shopnum ?? 0) > 0) {
    kind = "shop";
  } else {
    kind = "terrain";
  }
  return { kind, text, title: KIND_TITLE[kind] };
}
var hoverCardsWired = false;
function positionHoverCard(el5, clientX, clientY) {
  const GAP = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el5.offsetWidth;
  const h = el5.offsetHeight;
  let left = clientX + GAP;
  let top = clientY + GAP;
  if (left + w > vw) left = clientX - GAP - w;
  if (top + h > vh) top = clientY - GAP - h;
  el5.style.left = `${String(Math.max(0, left))}px`;
  el5.style.top = `${String(Math.max(0, top))}px`;
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
  if (!ctx.core || typeof ctx.core.describeLookGrid !== "function" || typeof ctx.core.knownPile !== "function") return () => {
  };
  hoverCardsWired = true;
  const abort = new AbortController();
  const core = ctx.core;
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
    const state = ctx.state;
    const chunk = state?.chunk;
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
    const cell = hoverCellAt(game.getBoundingClientRect(), clientX, clientY);
    if (!cell) return null;
    const grid = hoverCaveGrid(cell.col, cell.row, chunk.width, chunk.height);
    if (!grid) return null;
    return {
      grid,
      cell,
      view: { origin: { x: 0, y: 0 }, size: { width: chunk.width, height: chunk.height } },
      termSize: { cols: TERM_COLS, rows: TERM_ROWS }
    };
  };
  const showAt = (clientX, clientY, resolved) => {
    const state = ctx.state;
    if (!state) return false;
    const content = hoverCardContent(core, state, resolved.grid);
    if (!content) return false;
    paintHoverCardText(card.title, content.title, "#f0d878", HOVER_CARD_TITLE_MAX_CHARS, false);
    paintHoverCardText(card.body, content.text, "#e8e8e8", HOVER_CARD_BODY_MAX_CHARS, true);
    const painted = paintTilePreview(
      card.img,
      resolved.grid,
      resolved.cell,
      resolved.view,
      resolved.termSize
    );
    card.img.style.display = painted ? "block" : "none";
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
    }, HOVER_DWELL_MS);
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

// src/view-model/items.ts
function adaptItems(snap) {
  if (!snap.core.inventory || !snap.core.equipment) return null;
  const row = (item, location2, slot) => ({
    handle: item.handle,
    label: item.label,
    quantity: item.number,
    location: location2,
    ...slot === void 0 ? {} : { slot },
    colour: item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit",
    inscription: item.inscription,
    family: item.kindId ?? `${item.tval}:${item.sval}`
  });
  return {
    token: snap.token,
    phase: snap.phase,
    prompt: snap.prompt,
    rows: [
      ...snap.core.inventory.map((item) => row(item, "pack")),
      ...snap.core.equipment.flatMap((item, slot) => item ? [row(item, "equipment", slot)] : [])
    ]
  };
}
function compareItem(ctx, token, handle) {
  if (!ctx.core?.createAgentView || !ctx.state) return null;
  const before = ctx.snapshot?.();
  if (!before || before.token.epoch !== token.epoch || before.token.revision !== token.revision) return null;
  const ref = typeof handle === "number" ? { from: "gear", handle } : { from: "store", ...handle };
  return ctx.core.createAgentView(ctx.state).simulateLoadout?.({ wield: [ref] }) ?? null;
}
var AcquisitionChanges = class {
  previous = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  epoch;
  update(model) {
    if (model.phase !== "play" && model.phase !== "store") {
      this.previous.clear();
      this.pending.clear();
      this.epoch = void 0;
      return;
    }
    if (this.epoch !== model.token.epoch) {
      this.previous.clear();
      this.pending.clear();
      this.epoch = model.token.epoch;
    }
    const current = /* @__PURE__ */ new Map();
    const family = /* @__PURE__ */ new Map();
    for (const item of model.rows) {
      if (!item.handle) continue;
      const key = `${item.family}:${item.handle}`;
      current.set(key, (current.get(key) ?? 0) + Math.max(0, item.quantity));
      family.set(item.family, (family.get(item.family) ?? 0) + Math.max(0, item.quantity));
    }
    const previousFamily = /* @__PURE__ */ new Map();
    for (const [key, count] of this.previous) {
      const name = key.slice(0, key.lastIndexOf(":"));
      previousFamily.set(name, (previousFamily.get(name) ?? 0) + count);
    }
    for (const [key, count] of current) {
      const name = key.slice(0, key.lastIndexOf(":"));
      const added = Math.min(Math.max(0, count - (this.previous.get(key) ?? 0)), Math.max(0, (family.get(name) ?? 0) - (previousFamily.get(name) ?? 0)));
      if (added) this.pending.set(key, { amount: Math.min(count, (this.pending.get(key)?.amount ?? 0) + added), fresh: (this.previous.get(key) ?? 0) === 0 });
    }
    for (const [key, value2] of this.pending) {
      const count = current.get(key) ?? 0;
      if (!count) this.pending.delete(key);
      else if (value2.amount > count) this.pending.set(key, { ...value2, amount: count });
    }
    this.previous = current;
  }
  badge(item) {
    const entry2 = this.pending.get(`${item.family}:${item.handle}`);
    return entry2 ? entry2.fresh ? "NEW" : `+${entry2.amount}` : null;
  }
  acknowledge(item) {
    this.pending.delete(`${item.family}:${item.handle}`);
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
function buildItemCommand(builders, code, handle, inscription) {
  if (code === "wield") return builders?.wear(handle) ?? { code, args: { handle } };
  if (code === "takeoff") return builders?.takeoff(handle) ?? { code, args: { handle } };
  if (code === "drop") return builders?.drop(handle) ?? { code, args: { handle } };
  const args = inscription === void 0 ? { handle } : { handle, inscription };
  return builders?.raw(code, args) ?? { code, args };
}
function submitItem(intent, inspect, token, code, handle, command) {
  const tester = inspect?.itemTester(code);
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "handle" in item && item.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return intent?.submit(token, { kind: "command", command }) ?? { accepted: false, reason: "Intent seam unavailable." };
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
function renderItemComparison(parent, sim, unchanged, toggle) {
  if (sim.unresolved.length) return;
  const details = el(parent, "details");
  details.open = true;
  el(details, "summary", "Equipment comparison");
  if (!sim.placements.length) {
    el(details, "p", "No compatible equipment slot.");
    return;
  }
  const placement = sim.placements[0];
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

// src/input-owner.ts
function playerIsDriving(ctx) {
  return (ctx?.controller?.driver?.()?.kind ?? "player") === "player";
}

// src/panels/items.ts
var CSS2 = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.items{position:absolute;right:12px;top:12px;width:min(440px,44vw);max-height:calc(100vh - 24px);overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,input,select{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 5px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}input[type=search]{width:100%}.tabs,.actions,.quick{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}table{width:100%;border-collapse:collapse}th{text-align:left;position:sticky;top:0;background:var(--anyband-surface)}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}tr.new{background:#437d5541}.row{width:100%;text-align:left;border:0;background:transparent}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer;font-weight:bold}.muted{opacity:.65}.gain{color:#80b891}.loss{color:#ff7559}.error{color:#ff7559}.prompt{border:1px solid var(--anyband-accent);padding:8px;margin:8px 0}`;
var ACTIONS = ["wield", "takeoff", "drop", "inscribe", "use"];
var ACTION_LABELS = { wield: "Wield", takeoff: "Take off", drop: "Drop", inscribe: "Inscribe", use: "Use" };
var USE_CODES = ["activate", "use-staff", "aim-wand", "zap-rod", "eat", "quaff", "read"];
function el2(parent, tag, text) {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== void 0) child.textContent = text;
  parent.appendChild(child);
  return child;
}
function button(parent, label2, action) {
  const b = el2(parent, "button", label2);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function same(a, b) {
  return a.epoch === b.epoch && a.revision === b.revision;
}
function installItems(ctx) {
  const flags = ctx.flags ?? {};
  if (!Object.entries(flags).some(([key, on]) => key.startsWith("anybandui.items") && on && (key !== "anybandui.itemsRules" || !!ctx.inspect?.itemRules))) return () => {
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
  let search = "";
  let selected = null;
  let unchanged = false;
  let quantity = 1;
  let promptId = -1;
  let error = "";
  let signature = "";
  let closed = false;
  const enabled = (name) => flags[`anybandui.items${name}`] === true;
  const read = () => {
    const snap = ctx.snapshot?.();
    return snap?.core ? adaptItems(snap) : null;
  };
  const usable = (model, item, code) => {
    const tester = ctx.inspect?.itemTester(code);
    return !!tester && same(tester.token, model.token) && tester.items.some((ref) => "handle" in ref && ref.handle === item.handle);
  };
  const act = (model, item, code) => {
    const latest = read();
    if (!latest || !same(latest.token, model.token) || latest.phase !== "play" || latest.prompt || !ctx.intent?.submit || !playerIsDriving(ctx)) {
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
    const builders = ctx.core?.createAgentActions?.(ctx.state);
    let inscription;
    if (code === "inscribe") {
      const input = globalThis.prompt?.("Inscription", item.inscription ?? "");
      if (input === null || input === void 0) return;
      inscription = input;
    }
    const command = buildItemCommand(builders, actualCode, item.handle, inscription);
    const result = submitItem(ctx.intent, ctx.inspect, model.token, actualCode, item.handle, command);
    error = result.accepted ? "" : result.reason ?? "Action rejected.";
    paint(true);
  };
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
      const box = el2(mount, "section");
      box.className = "prompt";
      el2(box, "h3", "Choose quantity");
      el2(box, "p", q.label);
      el2(box, "p", `Available for this action: ${q.max}`);
      const input = el2(box, "input");
      input.type = "number";
      input.min = String(q.min);
      input.max = String(q.max);
      input.value = String(quantity);
      input.addEventListener("input", () => {
        quantity = Number(input.value);
      });
      const quick = el2(box, "div");
      quick.className = "quick";
      for (const label2 of ["One", "Half", "All"]) button(quick, label2, () => {
        quantity = quantityShortcut(q, label2);
        input.value = String(quantity);
      });
      button(box, "Confirm", () => {
        const result = answerQuantity(ctx.prompt, q, quantity);
        error = result.accepted ? "" : result.reason ?? "Prompt rejected.";
        paint(true);
      });
    } else if (prompt.kind === "item" && enabled("Choice")) {
      const p = prompt;
      if (promptId !== p.promptId) {
        promptId = p.promptId;
        selected = p.choices[0]?.handle ?? null;
      }
      const box = el2(mount, "section");
      box.className = "prompt";
      el2(box, "h3", "Angband asks");
      el2(box, "p", p.label);
      const table = el2(box, "table");
      const head = el2(table, "tr");
      for (const name of ["Key", "Item", "Location", "Qty"]) el2(head, "th", name);
      for (const choice of p.choices) {
        const item = model.rows.find((row2) => row2.handle === choice.handle);
        const row = el2(table, "tr");
        el2(row, "td", choice.letter);
        const cell = el2(row, "td");
        button(cell, choice.label, () => {
          selected = choice.handle;
          paint(true);
        });
        el2(row, "td", item?.location ?? "Floor");
        el2(row, "td", item ? String(item.quantity) : "");
      }
      const current = p.choices.find((choice) => choice.handle === selected);
      if (current && selected !== null) {
        const inspection = ctx.inspect?.inspectItem(selected);
        if (inspection && same(inspection.token, model.token)) el2(box, "p", inspection.text);
      }
      const choose = button(box, "Choose", () => {
        if (current) {
          const result = answerItem(ctx.prompt, p, current.handle);
          error = result.accepted ? "" : result.reason ?? "Prompt rejected.";
          paint(true);
        }
      });
      choose.disabled = !current;
    }
  };
  const showComparison = (model, item) => {
    if (!enabled("Comparison") || item.location !== "pack") return;
    const sim = compareItem(ctx, model.token, item.handle);
    if (sim) renderItemComparison(mount, sim, unchanged, (value2) => {
      unchanged = value2;
      paint(true);
    });
  };
  const paint = (force = false) => {
    if (closed) return;
    const current = surfaces.mounts().get("items");
    if (!current) return;
    if (current !== mount) {
      mount = current;
      signature = "";
    }
    const model = read();
    mount.getRootNode().host.style.display = model?.phase === "store" ? "none" : "";
    if (model?.phase === "store") return;
    const next = JSON.stringify([model, tab, search, selected, unchanged, quantity, error]);
    if (!force && next === signature) return;
    signature = next;
    mount.replaceChildren();
    el2(mount, "h2", "Items");
    if (!model) {
      el2(mount, "p", "Inventory read unavailable.");
      return;
    }
    if (enabled("Highlights")) changes.update(model);
    showPrompt(model);
    const rules = enabled("Rules") ? ctx.inspect?.itemRules?.() ?? null : null;
    if (rules && same(rules.token, model.token)) {
      const section2 = el2(mount, "details");
      el2(section2, "summary", "Ignore settings and inscriptions");
      const lines = itemRuleLines(rules);
      if (!lines.length) el2(section2, "p", "No ignore settings or inscriptions yet.");
      for (const line of lines) el2(section2, "div", line);
    }
    if (!enabled("Lists")) return;
    const tabs = el2(mount, "div");
    tabs.className = "tabs";
    for (const name of ["pack", "equipment", "quiver"]) {
      const b = button(tabs, name[0].toUpperCase() + name.slice(1), () => {
        tab = name;
        paint(true);
      });
      b.setAttribute("aria-pressed", String(tab === name));
    }
    const searchBox = el2(mount, "input");
    searchBox.type = "search";
    searchBox.placeholder = "Search items";
    searchBox.value = search;
    searchBox.addEventListener("input", () => {
      search = searchBox.value;
      paint(true);
      mount.querySelector("input[type=search]")?.focus();
    });
    const rows = model.rows.filter((item2) => item2.location === tab && item2.label.toLowerCase().includes(search.toLowerCase()));
    if (!rows.length) el2(mount, "p", tab === "pack" ? "Your pack is empty." : tab === "equipment" ? "Nothing equipped." : "No quiver items available.");
    const table = el2(mount, "table");
    const head = el2(table, "tr");
    for (const name of tab === "equipment" ? ["Item", "Slot", "Qty"] : ["Item", "Qty"]) el2(head, "th", name);
    for (const item2 of rows) {
      const row = el2(table, "tr");
      const badge = enabled("Highlights") ? changes.badge(item2) : null;
      if (badge) row.className = "new";
      const cell = el2(row, "td");
      const b = button(cell, `${item2.label}${badge ? ` ${badge}` : ""}`, () => {
        selected = item2.handle;
        changes.acknowledge(item2);
        paint(true);
      });
      b.className = "row";
      b.style.color = item2.colour;
      b.title = [badge === "NEW" ? "Newly acquired" : badge ? `${badge.slice(1)} acquired` : "", item2.inscription ? `Inscription: ${item2.inscription}` : ""].filter(Boolean).join("\n");
      if (tab === "equipment") el2(row, "td", String(item2.slot ?? ""));
      el2(row, "td", String(item2.quantity));
    }
    const item = model.rows.find((row) => row.handle === selected);
    if (item) {
      el2(mount, "h3", "Inspection");
      el2(mount, "strong", item.label);
      if (enabled("Actions") && model.phase === "play" && !model.prompt && ctx.intent?.submit && playerIsDriving(ctx)) {
        const actions = el2(mount, "div");
        actions.className = "actions";
        for (const code of ACTIONS) {
          if (code === "use" ? USE_CODES.some((candidate) => usable(model, item, candidate)) : usable(model, item, code)) button(actions, ACTION_LABELS[code], () => act(model, item, code));
        }
      }
      showComparison(model, item);
      if (enabled("Inspection")) {
        const inspection = ctx.inspect?.inspectItem(item.handle);
        if (inspection && same(inspection.token, model.token)) {
          const details = el2(mount, "details");
          details.open = true;
          el2(details, "summary", inspection.title);
          el2(details, "p", inspection.text);
        }
      }
    }
    if (error) {
      const message = el2(mount, "p", error);
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

// src/map-mouse.ts
function ready(snap) {
  return !!snap && snap.phase === "play" && !snap.messagePending && !snap.prompt && !!snap.core.player;
}
function sameToken(a, b) {
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
  const walk = walkIntent(snap.core.player.grid, at);
  if (walk) actions.push({ label: "Walk here", intent: walk });
  actions.push({ label: "Look", intent: { kind: "command", command: { code: "look" } } });
  actions.push({ label: "Target", intent: { kind: "target", ...at } });
  const known = ctx.knownLevel?.();
  if (known && sameToken(known.token, snap.token) && known.cells.some((cell) => cell.x === at.x && cell.y === at.y && cell.remembered.objects.length > 0)) {
    actions.push({ label: "Pick up", pickup: true });
  }
  const offered = ctx.inspect?.tileActions?.(at);
  if (offered && sameToken(offered.token, snap.token)) {
    const player = snap.core.player.grid;
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
function clickTile(ctx, at) {
  if (!playerIsDriving(ctx)) return false;
  const snap = ctx.snapshot?.() ?? null;
  if (snap?.prompt?.kind === "target") return !!ctx.prompt?.reply(snap.prompt.promptId, { action: "move", ...at }).accepted;
  if (!ready(snap) || !snap || !ctx.intent) return false;
  const intent = walkIntent(snap.core.player.grid, at);
  return !!intent && ctx.intent.submit(snap.token, intent).accepted;
}
function runMenuAction(ctx, at, label2) {
  if (!playerIsDriving(ctx)) return false;
  const snap = ctx.snapshot?.() ?? null;
  if (!snap) return false;
  const action = tileMenuActions(ctx, snap, at).find((item) => item.label === label2);
  if (!action) return false;
  if (action.promptAction) return !!ctx.prompt?.reply(snap.prompt.promptId, { action: action.promptAction }).accepted;
  if (!ctx.intent) return false;
  if (action.pickup) {
    const grid = snap.core.player.grid;
    if (grid.x === at.x && grid.y === at.y) return ctx.intent.submit(snap.token, { kind: "command", command: { code: "pickup" } }).accepted;
    const travel = { kind: "travel", ...at };
    return ctx.intent.submit(snap.token, travel).accepted;
  }
  return !!action.intent && ctx.intent.submit(snap.token, action.intent).accepted;
}
function finishPickup(ctx, at, previous) {
  if (!playerIsDriving(ctx)) return false;
  const next = ctx.snapshot?.() ?? null;
  if (!ready(next) || !next || sameToken(previous.token, next.token) || !ctx.intent) return false;
  const grid = next.core.player.grid;
  if (grid.x !== at.x || grid.y !== at.y) return false;
  const level = ctx.knownLevel?.();
  if (!level || !sameToken(level.token, next.token) || !level.cells.some((cell) => cell.x === at.x && cell.y === at.y && cell.remembered.objects.length > 0)) return false;
  return ctx.intent.submit(next.token, { kind: "command", command: { code: "pickup" } }).accepted;
}
function aimingPath(ctx, snap, hovered) {
  if (snap?.prompt?.kind !== "target" && snap?.prompt?.kind !== "direction") return [];
  if (snap.prompt.path) return snap.prompt.path;
  const cursor = snap.prompt.cursor ?? hovered;
  const path = cursor ? ctx.inspect?.projectionPath?.(cursor) : null;
  return path && sameToken(path.token, snap.token) ? path.grids : [];
}
function walkingPath(ctx, snap, hovered) {
  if (!ready(snap) || !snap || !hovered) return [];
  const path = ctx.inspect?.travelPath?.(hovered);
  return path && sameToken(path.token, snap.token) ? path.grids : [];
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
  const theme = THEMES[validateSettings(ctx.prefs?.get()).theme];
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Dungeon actions");
  menu.style.cssText = `display:none;position:fixed;z-index:1002;background:${theme.surface};color:${theme.text};border:1px solid ${theme.accent};border-radius:${theme.rounding}px;padding:4px`;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:49";
  document.body.append(menu, canvas);
  let menuAt = null;
  let menuToken = null;
  let menuPromptId = null;
  let pickupAt = null;
  let pickupSnap = null;
  let targetAt = null;
  let targetPromptId = null;
  let hovered = null;
  const hide = () => {
    menu.style.display = "none";
    menu.replaceChildren();
    menuAt = null;
  };
  const locate = (event) => {
    const snap = display.snapshot();
    const input = ctx.snapshot?.() ?? null;
    if (snap.mode !== "play" && !(snap.mode === "modal" && (input?.prompt?.kind === "target" || input?.prompt?.kind === "direction"))) return null;
    const grid = hoverGrid(snap, { x: event.clientX, y: event.clientY });
    return grid && grid.x < snap.level.width && grid.y < snap.level.height ? grid : null;
  };
  const onClick = (event) => {
    if (event.button !== 0) return;
    if (menu.contains(event.target)) return;
    hide();
    if (!flags["anybandui.clickToWalk"]) return;
    const at = locate(event);
    const prompt = ctx.snapshot?.()?.prompt;
    if (at && clickTile(ctx, at)) {
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
    const at = locate(event), snap = ctx.snapshot?.() ?? null;
    if (!at || !snap || !playerIsDriving(ctx) || !(ready(snap) || snap.prompt?.kind === "target")) return;
    const actions = tileMenuActions(ctx, snap, at);
    if (!actions.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    menuAt = at;
    menuToken = snap.token;
    menuPromptId = snap.prompt?.promptId ?? null;
    for (const action of actions) {
      const button4 = document.createElement("button");
      button4.type = "button";
      button4.setAttribute("role", "menuitem");
      button4.textContent = action.label;
      button4.style.cssText = `display:block;width:100%;text-align:left;background:${theme.surface};color:${theme.text};border:0;padding:5px 9px;cursor:pointer`;
      button4.addEventListener("click", () => {
        const current = ctx.snapshot?.() ?? null;
        if (!menuAt || !current || !menuToken || !sameToken(menuToken, current.token) || menuPromptId !== (current.prompt?.promptId ?? null)) {
          hide();
          return;
        }
        const selected = menuAt;
        if (action.promptAction === "select" && current.prompt?.kind === "target") {
          if (ctx.prompt?.reply(current.prompt.promptId, { action: "move", ...selected }).accepted) {
            targetAt = selected;
            targetPromptId = current.prompt.promptId;
          }
        } else if (action.pickup && current.core.player && (current.core.player.grid.x !== selected.x || current.core.player.grid.y !== selected.y)) {
          if (runMenuAction(ctx, selected, action.label)) {
            pickupAt = selected;
            pickupSnap = current;
          }
        } else runMenuAction(ctx, selected, action.label);
        hide();
      });
      menu.appendChild(button4);
    }
    menu.style.display = "block";
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - menu.offsetWidth)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - menu.offsetHeight)}px`;
    menu.firstElementChild?.focus();
  };
  const onKey = (event) => {
    if (event.key === "Escape") hide();
  };
  const onMove = (event) => {
    hovered = locate(event);
  };
  const render = () => {
    if (pickupAt && pickupSnap) {
      const next = ctx.snapshot?.() ?? null;
      if (next && !sameToken(next.token, pickupSnap.token)) {
        finishPickup(ctx, pickupAt, pickupSnap);
        pickupAt = null;
        pickupSnap = null;
      }
    }
    if (targetAt && targetPromptId !== null) {
      const next = ctx.snapshot?.()?.prompt;
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
    const snap = ctx.snapshot?.() ?? null;
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
    window.clearInterval(timer2);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("contextmenu", onContext, true);
    window.removeEventListener("keydown", onKey);
    hide();
    menu.remove();
    canvas.remove();
  };
}

// src/view-model/spells.ts
var sameToken2 = (a, b) => a.epoch === b.epoch && a.revision === b.revision;
var itemKey = (item) => item.kindId ?? `${item.tval}:${item.sval}`;
function adaptSpells(snap, inspect) {
  if (!snap.core.spellbooks || !snap.core.inventory || !snap.core.player) return null;
  const books = [];
  for (const book of snap.core.spellbooks) for (const item of snap.core.inventory) {
    if (item.tval !== book.tval) continue;
    const siblings = snap.core.spellbooks.filter((entry2) => entry2.tval === book.tval);
    if (siblings.length !== 1 && inspect?.bookForItem?.(item.handle) !== book.spells[0]?.bidx) continue;
    const spells = book.spells.map((spell) => {
      const info = inspect?.spellInfo?.(spell.sidx);
      const detail = info && sameToken2(info.token, snap.token) ? info : null;
      const canCast = !!detail?.canCastNow && spell.learned && !spell.forgotten;
      const canStudy = !spell.learned && !spell.forgotten && spell.level <= (snap.core.player?.level ?? 0);
      return {
        index: spell.sidx,
        name: spell.name,
        level: spell.level,
        mana: detail?.mana ?? spell.mana,
        fail: detail?.failChance ?? spell.chance ?? spell.fail,
        canCast,
        canStudy,
        state: spell.forgotten ? "Forgotten" : spell.learned ? canCast ? "Castable" : "Unavailable" : canStudy ? "Learnable" : "Unknown",
        description: detail?.description ?? "Description unavailable."
      };
    });
    books.push({ key: itemKey(item), handle: item.handle, name: item.label, chooseSpells: snap.core.player.classFlags?.includes("CHOOSE_SPELLS") ?? true, spells });
  }
  return { token: snap.token, books };
}

// src/spell-actions.ts
function actionReady(ctx, snap) {
  const next = ctx.snapshot?.();
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
  const next = ctx.snapshot?.();
  if (snap.prompt?.kind !== "spell" || !next || !sameToken2(next.token, snap.token) || next.prompt?.promptId !== snap.prompt.promptId || !playerIsDriving(ctx)) return false;
  if (!snap.prompt.choices.some((choice) => choice.index === index)) return false;
  return ctx.prompt?.reply(snap.prompt.promptId, index).accepted ?? false;
}
function rest(ctx, snap, count) {
  if (!actionReady(ctx, snap) || ![-3, -2, -1].includes(count) && (!Number.isInteger(count) || count < 1 || count > 9999)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "rest", args: { count } } }).accepted ?? false;
}

// src/quickbar.ts
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
    if (b.type === "command" && b.code === "rest" && typeof b.name === "string") return b;
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
function itemBindings(snap, ctx) {
  const codes = ["quaff", "read", "aim-wand", "activate"];
  return (snap.core.inventory ?? []).flatMap((item) => codes.filter((code) => {
    const result = ctx.inspect?.itemTester?.(code);
    return result?.token.epoch === snap.token.epoch && result.token.revision === snap.token.revision && result.items.some((entry2) => "handle" in entry2 && entry2.handle === item.handle);
  }).map((code) => ({ type: "item", key: itemKey(item), code, name: item.label })));
}
function resolve(snap, binding, spells, ctx) {
  if (!binding) return { label: "Empty", detail: "Right-click to assign.", usable: false };
  if (binding.type === "command") return { label: "Rest", detail: "Rest until fully recovered.", usable: true, command: { code: "rest", args: { count: -2 } } };
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
  const item = snap.core.inventory?.find((entry2) => itemKey(entry2) === binding.key);
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

// src/blast-preview.ts
function installBlastPreview(ctx) {
  if (!ctx.snapshot || !ctx.inspect?.blastArea || !ctx.inspect.projectionPath || !ctx.display?.snapshot || !ctx.targeting?.blastRadius) {
    ctx.log("blast preview: targeting radius or inspection seam unavailable");
    return () => {
    };
  }
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;z-index:50;pointer-events:none";
  document.body.append(canvas);
  const render = () => {
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(window.innerWidth * scale);
    canvas.height = Math.ceil(window.innerHeight * scale);
    const paint = canvas.getContext("2d");
    if (!paint) return;
    paint.scale(scale, scale);
    const snap = ctx.snapshot?.();
    const prompt = snap?.prompt;
    if (!snap || prompt?.kind !== "target" || !prompt.cursor) return;
    const radius = ctx.targeting?.blastRadius();
    if (!radius || radius <= 0) return;
    const blast = ctx.inspect?.blastArea?.(prompt.cursor, radius);
    const path = ctx.inspect?.projectionPath?.(prompt.cursor);
    if (!blast || !path || !sameToken2(blast.token, snap.token) || !sameToken2(path.token, snap.token)) return;
    const view = ctx.display.snapshot();
    const rect = mapProjection(view);
    if (!rect) return;
    const width = rect.width / view.viewport.size.width, height = rect.height / view.viewport.size.height;
    paint.beginPath();
    paint.rect(rect.x, rect.y, rect.width, rect.height);
    paint.clip();
    const cells = new Set(blast.grids.map((grid) => `${grid.x},${grid.y}`));
    for (const grid of blast.grids) {
      const x = rect.x + (grid.x - view.viewport.origin.x) * width, y = rect.y + (grid.y - view.viewport.origin.y) * height;
      paint.fillStyle = "rgba(245,185,70,.095)";
      paint.fillRect(x, y, width, height);
      paint.strokeStyle = "rgba(245,190,80,.745)";
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
  const timer2 = window.setInterval(render, 50);
  return () => {
    window.clearInterval(timer2);
    canvas.remove();
  };
}

// src/phase4.ts
var CSS3 = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.phase4{position:fixed;left:12px;bottom:12px;width:min(680px,calc(100vw - 24px));max-height:55vh;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}button,select,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:4px}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--anyband-accent)}button:disabled{opacity:.45}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:3px;border-bottom:1px solid var(--anyband-accent)}.slots{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px}.slot{min-height:42px;overflow:hidden;word-break:break-word}.muted{opacity:.55}.row{width:100%;text-align:left;border:0;background:transparent}.menu{margin:6px 0;padding:6px;border:1px solid var(--anyband-accent)}.menu button{margin:2px}.hint{font-size:12px}`;
function el3(parent, tag, content) {
  const node2 = parent.ownerDocument.createElement(tag);
  if (content !== void 0) node2.textContent = content;
  parent.append(node2);
  return node2;
}
function button2(parent, label2, callback) {
  const node2 = el3(parent, "button", label2);
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
function characterFor(ctx) {
  const own = ctx.character?.key?.();
  if (own) return own;
  const player = ctx.state?.actor?.player;
  if (!player || typeof player.race?.name !== "string" || typeof player.cls?.name !== "string" || typeof player.auBirth !== "number" || typeof player.htBirth !== "number" || typeof player.wtBirth !== "number") return null;
  return characterKey({ raceName: player.race.name, clsName: player.cls.name, auBirth: player.auBirth, htBirth: player.htBirth, wtBirth: player.wtBirth });
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
  ], { id: "phase4", label: "Spells and quickbar", className: "phase4" }, CSS3, () => repaint());
  if (!surfaces) {
    ctx.log("phase 4: panel seam unavailable");
    return blastCleanup;
  }
  let bookKey = "", spellIndex = -1, menu = -1, customize = -1, restOpen = false, restMode = -2, turns = 10, promptChoice = -1, error = "", signature = "", closed = false;
  let appearance = { style: "automatic", text: "", color: "#7abaf4" };
  let character = characterFor(ctx);
  let slots = character ? readSlots(ctx.prefs?.get(), character) : Array(30).fill(null);
  const save = () => {
    if (character) writeSlots(ctx, character, slots);
  };
  const assign = (index, binding) => {
    const next = [...slots];
    next[index] = binding;
    slots = next;
    save();
    menu = -1;
    paint(true);
  };
  const paint = (force = false) => {
    if (closed) return;
    const mounts = surfaces.mounts();
    const spellMount = spellOn ? mounts.get("spells") : void 0, quickMount = quickOn ? mounts.get("quickbar") : void 0, restMount = restOn ? mounts.get("rest") : void 0;
    if (!mounts.size) return;
    const snap = ctx.snapshot?.();
    const key = characterFor(ctx);
    if (key !== character) {
      character = key;
      slots = key ? readSlots(ctx.prefs?.get(), key) : Array(30).fill(null);
    }
    const model = snap ? adaptSpells(snap, ctx.inspect) : null;
    const sig = JSON.stringify([[...mounts.keys()], snap, slots, bookKey, spellIndex, menu, customize, appearance, restOpen, restMode, turns, promptChoice, error]);
    if (!force && sig === signature) return;
    signature = sig;
    for (const target of mounts.values()) target.replaceChildren();
    if (!snap) {
      for (const target of mounts.values()) el3(target, "p", "Game state unavailable.");
      return;
    }
    if (spellOn && spellMount) {
      el3(spellMount, "h2", "Spells");
      if (!model) el3(spellMount, "p", "Spell list unavailable.");
      else if (!model.books.length) el3(spellMount, "p", "No readable spellbooks carried.");
      else {
        const picker = el3(spellMount, "select");
        picker.setAttribute("aria-label", "Spellbook");
        for (const book2 of model.books) {
          const opt = el3(picker, "option", book2.name);
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
        const table = el3(spellMount, "table");
        const head = el3(table, "tr");
        for (const label2 of ["Spell", "Mana", "Fail", "State"]) el3(head, "th", label2);
        for (const spell of book.spells) {
          const row = el3(table, "tr");
          if (!spell.canCast && !spell.canStudy) row.className = "muted";
          const cell = el3(row, "td");
          const pick = button2(cell, spell.name, () => {
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
            menu = -2;
            spellIndex = spell.index;
            paint(true);
          });
          el3(row, "td", String(spell.mana));
          el3(row, "td", `${spell.fail}%`);
          el3(row, "td", spell.state);
        }
        const selected = book.spells.find((entry2) => entry2.index === spellIndex) ?? book.spells[0];
        if (selected) {
          const cast = button2(spellMount, "Cast", () => {
            if (!castSpell(ctx, snap, selected)) error = "Cast unavailable.";
            paint(true);
          });
          cast.disabled = !selected.canCast || !ctx.intent?.submit;
          const study = button2(spellMount, book.chooseSpells ? "Study" : "Study book", () => {
            if (!studySpell(ctx, snap, book, selected)) error = "Study unavailable.";
            paint(true);
          });
          study.disabled = !(book.chooseSpells ? selected.canStudy : book.spells.some((entry2) => entry2.canStudy)) || !ctx.intent?.submit;
          if (!book.chooseSpells) study.title = "Your class learns a random eligible spell from this book.";
          el3(spellMount, "h3", selected.name);
          el3(spellMount, "p", `Level ${selected.level}. Mana ${selected.mana}. Failure ${selected.fail}%. ${selected.state}.`);
          if (selected.canCast && (snap.core.player?.sp ?? 0) < selected.mana) el3(spellMount, "p", "Not enough mana. Confirmation may be required.");
          el3(spellMount, "p", selected.description);
          if (quickOn && menu === -2) {
            const box = el3(spellMount, "div");
            box.className = "menu";
            el3(box, "strong", "Assign spell to quickbar");
            for (let i = 0; i < 30; i++) button2(box, `${i < 10 ? "" : i < 20 ? "Shift+" : "Ctrl+"}${keys[i % 10]}`, () => assign(i, { type: "spell", key: book.key, index: selected.index, name: selected.name }));
          }
        }
      }
      if (snap.prompt?.kind === "spell" && ctx.prompt?.reply && playerIsDriving(ctx)) {
        const prompt = snap.prompt;
        const box = el3(spellMount, "div");
        box.className = "menu";
        el3(box, "h3", "Choose spell");
        el3(box, "p", prompt.label);
        for (const choice of prompt.choices) button2(box, choice.name, () => {
          promptChoice = choice.index;
          paint(true);
        });
        button2(box, "Choose", () => {
          if (!answerSpell(ctx, snap, promptChoice)) error = "Choice unavailable.";
          paint(true);
        });
        button2(box, "Cancel", () => {
          ctx.prompt?.reply(prompt.promptId, null);
          paint(true);
        });
      }
    }
    if (quickOn && quickMount && snap.phase === "play") {
      el3(quickMount, "h2", "Quickbar");
      if (!character) el3(quickMount, "p", "Assignments last for this game session.");
      for (let row = 0; row < 3; row++) {
        el3(quickMount, "h3", row === 0 ? "Number keys" : row === 1 ? "Shift and number" : "Ctrl and number");
        const line = el3(quickMount, "div");
        line.className = "slots";
        for (let col = 0; col < 10; col++) {
          const index = row * 10 + col;
          const binding = slots[index] ?? null;
          const result = resolve(snap, binding, model, ctx);
          const custom = binding?.appearance;
          const shown = custom?.style === "text" && custom.text ? custom.text : result.label;
          const slot = button2(line, `${keys[col]} ${shown}${result.amount ? ` - ${result.amount}` : ""}`, () => {
            if (!activate(ctx, snap, binding)) error = result.detail;
            paint(true);
          });
          slot.className = "slot" + (result.usable ? "" : " muted");
          slot.title = `Quickbar ${row === 0 ? "" : row === 1 ? "Shift+" : "Ctrl+"}${keys[col]}. ${result.detail}`;
          if (custom?.color && /^#[0-9a-f]{6}$/i.test(custom.color)) slot.style.borderColor = custom.color;
          if (custom && ["potion", "scroll", "wand"].includes(custom.style)) drawIcon(slot, custom.style);
          slot.setAttribute("aria-label", slot.title);
          slot.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            menu = index;
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
      if (menu >= 0) {
        const box = el3(quickMount, "div");
        box.className = "menu";
        el3(box, "strong", `Assign ${keys[menu % 10]}`);
        if (slots[menu]) button2(box, "Customize", () => {
          customize = menu;
          appearance = slots[menu]?.appearance ?? { style: "automatic", text: "", color: "#7abaf4" };
          menu = -1;
          paint(true);
        });
        button2(box, "Rest until recovered", () => assign(menu, { type: "command", code: "rest", name: "Rest" }));
        for (const binding of itemBindings(snap, ctx)) {
          const choice = button2(box, `${binding.code === "quaff" ? "Drink" : binding.code === "read" ? "Read" : binding.code === "aim-wand" ? "Aim" : "Activate"}: ${binding.name}`, () => assign(menu, binding));
          choice.draggable = true;
          choice.addEventListener("dragstart", (event) => event.dataTransfer?.setData("application/x-anybandui-binding", JSON.stringify(binding)));
        }
        for (const book of model?.books ?? []) for (const spell of book.spells) button2(box, `Cast: ${spell.name}`, () => assign(menu, { type: "spell", key: book.key, index: spell.index, name: spell.name }));
        button2(box, "Clear", () => assign(menu, null));
        button2(box, "Close", () => {
          menu = -1;
          paint(true);
        });
      }
      if (customize >= 0 && slots[customize]) {
        const box = el3(quickMount, "div");
        box.className = "menu";
        el3(box, "h3", "Customize slot");
        const style = el3(box, "select");
        style.setAttribute("aria-label", "Appearance");
        for (const [value2, label2] of [["automatic", "Automatic"], ["text", "Custom text"], ["potion", "Potion icon"], ["scroll", "Scroll icon"], ["wand", "Wand icon"]]) {
          const opt = el3(style, "option", label2);
          opt.value = value2;
        }
        style.value = appearance.style;
        style.addEventListener("change", () => {
          appearance = { ...appearance, style: style.value };
          paint(true);
        });
        const input = el3(box, "input");
        input.value = appearance.text;
        input.placeholder = "Text wraps to fit the slot.";
        input.setAttribute("aria-label", "Slot text");
        input.addEventListener("input", () => {
          appearance = { ...appearance, text: input.value.slice(0, 60) };
        });
        const color = el3(box, "input");
        color.type = "color";
        color.value = appearance.color;
        color.setAttribute("aria-label", "Slot color");
        color.addEventListener("input", () => {
          appearance = { ...appearance, color: color.value };
        });
        button2(box, "Reset appearance", () => {
          appearance = { style: "automatic", text: "", color: "#7abaf4" };
          paint(true);
        });
        button2(box, "Save and close", () => {
          const binding = slots[customize];
          if (binding) assign(customize, { ...binding, appearance });
          customize = -1;
          paint(true);
        });
        button2(box, "Cancel", () => {
          customize = -1;
          paint(true);
        });
      }
    }
    if (restOn && restMount && snap.phase === "play") {
      button2(restMount, "Rest", () => {
        restOpen = !restOpen;
        paint(true);
      });
      if (restOpen) {
        const box = el3(restMount, "div");
        box.className = "menu";
        el3(box, "h3", "Rest");
        for (const [count, label2, description] of [[-2, "Fully recovered", "Recover HP and mana and wait out harmful conditions."], [-1, "HP and mana", "Stop when both are full."], [-3, "HP or mana", "Stop as soon as either is full."], [1, "Number of turns", "Rest for a set number of turns."]]) {
          const choice = button2(box, label2, () => {
            restMode = count;
            paint(true);
          });
          choice.setAttribute("aria-pressed", String(restMode === count));
          el3(box, "p", description);
        }
        if (restMode === 1) {
          const input = el3(box, "input");
          input.type = "number";
          input.min = "1";
          input.max = "9999";
          input.value = String(turns);
          input.setAttribute("aria-label", "Turns");
          input.addEventListener("input", () => {
            turns = Number(input.value);
          });
        }
        if (restMode === 1 && (!Number.isInteger(turns) || turns < 1 || turns > 9999)) el3(box, "p", "Enter between 1 and 9999 turns.");
        el3(box, "p", "Danger interrupts rest normally.");
        const confirm = button2(box, "Rest", () => {
          if (!rest(ctx, snap, restMode === 1 ? turns : restMode)) error = "Rest unavailable.";
          else restOpen = false;
          paint(true);
        });
        confirm.disabled = restMode === 1 && (!Number.isInteger(turns) || turns < 1 || turns > 9999);
        button2(box, "Cancel", () => {
          restOpen = false;
          paint(true);
        });
      }
    }
    const first = spellMount ?? quickMount ?? restMount;
    if (error && first) {
      const p = el3(first, "p", error);
      p.setAttribute("role", "status");
    }
    if (quickMount) surfaces.fit("quickbar", quickMount.getBoundingClientRect().height + 16);
  };
  const keydown = (event) => {
    if (!quickOn || menu >= 0 || customize >= 0 || restOpen || event.repeat || event.altKey || event.metaKey || event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLElement && event.target.isContentEditable) return;
    const index = slotIndex(event.code, event.shiftKey, event.ctrlKey);
    const snap = ctx.snapshot?.();
    if (!quickbarOwnsKey(quickOn, snap ?? null, event.code, event.shiftKey, event.ctrlKey, menu >= 0 || restOpen) || !snap || !actionReady(ctx, snap)) return;
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
function adaptStore(snap, known, status) {
  if (snap.phase !== "store" || !snap.core.stores || !snap.core.player || !snap.core.inventory) return null;
  const cell = known && same2(known.token, snap.token) ? known.cells.find((entry2) => entry2.x === snap.core.player.grid.x && entry2.y === snap.core.player.grid.y) : null;
  const feat = status?.feat ?? cell?.remembered.feat;
  if (feat === void 0) return null;
  const index = snap.core.stores.findIndex((store2) => store2.feat === feat);
  if (index < 0) return null;
  const store = snap.core.stores[index];
  const items = adaptItems(snap);
  const eligibility = new Map(status?.inventory?.map((entry2) => [entry2.handle, entry2]));
  const pack = (items?.rows ?? []).filter((item) => eligibility.get(item.handle)?.eligible !== false).map((item) => ({
    key: item.handle,
    label: item.label,
    quantity: item.quantity,
    colour: item.colour,
    location: item.location === "pack" ? "Pack" : "Equipment",
    eligible: eligibility.get(item.handle)?.eligible ?? true,
    ...eligibility.get(item.handle)?.price === void 0 ? {} : { price: eligibility.get(item.handle).price }
  }));
  return {
    token: snap.token,
    index,
    name: store.isHome ? "Home" : store.featName,
    owner: store.isHome ? "" : store.owner.name,
    home: store.isHome,
    ...snap.core.player.gold === void 0 ? {} : { gold: snap.core.player.gold },
    ready: status?.ready ?? true,
    noSelling: status?.noSelling ?? false,
    transactionPrompts: status?.transactionPrompts === true,
    stock: store.stock.map((item) => ({
      key: item.index,
      label: item.label,
      quantity: item.number,
      colour: item.artifact ? "#e89e42" : item.ego ? "#80b891" : "inherit",
      eligible: true,
      ...item.price === void 0 ? {} : { price: item.price }
    })),
    pack,
    prompt: snap.prompt
  };
}

// src/panels/stores.ts
var CSS4 = `:host{color:var(--anyband-text);font:13px/1.4 system-ui,sans-serif}.store{position:absolute;inset:12px;overflow:auto;padding:10px;background:var(--anyband-surface);border:1px solid var(--anyband-accent);border-radius:var(--anyband-rounding);pointer-events:auto}.sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.side{min-width:0;overflow:auto}h2,h3{color:var(--anyband-accent);border-bottom:1px solid var(--anyband-accent)}table{width:100%;border-collapse:collapse}th{text-align:left}td,th{padding:3px;border-bottom:1px solid var(--anyband-accent)}button,input{font:inherit;color:var(--anyband-text);background:var(--anyband-background);border:1px solid var(--anyband-accent);border-radius:3px;padding:3px 6px}button{cursor:pointer}button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--anyband-accent)}.row{width:100%;text-align:left;border:0;background:transparent}.row[aria-pressed=true]{background:var(--anyband-accent);color:var(--anyband-background)!important}.actions{display:flex;gap:6px;margin:6px 0}.prompt{border:1px solid var(--anyband-accent);padding:8px;max-width:30em}.prompt input{width:100%}.muted{opacity:.65}.gain{color:#80b891}.loss,.error,.unaffordable{color:#ff7559}details{margin:8px 0}summary{color:var(--anyband-accent);cursor:pointer}@media(max-width:650px){.sides{grid-template-columns:1fr}}`;
var same3 = (a, b) => a.epoch === b.epoch && a.revision === b.revision;
function el4(parent, tag, value2) {
  const node2 = parent.ownerDocument.createElement(tag);
  if (value2 !== void 0) node2.textContent = value2;
  parent.appendChild(node2);
  return node2;
}
function button3(parent, label2, click) {
  const node2 = el4(parent, "button", label2);
  node2.type = "button";
  node2.addEventListener("click", click);
  return node2;
}
function storeAction(ctx, model, side, key) {
  const snap = ctx.snapshot?.();
  if (!snap || snap.phase !== "store" || snap.prompt || !same3(snap.token, model.token) || !model.ready || !ctx.intent?.submit) return false;
  if (!playerIsDriving(ctx)) return false;
  const rows = side === "stock" ? model.stock : model.pack;
  if (side !== "leave" && (!model.transactionPrompts || !rows.some((row) => row.key === key && row.eligible && (side === "pack" || model.home || row.price === void 0 || model.gold === void 0 || row.price <= model.gold)))) return false;
  const command = side === "leave" ? { code: "shop-exit" } : side === "stock" ? { code: "shop-buy", args: { index: key } } : { code: "shop-sell", args: { handle: key } };
  return ctx.intent.submit(snap.token, { kind: "command", command }).accepted;
}
function storePromptReply(ctx, model, value2) {
  const snap = ctx.snapshot?.();
  if (!snap || snap.phase !== "store" || !same3(snap.token, model.token) || !snap.prompt || snap.prompt.promptId !== model.prompt?.promptId || !ctx.prompt?.reply) return false;
  if (!playerIsDriving(ctx)) return false;
  if (snap.prompt.kind === "quantity") {
    const quantity = snap.prompt;
    if (typeof value2 !== "number" || !Number.isInteger(value2) || value2 < quantity.min || value2 > quantity.max) return false;
  } else if (snap.prompt.kind === "confirm") {
    if (typeof value2 !== "boolean") return false;
  } else return false;
  return ctx.prompt.reply(snap.prompt.promptId, value2).accepted;
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
  let stockSelection = null, packSelection = null, unchanged = false, amount = 1, lastPrompt = -1, split = 50;
  let place = "", signature = "", error = "";
  let mount = null;
  const on = (part) => flags[`anybandui.store${part}`] === true;
  const read = () => {
    const snap = ctx.snapshot?.();
    if (snap?.phase !== "store") return null;
    const status = ctx.store?.current?.() ?? null;
    return adaptStore(snap, ctx.knownLevel?.() ?? null, status);
  };
  const paint = (force = false) => {
    const model = read();
    if (!model) {
      if (panel) {
        panel.close();
        panel = null;
        mount = null;
      }
      return;
    }
    if (!panel) {
      panel = ctx.ui.openPanel({ id: "store", modal: false, label: "Store" });
      applyTheme(panel.root, THEMES[validateSettings(ctx.prefs?.get()).theme]);
      el4(panel.root, "style", CSS4);
      mount = el4(panel.root, "section");
      mount.className = "store";
    }
    const name = `${model.index}:${model.name}`;
    if (name !== place) {
      place = name;
      stockSelection = null;
      packSelection = null;
      error = "";
    }
    if (!model.stock.some((row) => row.key === stockSelection)) stockSelection = null;
    if (!model.pack.some((row) => row.key === packSelection)) packSelection = null;
    const next = JSON.stringify([model, stockSelection, packSelection, unchanged, amount, error]);
    if (!force && next === signature) return;
    signature = next;
    const host = mount;
    host.replaceChildren();
    const width = el4(host, "input");
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
    const sides = el4(host, "div");
    sides.className = "sides";
    sides.style.gridTemplateColumns = `${split}% ${100 - split}%`;
    const action = (side, key) => {
      error = storeAction(ctx, model, side, key) ? "" : "Action unavailable at this input wait.";
      paint(true);
    };
    const draw = (side) => {
      const box = el4(sides, "section");
      box.className = "side";
      el4(box, "h2", side === "stock" ? `${model.name}${model.owner ? ` - ${model.owner}` : ""}` : `Your inventory${model.gold === void 0 ? "" : ` (Gold: ${model.gold})`}`);
      const rows = side === "stock" ? model.stock : model.pack;
      const selected = side === "stock" ? stockSelection : packSelection;
      const table = el4(box, "table");
      const head = el4(table, "tr");
      for (const label2 of ["Item", "Qty", ...side === "pack" ? ["Location"] : [], ...on("Prices") && !model.home ? ["Gold each"] : []]) el4(head, "th", label2);
      if (!rows.length) el4(box, "p", side === "stock" ? "No stock here." : "No items in your pack.");
      for (const row of rows) {
        const tr = el4(table, "tr");
        const cell = el4(tr, "td");
        const pick = button3(cell, row.label, () => {
          if (side === "stock") stockSelection = row.key;
          else packSelection = row.key;
          paint(true);
        });
        pick.className = "row";
        pick.style.color = row.colour;
        pick.title = row.label;
        pick.setAttribute("aria-pressed", String(selected === row.key));
        el4(tr, "td", String(row.quantity));
        if (side === "pack") el4(tr, "td", row.location ?? "Pack");
        if (on("Prices") && !model.home) {
          const price = el4(tr, "td", row.price === void 0 ? "" : String(row.price));
          if (side === "stock" && row.price !== void 0 && model.gold !== void 0 && row.price > model.gold) price.className = "unaffordable";
        }
      }
      if (on("Transactions")) {
        const actions = el4(box, "div");
        actions.className = "actions";
        const label2 = side === "stock" ? model.home ? "Retrieve" : "Buy" : model.home ? "Stash" : model.noSelling ? "Give" : "Sell";
        const active = rows.find((row) => row.key === selected);
        const drive = playerIsDriving(ctx);
        const submit = button3(actions, label2, () => action(side, selected ?? void 0));
        submit.disabled = !drive || !ctx.intent?.submit || !model.transactionPrompts || !model.ready || !!model.prompt || !active || !active.eligible || side === "stock" && !model.home && active.price !== void 0 && model.gold !== void 0 && active.price > model.gold;
        if (!model.transactionPrompts) submit.title = "Store confirmations are unavailable in this game.";
        if (model.noSelling && side === "pack") submit.title = "Shops accept eligible gifts without paying gold.";
        if (side === "stock") {
          const leave = button3(actions, model.home ? "Leave home" : "Leave store", () => action("leave"));
          leave.disabled = !drive || !ctx.intent?.submit || !model.ready || !!model.prompt;
        }
      }
      el4(box, "h3", "Inspection");
      const chosen = rows.find((row) => row.key === selected);
      if (!chosen) {
        const empty = el4(box, "p", "Select an item to inspect it.");
        empty.className = "muted";
        return;
      }
      el4(box, "strong", chosen.label).style.color = chosen.colour;
      if (on("Comparison")) {
        const sim = compareItem(ctx, model.token, side === "stock" ? { store: model.index, index: chosen.key } : chosen.key);
        if (sim) renderItemComparison(box, sim, unchanged, (value2) => {
          unchanged = value2;
          paint(true);
        });
      }
      if (side === "pack") {
        const inspection = ctx.inspect?.inspectItem(chosen.key);
        if (inspection && same3(inspection.token, model.token)) {
          const details = el4(box, "details");
          details.open = true;
          el4(details, "summary", inspection.title);
          el4(details, "p", inspection.text);
        }
      }
    };
    draw("stock");
    draw("pack");
    if (on("Prompts") && model.prompt && ctx.prompt?.reply) {
      const prompt = model.prompt;
      if (prompt.promptId !== lastPrompt) {
        lastPrompt = prompt.promptId;
        if (prompt.kind === "quantity") amount = prompt.defaultValue;
      }
      if (prompt.kind === "quantity" || prompt.kind === "confirm") {
        const box = el4(host, "section");
        box.className = "prompt";
        el4(box, "h3", prompt.kind === "quantity" ? "Choose quantity" : "Confirm price");
        el4(box, "p", prompt.label ?? "Confirm transaction?");
        const reply = (value2) => {
          error = storePromptReply(ctx, model, value2) ? "" : "Prompt answer unavailable.";
          paint(true);
        };
        if (prompt.kind === "quantity") {
          const quantity = prompt;
          el4(box, "p", `Available for this action: ${quantity.max}`);
          const input = el4(box, "input");
          input.type = "number";
          input.min = String(quantity.min);
          input.max = String(quantity.max);
          input.value = String(amount);
          input.addEventListener("input", () => {
            amount = Number(input.value);
          });
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.stopPropagation();
              reply(amount);
            }
          });
          const actions = el4(box, "div");
          actions.className = "actions";
          for (const [label2, value2] of [["One", 1], ["Half", Math.max(1, Math.floor(quantity.max / 2))], ["All", quantity.max]]) button3(actions, label2, () => {
            amount = value2;
            input.value = String(value2);
          });
          const confirm = button3(actions, "Confirm", () => reply(amount));
          confirm.disabled = amount < quantity.min || amount > quantity.max;
        } else {
          const actions = el4(box, "div");
          actions.className = "actions";
          button3(actions, "Yes", () => reply(true));
          button3(actions, "No", () => reply(false));
        }
      }
    }
    if (error) {
      const line = el4(host, "p", error);
      line.className = "error";
    }
  };
  paint(true);
  const timer2 = globalThis.setInterval(() => paint(), 200);
  return () => {
    globalThis.clearInterval(timer2);
    panel?.close();
    panel = null;
  };
}

// src/effects.ts
function healthIntensity(hp, maxHp, warning) {
  if (!(hp !== void 0 && maxHp && maxHp > 0 && hp > 0)) return 0;
  const threshold = warning !== void 0 && warning > 0 ? warning * 10 : 30;
  const ratio = hp / maxHp * 100;
  return ratio > threshold ? 0 : Math.max(0, Math.min(1, (threshold - ratio) / Math.max(1, threshold) + 0.12));
}
function chooseEffectMotion(reduced) {
  return reduced ? "static" : "motion";
}
function effectGrids(s, known) {
  const asleep = [], uniques = [], artifacts = [];
  for (const m of s?.core.monsters ?? []) if (m.visible) {
    if (m.asleep) asleep.push(m.grid);
    if (m.raceFlags.includes("UNIQUE")) uniques.push(m.grid);
  }
  for (const c of known?.cells ?? []) if (c.remembered.objects.some((o) => !!o && typeof o === "object" && o.artifact === true)) artifacts.push({ x: c.x, y: c.y });
  return { asleep, uniques, artifacts };
}
function actorGrid(s, who) {
  if (who === null) return null;
  if (who === "player") return s?.core.player?.grid ?? null;
  return s?.core.monsters?.find((m) => m.id === who && m.visible)?.grid ?? null;
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
function installEffects(ctx) {
  const flags = ctx.flags ?? {};
  const enabled = ["anybandui.crt", "anybandui.lowHealthEffect", "anybandui.deathEffect", "anybandui.itemGlow", "anybandui.sleepMarks", "anybandui.presenceHaze", "anybandui.spellEffects"].some((x) => flags[x]);
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
  let raf = 0, previousPhase = null, deadBurstAt = 0;
  const reduced = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const add = (e) => {
    for (const cue of eventCue(e, (who) => actorGrid(ctx.snapshot?.() ?? null, who))) {
      const strength = Math.max(0, Math.min(100, validateSettings(ctx.prefs?.get()).effects[cue.kind] ?? 100));
      if (strength > 0) cues.push({ ...cue, started: performance.now(), strength });
    }
    request();
  };
  const combat = (_type, e) => add({ event: "combat-outcome", ...e });
  const heal = (_type, e) => add({ event: "heal", ...e });
  const motion = (_type, e) => add({ event: "motion", ...e });
  const listen = flags["anybandui.spellEffects"] === true;
  if (listen) {
    ctx.events?.on("combat-outcome", combat);
    ctx.events?.on("heal", heal);
    ctx.events?.on("motion", motion);
  }
  function request() {
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function draw(now) {
    raf = 0;
    const view = activeDisplay.snapshot(), rect = mapProjection(view);
    const snap = ctx.snapshot?.() ?? null;
    if (!rect || view.mode !== "play") {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";
    canvas.style.left = `${rect.x}px`;
    canvas.style.top = `${rect.y}px`;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, rect.width, rect.height);
    const cellW = rect.width / view.viewport.size.width, cellH = rect.height / view.viewport.size.height;
    const cell = (p) => ({ x: (p.x - view.viewport.origin.x + 0.5) * cellW, y: (p.y - view.viewport.origin.y + 0.5) * cellH });
    const effectSettings = validateSettings(ctx.prefs?.get()).effects;
    const intensity = (key) => Math.max(0, Math.min(100, effectSettings[key] ?? 100)) / 100;
    const staticMode = chooseEffectMotion(reduced()) === "static";
    if (flags["anybandui.crt"] && intensity("crt") > 0) {
      g.fillStyle = `rgba(0,0,0,${0.1 * intensity("crt")})`;
      for (let y = 0; y < rect.height; y += 3) g.fillRect(0, y, rect.width, 1);
      if (!staticMode) {
        const y = now / 14 % rect.height;
        g.fillStyle = "rgba(120,220,255,.08)";
        g.fillRect(0, y, rect.width, Math.max(2, cellH * 0.18));
      }
    }
    if (flags["anybandui.lowHealthEffect"] && intensity("lowHealth") > 0) {
      const p = snap?.core.player;
      const v = healthIntensity(p?.hp, p?.maxHp, void 0) * intensity("lowHealth");
      if (v) {
        g.fillStyle = `rgba(255,20,25,${v * (staticMode ? 0.1 : 0.08 + 0.08 * Math.sin(now / 45))})`;
        g.fillRect(0, 0, rect.width, rect.height);
      }
    }
    if (snap?.phase === "dead" && previousPhase !== "dead" && flags["anybandui.deathEffect"] && intensity("death") > 0) {
      deadBurstAt = now;
      const at = snap.core.player?.grid;
      if (at) cues.push({ grid: at, kind: "death", started: now, strength: 100 });
    }
    previousPhase = snap?.phase ?? null;
    const known = ctx.knownLevel?.() ?? null, grids = effectGrids(snap, known);
    if (flags["anybandui.itemGlow"]) for (const p of grids.artifacts) paint(p, "#ffd36a", intensity("itemGlow"));
    if (flags["anybandui.sleepMarks"]) for (const p of grids.asleep) {
      const q = cell(p);
      g.strokeStyle = `rgba(190,220,255,${intensity("sleepMarks")})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(q.x - 3, q.y - cellH * 0.38);
      g.lineTo(q.x, q.y - cellH * 0.52);
      g.lineTo(q.x + 3, q.y - cellH * 0.38);
      g.stroke();
    }
    if (flags["anybandui.presenceHaze"]) for (const p of grids.uniques) paint(p, "#b45cff", intensity("presenceHaze") * ((snap?.core.monsters ?? []).some((m) => m.visible && m.grid.x === p.x && m.grid.y === p.y && m.race === "Morgoth, Lord of Darkness") ? 1 : 0.65));
    let active = false;
    for (const c of cues) {
      const age = (now - c.started) / 650;
      if (age >= (staticMode ? 0.08 : 1)) continue;
      active = true;
      const q = cell(c.grid), a = staticMode ? 0.45 : (1 - age) * c.strength / 100;
      g.strokeStyle = `rgba(${c.kind === "heal" ? "100,255,160" : c.kind === "cast" ? "100,190,255" : "255,190,90"},${a})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(q.x, q.y, staticMode ? 5 : 4 + age * cellH * 0.55, 0, Math.PI * 2);
      g.stroke();
    }
    cues.splice(0, cues.length, ...cues.filter((c) => now - c.started < 650));
    if (flags["anybandui.deathEffect"] && deadBurstAt && now - deadBurstAt < 900) active = true;
    if (active || !staticMode && (flags["anybandui.crt"] && intensity("crt") > 0 || flags["anybandui.lowHealthEffect"] && healthIntensity(snap?.core.player?.hp, snap?.core.player?.maxHp, void 0) > 0 || flags["anybandui.sleepMarks"] && grids.asleep.length > 0 || flags["anybandui.itemGlow"] && grids.artifacts.length > 0 || flags["anybandui.presenceHaze"] && grids.uniques.length > 0)) request();
    function paint(p, color, a) {
      if (!a) return;
      const q = cell(p);
      g.fillStyle = color;
      g.globalAlpha = a * (staticMode ? 1 : 0.5 + 0.5 * Math.sin(now / 180));
      g.beginPath();
      g.arc(q.x, q.y, Math.max(3, cellW * 0.42), 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  }
  const tick = globalThis.setInterval(request, 250);
  request();
  return () => {
    globalThis.clearInterval(tick);
    if (raf) cancelAnimationFrame(raf);
    if (listen) {
      ctx.events?.off("combat-outcome", combat);
      ctx.events?.off("heal", heal);
      ctx.events?.off("motion", motion);
    }
    canvas.remove();
    cues.length = 0;
  };
}

// plugin.ts
var quiverDisplay;
var tileDisplay;
var tileFullOverviewApplied = false;
var displayCleanups = [];
var characterPane = null;
var plugin_default = {
  api: 1,
  register(_host, ctx) {
    this.uninstall();
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
    const flags = ctx.flags ?? {};
    displayCleanups.push(installEffects({ flags, ...ctx.snapshot ? { snapshot: ctx.snapshot } : {}, ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {}, ...ctx.events ? { events: ctx.events } : {}, ...ctx.display?.snapshot ? { display: ctx.display } : {}, ...ctx.prefs ? { prefs: ctx.prefs } : {} }));
    displayCleanups.push(installItems(ctx));
    displayCleanups.push(installStores(ctx));
    if (flags["anybandui.highContrast"] || flags["anybandui.colourblind"] || flags["anybandui.crt"]) {
      installAccessibilityAccommodations({ flags, ...ctx.display ? { display: ctx.display } : {}, log: ctx.log });
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
        ...ctx.state ? { state: ctx.state } : {},
        log: ctx.log
      });
      displayCleanups.push(uninstallZoomPan);
      if (ctx.display.setFullMapOverview && ctx.display.setMapView && ctx.display.setTileScaling) {
        displayCleanups.push(installMapOverview({
          flags,
          display: ctx.display,
          ...ctx.state ? { state: ctx.state } : {},
          ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {},
          ...ctx.prefs ? { prefs: ctx.prefs } : {},
          log: ctx.log
        }));
      }
      displayCleanups.push(installMapHoverCards({
        flags,
        ...ctx.core ? { core: ctx.core } : { core: null },
        ...ctx.state ? { state: ctx.state } : {},
        display
      }));
      displayCleanups.push(installHoverCards({
        flags: { ...flags, "anybandui.mapHoverCards": false },
        display,
        ...ctx.snapshot ? { snapshot: ctx.snapshot } : {},
        ...ctx.core ? { core: ctx.core } : {},
        ...ctx.knownLevel ? { knownLevel: ctx.knownLevel } : {},
        ...ctx.state ? { state: ctx.state } : {},
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
        core: ctx.core ?? null,
        ...ctx.state ? { state: ctx.state } : {},
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
    displayCleanups.push(installPhase4(ctx));
    if (flags["anybandui.firstEncounter"]) {
      if (ctx.core && ctx.state) {
        const theme = THEMES[validateSettings(ctx.prefs?.get()).theme];
        installFirstEncounter({
          core: ctx.core,
          state: ctx.state,
          theme,
          ...ctx.ui ? { ui: ctx.ui } : {},
          ...ctx.prefs ? { prefs: ctx.prefs } : {},
          ...ctx.tiles ? { tiles: ctx.tiles } : {},
          log: ctx.log
        });
      } else ctx.log("first-encounter alerts: no live game at register time");
    }
  },
  uninstall() {
    characterPane?.close();
    characterPane = null;
    for (const cleanup of displayCleanups.splice(0).reverse()) cleanup();
    uninstallFirstEncounter();
    uninstallAccessibilityAccommodations();
    quiverDisplay?.setQuiverItemization?.(false);
    tileDisplay?.setTileScaling?.("auto");
    if (tileFullOverviewApplied) tileDisplay?.setFullMapOverview?.(false);
    quiverDisplay = void 0;
    tileDisplay = void 0;
    tileFullOverviewApplied = false;
  },
  hud(ctx) {
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
    const theme = THEMES[validateSettings(ctx.prefs?.get()).theme];
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
        { key: "status", render: renderStatusBadges, select: (m) => [m.player.statuses, m.player.study] },
        { key: "dungeon", render: renderDungeonCard, select: (m) => [m.dungeon, m.player.trap_detected, m.player.recall, m.player.descent, m.player.resting, m.player.running, m.player.repeat, m.player.unignoring] }
      ], theme);
      output.status = { present(section2, frame) {
        source.hud.status.present(section2, frame);
        const model = source.snapshot();
        if (model) host.present(section2, frame, model);
        if (model) pane?.paint(model);
      } };
    }
    if (enabled.messages) {
      const host = createPanelHost(doc, [{ key: "messages", render: renderMessageLog, select: (m) => [m.messages, m.message_pending] }], theme);
      output.messages = { present(section2, frame) {
        source.hud.messages.present(section2, frame);
        const model = source.snapshot();
        if (model) host.present(section2, frame, model);
        if (model) pane?.paint(model);
      } };
    }
    return output;
  }
};
export {
  plugin_default as default
};
