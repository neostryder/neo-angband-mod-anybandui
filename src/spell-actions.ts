import { playerIsDriving } from "./input-owner.js";
import type { Phase4Context, Phase4Snapshot, SpellPrompt, TextPrompt } from "./seams.js";
import { sameToken, type BookRow, type SpellRow } from "./view-model/spells.js";

export function actionReady(ctx: Phase4Context, snap: Phase4Snapshot): boolean {
  const next = ctx.snapshot?.();
  return !!next && sameToken(next.token, snap.token) && next.phase === "play" && !next.prompt && !next.messagePending && playerIsDriving(ctx);
}
export function castSpell(ctx: Phase4Context, snap: Phase4Snapshot, spell: SpellRow): boolean {
  if (!spell.canCast || !actionReady(ctx, snap)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "cast", args: { spell: spell.index } } }).accepted ?? false;
}
export function studySpell(ctx: Phase4Context, snap: Phase4Snapshot, book: BookRow, spell: SpellRow): boolean {
  if (!book.spells.some((entry) => entry.canStudy) || (book.chooseSpells && !spell.canStudy) || !actionReady(ctx, snap)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "study", args: book.chooseSpells ? { handle: book.handle, spell: spell.index } : { handle: book.handle } } }).accepted ?? false;
}
export function answerSpell(ctx: Phase4Context, snap: Phase4Snapshot, index: number): boolean {
  const next = ctx.snapshot?.();
  if (snap.prompt?.kind !== "spell" || !next || !sameToken(next.token, snap.token) || next.prompt?.promptId !== snap.prompt.promptId || !playerIsDriving(ctx)) return false;
  if (!(snap.prompt as SpellPrompt).choices.some((choice) => choice.index === index)) return false;
  return ctx.prompt?.reply(snap.prompt.promptId, index).accepted ?? false;
}
const validRest = (count: number): boolean => [-3, -2, -1].includes(count) || (Number.isInteger(count) && count >= 1 && count <= 9999);
export function rest(ctx: Phase4Context, snap: Phase4Snapshot, count: number): boolean {
  if (!actionReady(ctx, snap) || !validRest(count)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "rest", args: { count } } }).accepted ?? false;
}

/** The R command's duration question, when that is what holds input. */
export function restPrompt(snap: Phase4Snapshot | null | undefined): TextPrompt | null {
  const prompt = snap?.prompt;
  return prompt?.kind === "text" && (prompt as TextPrompt).tag === "rest" ? prompt as TextPrompt : null;
}
/** The same letters the game's own rest question takes (textui_cmd_rest): & for
 * fully recovered, * for hit points and mana, ! for either, or a turn count. */
export function restAnswer(count: number): string | null {
  if (!validRest(count)) return null;
  return count === -2 ? "&" : count === -1 ? "*" : count === -3 ? "!" : String(count);
}
/** Answer the open rest prompt. On an empty answer the game rests zero turns
 * and uses no energy, so Cancel replies with an empty string. */
export function answerRest(ctx: Phase4Context, snap: Phase4Snapshot, count: number | null): boolean {
  const prompt = restPrompt(snap), next = ctx.snapshot?.();
  if (!prompt || !next || restPrompt(next)?.promptId !== prompt.promptId || !playerIsDriving(ctx)) return false;
  const answer = count === null ? "" : restAnswer(count);
  if (answer === null || answer.length > prompt.maxLength) return false;
  return ctx.prompt?.reply(prompt.promptId, answer).accepted ?? false;
}
/** Interrupt a rest in progress. The host takes this during the rest modal, so
 * it skips the ordinary play-phase check and reads the token at the moment of
 * the click, because every rested turn moves it. */
export function stopResting(ctx: Phase4Context): boolean {
  const next = ctx.snapshot?.();
  if (!next?.resting?.active || !playerIsDriving(ctx)) return false;
  return ctx.intent?.submit(next.token, { kind: "stop-resting" }).accepted ?? false;
}
