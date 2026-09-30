/** Structural slices of neo-angband's optional host contracts.
 * Core types are imported where Core publishes them; web-only contracts stay local.
 * InputSnapshot mirrors packages/web/src/input-snapshot.ts and core agent/boundary.ts.
 * Intent and prompt mirror packages/web/src/intent-gate.ts and prompt-view.ts.
 * KnownLevel and inspect mirror packages/core/src/agent/known-level.ts and inspect.ts.
 * ItemsContext mirrors packages/web/src/mod-plugin.ts ModUi and core agent/types.ts AgentView.
 */
import type { ActualCell as CoreActualCell, AgentActions, DerivedStatsView, GameEventMap, InputToken as CoreInputToken, ItemRulesResult as CoreItemRulesResult, ItemTesterResult as CoreItemTesterResult, ItemView as CoreItemView, KnownLevelView, LoadoutItemRef, MonsterView, PlayerView, SpellInspectResult as CoreSpellInspectResult, SpellView as CoreSpellView, SpellbookView as CoreSpellbookView, StoreItemView as CoreStoreItemView, StoreView as CoreStoreView } from "@rpgm-tools/neo-angband-core";
export type Grid = import("@rpgm-tools/neo-angband-core").Loc;
export type InputToken = CoreInputToken;
export type ItemView = CoreItemView;
export interface CoreSnapshot {
  readonly player?: { readonly grid: Grid; readonly gold?: number } | null;
  readonly inventory?: readonly ItemView[] | null;
  readonly equipment?: readonly (ItemView | null)[] | null;
  readonly stores?: readonly StoreView[] | null;
}
// Phase 7 mirrors packages/core/src/agent/boundary.ts and packages/web/src/mod-plugin.ts.
export type EffectMonsterView = MonsterView;
export interface EffectSnapshot extends Omit<InputSnapshot, "core"> { readonly phase: InputSnapshot["phase"] | "dead"; readonly core: CoreSnapshot & { readonly player?: PlayerView | null; readonly monsters?: readonly EffectMonsterView[] | null } }
// Mirrors packages/core/src/agent/events.ts: a creature is "player" or a monster index.
export type EventActor = GameEventMap["combat-outcome"]["target"];
export type EffectEventMap = Pick<GameEventMap, "combat-outcome" | "heal" | "motion" | "explosion">;
export interface EffectContext { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => EffectSnapshot | null; readonly knownLevel?: () => KnownLevel | null; readonly events?: { on<K extends keyof EffectEventMap>(name: K, handler: (type: K, event: EffectEventMap[K]) => void): void; off<K extends keyof EffectEventMap>(name: K, handler: (type: K, event: EffectEventMap[K]) => void): void }; readonly display?: { snapshot(): import("./zoom.js").DisplaySnapshot }; readonly prefs?: { get(): unknown }; readonly settings?: ModSettings }
// MOD_SEAMS 4y, ctx.settings (packages/web/src/mod-plugin.ts): the manifest's numeric settings, clamped and stepped by the host.
export interface ModSettings { get(id: string): number | undefined; all?(): Readonly<Record<string, number>>; onChange?(listener: (id: string, value: number) => void): () => void }
interface PromptBase { readonly promptId: number; readonly label?: string; readonly cursor?: Grid; readonly path?: readonly Grid[] }
export type ItemPrompt = PromptBase & { readonly kind: "item"; readonly label: string; readonly choices: readonly { readonly handle: number; readonly label: string; readonly letter: string }[]; readonly tabs: Readonly<{ floor: boolean; quiver: boolean; equipment: boolean }> };
export type QuantityPrompt = PromptBase & { readonly kind: "quantity"; readonly label: string; readonly min: number; readonly max: number; readonly defaultValue: number };
export type OtherPrompt = PromptBase & { readonly kind: string };
export interface InputSnapshot {
  readonly token: InputToken;
  /** Absent on engines before neo-angband #290; see input-owner.ts. */
  readonly driver?: InputDriver;
  readonly phase: "pregame" | "play" | "store" | "more" | "modal" | "dead" | null;
  readonly messagePending?: boolean | null;
  readonly prompt: ItemPrompt | QuantityPrompt | OtherPrompt | null;
  readonly core: CoreSnapshot;
}
export type KnownLevel = KnownLevelView;
export type ActualCell = CoreActualCell;
export type ActualObject = Pick<CoreItemView, "artifact" | "ego" | "curses" | "flags" | "modifiers" | "brands" | "slays" | "resists" | "toH" | "toD" | "toA">;
export type AgentCommand = import("@rpgm-tools/neo-angband-core").AgentCommand;
export type PlayerIntent =
  | { readonly kind: "travel"; readonly x: number; readonly y: number; readonly modifiers?: Readonly<{ shift?: boolean; ctrl?: boolean }> }
  | { readonly kind: "target"; readonly x: number; readonly y: number }
  | { readonly kind: "command"; readonly command: AgentCommand };
