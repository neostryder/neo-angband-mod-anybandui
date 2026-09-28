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
