/** Font choices and fallback paths from AnybandUI font_library.h. */
export const FONT_FILES = [
  "Cousine-Regular.ttf", "ConsolaMono-Book.ttf", "Erika Type.ttf", "F25_Bank_Printer.ttf",
  "Flexi_IBM_VGA_True.ttf", "Hack-Regular.ttf", "LiberationMono-Regular.ttf",
  "MonospaceTypewriter.ttf", "Nouveau_IBM.ttf", "RetraConsole.ttf", "Sono-Regular.ttf",
  "SVBasicManual.ttf", "Terminal F4.ttf", "Xanmono-Regular.ttf", "Zector.ttf",
] as const;
export const EFFECT_FONT = "tengwar-annatar/tngan.ttf";

interface AssetCtx { readonly assetUrl: (path: string) => Promise<string | null> }

export async function loadFonts(ctx: AssetCtx): Promise<readonly string[]> {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) return [];
  const loaded: string[] = [];
  for (const file of [...FONT_FILES, EFFECT_FONT]) {
    const url = await ctx.assetUrl(`fonts/${file}`);
    if (url === null) continue;
    const face = new FontFace(file, `url(${JSON.stringify(url)})`);
    await face.load();
    (document.fonts as FontFaceSet & { add(face: FontFace): void }).add(face);
    loaded.push(file);
  }
  return loaded;
}
