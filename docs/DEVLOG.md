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

## 2026-10-16 19:13 UTC: Final implementation and audit report (UNVERIFIED CODE)

### Additional pushes since 19:01 checkpoint
- [`b00194f`](https://github.com/LeviCade/OpenFrontIO-X/commit/b00194f77afc87b87ab7a271b43be8c855cb5d98): force 1× on update for GameType.Public and listed games, and on setListed(true).
- [`5065920`](https://github.com/LeviCade/OpenFrontIO-X/commit/5065920f2abfdcde7fdab0eefb6b443b8e72e819): enforce public 1× on initial game creation too (before any host patch).
- [`98497c7`](https://github.com/LeviCade/OpenFrontIO-X/commit/98497c71ba9dcafc6abecf75fc88b407249a831a): synthetic terrain-loader tests, Normal and Compact, 2× land/shore, nation/team spawn coords, schema 1..6 and legacy absent factor. Not run.
- [`9ef1388`](https://github.com/LeviCade/OpenFrontIO-X/commit/9ef1388fd86031b63c2bc8cd46f13cb50d0cec17): headless actual GameRunner smoke test constructs 64×64 source → 91×91 2×, mini46×46, 4 bot spawns, executes 24 turns, checks callback/ticks. Not run; NOT gameplay proof.
- [`d88f45f`](https://github.com/LeviCade/OpenFrontIO-X/commit/d88f45f26aca9cb8cb4d12141948205998c5640e): added --multiplier CLI argument to fullgame perf harness; NOT MEASURED.
- [`d3e46d3`](https://github.com/LeviCade/OpenFrontIO-X/commit/d3e46d376c2e6354c613d7e0de8f4e16621dc9ac): reject maps over GPU MAX_TEXTURE_SIZE when factor>1 before texture allocation. Not browser-tested.
- [`b2a430a`](https://github.com/LeviCade/OpenFrontIO-X/commit/b2a430a097c12e78999f84767ecfecb3c6263e5e): repair positioned tribe coords for scaled grids; original 1× logic preserved. Maps.gen source table uses 1× world coordinates; game width/height invert scale via round(D/sqrt(f)).
- [`121473d`](https://github.com/LeviCade/OpenFrontIO-X/commit/121473dd1cecb450bbb135b22512e78fff5a6f09): remove per-tile closure in coast adjacency loop; reduces unnecessary allocation pressure (performance benefit plausible, NOT benchmarked).
- [`8c71a58`](https://github.com/LeviCade/OpenFrontIO-X/commit/8c71a588fab65c640b5c5337114076288b79f7eb): `docs/MAP_MULTIPLIER_TEST_PLAN.md` including exact commands, manual 2× game acceptance, and reproducible same-seed six-factor game benchmarks.

### Actual test/benchmark outcome
- Environment available: Node v22.16.0; npm v10.9.2, incompatible with repo's Node 24/npm 12; Git direct access DNS failure. GitHub connector only can read/write source. No local checkout, Vitest, TypeScript validation, format/lint, WebGL/browser session or `perf:game` execution occurred.
- Queried GitHub REST `/repos/LeviCade/OpenFrontIO-X/actions/runs?per_page=10` after pushes: `total_count: 0`, `workflow_runs: []`. Commit combined status-check array: `[]`. No CI proof.
- NO VERIFIED PASS. NO measured FPS/CPU/GPU/memory/startup values; numbers and area formulas are design, not observations.
- Potential defects needing validation: new source uses TypeScript format but `oxfmt` not run; any runtime bot AI edge cases; browser layers and terrain overlay alignment; GPU memory on 5×–6× even below MAX_TEXTURE_SIZE; multiplayer wire/interoperability with unmodified clients (never run mixed clients); snapshot/replay checks; public/listed forced-1× regression. Headless smoke test with no humans must be executed and refined if bots/WinCheck semantics fail.
- License/proprietary assets: policies inspected; no asset copies modified and no writes to upstream; full packaging/legal audit remains.

### Commands for the next engineer
See `docs/MAP_MULTIPLIER_TEST_PLAN.md`. Start by checking `git remote -v` for **LeviCade/OpenFrontIO-X ONLY**, then Node24/npm12 and `npm ci`, `npm run typecheck`, `npm run format:check`, `npm run lint`, `npm test -- tests/MapMultiplier.test.ts tests/MapMultiplierIntegration.test.ts tests/MapMultiplierGameplay.test.ts`, `npm run build-prod`; fix failures with evidence. Run an actual hosted 2× game before any claim of playable software; repeat 1× regression and >2 performance.
### PR state
- PR https://github.com/LeviCade/OpenFrontIO-X/pull/1 targeting own main; **draft**, no merges or actions submitted to official OpenFront. Last implementation commit: `121473d`.
