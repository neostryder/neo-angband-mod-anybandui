import type { SettingDefinition } from "./types.js";

export const MANAGER_SETTINGS: readonly SettingDefinition[] = [
  { id: "theme", group: "Display", title: "Theme", description: "The panel colors follow the device or your choice.", default: "system", control: "segments", choices: [{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] },
  { id: "textSize", group: "Display", title: "Text size", description: "Sizes the text on every manager panel.", default: 100, control: "range", min: 80, max: 140, step: 10, unit: "%" },
  { id: "colorblind", group: "Display", title: "Colorblind correction", description: "Re-tints status colors (on, update ready, problem) on every panel. Status is always also shown as a word or a symbol.", default: "off", control: "select", choices: [{ value: "off", label: "Off" }, { value: "red-green", label: "Red and green" }, { value: "blue-yellow", label: "Blue and yellow" }] },
  { id: "highContrast", group: "Display", title: "High contrast", description: "Uses white borders and brighter text on black.", default: false, control: "switch" },
  { id: "listRows", group: "Display", title: "List rows", description: "Changes row spacing. Controls keep their touch target size.", default: "roomy", control: "segments", choices: [{ value: "roomy", label: "Roomy" }, { value: "tight", label: "Tight" }] },
  { id: "motion", group: "Motion and effects", title: "Reduce motion", description: "Cards appear without a fade or slide. Device follows your system setting.", default: "device", control: "segments", choices: [{ value: "device", label: "Device" }, { value: "reduce", label: "Reduce" }] },
  { id: "rowHighlight", group: "Motion and effects", title: "Row highlight", description: "Marks the selected row with a bright bar. Keyboard focus always has a white ring.", default: true, control: "switch" },
  { id: "hoverCards", group: "Motion and effects", title: "Hover cards", description: "Opens a name's card after a quarter second. The question button always opens it.", default: true, control: "switch" },
  { id: "sound", group: "Sound and touch", title: "Sound cues", description: "Stores your choice for sound cues in the host presentation.", default: true, control: "switch" },
  { id: "haptics", group: "Sound and touch", title: "Haptics", description: "Plays a tick when a long press opens a card.", default: false, control: "switch" },
];
