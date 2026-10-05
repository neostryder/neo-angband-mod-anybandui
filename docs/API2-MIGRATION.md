# Moving AnybandUI to mod API 2

AnybandUI runs on mod API 1. Every read it makes of the game's core, live state, registries or raw snapshot goes through `src/host-adapter.ts`, and `src/host-adapter-api2.ts` answers the same reads from a `ModApi2` object. Nothing loads the API 2 file yet. Core hands a mod the API 2 object only when its manifest declares API 2, and an API 1 mod's context has none, so the mod moves to API 2 all at once or not at all. Most of the mod still has no API 2 read (the Core requests below), so the manifest stays on API 1. Once those land, the port is to read one frame per draw with `readFrame` and point the features' imports at `host-adapter-api2.js`. The tests in `src/host-adapter-api2.test.ts` and `src/host-adapter-api2.integration.test.ts` hold each pair of functions to the same answers, the second over a real game and Core's own API 2 host.

`manifest.json` is a schema 2 document that keeps the mod on API 1 (`"api": ">=1.0.0 <2.0.0"`, `"runtime": "in-process"`). Only a Core build that reads schema 2 manifests can load it.

AnybandUI is the first-party presentation mod, so it is the mod meant to hold the `manage` domain and the presentation members once Core adds them. The Neo manager screens are a separate piece of work and are not covered here.

## Where each read goes

The status column says one of three things. **Moved** means `host-adapter-api2.ts` implements the read and the parity tests cover it. **API 2 home** means API 2 has a place for it that this mod does not call yet. **Core request** means API 2 has no form for it yet; the number points into the list after the table.

### The adapter's exports

| API 1 read | API 2 home | Status | Notes |
| --- | --- | --- | --- |
| `viewInput` | `view.input()` with `view.world()` | Moved | The input wait carries the known world as `core`, the way the API 1 snapshot does. |
| `viewWorld` | `view.world()` | Moved | |
| `viewPlayer` | `view.player()` | Moved | `status` names the grade the status line prints for each effect, or null when it is off, where API 1 counts the turns left. `status.food` is a percentage, and `recall` and `descent` are booleans. `recallGrid` in `src/effects.ts` takes either form. |
| `viewMonsters` | `view.monsters()` | Moved | `id` is a handle for the monster on this level, numbered in the order the character first perceives monsters, where API 1 gives the game's monster index. Targets and commands under API 2 take the handle. `raceFlags` holds only the flags the character's monster memory has learned. API 1 lists them all. The features only read it when `unique` is missing, and `unique` is always present. |
| `viewLevel` | `view.level()` | Moved | Lists only squares whose terrain the character remembers. See Core request 2. |
| `truthLevel` | `truth.level()` | Moved | Read only with the glow on. Core builds `truth` only for a mod the player allowed `state:map-actual.read`. See Core request 1. |
| `hasLiveState` | `view.world().player` | Moved | |
| `playerGrid`, `playerHitPoints`, `playerHallucinating` | `view.player()` | Moved | |
| `playerTimedEffects` | `view.player().status` | Moved | Covers 25 of the engine's 53 timed effects. See Core request 6. |
| `levelKey` | `view.level().levelId` | Moved | Before the first level change of a session, API 1 falls back to the depth and `levelId` reads 0. API 1's key can therefore repeat across the first change (depth 1, then serial 1); `levelId` cannot. |
| `levelDepth`, `levelSize` | `view.level()` | Moved | |
| `gridHasVisibleTrap` | `view.level()` cell `remembered.traps` | Moved | |
| `gridIsShop` | `view.level()` cell `remembered.feat` against `view.world().stores` | Moved | Reads the remembered terrain where API 1 reads the real terrain. A shop entrance is permanent, so they differ only on a town square the character has never seen. |
| `rememberedPile` | `view.level()` cell `remembered.objects` | Moved | The entries carry no live object, so nothing can name them. See Core requests 2 and 4. |
| `carriedGear`, `knownArtifactTest` | `view.world()` inventory, equipment and quiver, `KnownItem.artifact` | Moved | A known item says how many of the stack are recharging (`charging`) and whether it has unlearned runes (`unknownRunes`). It has no `timeout`, so the quickbar's "Recharge N" becomes "Recharging" or "Ready". First-encounter alerts also need the artifact's index. See Core request 7. |
| `birthFacts` | `store.character` | API 2 home | The birth figures serve as a fingerprint for per-character notes. `store.character` already keeps data per character, so the fingerprint goes away with the port. |
| `apparentTerrain` | `content.lookup()` by the cell's `featCode` | API 2 home | |
| `listedFloorObject`, `floorObject` | `view.world().floorHere` | API 2 home | The panels pass the live object on to loadout simulation, which has no API 2 form. See Core request 5. |
| `visibleMonsterRaces` | `view.monsters()` with `content.records("monster")` | API 2 home | |
| `offers` | `meta.granted()` | API 2 home | API 1 asks whether Core exports a function. API 2 asks whether the player granted a permission. |
| `gridInView` | none | Core request 3 | |
| `lookAt` | none | Core request 4 | |
| `describeObject` | `KnownItem.name` for carried and floor items | Core request 4 | Remembered objects elsewhere on the map have no name. |
| `canSimulateLoadout`, `simulateLoadout` | none | Core request 5 | |
| `liveHud` | `view.world()`, `view.player()`, `view.input()` | Core request 9 | `KnownPlayer` has the study count, recall and descent. The rest of the HUD has no read. |
| `coreFormatters` | none | Core request 8 | |
| `liveGame`, `itemsGame` | none | Retired | The panels move to `view` reads and `act.submit()`. |
| `itemActionBuilders` | `act.submit()` | Removed | The item panels build their own command objects, which match the engine's builders. |

