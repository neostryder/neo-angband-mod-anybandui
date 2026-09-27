import type { InputDriver } from "./seams.js";

// Who holds input comes from core's ctx.driver() (MOD_SEAMS 4q). An engine
// without that read cannot run a controller for these actions to collide with,
// so no answer means the player. The snapshot carries the same value, but a full
// capture on every click would cost far more than this one read.
export interface DriverRead { readonly driver?: () => InputDriver | null | undefined }

const PLAYER: InputDriver = Object.freeze({ kind: "player" });

/** The current input owner, or the player when the engine cannot say. */
export function currentDriver(ctx: unknown): InputDriver {
  const read = (ctx as DriverRead | null | undefined)?.driver;
  const driver = typeof read === "function" ? read() : undefined;
  return driver?.kind === "controller" && typeof driver.owner === "string" ? driver : PLAYER;
}

export function playerIsDriving(ctx: unknown): boolean { return currentDriver(ctx).kind === "player"; }

/**
 * Core returns controller-owned when a controller took input between the
 * caller's check and its intent or prompt reply. Callers drop the action
 * without showing an error, since the player has nothing to fix.
 */
export function controllerOwned(result: { readonly code?: string } | null | undefined): boolean {
  return result?.code === "controller-owned";
}
