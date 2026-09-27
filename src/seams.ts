/** Structural slices of neo-angband's optional host contracts.
 * These shapes keep the mod buildable against npm core 1.18.0, which predates the seams.
 * InputSnapshot mirrors packages/web/src/input-snapshot.ts and core agent/boundary.ts.
 * Intent and prompt mirror packages/web/src/intent-gate.ts and prompt-view.ts.
 * KnownLevel and inspect mirror packages/core/src/agent/known-level.ts and inspect.ts.
 * ItemsContext mirrors packages/web/src/mod-plugin.ts ModUi and core agent/types.ts AgentView.
 */
export interface Grid { readonly x: number; readonly y: number }
export interface InputToken { readonly epoch: number; readonly revision: number }
export interface ItemView { readonly handle: number; readonly label: string; readonly number: number; readonly inscription: string | null; readonly kindId?: string; readonly tval: number; readonly sval: number; readonly pval?: number; readonly timeout?: number; readonly artifact: boolean; readonly ego: boolean }
export interface CoreSnapshot {
  readonly player?: { readonly grid: Grid; readonly gold?: number } | null;
  readonly inventory?: readonly ItemView[] | null;
  readonly equipment?: readonly (ItemView | null)[] | null;
  readonly stores?: readonly StoreView[] | null;
}
// Phase 7 mirrors packages/core/src/agent/boundary.ts and packages/web/src/mod-plugin.ts.
export interface EffectMonsterView { readonly id: number; readonly race: string; readonly raceIndex: number; readonly grid: Grid; readonly visible: boolean; readonly hp: number; readonly maxHp: number; readonly asleep: boolean; readonly level: number; readonly raceFlags: readonly string[] }
export interface EffectSnapshot extends Omit<InputSnapshot, "core"> { readonly phase: InputSnapshot["phase"] | "dead"; readonly core: CoreSnapshot & { readonly player?: (NonNullable<CoreSnapshot["player"]> & { readonly hp?: number; readonly maxHp?: number }) | null; readonly monsters?: readonly EffectMonsterView[] | null } }
// Mirrors packages/core/src/agent/events.ts: a creature is "player" or a monster index.
export type EventActor = "player" | number;
export interface EffectEventMap {
  "combat-outcome": { readonly attacker: EventActor | null; readonly target: EventActor; readonly kind: "melee" | "ranged" | "spell" | "effect" | "trap"; readonly hit: boolean; readonly damage: number; readonly died: boolean; readonly grid: Grid; readonly seen: boolean };
  heal: { readonly who: EventActor; readonly amount: number; readonly grid: Grid; readonly seen: boolean };
  motion: { readonly who: EventActor; readonly from: Grid; readonly to: Grid; readonly kind: "walk" | "teleport"; readonly seen: boolean };
}
export interface EffectContext { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => EffectSnapshot | null; readonly knownLevel?: () => KnownLevel | null; readonly events?: { on<K extends keyof EffectEventMap>(name: K, handler: (event: EffectEventMap[K]) => void): void; off<K extends keyof EffectEventMap>(name: K, handler: (event: EffectEventMap[K]) => void): void }; readonly display?: { snapshot(): import("./zoom.js").DisplaySnapshot }; readonly prefs?: { get(): unknown } }
interface PromptBase { readonly promptId: number; readonly label?: string; readonly cursor?: Grid; readonly path?: readonly Grid[] }
export type ItemPrompt = PromptBase & { readonly kind: "item"; readonly label: string; readonly choices: readonly { readonly handle: number; readonly label: string; readonly letter: string }[]; readonly tabs: Readonly<{ floor: boolean; quiver: boolean; equipment: boolean }> };
export type QuantityPrompt = PromptBase & { readonly kind: "quantity"; readonly label: string; readonly min: number; readonly max: number; readonly defaultValue: number };
export type OtherPrompt = PromptBase & { readonly kind: string };
export interface InputSnapshot {
  readonly token: InputToken;
  readonly phase: "pregame" | "play" | "store" | "more" | "modal" | "dead" | null;
  readonly messagePending?: boolean | null;
  readonly prompt: ItemPrompt | QuantityPrompt | OtherPrompt | null;
  readonly core: CoreSnapshot;
}
export interface KnownLevel {
  readonly token: InputToken;
  readonly cells: readonly { readonly x: number; readonly y: number; readonly remembered: { readonly feat: number; readonly objects: readonly unknown[] } }[];
}
export interface AgentCommand { readonly code: string; readonly dir?: number; readonly args?: Readonly<Record<string, unknown>> }
export type PlayerIntent =
  | { readonly kind: "travel"; readonly x: number; readonly y: number }
  | { readonly kind: "target"; readonly x: number; readonly y: number }
  | { readonly kind: "command"; readonly command: AgentCommand };
