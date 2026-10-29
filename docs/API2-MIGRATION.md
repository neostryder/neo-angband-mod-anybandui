# AnybandUI on mod API 2

AnybandUI runs as a first-party, in-process mod on mod API 2. Its manifest uses schema 2 and declares `"api": ">=2.0.0 <3.0.0"` with `"runtime": "in-process"`. `plugin.ts` exports an `Api2ModDefinition` with `start`, `stop`, and a `presentation` block that holds the menu, screen, HUD, and birth presenters. The panels, title rows, and manager mount through the presentation and `manage` domains. The branch builds against SDK and core packages from a local pack, pinned with `file:` lines in `package.json`, and registry versions replace those lines when the SDK is published.

## How the features read the game

Every feature was written against one synchronous plugin context: snapshot, known level, inspection, intents, prompts, events, and preferences. Making forty features and their tests await each read would change how they behave, so `src/bridge.ts` answers the same questions from two sources.

The first source is the engine domain. A first-party mod gets `mod.engine`, and the bridge computes plain reads of live state (the known world, the known level, item inspection, and game events from the engine's own bus) synchronously with the engine's own functions, the same way the host serves an API 1 mod. These reads never see the real map, because the bridge asks for the known level with every read domain except `state:map-actual.read`.

The second source is a cache filled by API 2 calls and refreshed after each frame, event, and action. The input wait (phase, prompt, who holds the keyboard, and the message pause) comes from `view.input()`, stored preferences from `store.prefs`, settings from `meta.settings()`, and the mod list from `meta.mods()`. Acting is optimistic. A submit that passes the checks the cache can make answers accepted at once, and the next refresh reads back the real answer.

The management and record seams in `src/bridge-seams.ts` cover the character, knowledge lists, options, keymaps, roster, session, title rows, and character store. Each of them answers with a promise, so each is served from a short cache filled at start and refilled in the background. An editor that reads a value once when it opens can show it up to the cache age out of date, which runs 1 to 3 seconds.

`src/host-adapter.ts` keeps the read helpers the features import. `src/host-adapter-api2.ts` is a pure API 2 copy of those reads: `readFrame` reads one frame through `view` and `truth`, and its tests check that each pair of functions gives the same answers over a real game and over Core's own API 2 host. The running mod imports nothing from it. It is there to replace the bridge's synchronous reads once the domains grow synchronous snapshots.

## Capabilities

The manifest asks for the capabilities the code uses and no others, so `state:map-actual.read` is absent. The standing list covers the reads and events the panels draw from, plus `ui:*` replacement and mount, `keymap:edit`, `options:write`, `saves:manage`, `profiles:manage`, `session:control`, `screens:manage`, `engine:access`, `store:kv`, `mod:install`, and `event:run-end`. The consent screen shows this list, which is why a capability goes in only with the first feature that needs it.

## The Neo Angband manager

The Neo Angband manager, made up of the look picker, the mod browser, and the mod lists, ships inside the mod. It opens from a title row and from the Mods page of the settings window. It reads and sets the look through `manage.look`, and the mod carries the Neo look as a manifest `lookPreset`, `{ "look": "Neo", "settings": {} }`, which the host applies as data.

## Where the old Core requests stand

The API 1 adapter listed sixteen requests for Core. On API 2 a first-party mod holds the engine domain, and that domain answers most of them directly.

| # | Need | State |
| --- | --- | --- |
| 1 | Ask for the real map when "Glow shows hidden magic" is turned on | Closed. The mod calls `permissions.requestTruth` the first time the option is turned on, and the game asks its own question. A yes returns the `truth` domain, which the bridge reads into the remembered map's cells, and the game keeps the answer for later sessions. A no leaves the glow at what the character knows, and the question is asked again only after the option is turned off and on. The manifest still has no `state:map-actual.read`. |
| 2 to 11 | Remembered objects on unremembered squares, whether a grid is seen, look text, loadout simulation, every timed effect, artifact ids, depth text and colors, the HUD's remaining figures, inspection reads, character sheet and run report | Served by the engine domain's own functions through the bridge. |
| 12 | Bolt and explosion events | Served by the engine event bus, with `event:bolt` and `event:explosion` consented. |
| 13 | Presentation members | Served by the presentation domain: the four presenters, panels, title rows, and the display. |
| 14 | Cell hit testing and frame pixels | Open. Hover cards and the map hover read `#game` and its bounds, and the CRT glow and fringe sample the finished frame. |
| 15 | A boot phase signal | Open. `src/zoom.ts` tells the title screen from birth by reading session storage keys and URL parameters. |
| 16 | Management reads and writes | Served by `manage.options`, `manage.keys`, `manage.saves`, and `view.knowledge`, through the seam cache described above. |

Until Core adds rows 14 and 15, the mod keeps the page reads. Neither blocks any other work.

## Checking a build

Run `pnpm verify` first. It runs the type check, the tests, and the checker, and all three must pass. The checker is `neo-angband-mod-check --first-party`, which accepts an in-process API 2 mod.

Then play the mod in a lab build, once with it on and once with it off:

1. Copy `manifest.json` and `plugin.js` into `<data root>/mods/anybandui/`.
2. Launch the lab build with `--lab-trust=anybandui`.
3. Walk through the title look choice, every panel, the settings window (layout undo and redo, and Save game), and a new character down to dungeon level 3.

The game reads `plugin.js` at startup, so a rebuilt bundle needs a relaunch, and a reload does not pick it up.
