/** Structural slices of neo-angband's optional host contracts.
 * InputSnapshot mirrors packages/web/src/input-snapshot.ts and agent/boundary.ts.
 * Intent and prompt mirror packages/web/src/intent-gate.ts and prompt-view.ts.
 * KnownLevel and inspect mirror packages/core/src/agent/known-level.ts and inspect.ts.
 */
export interface Grid { readonly x: number; readonly y: number }
export interface InputToken { readonly epoch: number; readonly revision: number }
export interface InputSnapshot {
  readonly token: InputToken;
  readonly phase: "pregame" | "play" | "store" | "more" | "modal" | "dead" | null;
  readonly messagePending: boolean | null;
  readonly prompt: { readonly kind: string; readonly promptId: number; readonly cursor?: Grid; readonly path?: readonly Grid[] } | null;
  readonly core: { readonly player: { readonly grid: Grid } | null };
}
export interface KnownLevel {
  readonly token: InputToken;
  readonly cells: readonly { readonly x: number; readonly y: number; readonly remembered: { readonly feat: number; readonly objects: readonly unknown[] } }[];
}
export type PlayerIntent =
  | { readonly kind: "travel"; readonly x: number; readonly y: number }
  | { readonly kind: "target"; readonly x: number; readonly y: number }
  | { readonly kind: "command"; readonly command: { readonly code: string; readonly dir?: number; readonly args?: Record<string, unknown> } };
export interface IntentResult { readonly accepted: boolean; readonly reason?: string }
export interface MouseSeams {
  readonly snapshot?: () => InputSnapshot | null;
  readonly knownLevel?: () => KnownLevel | null;
  readonly intent?: { submit(token: InputToken, intent: PlayerIntent): IntentResult };
  readonly prompt?: { reply(promptId: number, answer: { action: "move"; x: number; y: number } | { action: "select" | "cancel" }): IntentResult };
  readonly inspect?: {
    projectionPath?(to: Grid): { readonly token: InputToken; readonly grids: readonly Grid[] } | null;
    tileActions?(at: Grid): readonly { readonly label: string; readonly intent: PlayerIntent }[] | null;
    travelPath?(to: Grid): { readonly token: InputToken; readonly grids: readonly Grid[] } | null;
  };
}
