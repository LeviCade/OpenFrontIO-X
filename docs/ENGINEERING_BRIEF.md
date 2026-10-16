# Map Multiplier: engineering specification

**Repo:** LeviCade/OpenFrontIO-X (independent of official OpenFront)
**Development branch:** feature/map-multiplier
**Owner's goal:** one optional control to enlarge **playable map area** in existing OpenFront maps. No new geography, no texture-enhancement project and no wholesale game rewrite.
**Target values:** 1x, 2x, 3x, 4x, 5x, 6x. Values 7x-10x are explicitly deferred.

## Product behavior

A map-selection UI exposes **Map Multiplier: 1x | 2x | 3x | 4x | 5x | 6x**, defaulting to **1x**. It affects the selected map's playable tile count, not its real-world geographic extents. Existing shapes are stretched into more grid cells. 1x has no scaling/compatibility/regression cost.

**Important math:** For source dimensions W,H and area factor F, take axis multiplier approximately \`sqrt(F)\`. Deterministically round dimensions to integer grid cells (e.g., \`max(1, round(W*sqrt(F)))\` and matching H). Actual area is therefore approximately, not exactly, F times original. Document exact rounding and use the same algorithm everywhere. Verify bounds for every map. Do not interpret 6x area as 6x width and 6x height (that would be 36x area).

Illustrative baseline from Giant World manifest (as inspected 2026-10-16):
- 1x: 4108 x 1948 = 8,002,384 cells
- 2x: approximately 16 million cells
- 6x: approximately 48 million cells
Other maps have different dimensions; the feature should be generic.

## Verified code path

- \`packages/shared/src/GameMapLoader.ts\`: \`loadMapFiles()\` prepares normal map.bin/map4x.bin or compact map4x.bin/map16x.bin.
- \`packages/engine-api/src/game/MapFiles.ts\`: \`MapFiles\` and \`MapManifest\` definitions.
- \`packages/engine-lib/src/game/TerrainMapLoader.ts\`: \`loadTerrainMap()\` and \`genTerrainFromBin()\` expect length = width * height; creates main map and miniMap; transforms spawn points for Compact.
- \`packages/engine-lib/src/game/GameMapImpl.ts\`: Uint8Array for immutable-ish terrain, Uint16Array for ownership/state, Int32Array row offsets. Terrain byte bits: land bit 7, shoreline bit 6, ocean bit 5, lower five bits magnitude (31 on land is impassable).
- \`packages/engine-api/src/Schemas.ts\`: \`GameConfigSchema\` includes gameMapSize; match/replay compatibility must be designed.
- \`src/client/WorkerClient.ts\`: receives GameStartInfo, loads map and transfers buffers to worker.
- \`src/client/TerrainMapFileLoader.ts\`: \`loadCachedTerrainMap()\` cache key currently uses map and mapSize only; multiplier must participate in all relevant cache keys.
- \`tests/perf/fullgame/FullGamePerf.ts\`: real deterministic simulation performance harness.

Do not implement by enlarging only the browser image. Simulation occupancy, spawn, pathfinding and rendering must all see identical enlarged terrain.

## Design constraints / engineering decisions to resolve

1. **Canonical scaling point.** Prefer one reusable pure scaler processing source bin+metadata into consistent scaled bin+metadata. Ensure headless engine, server, worker and client renderer use the same transformed input. Trace all terrain-loading entry points first.
2. **Nearest-neighbor grid sampling.** Preserve type bits and magnitudes. Recompute or validate flags tied to adjacency (shoreline) and ocean/lake distinction. Carefully distinguish source water, ocean reachability and derived shorelines. Avoid enormous JS arrays of per-cell objects; allocate typed arrays and process rows in chunks.
3. **Metadata and coordinates.** Clone rather than mutate cached source manifest. Transform nation coordinates, additional nation coordinates, team spawn rectangles and \`num_land_tiles\` using actual transformed cells. Do not double-scale Compact coordinates; pay attention to gameMapSize's existing /2 transform.
4. **Minimap.** Preserve proportional size/performance. Do not needlessly create a second full enlarged map as the miniMap. Correct world-coordinate-to-minimap math is mandatory. Check any optional visual layer assets for alignment or disable unsupported layers explicitly with an informative fallback.
5. **Game configuration.** Represent multiplier as validated numeric value 1..6 in authoritative config. Favor defaulting missing/older config to 1x for replay/legacy compatibility. Examine zod/zbin, matchmaking, serialization, snapshots, share links and lobby config propagation; the safest exact migration is determined by tests.
6. **Determinism and networking.** The choice is game-wide/host-authoritative, not a local graphic preference. Public/ranked matchmaking against unmodified upstream remains 1x; higher values should be available only on local/OpenFrontIO-X-compatible servers until dedicated multiplayer verification.
7. **Renderer limits.** Audit WebGL MAX_TEXTURE_SIZE on real client; look for full-map textures, render targets and temporary allocations; detect dimensions that exceed limits and implement chunking/tile rendering or a safe compatibility guard when necessary. The shape can exceed limits on large map/large factor combinations, even if 6x Giant World is nominally around 10k wide. Avoid claiming hardware passes without testing.
8. **Resource scaling.** Remember various mechanics may rely on tile counts, dimensions or distances (speed, range, blast radius, building size, victory conditions, balancing). Decide which scale naturally with an enlarged grid; record deliberate gameplay changes rather than silently altering behavior. Original 1x must remain identical.
9. **Failure handling.** Check memory/array/index bounds before allocating; handle allocation failures without an infinite loading spinner. Support cancellation or loading progress where practical.
10. **Upstream resilience.** Isolate scaler under engine-lib or an appropriately shared package, expose a narrow API, add tests proving behavior, and keep integration diffs small.

## Verification matrix

| Suite | Must pass |
| --- | --- |
| Source grid | 1x bit-for-bit identity, original map files never overwritten; deterministic non-integer axis scaling |
| Terrain | land/water/impassable/magnitude; coast adjacency; ocean versus lakes; exact land count |
| Spawn | every nation spawn and team area valid on both normal and compact |
| Minimap/layers | terrain, click positions, viewport, overlays, optional layers remain aligned |
| Simulation | bots spawn, expand, move, fight; win condition completes with fixed seed |
| UI | all factors 1..6, default 1, persistence in match settings without mismatch |
| Serialization | config, snapshot restore, replay, client/worker/server agree |
| Safety | unsupported maps/hardware fail gracefully; official upstream not changed |
| Performance | 1x/2x/3x/4x/5x/6x load time, peak process memory, p50/p95 tick, FPS at representative zooms |

**Performance:** Compare on the same hardware/map/seed/bot count. Record actual measurements in DEVLOG. 2x starts as a small-map test, then Giant World after budget verification. Gradually advance 3x..6x; do not call a multiplier supported until it passes acceptance.

## Local commands

\`\`\`bash
git clone https://github.com/LeviCade/OpenFrontIO-X.git
cd OpenFrontIO-X
git switch feature/map-multiplier
node -v
npm -v
npm run inst
npm run typecheck
npm test
npm run dev
\`\`\`

Use Node 24.15.x+ (<25) and npm 12.1.x+ (<13). \`npm run inst\` uses pinned lockfile; don't casually update upstream dependencies. No CI/test/run claims are made by this document.

## License & release

Source is AGPL-3.0. Open map/resources assets have separate terms (CC BY-SA 4.0); \`proprietary/\` contains separately restricted assets. Independently hosting and distributing OpenFrontIO-X needs a deliberate asset review and appropriate attribution, branding, notices and legal compliance. Do not assume the proprietary assets are redistributable because they were present in the source clone.
