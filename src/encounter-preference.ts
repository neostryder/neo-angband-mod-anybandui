export interface FirstEncounterPreference {
  readonly characterKey: string;
  readonly monsters: readonly number[];
  readonly artifacts: readonly number[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read the former top-level notebook as well as the shared preference envelope. */
export function readFirstEncounterPreference(raw: unknown): FirstEncounterPreference | null {
  if (!record(raw)) return null;
  const candidate = raw.v === 2 ? raw.firstEncounter : raw.v === 1 ? raw : undefined;
  if (!record(candidate) || typeof candidate.characterKey !== "string" ||
    !Array.isArray(candidate.monsters) || !Array.isArray(candidate.artifacts)) return null;
  return {
    characterKey: candidate.characterKey,
    monsters: candidate.monsters.filter((value): value is number => typeof value === "number"),
    artifacts: candidate.artifacts.filter((value): value is number => typeof value === "number"),
  };
}

/** Preserve this mod's theme settings while upgrading an older encounter notebook. */
export function withFirstEncounterPreference(raw: unknown, firstEncounter: FirstEncounterPreference): Record<string, unknown> {
  const existing = record(raw) && raw.v === 2 ? raw : {};
  return { ...existing, v: 2, firstEncounter };
}
