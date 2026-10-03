/**
 * Draws a game screen (a recall page) from its blocks: prose, pre-wrapped
 * lines, tables and pictures, each in the game's own colours.
 */
import type { ScreenBlock, ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import { el } from "./keys.js";

function run(parent: Element, text: string, color: string | undefined): void {
  const span = el(parent, "span", text);
  if (color) span.style.color = color;
}

function block(parent: Element, item: ScreenBlock): void {
  if (item.kind === "text") {
    for (const paragraph of item.paragraphs) {
      const p = el(parent, "p");
      if (item.color) p.style.color = item.color;
      for (const part of paragraph) run(p, part.text, part.color);
    }
    return;
  }
  if (item.kind === "lines") {
    const pre = el(parent, "pre");
    item.lines.forEach((line, index) => {
      if (index > 0) pre.appendChild(pre.ownerDocument.createTextNode("\n"));
      if (line.runs && line.runs.length > 0) for (const part of line.runs) run(pre, part.text, part.color);
      else run(pre, line.text, line.color);
    });
    return;
  }
  if (item.kind === "art") {
    const pre = el(parent, "pre", item.lines.join("\n"));
    if (item.color) pre.style.color = item.color;
    for (const field of item.fields ?? []) el(parent, "p", field.text);
    return;
  }
  if (item.caption) { const caption = el(parent, "p"); run(caption, item.caption.text, item.caption.color); }
  if (item.rows.length === 0) {
    if (item.empty) { const empty = el(parent, "p"); run(empty, item.empty.text, item.empty.color); }
    return;
  }
  const table = el(parent, "table");
  if (item.columns.some((column) => column.label)) {
    const head = el(table, "tr");
    for (const column of item.columns) {
      const cell = el(head, "th", column.label ?? "");
      if (item.headerColor) cell.style.color = item.headerColor;
    }
  }
  for (const row of item.rows) {
    const tr = el(table, "tr");
    if (row.color) tr.style.color = row.color;
    for (const column of item.columns) {
      const value = row.cells[column.key];
      const td = el(tr, "td", value?.text ?? "");
      if (value?.color) td.style.color = value.color;
      if (column.align === "right") td.style.textAlign = "right";
    }
  }
}

export function renderScreenView(parent: Element, view: ScreenView): void {
  for (const item of view.blocks) block(parent, item);
}

/** The page as plain text, for search and for tests. */
export function screenViewText(view: ScreenView): string {
  const out: string[] = [];
  for (const item of view.blocks) {
    if (item.kind === "text") for (const p of item.paragraphs) out.push(p.map((part) => part.text).join(""));
    else if (item.kind === "lines") for (const line of item.lines) out.push(line.runs?.map((part) => part.text).join("") ?? line.text);
    else if (item.kind === "art") out.push(...item.lines);
    else for (const row of item.rows) out.push(item.columns.map((column) => row.cells[column.key]?.text ?? "").join(" "));
  }
  return out.join("\n");
}
