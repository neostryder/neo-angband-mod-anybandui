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
  panelHosts.add(element);
  element.style.filter = panelVisualFilter ?? "";
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
  showHeadings: true,
  hoverDelayMs: 550,
  zoomIndex: 7,
  panelZoom: {}
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
    panelZoom: record2["panelZoom"] && typeof record2["panelZoom"] === "object" && !Array.isArray(record2["panelZoom"]) ? Object.fromEntries(Object.entries(record2["panelZoom"]).filter(([id, step]) => id.length > 0 && typeof step === "number" && Number.isInteger(step) && step >= 0 && step <= 6)) : DEFAULT_SETTINGS.panelZoom
  };
}

// src/accessibility.ts
var COLORBLIND_FILTER_ID = "anybandui-accessibility-colorblind";
var HIGH_CONTRAST_FILTER = "contrast(1.55) saturate(1.2)";
var COLORBLIND_MATRIX = "0.812 0.199 -0.011 0 0 0 1 0 0 0 -0.188 0.199 0.989 0 0 0 0 0 1 0";
function accessibilityFilter(flags) {
  if (flags["anybandui.colourblind"] === true) return `url("#${COLORBLIND_FILTER_ID}")`;
  if (flags["anybandui.highContrast"] === true) return HIGH_CONTRAST_FILTER;
  return null;
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
function styleAsScreenReaderOnly(el) {
  Object.assign(el.style, {
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
function paintBitmapButtonLabel(button, text, css, cellWidth, cellHeight, dpr) {
  button.replaceChildren();
  if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", text);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  paintBitmapLine(canvas, [{ text, css }], cellWidth, cellHeight, dpr);
  button.appendChild(canvas);
}

// src/encounter-preference.ts
function record(value2) {
  return value2 !== null && typeof value2 === "object" && !Array.isArray(value2);
}
function readFirstEncounterPreference(raw) {
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
  const stored = readFirstEncounterPreference(raw);
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
function readFirstEncounterPreference2(raw) {
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
  const firstEncounter = readFirstEncounterPreference2(raw);
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
var INTERFACE_ZOOM_SCALES = [0.8, 1, 1.25, 1.5];
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
function paintSidebar(rt, section, frame) {
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
  const pixels = section.region?.pixels;
  const surface = rt.display.snapshot().surface;
  if (!sidebar || !pixels || !surface || frame.layout === "none" || hidesSidebar(rt.display.snapshot().mode)) {
    if (sidebar) sidebar.host.style.display = "none";
    return;
  }
  const scale = INTERFACE_ZOOM_SCALES[rt.preference.interfaceZoomIndex] ?? 1;
  if (sidebar.layout !== frame.layout || sidebar.entryCount !== section.entries.length) {
    sidebar.page = 0;
  }
  sidebar.layout = frame.layout;
  sidebar.entryCount = section.entries.length;
  sidebar.section = section;
  sidebar.frame = frame;
  const plan = sidebarPagePlan(section.entries.length, frame.layout, pixels, scale, sidebar.page);
  sidebar.page = plan.page;
  const visible = section.entries.slice(plan.start, plan.end);
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
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-anybandui-sidebar-page", "");
    button.setAttribute("aria-label", `Show status page ${String((plan.page + 1) % plan.pages + 1)} of ${String(plan.pages)}`);
    Object.assign(button.style, {
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
      button,
      `${String(plan.page + 1)}/${String(plan.pages)} >`,
      "#d8d87c",
      cellWidth,
      cellHeight,
      dpr
    );
    button.addEventListener("click", () => turnSidebarPage(rt, 1));
    sidebar.body.appendChild(button);
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
  return { sidebar: { present: (section, frame) => {
    if (ctx.flags["anybandui.sidebar"] === true) {
      rt.sidebarLayout = frame.layout;
      if (!rt.gridActive && rt.bootPhase === "game-pending") activateGameplayGrid(rt);
      return;
    }
    paintSidebar(rt, section, frame);
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
  const resolve = (point) => {
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
    const resolved = resolve(point);
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
    const resolved = resolve(point);
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
function positionHoverCard(el, clientX, clientY) {
  const GAP = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = clientX + GAP;
  let top = clientY + GAP;
  if (left + w > vw) left = clientX - GAP - w;
  if (top + h > vh) top = clientY - GAP - h;
  el.style.left = `${String(Math.max(0, left))}px`;
  el.style.top = `${String(Math.max(0, top))}px`;
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
        const same = resolved !== null && shownGridKey !== null && gridKey(resolved.grid) === shownGridKey;
        if (same) {
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

// plugin.ts
var quiverDisplay;
var tileDisplay;
var tileFullOverviewApplied = false;
var displayCleanups = [];
var plugin_default = {
  api: 1,
  register(_host, ctx) {
    this.uninstall();
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
    const flags = ctx.flags ?? {};
    if (flags["anybandui.highContrast"] || flags["anybandui.colourblind"]) {
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
        display,
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
    if (enabled.sidebar) {
      const host = createPanelHost(doc, [
        { key: "character", render: renderCharacterCard, select: (m) => {
          const p = m.player;
          return [p.name, p.race, p.class, p.title, p.hp, p.max_hp, p.sp, p.max_sp, p.food, p.food_max, p.experience, p.level_start_experience, p.next_level_experience, p.level, p.stats, p.gold, p.armour, p.speed, p.extra_moves];
        } },
        { key: "tracked", render: renderTrackedCreature, select: (m) => m.player.tracked_creature }
      ], theme);
      output.sidebar = { present(section, frame) {
        zoomPanHud({ flags: ctx.flags })?.sidebar?.present(section, frame);
        source.hud.sidebar.present(section, frame);
        const model = source.snapshot();
        if (model) host.present(section, frame, model);
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
