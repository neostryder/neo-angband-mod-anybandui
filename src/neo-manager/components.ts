import { loadFonts } from "../fonts.js";
import { button, el, swallow } from "../menus/keys.js";
import {
  consentDecision, createCardTiming, displayText, exportSettings, importSettings, initialView, keyAction,
  ledgerText as text, lookView, managerRows, recoveryView, reduceManager, settingsGroups, updateRows, validSetting,
  type ManagerTab, type ManagerView,
} from "./model.js";
import { LEDGER_FONTS, ledgerStyles } from "./styles.js";
import type { Api2Call, Api2ManagerState, ManageHost, SettingDefinition, SettingValue } from "./types.js";

export interface NeoManagerHandle {
  open(tab?: ManagerTab): void;
  close(): void;
  dispose(): void;
  handleGamepad(action: "a" | "b" | "y" | "up" | "down" | "left" | "right"): void;
}

export function registerNeoManagerElements(registry: CustomElementRegistry, base: typeof HTMLElement): void {
  for (const name of ["na-mod-manager", "na-detail-card", "na-consent-dialog", "na-settings-page", "na-look-picker", "na-manager-notices"]) {
    if (!registry.get(name)) registry.define(name, class extends base {});
  }
}

let mountId = 0;

export function mountNeoManager(host: ManageHost, target: HTMLElement): NeoManagerHandle {
  const window = target.ownerDocument.defaultView;
  if (window?.customElements) registerNeoManagerElements(window.customElements, window.HTMLElement);
  const root = target.ownerDocument.createElement("na-mod-manager");
  root.className = "na-manager";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", text.mods);
  target.appendChild(root);
  const prefix = `na-manager-${++mountId}`;
  let view: ManagerView = initialView;
  let state: Api2ManagerState | null = null;
  let disposed = false;
  let busy = false;
  let message = "";
  let picker = false;
  let showUpdates = false;
  let consentId: string | null = null;
  let consentGranted: readonly string[] = [];
  let subscription: { readonly id: string } | null = null;
  let backupText = "";
  let opener: HTMLElement | null = null;
  let consentOpener = "";
  let closeCard: (() => void) | null = null;
  let cardNumber = 0;
  let cleanupRender: (() => void)[] = [];
  let search: HTMLInputElement | null = null;
  let navigation: HTMLElement[] = [];
  const cardOpeners = new Map<string, () => void>();
  const openedGroups = new Set<string>();
  const active = (): HTMLElement | null => (root.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
  const focusables = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>("[data-focus]"));
  const focus = (key: string): void => { focusables().find((node) => node.dataset["focus"] === key)?.focus(); };
  const setting = (id: string): SettingValue | undefined => host.settings.get()[id] ?? host.settings.definitions.find((definition) => definition.id === id)?.default;
  const variants = (): void => {
    root.dataset["contrast"] = setting("highContrast") === true ? "high" : "normal";
    root.dataset["motion"] = host.prefersReducedMotion() || setting("motion") === "reduce" ? "reduce" : "device";
    root.dataset["theme"] = String(setting("theme") ?? "system");
    root.dataset["colorblind"] = String(setting("colorblind") ?? "off");
    root.dataset["rows"] = String(setting("listRows") ?? "roomy");
    const size = setting("textSize");
    root.style.fontSize = `${15 * (typeof size === "number" ? size : 100) / 100}px`;
  };
  const safeMessage = (value: string): void => { message = displayText(value); };
  const takeState = (next: Api2ManagerState): void => {
    if (disposed || (state && next.revision < state.revision)) return;
    state = next;
    if (next.pendingConfirmation) consentId = null;
    render();
  };
  const refresh = async (): Promise<void> => {
    try {
      const result = await host.mods.snapshot();
      if (disposed) return;
      if (result.ok) takeState(result.value);
      else { safeMessage(result.message); render(); }
    } catch { if (!disposed) { message = text.unavailable; render(); } }
  };
  const run = async (operation: () => Api2Call<unknown>): Promise<boolean> => {
    if (disposed || busy || state?.pendingConfirmation) return false;
    busy = true;
    message = "";
    render();
    let ok = false;
    try {
      const result = await operation();
      ok = result.ok;
      if (!result.ok) safeMessage(result.message);
    } catch { message = text.unavailable; }
    finally { busy = false; if (!disposed) await refresh(); }
    return ok;
  };
  const command = (parent: Element, label: string, key: string, operation: () => Api2Call<unknown>): HTMLButtonElement => {
    const node = button(parent, label, key, () => { void run(operation); });
    node.disabled = busy || state?.pendingConfirmation !== null && state?.pendingConfirmation !== undefined;
    return node;
  };
  const part = (parent: Element, name: string): HTMLElement => {
    const node = parent.ownerDocument.createElement(name);
    parent.appendChild(node);
    return node;
  };
  const frame = (parent: Element, title: string): HTMLElement => {
    const node = el(parent, "section");
    node.className = "frame";
    el(node, "h2", title);
    return node;
  };

  const card = (parent: HTMLElement, anchor: HTMLElement, description: string, details: () => void): void => {
    const node = part(parent, "na-detail-card");
    const id = `${prefix}-card-${++cardNumber}`;
    node.id = id;
    node.hidden = true;
    node.setAttribute("role", "tooltip");
    const body = el(node, "div", description);
    body.id = `${id}-text`;
    anchor.setAttribute("aria-describedby", body.id);
    const actions = el(node, "div");
    actions.className = "actions";
    actions.hidden = true;
    const hide = (): void => { node.hidden = true; if (closeCard === hide) closeCard = null; };
    const show = (touch: boolean): void => {
      closeCard?.();
      node.hidden = false;
      actions.hidden = !touch;
      closeCard = hide;
      if (touch && setting("haptics") === true) host.haptics.tick();
    };
    button(actions, text.details, `${id}-details`, () => { hide(); details(); });
    button(actions, text.close, `${id}-close`, () => { hide(); anchor.focus(); });
    const timing = createCardTiming(host.clock, show);
    cleanupRender.push(timing.cancel);
    let suppressClick = false;
    let touchOrigin: { x: number; y: number } | null = null;
    let leaveTimer: unknown;
    const cancelLeave = (): void => { host.clock.clearTimeout(leaveTimer); };
    const leave = (): void => { timing.leave(); cancelLeave(); leaveTimer = host.clock.setTimeout(hide, 100); };
    cleanupRender.push(() => host.clock.clearTimeout(leaveTimer));
    anchor.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch" && setting("hoverCards") !== false) timing.hover(); });
    anchor.addEventListener("focus", () => { if (setting("hoverCards") !== false) timing.hover(); });
    parent.addEventListener("pointerleave", leave);
    node.addEventListener("pointerenter", cancelLeave);
    parent.addEventListener("focusout", (event) => { if (!event.relatedTarget || !parent.contains(event.relatedTarget as Node)) leave(); });
    anchor.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") { touchOrigin = { x: event.clientX, y: event.clientY }; timing.press(); }
    });
    anchor.addEventListener("pointerup", (event) => { if (event.pointerType === "touch") suppressClick = timing.release(); });
    anchor.addEventListener("pointercancel", () => { touchOrigin = null; timing.cancel(); });
    anchor.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch" && touchOrigin && Math.hypot(event.clientX - touchOrigin.x, event.clientY - touchOrigin.y) > 10) {
        touchOrigin = null;
        timing.cancel();
      }
    });
    anchor.addEventListener("contextmenu", (event) => { event.preventDefault(); });
    anchor.addEventListener("click", (event) => {
      if (suppressClick) { suppressClick = false; swallow(event); return; }
      details();
    });
    const key = anchor.dataset["focus"] ?? id;
    cardOpeners.set(key, () => show(false));
    const question = button(parent, "?", `${key}-help`, () => show(false));
    question.className = "question";
    question.setAttribute("aria-label", `${text.about}: ${anchor.getAttribute("aria-label") ?? anchor.textContent}`);
    question.setAttribute("aria-describedby", body.id);
    question.addEventListener("focus", timing.hover);
    cardOpeners.set(`${key}-help`, () => show(false));
  };

  const renderRows = (main: HTMLElement): void => {
    if (!state) return;
    const rows = managerRows(state, view, host.updatePermissions, host.permissions);
    const box = frame(main, `${text.installed} (${state.installed.length})`);
    renderSearch(box, text.searchMods);
    const tools = el(box, "div");
    tools.className = "tools";
    el(tools, "span", text.show);
    const filter = el(tools, "select");
    filter.dataset["focus"] = "filter";
    filter.setAttribute("aria-label", text.show);
    for (const [value, label] of [["all", text.all], ["on", text.on], ["off", text.off], ["updates", text.updates]]) {
      const option = el(filter, "option", label);
      option.value = value!;
    }
    filter.value = view.filter;
    filter.addEventListener("change", () => { view = reduceManager(view, { type: "filter", filter: filter.value as ManagerView["filter"] }); render(); });
    const list = el(box, "div");
    list.setAttribute("role", "list");
    if (!rows.length) el(list, "p", text.noMatches);
    rows.forEach((row, index) => {
      const item = el(list, "div");
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-label", row.label);
      const line = el(item, "div");
      line.className = `line${row.selected && setting("rowHighlight") !== false ? " selected" : ""}`;
      el(line, "span", `${row.letter})`).setAttribute("aria-hidden", "true");
      const name = button(line, row.name, `mod:${row.id}`, () => {});
      name.className = "name";
      name.setAttribute("aria-label", row.label);
      name.setAttribute("aria-expanded", String(row.expanded));
      name.tabIndex = row.selected ? 0 : -1;
      name.addEventListener("focus", () => {
        view = { ...view, selected: index };
        for (const node of navigation) node.tabIndex = node === name ? 0 : -1;
        for (const child of Array.from(list.children)) {
          const childLine = child.firstElementChild;
          if (childLine) childLine.classList.toggle("selected", child === item && setting("rowHighlight") !== false);
        }
      });
      navigation.push(name);
      el(line, "span", `v${row.version}`).className = "version";
      if (row.update) el(line, "span", `+ ${row.update.newest}`).className = "update";
      const toggle = command(line, row.stateText, `toggle:${row.id}`, () => row.enabled ? host.mods.disable(row.id) : host.mods.enable(row.id));
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", String(row.enabled));
      toggle.setAttribute("aria-label", `${row.enabled ? text.turnOff : text.turnOn} ${row.name}`);
      card(item, name, row.description, () => { view = reduceManager(view, { type: "expand", id: row.id }); render(`mod:${row.id}`); });
      toggle.setAttribute("aria-describedby", name.getAttribute("aria-describedby")!);
      cardOpeners.set(`toggle:${row.id}`, cardOpeners.get(`mod:${row.id}`)!);
      const question = item.lastElementChild;
      if (question) line.appendChild(question);
      if (row.expanded) {
        const detail = el(item, "div");
        detail.className = "expanded";
        el(detail, "p", displayText(row.catalogMod.manifest.description ?? ""));
        const actions = el(detail, "div");
        actions.className = "actions";
        if (row.update) command(actions, row.update.review ? text.review : text.update, `update:${row.id}`, () => host.mods.update(row.id));
        command(actions, row.enabled ? text.turnOff : text.turnOn, `enable:${row.id}`, () => row.enabled ? host.mods.disable(row.id) : host.mods.enable(row.id));
        command(actions, text.rollback, `rollback:${row.id}`, () => host.mods.rollback(row.id));
        command(actions, text.remove, `remove:${row.id}`, () => host.mods.remove(row.id));
        const permissions = button(actions, text.permissions, `permissions:${row.id}`, () => {
          consentId = row.id;
          consentGranted = row.consent.granted;
          consentOpener = `permissions:${row.id}`;
          render("consent-cancel");
        });
        permissions.disabled = !host.permissions || busy || state?.pendingConfirmation !== null;
      }
    });
    el(main, "p", text.rowHint).className = "muted";
  };
  const renderSearch = (parent: HTMLElement, label: string): void => {
    const tools = el(parent, "div");
    tools.className = "tools";
    search = el(tools, "input");
    const input = search;
    input.type = "search";
    input.placeholder = label;
    input.setAttribute("aria-label", label);
    input.dataset["focus"] = "search";
    input.value = view.query;
    input.addEventListener("input", () => { view = reduceManager(view, { type: "search", query: input.value }); render("search"); });
  };
  const renderUpdates = (main: HTMLElement): void => {
    if (!state) return;
    const updates = updateRows(state, host.updatePermissions);
    if (!updates.length) return;
    if (!showUpdates) {
      const banner = el(main, "div");
      banner.className = "updates-banner";
      banner.setAttribute("role", "status");
      el(banner, "span", `${updates.length} ${text.updates.toLowerCase()}. ${text.updatesRule}`);
      command(banner, text.updateAll, "update-all", () => host.mods.updateAll()).className = "primary";
      button(banner, text.review, "review-updates", () => { showUpdates = true; render("updates-close"); });
      return;
    }
    const box = frame(main, `${text.updates} (${updates.length})`);
    el(box, "p", text.updatesRule).className = "muted";
    command(box, text.updateAll, "update-all", () => host.mods.updateAll()).className = "primary";
    button(box, text.close, "updates-close", () => { showUpdates = false; render("review-updates"); });
    const list = el(box, "div");
    list.setAttribute("role", "list");
    for (const update of updates) {
      const row = el(list, "div");
      row.setAttribute("role", "listitem");
      const line = el(row, "div");
      line.className = "line";
      const name = button(line, update.name, `update-name:${update.id}`, () => {});
      name.className = "name";
      el(line, "span", `${update.installed} to ${update.newest}`).className = "version";
      const review = (): void => { void run(() => host.mods.update(update.id)); };
      command(line, update.review ? text.review : text.update, `apply-update:${update.id}`, () => host.mods.update(update.id));
      card(row, name, `${update.name}. ${update.installed} to ${update.newest}. ${update.note}`, review);
      if (row.lastElementChild) line.appendChild(row.lastElementChild);
    }
  };
  const renderBrowse = (main: HTMLElement): void => {
    if (!state) return;
    const box = frame(main, text.browse);
    renderSearch(box, text.searchBrowse);
    const list = el(box, "div");
    list.setAttribute("role", "list");
    const entries = [...state.catalog.curated, ...state.catalog.community, ...state.catalog.sideloads];
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!entry.ok) { el(box, "p", displayText(entry.problem)).className = "harm"; continue; }
      const mod = entry.mod;
      if (seen.has(mod.id) || !mod.name.toLowerCase().includes(view.query.toLowerCase())) continue;
      seen.add(mod.id);
      const item = el(list, "div");
      item.setAttribute("role", "listitem");
      const line = el(item, "div");
      line.className = "line";
      const name = button(line, displayText(mod.name), `browse:${mod.id}`, () => {});
      name.className = "name";
      const install = async (): Api2Call<unknown> => {
        const plan = await host.mods.planInstall([entry.ref]);
        if (!plan.ok) return plan;
        return host.mods.applyPlan(plan.value.id);
      };
      const installButton = command(line, text.install, `install:${mod.id}`, install);
      installButton.disabled ||= !mod.compatible;
      card(item, name, displayText(`${mod.name} v${mod.version}. ${mod.description ?? ""} ${mod.engineNote ?? ""}`), () => {
        view = reduceManager(view, { type: "expand", id: mod.id }); render(`browse:${mod.id}`);
      });
      if (item.lastElementChild) line.appendChild(item.lastElementChild);
      navigation.push(name);
      if (view.expanded === mod.id) {
        const detail = el(item, "div");
        detail.className = "expanded";
        el(detail, "p", displayText(mod.description ?? ""));
        el(detail, "p", displayText(mod.engineNote ?? ""));
      }
    }
    for (const problem of state.catalog.problems) el(box, "p", displayText(problem)).className = "harm";
    if (!seen.size) el(box, "p", text.noMatches);
  };

  const saveSetting = (definition: SettingDefinition, value: SettingValue): void => {
    if (validSetting(definition, value)) void run(() => host.settings.set({ ...host.settings.get(), [definition.id]: value }));
  };
  const renderSettings = (main: HTMLElement): void => {
    const page = part(main, "na-settings-page");
    el(page, "h2", text.settings);
    renderSearch(page, text.searchSettings);
    el(page, "p", text.settingsHint).className = "muted";
    const look = el(page, "details");
    look.open = openedGroups.has(text.look) || view.query.trim().length > 0
      && `${text.look} ${text.vanilla} ${text.neoAngband}`.toLowerCase().includes(view.query.trim().toLowerCase());
    look.addEventListener("toggle", () => { if (look.open) openedGroups.add(text.look); else openedGroups.delete(text.look); });
    const summary = el(look, "summary", `${text.look}: ${lookView(host).active}`);
    summary.dataset["focus"] = "group:look";
    navigation.push(summary);
    button(look, text.lookTitle, "choose-look", () => { picker = true; render("look-vanilla"); });
    for (const group of settingsGroups(host.settings.definitions, host.settings.get(), view.query)) {
      const details = el(page, "details");
      details.open = group.open || openedGroups.has(group.name);
      details.addEventListener("toggle", () => { if (details.open) openedGroups.add(group.name); else openedGroups.delete(group.name); });
      const title = el(details, "summary");
      title.dataset["focus"] = `group:${group.name}`;
      el(title, "span", displayText(group.name));
      el(title, "span", displayText(group.summary)).className = "muted";
      navigation.push(title);
      for (const definition of group.members) {
        const row = el(details, "div");
        const line = el(row, "div");
        line.className = "setting";
        const label = el(line, "label", displayText(definition.title));
        const key = `setting:${definition.id}`;
        label.dataset["focus"] = `${key}-label`;
        label.tabIndex = 0;
        const value = host.settings.get()[definition.id] ?? definition.default;
        if (definition.control === "switch") {
          const toggle = command(line, value ? text.on : text.off, key, () => host.settings.set({ ...host.settings.get(), [definition.id]: !value }));
          toggle.setAttribute("role", "switch");
          toggle.setAttribute("aria-checked", String(value));
          toggle.setAttribute("aria-label", displayText(definition.title));
        } else if (definition.control === "segments") {
          const segments = el(line, "div");
          segments.className = "segments";
          segments.setAttribute("role", "group");
          segments.setAttribute("aria-label", displayText(definition.title));
          for (const choice of definition.choices ?? []) {
            const node = command(segments, displayText(choice.label), `${key}:${choice.value}`, () => host.settings.set({ ...host.settings.get(), [definition.id]: choice.value }));
            node.setAttribute("aria-pressed", String(value === choice.value));
          }
        } else {
          const input = definition.control === "range" ? el(line, "input") : el(line, "select");
          input.dataset["focus"] = key;
          input.id = `${prefix}-${definition.id}`;
          label.htmlFor = input.id;
          input.setAttribute("aria-label", displayText(definition.title));
          input.disabled = busy || state?.pendingConfirmation !== null;
          if (input.tagName === "INPUT" || definition.control === "range") {
            const range = input as HTMLInputElement;
            range.type = "range";
            range.min = String(definition.min ?? 0);
            range.max = String(definition.max ?? 100);
            range.step = String(definition.step ?? 1);
            const readout = el(line, "span", `${value}${definition.unit ?? ""}`);
            range.addEventListener("input", () => { readout.textContent = `${range.value}${definition.unit ?? ""}`; });
          } else for (const choice of definition.choices ?? []) {
            const option = el(input, "option", displayText(choice.label));
            option.value = choice.value;
          }
          input.value = String(value);
          input.addEventListener("change", () => saveSetting(definition, definition.control === "range" ? Number(input.value) : input.value));
        }
        card(row, label, displayText(definition.description), () => {});
        const showCard = cardOpeners.get(`${key}-label`)!;
        for (const control of Array.from(line.querySelectorAll<HTMLElement>("[data-focus]"))) {
          if (control.dataset["focus"]) cardOpeners.set(control.dataset["focus"], showCard);
          control.setAttribute("aria-describedby", label.getAttribute("aria-describedby")!);
        }
        const question = row.lastElementChild;
        if (question) line.appendChild(question);
      }
    }
    const backup = el(page, "details");
    backup.open = openedGroups.has(text.backup) || view.query.trim().length > 0
      && `${text.backup} ${text.export} ${text.import} ${text.json}`.toLowerCase().includes(view.query.trim().toLowerCase());
    const backupSummary = el(backup, "summary", text.backup);
    backupSummary.dataset["focus"] = "group:backup";
    navigation.push(backupSummary);
    backup.addEventListener("toggle", () => { if (backup.open) openedGroups.add(text.backup); else openedGroups.delete(text.backup); });
    const area = el(backup, "textarea");
    area.dataset["focus"] = "backup-json";
    area.setAttribute("aria-label", text.json);
    area.value = backupText;
    area.addEventListener("input", () => { backupText = area.value; });
    const file = el(backup, "input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.dataset["focus"] = "import-file";
    file.setAttribute("aria-label", text.chooseFile);
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (!selected) return;
      void selected.text().then((value) => {
        if (disposed) return;
        backupText = value;
        render("import");
      }).catch(() => { if (!disposed) { message = text.invalidSettings; render("import-file"); } });
    });
    button(backup, text.export, "export", () => {
      backupText = exportSettings(host);
      area.value = backupText;
      area.focus();
      if (window?.URL.createObjectURL) {
        const url = window.URL.createObjectURL(new Blob([backupText], { type: "application/json" }));
        const link = el(backup, "a");
        link.href = url;
        link.download = "neo-angband-settings.json";
        link.click();
        link.remove();
        const timer = host.clock.setTimeout(() => window.URL.revokeObjectURL(url), 0);
        cleanupRender.push(() => { host.clock.clearTimeout(timer); window.URL.revokeObjectURL(url); });
      }
    });
    command(backup, text.import, "import", async () => {
      const document = importSettings(backupText, host.settings.definitions);
      if (!document) return { ok: false, reason: "refused", code: "settings-json", message: text.invalidSettings };
      const result = await host.settings.set(document.settings);
      if (!result.ok) return result;
      const desired = document.look === "Neo Angband" ? "Neo" : "Vanilla";
      const look = desired === host.look.read().desired ? result : await host.look.choose(desired);
      if (look.ok) message = text.saved;
      return look;
    });
  };

  const renderLook = (main: HTMLElement): void => {
    const page = part(main, "na-look-picker");
    el(page, "h1", text.lookTitle);
    el(page, "p", text.lookHint);
    const choices = el(page, "div");
    choices.className = "choices";
    for (const choice of ["Vanilla", "Neo"] as const) {
      const box = frame(choices, choice === "Neo" ? text.neoAngband : text.vanilla);
      el(box, "pre", choice === "Neo" ? "+-----------+-----------+\n| #....@....#| HP 42/50  |\n| #...o.....#| SP 12/12  |\n+-----------+-----------+" : "###########\n#....@....#\n#.........#\n#...o.....#\n###########").setAttribute("aria-hidden", "true");
      el(box, "p", choice === "Neo" ? text.neoAngbandHint : text.vanillaHint);
      if (choice === "Neo") el(box, "p", text.lookSettings).className = "muted";
      const choose = command(box, choice === "Neo" ? text.chooseNeoAngband : text.keepVanilla, choice === "Neo" ? "look-neo-angband" : "look-vanilla", () => host.look.choose(choice));
      choose.setAttribute("aria-pressed", String(host.look.read().desired === choice));
      navigation.push(choose);
    }
    if (lookView(host).pending) {
      el(page, "p", text.lookPending).setAttribute("role", "status");
      command(page, text.backVanilla, "look-back", () => host.look.choose("Vanilla"));
    }
    button(page, text.close, "look-close", () => { picker = false; render("look"); });
  };
  const renderNotices = (main: HTMLElement): void => {
    if (!state) return;
    const notice = recoveryView(state, host);
    if (!notice) return;
    const component = part(main, "na-manager-notices");
    const box = frame(component, notice.title);
    box.setAttribute("role", "status");
    el(box, "p", notice.text);
    if (notice.kind === "restore") {
      el(box, "p", `${text.needs} ${notice.plan.downloads.length + notice.unavailable.length} ${text.mods.toLowerCase()}`);
      const list = el(box, "ul");
      for (const { mod } of notice.plan.downloads) el(list, "li", `${displayText(mod.name)} v${mod.version}: ${text.ready}`);
      for (const mod of notice.unavailable) el(list, "li", `${displayText(mod.name)} v${mod.version}: ${displayText(mod.reason ?? text.unavailableVersion)}`).className = "harm";
      command(box, `${text.restore} (${notice.plan.downloads.length})`, "restore", () => host.recovery!.restore(notice.plan.id));
    } else {
      if (notice.kind === "safe") el(box, "p", text.startingOff);
      else for (const mod of notice.mods) el(box, "p", `${displayText(mod.name)} v${mod.version} ${text.switchedOff}`).className = "harm";
      button(box, text.openManager, "notice-manager", () => { picker = false; view = initialView; render(); });
      const action = command(box, notice.kind === "safe" ? text.startOff : text.continue, "notice-continue", () => notice.kind === "safe" ? host.recovery!.startWithModsOff() : host.recovery!.continue());
      action.disabled ||= !host.recovery;
    }
  };
  const closeConsent = (): void => { consentId = null; render(consentOpener); };
  const renderConsent = (): void => {
    const mod = state?.installed.find((entry) => entry.id === consentId);
    if (!mod || !host.permissions) { consentId = null; return; }
    const asks = host.permissions(mod.id).filter((ask) => ask.modId === mod.id);
    const modal = el(root, "div");
    modal.className = "modal";
    const dialog = part(modal, "na-consent-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", `${text.permissions}: ${displayText(mod.name)}`);
    const box = frame(dialog, `${text.permissions}: ${displayText(mod.name)}`);
    el(box, "p", text.consentHint);
    for (const ask of asks) {
      const row = el(box, "div");
      const line = el(row, "div");
      line.className = "permission";
      const label = el(line, "label");
      const input = el(label, "input");
      input.type = "checkbox";
      input.dataset["focus"] = `consent:${ask.capability}`;
      input.checked = !ask.canRunWithout || consentGranted.includes(ask.capability);
      input.disabled = !ask.canRunWithout || busy;
      input.setAttribute("aria-label", displayText(ask.consentText));
      input.addEventListener("change", () => { consentGranted = consentDecision(asks, input.checked ? [...consentGranted, ask.capability] : consentGranted.filter((capability) => capability !== ask.capability)).granted; });
      el(label, "span", displayText(ask.consentText));
      el(line, "span", ask.canRunWithout ? text.optional : text.required).className = ask.canRunWithout ? "muted" : "update";
      card(row, input, displayText([ask.consentText, ask.withoutIt].filter(Boolean).join(" ")), () => {});
      const question = row.lastElementChild;
      if (question) line.appendChild(question);
    }
    command(box, text.allow, "consent-allow", async () => {
      const result = await host.mods.recordConsent(mod.id, consentDecision(asks, consentGranted));
      if (result.ok) consentId = null;
      return result;
    }).className = "primary";
    button(box, text.cancel, "consent-cancel", closeConsent);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeConsent(); });
    for (const child of Array.from(root.children)) if (child !== modal && child.tagName !== "STYLE") (child as HTMLElement).inert = true;
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { swallow(event); closeConsent(); return; }
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>("[data-focus]")).filter((node) => !(node as HTMLButtonElement).disabled && !node.closest("[hidden]"));
      if (!nodes.length) return;
      const index = nodes.indexOf(active()!);
      swallow(event);
      nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length]?.focus();
    });
  };

  function render(focusKey?: string): void {
    if (disposed) return;
    const previous = active();
    const restoreKey = focusKey ?? previous?.dataset["focus"];
    const selection = previous && "selectionStart" in previous ? (previous as HTMLInputElement).selectionStart : null;
    closeCard?.();
    for (const cleanup of cleanupRender) cleanup();
    cleanupRender = [];
    cardOpeners.clear();
    navigation = [];
    search = null;
    cardNumber = 0;
    root.replaceChildren();
    variants();
    el(root, "style", ledgerStyles);
    const header = el(root, "header");
    el(header, "h1", text.mods);
    const nav = el(header, "nav");
    nav.setAttribute("aria-label", "Sections");
    for (const tab of ["installed", "browse", "lists", "settings"] as const) {
      const label = text[tab];
      const node = button(nav, "", `tab:${tab}`, () => open(tab));
      el(node, "u", label[0]);
      el(node, "span", label.slice(1));
      node.setAttribute("aria-current", view.tab === tab ? "page" : "false");
    }
    button(header, lookView(host).active, "look", () => { picker = true; render("look-vanilla"); });
    button(header, text.close, "close", close);
    const main = el(root, "main");
    if (message || busy || state?.pendingConfirmation) {
      const status = el(main, "p", state?.pendingConfirmation ? text.pending : busy ? text.busy : message);
      status.setAttribute("role", "status");
    }
    renderNotices(main);
    if (picker) renderLook(main);
    else if (view.tab === "settings") renderSettings(main);
    else if (view.tab === "installed") { renderUpdates(main); renderRows(main); }
    else if (view.tab === "browse") renderBrowse(main);
    else if (state) {
      const box = frame(main, text.lists);
      for (const mod of state.modList) el(box, "p", `${displayText(state.installed.find((entry) => entry.id === mod.id)?.name ?? mod.id)} v${mod.version}: ${mod.enabled ? text.on : text.off}`);
      command(box, text.restore, "restore-list", () => host.mods.restoreModList(state!.modList.map(({ id, enabled }) => ({ id, enabled })), true));
    }
    el(root, "footer", view.tab === "settings" ? text.settingsKeys : text.keys);
    if (consentId && !state?.pendingConfirmation) renderConsent();
    if (restoreKey) {
      focus(restoreKey);
      if (selection !== null && active()?.tagName === "INPUT" && (active() as HTMLInputElement).type !== "range") (active() as HTMLInputElement).setSelectionRange?.(selection, selection);
    }
  }
  const open = (tab: ManagerTab = "installed"): void => {
    if (disposed) return;
    if (root.hidden) opener = active();
    root.hidden = false;
    picker = false;
    consentId = null;
    view = reduceManager(view, { type: "tab", tab });
    render(`tab:${tab}`);
    void refresh();
    if (tab === "browse") void run(() => host.mods.browse());
  };
  function close(): void {
    closeCard?.();
    for (const cleanup of cleanupRender) cleanup();
    root.hidden = true;
    consentId = null;
    opener?.focus();
  }
  const action = (input: ReturnType<typeof keyAction>): void => {
    if (disposed || root.hidden || input === null) return;
    if (input === "b") {
      if (closeCard) { closeCard(); return; }
      if (consentId) { closeConsent(); return; }
      if (picker) { picker = false; render("look"); return; }
      if (view.expanded) { view = reduceManager(view, { type: "back" }); render(); return; }
      close(); return;
    }
    if (input === "y") { cardOpeners.get(active()?.dataset["focus"] ?? "")?.(); return; }
    if (input === "search") { search?.focus(); return; }
    if (["installed", "browse", "lists", "settings"].includes(input)) { if (!consentId) open(input as ManagerTab); return; }
    if (picker && ["up", "down", "left", "right"].includes(input)) {
      const index = navigation.indexOf(active()!);
      navigation[Math.max(0, Math.min(navigation.length - 1, index + (input === "up" || input === "left" ? -1 : 1)))]?.focus();
      return;
    }
    if (consentId) {
      const dialog = Array.from(root.children).find((node) => (node as HTMLElement).className === "modal");
      const nodes = focusables().filter((node) => dialog?.contains(node) && !(node as HTMLInputElement).disabled && !node.closest("[hidden]"));
      const index = nodes.indexOf(active()!);
      if (input === "up" || input === "down") nodes[Math.max(0, Math.min(nodes.length - 1, index + (input === "up" ? -1 : 1)))]?.focus();
      else if (input === "a") active()?.click();
      return;
    }
    if (input === "toggle") {
      const row = state ? managerRows(state, view, host.updatePermissions, host.permissions)[view.selected] : undefined;
      if (view.tab === "installed" && row) void run(() => row.enabled ? host.mods.disable(row.id) : host.mods.enable(row.id));
      return;
    }
    if (input === "a") { active()?.click(); return; }
    if (input === "left" || input === "right") {
      const tabs: ManagerTab[] = ["installed", "browse", "lists", "settings"];
      const at = tabs.indexOf(view.tab);
      open(tabs[(at + (input === "left" ? -1 : 1) + tabs.length) % tabs.length]);
      return;
    }
    const index = navigation.indexOf(active()!);
    const next = Math.max(0, Math.min(navigation.length - 1, index + (input === "up" ? -1 : 1)));
    view = reduceManager(view, { type: "move", delta: next - view.selected, length: navigation.length });
    navigation[next]?.focus();
  };
  root.addEventListener("keydown", (event) => {
    if (root.hidden || disposed) return;
    event.stopPropagation();
    const input = event.target as HTMLElement;
    const editing = ["INPUT", "SELECT", "TEXTAREA"].includes(input.tagName);
    const mapped = keyAction(event.key.length === 1 && event.key !== "?" ? event.key.toLowerCase() : event.key);
    if (!mapped || editing && mapped !== "b" && mapped !== "y") return;
    if (mapped === "a" && !consentId) return;
    if (mapped === "toggle" && !input.dataset["focus"]?.startsWith("mod:")) return;
    swallow(event);
    action(mapped);
  });
  root.addEventListener("pointerdown", (event) => {
    if (!(event.target as HTMLElement).closest("na-detail-card")) closeCard?.();
  });
  const stopSettings = host.settings.subscribe(() => { if (!disposed) render(); });
  void host.mods.subscribe(takeState).then((result) => {
    if (!result.ok) { if (!disposed) { safeMessage(result.message); render(); } return; }
    if (disposed) void host.mods.unsubscribe(result.value);
    else subscription = result.value;
  }).catch(() => { if (!disposed) { message = text.unavailable; render(); } });
  if (host.assetUrl) void loadFonts({ assetUrl: host.assetUrl }, LEDGER_FONTS).catch(() => {});
  void refresh();
  return {
    open, close,
    handleGamepad: action,
    dispose(): void {
      if (disposed) return;
      close();
      disposed = true;
      stopSettings();
      if (subscription) void host.mods.unsubscribe(subscription);
      root.replaceChildren();
      root.remove?.();
    },
  };
}
