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
| First-encounter alerts | `anybandui.firstEncounter` | off | The first time this character meets a kind of monster, or picks up an artifact, a small card appears in the corner with its name and native depth. A monster's card carries a threat badge: Unique, Deadly (well out of depth), Out of depth, or First sighting. The card never takes the keyboard or blocks a click, and clears itself after a few seconds. Each character keeps its own record. Reported by `Wozar` on r/angband. |
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
| Click to walk | `anybandui.clickToWalk` | off | Left-click a tile in the dungeon view to step there, or to travel there if it is further away. Clicking a creature next to you attacks it, and while you aim, a click picks the target. |
| Tile action menu | `anybandui.dungeonActions` | off | Right-click a tile in the dungeon view for a menu of what you can do there: walk, look, target, pick up, open or close a door, tunnel, disarm a trap, or take the stairs. The game decides which of these the tile allows. While you aim, the menu offers Select tile and Cancel. |
| Gold aiming path | `anybandui.aimPath` | off | While you choose a target, a gold line shows the path your spell or missile would take to the tile under the pointer. The game works the path out itself, so the line stops wherever the shot would. |
| Walking route preview | `anybandui.walkRoutePreview` | off | Draws a gold line along the route you would walk to reach the tile under the pointer, worked out the same way the travel command plans it. |
| Full-level map overview | `anybandui.mapOverview` | off | The (M)ap screen shows every square of the level you know, shrunk to fit, with markers for you, the stairs and the shops, and an outline of what the main view shows. The mouse wheel zooms at the pointer, dragging pans, and Fit floor and Centre on player buttons sit beside the map. |
| Schematic map | `anybandui.mapSchematic` | off | Draws the map overview as flat blocks of colour for walls, doors and floor instead of glyphs or tiles, which is easier to read when the whole level is shrunk. |
| Item panel | `anybandui.itemsLists` | off | Opens a panel with your pack and equipment on separate tabs, a search box, and each item in its game colour. Click an item to select it. |
| TODO-PROSE: Spell panel | `anybandui.spells` | off | Browse carried books and cast or study spells. |
| TODO-PROSE: Quickbar | `anybandui.quickbar` | off | Assign spells and items to number keys with Shift and Ctrl rows. |
| TODO-PROSE: Blast preview | `anybandui.blastPreview` | off | Show the area affected while aiming a blast. |
| TODO-PROSE: Rest dialog | `anybandui.restDialog` | off | Choose a recovery condition or number of turns. |
| Item inspection | `anybandui.itemsInspection` | off | Shows the game's full description of the item you select in the item panel, the same text the Inspect command gives. |
| Equipment comparison | `anybandui.itemsComparison` | off | When you select something you could wear, a table compares your current equipment with the change: speed, armour, to-hit, damage, blows, stats and resistances. Only properties your character knows are counted, and a checkbox also shows the stats that stay the same. |
| Quantity picker | `anybandui.itemsQuantity` | off | When the game asks how many, the item panel offers One, Half and All buttons and a box for any other number. |
| Item choice list | `anybandui.itemsChoice` | off | When the game asks you to pick an item, the item panel lists the choices so you can click one instead of typing its letter. |
| Mark new items | `anybandui.itemsHighlights` | off | Items you have just picked up are marked NEW in the item panel, and a stack that grew shows how many were added, until you click it. |
| Item action buttons | `anybandui.itemsActions` | off | Adds buttons under the selected item for wielding, taking it off, dropping, inscribing and using it. Only the actions the game would accept right now appear. |
| Item rules list | `anybandui.itemsRules` | off | Lists your ignore settings and auto-inscriptions in the item panel, so you can see why an item is hidden or inscribed. Change them through the game's knowledge menus as usual. |

## What it needs

`ui:sidebar.replace`, `ui:status.replace`, `ui:messages.replace`, `display:filter`, `ui:panel.mount`, `state:map.read`, `state:interaction.read`, `state:inventory.read`, `state:player.read`, `input:intent`, and `input:prompt.reply`.
