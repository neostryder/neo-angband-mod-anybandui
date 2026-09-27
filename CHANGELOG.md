# Changelog

All notable changes to this mod are recorded here. Versions follow the mod's own `manifest.json`, which is what the game reads, and each released version has a matching git tag that an install pins itself to.

An entry has to matter to somebody running the mod. Documentation wording, internal refactoring and test-only additions are not recorded here. Bug fixes are, however small.

An entry opens with one or more bracketed tags. `[Visible]` marks a change a player would notice in the game or mod itself; `[Internal]` marks one that touches only code, tooling, or a maintainer's own workflow, with nothing for a player to see. A further tag (`[Security]`, `[Balance]`, `[UI]`, `[Modding-API]`, `[Localization]`, `[Save-Compat]`, `[Docs]`, `[Content]`, `[Compatibility]`, and others as they come up) names what kind of change it is. Lists appear in this order and each is omitted when empty for a release: Added, Changed, Removed, Fixed.

## [Unreleased]

### Added

- [Visible] [UI] **High-contrast and colourblind displays, first-encounter alerts, an itemized quiver and sharper shrunken tiles, brought over from Quality of Life.** Each has its own switch and starts off. The two display filters also cover this mod's panels.
- [Visible] [UI] **Panels for the character column, the status line and the message line.** Each has its own switch on the Mods screen and starts off. The character card shows bars for hit points, spell points, food and experience beside your stats, gold, armour and speed. The status panel shows a badge for each timed effect and a card for the current level, and the message log folds repeated messages and can be searched.
- [Internal] **The mod repository, with a plugin that loads and adds nothing to the screen.** It declares no capabilities and logs one line when the game loads it.
