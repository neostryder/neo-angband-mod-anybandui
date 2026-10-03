/**
 * Phase 8's save and run pieces, wired from the plugin: what installs at
 * register time, and the parts of the menu and screen presenters.
 */
import type { MenuPresenter } from "@rpgm-tools/neo-angband-mod-sdk";
import { installYesNoPrompts, type YesNoContext } from "./confirm.js";
import { installGraveyard, openGraveyard, type GraveyardContext } from "./graveyard.js";
import { hallOfFamePart, type ScreenPart } from "./hall-of-fame.js";
import { composeMenus, composeScreens } from "./presenters.js";
import { installDepthRecorder, installRunJournal, type RunJournalContext } from "./run-journal.js";
import { saveCardsPart, type SaveCardsContext } from "./save-cards.js";

export type MenusContext = YesNoContext & RunJournalContext & GraveyardContext & SaveCardsContext;

/** The register-time pieces: the Yes/No prompts, the run journal, the depth recorder and the graveyard. */
export function installMenus(ctx: MenusContext): () => void {
  const flags = ctx.flags ?? {};
  const cleanups: Array<() => void> = [];
  cleanups.push(installYesNoPrompts(ctx));
  if (flags["anybandui.runJournal"] === true || flags["anybandui.graveyard"] === true) cleanups.push(installDepthRecorder(ctx));
  cleanups.push(installRunJournal(ctx));
  cleanups.push(installGraveyard(ctx));
  return () => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
}

/** The menu presenter, or undefined when no menu piece is on. */
export function menuPresenter(ctx: MenusContext): MenuPresenter | undefined {
  const graveyard = ctx.flags?.["anybandui.graveyard"] === true ? () => openGraveyard(ctx) : undefined;
  return composeMenus([saveCardsPart({ ...ctx, graveyard })], ctx.log);
}

/** The screen presenter, or undefined when no screen piece is on. */
export function screenPresenter(ctx: MenusContext): ScreenPart | undefined {
  return composeScreens([hallOfFamePart(ctx)], ctx.log);
}
