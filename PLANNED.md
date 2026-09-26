# Planned

The order AnybandUI's features arrive in Neo Angband, from the character card and message log through items, spells, stores and effects to touch controls and a bridge for the native client. Each phase ends in a release you can switch on, and each feature inside a phase gets its own toggle on the Mods screen. Nothing listed here is in the mod yet; [CHANGELOG.md](CHANGELOG.md) records what has shipped. The port is tracked as [neostryder/neo-angband#284](https://github.com/neostryder/neo-angband/issues/284).

## What gets ported

AnybandUI's `deluxe` branch is a native C++ program built on Dear ImGui and SDL's GPU API. It launches an Angband engine as a child process and talks to it over a line-delimited JSON protocol called full-v1 (`protocol/wire-v1.md` and `protocol/full-v1.json` in that repository). The engine owns every rule and the frontend owns every pixel.

Neo Angband runs in a browser page and in an Electron window, so this mod reimplements the interface in TypeScript on Neo Angband's own UI seams: `ui:sidebar.replace`, `ui:messages.replace` and `ui:status.replace` for the HUD, `ui:menu.replace` and `ui:screen.replace` for menus and the 39 modeled screens, `ui:region.create` for new panes, `ui:panel.mount` for HTML windows, and `display:replace` for the dungeon view. His layouts, colours, effects and interaction design carry over directly. His fonts, sounds and shaders come across with their licences, and the HLSL shaders are rewritten for WebGL.

## The view model

Every panel reads one adapter, `src/view-model/`, which turns Neo Angband's agent view and world frames into the payload shapes full-v1 defines: the player record, items with `actual` and `player_known` halves, monsters, dungeon cells in terrain, trap, item and actor layers, prompts, targeting, store, spells, and the event stream. Panels never read engine objects directly.

Each panel can then be checked field by field against the protocol documents, and the same adapter can later sit behind a bridge that speaks full-v1 over stdio or a local socket, letting the native AnybandUI client drive Neo Angband as a second engine.

The game owns rules, validation, dice, knowledge, item eligibility, targeting and prices. A read never advances a turn, changes what the character knows, or draws a random number, and every read path gets a test that compares the full game state, knowledge and RNG state before and after.

## Seams needed in Neo Angband