### The plugin context

| API 1 member | API 2 home | Status | Notes |
| --- | --- | --- | --- |
| `ctx.id`, `ctx.engine`, `ctx.flags`, `ctx.log` | `meta` | API 2 home | |
| `ctx.settings` | `meta.settings()`, `meta.setSetting()` | API 2 home | |
| `ctx.prefs` | `store.prefs` | API 2 home | |
| `ctx.characterStore` | `store.character` | API 2 home | The run journal, graveyard and death recap keep their records here. |
| `ctx.mods` | `meta.mods()` | API 2 home | |
| `ctx.assetUrl` | `content.asset()` | API 2 home | Loads the bundled fonts. |
| `ctx.snapshot` | `view.input()`, `view.world()` | Moved | Read through the adapter. The snapshot's messages, resting state, store status, active blast and frame have no read. See Core request 9. |
| `ctx.knownLevel` | `view.level()` | Moved | Read through the adapter. |
| `ctx.driver` | `view.input().driver`, the `driver-changed` event | API 2 home | |
| `ctx.events` for `combat-outcome`, `heal`, `motion`, `driver-changed`, `dungeonlevel` | `events.on()` | API 2 home | |
| `ctx.events` for `bolt`, `explosion` | none | Core request 12 | |
| `ctx.intent.submit` | `act.submit()` | API 2 home | |
| `ctx.intent.catalogue` | none | Core request 10 | The item panels read it to learn which commands take a floor item. |
| `ctx.prompt` | `act.answer()` | API 2 home | |
| `ctx.inspect` | none | Core request 10 | Uses `inspectItem`, `itemRules`, `itemTester`, `bookForItem`, `spellInfo`, `monsterRecall`, `projectionPath`, `travelPath`, `blastArea`, `compareLoadoutSlots` and `tileActions`. |
| `ctx.character` | `view.player()` for the figures | Core request 11 | Uses `sheet`, `history`, `runReport`, `onRunEnd` and `key`. |
| `ctx.ui.openPanel`, `ctx.ui.registerPanelKind` | `ui.mount()` draws host panels only | Core request 13 | Every AnybandUI panel builds its own DOM. |
| `ctx.display` | none | Core request 13 | Sets the grid, camera, map view, visual filter, chrome theme, overview, tile scaling, sidebar extent and quiver itemization, and calls `onKey`, `repaint` and `snapshot`. |
| `ctx.subwindows`, `ctx.tiles` | none | Core request 13 | |
| `ctx.title` | none | Core request 13 | Adds rows to the title screen. |
| `ctx.saves` | none | Core request 16 | The save cards and the graveyard use it. |
| `ctx.options` | `hooks.optionsChanged` for changes | Core request 16 | The options editor reads and writes every option. |
| `ctx.keybindings` | `ui.keys` covers this mod's own bindings | Core request 16 | The keybinding editor edits the whole keyset. |
| `ctx.knowledge` | none | Core request 16 | The knowledge browser reads it. |

