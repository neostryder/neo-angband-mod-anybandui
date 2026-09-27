/** Structural slices of neo-angband's optional host contracts.
 * These shapes keep the mod buildable against npm core 1.18.0, which predates the seams.
 * InputSnapshot mirrors packages/web/src/input-snapshot.ts and core agent/boundary.ts.
 * Intent and prompt mirror packages/web/src/intent-gate.ts and prompt-view.ts.
 * KnownLevel and inspect mirror packages/core/src/agent/known-level.ts and inspect.ts.
 * ItemsContext mirrors packages/web/src/mod-plugin.ts ModUi and core agent/types.ts AgentView.
 */
export interface Grid { readonly x: number; readonly y: number }
export interface InputToken { readonly epoch: number; readonly revision: number }
export interface ItemView { readonly handle: number; readonly label: string; readonly number: number; readonly inscription: string | null; readonly kindId?: string; readonly tval: number; readonly sval: number; readonly artifact: boolean; readonly ego: boolean }
export interface CoreSnapshot {
  readonly player?: { readonly grid: Grid } | null;
  readonly inventory?: readonly ItemView[] | null;
  readonly equipment?: readonly (ItemView | null)[] | null;
}
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
export interface PromptSeam { reply(promptId: number, answer: number): IntentResult }
export interface LoadoutStats { readonly speed: number; readonly ac: number; readonly toH: number; readonly toD: number; readonly blows: number; readonly shots: number; readonly maxHp: number; readonly maxSp: number; readonly totalWeight: number; readonly statUse: readonly number[]; readonly resists: readonly number[]; readonly resistElements: readonly string[]; readonly objectFlags: readonly string[] }
export interface LoadoutSimulation { readonly before: { readonly stats: LoadoutStats }; readonly after: { readonly stats: LoadoutStats }; readonly placements: readonly { readonly slot: number; readonly displaced: ItemView | null }[]; readonly unresolved: readonly unknown[] }
export interface ActionBuilders { wear(handle: number): AgentCommand; takeoff(handle: number): AgentCommand; drop(handle: number, quantity?: number): AgentCommand; raw(code: string, args?: Record<string, unknown>): AgentCommand }
export interface ItemsContext { readonly flags?: Readonly<Record<string, boolean>>; readonly snapshot?: () => InputSnapshot | null; readonly inspect?: InspectSeam; readonly intent?: IntentSeam; readonly prompt?: PromptSeam; readonly ui?: { openPanel(spec: { id: string; modal: boolean; label: string }): { readonly root: ShadowRoot; readonly closed: Promise<void>; close(): void } }; readonly core?: { createAgentView?(state: unknown): { simulateLoadout?(change: { wield: readonly { from: "gear"; handle: number }[] }): LoadoutSimulation | null }; createAgentActions?(state: unknown): ActionBuilders }; readonly state?: unknown; readonly prefs?: { get(): unknown }; readonly log: (message: string) => void }

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