export interface IntentResult { readonly accepted: boolean; readonly reason?: string; readonly code?: string }
export interface IntentSeam { submit(token: InputToken, intent: PlayerIntent): IntentResult }

// Item panels: the item-facing slice of the same seams.
export type InspectResult = import("@rpgm-tools/neo-angband-core").InspectResult;
export type ItemTesterResult = CoreItemTesterResult;
export type ItemRulesResult = CoreItemRulesResult;
export interface InspectSeam { inspectItem(ref: number): InspectResult | null; itemTester(code: string): ItemTesterResult | null; itemRules?(): ItemRulesResult | null }
export interface PromptSeam { reply(promptId: number, answer: number | boolean): IntentResult }
export type LoadoutSimulation = import("@rpgm-tools/neo-angband-core").LoadoutSimulation;
export type LoadoutStats = Pick<DerivedStatsView, "speed" | "ac" | "toH" | "toD" | "blows" | "shots" | "maxHp" | "maxSp" | "totalWeight" | "statUse" | "resists" | "resistElements" | "objectFlags">;
export type ActionBuilders = Pick<AgentActions, "wear" | "takeoff" | "drop" | "raw">;
export interface ItemsContext { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => InputSnapshot | null; readonly inspect?: InspectSeam; readonly intent?: IntentSeam; readonly prompt?: PromptSeam; readonly ui?: { openPanel(spec: { id: string; modal: boolean; label: string }): { readonly root: ShadowRoot; readonly closed: Promise<void>; close(): void }; registerPanelKind?(spec: PanelKindSpec): () => void }; readonly core?: { createAgentView?(state: unknown): { simulateLoadout?(change: { wield: readonly ({ from: "gear"; handle: number } | { from: "store"; store: number; index: number })[] }): LoadoutSimulation | null }; createAgentActions?(state: unknown): ActionBuilders }; readonly state?: unknown; readonly prefs?: { get(): unknown }; readonly log: (message: string) => void }

// Map mouse: the map-facing slice of the same seams.
export interface MouseSeams {
  readonly snapshot?: () => InputSnapshot | null;
  readonly knownLevel?: () => KnownLevel | null;
  readonly intent?: IntentSeam;
  readonly prompt?: { reply(promptId: number, answer: { action: "move"; x: number; y: number } | { action: "select" | "cancel" }): IntentResult };
  readonly inspect?: {
    projectionPath?(to: Grid): import("@rpgm-tools/neo-angband-core").GridInspectResult | null;
    tileActions?(at: Grid): import("@rpgm-tools/neo-angband-core").TileActionsResult | null;
    travelPath?(to: Grid): import("@rpgm-tools/neo-angband-core").TravelPathResult | null;
  };
}

