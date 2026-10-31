// These structural subsets mirror Api2* in the mod SDK; replace them with imports at the API 2 move.
export type Api2Result<T> = { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: "not-granted"; readonly capability: string; readonly message: string }
  | { readonly ok: false; readonly reason: "unavailable"; readonly message: string }
  | { readonly ok: false; readonly reason: "refused"; readonly code: string; readonly message: string };
export type Api2Call<T> = Promise<Api2Result<T>>;
export interface Api2Consent { readonly granted: readonly string[]; readonly refused: readonly string[] }
export interface Api2ModTier {
  readonly trust: "first-party" | "reviewed" | "listed" | "sideloaded";
  readonly execution: "data" | "worker" | "in-process";
  readonly why: string;
}
export interface Api2ManagerConfirmation {
  readonly id: number;
  readonly operation: string;
  readonly mods: readonly { readonly id: string; readonly name: string; readonly version: string }[];
  readonly permissions: readonly {
    readonly modId: string;
    readonly capability: string;
    readonly consentText: string;
    readonly withoutIt: string | null;
    readonly canRunWithout: boolean;
  }[];
  readonly riskNotice: readonly string[];
}
export interface Api2ModReference { readonly repo: string; readonly tag?: string }
export interface Api2DiscoveredMod {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly repo: string;
  readonly tag: string;
  readonly description: string | null;
  readonly compatible: boolean;
  readonly engineNote: string | null;
}
export type Api2BrowseEntry = { readonly ok: false; readonly ref: Api2ModReference; readonly problem: string }
  | { readonly ok: true; readonly ref: Api2ModReference; readonly mod: Api2DiscoveredMod };
export interface Api2ManagerCatalog {
  readonly curated: readonly Api2BrowseEntry[];
  readonly community: readonly Api2BrowseEntry[];
  readonly sideloads: readonly Api2BrowseEntry[];
  readonly problems: readonly string[];
}
export interface Api2CatalogMod {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly manifest: { readonly description?: string };
  readonly capabilities: readonly string[];
}
export interface Api2InstallPlan {
  readonly id: number;
  readonly operation: "install" | "update" | "rollback" | "restore";
  readonly downloads: readonly { readonly mod: Api2DiscoveredMod; readonly bytes: number | null }[];
  readonly newGrants: Api2ManagerConfirmation["permissions"];
}
export interface Api2ManagerState {
  readonly revision: number;
  readonly installed: readonly {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly enabled: boolean;
    readonly consent: Api2Consent;
    readonly tier: Api2ModTier | null;
    readonly catalogMod: Api2CatalogMod;
  }[];
  readonly catalog: Api2ManagerCatalog;
  readonly pendingPlans: readonly Api2InstallPlan[];
  readonly pendingConfirmation: Api2ManagerConfirmation | null;
  readonly safeMode: boolean;
  readonly modList: readonly { readonly id: string; readonly version: string; readonly enabled: boolean }[];
  readonly updates: readonly {
    readonly id: string;
    readonly name?: string;
    readonly repo: string;
    readonly installed: string;
    readonly newest: string | null;
    readonly standing: string;
    readonly problem: string | null;
  }[];
}
export interface Api2ManagedMods {
  snapshot(): Api2Call<Api2ManagerState>;
  subscribe(listener: (state: Api2ManagerState) => void): Api2Call<{ readonly id: string }>;
  unsubscribe(subscription: { readonly id: string }): Api2Call<null>;
  browse(): Api2Call<Api2ManagerCatalog>;
  refresh(): Api2Call<Api2ManagerState>;
  planInstall(refs: readonly Api2ModReference[]): Api2Call<Api2InstallPlan>;
  applyPlan(id: number): Api2Call<Api2ManagerConfirmation | null>;
  recordConsent(id: string, decisions: Api2Consent): Api2Call<Api2ManagerConfirmation | null>;
  enable(id: string): Api2Call<Api2ManagerConfirmation | null>;
  disable(id: string): Api2Call<Api2ManagerConfirmation | null>;
  update(id: string): Api2Call<Api2ManagerConfirmation | null>;
  updateAll(): Api2Call<Api2ManagerConfirmation | null>;
  remove(id: string): Api2Call<Api2ManagerConfirmation | null>;
  rollback(id: string): Api2Call<Api2ManagerConfirmation | null>;
  restoreModList(entries: readonly { readonly id: string; readonly enabled: boolean; readonly flags?: Readonly<Record<string, boolean>> }[], replace: boolean): Api2Call<Api2ManagerConfirmation | null>;
}

export type SettingValue = string | number | boolean;
export interface SettingDefinition {
  readonly id: string;
  readonly group: string;
  readonly title: string;
  readonly description: string;
  readonly default: SettingValue;
  readonly control: "segments" | "range" | "select" | "switch";
  readonly choices?: readonly { readonly value: string; readonly label: string }[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
}
export interface ManageHost {
  readonly mods: Api2ManagedMods;
  readonly look: {
    read(): { readonly desired: "Vanilla" | "Neo"; readonly active: "Vanilla" | "Neo"; readonly pending: { readonly look: "Neo"; readonly modId: "anybandui" } | null };
    choose(look: "Vanilla" | "Neo"): Api2Call<null>;
  };
  readonly settings: {
    readonly definitions: readonly SettingDefinition[];
    get(): Readonly<Record<string, SettingValue>>;
    set(values: Readonly<Record<string, SettingValue>>): Api2Call<null>;
    subscribe(listener: () => void): () => void;
  };
  readonly clock: { now(): number; setTimeout(callback: () => void, ms: number): unknown; clearTimeout(id: unknown): void };
  readonly haptics: { tick(): void };
  readonly prefersReducedMotion: () => boolean;
  readonly assetUrl?: (path: string) => Promise<string | null>;
  readonly permissions?: (id: string) => Api2ManagerConfirmation["permissions"];
  readonly updatePermissions?: (id: string) => Api2ManagerConfirmation["permissions"] | null;
  readonly recovery?: {
    read(): {
      readonly removed: readonly { readonly id: string; readonly name: string; readonly version: string }[];
      readonly restore: { readonly plan: Api2InstallPlan; readonly unavailable: readonly { readonly name: string; readonly version: string; readonly reason?: string }[] } | null;
    };
    startWithModsOff(): Api2Call<null>;
    continue(): Api2Call<null>;
    restore(planId: number): Api2Call<Api2ManagerConfirmation | null>;
  };
}
