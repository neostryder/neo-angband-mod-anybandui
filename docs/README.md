# AnybandUI: quick reference

A mouse-first desktop interface for Neo Angband, ported from Wurli Monkhaven's AnybandUI. The [repository README](../README.md) describes the planned features, and [PLANNED.md](../PLANNED.md) holds the order they arrive in.

## Settings

| Setting | Identifier | Default | Description |
| --- | --- | --- | --- |
| Character card | `anybandui.sidebar` | off | Replaces the character column with a card: your name, race and class, bars for hit points, spell points, food and experience, your stats, gold, armour and speed, and a health bar for the creature you are tracking. Hover a bar or stat to see its numbers. |
| Status badges and dungeon card | `anybandui.status` | off | Replaces the status line with a badge for each timed effect, coloured by whether it helps or harms you, and a card showing depth, light, the level feeling and the terrain underfoot. Hover a badge to see how many turns it has left. |
| Message log | `anybandui.messages` | off | Replaces the message line with a scrolling log. Repeated messages fold into one line with a count, and a search box finds an older message. |
| Accessibility: high-contrast display | `anybandui.highContrast` | off | Boosts contrast and colour separation over each finished frame, in text mode and with tiles, across the dungeon, maps, menus and this mod's panels. |
| Accessibility: colourblind correction | `anybandui.colourblind` | off | Applies a red-green colour correction over each finished frame, in text mode and with tiles, across the dungeon, maps, menus and this mod's panels. |
| First-encounter alerts | `anybandui.firstEncounter` | off | The first time this character meets a kind of monster, or picks up an artifact, a small card appears in the corner with its name and native depth. A monster's card carries a threat badge: Unique, Deadly (well out of depth), Out of depth, or First sighting. The card never takes the keyboard or blocks a click, and clears itself after a few seconds. Each character keeps its own record. |
| Itemize the quiver in the Inventory subwindow | `anybandui.quiverItemization` | off | The Inventory subwindow lists each stack of ammunition or thrown weapons in your quiver by name, under a --Quiver-- heading, instead of a count such as "in Quiver: 7 missiles". |
| Sharpen shrunken tiles | `anybandui.crispTiles` | off | Draws graphics tiles with crisp pixel edges when they are shrunk, instead of the smoothed default. Pixel-art tilesets often look sharper this way at small zoom levels. |

## What it needs

`ui:sidebar.replace`, `ui:status.replace`, `ui:messages.replace`, `display:filter`, and `ui:panel.mount`.