### Plugin members

| API 1 member | API 2 home | Status | Notes |
| --- | --- | --- | --- |
| `register` | `start(mod)` | API 2 home | |
| `uninstall` | `stop()` | API 2 home | |
| `menu`, `screen`, `birth`, `hud` | none | Core request 13 | The presenters behind the redrawn menus, screens, birth wizard and HUD. |

### Host page reads

These read the web page directly rather than a context member. They stay until Core gives the mod a way to ask.

| Read | File | Status | Notes |
| --- | --- | --- | --- |
| `sessionStorage` keys `neo-angband-birth-done` and `neo-angband-skip-title`, URL parameters `agent` and `new` | `src/zoom.ts` | Core request 15 | Tells the title screen, birth and the first frame of play apart. |
| `#game` canvas pixels | `src/effects.ts` | Core request 14 | The CRT glow and colour fringe sample the finished frame, and the scene fade holds a copy of it. |
| `#game` bounds and the graphics overlay canvas | `src/hover-cards.ts`, `src/qol-map-hover.ts` | Core request 14 | Maps a mouse position to a cell, and crops a tile for the hover card. |
| `TERM_COLS`, `TERM_ROWS` and the glyph cell size | `src/qol-map-hover.ts` | Core request 14 | A copy of the terminal's geometry, used when the overview map is not open. |
| `#game-view` | `src/zoom.ts` | Core request 13 | The element the sidebar overlay attaches to. |

## Core requests

Each request names what AnybandUI needs, the smallest Core addition that would give it, and whether only a first-party (P-tier) mod should get it. All sixteen are open.

