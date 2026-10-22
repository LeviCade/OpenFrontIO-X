# Giant World 10× and optional 11×–20× — engineering stage 1

**October 22, 2026. Status: Stage 1 implemented on draft PR #4; full Giant World 10× and 20× are NOT yet playable/approved.** This branch is stacked on draft PR #3 and must not be merged into it until the stage gates below pass.

## Scope and exact meaning

Multipliers are **total land+ocean map area** multipliers, not 10× each linear dimension. Each axis scales by approximately sqrt(multiplier). 10× means ~3.162× width and ~3.162× height. The nearest-neighbor terrain algorithm preserves every logical target tile but **does not invent new geographic detail**.

Stage 1 adds an explicitly separated second UI row, 11×–20×, and corresponding 1..20 types, Zod schema and deterministic map generation. **Smaller eligible maps can use these values.** No existing CPU tile cap or unimplemented GPU tiling dependency is silently removed.

## Source-grounded Giant World Normal dimensions

Baseline manifest: 4,108 × 1,948 = 8,002,384 logical tiles.

| Area | Width × height | Logical tiles | Current engine 64.1m-tile limit |
| --- | --- | ---: | --- |
| 1× | 4,108 × 1,948 | 8,002,384 | Within cap |
| 8× | 11,619 × 5,510 | 64,020,690 | Within cap (not verified GPU-safe) |
| 9× | 12,324 × 5,844 | 72,021,456 | BLOCKED |
| **10×** | **12,991 × 6,160** | **80,024,560** | **BLOCKED** |
| 11× | 13,625 × 6,461 | 88,031,125 | BLOCKED |
| **20×** | **18,372 × 8,712** | **160,056,864** | **BLOCKED** |

Numbers use the actual `Math.round(sourceAxis * Math.sqrt(multiplier))` algorithm. Test them with `tests/ExtendedMapFeasibility.test.ts`.

## Actual per-cell lower-bound memory ledger

A source audit reveals these **direct, separate full-map allocations**:

| Component | Format | Bytes per logical cell |
| --- | --- | ---: |
| `GameMapImpl.terrain` | `Uint8Array` | 1 |
| `GameMapImpl.state` | `Uint16Array` | 2 |
| `GpuResources.tileTex` | GPU `R16UI` | 2 |
| `GpuResources.trailTex` | GPU `R16UI` | 2 |
| `GpuResources.heatTexA + heatTexB` | two GPU `R8` | 2 |
| `TerrainPass.tex` | GPU `RGBA8` | 4 |
| `BorderComputePass.borderTex` | GPU `RGBA8` | 4 |
| `DefenseCoveragePass.coverageTex` | GPU `R8` | 1 |
| **Combined minimum** | **3 CPU + 15 GPU bytes** | **18** |

For **10×**, the core CPU floor is **240,073,680 bytes** (~229 MiB); core GPU floor is **1,200,368,400 bytes** (~1.12 GiB); total **1,440,442,080 bytes** (~1.34 GiB). For **20×**, that doubles to ~2.68 GiB combined. These counts are **not** observed RAM/VRAM measurements and do **not** include hundreds of MB of additional runtime textures, duplicated worker/client states, terrain baking scratch buffers, minimaps, bloom render targets, borders, map layers, replay keyframes, GPU driver padding, transient allocations or browser process overhead. The feasibility estimator is intentionally a **lower bound**, never a recommendation to run a map.

### Dimension constraints versus memory constraints

- A single texture cannot exceed the *actual* hardware `MAX_TEXTURE_SIZE` on either axis.
- At `MAX_TEXTURE_SIZE=8192`, even 8× Giant World's 11,619-wide full-map textures exceed the cap.
- At `MAX_TEXTURE_SIZE=16384`, the 10× width 12,991 fits an individual dimension, **but** the per-cell memory burden remains huge. 20× width 18,372 still exceeds that GPU dimension.
- `TextureChunkPlan.ts` presently plans halo-aware regions but is **NOT wired** into any live `GPURenderer` pass, texture upload, or shader. A hypothetical 4,096 texture-size GPU partitions 10× into 4×2 chunks; the plan alone cannot render a single pixel.
- Do not naively allocate *all* 15-bytes/cell textures in chunks and call it solved: the **aggregate** GPU byte cost remains roughly the same unless textures are virtualized/cached at visible resolution.

## Phase 2: full-quality true 10× Giant World renderer

Implement a genuinely streaming/tiled renderer, in an isolated follow-on branch/commit series:

