import { describe, expect, it, vi } from "vitest";
import { CONFIRM_NO, CONFIRM_YES, renderConfirm } from "./inline-confirm.js";
import { FakeNode } from "./test-dom.js";

function draw(): { root: FakeNode; box: FakeNode; onYes: ReturnType<typeof vi.fn>; onClose: ReturnType<typeof vi.fn> } {
  const root = new FakeNode("root");
  const onYes = vi.fn();
  const onClose = vi.fn();
  const box = renderConfirm(root as unknown as Element, { question: "Overwrite it?", yes: "Overwrite", onYes }, onClose) as unknown as FakeNode;
  return { root, box, onYes, onClose };
}

describe("confirm", () => {
  it("runs the action only on Yes, closing first", () => {
    const { root, onYes, onClose } = draw();
    expect(root.text()).toContain("Overwrite it?");
    root.byFocus(CONFIRM_YES)!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onClose.mock.invocationCallOrder[0]!).toBeLessThan(onYes.mock.invocationCallOrder[0]!);
  });

  it("closes without acting on No, n or Escape", () => {
    for (const answer of ["click", "n", "Escape"]) {
      const { root, box, onYes, onClose } = draw();
      if (answer === "click") root.byFocus(CONFIRM_NO)!.click(); else box.fire("keydown", answer);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onYes).not.toHaveBeenCalled();
    }
  });

  it("says Yes on y and moves between the buttons with the arrows", () => {
    const { root, box, onYes } = draw();
    root.byFocus(CONFIRM_NO)!.focus();
    box.fire("keydown", "ArrowLeft");
    expect(root.focused()).toBe(CONFIRM_YES);
    box.fire("keydown", "ArrowRight");
    expect(root.focused()).toBe(CONFIRM_NO);
    box.fire("keydown", "y");
    expect(onYes).toHaveBeenCalledTimes(1);
  });
});