Phases 0 and 1 fit the seams Neo Angband has today. The later phases need the six below, and each lets a mod observe or submit something the game already does. They are tracked as [neostryder/neo-angband#285](https://github.com/neostryder/neo-angband/issues/285).

1. **A consistent snapshot boundary.** One token per input wait, covering player, knowledge, prompt and map together, plus the current phase and whether a message pause is waiting. Today each agent view read is separate and the map frame arrives on repaint.
2. **Remembered and actual views of items, terrain and the whole level.** Separately named fields for what the character remembers and what is really there, and an iterator over the whole known level for the free camera and map overview.
3. **Read-pure inspection.** The full inspection text for an item, monster recall, spell descriptions and eligibility, item tester results, and projection path and blast area previews, all computed by the game's own formatters and helpers without side effects. `simulateLoadout` already covers part of equipment comparison.
4. **Typed prompts and targeting.** A descriptor for every prompt the game waits on (confirmation, quantity, text, item choice, spell choice, direction), and the targeting loop's cursor, candidates and path, each answerable through the existing handler.
5. **Validated player intent.** A way for an interface to submit the commands a player could type, plus click-to-walk, pickup, tunnel and store actions, checked against the current snapshot token and routed through the original handlers. This is separate from the autoplayer controller seam, and the character is not marked as autoplayed.
6. **Resolved combat and movement events.** Emit-only events for hits, misses, damage, healing, walking and teleporting, carrying what actually happened, for animations and damage numbers.

Phase 2 needs seams 2, 4 and 5. Phases 3 and 4 need 3, 4 and 5, phase 5 needs 4 and 5, and the precise animations in phase 7 need 6.

The web host needs its own pieces as well: a full-window workspace in which the dungeon view can move between panes, a pop-out window call for the desktop app, a saves facade for the main menu, and post-processing that can cover HTML panels as well as the terminal canvas.

## Phases

### Phase 0: foundation

The view model over today's agent view, with read-purity tests. Settings storage, theme tokens (palette, spacing, borders) as data, and font loading. No visible change yet.

### Phase 1: status and messages

The character card (name, race and class, level, HP, SP, food and XP bars, stats, gold, armour, speed), the dungeon card (depth, light, level feeling, terrain underfoot), status badges with hover explanations, the tracked-creature meter, and the message log with search, repeat counts and the amber "messages waiting" ribbon. This phase needs only the HUD seams that exist today.

### Phase 2: the map under the mouse

Hover a tile for a card of what the character knows about it. Click to walk or attack, right-click for a context menu of the actions that tile allows, and see the gold path line while aiming.

### Phase 3: items

Searchable pack, equipment and quiver lists with name colours, an inspection window with collapsible sections, the Current, Selected and Change comparison table with the unchanged-stats toggle, the quantity picker with Half and All, and native item choice prompts.

### Phase 4: spells and the quickbar

The spell table for every book (mana, fail rate, level, status, description), cast and study with a click, blast footprint previews while aiming, and the ten-slot quickbar on the number keys for spells, potions, scrolls, wands and activations, with shift and control rows. Slots show mana cost or charges and grey out when unusable.

### Phase 5: stores

Stock and your pack side by side, unit prices, the comparison table for anything wearable, and Buy, Sell, Stash and Retrieve through the game's own quantity and price confirmations.

### Phase 6: layout

Dock, tab, split, resize, float and hide every panel, with an edit mode showing docking guides, undo and redo, and named saved layouts. On the desktop app, panels can pop out into their own windows and move to a second monitor.

### Phase 7: effects

CRT treatment (scanlines, phosphor glow, colour fringing, sweep), low-health glitching and the death burst, glows on artifacts, runes and cursed items on the floor, rising z marks over sleeping monsters, the presence haze around uniques and Morgoth, and spell cast and impact animations. Every effect has an intensity slider and an off switch, and all of them honour the system's reduced-motion setting.

### Phase 8: menus

The main menu with save cards and the graveyard, the step-by-step character creation wizard with live previews and point-buy, the knowledge browser with search and a known-only switch, the settings window with presets and themes, and the hall of fame.

### Phase 9: beyond the desktop

Touch, controller and phone-sized screens, built on the same panels. Tap, double-tap, long-press and swipe all work on the map. The right-click context menu becomes a radial menu under your finger, and the quickbar maps to a controller's shoulder and face buttons. Layouts switch with the device and its orientation, and an in-game workshop exports and imports layout presets. Scalable text and colour settings join the accessibility options.

### Phase 10: the full-v1 bridge

A small launcher that runs Neo Angband headless and serves the view model over full-v1, so the native AnybandUI client lists Neo Angband in its engine picker. It passes his `protocol/check_engine.py` smoke check before it ships.

## Keeping in step with AnybandUI

AnybandUI keeps developing in its own repository, and this mod follows it. `UPSTREAM.md` records the AnybandUI commit each ported feature is based on, and a sync pass walks the `deluxe` commits since the last recorded one. Each commit gets one row: ported (with the commit here that carries it), not applicable (engine-side or specific to the native build), or pending. Changes can arrive from either direction. A feature built first in AnybandUI is ported here, and a pull request here can be offered back to AnybandUI when it fits the native client.

## Works with the other mods

- **Linoleum.** AnybandUI's tileset mode draws Linoleum's packs, including mod-added monsters and items that Linoleum fills from their kin. Item glows and the presence haze sit on top of tiles and ASCII alike.
- **Quality of Life.** Its zoom and pan becomes the dungeon pane's camera once this mod owns the map, so the two share one zoom setting instead of fighting. Its map hover cards and first-encounter alerts supply the threat badge (Unique, Deadly, Out of depth) that the hover card and tracked-creature meter show. The activation shortcut helper and repeated-action shortcuts offer quickbar slots as well as keys. The high-contrast and colourblind filters apply to the panels, and switching either one on turns the CRT effects down.
- **Squire.** Its three errands get quickbar buttons, and the status card shows which errand is running and why it stopped.
- **Borg.** While the Borg plays, the panels keep updating as a spectator view, and the quickbar and click actions stand down.
- **Bug Fixes and Cutting Room Floor.** Both change rules, which this mod never does. The view model reads whatever rules are loaded, so restored features such as door spikes show up in the item lists and stores with no extra work.
- **ModForge.** Layouts and themes are plain JSON, so ModForge can edit them and a content pack can ship them.
- **The core accessibility live regions.** The message log keeps announcing new messages to screen readers after the log becomes a panel.

## Ideas past the port

- **Death recap.** A timeline of the last few turns before death: who hit for how much, what was tried, what was left in the pack. It reads the combat events from seam 6 and slots into the tombstone screen.
- **Floating damage numbers,** off by default, drawn from the same events.
- **Photo mode.** Hide every panel, keep the free camera and effects, and save a screenshot, for sharing a character or a death.
- **Minimap travel.** Click anywhere on the remembered level in the map overview to walk there, using the game's own pathing and stopping on disturbance the way running does.
- **Pickup previews.** Hovering a floor item shows the comparison table against what you are wearing, before you pick it up.
- **Inscription and ignore rules as a panel.** A visual editor for the game's inscriptions and quality ignore settings, behind the existing "Item rules" button.
- **Theme packs.** Palettes and panel chrome as data, including a Linoleum-matched theme and a plain terminal theme for veterans who want the new controls without the new look.

## Before the first visible release

- The mod joins the game's list of recommended mods in `mods/registry.json`.
- The enable screenshot goes in `docs/img/anybandui-enable.jpg`.
- Every font, sound and shader brought over is listed in `CREDITS.md` with its licence.
