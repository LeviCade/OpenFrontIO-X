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

## 2026-10-18 05:01 UTC — PR #2 engineering takeover

- Read AGENTS.md, docs/ONE_SWEEP_ENGINEERING_HANDOFF.md, docs/EXTENDED_MAP_AND_SOLO_REPLAY_PLAN.md, existing PR metadata and replay/LocalServer architecture. PR #2 draft and stacked on same-repo feature/map-multiplier.
- Verified current runtime node v22.16.0/npm v10.9.2; git ls-remote failure `Could not resolve host: github.com`. No dependencies or executable tests available; user Mac Node 26 engine error is separate and remains untouched.
- Starting head a5951bd93d174260a6f84f0f0d1c742e1bf6e4a5; implementing source-only offline record journal next. No replay or map acceptance claimed.

## 2026-10-18 05:20 UTC — PR #2 substantial source milestone

- Implemented `src/client/replay/SoloRecordStore.ts` (commits `60cdea0`, `9059d56`, `c3a85bf`, `703e13f`, `aed237f`): separate IndexedDB source DB, 64-turn chunks, separate delayed hashes, serial atomic writes, bounded 512-turn queued backlog, 2s save cadence, visibility/pagehide best-effort flush, original first winner tick/identity, source reconstruction and schema validation, local import/export envelope; no silent fallback into temporary processed replay cache.
- Connected `src/client/LocalServer.ts` (`8ee7079`, `84eb399`) to record all Solo turns and hashes; victory checkpoints do not stop recording, win-time remote archive remains unchanged; missing IndexedDB warns via red UI toast and does not prevent game launch.
- `src/client/replay/ReplayRecord.ts` (`e46f2db`), `ReplayViewer.ts` (`6e940e6`) check local source before remote API and cached processed frames; strict other-build refusal for local-origin source rather than redirecting away from IndexedDB.
- `SoloReplayLibrary.ts` (`4370430`) and `SinglePlayerModal.ts` (`88a19b6`) expose list/watch/gzip export/import/delete and site quota estimate in Solo menu. Memory-heavy export/import and 1M+ turns need benchmarks.
- Fixed default Solo timeout `WinCheckExecution.ts` `e8d7019`; new regression `88a0731`; explicit timer still applies.
- Added full-map fit live event HUD and replay viewer button / Shift+F (`8a76c57`, `3996fe9`, `b295aae`). Source-level only, no browser pass.
- New source-journal regression tests `tests/client/replay/SoloRecordStore.test.ts` (`5861392`, `4104079`) written, NOT EXECUTED. Real checks blocked by Node22/npm10 and no git checkout/DNS. No performance data or actual 7×–10× gameplay observed here.

## 2026-10-18 05:40 UTC — Final PR2 engineering audit and handoff

### Latest implementation after prior checkpoint

- `3bc6372`: first win tick follows last issued turn, independent of worker acknowledgment timing.
- `aa44101`: LocalServer now uses a sparse in-memory turn array (only intents + periodic hashes), retaining logical length for backlog and archived `num_turns`. Explicit rejoin temporarily materializes full Turn[]; existing remote source archive uses sparse-array filter and unchanged semantics.
- `22d6080`: import validates Solo-only config, safe integer 1..2,000,000 turn span; prevents runaway importer loops.
- `542882d`: repaired test fixture to use `GameType.Singleplayer` (ArchiveGame.config default is Public).
- `87b933a`, `3e60e12`: inject build ID into SoloRecordJournal fixture so Node tests do not rely on `window.BOOTSTRAP_CONFIG` / ClientEnv before boot.
- `ea91ae3`: warning callback no longer references window in Node/headless LocalServer replay-speed test.
- `d271ebf`: source-replay design docs updated to reflect added implementation and unverified acceptance gates.
- PR #2 body updated to reflect offline sources and explicit NO PASS claim. PR remains draft, stacked on same-repo feature/map-multiplier. No Mac worktree, Skybot, official upstream or main branch modifications.

### Evidence and limitations as measured (not inferred)