export interface IntentResult { readonly accepted: boolean; readonly reason?: string }
export interface IntentSeam { submit(token: InputToken, intent: PlayerIntent): IntentResult }

// Item panels: the item-facing slice of the same seams.
export interface InspectResult { readonly token: InputToken; readonly title: string; readonly text: string }
export interface ItemTesterResult { readonly token: InputToken; readonly items: readonly ({ readonly handle: number } | { readonly floor: { readonly x: number; readonly y: number; readonly index: number } })[] }
export interface ItemRulesResult {
  readonly token: InputToken;
  readonly kinds: readonly { readonly kidx: number; readonly name: string; readonly ignoreAware: boolean; readonly ignoreUnaware: boolean; readonly noteAware: string | null; readonly noteUnaware: string | null }[];
  readonly quality: readonly { readonly itype: number; readonly name: string; readonly threshold: number; readonly thresholdName: string }[];
  readonly egos: readonly { readonly eidx: number; readonly name: string; readonly itype: number; readonly ignored: boolean }[];
}
export interface InspectSeam { inspectItem(ref: number): InspectResult | null; itemTester(code: string): ItemTesterResult | null; itemRules?(): ItemRulesResult | null }
export interface PromptSeam { reply(promptId: number, answer: number | boolean): IntentResult }
export interface LoadoutStats { readonly speed: number; readonly ac: number; readonly toH: number; readonly toD: number; readonly blows: number; readonly shots: number; readonly maxHp: number; readonly maxSp: number; readonly totalWeight: number; readonly statUse: readonly number[]; readonly resists: readonly number[]; readonly resistElements: readonly string[]; readonly objectFlags: readonly string[] }
export interface LoadoutSimulation { readonly before: { readonly stats: LoadoutStats }; readonly after: { readonly stats: LoadoutStats }; readonly placements: readonly { readonly slot: number; readonly displaced: ItemView | null }[]; readonly unresolved: readonly unknown[] }
export interface ActionBuilders { wear(handle: number): AgentCommand; takeoff(handle: number): AgentCommand; drop(handle: number, quantity?: number): AgentCommand; raw(code: string, args?: Record<string, unknown>): AgentCommand }
export interface ItemsContext { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => InputSnapshot | null; readonly inspect?: InspectSeam; readonly intent?: IntentSeam; readonly prompt?: PromptSeam; readonly ui?: { openPanel(spec: { id: string; modal: boolean; label: string }): { readonly root: ShadowRoot; readonly closed: Promise<void>; close(): void }; registerPanelKind?(spec: PanelKindSpec): () => void }; readonly core?: { createAgentView?(state: unknown): { simulateLoadout?(change: { wield: readonly ({ from: "gear"; handle: number } | { from: "store"; store: number; index: number })[] }): LoadoutSimulation | null }; createAgentActions?(state: unknown): ActionBuilders }; readonly state?: unknown; readonly prefs?: { get(): unknown }; readonly log: (message: string) => void }

// Map mouse: the map-facing slice of the same seams.
export interface MouseSeams {
  readonly snapshot?: () => InputSnapshot | null;
  readonly knownLevel?: () => KnownLevel | null;
  readonly intent?: IntentSeam;
  readonly prompt?: { reply(promptId: number, answer: { action: "move"; x: number; y: number } | { action: "select" | "cancel" }): IntentResult };
  readonly inspect?: {
    projectionPath?(to: Grid): { readonly token: InputToken; readonly grids: readonly Grid[] } | null;
    tileActions?(at: Grid): { readonly token: InputToken; readonly codes: readonly string[] } | null;
    travelPath?(to: Grid): { readonly token: InputToken; readonly grids: readonly Grid[] } | null;
  };
}

