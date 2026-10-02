# AnybandUI commits

The [AnybandUI](https://github.com/WurliMonkhaven/AnybandUI) `deluxe` commits this mod has been checked against. A sync pass lists the commits after the last row with `git log --reverse <last>..origin/deluxe` and adds one row for each.

Status is one of: ported (with the commit here that carries it), not applicable (engine-side or specific to the native build), or pending.

## Baseline

The port plan in [PLANNED.md](PLANNED.md) was drawn from `deluxe` at `6b598dca0` (2026-09-26), the commit that made AnybandUI a standalone frontend. Every feature at that commit is pending.

## Commits after the baseline

| Commit | Date | Summary | Status |
| --- | --- | --- | --- |
| ab5a2c481 | 2026-09-27 | Tweaks before release | ported (9ffea5c): the dungeon card's dash for an unknown level feeling. The docking guide row, the Windows packaging script and the layout tests are native-only: not applicable. |
| ddf05117b | 2026-09-27 | Magic items glow when unidentified | ported (9ffea5c) as an opt-in switch, Glow shows hidden magic, because the glow then shows what the character has not identified. The knowledge-based glow stays the default. |
| 33669ffef | 2026-09-28 | Angband adapter changes | not applicable: it deletes the native readiness script and protocol/check_engine.py. Phase 10 in PLANNED.md now names the engine checks in the protocol readme instead (e757df1). |
| c5240cf64 | 2026-09-29 | Docs updates | not applicable: native docs. The reference engine now lives in the AnybandUI-AngbandAdapter repository. |
| 128e79bd4 | 2026-09-29 | Carving out more dead files | not applicable: it deletes old design documents, including docs/anybandui-specification.md. The specs extracted into .port-notes in the upstream clone keep what the port used. |
| 3f6bfc8d2 | 2026-09-29 | Reorganized folder structure | not applicable: the native build and release scripts move into tools/. |
| 3502ca50b | 2026-09-29 | Cut sound feature. Anyband protocol | ported (e757df1): the profile string full-v1 becomes anyband-protocol and the contract file becomes protocol/anyband-protocol.json, and the port now names the protocol to match. The audio.events capability and the six sound files are gone, so sound is out of the port's plans too. No payload field changed and the adapter stays as it was. The logo under docs/branding is upstream branding and not applicable. |
| 33374b335 | 2026-09-29 | Bugfix for Linux | not applicable: a compiler fix in the native tileset table. |
| 58105434e | 2026-09-30 | Doc and build update | not applicable: the reference adapter builds against a pinned Angband 4.2.6-anybandui branch. |
| e7dd1a22c | 2026-10-01 | New cleaner releases | not applicable: the native release zips leave out development files. |
