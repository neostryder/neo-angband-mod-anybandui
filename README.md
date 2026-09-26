# AnybandUI for Neo Angband

A mouse-first desktop interface for [Neo Angband](https://github.com/neostryder/neo-angband), ported from [AnybandUI](https://github.com/WurliMonkhaven/AnybandUI), the Angband frontend by Wurli Monkhaven.

AnybandUI started as a native Windows frontend for vanilla Angband, aimed at people who have never played a game in a terminal. It gives the game panels you can dock anywhere, a quickbar on the number keys like the one in World of Warcraft, tooltips on everything, an equipment comparison table, a store window with your pack beside the stock, a spell table with aim previews, and optional CRT and dungeon effects. This mod brings that interface to Neo Angband, where it runs in the browser and the desktop app alike.

## Status

Version 0.1.0 sets up the mod and adds nothing to the screen. Enabling it logs one line and changes nothing else. [PLANNED.md](PLANNED.md) lays out the port phase by phase, and each phase lands as a release you can switch on.

## What it changes, and what it leaves alone

AnybandUI changes how the game looks and how you reach its commands. It does not change the rules: every roll, price, knowledge check and save file stays the game's own, and every panel reads the state the game already shows you. Every command stays reachable from the keyboard with its usual key. Turn the mod off and the standard interface comes back unchanged.

The effects (CRT scanlines, item glows, sleeping-monster marks, the presence haze around uniques) are each a separate setting, and each can be turned down or off.

## Planned features

| Area | What you get |
| --- | --- |
| Layout | Dock, tab, resize, float and hide panels, with an edit mode, undo, saved layouts, and pop-out windows on the desktop app. |
| Status | A character card with HP, SP, food and XP bars, stats, gold, armour and speed. A dungeon card shows depth, light, the level feeling and the terrain underfoot, and status badges explain themselves on hover. |
| Map | Hover a tile for what you know about it, click to walk or attack, right-click for a context menu, and a path line while aiming. |
| Quickbar | Ten slots on the number keys for spells, potions, scrolls and activations, with mana cost and charges on each slot. |
| Items | Searchable pack, equipment and quiver lists, an inspection window with collapsible sections, and a comparison table showing what changes when you swap a piece of gear. |
| Stores | Store stock and your pack side by side, with prices and the comparison table for anything wearable. |
| Spells | Every book's spells with mana, fail rate and status in one table, cast or study with a click, and a blast footprint preview while aiming. |
| Effects | CRT screen treatment, low-health glitching, glows on artifacts, runes and cursed items, rising z marks over sleeping monsters, and a haze around uniques. |
| Menus | A main menu with save cards, a step-by-step character creation wizard, a knowledge browser with search, and a settings window with presets and themes. |

## Installing

AnybandUI is not on the in-game mod list yet. It joins the list with its first release that adds something to the screen.

## Working on it

The repository root is the mod folder. `manifest.json` and `plugin.js` are what the game fetches, and `plugin.js` is built from `plugin.ts` and `src/` by `pnpm build`.

Run `pnpm install`, then `pnpm verify`, which typechecks, runs the tests, and fails if the committed `plugin.js` is older than its source.

Contributions arrive as pull requests from a fork, including from the co-authors. Open an issue first for anything larger than a fix, so the work lines up with a phase in [PLANNED.md](PLANNED.md). Issues filed here are moved to the [main Neo Angband tracker](https://github.com/neostryder/neo-angband/issues) under the `repo:mod-anybandui` label, where every mod's issues live.

## Releasing

Each release bumps `manifest.json` and `package.json` together, dates its section in `CHANGELOG.md`, and is tagged `vX.Y.Z` on `master`. The tag is what an install pins itself to.

## Licence

GPL version 2. See [LICENSE.md](LICENSE.md).

## Credits

Created by **Wurli Monkhaven** ([WurliMonkhaven](https://github.com/WurliMonkhaven)), whose AnybandUI design, layout and effects this mod ports, and **neostryder**, who maintains Neo Angband. The full list is in [CREDITS.md](CREDITS.md).
