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
var CSS = `
:host{position:fixed;display:none;z-index:50;box-sizing:border-box;color:var(--anyband-text);font:12px/1.35 system-ui,sans-serif}
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
function meter(parent, label2, value2, amount, colour, tip) {
  const cell = node(parent, "div", "meter");
  node(cell, "span", "", label2);
  node(cell, "span", "", ` ${value2}`);
  const track = node(cell, "div", "bar");
  const fill = node(track, "div", "fill");
  fill.style.width = `${Math.round(amount * 100)}%`;
  fill.style.backgroundColor = colour;
  if (tip) cell.dataset.tip = tip;
}
function intersects(a, b) {
  return a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
}
function createPanelHost(doc, panels, theme) {
  const element = doc.createElement("div");
  element.className = "anyband-panel";
  const shadow = element.attachShadow({ mode: "open" });
  if (theme) applyTheme(shadow, theme);
  else applyTheme(shadow);
  node(shadow, "style", "", CSS);
  const surface = node(shadow, "div", "surface");
  const mounts = panels.map(() => node(surface, "div", "group"));
  const tip = node(surface, "div", "tip");
  let signatures = [];
  surface.addEventListener("mouseover", (event) => {
    const target = event.target;
    const subject = target instanceof HTMLElement ? target.closest("[data-tip]") : null;
    tip.textContent = subject?.dataset.tip ?? "";
    tip.style.display = subject ? "block" : "none";
    if (subject) {
      tip.style.left = `${Math.min(subject.offsetLeft, Math.max(0, surface.clientWidth - tip.offsetWidth))}px`;
      tip.style.top = `${Math.min(subject.offsetTop + subject.offsetHeight, Math.max(0, surface.clientHeight - tip.offsetHeight))}px`;
    }
  });
  surface.addEventListener("mouseleave", () => {
    tip.style.display = "none";
  });
  doc.body.appendChild(element);
  return {
    element,
    present(section, frame, model) {
      const region = section.region;
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
      panels.forEach((panel, index) => {
        const signature = JSON.stringify(panel.select(model));
        if (signatures[index] === signature) return;
        signatures[index] = signature;
        panel.render(mounts[index], model);
      });
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
    const tip = [`Level ${p.level}`, `Experience: ${p.experience}`, next <= 0 ? "Maximum level reached" : `Next level: ${next}
Remaining: ${Math.max(0, next - p.experience)}`].join("\n");
    if (next <= 0 || base !== void 0) meter(grid, "XP", value2, progress, "#8f5e1f", tip);
    else node(grid, "div", "metric", `XP ${value2}`).dataset.tip = tip;
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
  for (const [label2, value2, tip] of [["Depth", String(d.depth), `Depth: ${d.depth_feet} feet`], ["Light", String(d.light), ""], ["Feel", d.feeling || "?", d.feeling_description ?? ""], ["", d.floor ?? "", ""]]) {
    const tile = node(grid, "div", "metric", label2);
    node(tile, "b", "", value2);
    if (tip) tile.dataset.tip = tip;
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
  showHeadings: true
};
var themes = /* @__PURE__ */ new Set(["terminal-original", "dark-graphite", "light-paper", "amber-terminal", "midnight-ice"]);
var fonts = new Set(FONT_FILES);
function validateSettings(value2) {
  const record = value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : {};
  return {
    theme: typeof record["theme"] === "string" && themes.has(record["theme"]) ? record["theme"] : DEFAULT_SETTINGS.theme,
    interfaceFont: typeof record["interfaceFont"] === "string" && fonts.has(record["interfaceFont"]) ? record["interfaceFont"] : DEFAULT_SETTINGS.interfaceFont,
    dungeonFont: typeof record["dungeonFont"] === "string" && (record["dungeonFont"] === "" || fonts.has(record["dungeonFont"])) ? record["dungeonFont"] : DEFAULT_SETTINGS.dungeonFont,
    showHeadings: typeof record["showHeadings"] === "boolean" ? record["showHeadings"] : DEFAULT_SETTINGS.showHeadings
  };
}

// plugin.ts
var plugin_default = {
  api: 1,
  register(_host, ctx) {
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
  },
  hud(ctx) {
    const doc = globalThis.document;
    if (!doc?.body) return void 0;
    const enabled = {
      sidebar: ctx.flags["anybandui.sidebar"] === true,
      status: ctx.flags["anybandui.status"] === true,
      messages: ctx.flags["anybandui.messages"] === true
    };
    if (!enabled.sidebar && !enabled.status && !enabled.messages) return void 0;
    const source = createSource(ctx);
    const theme = THEMES[validateSettings(ctx.prefs?.get()).theme];
    const output = {};
    if (enabled.sidebar) {
      const host = createPanelHost(doc, [
        { key: "character", render: renderCharacterCard, select: (m) => {
          const p = m.player;
          return [p.name, p.race, p.class, p.title, p.hp, p.max_hp, p.sp, p.max_sp, p.food, p.food_max, p.experience, p.level_start_experience, p.next_level_experience, p.level, p.stats, p.gold, p.armour, p.speed, p.extra_moves];
        } },
        { key: "tracked", render: renderTrackedCreature, select: (m) => m.player.tracked_creature }
      ], theme);
      output.sidebar = { present(section, frame) {
        source.hud.sidebar.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    if (enabled.status) {
      const host = createPanelHost(doc, [
        { key: "status", render: renderStatusBadges, select: (m) => [m.player.statuses, m.player.study] },
        { key: "dungeon", render: renderDungeonCard, select: (m) => [m.dungeon, m.player.trap_detected, m.player.recall, m.player.descent, m.player.resting, m.player.running, m.player.repeat, m.player.unignoring] }
      ], theme);
      output.status = { present(section, frame) {
        source.hud.status.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    if (enabled.messages) {
      const host = createPanelHost(doc, [{ key: "messages", render: renderMessageLog, select: (m) => [m.messages, m.message_pending] }], theme);
      output.messages = { present(section, frame) {
        source.hud.messages.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
      } };
    }
    return output;
  }
};
export {
  plugin_default as default
};
