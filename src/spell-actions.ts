import { playerIsDriving } from "./input-owner.js";
import type { Phase4Context, Phase4Snapshot } from "./seams.js";
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
  if (!(snap.prompt as import("./seams.js").SpellPrompt).choices.some((choice) => choice.index === index)) return false;
  return ctx.prompt?.reply(snap.prompt.promptId, index).accepted ?? false;
}
export function rest(ctx: Phase4Context, snap: Phase4Snapshot, count: number): boolean {
  if (!actionReady(ctx, snap) || ![-3, -2, -1].includes(count) && (!Number.isInteger(count) || count < 1 || count > 9999)) return false;
  return ctx.intent?.submit(snap.token, { kind: "command", command: { code: "rest", args: { count } } }).accepted ?? false;
}