// Phase 4 mirrors packages/core/src/agent/types.ts and inspect.ts, packages/web/src/input-snapshot.ts, prompt-view.ts and mod-plugin.ts.
export type SpellView = CoreSpellView;
export type SpellbookView = CoreSpellbookView;
export type SpellInspectResult = CoreSpellInspectResult;
export interface SpellPrompt { readonly kind: "spell"; readonly promptId: number; readonly label: string; readonly choices: readonly { readonly index: number; readonly name: string; readonly level: number; readonly mana: number; readonly fail: number; readonly castable: boolean }[] }
export interface Phase4Snapshot extends Omit<InputSnapshot, "core" | "prompt"> { readonly core: CoreSnapshot & { readonly spellbooks?: readonly SpellbookView[] | null; readonly player?: (NonNullable<CoreSnapshot["player"]> & { readonly level?: number; readonly sp?: number; readonly hp?: number; readonly maxHp?: number; readonly maxSp?: number; readonly classFlags?: readonly string[]; readonly learnableSpells?: number; readonly race?: string; readonly cls?: string }) | null }; readonly prompt: InputSnapshot["prompt"] | SpellPrompt | TextPrompt; readonly resting?: RestingView | null; readonly activeBlast?: ActiveBlastView | null }
export interface Phase4Context { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => Phase4Snapshot | null; readonly intent?: { submit(token: InputToken, intent: PlayerIntent | StopRestingIntent): IntentResult; catalogue?(): CommandCatalogue | null }; readonly prompt?: { reply(promptId: number, answer: number | string | { readonly action: "cancel" }): IntentResult }; readonly inspect?: { spellInfo?(index: number): SpellInspectResult | null; bookForItem?(handle: number): BookItemResult | null; itemTester?(code: string): ItemTesterResult | null; inspectItem?(handle: number): InspectResult | null; blastArea?(to: Grid, radius: number, arc?: number): BlastAreaResult | null; tileActions?(at: Grid): { readonly token: InputToken; readonly codes: readonly string[] } | null }; readonly ui?: ItemsContext["ui"]; readonly prefs?: { get(): unknown; set(value: unknown): void }; readonly display?: { snapshot(): import("./zoom.js").DisplaySnapshot }; readonly driver?: () => InputDriver; readonly character?: { key(): string | null }; readonly state?: unknown; readonly log: (message: string) => void }
// Phase 5: StoreView mirrors packages/core/src/agent/types.ts; CoreSnapshot.stores
// and player.gold mirror agent/boundary.ts and entity-views.ts. StoreStatus
// mirrors InputSnapshot.storeStatus in packages/web/src/input-snapshot.ts, and
// StoreContext combines packages/web/src/mod-plugin.ts with the store section
// appended at the end of this file.
export type StoreItemView = CoreStoreItemView;
export type StoreView = CoreStoreView;
export interface StoreStatus { readonly token: InputToken; readonly feat: number; readonly ready: boolean; readonly noSelling: boolean; readonly inventory: readonly { readonly handle: number; readonly location?: "pack" | "quiver" | "equipment"; readonly eligible: boolean; readonly price: number | null }[] }
export interface StoreContext extends ItemsContext {
  readonly snapshot?: () => StoreSnapshot | null;
  readonly prompt?: StorePromptSeam;
  readonly inspect?: StoreInspectSeam;
  readonly knownLevel?: () => KnownLevel | null;
  readonly driver?: () => InputDriver;
  readonly store?: { current?(): StoreStatus | null };
}

// Phase 6: panel kinds mirror packages/web/src/mod-plugin.ts PanelKindSpec and PanelMount.
export interface PanelState { readonly bounds: Readonly<{ width: number; height: number }>; readonly active: boolean; readonly focused: boolean }
export interface PanelMount {
  readonly id: string;
  readonly root: ShadowRoot;
  readonly bounds: Readonly<{ width: number; height: number }>;
  readonly active: boolean;
  readonly focused: boolean;
  onStateChange(listener: (state: PanelState) => void): () => void;
  requestFocus(): void;
  requestClose(): void;
  setFitHeight(px: number | null): void;
}
export interface PanelKindSpec {
  readonly kind: string;
  readonly label: string;
  readonly tab?: string;
  readonly minSize?: Readonly<{ width: number; height: number }>;
  readonly preferredPlacement?: Readonly<{ kind: "dock"; target: string; edge: "left" | "right" | "top" | "bottom" }> | Readonly<{ kind: "tab"; target: string }>;
  readonly fitHeight?: number;
  mount(host: PanelMount): void | (() => void);
}
export interface PanelKindSeam { registerPanelKind?(spec: PanelKindSpec): () => void }

// Driver part (MOD_SEAMS 4q): who holds input, the public mod list, and the
// display getters. InputDriver mirrors packages/web/src/input-snapshot.ts and
// the "driver-changed" payload in packages/core/src/events.ts GameEventMap.
// PublicMod mirrors ModPluginContext.mods in packages/web/src/mod-plugin.ts.
// The event handler receives (type, data), as GameEventHandler does in
// packages/core/src/events.ts.
export type InputDriver = GameEventMap["driver-changed"];
export interface PublicMod { readonly id: string; readonly version: string; readonly flags?: Readonly<Record<string, boolean>> }
export interface DriverEvents {
  on(name: "driver-changed", handler: (type: "driver-changed", event: InputDriver) => void): void;
  off(name: "driver-changed", handler: (type: "driver-changed", event: InputDriver) => void): void;
}
export interface DriverSeams {
  readonly driver?: () => InputDriver;
  readonly mods?: () => readonly PublicMod[];
  readonly events?: DriverEvents;
}

