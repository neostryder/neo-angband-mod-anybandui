import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { adapt } from "./adapter.js";
import { createSource } from "./source.js";
import { adaptItems } from "./items.js";
import { adaptStore } from "./stores.js";
import { adaptSpells } from "./spells.js";
import type { InputSnapshot } from "../seams.js";

const checkout = process.env["NEO_ANGBAND_REPO"];

describe.skipIf(!checkout)("adapter over a real game", () => {
  it("preserves the serialized game and RNG over one hundred reads", async () => {
    const root = checkout!;
    const source = (path: string): string => pathToFileURL(join(root, "packages", "core", "src", path)).href;
    const gameModule = await import(/* @vite-ignore */ source("session/game.ts"));
    const agentModule = await import(/* @vite-ignore */ source("agent/perceive.ts"));
    const json = (name: string): unknown => JSON.parse(readFileSync(join(root, "packages", "content", "pack", `${name}.json`), "utf8"));
    const records = (name: string): unknown => (json(name) as { records: unknown[] }).records;
    const pack = {
      store: records("store"), constants: json("constants"), terrain: records("terrain"),
      roomTemplates: records("room_template"), vaults: records("vault"), dungeonProfiles: records("dungeon_profile"),
      obj: { objectBase: json("object_base"), object: json("object"), egoItem: json("ego_item"),
        artifact: json("artifact"), curse: json("curse"), brand: json("brand"), slay: json("slay"),
        activation: json("activation"), objectProperty: json("object_property"), flavor: json("flavor") },
      mon: { pain: records("pain"), blowMethods: records("blow_methods"), blowEffects: records("blow_effects"),
        monsterSpells: records("monster_spell"), monsterBases: records("monster_base"),
        monsters: records("monster"), summons: records("summon"), pits: records("pit") },
      player: { races: records("p_race"), classes: records("class"), properties: records("player_property"),
        timed: records("player_timed"), shapes: records("shape"), bodies: records("body"),
        history: records("history"), realms: records("realm") },
    };
    const game = gameModule.startGame(pack, { seed: 4242, depth: 1 });
    game.state.actor.player.fullName = "Purity Tester";
    game.state.messages?.add("A repeated message.", 2);
    game.state.messages?.add("A repeated message.", 2);
    const adapterSource = createSource({
      state: game.state,
      core: { createAgentView: agentModule.createAgentView },
    });
    expect(adapterSource.snapshot()?.player.name).toBe("Purity Tester");
    expect(adapterSource.snapshot()?.messages[0]).toMatchObject({
      text: "A repeated message.", count: 2, category: 2,
    });
    const fingerprint = (): string => JSON.stringify({
      save: gameModule.saveGame(game), rng: game.state.rng.getState(),
      turn: game.state.turn, cmdQueue: game.state.cmdQueue ?? [],
    });
    const before = fingerprint();
    const mapView = agentModule.createAgentView(game.state);
    // Exercise each new read once; the existing adapter still gets 100 reads.
    mapView.capture?.();
    mapView.knownLevel?.();
    mapView.projectionPath?.({ x: game.state.actor.grid.x, y: game.state.actor.grid.y });
    mapView.blastArea?.({ x: game.state.actor.grid.x, y: game.state.actor.grid.y }, 2);
    for (const book of mapView.spellbooks?.() ?? []) for (const spell of book.spells) mapView.spellInfo?.(spell.sidx);
    for (let i = 0; i < 100; i++) {
      adapt(agentModule.createAgentView(game.state));
      adapterSource.snapshot();
      const view = agentModule.createAgentView(game.state);
      const spellbooks = view.spellbooks?.() ?? [];
      for (const book of spellbooks) for (const spell of book.spells) view.spellInfo?.(spell.sidx);
      view.blastArea?.({ x: game.state.actor.grid.x, y: game.state.actor.grid.y }, 2);
      const captured = view.capture?.();
      if (captured) {
        adaptItems({ token: captured.token, phase: "play", prompt: null,
          core: { inventory: captured.inventory, equipment: captured.equipment } } as InputSnapshot);
        // Store adaptation reads only copied store, gear and known-cell views.
        adaptStore({ token: captured.token, phase: "store", prompt: null,
          core: { player: captured.player, inventory: captured.inventory,
            equipment: captured.equipment, stores: captured.stores } } as InputSnapshot,
          view.knownLevel?.() ?? null, null);
        const stocked = captured.stores?.findIndex((store: { stock: readonly unknown[] }) => store.stock.length > 0) ?? -1;
        if (stocked >= 0) view.simulateLoadout?.({ wield: [{ from: "store", store: stocked, index: 0 }] });
      }
    }
    expect(fingerprint()).toBe(before);
    // A caster's books go through bookForItem, spellInfo and the spellbook rows'
    // study and info fields; one hundred adaptations leave that game unchanged too.
    const caster = gameModule.startGame(pack, { seed: 4243, depth: 1, className: "Mage" });
    const casterPrint = (): string => JSON.stringify({ save: gameModule.saveGame(caster), rng: caster.state.rng.getState(),
      turn: caster.state.turn, cmdQueue: caster.state.cmdQueue ?? [] });
    const casterBefore = casterPrint();
    let mapped = 0;
    for (let i = 0; i < 100; i++) {
      const view = agentModule.createAgentView(caster.state);
      const captured = view.capture?.();
      if (!captured) continue;
      const model = adaptSpells({ token: captured.token, phase: "play", prompt: null,
        core: { player: captured.player, inventory: captured.inventory, spellbooks: captured.spellbooks } } as never,
        { spellInfo: (index: number) => view.spellInfo?.(index) ?? null, bookForItem: (handle: number) => view.bookForItem?.(handle) ?? null });
      mapped = model?.books.length ?? 0;
    }
    expect(mapped).toBeGreaterThan(0);
    expect(casterPrint()).toBe(casterBefore);
  }, 20000);
});
