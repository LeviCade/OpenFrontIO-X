# OpenFrontIO-X agent instructions

You are working in **LeviCade/OpenFrontIO-X**, an independent, open-source experimental build of OpenFront. The immediate project is **Map Multiplier**, not a general game rewrite.

## Mandatory repository safety
- All code changes, branches, issues and pull requests belong **only** to `LeviCade/OpenFrontIO-X`. Never open a pull request to `openfrontio/OpenFrontIO`. Never push to any `upstream` remote.
- **Do not commit implementation straight to `main`.** Continue on `feature/map-multiplier` (or a child branch in this same repository), then use a PR targeting `LeviCade/OpenFrontIO-X:main`.
- Git upstream is for **read-only fetching** of new official OpenFront changes. Update deliberately; never auto-merge and publish untested updates.
- Preserve official licenses, copyright notices and attribution. Code is AGPL-3.0; OpenFront's `proprietary/` assets are restricted. Audit asset usage before distributing independent builds. Do not assume everything in a public repository is redistributable.
- Do not claim benchmarks, tests, gameplay, or compatibility passed unless actually executed.

## Start here
1. Read [docs/ENGINEERING_BRIEF.md](docs/ENGINEERING_BRIEF.md) for requirements, architecture, edge cases and verification.
2. Read [docs/ROADMAP.md](docs/ROADMAP.md) for ordered implementation and acceptance gates.
3. Read [docs/UPSTREAM.md](docs/UPSTREAM.md) for safe update procedures.
4. Maintain [docs/DEVLOG.md](docs/DEVLOG.md) as you work: branch/commit, implementation decisions, test results, obstacles and remaining work.
5. The one-session engineering instructions are in [docs/HANDOFF_PROMPT.md](docs/HANDOFF_PROMPT.md).

## Scope and invariants
- **Area multiplier**, not per-axis multiplier: allowed values **1, 2, 3, 4, 5, 6**. A 6x choice means ~6x as many grid cells, and each axis approximately sqrt(6) times the original.
- Stretch existing terrain via deterministic nearest-neighbor resampling; **higher-resolution geographic data is NOT needed**. Do not replace the original maps.
- 1x must remain behaviorally identical to unmodified OpenFront. Preserve existing Compact/Normal maps.
- All simulation clients and the renderer must use *the same* dimensions, terrain bytes, spawn coordinates and scaling algorithm. Prevent a multiplayer/replay desync; do not activate the feature on unmodified public OpenFront servers.
- Preserve land/water, impassable terrain, terrain magnitudes, oceans, derived shoreline flags, nation spawns and team spawn areas. Test them, do not blindly assume duplicating encoded bytes preserves shoreline topology.
- Favor a small, isolated module and the minimum integration hooks needed. Avoid broad refactoring.
- Treat WebGL texture limits, CPU tick time, array allocations, canvas sizes and serialization as **measured constraints**. Set graceful errors for unsupported cases rather than crashes.
- Implement in reviewable milestones; test after each. No cosmetic UI work before the 2x headless or actual-game geometry baseline.

## Environment (as verified in repository)
- Node >=24.15.0 <25, npm >=12.1.0 <13.
- Install: `npm run inst`. Local game: `npm run dev`.
- Verification: `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, `npm run build-prod`.
- Existing performance harness: `npm run perf:game -- --map world --ticks 1800 --bots 400`; adapt to the multiplier to compare 1x against larger maps and retain deterministic hashes.
- Tests must be meaningful: run them when possible and record exact commands/results. If blocked, write the reason.

## Code landmarks (verified 2026-10-16)
- `packages/shared/src/GameMapLoader.ts`: loads normal/compact map files.
- `packages/engine-api/src/game/MapFiles.ts`: map metadata, manifests, binary-file contract.
- `packages/engine-lib/src/game/TerrainMapLoader.ts`: builds terrain and minimap from binaries.
- `packages/engine-lib/src/game/GameMapImpl.ts`: terrain bits and game-state grid.
- `packages/engine-api/src/Schemas.ts`: authoritative GameConfig schema. Consider backward-compatible optional multiplier with 1x default.
- `src/client/WorkerClient.ts`: sends loaded files into deterministic game worker.
- `src/client/TerrainMapFileLoader.ts`: renderer-side terrain cache; cache key must include multiplier.
- Inspect server-side map loader, lobby UI, renderer, serialization, replay, snapshots, minimaps, nation creation and tests before changing them. These landmarks may move in future upstream versions.
