# Changelog

All notable changes to this mod are recorded here. Versions follow the mod's own `manifest.json`, which is what the game reads, and each released version has a matching git tag that an install pins itself to.

An entry has to matter to somebody running the mod. Documentation wording, internal refactoring and test-only additions are not recorded here. Bug fixes are, however small.

An entry opens with one or more bracketed tags. `[Visible]` marks a change a player would notice in the game or mod itself; `[Internal]` marks one that touches only code, tooling, or a maintainer's own workflow, with nothing for a player to see. A further tag (`[Security]`, `[Balance]`, `[UI]`, `[Modding-API]`, `[Localization]`, `[Save-Compat]`, `[Docs]`, `[Content]`, `[Compatibility]`, and others as they come up) names what kind of change it is. Lists appear in this order and each is omitted when empty for a release: Added, Changed, Removed, Fixed.

## [Unreleased]

### Added

- [Internal] **The mod repository, with a plugin that loads and adds nothing to the screen.** It declares no capabilities and logs one line when the game loads it.