1. **Measure first:** trace actual 1×/6×/8× Giant World creation, peak RSS/heap, GPU texture allocations, `MAX_TEXTURE_SIZE`, CPU tick p50/p95/p99, FPS/frame p95 and worker messages on the owner's physical Mac. Existing CI's 10× Pangaea test proves **only Pangaea, 64 ticks**.
2. **GPU virtual terrain atlas:** break `R16UI` ownership, trail, two heat buffers, RGBA terrain, RGBA borders and defense masks into aligned chunks with halos and coherent cross-chunk neighbors. Restrict resident GPU chunk set by viewport + safety margin and measured GPU budget. Never leave map logical-resolution state unaddressable.
3. **Render passes:** refactor `TerritoryPass`, `TerrainPass`, `BorderComputePass`, `BorderScatterPass`, `DefenseCoveragePass`, `TrailPass`, minimap, hit-testing, shaders and context-restore to use absolute logical tile refs/coords and chunk-local textures. Test city selection, troop boundaries, rivers/coasts, water nukes, border thickening and seek/replay across every seam.
4. **Streaming upload + lifecycle:** retire/rebuild off-screen tiles lazily, coalesce dirty ranges per chunk, cap in-flight upload bytes/frame, provide cancellation and recovery from GPU context loss without resetting simulation or replay.
5. **CPU and pathfinder memory:** profile `GameMapImpl`, minimap, terrain resampling, pathfinding caches, nation spawns and full-map replay keyframes at 80m/160m. Remove avoidable worker/client duplication and monolithic temporary buffers without changing gameplay determinism or tile precision. Consider streaming terrain row generation and sparse or tiled replay snapshots where applicable.
6. **Better visual detail:** nearest-neighbor resampling gives more gameplay tiles but pixelated/coarsely replicated geography. Source richer terrain or deterministic coast/path interpolation, while preserving nation positions, impassable flags and replay hashes. Visual antialiasing alone is not new geography.
7. **Hardware gates:** query physical WebGL limits and budget/benchmark headroom; fail closed with readable warning for GPU/heap pressure; maintain default 1× and do not expose unsafe selections in public lobbies. Protect the original PR3 replay experience.

## Required acceptance before enabling 10× and 20× on Giant World

- Full Solo start/spawn, active bots and pathfinding for a sustained game (not 64 ticks); meaningful victory and **Keep Playing** recording, exit/reopen, deterministic hash playback and no corrupt borders.
- Measured GPU scene, layer, border, terrain and minimap rendering on physical Mac (M2 Max 96 GB available for testing), plus a lower-end hardware tier or clear hardware compatibility policy; no black textures or seams.
- Stress: panning across seams, 1×/10×/20×, view-state changes, graphical options, water nukes, border changes, tab background/restore, replay scrubbing, context loss/recovery, OOM fail-closed.
- Budget/report real peak CPU RSS, browser process/GPU memory where measurable, FPS/frame-time, p95 tick time, startup time, GC behavior, draw calls, uploaded bytes and GPU limit. Targets are chosen from baseline performance measurements, not assumed.
- **Only after tests** propose raising `MAX_MULTIPLIED_MAP_TILES` from 64.1m to ≥80,024,560 for Giant World 10× and ≥160,056,864 for Giant World 20×, guarded by device capability/profile. Do not lift unconditionally.
- CI tests for exact map geometry, halo stitching, deterministic tile-coordinate mapping, shader correctness, engine/replay, and GPU-accelerated Chromium where available.

## Current changes and compatibility

- `packages/engine-lib/src/game/MapMultiplier.ts`: 1–20 area choices; unchanged 64.1m cap and source-protecting coordinate scaling.
- `packages/engine-api/src/Schemas.ts`: accept numeric literals 1–20; old missing multiplier still means 1×.
- `src/client/components/GameConfigSettings.ts`: explicit separate rows; the advanced row is an *experimental choice*, not a guarantee a given map/hardware is safe.
- `src/client/SinglePlayerModal.ts`: unchanged pre-start cap check rejects over-budget attempts with a readable alert.
- `packages/engine-lib/src/game/ExtendedMapFeasibility.ts`: pure memory/texture estimate from checked source formats; **not** runtime allocation permission.
- `tests/MapMultiplier.test.ts`, `tests/MapMultiplierIntegration.test.ts`, `tests/ExtendedMapFeasibility.test.ts`: 20× deterministic small-map tests, Zod acceptance and big-map cap/planner regression.

No existing replay journal or IndexedDB layout changed. No migration. PR #1/#2/#3, `main`, official upstream, and the owner's original Mac worktree remain untouched.