// Store window adoption. StoreSnapshot mirrors InputSnapshot.storeStatus in
// packages/web/src/input-snapshot.ts. StoreQuantityPrompt, StorePromptAnswer and
// StoreReplyResult mirror PromptDescriptor, PromptAnswer and PromptReplyResult in
// packages/web/src/prompt-view.ts. StoreInspectSeam mirrors ModInspect.inspectItem
// and compareLoadoutSlots in packages/web/src/input-snapshot.ts, with
// InspectResult.sections and LoadoutSlotsResult from packages/core/src/agent/inspect.ts
// and LoadoutItemRef from packages/core/src/agent/types.ts.
export interface StoreSnapshot extends InputSnapshot { readonly storeStatus?: StoreStatus | null }
export type StoreQuantityPrompt = QuantityPrompt & { readonly unitPrice?: number; readonly totalPrice?: number; readonly totals?: readonly number[]; readonly gold?: number };
export type StoreConfirmPrompt = PromptBase & { readonly kind: "confirm"; readonly label: string; readonly price?: number };
export type StorePromptAnswer = number | boolean | { readonly action: "cancel" };
export type StoreReplyResult = IntentResult;
export interface StorePromptSeam { reply(promptId: number, answer: StorePromptAnswer): StoreReplyResult }
export type StoreItemRef = number | { readonly store: number; readonly index: number };
export type InspectSection = NonNullable<InspectResult["sections"]>[number];
export type StoreInspectResult = InspectResult;
export type LoadoutSlotRef = LoadoutItemRef;
export type LoadoutSlotsResult = import("@rpgm-tools/neo-angband-core").LoadoutSlotsResult;
export interface StoreInspectSeam extends Omit<InspectSeam, "inspectItem"> {
  inspectItem(ref: StoreItemRef): StoreInspectResult | null;
  compareLoadoutSlots?(ref: LoadoutSlotRef): LoadoutSlotsResult | null;
}

// Spells, quickbar, rest and blast preview adoption. BookItemResult and
// BlastAreaResult mirror packages/core/src/agent/inspect.ts; SpellView's
// studyEligible and infoLine and PlayerView.learnableSpells mirror
// core/src/agent/types.ts; RestingView and ActiveBlastView mirror
// packages/web/src/input-snapshot.ts InputSnapshot.resting and activeBlast;
// TextPrompt mirrors the text descriptor in packages/web/src/prompt-view.ts;
// StopRestingIntent and CommandCatalogue mirror packages/web/src/intent-gate.ts.
// RestMode, BlastAreaResult.arc, ActiveBlastView.arc, CommandCatalogue.commands[].verb
// and the cancel reply on Phase4Context.prompt mirror the new fields in those
// files and remain optional so an older engine's payload still satisfies these
// shapes.
export type RestMode = "turns" | "complete" | "all-points" | "some-points";
export type BookItemResult = import("@rpgm-tools/neo-angband-core").BookItemResult;
export type BlastAreaResult = import("@rpgm-tools/neo-angband-core").BlastAreaResult;
export interface RestingView { readonly active: boolean; readonly mode: number | RestMode | null; readonly turnsRequested?: number | null; readonly turnsRemaining: number | null; readonly turnsRested?: number | null }
export interface ActiveBlastView { readonly token: InputToken; readonly radius: number; readonly arc?: number; readonly element: string; readonly wallsStop: boolean }
export interface TextPrompt { readonly kind: "text"; readonly promptId: number; readonly label: string; readonly maxLength: number; readonly defaultValue: string; readonly tag?: "rest" }
export interface StopRestingIntent { readonly kind: "stop-resting" }
export interface CommandCatalogue { readonly token: InputToken; readonly commands: readonly { readonly code: string; readonly verb?: string | null | undefined; readonly args: string; readonly phase: "play" | "store" }[]; readonly intents: readonly { readonly kind: string; readonly args: string }[] }

