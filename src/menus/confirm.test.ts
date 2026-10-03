import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installYesNoPrompts, openConfirm } from "./confirm.js";
import { fakeUi, flush, press, withHtmlElement } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => { restore(); vi.useRealTimers(); });

describe("the Yes/No dialog", () => {
  it("answers Yes and No from its buttons", async () => {
    const host = fakeUi();
    const yes = openConfirm({ ui: host.ui, log: () => {} }, { title: "Question", message: "Go on?" });
    expect(host.top()?.root.text()).toContain("Go on?");
    host.top()!.root.byText("Yes")!.click();
    await expect(yes.answer).resolves.toBe(true);
    expect(host.live()).toHaveLength(0);
    const no = openConfirm({ ui: host.ui, log: () => {} }, { title: "Question", message: "Go on?" });
    host.top()!.root.byText("No")!.click();
    await expect(no.answer).resolves.toBe(false);
  });

  it("treats Escape as No", async () => {
    const host = fakeUi();
    const asked = openConfirm({ ui: host.ui, log: () => {} }, { title: "Question", message: "Go on?" });
    host.escape();
    await expect(asked.answer).resolves.toBe(false);
  });

  it("starts a destructive question on No, so Enter alone keeps everything", async () => {
    const host = fakeUi();
    const asked = openConfirm({ ui: host.ui, log: () => {} }, { title: "Delete", message: "Delete it?", yes: "Delete", no: "Cancel", danger: true });
    const root = host.top()!.root;
    expect(root.activeElement?.textContent).toBe("Cancel");
    press(root, "ArrowLeft");
    expect(root.activeElement?.textContent).toBe("Delete");
    press(root, "ArrowRight");
    press(root, "Enter");
    await expect(asked.answer).resolves.toBe(false);
  });

  it("answers No when no panel can open", async () => {
    const asked = openConfirm({ log: () => {} }, { title: "Question", message: "Go on?" });
    expect(asked.opened).toBe(false);
    await expect(asked.answer).resolves.toBe(false);
  });
});

describe("Angband asks", () => {
  const confirmSnapshot = (promptId: number, phase = "play") => ({ phase, prompt: { kind: "confirm", promptId, label: "Save and quit? " } });

  it("installs nothing with its switch off", () => {
    const host = fakeUi();
    const snapshot = vi.fn(() => confirmSnapshot(1));
    const cleanup = installYesNoPrompts({ flags: {}, ui: host.ui, snapshot, prompt: { reply: vi.fn() }, log: () => {} });
    expect(snapshot).not.toHaveBeenCalled();
    expect(host.panels).toHaveLength(0);
    cleanup();
  });

  it("shows the game's question and replies with the answer", async () => {
    vi.useFakeTimers();
    const host = fakeUi();
    let snap: ReturnType<typeof confirmSnapshot> | null = confirmSnapshot(7);
    const reply = vi.fn(() => ({ accepted: true as const }));
    const cleanup = installYesNoPrompts({ flags: { "anybandui.yesNoPrompts": true }, ui: host.ui, snapshot: () => snap, prompt: { reply }, log: () => {} });
    const root = host.top()!.root;
    expect(root.text()).toContain("Angband asks");
    expect(root.text()).toContain("Save and quit?");
    root.byText("Yes")!.click();
    await flush();
    expect(reply).toHaveBeenCalledWith(7, true);
    snap = null;
    vi.advanceTimersByTime(200);
    expect(host.live()).toHaveLength(0);
    cleanup();
  });

  it("answers No on Escape", async () => {
    const host = fakeUi();
    const reply = vi.fn(() => ({ accepted: true as const }));
    const cleanup = installYesNoPrompts({ flags: { "anybandui.yesNoPrompts": true }, ui: host.ui, snapshot: () => confirmSnapshot(3), prompt: { reply }, log: () => {} });
    host.escape();
    await flush();
    expect(reply).toHaveBeenCalledWith(3, false);
    cleanup();
  });

  it("takes the dialog down unanswered when the game moves on", async () => {
    vi.useFakeTimers();
    const host = fakeUi();
    let snap: ReturnType<typeof confirmSnapshot> | null = confirmSnapshot(4);
    const reply = vi.fn(() => ({ accepted: true as const }));
    const cleanup = installYesNoPrompts({ flags: { "anybandui.yesNoPrompts": true }, ui: host.ui, snapshot: () => snap, prompt: { reply }, log: () => {} });
    expect(host.live()).toHaveLength(1);
    snap = null;
    vi.advanceTimersByTime(200);
    await flush();
    expect(host.live()).toHaveLength(0);
    expect(reply).not.toHaveBeenCalled();
    cleanup();
  });

  it("leaves a shop's confirmations to the shop", () => {
    const host = fakeUi();
    const cleanup = installYesNoPrompts({ flags: { "anybandui.yesNoPrompts": true }, ui: host.ui, snapshot: () => confirmSnapshot(5, "store"), prompt: { reply: vi.fn() }, log: () => {} });
    expect(host.panels).toHaveLength(0);
    cleanup();
  });

  it("leaves a question on the game's own line when the panel is refused", () => {
    vi.useFakeTimers();
    const host = fakeUi({ refuse: () => true });
    const reply = vi.fn();
    const log = vi.fn();
    const cleanup = installYesNoPrompts({ flags: { "anybandui.yesNoPrompts": true }, ui: host.ui, snapshot: () => confirmSnapshot(6), prompt: { reply }, log });
    vi.advanceTimersByTime(600);
    expect(reply).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