1. **Asking for the real map when the glow is turned on.** With "Glow shows hidden magic" (`anybandui.itemGlowReveals`) on, the floor glow marks unidentified artifacts, hidden curses and unknown runes, and that needs the real map. Core asks for `state:map-actual.read` on its own question. The question warns that the mod sees what the character has not found and that every character played while the grant stands is marked the way debug mode marks it, and only a mod holding the grant gets `truth`. Core asks when the mod is turned on and marks characters for as long as the grant is held, with the glow on or off. A player who allows it therefore gets marked characters even when the glow stays off. The smallest addition is a capability that belongs to a rule, such as a `capabilities` list on a manifest rule: Core asks for it when the player turns the rule on, marks the save then, and leaves `truth` out while the rule is off. Then `state:map-actual.read` leaves the manifest's standing list. AnybandUI needs `truth.level()` and not `truth.monsters()`. P-tier only.
2. **Remembered objects on unremembered squares.** `KnownLevel.cells` skips any square whose terrain the character does not remember, so an object the character knows about on such a square (a detected object, or one on floor the character never stood near after the whole level is lit) has no cell. The map still draws it. The smallest addition is to list those squares too, with `remembered.feat` 0. Public.
3. **Whether a grid is seen right now.** Hover cards say whether a grid is in view using the engine's SEEN flag. `KnownLevelCell.visible` is the VIEW flag, which differs from it. The smallest addition is a `seen` boolean on `KnownLevelCell`. Public.
4. **Look text and names for remembered objects.** Hover cards show the game's own look line for a grid and name each remembered object. API 2 has `KnownMonster.look` for monsters and `KnownItem.name` for carried and floor items, and nothing for a grid or a remembered object elsewhere. The smallest addition is a `name` on each aware remembered object and a `view.look(grid)` read that returns the look line. The look read needs no exact monster hit points, since the health band is enough for the card. Public.
5. **Loadout simulation.** The equipment comparison and the stat preview ask what wearing an item would change. The smallest addition is a `view.simulateLoadout(change)` read that takes item handles or floor indices and returns the same `LoadoutSimulation` the agent view does. Public.
6. **Every timed effect in the player status.** `KnownPlayerStatus` names 25 timed effects. The hover card on the character lists every timed effect running, including slow, invulnerability, see invisible, telepathy and the temporary brands. The smallest addition is the remaining fields, or a `timed` record keyed by the engine's effect codes. Public.
7. **A stable artifact id on known items.** First-encounter alerts remember each artifact by its index. The `artifactIdentified` hook gives the index at the moment of identification, which misses an artifact the character already knows. The smallest addition is an optional `artifactId` on `KnownItem` when the character knows the item is an artifact. Public.
8. **Depth text and colour values.** The alert cards format a depth the way the game does and turn a colour code into CSS. The smallest addition is a colour table with CSS values in `content`, and a depth string such as `depthText` on `KnownPlayer`. Public.
9. **The HUD's remaining figures.** The character card and status line show the character's full name, the message log (the `message` event gives new lines but no history), whether the character is resting, running or repeating a command and how many repeats are left, the unignore toggle, extra moves, the store status and the active blast. The smallest addition is those fields on `view.world()` or `view.input()`, with the message log as a bounded list. Public.
10. **Inspection reads.** The item panel, spell list, blast preview, path preview and tile actions call the eleven `ctx.inspect` reads listed in the table, read the command catalogue for floor-item support, and read the equipment slot names. The smallest addition is the same reads under `view`, built from known data, plus `equipmentSlots` on `KnownWorldData`. Public.
11. **Character sheet, history and run report.** The character sheet panel, run journal, graveyard and death recap need the sheet text, the history log, the run report and a run-end signal. The smallest addition is `view.character()` returning the sheet, history and report, with a `run-end` event. Public.
12. **Bolt and explosion events.** The bolt glyphs, breath cone and blast flash draw from the `bolt` and `explosion` events, which API 2 does not list. The smallest addition is both events with known-only payloads: the grids the character sees and the element. Public.
13. **Presentation members.** AnybandUI redraws the menus, screens, birth, HUD, panels, subwindows and title rows, and drives the display: grid, camera, map view, visual filter, chrome theme, overview, tile scaling, sidebar extent and repaint. The smallest addition is a presentation domain that carries today's `display`, `subwindows`, `tiles`, `title` and DOM-panel members and accepts the four presenters, plus a host element for the sidebar overlay. P-tier only.
14. **Display hit testing and frame pixels.** Hover cards and the map hover turn a mouse position into a cell or an overview grid, and two effects sample the finished frame. Today they read the `#game` canvas and keep their own copy of the terminal geometry. The smallest addition is a `display.cellAt(clientX, clientY)` that answers the cell and the cave grid in every mode, and a way to read the finished frame's pixels or draw on a layer above it. Effects must keep working in text mode and with any tileset. P-tier only.
15. **A boot phase signal.** The zoom feature tells the title screen from birth, and both from the first frame of play, by reading the host's session storage and URL. `view.input().phase` reports the title screen and birth alike as `pregame`, and the `enter-world` event marks only the start of play. The smallest addition is to split `pregame` into `title` and `birth`, with an event when the phase changes. P-tier only.
16. **Management reads and writes.** Save cards and the graveyard list, create, load, rename and delete saves. The options editor reads and writes every option, the keybinding editor edits the whole keyset, and the knowledge browser reads the knowledge menu. `manage` has profiles and the session controls and nothing else. The smallest addition is `manage.saves`, `manage.options`, `manage.keys` and a `view.knowledge()` read. P-tier only, except the knowledge read, which could be public.

## The removal list

The item panels no longer ask Core's agent actions (`createAgentActions`) for command objects. They build the objects themselves, so the `itemActionBuilders` export is gone and every command the panels send is the same as before. The rest of the removal list needs Core first. The host page reads wait on Core requests 14 and 15, the copy of the terminal geometry on 14, the context members on 9, 10, 11, 13 and 16, and the presenters on 13. No grant can come out of the manifest yet. `state:map-actual.read` waits on Core request 1, and `saves:manage`, `ui:title` and the `ui:*.replace` grants are still in use.
