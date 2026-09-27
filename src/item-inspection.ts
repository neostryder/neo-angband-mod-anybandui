import type { ItemInspectResult } from "./seams.js";

/** `lead` marks a heading that is the paragraph's own first line rather than a label,
 * so the panel draws it as ordinary text with a fold control. */
export interface InspectionBlock { readonly heading: string; readonly body: string; readonly open: boolean; readonly lead?: true }

// A paragraph whose first line is a short label ending in a colon, such as the
// "Combat info:" block object_info writes, uses that label as its heading.
const LABEL = /^([^\n:]{1,40}):[ \t]*\n/u;

/** The collapsible blocks of an inspection. With the engine's frozen sections, the
 * title block holds the description, and each later info paragraph is a block of
 * its own; an empty heading marks a one-line paragraph shown without a fold. An
 * engine without sections gives one block holding the whole text. */
export function inspectionBlocks(result: ItemInspectResult): InspectionBlock[] {
  const sections = result.sections;
  if (!sections?.length) return [{ heading: result.title, body: result.text, open: true }];
  const title = sections.find((section) => section.kind === "title")?.text ?? result.title;
  const description = sections.filter((section) => section.kind === "description").map((section) => section.text).join("\n\n");
  const blocks: InspectionBlock[] = [{ heading: title, body: description, open: true }];
  for (const section of sections) {
    if (section.kind !== "info") continue;
    const label = LABEL.exec(section.text);
    if (label) { blocks.push({ heading: label[1]!.trim(), body: section.text.slice(label[0].length), open: true }); continue; }
    // A one-line paragraph stays a plain line; a longer one folds under its first line.
    const [first = "", ...rest] = section.text.split("\n");
    blocks.push(rest.length ? { heading: first.trim(), body: rest.join("\n"), open: true, lead: true } : { heading: "", body: first, open: true });
  }
  return blocks;
}