- No local code checkout or project dependencies. Runtime Node v22.16.0/npm v10.9.2; project requires Node >=24.15 <25/npm>=12.1<13; GitHub DNS failed. In handoff operator's separate Mac worktree Node26.10 caused `EBADENGINE`, after which tsc/oxfmt were absent. No Mac intervention in this session.
- GitHub App pushed implementation and docs; GitHub Actions run count for PR2 branch is **zero**, commit statuses returned an empty list on `ea91ae3`. No TypeScript, Vitest, lint, formatting, build, browser, replay or GPU benchmark commands were executed. **NO VERIFIED PASS**.
- Test files committed but unexecuted: new `SoloRecordStore.test.ts`; updated WinCheckExecution test; prior 1×–10× map/camera tests on branch. Do not conflate authored tests with successful tests.
- Local source retains initial win and subsequent turn watermark; processed ReplayStore remains cache only. The remote API win-time archive is not extended. Crash/Quota/Imprecise winning-tick test might reveal bugs, and source export/decode memory is not streaming.
- Operator-reported previous Giant World 6× Solo gameplay from HANDOFF document is historical external observation, not a verified current-head test. 7×–10× have zero measured performance evidence here; 9/10× Normal Giant must remain refused until headroom measured and architecture revised.

### Operator-independent next step

1. Isolate compatible Node24/npm12 environment and repo worktree without resetting the existing Mac worktrees; run install, format, typecheck, lint, targeted tests and production build. **Fix every actual failing check before UI acceptance.**
2. Verify offline Solo replay (win at 1%, 50%, exact 100%, custom + default 80%; continue 1000 turns, confirm original winner remains, then close/reopen, playback to last recorded tick, compare engine hashes, export/import), and cross-build, interrupted/quota scenarios.
3. Performance stress smaller 1×–10× and Giant World 7/8 with FPS, p50/p95 tick, peak RSS, browser/GPU memory and real GPU texture limits; 9/10 Normal Giant must fail visibly under 64.1M cap.
4. Commit exact output and screenshots/logs, then review PR #2 as draft stacked on PR1. Merge only after acceptance and distribution/asset audits.

## 2026-10-19 19:22 UTC — PR #3 v0.35.2 engineering takeover

- Read full V0352 engineering spec, AGENTS.md, PR #3 metadata, baseline status and existing CI. PR #3 draft targets PR #2; no upstream writes, PR1/PR2 edits, main merge or Mac worktree modifications.
- Starting head `8c920ee4e63e403c06b2f9f19c68dc3a02204a4a`. Verified GitHub Actions core CI [39308402294](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39308402294) passed 8/8 jobs; independent gate [39308402293](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39308402293) failed because PR has no assigned milestone. This is a governance check and will not be bypassed.
- Official read-only tag v0.35.2 `08b63c054897c030e6516e0731ab7cc62b2998b7`, six commits beyond fork's original `dfd420fd7836ae023504a9440d9d68897745b7b4`, 31 changed upstream paths. Baseline feature branch changed `src/server/GameServer.ts`; it is the only overlapping path (different hunks may auto-merge).
- Current sandbox Node 22/npm10, git DNS unable to resolve github.com; use real Node24 GitHub Actions isolated checkout for upstream tag merge and tests. Work begins now; no upgraded features have been claimed verified.

## 2026-10-19 19:30 UTC — genuine upstream v0.35.2 merge completed

- GitHub-hosted isolated Ubuntu job [39311331279](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39311331279) succeeded. Used actions/checkout@v7, git fetch official v0.35.2 tag, SHA assertion `08b63c054897c030e6516e0731ab7cc62b2998b7`, and confirmed merge base `dfd420fd7836ae023504a9440d9d68897745b7b4`.
- Real `git merge --no-commit --no-ff` automatically combined `src/server/GameServer.ts` without conflict, merged 31 upstream-changed paths while maintaining presence of fork map/solo modules. `git diff --cached --check` passed, two-parent commit `c558732504a7c460d328ea23d60ca2be25d7b067` pushed ONLY to PR3.
- Initial integration workflow YAML `84743d0` failed before jobs due to an unquoted YAML scalar containing colon; corrected `1f01234`; next workflow succeeded. This is actual failure/debug evidence, not silently discarded.
- GitHub generated-actor merge CI initially `action_required`. New docs commit will request regular PR CI on merged code. No post-merge TypeScript/Vitest/browser acceptance yet.

## 2026-10-19 — PR #3 real-browser, private cloud contract and bounded 10× benchmark checkpoint

