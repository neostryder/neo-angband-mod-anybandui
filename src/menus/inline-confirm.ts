/**
 * A small Yes/No question drawn inside a menu, for a save that replaces what
 * the game or this mod had stored, or for throwing away a draft. No has the
 * focus first, so Enter alone never overwrites anything.
 */
import { button, el, swallow } from "./keys.js";

export interface Confirmation {
  readonly question: string;
  readonly yes: string;
  readonly onYes: () => void;
}

export const CONFIRM_YES = "confirm-yes";
export const CONFIRM_NO = "confirm-no";

/** Draws the question. `onClose` runs after either answer, before `onYes`. */
export function renderConfirm(parent: Element, confirmation: Confirmation, onClose: () => void): HTMLElement {
  const box = el(parent, "div");
  box.className = "confirm";
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-label", confirmation.question);
  el(box, "p", confirmation.question);
  const row = el(box, "div");
  row.className = "actions";
  const yes = (): void => { onClose(); confirmation.onYes(); };
  const yesButton = button(row, confirmation.yes, CONFIRM_YES, yes);
  const noButton = button(row, "No", CONFIRM_NO, onClose);
  box.addEventListener("keydown", (event: KeyboardEvent) => {
    const key = event.key;
    if (key === "Escape" || key === "n" || key === "N") { swallow(event); onClose(); return; }
    if (key === "y" || key === "Y") { swallow(event); yes(); return; }
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "Tab") {
      swallow(event);
      const root = box.getRootNode() as { activeElement?: Element | null };
      (root.activeElement === yesButton ? noButton : yesButton).focus();
    }
  });
  return box;
}
