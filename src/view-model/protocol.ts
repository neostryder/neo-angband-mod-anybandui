/** Phase 1 state keys follow AnybandUI client.cpp and character_overview.h,
 * status_effects.h, and message_history.h. Undefined means the host did not
 * publish a fact; renderers may then apply the native client's display default. */
export interface StatPayload {
  label: string;
  value: number;
  drained: boolean | undefined;
}

export interface StatusPayload {
  label: string;
  name: string | undefined;
  visible: boolean | undefined;
  priority: number | undefined;
  kind: "harm" | "mixed" | "benefit" | "study" | "neutral" | undefined;
  duration: number | undefined;
  description: string | undefined;
}

export interface TrackedCreaturePayload {
  visible: boolean;
  name: string;
  hp: number | undefined;
  max_hp: number | undefined;
}

export interface FeelingIndicesPayload {
  object: number;
  monster: number;
  squares: number;
  need: number;
}

export interface PlayerPayload {
  name: string | undefined;
  race: string;
  class: string;
  title: string | undefined;
  hp: number;
  max_hp: number;
  sp: number;
  max_sp: number;
  food: number;
  food_max: number | undefined;
  experience: number;
  max_experience: number;
  level_start_experience: number | undefined;
  next_level_experience: number | undefined;
  level: number;
  max_level: number;
  stats: StatPayload[];
  gold: number;
  armour: number;
  speed: number;
  extra_moves: number | undefined;
  tracked_creature: TrackedCreaturePayload | undefined;
  depth: number;
  depth_feet: number;
  light: number;
  feeling: string | undefined;
  feeling_indices: FeelingIndicesPayload | undefined;
  feeling_description: string | undefined;
  floor: string | undefined;
  trap_detected: boolean | number | undefined;
  recall: boolean | number | undefined;
  descent: boolean | number | undefined;
  resting: boolean | number | undefined;
  running: boolean | number | undefined;
  repeat: number | undefined;
  unignoring: boolean | number | undefined;
  statuses: StatusPayload[];
  study: number | undefined;
}

export interface MessagePayload {
  text: string;
  count: number | undefined;
  system: boolean | undefined;
  category: number | undefined;
  group: string | undefined;
}

export interface DungeonSummaryPayload {
  depth: number;
  depth_feet: number;
  light: number;
  feeling: string | undefined;
  feeling_indices: FeelingIndicesPayload | undefined;
  feeling_description: string | undefined;
  floor: string | undefined;
}

export interface ViewModel {
  player: PlayerPayload;
  messages: MessagePayload[];
  /** True while a -more- pause holds input (client.cpp's message_pending). */
  message_pending: boolean | undefined;
  dungeon: DungeonSummaryPayload;
}

// Phase 3: preserve actual and player_known item halves when the host exposes them.
export interface ItemPayload { actual?: unknown; player_known?: unknown }
// Phase 2: map monster inspection fields when the host exposes them.
export interface MonsterPayload { id?: number }
// Phase 2: terrain, trap, item, and actor cell layers need known-world access.
export interface CellPayload { terrain?: unknown; trap?: unknown; item?: unknown; actor?: unknown }
// Phase 4: typed input and targeting descriptors require the prompt seam.
export interface PromptPayload { kind?: string }
// Phase 5: store actions and prices require validated intent and inspection.
export interface StorePayload { stock?: readonly ItemPayload[] }
// Phase 4: spell descriptions and eligibility require read-pure inspection.
export interface SpellPayload { name?: string }
