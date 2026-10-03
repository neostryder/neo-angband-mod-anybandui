import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { askRename, confirmDeleteSave, nameProblem } from "./save-dialogs.js";
import { fakeUi, press, withHtmlElement } from "./fake-dom.js";

let restore: () => void = () => {};
beforeEach(() => { restore = withHtmlElement(); });
afterEach(() => restore());

describe("the rename dialog", () => {
  it("checks the name the way the rename seam does", () => {
    expect(nameProblem("  ")).toBe("Enter a name.");
    expect(nameProblem("A name that is far too long")).toBe("Use 15 characters or fewer.");
    expect(nameProblem("  Strider  ")).toBeNull();
  });

  it("submits the trimmed name on Enter and nothing on Escape", async () => {
    const host = fakeUi();
    const named = askRename({ ui: host.ui, log: () => {} }, "Aragorn");
    const root = host.top()!.root;
    expect(root.text()).toContain("Rename Aragorn");
    const input = root.byFocus("name")!;
    expect(root.activeElement).toBe(input);
    input.value = "  Strider ";
    input.fire("input");
    press(root, "Enter");
    await expect(named).resolves.toBe("Strider");
    const cancelled = askRename({ ui: host.ui, log: () => {} }, "Aragorn");
    host.escape();
    await expect(cancelled).resolves.toBeNull();
  });

  it("will not submit an empty name", async () => {
    const host = fakeUi();
    const named = askRename({ ui: host.ui, log: () => {} }, "Aragorn");
    const root = host.top()!.root;
    const input = root.byFocus("name")!;
    input.value = "";
    input.fire("input");
    press(root, "Enter");
    root.byText("Rename")!.click();
    expect(host.live()).toHaveLength(1);
    root.byText("Cancel")!.click();
    await expect(named).resolves.toBeNull();
  });
});

describe("the delete dialog", () => {
  it("asks with upstream's words and starts on Cancel", async () => {
    const host = fakeUi();
    const asked = confirmDeleteSave({ ui: host.ui, log: () => {} }, "Aragorn");
    const root = host.top()!.root;
    expect(root.text()).toContain("Permanently delete Aragorn?");
    expect(root.text()).toContain("This cannot be undone.");
    expect(root.activeElement?.textContent).toBe("Cancel");
    press(root, "Enter");
    await expect(asked).resolves.toBe(false);
    const yes = confirmDeleteSave({ ui: host.ui, log: () => {} }, "Aragorn");
    host.top()!.root.byText("Delete save")!.click();
    await expect(yes).resolves.toBe(true);
  });
});
