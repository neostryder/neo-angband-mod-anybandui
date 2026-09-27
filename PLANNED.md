# Planned

The order AnybandUI's features arrive in Neo Angband, from the character card and message log through items, spells, stores and effects to touch controls and a bridge for the native client. Each phase ends in a release you can switch on, and each feature inside a phase gets its own toggle on the Mods screen. Nothing listed here is in the mod yet; [CHANGELOG.md](CHANGELOG.md) records what has shipped. The port is tracked as [neostryder/neo-angband#284](https://github.com/neostryder/neo-angband/issues/284).

## What gets ported

AnybandUI's `deluxe` branch is a native C++ program built on Dear ImGui and SDL's GPU API. It launches an Angband engine as a child process and talks to it over a line-delimited JSON protocol called full-v1 (`protocol/wire-v1.md` and `protocol/full-v1.json` in that repository). The engine owns every rule and the frontend owns every pixel.

Neo Angband runs in a browser page and in an Electron window, so this mod reimplements the interface in TypeScript on Neo Angband's own UI seams: `ui:sidebar.replace`, `ui:messages.replace` and `ui:status.replace` for the HUD, `ui:menu.replace` and `ui:screen.replace` for menus and the 39 modeled screens, `ui:region.create` for new panes, `ui:panel.mount` for HTML windows, and `display:replace` for the dungeon view. His layouts, colours, effects and interaction design carry over directly. His fonts, sounds and shaders come across with their licences, and the HLSL shaders are rewritten for WebGL.

## Effects work on text and tiles alike

Every visual effect works in the game's text mode and with whatever tileset the player has switched on, including Linoleum's packs and tiles that other mods add. An effect is attached to a map cell, an item or a creature, never to a particular glyph or tile image, so a glow, a haze or a sleeping creature's z marks look right however that cell is drawn. Each effect is tested in text mode and with at least one tileset before it ships.

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

The web host needs its own pieces as well: a panel seam through which this mod's cards become panes in the game's own window manager, a saves facade for the main menu, and post-processing that can cover HTML panels as well as the terminal canvas. The window manager and panel seam are tracked as [neostryder/neo-angband#287](https://github.com/neostryder/neo-angband/issues/287).

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

This mod's cards become panes in the game's own window manager rather than bringing a second one, so the dungeon view, the subwindows and these panels dock, tab, split, resize and hide together. The extras AnybandUI's native workspace offers (tabs, named saved layouts, undo and redo, and docking guides in an edit mode) join the game's manager, each behind its own setting. A panel can float as a window inside the game's view, and the desktop app and a browser tab behave the same, so no panel opens a separate operating system window. The window frames belong to the game; what a card shows and how you use it (clickable lists, the quickbar, dragging an item to use it) stays in this mod.

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

## Quality of Life's display features move here

The Quality of Life mod's display features move into this mod: zoom and pan, zoom for each panel, the hover cards on the map overview, first-encounter alerts, the enlarged, high-contrast and colourblind displays, and its other changes to how the screen is drawn. Each one becomes a separate switch here, styled to match the rest of AnybandUI. Quality of Life keeps its gameplay conveniences: auto-dig, remembered settings, tolerant pref files, the torch and lantern ignore rules, and its key shortcuts. Where the two mods draw the same thing differently, the merged feature works as follows.

Zoom follows Quality of Life. A zoom step makes glyphs or tiles bigger or smaller, and the view fits as many whole cells as it holds, so tiles never land between pixels. From AnybandUI's free camera it gains mouse-drag panning, a follow that pauses while you look elsewhere and resumes with a return-to-player key, a view that keeps the aiming cursor on screen, and re-centring on a new floor, each with its own switch. AnybandUI's interface scale, 75 to 150 percent, sizes the panels and their text, and the character card is always a panel of its own.

Hover cards appear on the dungeon view and on the map overview after one delay setting that starts at 550 ms, and holding a finger on a cell opens one on touch. Each of the two places has its own switch.

The map overview is Quality of Life's full-screen view of the whole known level. From AnybandUI's map it gains an outline of the area the main screen shows, bold markers with a legend for you, the stairs and the shops, wheel zoom at the pointer with drag to pan, Fit floor and Centre on player buttons, coordinates in the hover card with snapping to a nearby landmark, and a switch that draws the level as flat blocks of colour. The buttons and legend sit clear of the part of the map being read.

The high-contrast and colourblind filters come across as their own switches, off by default, and cover the panels as well as the map.

## Works with the other mods

- **Linoleum.** AnybandUI's tileset mode draws Linoleum's packs, including mod-added monsters and items that Linoleum fills from their kin. Item glows and the presence haze sit on top of tiles and ASCII alike.
- **Quality of Life.** Its display features move into this mod, as the section above describes, and its gameplay conveniences keep working beside it. The activation shortcut helper and repeated-action shortcuts offer quickbar slots as well as keys.
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
