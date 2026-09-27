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
| Zoom, pan and responsive layout | `anybandui.zoom` | off | Ctrl-= and Ctrl-- make glyphs or tiles bigger or smaller, and the view fits as many whole rows and columns as the window holds. Ctrl-Arrows pan, Ctrl-Wheel zooms the area under the pointer, and a two-finger pinch or swipe zooms or pans on touch. The zoom level is kept for every character. |
| Accessibility: enlarged display | `anybandui.enlargedDisplay` | off | Starts the display at a larger, easier-to-read cell size. It works even with zoom and pan turned off, and does not change your saved zoom. |
| Drag to pan | `anybandui.dragPan` | off | Hold the middle mouse button and drag to move the dungeon view. |
| Follow the character | `anybandui.followPlayer` | off | Keeps the view on your character as you move. Panning away pauses it, and Ctrl+Home brings the view back and starts following again. |
| Keep the target in view | `anybandui.keepTargetInView` | off | While you aim, the view moves so the targeting cursor stays on screen. |
| Centre on a new level | `anybandui.recentreOnFloor` | off | Arriving on a new level centres the view on your character. |
| Hover cards on the map overview | `anybandui.mapHoverCards` | off | Resting the pointer on a cell of the map overview, or holding a finger on it, opens a card with a magnified tile and what you know about that cell: terrain, creature, item, trap or shop. It shows nothing your character has not seen. |
| Hover cards on the dungeon view | `anybandui.dungeonHoverCards` | off | Resting the pointer on a tile of the dungeon view opens a card with what you know about it: the creature or character there with a small health bar, the terrain, and up to five items on the floor. The delay before a card opens is one setting shared with the map overview's cards, 550 ms to start with. |
| Full-level map overview | `anybandui.mapOverview` | off | The (M)ap screen shows every square of the level you know, shrunk to fit, with markers for you, the stairs and the shops, and an outline of what the main view shows. The mouse wheel zooms at the pointer, dragging pans, and Fit floor and Centre on player buttons sit beside the map. |
| Schematic map | `anybandui.mapSchematic` | off | Draws the map overview as flat blocks of colour for walls, doors and floor instead of glyphs or tiles, which is easier to read when the whole level is shrunk. |

## What it needs

`ui:sidebar.replace`, `ui:status.replace`, `ui:messages.replace`, `display:filter`, `ui:panel.mount`, `state:map.read`, and `state:interaction.read`.
