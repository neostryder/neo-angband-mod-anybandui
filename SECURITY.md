# Security Policy

## Scope

This repository owns the AnybandUI plugin, its capability declarations, its view model of game state, the panels, regions and effects it draws, and the commands it issues on the player's behalf.

A vulnerability in those components belongs to `neo-angband-mod-anybandui`.

The core `neo-angband` repository owns mod loading, capability enforcement, the UI seams and input door, the shared agent API, archive handling, and the general mod trust model. A vulnerability in those components belongs to core. See the [core security policy](https://github.com/neostryder/neo-angband/blob/master/SECURITY.md).

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability.

Send a private report to **strider-angband (at) rpgm.tools**. Identify `neo-angband-mod-anybandui`, the affected tag or commit, the relevant capability or panel, reproduction steps, and the expected impact.

Reports about ordinary gameplay behavior that has no security impact belong in the public issue tracker.
