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
  showHeadings: true
};
var themes = /* @__PURE__ */ new Set(["terminal-original", "dark-graphite", "light-paper", "amber-terminal", "midnight-ice"]);
var fonts = new Set(FONT_FILES);
function validateSettings(value2) {
  const record2 = value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : {};
  return {
    theme: typeof record2["theme"] === "string" && themes.has(record2["theme"]) ? record2["theme"] : DEFAULT_SETTINGS.theme,
    interfaceFont: typeof record2["interfaceFont"] === "string" && fonts.has(record2["interfaceFont"]) ? record2["interfaceFont"] : DEFAULT_SETTINGS.interfaceFont,
    dungeonFont: typeof record2["dungeonFont"] === "string" && (record2["dungeonFont"] === "" || fonts.has(record2["dungeonFont"])) ? record2["dungeonFont"] : DEFAULT_SETTINGS.dungeonFont,
    showHeadings: typeof record2["showHeadings"] === "boolean" ? record2["showHeadings"] : DEFAULT_SETTINGS.showHeadings
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

// plugin.ts
var quiverDisplay;
var tileDisplay;
var plugin_default = {
  api: 1,
  register(_host, ctx) {
    this.uninstall();
    ctx.log(`AnybandUI loaded on engine ${ctx.engine}`);
    const flags = ctx.flags ?? {};
    if (flags["anybandui.highContrast"] || flags["anybandui.colourblind"]) {
      installAccessibilityAccommodations({ flags, ...ctx.display ? { display: ctx.display } : {}, log: ctx.log });
    }
    if (flags["anybandui.quiverItemization"] || flags["anybandui.crispTiles"]) {
      if (!ctx.display) ctx.log("this game is too old for display conveniences");
      else {
        if (flags["anybandui.quiverItemization"] && ctx.display.setQuiverItemization) {
          quiverDisplay = ctx.display;
          ctx.display.setQuiverItemization(true);
        }
        if (flags["anybandui.crispTiles"] && ctx.display.setTileScaling) {
          tileDisplay = ctx.display;
          ctx.display.setTileScaling("crisp");
        }
      }
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
    uninstallFirstEncounter();
    uninstallAccessibilityAccommodations();
    quiverDisplay?.setQuiverItemization?.(false);
    tileDisplay?.setTileScaling?.("auto");
    quiverDisplay = void 0;
    tileDisplay = void 0;
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
