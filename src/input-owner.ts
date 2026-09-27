// Mirrors the proposed controller.driver() read in packages/web/src/mod-plugin.ts.
// An engine without that read has no autoplayer the mod could collide with
// through this seam, and the host's intent gate still checks the input token,
// so an absent read counts as the player driving. Only an explicit autoplayer
// answer makes the mod stand down.
export interface DriverRead { readonly controller?: { driver?(): { readonly kind: "player" | "autoplayer" } | null } }
export function playerIsDriving(ctx: unknown): boolean { return ((ctx as DriverRead)?.controller?.driver?.()?.kind ?? "player") === "player"; }