// Map clicks, hover cards and messages. MessageHistory mirrors the `messages`
// part of packages/web/src/input-snapshot.ts InputSnapshot; AckPrompt mirrors
// the "ack" arm of prompt-view.ts PromptDescriptor and AckReply the matching
// PromptAnswer; MonsterRecallResult mirrors packages/core/src/agent/types.ts
// InspectResult as monsterRecall returns it (inspect.ts). `log` mirrors the
// `log` arm InputSnapshot gained alongside `entries` (input-snapshot.ts): the
// oldest-first history with each entry's repeat count and the colour it was
// drawn in. Absent on engines that pre-date the field.
export interface MessageHistory {
  readonly token: InputToken;
  readonly entries: readonly string[];
  readonly log?: readonly { readonly text: string; readonly count: number; readonly color?: string }[];
}
export type AckPrompt = PromptBase & { readonly kind: "ack"; readonly label: string; readonly tag: "more" };
export interface AckReply { readonly action: "acknowledge" }
export interface MonsterRecallResult { readonly token: InputToken; readonly title: string; readonly text: string }
export interface MessageSnapshot extends Omit<InputSnapshot, "prompt"> { readonly messages?: MessageHistory | null; readonly prompt: InputSnapshot["prompt"] | AckPrompt }
export interface RecallSnapshot extends Omit<InputSnapshot, "core"> { readonly core: CoreSnapshot & { readonly monsters?: readonly EffectMonsterView[] | null } }
export interface MessageSeams { readonly snapshot?: () => MessageSnapshot | null; readonly prompt?: { reply(promptId: number, answer: AckReply): IntentResult } }
export interface RecallSeam { monsterRecall?(raceIndex: number): MonsterRecallResult | null }

// Item panel part. ItemIdentity mirrors the kindKey, itemKey and nameColor fields of
// packages/core/src/agent/types.ts ItemView. ItemPanelSnapshot mirrors the quiver,
// equipmentSlots and floorHere parts of agent/boundary.ts CoreSnapshot. ItemRef,
// ItemInspectResult and LoadoutSlotsResult mirror agent/inspect.ts and
// packages/web/src/input-snapshot.ts ModInspect. ItemIntent and ItemIntentResult
// mirror the ignore, unignore and item-rule arms and IntentResult.code of
// packages/web/src/intent-gate.ts. Every field is optional so an older engine's
// snapshot still satisfies these shapes.
export type PanelItemView = ItemView;
export type EquipmentSlotView = NonNullable<import("@rpgm-tools/neo-angband-core").CoreSnapshot["equipmentSlots"]>[number];
export interface ItemPanelSnapshot extends Omit<InputSnapshot, "core"> {
  readonly core: Omit<CoreSnapshot, "inventory" | "equipment"> & {
    readonly inventory?: readonly PanelItemView[] | null;
    readonly equipment?: readonly (PanelItemView | null)[] | null;
    readonly quiver?: readonly PanelItemView[] | null;
    readonly equipmentSlots?: readonly EquipmentSlotView[] | null;
    readonly floorHere?: readonly PanelItemView[] | null;
  };
}
export type ItemRef = number | { readonly floor: { readonly x: number; readonly y: number; readonly index: number } } | { readonly store: number; readonly index: number };
export type ItemInspectResult = InspectResult;
export type LoadoutRef = LoadoutItemRef;
export type ItemRuleName = "kind-aware" | "kind-unaware" | "ego" | "quality" | "note-aware" | "note-unaware";
export type ItemIntent =
  | { readonly kind: "ignore" | "unignore"; readonly handle: number }
  | { readonly kind: "item-rule"; readonly rule: ItemRuleName; readonly index: number; readonly itype?: number; readonly value: boolean | number | string };
// InspectSection and LoadoutSlotsResult are declared once, in the store window section above.
export type ItemIntentResult = IntentResult;
export interface IntentCatalogue { readonly token: InputToken;
  // MOD_SEAMS (packages/web/src/intent-gate.ts catalogue.commands); absent on older engines.
  readonly commands?: readonly { readonly code: string; readonly args: string }[];
  readonly intents: readonly { readonly kind: string; readonly args: string }[] }
export interface ItemPanelContext extends Omit<ItemsContext, "snapshot" | "inspect" | "intent"> {
  readonly snapshot?: () => ItemPanelSnapshot | null;
  readonly inspect?: Omit<InspectSeam, "inspectItem"> & { inspectItem(ref: ItemRef): ItemInspectResult | null; compareLoadoutSlots?(ref: LoadoutRef): LoadoutSlotsResult | null };
  readonly intent?: { submit(token: InputToken, intent: PlayerIntent | ItemIntent): ItemIntentResult; catalogue?(): IntentCatalogue | null };
}
