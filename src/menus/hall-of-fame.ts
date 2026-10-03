/**
 * The Hall of Fame, drawn from Core's own score list (the `core:hall-of-fame`
 * screen view) as a themed table instead of the terminal's positioned paint.
 *
 * Upstream AnybandUI has no hall of fame; its graveyard is the nearest surface
 * (.port-notes/phase8-spec.md). This piece reskins the screen Neo Angband
 * already has, so the rows, their order and the "this is you" mark are Core's.
 */
import type { ScreenCell, ScreenHost, ScreenShown, ScreenTableBlock, ScreenView } from "@rpgm-tools/neo-angband-mod-sdk";
import { button, el, openDialog, type DialogContext } from "./dialog.js";

export const HALL_OF_FAME_ID = "core:hall-of-fame";

const HEADINGS: Readonly<Record<string, string>> = {
  rank: "#", points: "Points", who: "Name", race: "Race", class: "Class", level: "Level",
  depth: "Depth", how: "How it ended", date: "Date", gold: "Gold", turns: "Turns",
};

const CSS = `.scores td.num,.scores th.num{text-align:right}
.scores tr.you td{color:var(--anyband-accent);font-weight:bold}`;

export interface ScreenPart {
  show(view: ScreenView, host?: ScreenHost): ScreenShown | undefined;
}

/** A level or depth cell: "20 (max 21)" when the maximum is higher. */
export function cellText(cell: ScreenCell | undefined): string {
  if (!cell) return "";
  const current = cell.values?.["current"], max = cell.values?.["max"];
  if (typeof current === "number" && typeof max === "number" && max > current) return `${current} (max ${max})`;
  return cell.text;
}

export interface HallOfFameContext extends DialogContext {
  readonly flags?: Readonly<Record<string, boolean>> | undefined;
}

/** The screen part, or null with the switch off so Core keeps its own screen. */
export function hallOfFamePart(ctx: HallOfFameContext): ScreenPart | null {
  if (ctx.flags?.["anybandui.hallOfFame"] !== true) return null;
  return {
    show(view) {
      if (view.id !== HALL_OF_FAME_ID) return undefined;
      const table = view.blocks.find((block): block is ScreenTableBlock => block.kind === "table" && block.key === "scores");
      if (!table) return undefined;
      const dialog = openDialog(ctx, { id: "hall-of-fame", label: "Hall of Fame", className: "wide", css: CSS });
      // Declining hands the screen back to Core's terminal, so the player still sees it.
      if (!dialog) return undefined;
      const body = dialog.body;
      el(body, "h2", view.title);
      const columns = table.columns.filter((column) => column.key !== "uid");
      if (!table.rows.length) el(body, "p", table.empty?.text ?? "No scores yet.", "muted");
      else {
        const grid = el(body, "table", undefined, "scores");
        const head = el(el(grid, "thead"), "tr");
        for (const column of columns) el(head, "th", column.label ?? HEADINGS[column.key] ?? column.key, column.align === "right" ? "num" : undefined);
        const rows = el(grid, "tbody");
        for (const row of table.rows) {
          const you = row.values?.["highlighted"] === 1;
          const tr = el(rows, "tr", undefined, you ? "you" : undefined);
          if (you) tr.setAttribute("aria-current", "true");
          for (const column of columns) el(tr, "td", cellText(row.cells[column.key]), column.align === "right" ? "num" : undefined);
        }
      }
      const actions = el(body, "div", undefined, "actions");
      const close = button(actions, "Close", () => dialog.close(), "close");
      body.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          body.scrollTop += event.key === "ArrowDown" ? 40 : -40;
        } else if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
      });
      close.focus();
      return { dismissed: dialog.closed.then(() => undefined) };
    },
  };
}
