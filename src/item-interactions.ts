import type { AgentCommand, InputToken, InspectSeam, IntentSeam, ItemPrompt, PromptSeam, QuantityPrompt, ActionBuilders, ItemIntentResult, ItemPanelContext } from "./seams.js";
import { submitItemIntent } from "./item-rules.js";

export function quantityShortcut(prompt: QuantityPrompt, shortcut: "One" | "Half" | "All"): number {
  return shortcut === "One" ? 1 : shortcut === "Half" ? Math.max(1, Math.floor(prompt.max / 2)) : prompt.max;
}

export function answerQuantity(seam: PromptSeam | undefined, prompt: QuantityPrompt, amount: number): { readonly accepted: boolean; readonly reason?: string } {
  if (!Number.isSafeInteger(amount) || amount < prompt.min || amount > prompt.max) return { accepted: false, reason: `Choose an amount from ${prompt.min} to ${prompt.max}.` };
  return seam?.reply(prompt.promptId, amount) ?? { accepted: false, reason: "Prompt reply unavailable." };
}

export function answerItem(seam: PromptSeam | undefined, prompt: ItemPrompt, handle: number): { readonly accepted: boolean; readonly reason?: string } {
  if (!prompt.choices.some((choice) => choice.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return seam?.reply(prompt.promptId, handle) ?? { accepted: false, reason: "Prompt reply unavailable." };
}

export function buildItemCommand(builders: ActionBuilders | undefined, code: string, handle: number, inscription?: string): AgentCommand {
  if (code === "wield") return builders?.wear(handle) ?? { code, args: { handle } };
  if (code === "takeoff") return builders?.takeoff(handle) ?? { code, args: { handle } };
  if (code === "drop") return builders?.drop(handle) ?? { code, args: { handle } };
  const args = inscription === undefined ? { handle } : { handle, inscription };
  return builders?.raw(code, args) ?? { code, args };
}

/** A floor command: the engine accepts `args.floor` in place of `args.handle` for
 * the codes in its catalogue's FLOOR_ITEM_CODES, and pickup takes `args.floor`
 * with no handle. The actions arm passes these as the command's argument. */
export function buildFloorCommand(builders: ActionBuilders | undefined, code: string, floorIndex: number, inscription?: string): AgentCommand {
  const args = inscription === undefined ? { floor: floorIndex } : { floor: floorIndex, inscription };
  return builders?.raw(code, args) ?? { code, args };
}

export function submitItem(intent: IntentSeam | undefined, inspect: InspectSeam | undefined, token: InputToken, code: string, handle: number, command: AgentCommand): { readonly accepted: boolean; readonly reason?: string } {
  const tester = inspect?.itemTester(code);
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "handle" in item && item.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return intent?.submit(token, { kind: "command", command }) ?? { accepted: false, reason: "Intent seam unavailable." };
}

/** Submit a floor action: the tester gates it as for a carried item, but matches the
 * floor pile's {x, y, index} entry the engine publishes for floor actions. */
export function submitFloorItem(intent: IntentSeam | undefined, inspect: InspectSeam | undefined, token: InputToken, code: string, floor: { x: number; y: number; index: number }, command: AgentCommand): { readonly accepted: boolean; readonly reason?: string } {
  const tester = inspect?.itemTester(code);
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "floor" in item && item.floor.x === floor.x && item.floor.y === floor.y && item.floor.index === floor.index)) return { accepted: false, reason: "Item is unavailable for this action." };
  return intent?.submit(token, { kind: "command", command }) ?? { accepted: false, reason: "Intent seam unavailable." };
}

/** Ignore or unignore one carried or worn item through the ignore and unignore
 * intents. The ignore item tester gates it, as the other item actions are gated. */
export function submitIgnore(ctx: Pick<ItemPanelContext, "intent" | "inspect">, token: InputToken, kind: "ignore" | "unignore", handle: number): ItemIntentResult & { readonly quiet?: boolean } {
  const tester = ctx.inspect?.itemTester("ignore");
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "handle" in item && item.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return submitItemIntent(ctx, token, { kind, handle });
}

/** A floor pile index from an item prompt's choice handle, which is -(index + 1). */
export function floorChoiceIndex(handle: number): number | null {
  return handle < 0 ? -handle - 1 : null;
}
