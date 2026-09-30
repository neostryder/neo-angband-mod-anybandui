/** Narrow feature contracts derived from the published host ABI. */
import type { ActualCell as CoreActualCell, AgentActions, DerivedStatsView, GameEventMap, InputToken as CoreInputToken, ItemRulesResult as CoreItemRulesResult, ItemTesterResult as CoreItemTesterResult, ItemView as CoreItemView, KnownLevelView, LoadoutItemRef, MonsterView, PlayerView, SpellInspectResult as CoreSpellInspectResult, SpellView as CoreSpellView, SpellbookView as CoreSpellbookView, StoreItemView as CoreStoreItemView, StoreView as CoreStoreView } from "@rpgm-tools/neo-angband-core";
import type { AckPrompt as HostAckPrompt, AckReply as HostAckReply, ActiveBlastView as HostActiveBlastView, CommandCatalogue as HostCommandCatalogue, InputSnapshot as HostInputSnapshot, IntentCatalogue as HostIntentCatalogue, IntentResult as HostIntentResult, ItemPrompt as HostItemPrompt, ItemRef as HostItemRef, MessageHistory as HostMessageHistory, ModInspect, ModPanel, ModPluginContext, ModUi, OtherPrompt as HostOtherPrompt, PanelKindSpec as HostPanelKindSpec, PanelMount as HostPanelMount, PanelState as HostPanelState, PlayerIntent as HostPlayerIntent, PublicMod as HostPublicMod, QuantityPrompt as HostQuantityPrompt, RestingView as HostRestingView, SpellPrompt as HostSpellPrompt, StopRestingIntent as HostStopRestingIntent, StoreItemRef as HostStoreItemRef, StorePromptAnswer as HostStorePromptAnswer, StoreStatus as HostStoreStatus, TextPrompt as HostTextPrompt } from "@rpgm-tools/neo-angband-core";
export type Grid = import("@rpgm-tools/neo-angband-core").Loc;
export type InputToken = CoreInputToken;
export type ItemView = CoreItemView;
export type CoreSnapshot = Partial<Pick<HostInputSnapshot["core"], "inventory" | "equipment" | "stores" | "quiver" | "equipmentSlots" | "floorHere" | "monsters" | "spellbooks">> & { readonly player?: Pick<PlayerView, "grid"> & Partial<Omit<PlayerView, "grid">> | null };
export type EffectMonsterView = MonsterView;
export type EffectSnapshot = InputSnapshot;
export type EventActor = GameEventMap["combat-outcome"]["target"];
export type EffectEventMap = Pick<GameEventMap, "combat-outcome" | "heal" | "motion" | "explosion">;
export type EffectContext = Partial<Pick<ModPluginContext, "flags" | "knownLevel" | "events" | "prefs">> & { readonly snapshot?: () => EffectSnapshot | null; readonly display?: Pick<NonNullable<ModPluginContext["display"]>, "snapshot">; readonly settings?: ModSettings };
export type ModSettings = Pick<NonNullable<ModPluginContext["settings"]>, "get"> & Partial<Omit<NonNullable<ModPluginContext["settings"]>, "get">>;
export type PromptBase = import("@rpgm-tools/neo-angband-core").PromptBase;
export type ItemPrompt = HostItemPrompt;
export type QuantityPrompt = HostQuantityPrompt;
export type OtherPrompt = HostOtherPrompt;
export type InputSnapshot = Pick<HostInputSnapshot, "token" | "phase" | "prompt"> & Partial<Omit<HostInputSnapshot, "token" | "phase" | "prompt" | "core" | "messages">> & { readonly core: CoreSnapshot; readonly messages?: MessageHistory | null };
export type KnownLevel = KnownLevelView;
export type ActualCell = CoreActualCell;
export type ActualObject = Pick<CoreItemView, "artifact" | "ego" | "curses" | "flags" | "modifiers" | "brands" | "slays" | "resists" | "toH" | "toD" | "toA">;
export type AgentCommand = import("@rpgm-tools/neo-angband-core").AgentCommand;
export type PlayerIntent = HostPlayerIntent;
export type IntentResult = HostIntentResult;
export type IntentSeam = NonNullable<ModPluginContext["intent"]>;

// Item panels: the item-facing slice of the same seams.
export type InspectResult = import("@rpgm-tools/neo-angband-core").InspectResult;
export type ItemTesterResult = CoreItemTesterResult;
export type ItemRulesResult = CoreItemRulesResult;
export type InspectSeam = Pick<ModInspect, "inspectItem" | "itemTester"> & Partial<Pick<ModInspect, "itemRules">>;
export type PromptSeam = NonNullable<ModPluginContext["prompt"]>;
export type LoadoutSimulation = import("@rpgm-tools/neo-angband-core").LoadoutSimulation;
export type LoadoutStats = Pick<DerivedStatsView, "speed" | "ac" | "toH" | "toD" | "blows" | "shots" | "maxHp" | "maxSp" | "totalWeight" | "statUse" | "resists" | "resistElements" | "objectFlags">;
export type ActionBuilders = Pick<AgentActions, "wear" | "takeoff" | "drop" | "raw">;
export type ItemsContext = Pick<ModPluginContext, "log"> & Partial<Pick<ModPluginContext, "flags" | "intent" | "prompt" | "prefs">> & { readonly snapshot?: () => InputSnapshot | null; readonly inspect?: InspectSeam; readonly ui?: { openPanel(spec: Parameters<ModUi["openPanel"]>[0]): Pick<ModPanel, "root" | "closed" | "close">; registerPanelKind?: ModUi["registerPanelKind"] }; readonly core?: { createAgentView?(state: unknown): Partial<Pick<ReturnType<ModPluginContext["core"]["createAgentView"]>, "simulateLoadout">>; createAgentActions?(state: unknown): ActionBuilders }; readonly state?: unknown };

