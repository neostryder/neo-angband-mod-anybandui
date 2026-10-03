/**
 * The Rename save and Delete save dialogs (upstream client.cpp:1113-1138).
 *
 * Upstream renames a save FILE and so limits the name to file-safe characters.
 * Neo Angband renames the character, and its seam takes any name of 1 to 15
 * characters after trimming (MOD_SEAMS 4u), so the check here is that one.
 */
import { button, el, openDialog, stepFocus, type DialogContext } from "./dialog.js";
import { confirm } from "./confirm.js";

export const NAME_LIMIT = 15;

/** Why a name cannot be used, or null when it can. */
export function nameProblem(entered: string): string | null {
  const name = entered.trim();
  if (!name) return "Enter a name.";
  if (name.length > NAME_LIMIT) return `Use ${NAME_LIMIT} characters or fewer.`;
  return null;
}

/** Ask for a new name. Resolves the trimmed name, or null on Cancel or Escape. */
export function askRename(ctx: DialogContext, current: string): Promise<string | null> {
  const dialog = openDialog(ctx, { id: "rename-save", label: "Rename save" });
  if (!dialog) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: string | null): void => {
      if (done) return;
      done = true;
      dialog.close();
      resolve(value);
    };
    void dialog.closed.then(() => finish(null));
    el(dialog.body, "h2", "Rename save");
    el(dialog.body, "p", `Rename ${current}`);
    const label = el(dialog.body, "label", "Save name ");
    const input = el(label, "input");
    input.type = "text";
    input.value = current;
    input.maxLength = 40;
    input.dataset["focus"] = "name";
    const problem = el(dialog.body, "p", "", "muted");
    const row = el(dialog.body, "div", undefined, "actions");
    const submit = (): void => { if (nameProblem(input.value) === null) finish(input.value.trim()); };
    const rename = button(row, "Rename", submit, "rename");
    const cancel = button(row, "Cancel", () => finish(null), "cancel");
    const check = (): void => {
      const why = nameProblem(input.value);
      problem.textContent = why ?? "";
      rename.disabled = why !== null;
    };
    input.addEventListener("input", check);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); submit(); }
    });
    row.addEventListener("keydown", (event) => {
      if (stepFocus([rename, cancel], dialog.root.activeElement as HTMLElement | null, event.key, "horizontal") !== null) event.preventDefault();
    });
    dialog.body.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); finish(null); }
    });
    check();
    input.focus();
    input.select?.();
  });
}

/** The Delete save question. The keyboard starts on Cancel. */
export function confirmDeleteSave(ctx: DialogContext, name: string): Promise<boolean> {
  return confirm(ctx, { title: "Delete save", message: `Permanently delete ${name}?`, detail: "This cannot be undone.", yes: "Delete save", no: "Cancel", danger: true });
}