### Actual successful runs

- [39311331279](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39311331279): **PASS**, isolated genuine merge of tag v0.35.2 (SHA `08b63c054897c030e6516e0731ab7cc62b2998b7`) onto fork, merge commit `c558732504a7c460d328ea23d60ca2be25d7b067`; `GameServer.ts` auto-merged without conflicts. PR1/PR2 modules preserved.
- [39312933139](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39312933139): **PASS**, real Chrome/IndexedDB 1,000 synthetic turns after first win at 200, delayed hash from turn 100, persisted turn 999 through reload; game ID retrieval and gzip export/import into second isolated browser profile; local-only privacy. Follow-up [39314027037](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39314027037) browser run **PASS**.
- [39314845914](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39314845914): **PASS**, actual Pangaea game-core 64-tick headless Ubuntu benchmark, seed `pr3-pangaea-identical`, 10 bots/nations disabled: **1×** p95 1.76ms, RSS final 165 MiB; **4×** p95 1.63ms, RSS 188 MiB; **10×** p95 1.53ms, RSS 227 MiB. All 0/64 ticks >100ms. Different RNG hashes per map size expected; no GPU/FPS/long-fight inference.
- [39313372741](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39313372741): **PASS**, real project-wide oxfmt and removal of temporary contents-write merge/format workflows; the later new files will require another formatting pass.

### Implementation

- Browser fixture `tests/browser/solo-replay-idb.mjs` and persistent CI workflow `.github/workflows/pr3-solo-browser.yml` (Node24/npm12/Chromium).
- `src/client/replay/SoloCloudProtocol.ts` introduces **NO DEFAULT NETWORK** owner-authenticated resumable source upload abstraction; idempotent indexed chunks and separate delayed hash events, SHA256, max chunk size, bounded retry and local-only fallback. `tests/client/replay/SoloCloudProtocol.test.ts` tests mocked backend functionality. No actual hosted backend verified; do not redirect to the official OpenFront API. Detailed threat model in `docs/PR3_CLOUD_BACKEND_AND_10X_SPIKE.md`.
- `SoloReplayLibrary.ts` now copies stable game ID/replay link with visible **local only** warning; cross-device requires explicit export/import until a user-controlled service exists.
- `packages/engine-lib/src/game/TextureChunkPlan.ts` pure GPU-safe texture/halo tile plan, and `tests/TextureChunkPlan.test.ts` seam/limit/geometry test. NOT enabled in renderer.
- `.github/workflows/pr3-map-perf.yml` samples actual deterministic Pangaea 1×/4×/10× CPU, RSS, p95. Does not bypass 64.1M-tile safety cap or imply high-quality Giant World support.

### Debug and remaining blockers

- One-shot merge workflow initial YAML colon not quoted, resulted in zero jobs; fixed and reran to success. Initial browser fixture path was swallowed by Vite root routing; fixed to load source ES modules on root origin; then Chromium passed.
- SoloCloudProtocol initial `await` inside non-async callback triggered TS1308; computed SHA before lambda and build passed. Browser script `||` triggered oxlint; changed to `??`. ESLint TypeScript project service originally excluded `tests/browser/*.mjs`; added path to allowDefaultProject.
- Initial 1×/4×/10× footprint matrix all failed because Node `gc()` unavailable; added `--expose-gc`; corrected matrix then passed all three jobs.
- Project `oxfmt` and generated maps consistency currently flag **newly authored docs/UI files**; a final one-shot formatting pass is required after the implementation freeze, then a human-app-authored commit must trigger CI on final head. Do not claim 8/8 green until real run completes.
- Separate mandatory PR milestone governance failure: existing PR #3 lacks assigned milestone; do not bypass this rule or prematurely merge. Main, PR1/PR2 and Mac checkout unchanged.
- **Not done:** official production API cannot serve new saves; no owned service deployed, no cross-device backend, no full user-driven victory → post-win replay-renderer proof, no GPU measured and no high-detail 10× Giant World implementation. All protection caps retained.

## 2026-10-19 — Post-format final CI trigger

