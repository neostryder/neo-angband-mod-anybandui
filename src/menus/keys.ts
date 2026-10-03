/** Shared keyboard handling for the menus: list steps and swallowing a handled key. */

/** The next index for a list key, or null for a key that does not move. */
export function listStep(key: string, index: number, length: number): number | null {
  if (length <= 0) return null;
  const at = index < 0 ? -1 : Math.min(index, length - 1);
  switch (key) {
    case "ArrowDown": return at < 0 ? 0 : Math.min(length - 1, at + 1);
    case "ArrowUp": return at < 0 ? 0 : Math.max(0, at - 1);
    case "Home": return 0;
    case "End": return length - 1;
    case "PageDown": return at < 0 ? 0 : Math.min(length - 1, at + 10);
    case "PageUp": return at < 0 ? 0 : Math.max(0, at - 10);
    default: return null;
  }
}

/** Stop a key the menu used from also reaching the game. */
export function swallow(event: { preventDefault(): void; stopPropagation?(): void }): void {
  event.preventDefault();
  event.stopPropagation?.();
}

export function el<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, text?: string): HTMLElementTagNameMap[K] {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== undefined) child.textContent = text;
  parent.appendChild(child);
  return child;
}

export function button(parent: Element, label: string, focus: string, onClick: () => void): HTMLButtonElement {
  const node = el(parent, "button", label);
  node.type = "button";
  node.dataset["focus"] = focus;
  node.addEventListener("click", onClick);
  return node;
}

export function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}
