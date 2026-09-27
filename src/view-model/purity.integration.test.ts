import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { adapt } from "./adapter.js";
import { createSource } from "./source.js";

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
    for (let i = 0; i < 100; i++) {
      adapt(agentModule.createAgentView(game.state));
      adapterSource.snapshot();
    }
    expect(fingerprint()).toBe(before);
  });
});