// Phase 4 mirrors packages/core/src/agent/types.ts and inspect.ts, packages/web/src/input-snapshot.ts, prompt-view.ts and mod-plugin.ts.
export interface SpellView { readonly name: string; readonly sidx: number; readonly bidx: number; readonly level: number; readonly mana: number; readonly fail: number; readonly chance?: number; readonly learned: boolean; readonly worked: boolean; readonly forgotten: boolean; readonly studyEligible?: boolean; readonly infoLine?: string }
export interface SpellbookView { readonly tval: number; readonly name: string; readonly realm: string; readonly spells: readonly SpellView[] }
export interface SpellInspectResult { readonly token: InputToken; readonly name: string; readonly description: string; readonly level: number; readonly mana: number; readonly failChance: number; readonly canCastNow: boolean }
export interface SpellPrompt { readonly kind: "spell"; readonly promptId: number; readonly label: string; readonly choices: readonly { readonly index: number; readonly name: string; readonly level: number; readonly mana: number; readonly fail: number; readonly castable: boolean }[] }
export interface Phase4Snapshot extends Omit<InputSnapshot, "core" | "prompt"> { readonly core: CoreSnapshot & { readonly spellbooks?: readonly SpellbookView[] | null; readonly player?: (NonNullable<CoreSnapshot["player"]> & { readonly level?: number; readonly sp?: number; readonly hp?: number; readonly maxHp?: number; readonly maxSp?: number; readonly classFlags?: readonly string[]; readonly learnableSpells?: number; readonly race?: string; readonly cls?: string }) | null }; readonly prompt: InputSnapshot["prompt"] | SpellPrompt | TextPrompt; readonly resting?: RestingView | null; readonly activeBlast?: ActiveBlastView | null }
export interface Phase4Context { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => Phase4Snapshot | null; readonly intent?: { submit(token: InputToken, intent: PlayerIntent | StopRestingIntent): IntentResult; catalogue?(): CommandCatalogue | null }; readonly prompt?: { reply(promptId: number, answer: number | string): IntentResult }; readonly inspect?: { spellInfo?(index: number): SpellInspectResult | null; bookForItem?(handle: number): BookItemResult | null; itemTester?(code: string): ItemTesterResult | null; inspectItem?(handle: number): InspectResult | null; blastArea?(to: Grid, radius: number): BlastAreaResult | null; tileActions?(at: Grid): { readonly token: InputToken; readonly codes: readonly string[] } | null }; readonly ui?: ItemsContext["ui"]; readonly prefs?: { get(): unknown; set(value: unknown): void }; readonly display?: { snapshot(): import("./zoom.js").DisplaySnapshot }; readonly controller?: { driver(): { readonly kind: "player" | "autoplayer"; readonly owner?: string; readonly label?: string } | null }; readonly character?: { key(): string | null }; readonly state?: unknown; readonly log: (message: string) => void }
// Phase 5: StoreView mirrors packages/core/src/agent/types.ts; CoreSnapshot.stores
// and player.gold mirror agent/boundary.ts and entity-views.ts. StoreContext
// combines packages/web/src/mod-plugin.ts with an optional proposed store
// status read. The current host does not publish readiness or sell eligibility.
export interface StoreItemView extends ItemView { readonly index: number; readonly price?: number }
export interface StoreView { readonly feat: number; readonly featName: string; readonly isHome: boolean; readonly owner: { readonly name: string; readonly purse: number }; readonly stock: readonly StoreItemView[] }
export interface StoreStatus { readonly feat: number; readonly ready: boolean; readonly noSelling: boolean; readonly transactionPrompts?: boolean; readonly inventory?: readonly { readonly handle: number; readonly eligible: boolean; readonly price?: number }[] }
export interface StoreContext extends ItemsContext {
  readonly knownLevel?: () => KnownLevel | null;
  readonly controller?: { driver?(): { readonly kind: "player" | "autoplayer"; readonly owner?: string; readonly label?: string } | null };
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

// Spells, quickbar, rest and blast preview adoption. BookItemResult and
// BlastAreaResult mirror packages/core/src/agent/inspect.ts; SpellView's
// studyEligible and infoLine and PlayerView.learnableSpells mirror
// core/src/agent/types.ts; RestingView and ActiveBlastView mirror
// packages/web/src/input-snapshot.ts InputSnapshot.resting and activeBlast;
// TextPrompt mirrors the text descriptor in packages/web/src/prompt-view.ts;
// StopRestingIntent and CommandCatalogue mirror packages/web/src/intent-gate.ts.
export interface BookItemResult { readonly token: InputToken; readonly bookIndex: number; readonly spells: readonly number[] }
export interface BlastAreaResult { readonly token: InputToken; readonly grids: readonly Grid[]; readonly radius?: number; readonly element?: string | null; readonly wallsStop?: boolean }
export interface RestingView { readonly active: boolean; readonly mode: number | null; readonly turnsRemaining: number | null }
export interface ActiveBlastView { readonly token: InputToken; readonly radius: number; readonly element: string; readonly wallsStop: boolean }
export interface TextPrompt { readonly kind: "text"; readonly promptId: number; readonly label: string; readonly maxLength: number; readonly defaultValue: string; readonly tag?: "rest" }
export interface StopRestingIntent { readonly kind: "stop-resting" }
export interface CommandCatalogue { readonly token: InputToken; readonly commands: readonly { readonly code: string; readonly args: string; readonly phase: "play" | "store" }[]; readonly intents: readonly { readonly kind: string; readonly args: string }[] }
