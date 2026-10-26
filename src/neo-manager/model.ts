import type { Api2Consent, Api2ManagerConfirmation, Api2ManagerState, ManageHost, SettingDefinition, SettingValue } from "./types.js";

export const ledgerText = {
  mods: "Mods", installed: "Installed", browse: "Browse", lists: "Mod lists", settings: "Settings", look: "Look",
  on: "ON", off: "OFF", details: "Details", close: "Close", about: "About", all: "All", updates: "Updates ready",
  update: "Update", updateAll: "Update all", review: "Review", install: "Install", remove: "Remove", rollback: "Roll back",
  permissions: "Permissions", allow: "Allow these", cancel: "Not now", required: "required", optional: "optional",
  noPermissions: "No new permissions.", unknownPermissions: "Review permissions with Core.",
  pending: "Waiting for confirmation in the game.", busy: "Working...", unavailable: "The mod manager is unavailable.",
  noMatches: "No matches.", searchMods: "Search installed mods", searchBrowse: "Search mods", searchSettings: "Search settings",
  show: "Show", turnOn: "Turn on", turnOff: "Turn off", version: "Version", can: "Can", updateReady: "Update ready",
  firstParty: "First-party: made by the Neo Angband team.", reviewed: "Reviewed: checked by a person before listing.",
  listed: "Listed: not reviewed.", sideloaded: "Unreviewed: loaded from this device. Nobody has checked it.", unknownTrust: "Trust is unknown.",
  permissionDetails: "Permission details are available in the game.", noPermissionsRequested: "No permissions requested.", notAllowed: "Not allowed", undecided: "Not decided",
  updatesRule: "Applied between games. Each old version stays for rollback.", newPermissions: "New permissions. Needs your OK.",
  rowHint: "Hover, focus, or long-press a name for a card.",
  keys: "Up/Down move | Enter open | Space on or off | / search | ? help | Esc back | Gamepad: A open, B back, Y details",
  settingsKeys: "Up/Down move | Enter open or close a group | / search | ? help | Esc back | Gamepad: A open, B back, Y details",
  settingsHint: "A search opens any group that holds a match. Every setting is in one JSON file you can export.",
  export: "Export settings", import: "Import settings", chooseFile: "Choose settings file", backup: "Backup", json: "Settings JSON", invalidSettings: "The settings JSON is invalid.",
  saved: "Settings saved.", lookTitle: "Choose your look", vanilla: "Vanilla", neoAngband: "Neo Angband", keepVanilla: "Keep Vanilla",
  chooseNeoAngband: "Choose Neo Angband", backVanilla: "Back to Vanilla",
  lookHint: "Both looks play the same game with the same mods and saves. Switch any time from the title screen.",
  vanillaHint: "The classic Angband look. Nothing to download. Mods managed on classic screens.",
  neoAngbandHint: "The same game in windows and menus that work with keyboard, gamepad, and touch. Installs and turns on AnybandUI.",
  lookSettings: "Tile art, high contrast, and screen reader labels are in Settings.",
  lookPending: "Neo Angband is waiting for AnybandUI to download. Back to Vanilla restores your earlier settings.",
  safeMode: "Safe mode", startingOff: "Starting with every mod off",
  safeHint: "The game did not finish starting twice in a row. Saves are untouched. Mods stay off until you turn them on.",
  openManager: "Open mod manager", startOff: "Start with mods off", restore: "Restore my mods", restoreHint: "One confirmation installs them and anything they depend on.",
  removed: "Removed for harm", removedHint: "This version was removed from the registry because it caused harm. Your saves are safe. The game will not load this version.",
  continue: "Continue", ready: "Ready", removedStatus: "Removed", unavailableVersion: "Unavailable", switchedOff: "was switched off", needs: "This save needs", downloads: "Downloads",
  consentHint: "Choose what it may do. Change this any time in Mod settings.",
} as const;

export function displayText(text: string): string { return text.replace(/\bNeo\b(?! Angband)/g, "Neo Angband"); }
export type ManagerTab = "installed" | "browse" | "lists" | "settings";
export interface ManagerView { readonly tab: ManagerTab; readonly selected: number; readonly expanded: string | null; readonly query: string; readonly filter: "all" | "on" | "off" | "updates" }
export const initialView: ManagerView = { tab: "installed", selected: 0, expanded: null, query: "", filter: "all" };
export type ManagerAction = { readonly type: "tab"; readonly tab: ManagerTab } | { readonly type: "move"; readonly delta: number; readonly length: number }
  | { readonly type: "expand"; readonly id: string } | { readonly type: "search"; readonly query: string }
  | { readonly type: "filter"; readonly filter: ManagerView["filter"] } | { readonly type: "back" };
