/**
 * The settings window opens other panels by name. Each panel that can be opened
 * from it registers how to bring itself forward, and removes that when it closes,
 * so a switched-off panel has nothing to open.
 */
const openers = new Map<string, () => void>();

export function registerOpener(key: string, open: () => void): () => void {
  openers.set(key, open);
  return () => { if (openers.get(key) === open) openers.delete(key); };
}

/** False when no panel by that name is installed. */
export function openMenu(key: string): boolean {
  const open = openers.get(key);
  if (!open) return false;
  open();
  return true;
}

export function hasOpener(key: string): boolean {
  return openers.has(key);
}
