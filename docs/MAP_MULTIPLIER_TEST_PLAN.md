# Map Multiplier engineering validation

> This is a reproducible acceptance runbook, **not proof that these commands have run**. As of 2026-10-16, the current engineer cannot execute this repository (local Git DNS unavailable; Node 22/npm 10 versus required Node 24/npm 12). See [ENGINEERING_STATUS.md](ENGINEERING_STATUS.md).

## Scope and semantics

The selector expresses **total map area**, not per-axis magnification. For a source map `W×H` and factor `f ∈ {1,2,3,4,5,6}`, the destination is `round(W√f) × round(H√f)`. Actual ratio differs by normal rounding, especially on tiny maps. Packed nearest-neighbor sampling is deterministic. The pathfinding minimap is `ceil(destW/2) × ceil(destH/2)`; shoreline flags are regenerated; passable land excludes impassable tiles. The 1× path preserves exact original packed terrain references.

**Access policy:** experimental factors >1 are selectable in **private, unlisted host lobbies**. Public/matchmade/listed games are forced to 1× server-side. This remains an OpenFrontIO-X-only feature and is not interoperable with an unmodified OpenFront client. The branch must never target the upstream repository.

## First-run environment

Use a clone of **LeviCade/OpenFrontIO-X** and checkout `feature/map-multiplier`, Node 24, npm 12. Start with:

```bash
node --version
npm --version
git remote -v                 # must point only to LeviCade/OpenFrontIO-X for pushing
git rev-parse HEAD
npm ci
npm run typecheck
npm run format:check
npm run lint
npm test -- tests/MapMultiplier.test.ts tests/MapMultiplierIntegration.test.ts tests/MapMultiplierGameplay.test.ts
npm run build-prod
```

**Do not silently fix failures**. Record exact logs/exit codes and corrective commits in DEVLOG and the status table. Confirm existing 1× regression by running unsharded or CI Vitest as well.

## Real 2× gameplay

```bash
npm run dev
```

In a private, unlisted hosted lobby, choose a map with moderate dimensions and select `2×` directly below the map picker. Set a few bots and at least one nation where available. Start the match with 2 players if multiplayer is available; otherwise use the private hosted game with bots. Record source map/destination dimensions, version SHA, machine CPU/GPU/RAM, FPS, startup time, console errors, and exact gameplay observations.

Acceptance includes spawning humans/nations/bots, expanding and conquering, attacks/pathfinding (including coasts), camera and map border, world and minimap alignment, territory/shoreline display, redraw/context loss, no desync among same-version clients, restart/rejoin, save/snapshot/replay, and ability to return to 1× with no stale cache. Repeat for Compact mode and a map with impassable tiles. Test any maps with custom positioned bot tribes.

For maps with visual overlay layers, confirm terrain and layer alignment, texture width, and correct damage masks. Test a low GPU `MAX_TEXTURE_SIZE` or synthetic limited WebGL device; factors exceeding the maximum must fail with an actionable message rather than draw a black map.

## Headless scale/stability benchmarking

The existing full-game simulation benchmark now accepts `--multiplier`. Example:

```bash
for factor in 1 2 3 4 5 6; do
  npm run perf:game -- \
    --map World --multiplier "$factor" --seed multiplier-comparison \
    --bots 100 --nations disabled --ticks 1200 \
    --no-cpu-profile --no-exec-profile --no-gc-profile --no-alloc-profile
done
```

For profiling investigate `--footprint`, `--snapshot-at`, and defaults without `--no-*` options. Run each condition **at least three times on the same machine** and preserve unedited stdout/logs (attach artifacts to PR #1 if useful). For each sample report actual main/mini tile counts, approximate area factor, initialization time, per-tick p50/p95, peak RSS/heap, CPU usage, spawn completion, and outcome. Repeat on a small map and a large one with real GPU rendering; record GPU texture support separately. The 64M-tile scaler allocation guard is not a promise the engine or GPU can handle 64M tiles.

No timing, FPS, memory, or pass/fail values in this runbook are measured results.

## Gate before changing PR #1 from draft

- [ ] All typecheck, unit/integration tests, lint, format, build pass on Node 24/npm 12.
- [ ] Existing unmodified 1× matches behave identically across game types.
- [ ] A **real** 2× match was played and evidenced, including bot/nation/human spawns and pathfinding.
- [ ] Replays/snapshots, Compact map, overlays, public 1× policy, and client sync verified.
- [ ] 3×–6× measurements captured with device specs; unsafe cases disabled or guarded.
- [ ] AGPL-3.0 distribution and proprietary-assets rules reviewed.
- [ ] `docs/ENGINEERING_STATUS.md` and `docs/DEVLOG.md` reflect observed results, not assumptions.