export function reduceManager(view: ManagerView, action: ManagerAction): ManagerView {
  switch (action.type) {
    case "tab": return { ...initialView, tab: action.tab };
    case "move": return { ...view, selected: Math.max(0, Math.min(action.length - 1, view.selected + action.delta)) };
    case "expand": return { ...view, expanded: view.expanded === action.id ? null : action.id };
    case "search": return { ...view, query: action.query, selected: 0 };
    case "filter": return { ...view, filter: action.filter, selected: 0 };
    case "back": return { ...view, expanded: null };
  }
}

export function updateRows(state: Api2ManagerState, permissions?: ManageHost["updatePermissions"]) {
  return state.updates.filter((update) => update.standing === "behind" && update.newest !== null).map((update) => {
    const asks = permissions?.(update.id) ?? null;
    return { ...update, name: displayText(update.name ?? state.installed.find((mod) => mod.id === update.id)?.name ?? update.id),
      review: asks === null || asks.length > 0, note: asks === null ? ledgerText.unknownPermissions : asks.length ? ledgerText.newPermissions : ledgerText.noPermissions };
  });
}
export function managerRows(state: Api2ManagerState, view: ManagerView, updatePermissions?: ManageHost["updatePermissions"], permissions?: ManageHost["permissions"]) {
  const updates = updateRows(state, updatePermissions);
  return state.installed.filter((mod) => `${mod.name} ${mod.id}`.toLowerCase().includes(view.query.trim().toLowerCase()))
    .filter((mod) => view.filter === "all" || (view.filter === "on" && mod.enabled) || (view.filter === "off" && !mod.enabled)
      || (view.filter === "updates" && updates.some((update) => update.id === mod.id)))
    .map((mod, index) => {
      const update = updates.find((entry) => entry.id === mod.id);
      const trust = mod.tier?.trust;
      const asks = permissions?.(mod.id).filter((ask) => ask.modId === mod.id);
      const permissionText = asks ? asks.length ? asks.map((ask) => `${mod.consent.granted.includes(ask.capability) ? ledgerText.can : mod.consent.refused.includes(ask.capability) ? ledgerText.notAllowed : ledgerText.undecided}: ${displayText(ask.consentText)}.`).join(" ") : ledgerText.noPermissionsRequested : ledgerText.permissionDetails;
      const description = [displayText(mod.name), `v${mod.version}`, displayText(mod.catalogMod.manifest.description ?? ""),
        trust === "first-party" ? ledgerText.firstParty : trust === "reviewed" ? ledgerText.reviewed : trust === "listed" ? ledgerText.listed : trust === "sideloaded" ? ledgerText.sideloaded : ledgerText.unknownTrust,
        permissionText,
        update ? `${ledgerText.updateReady}: ${update.newest}. ${update.note}` : ""].filter(Boolean).join(" ");
      const letter = index < 26 ? String.fromCharCode(97 + index) : String(index + 1);
      return { ...mod, name: displayText(mod.name), letter, label: `${letter}) ${displayText(mod.name)}`, description,
        selected: index === view.selected, expanded: view.expanded === mod.id, stateText: mod.enabled ? ledgerText.on : ledgerText.off, update };
    });
}
export function consentDecision(asks: Api2ManagerConfirmation["permissions"], granted: readonly string[]): Api2Consent {
  return { granted: asks.filter((ask) => !ask.canRunWithout || granted.includes(ask.capability)).map((ask) => ask.capability),
    refused: asks.filter((ask) => ask.canRunWithout && !granted.includes(ask.capability)).map((ask) => ask.capability) };
}
export function settingsGroups(definitions: readonly SettingDefinition[], values: Readonly<Record<string, SettingValue>>, query: string) {
  const needle = query.trim().toLowerCase();
  return [...new Set(definitions.map((definition) => definition.group))].map((name) => {
    const members = definitions.filter((definition) => definition.group === name);
    const matches = members.filter((definition) => `${name} ${definition.title} ${definition.description}`.toLowerCase().includes(needle));
    return { name, members: needle ? matches : members, open: needle.length > 0 && matches.length > 0,
      summary: members.map((definition) => {
        const value = values[definition.id] ?? definition.default;
        return `${definition.title}: ${typeof value === "boolean" ? value ? ledgerText.on : ledgerText.off : definition.choices?.find((choice) => choice.value === value)?.label ?? value}${definition.unit ?? ""}`;
      }).join(" | ") };
  }).filter((group) => group.members.length > 0);
}
export function validSetting(definition: SettingDefinition, value: unknown): value is SettingValue {
  if (definition.control === "switch") return typeof value === "boolean";
  if (definition.control !== "range") return typeof value === "string" && definition.choices?.some((choice) => choice.value === value) === true;
  return typeof value === "number" && Number.isFinite(value) && value >= (definition.min ?? 0) && value <= (definition.max ?? 100)
    && Math.abs((value - (definition.min ?? 0)) / (definition.step ?? 1) - Math.round((value - (definition.min ?? 0)) / (definition.step ?? 1))) < 1e-8;
}
export interface SettingsDocument { readonly format: "neo-angband/anybandui/manager-settings"; readonly schemaVersion: 1; readonly look: "Vanilla" | "Neo Angband"; readonly settings: Readonly<Record<string, SettingValue>> }
export function exportSettings(host: Pick<ManageHost, "look" | "settings">): string {
  const settings = Object.fromEntries(host.settings.definitions.map((definition) => [definition.id, host.settings.get()[definition.id] ?? definition.default]));
  return JSON.stringify({ format: "neo-angband/anybandui/manager-settings", schemaVersion: 1, look: host.look.read().desired === "Neo" ? ledgerText.neoAngband : ledgerText.vanilla, settings }, null, 2);
}
export function importSettings(text: string, definitions: readonly SettingDefinition[]): SettingsDocument | null {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    if (record["format"] !== "neo-angband/anybandui/manager-settings" || record["schemaVersion"] !== 1 || !["Vanilla", "Neo Angband"].includes(String(record["look"]))) return null;
    const settings = record["settings"];
    if (!settings || typeof settings !== "object" || Array.isArray(settings) || Object.keys(settings).length !== definitions.length) return null;
    if (!definitions.every((definition) => Object.hasOwn(settings, definition.id) && validSetting(definition, (settings as Record<string, unknown>)[definition.id]))) return null;
    return raw as SettingsDocument;
  } catch { return null; }
}
export function lookView(host: ManageHost) {
  const look = host.look.read();
  return { active: look.active === "Neo" ? ledgerText.neoAngband : ledgerText.vanilla, pending: look.pending !== null, text: look.pending ? ledgerText.lookPending : ledgerText.lookHint };
}
export function recoveryView(state: Api2ManagerState, host: ManageHost) {
  const recovery = host.recovery?.read();
  return state.safeMode ? { kind: "safe" as const, title: ledgerText.safeMode, text: ledgerText.safeHint }
    : recovery?.removed.length ? { kind: "removed" as const, title: ledgerText.removed, text: ledgerText.removedHint, mods: recovery.removed }
    : recovery?.restore ? { kind: "restore" as const, title: ledgerText.restore, text: ledgerText.restoreHint, ...recovery.restore } : null;
}
export function isPhone(width: number): boolean { return width < 600; }
export function keyAction(key: string): "up" | "down" | "left" | "right" | "a" | "b" | "y" | "toggle" | "search" | ManagerTab | null {
  return ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Enter: "a", Escape: "b", "?": "y", " ": "toggle", "/": "search", i: "installed", b: "browse", m: "lists", s: "settings" } as const)[key as "i"] ?? null;
}

export function createCardTiming(clock: ManageHost["clock"], open: (touch: boolean) => void) {
  let timer: unknown;
  let pressed: number | null = null;
  const cancel = (): void => { if (timer !== undefined) clock.clearTimeout(timer); timer = undefined; };
  return {
    hover(): void { cancel(); timer = clock.setTimeout(() => { timer = undefined; open(false); }, 250); },
    leave: cancel,
    press(): void { cancel(); pressed = clock.now(); },
    release(): boolean {
      const held = pressed !== null && clock.now() - pressed >= 450;
      pressed = null;
      if (held) open(true);
      return held;
    },
    cancel(): void { pressed = null; cancel(); },
  };
}
