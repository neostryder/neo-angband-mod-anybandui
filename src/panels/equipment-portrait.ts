/**
 * AnybandUI's equipment figure (equipment_portrait.h). The body is plain ASCII
 * so it draws in text mode and with any tileset. Slot names come from the
 * engine; only the places they hang are presentation.
 */

export interface PortraitItem {
  readonly slot?: number;
  readonly slotName?: string;
  readonly label: string;
  readonly colour: string;
  readonly inscription: string | null;
  readonly key: string;
}

export interface PortraitCard {
  readonly index: number;
  readonly name: string;
  readonly label: string;
  readonly item: string | null;
  readonly colour: string | null;
  readonly inscription: string | null;
  readonly key: string;
  readonly right: boolean | null;
  readonly row: number | null;
  readonly x: number | null;
  readonly y: number | null;
}

interface Anchor { readonly slot: string; readonly label: string; readonly right: boolean; readonly row: number; readonly x: number; readonly y: number }

export const ANCHORS: readonly Anchor[] = [
  { slot: "head", label: "Head", right: false, row: 0, x: 8, y: 1 },
  { slot: "neck", label: "Neck", right: false, row: 1, x: 9, y: 3 },
  { slot: "body", label: "Body", right: false, row: 2, x: 7, y: 6 },
  { slot: "weapon", label: "Weapon", right: false, row: 3, x: 3, y: 8 },
  { slot: "right hand", label: "Right ring", right: false, row: 4, x: 3, y: 8.6 },
  { slot: "feet", label: "Feet", right: false, row: 5, x: 7, y: 16 },
  { slot: "back", label: "Cloak", right: true, row: 0, x: 14, y: 4 },
  { slot: "shooting", label: "Ranged", right: true, row: 1, x: 15, y: 5 },
  { slot: "arm", label: "Shield", right: true, row: 2, x: 17, y: 6.5 },
  { slot: "hands", label: "Hands", right: true, row: 3, x: 17, y: 8 },
  { slot: "left hand", label: "Left ring", right: true, row: 4, x: 17, y: 8.6 },
  { slot: "light", label: "Light", right: true, row: 5, x: 13, y: 9 },
];

/** Seventeen rows, twenty-one columns, copied from equipment_portrait.h. */
export const FIGURE: readonly string[] = [
  "        .---.        ",
  "        |o o|        ",
  "        '---'        ",
  "      ___| |___      ",
  "     /   | |   \\     ",
  "    / /| : : |\\ \\    ",
  "   / / | : : | \\ \\   ",
  "  |_|  |=====|  |_|  ",
  "  [ ]  | : : |  [ ]  ",
  "       /-----\\       ",
  "       | | | |       ",
  "       | | | |       ",
  "       | | | |       ",
  "       | | | |       ",
  "       | | | |       ",
  "     __|_| |_|__     ",
  "    |____| |____|    ",
];

function displayName(name: string, anchor: Anchor | null, index: number): string {
  if (anchor) return anchor.label;
  if (!name) return `Slot ${index + 1}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** One card per body slot. A slot the figure does not know stays in the list. */
export function layoutPortrait(slots: readonly { readonly name: string }[] | null | undefined, worn: readonly PortraitItem[]): PortraitCard[] {
  const defined = slots?.length
    ? slots.map((slot, index) => ({ index, name: slot.name }))
    : worn.flatMap((item) => item.slot === undefined ? [] : [{ index: item.slot, name: (item.slotName ?? "").toLowerCase() }]);
  return defined.map(({ index, name }) => {
    const anchor = ANCHORS.find((entry) => entry.slot === name.trim().toLowerCase()) ?? null;
    const item = worn.find((row) => row.slot === index) ?? null;
    return {
      index, name, label: displayName(name, anchor, index),
      item: item?.label ?? null, colour: item?.colour ?? null, inscription: item?.inscription ?? null,
      key: item?.key ?? `empty:${index}`,
      right: anchor?.right ?? null, row: anchor?.row ?? null, x: anchor?.x ?? null, y: anchor?.y ?? null,
    };
  });
}

export function stepSelection(count: number, index: number, key: string): number | null {
  if (count <= 0) return null;
  if (index < 0) {
    if (key === "End") return count - 1;
    if (key === "Home" || key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") return 0;
    return null;
  }
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  return null;
}

function el(parent: Element, tag: string, text?: string): HTMLElement {
  const child = parent.ownerDocument.createElement(tag);
  if (text !== undefined) child.textContent = text;
  parent.appendChild(child);
  return child;
}

/** Draw the figure and hang a button on each slot. Arrow keys move the selection. */
export function renderEquipmentPortrait(parent: HTMLElement, slots: readonly { readonly name: string }[] | null | undefined, worn: readonly PortraitItem[], selectedKey: string | null, onSelect: (key: string) => void): void {
  const cards = layoutPortrait(slots, worn);
  const occupied = cards.filter((card) => card.item).length;
  const wrap = el(parent, "div");
  wrap.className = "portrait";
  el(wrap, "p", `${occupied} / ${cards.length} slots occupied`).className = "muted";
  // The count sits above the grid, so the first anchor row stays row 1.
  const body = el(wrap, "div");
  body.className = "body";
  const figure = el(body, "pre", FIGURE.join("\n"));
  figure.className = "figure";
  const extras = el(wrap, "div");
  extras.className = "extras";
  const selected = Math.max(0, cards.findIndex((card) => card.key === selectedKey));
  cards.forEach((card, index) => {
    const button = el(card.row === null ? extras : body, "button") as HTMLButtonElement;
    button.type = "button";
    button.className = card.row === null ? "slotcard" : `slotcard ${card.right ? "right" : "left"}`;
    if (card.row !== null) button.style.gridRow = String(card.row + 1);
    button.setAttribute("aria-pressed", String(card.key === selectedKey));
    if (index === selected) button.dataset["focus"] = "portrait-slot";
    const title = el(button, "b", card.label);
    if (!card.item) title.className = "muted";
    const name = el(button, "span", card.item ?? "Empty");
    if (card.colour) name.style.color = card.colour;
    if (!card.item) name.className = "muted";
    if (card.inscription) button.title = card.inscription;
    button.addEventListener("click", () => onSelect(card.key));
  });
  wrap.addEventListener("keydown", (event) => {
    const next = stepSelection(cards.length, cards.findIndex((card) => card.key === selectedKey), event.key);
    if (next === null) return;
    event.preventDefault();
    const card = cards[next];
    if (card) onSelect(card.key);
  });
}
