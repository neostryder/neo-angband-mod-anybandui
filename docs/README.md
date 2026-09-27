# AnybandUI: quick reference

A mouse-first desktop interface for Neo Angband, ported from Wurli Monkhaven's AnybandUI. The [repository README](../README.md) describes the planned features, and [PLANNED.md](../PLANNED.md) holds the order they arrive in.

## Settings

| Setting | Identifier | Default | Description |
| --- | --- | --- | --- |
| Character card | `anybandui.sidebar` | off | Replaces the character column with a card: your name, race and class, bars for hit points, spell points, food and experience, your stats, gold, armour and speed, and a health bar for the creature you are tracking. Hover a bar or stat to see its numbers. |
| Status badges and dungeon card | `anybandui.status` | off | Replaces the status line with a badge for each timed effect, coloured by whether it helps or harms you, and a card showing depth, light, the level feeling and the terrain underfoot. Hover a badge to see how many turns it has left. |
| Message log | `anybandui.messages` | off | Replaces the message line with a scrolling log. Repeated messages fold into one line with a count, and a search box finds an older message. |

## What it needs

`ui:sidebar.replace`, `ui:status.replace`, and `ui:messages.replace`.
