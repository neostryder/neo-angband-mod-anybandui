/**
 * The plain Yes/No prompt, as a dialog any menu can ask through, and the "Angband
 * asks" adapter that puts the game's own yes/no questions in the same dialog
 * (upstream client.cpp:1800-1821, the confirmation branch of prompts()).
 *
 * Escape, the host's close control and a refused panel all answer No. A
 * destructive question starts with the keyboard on No, so Enter alone never
 * destroys anything.
 */
import { button, el, openDialog, stepFocus, type DialogContext } from "./dialog.js";
import { viewInput } from "../host-adapter.js";
import type { ConfirmPrompt, PromptAnswer, PromptReplyResult } from "@rpgm-tools/neo-angband-core";

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly detail?: string;
  readonly yes?: string;
  readonly no?: string;
  /** Starts the keyboard on No. */
  readonly danger?: boolean;
}

export interface ConfirmHandle {
  /** True for Yes. False for No, Escape, or a dialog that could not open. */
  readonly answer: Promise<boolean>;
  /** False when the dialog could not open; `answer` is then already false. */
  readonly opened: boolean;
  /** Close without an answer from the player; `answer` settles false. */
  dismiss(): void;
}

/** Ask a yes/no question in a modal dialog. */
export function openConfirm(ctx: DialogContext, options: ConfirmOptions): ConfirmHandle {
  const dialog = openDialog(ctx, { id: "confirm", label: options.title, className: "confirm" });
  if (!dialog) return { answer: Promise.resolve(false), opened: false, dismiss: () => {} };
  let settle: (value: boolean) => void = () => {};
  const answer = new Promise<boolean>((resolve) => { settle = resolve; });
  let done = false;
  const finish = (value: boolean): void => {
    if (done) return;
    done = true;
    dialog.close();
    settle(value);
  };
  void dialog.closed.then(() => finish(false));
  el(dialog.body, "h2", options.title);
  el(dialog.body, "p", options.message);
  if (options.detail) el(dialog.body, "p", options.detail, "muted");
  const row = el(dialog.body, "div", undefined, "actions");
  const yes = button(row, options.yes ?? "Yes", () => finish(true), "yes");
  const no = button(row, options.no ?? "No", () => finish(false), "no");
  row.addEventListener("keydown", (event) => {
    if (stepFocus([yes, no], dialog.root.activeElement as HTMLElement | null, event.key, "horizontal") !== null) event.preventDefault();
  });
  dialog.body.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); finish(false); }
  });
  (options.danger ? no : yes).focus();
  return { answer, opened: true, dismiss: () => finish(false) };
}

export function confirm(ctx: DialogContext, options: ConfirmOptions): Promise<boolean> {
  return openConfirm(ctx, options).answer;
}

export interface YesNoContext extends DialogContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
  readonly snapshot?: (() => { readonly phase: string | null; readonly prompt: unknown } | null) | undefined;
  readonly prompt?: { reply(promptId: number, answer: PromptAnswer): PromptReplyResult } | undefined;
}

function confirmPrompt(prompt: unknown): ConfirmPrompt | null {
  if (!prompt || typeof prompt !== "object") return null;
  const p = prompt as Partial<ConfirmPrompt>;
  return p.kind === "confirm" && typeof p.promptId === "number" && typeof p.label === "string" ? p as ConfirmPrompt : null;
}

/**
 * Show each of the game's yes/no questions as an "Angband asks" dialog and send
 * the answer back as the prompt's reply. A store's own confirmations stay with
 * the store window, which answers them itself.
 */
export function installYesNoPrompts(ctx: YesNoContext): () => void {
  if (ctx.flags?.["anybandui.yesNoPrompts"] !== true) return () => {};
  const reply = ctx.prompt;
  if (!ctx.snapshot || !reply || !ctx.ui?.openPanel) { ctx.log("yes/no prompts: this game has no prompt reply or panel seam"); return () => {}; }
  let shown: { id: number; handle: ConfirmHandle } | null = null;
  /* A prompt whose dialog could not open (the host refuses a panel just after
   * the player closed one) is left on the game's own prompt line. */
  let skipped: number | null = null;
  const poll = (): void => {
    let snap: ReturnType<NonNullable<YesNoContext["snapshot"]>> = null;
    try { snap = viewInput(ctx); } catch { snap = null; }
    const prompt = snap && snap.phase !== "store" ? confirmPrompt(snap.prompt) : null;
    if (shown && shown.id !== prompt?.promptId) {
      // The game moved on without this dialog's answer; take it down unanswered.
      const stale = shown; shown = null; stale.handle.dismiss();
    }
    if (!prompt || shown || skipped === prompt.promptId) return;
    const id = prompt.promptId;
    const handle = openConfirm(ctx, { title: "Angband asks", message: prompt.label.trim(), yes: "Yes", no: "No" });
    if (!handle.opened) { skipped = id; return; }
    shown = { id, handle };
    void handle.answer.then((value) => {
      if (shown?.id !== id) return;
      shown = null;
      try { reply.reply(id, value); } catch (error) { ctx.log(`yes/no prompts: reply refused (${String(error)})`); }
    });
  };
  const timer = globalThis.setInterval(poll, 200);
  poll();
  return () => {
    globalThis.clearInterval(timer);
    const open = shown; shown = null; open?.handle.dismiss();
  };
}