// Map mouse: the map-facing slice of the same seams.
export type MouseSeams = Partial<Pick<ModPluginContext, "knownLevel" | "intent" | "prompt">> & { readonly snapshot?: () => InputSnapshot | null; readonly inspect?: Partial<Pick<ModInspect, "projectionPath" | "tileActions" | "travelPath">> };

export type SpellView = CoreSpellView;
export type SpellbookView = CoreSpellbookView;
export type SpellInspectResult = CoreSpellInspectResult;
export type SpellPrompt = HostSpellPrompt;
export type Phase4Snapshot = InputSnapshot;
export type Phase4Context = Pick<ModPluginContext, "log"> & Partial<Pick<ModPluginContext, "flags" | "intent" | "prompt" | "prefs" | "driver">> & { readonly snapshot?: () => Phase4Snapshot | null; readonly inspect?: Partial<Pick<ModInspect, "spellInfo" | "bookForItem" | "itemTester" | "inspectItem" | "blastArea" | "tileActions">>; readonly ui?: ItemsContext["ui"]; readonly display?: Pick<NonNullable<ModPluginContext["display"]>, "snapshot">; readonly character?: Pick<NonNullable<ModPluginContext["character"]>, "key">; readonly state?: unknown };
export type StoreItemView = CoreStoreItemView;
export type StoreView = CoreStoreView;
export type StoreStatus = HostStoreStatus;
export type StoreContext = Omit<ItemsContext, "snapshot" | "inspect"> & Partial<Pick<ModPluginContext, "knownLevel" | "driver">> & { readonly snapshot?: () => StoreSnapshot | null; readonly inspect?: StoreInspectSeam };

export type PanelState = HostPanelState;
export type PanelMount = HostPanelMount;
export type PanelKindSpec = HostPanelKindSpec;
export type PanelKindSeam = Pick<NonNullable<ModPluginContext["ui"]>, "registerPanelKind">;

export type InputDriver = GameEventMap["driver-changed"];
export type PublicMod = HostPublicMod;
export type DriverEvents = NonNullable<ModPluginContext["events"]>;
export type DriverSeams = Pick<ModPluginContext, "driver" | "mods" | "events">;

export type StoreSnapshot = InputSnapshot;
export type StoreQuantityPrompt = QuantityPrompt;
export type StoreConfirmPrompt = import("@rpgm-tools/neo-angband-core").ConfirmPrompt;
export type StorePromptAnswer = HostStorePromptAnswer;
export type StoreReplyResult = import("@rpgm-tools/neo-angband-core").PromptReplyResult;
export type StorePromptSeam = NonNullable<ModPluginContext["prompt"]>;
export type StoreItemRef = HostStoreItemRef;
export type InspectSection = NonNullable<InspectResult["sections"]>[number];
export type StoreInspectResult = InspectResult;
export type LoadoutSlotRef = LoadoutItemRef;
export type LoadoutSlotsResult = import("@rpgm-tools/neo-angband-core").LoadoutSlotsResult;
export type StoreInspectSeam = Pick<ModInspect, "inspectItem" | "itemTester"> & Partial<Pick<ModInspect, "itemRules" | "compareLoadoutSlots">>;

export type RestMode = import("@rpgm-tools/neo-angband-core").RestMode;
export type BookItemResult = import("@rpgm-tools/neo-angband-core").BookItemResult;
export type BlastAreaResult = import("@rpgm-tools/neo-angband-core").BlastAreaResult;
export type RestingView = HostRestingView;
export type ActiveBlastView = HostActiveBlastView;
export type TextPrompt = HostTextPrompt;
export type StopRestingIntent = HostStopRestingIntent;
export type CommandCatalogue = HostCommandCatalogue;

export type MessageHistory = Pick<HostMessageHistory, "token" | "entries"> & Partial<Pick<HostMessageHistory, "log">>;
export type AckPrompt = HostAckPrompt;
export type AckReply = HostAckReply;
export type MonsterRecallResult = NonNullable<ReturnType<ModInspect["monsterRecall"]>>;
export type MessageSnapshot = InputSnapshot;
export type RecallSnapshot = InputSnapshot;
export type MessageSeams = Pick<ModPluginContext, "prompt"> & { readonly snapshot?: () => MessageSnapshot | null };
export type RecallSeam = Partial<Pick<ModInspect, "monsterRecall">>;

export type PanelItemView = ItemView;
export type EquipmentSlotView = NonNullable<import("@rpgm-tools/neo-angband-core").CoreSnapshot["equipmentSlots"]>[number];
export type ItemPanelSnapshot = InputSnapshot;
export type ItemRef = HostItemRef;
export type ItemInspectResult = InspectResult;
export type LoadoutRef = LoadoutItemRef;
export type ItemRuleName = Extract<HostPlayerIntent, { kind: "item-rule" }>["rule"];
export type ItemIntent = Extract<HostPlayerIntent, { kind: "ignore" | "unignore" | "item-rule" }>;
// InspectSection and LoadoutSlotsResult are declared once, in the store window section above.
export type ItemIntentResult = IntentResult;
export type IntentCatalogue = HostIntentCatalogue;
export type ItemPanelContext = Omit<ItemsContext, "snapshot" | "inspect"> & { readonly snapshot?: () => ItemPanelSnapshot | null; readonly inspect?: StoreInspectSeam };
