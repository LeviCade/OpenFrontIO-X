# OpenFrontIO-X development log

This is the long-lived engineering memory for AI agents and human contributors. **For current cross-session status, see [ENGINEERING_STATUS.md](ENGINEERING_STATUS.md), update and PUSH that dashboard after each major checkpoint.**

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

### Cross-session reporting addition
- An engineering checkpoint board now exists at `docs/ENGINEERING_STATUS.md`.
- Future engineers are required to update that board and this detailed dev log after each substantial milestone or new blocker, commit and push before moving to the next phase, and push a final checkpoint even if work remains unfinished.
- The user plans to return in a separate ChatGPT session and ask it to inspect the GitHub repository, PR and status board.

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

## 2026-10-16 19:00 UTC: Engineering session initial checkpoint
- Branch: `feature/map-multiplier`; PR: https://github.com/LeviCade/OpenFrontIO-X/pull/1 (draft, own repo).
- Inspected AGENTS.md, HANDOFF_PROMPT, ENGINEERING_BRIEF, ROADMAP, UPSTREAM, existing status, GameMapLoader, TerrainMapLoader, MapFiles, schema, repo tree.
- Environment commands actually run: `node --version` => `v22.16.0`; `npm --version` => `10.9.2`; `git --version` => `2.47.3`; `git ls-remote https://github.com/LeviCade/OpenFrontIO-X.git refs/heads/feature/map-multiplier` => `fatal: Could not resolve host: github.com`.
- Therefore no local checkout, npm install, typecheck, tests, live browser gameplay, or performance benchmarks are currently available. Do NOT claim these pass.
- Connected GitHub app supports reads/writes; engineering will push via GitHub's contents/Git object APIs, with isolated pure tests where feasible. Next: trace loader dependencies and implement tested scaler.

## 2026-10-16 19:01 UTC: Deterministic scaler and first integration pushed
- Branch: `feature/map-multiplier`; PR #1 remains draft in LeviCade/OpenFrontIO-X.
- Implementation commits: [b6714d7](https://github.com/LeviCade/OpenFrontIO-X/commit/b6714d71f5a136c874df06f08af5e4682334527d) creates `MapMultiplier.ts`; [dda8375](https://github.com/LeviCade/OpenFrontIO-X/commit/dda8375751c4bf85a03a0789f6be51b6b70cb5d7) creates `MapMultiplier.test.ts`; [554ec76](https://github.com/LeviCade/OpenFrontIO-X/commit/554ec7627bbc9b25f8bd4970d380cbacc6790ca6) integrates terrain+mini+coordinates; [35f4ba6](https://github.com/LeviCade/OpenFrontIO-X/commit/35f4ba60084836bcbac248f7493bf979a93970e4) adds optional wire schema; [cbcb3fb](https://github.com/LeviCade/OpenFrontIO-X/commit/cbcb3fbe3c5925b5a5bcbe097df3e6c844b09aee) passes config into game runner; [d3bf4a2](https://github.com/LeviCade/OpenFrontIO-X/commit/d3bf4a277ab5f13147eb534b5161d92583b18961) keys preloads by map/size/factor; [acd5ad2](https://github.com/LeviCade/OpenFrontIO-X/commit/acd5ad27078acd7ac30b97498c1ec9c58073d90c) selector; [228ec17](https://github.com/LeviCade/OpenFrontIO-X/commit/228ec17da3e91694a2e76eefbf076efd532d029b) host config.
- Algorithm: output axis lengths `round(sourceAxis * sqrt(areaFactor))`, deterministic nearest neighbor using `floor(destIndex*sourceAxis/destAxis)`. Preserves land/ocean/magnitude bits, recalculates four-neighbor shoreline flags (per Go generator `processShore`), counts passable land (excluding magnitude 31). Rebuilds half-resolution mini with `ceil(mainAxis/2)` to satisfy `MiniMapTransformer` hard-coded /2 transform.
- Legacy: factor omitted => 1; `loadTerrainMap(files)` retains old same-reference behavior for 1. Factor greater than 1 clones nation metadata before Compact coordinate adjustment. Renderer and worker separately derive from source map using same function.
- Tested so far: source inspection and GitHub remote writes. **NO executable tests, typecheck, dev/gameplay, GPU or benchmark runs**. Node/npm versions wrong; Git clone blocked DNS; GitHub Actions query returned zero feature-branch workflows as of 19:01 UTC.
- Remaining high risks: renderer full-size GPU textures, public/ranked enforcement, nation spawn accuracy, compact tests, hidden serialization concerns and gameplay performance.
