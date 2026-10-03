/**
 * The mod's one menu presenter and one screen presenter, composed from parts.
 *
 * The host installs a single presenter of each kind per mod, so every menu or
 * screen this mod draws is a part here. A part answers the questions and views
 * it knows by id and returns undefined for the rest. When no part claims a
 * question, the presenter declines it and Core asks it as before. With every
 * part switched off there is no presenter at all.
 */
import type { MenuPresenter, MenuQuestion, ScreenHost, ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import type { ScreenPart } from "./hall-of-fame.js";

export function composeMenus(parts: readonly (MenuPresenter | null)[], log: (message: string) => void): MenuPresenter | undefined {
  const live = parts.filter((part): part is MenuPresenter => part !== null);
  if (!live.length) return undefined;
  return {
    ask(question: MenuQuestion) {
      for (const part of live) {
        try {
          const answer = part.ask(question);
          if (answer !== undefined) return answer;
        } catch (error) {
          // One part failing declines the question rather than taking the whole seam down.
          log(`menus: ${question.id} declined after an error (${String(error)})`);
          return undefined;
        }
      }
      return undefined;
    },
  };
}

export function composeScreens(parts: readonly (ScreenPart | null)[], log: (message: string) => void): ScreenPart | undefined {
  const live = parts.filter((part): part is ScreenPart => part !== null);
  if (!live.length) return undefined;
  return {
    show(view: ScreenView, host?: ScreenHost) {
      for (const part of live) {
        try {
          const shown = part.show(view, host);
          if (shown !== undefined) return shown;
        } catch (error) {
          log(`screens: ${view.id} declined after an error (${String(error)})`);
          return undefined;
        }
      }
      return undefined;
    },
  };
}
