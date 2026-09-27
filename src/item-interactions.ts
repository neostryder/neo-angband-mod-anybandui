import type { AgentCommand, InputToken, InspectSeam, IntentSeam, ItemPrompt, PromptSeam, QuantityPrompt, ActionBuilders } from "./seams.js";

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

export function submitItem(intent: IntentSeam | undefined, inspect: InspectSeam | undefined, token: InputToken, code: string, handle: number, command: AgentCommand): { readonly accepted: boolean; readonly reason?: string } {
  const tester = inspect?.itemTester(code);
  if (!tester || tester.token.epoch !== token.epoch || tester.token.revision !== token.revision || !tester.items.some((item) => "handle" in item && item.handle === handle)) return { accepted: false, reason: "Item is unavailable for this action." };
  return intent?.submit(token, { kind: "command", command }) ?? { accepted: false, reason: "Intent seam unavailable." };
}
