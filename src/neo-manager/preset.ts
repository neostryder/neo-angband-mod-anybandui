import { DEFAULT_SETTINGS, validateSettings, type Settings } from "../settings.js";

export interface NeoAngbandPreset { readonly look: "Neo"; readonly settings: Readonly<Record<string, number>> }

// Numeric declarations only control effect strength; enabling features needs the later host adapter.
export const NEO_ANGBAND_PRESET: NeoAngbandPreset = { look: "Neo", settings: {} };
export const NEO_ANGBAND_PRESENTATION: Readonly<Settings> = {
  ...DEFAULT_SETTINGS, theme: "amber-terminal", hoverDelayMs: 250,
};

export function validateNeoAngbandPreset(
  preset: NeoAngbandPreset,
  declarations: readonly { readonly id: string; readonly min: number; readonly max: number; readonly step?: number }[],
): boolean {
  return preset.look === "Neo" && Object.entries(preset.settings).every(([id, value]) => {
    const setting = declarations.find((entry) => entry.id === id);
    return setting !== undefined && Number.isFinite(value) && value >= setting.min && value <= setting.max
      && (setting.step === undefined || (value - setting.min) % setting.step === 0);
  }) && JSON.stringify(validateSettings(NEO_ANGBAND_PRESENTATION)) === JSON.stringify(NEO_ANGBAND_PRESENTATION);
}
