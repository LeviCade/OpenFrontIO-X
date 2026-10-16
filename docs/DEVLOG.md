# OpenFrontIO-X development log

This is the long-lived engineering memory for AI agents and human contributors.

## 2026-10-16: Engineering preparation

**Project:** Map Multiplier (area values 1x-6x).
**Repository:** https://github.com/LeviCade/OpenFrontIO-X
**Branch:** `feature/map-multiplier`
**Status:** scaffolding / no map multiplier implementation, runtime proof, CI pass or benchmark yet.

### Verified source observations
- Map loading is centralized in `packages/shared/src/GameMapLoader.ts` and `packages/engine-lib/src/game/TerrainMapLoader.ts`.
- `packages/engine-lib/src/game/GameMapImpl.ts` uses packed 8-bit terrain (land/shore/ocean/magnitude) and 16-bit owner/state.
- `packages/engine-api/src/Schemas.ts` contains GameConfig schema.
- `src/client/WorkerClient.ts` sends map files to the game worker.
- `src/client/TerrainMapFileLoader.ts` currently caches by map and map size.
- `tests/perf/fullgame/FullGamePerf.ts` supplies a deterministic headless performance harness.
- The checked-in `package.json` requires Node 24.15.0+ <25 and npm 12.1.0+ <13.

### Decisions
- Keep the project independent; any PRs target only this repo.
- Expand area, not geographic detail; deterministic nearest-neighbor in-memory scaling.
- Do not modify original map binaries.
- Include normal and compact modes; 1x remains existing OpenFront behavior.
- Start with 2x headless + small-map gameplay, then implement UI and 3x-6x with safeguards.
- Preserve AGPL attribution, review proprietary asset restrictions before distribution.

### Next
1. Record pristine local build/test/game behavior.
2. Inspect client/server/worker/render/render-cache/serialization end-to-end.
3. Implement and test the pure scaler on a small synthetic map.
4. Verify 2x live gameplay and measure performance.
5. Continue to selector, 3x-6x and compatibility.


### GitHub preparation results
- Branch `feature/map-multiplier` created from `main`.
- Draft pull request created **inside our own repository**: https://github.com/LeviCade/OpenFrontIO-X/pull/1 (head `feature/map-multiplier`, base `main`).
- GitHub Issues API returned HTTP 410 (`Issues has been disabled in this repository`). Until enabled, use ROADMAP checkboxes and draft PR for tracking.
- Documentation created and verified accessible on development branch; original `main` not intentionally modified.
- No runtime build, test, browser gameplay, benchmark or CI-success claim has been verified during scaffold preparation. Initial engineering session must execute those checks.

### Append future entries using this template

```
## YYYY-MM-DD: <short change>
- Branch/commit/PR:
- What changed (exact paths):
- Decisions and rationale:
- Commands run / PASS-FAIL / runtime:
- Measurements (map, factor, device, bots, FPS, p95 tick, peak memory):
- Bugs, blockers and reproduction:
- Next concrete steps:
```