- [PR3 formatter run 39315393701](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39315393701) **PASS**: `npm run format`, `npm run format:check`, `git diff --check`, and automatic removal of the one-shot contents-write workflow. Formatter commit `8113cde2e5da47ced4dce7b0e92af1618ffff523`. This ordinary GitHub-authored devlog checkpoint triggers fresh CI on the final formatted feature tree; its check results must be read from GitHub before considering the PR ready.

## 2026-10-19 — Continuation after interrupted session; off-by-one/64 replay upload flaw

- Recovery fact: previous final head `a18c1d82b4b2cf303e0aa24894e395048f9949d0` **passed 8/8 core CI** ([39315729226](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39315729226)), 3/3 Pangaea CPU benchmarks ([39315727742](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39315727742)), and Chromium source persistence ([39315727486](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39315727486)); only independent mandatory PR milestone check failed. PR3 still draft/staked onto PR2 and owner Mac untouched.
- Inspected actual `SoloRecordJournal.flush` in `SoloRecordStore.ts`: flushed source ranges may be 0..63, 64..127, 128..191, 192..200 (winning-time checkpoint), 201..255, etc.; existing cloud `expectedFirst = index * 64` was wrong. It would reject ordinary persisted source after Keep Playing even though happy-path synthetic 64-grid tests passed.
- Patch [`1c3edc1`](https://github.com/LeviCade/OpenFrontIO-X/commit/1c3edc1f75a9038a032abe694b9f56de38394ca1): validate actual immutable contiguous 1–64 turn ranges, source IDs, ordered sparse intent ticks, gap/overlap/corruption, finite unique hash rows. Never rewrite acknowledged chunks. Existing local-only behavior remains untouched.
- Patch [`47c5ef4`](https://github.com/LeviCade/OpenFrontIO-X/commit/47c5ef452c1bfa6ab7170fbc9203846ecef49ca1): fake backend tests cover early checkpoint and later resumption, immutable digest and first winner, duplicate acknowledgement retry, malformed chunks and hashes.
- Patch [`fd4b29f`](https://github.com/LeviCade/OpenFrontIO-X/commit/fd4b29f4618fee6e1c65f8b98634e59b55b18c1f): extended actual Chrome/IndexedDB test feeds _real source rows_ through the optional `syncSoloSnapshot` protocol to an in-memory owner-scoped backend; no outside networking. [Chromium run 39318854010](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39318854010) **PASS**.
- New [CI 39318854003](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39318854003) has build+lint PASS, formatting FAIL in new `SoloCloudProtocol.test.ts`, generated-map consistency FAIL for the same formatting difference, and Vitest still running at checkpoint. Apply project formatter then launch fresh CI; do not mark newest head 8/8 until verified.
- Boundaries: cloud tests still use in-memory fake; real authenticated owner database/object store, cross-device ID lookup, actual game UI win/Keep Playing and post-win renderer acceptance, Mac GPU stress, and true 10× Giant World are NOT COMPLETE. Draft only, no merge, no upstream writes.

## 2026-10-19 — Exact failed regression diagnosis and formatter completion

- [CI 39318854003](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39318854003): **build PASS, lint PASS, tests shards 1/3 + 3/3 PASS, shard 2/3 FAIL**. Only two new `SoloCloudProtocol.test.ts` expectations failed: obsolete `"missing chunks"` error substring and an "unauthorized" fixture that changed only metadata's game ID, now correctly caught as a local source ID mismatch before the fake server was called. Full Vitest rollup consequently failed; no evidence of a production defect in these two failures.
- [Fix `5ac62b0`](https://github.com/LeviCade/OpenFrontIO-X/commit/5ac62b00059dd0d381f3b36b072e3085aba8b417): align error expectation and mutate metadata, config, stored chunks and hashes consistently to reach simulated unauthorized backend. Keep new stricter source integrity validation intact.
- [One-shot formatter 39319538605](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39319538605) **SUCCESS**: Node 24/npm 12 `npm run format` plus `npm run format:check`, `git diff --check`, self-deletion of contents-write temporary workflow; pushed `2dfc38fdd639984bef61e5c5783eb87bc90b0075` ONLY to PR3. No temporary privileged workflow remains from this patch.
- This app-authored documentation checkpoint is the intended trigger for new official CI checks on the formatted source. Do not mark these latest edits as full CI passed until actual jobs finish. Prior tested Green baseline on `a18c1d82` remains historical.
