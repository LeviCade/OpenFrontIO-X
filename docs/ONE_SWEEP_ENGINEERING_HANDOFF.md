# ENGINEERING SESSION — OpenFrontIO-X one-sweep implementation and verification

## 2026-10-18 — Engineering follow-on state (READ FIRST)

This handoff predates the source changes below. **PR #2 is still draft and unmerged**. The current branch must be read from GitHub before validation; do not assume the old starting SHA in this document is still head.

- Offline Solo source journal is now implemented in `src/client/replay/SoloRecordStore.ts` and integrated with `LocalServer.ts`: 64-turn IndexedDB chunks and separate hash rows, winner tick, continued post-win recording, bounded pending buffers and sparse in-memory turns. `ReplayRecord.ts` and `ReplayViewer.ts` prefer that local source over win-time remote archives and derived cache.
- Offline replay library `SoloReplayLibrary.ts` is exposed in Solo settings with Watch, compressed Export/Import, Delete and storage usage display. Source import has a 2-million-turn safety cap and same-build requirement.
- A visible Fit map action has been added to the live-game sidebar and replay viewer (Shift+F supported in viewer). Solo no-timer games no longer auto-win at 170 minutes when using default 80% victory rules.
- New tests exist in `tests/client/replay/SoloRecordStore.test.ts`; timeout regression exists in `tests/core/executions/WinCheckExecution.test.ts`. **NOT RUN**: no installed project checkout/dependencies/Node24 in engineering environment. Available agent Node22/npm10; Mac Node26 initially reported EBADENGINE. GitHub Actions returned zero runs on the feature branch. Therefore no typecheck, lint, format, build, 7×–10× hardware/gameplay, or extended replay determinism PASS exists.
- Prior Mac worktrees and any upstream OpenFront repositories were left untouched. Do not merge or declare release ready. Read the latest `docs/ENGINEERING_STATUS.md`, `docs/DEVLOG.md` and updated `docs/EXTENDED_MAP_AND_SOLO_REPLAY_PLAN.md` for exact commits, test expectations and remaining risks.
- Next operator/engineer: isolate Node >=24.15 <25 and npm >=12.1 <13 in a NEW worktree, execute full acceptance commands from below, fix all real failures, then prove offline Solo win→Keep Playing→close→watch to last tick and 7×–10× resource behavior.

---

**Mandate:** Complete and verify the owner's next release of **LeviCade/OpenFrontIO-X** as one coordinated engineering effort. Do not ask the owner to babysit routine terminal commands. Engineer, test, document, and push work. Preserve separation from official upstream OpenFront.

## Live starting point and user's evidence

- Repository: https://github.com/LeviCade/OpenFrontIO-X
- Work on PR **#2**: https://github.com/LeviCade/OpenFrontIO-X/pull/2
- Feature head branch: `feature/extended-map-controls-solo-rules`; base branch: `feature/map-multiplier`. This is intentionally stacked on PR #1, which in turn targets the repository's own `main`. **Keep PR #2 a draft** until acceptance passes.
- At handoff, PR #2 head is `2c6f6de0efe194a6c7e43ecac07d5102d69f7d42`; **recheck the current head before editing**.
- Owner independently launched full **Giant World at 6x area** in Solo and reported working gameplay and a very large map. This is a real manual smoke test at 6x, **not** proof of 7x–10x hardware performance. At 6x the player could not zoom out far enough to see all the edges.
- PR #2 already contains **source-only, unverified** code for 7–10x choices, live/replay/GL zoom floors, Solo 1–100% win setting, 64.1M tile budget, targeted tests. Audit it; do not assume it compiles/passes or that all edge cases are correct.
- The architecture and exact preexisting replay behavior are in [EXTENDED_MAP_AND_SOLO_REPLAY_PLAN.md](EXTENDED_MAP_AND_SOLO_REPLAY_PLAN.md). Also read [AGENTS.md](../AGENTS.md), [ENGINEERING_STATUS.md](ENGINEERING_STATUS.md), [DEVLOG.md](DEVLOG.md) and [MAP_MULTIPLIER_TEST_PLAN.md](MAP_MULTIPLIER_TEST_PLAN.md). Old docs may still say 1–6x: reconcile them deliberately when features are verified.

## Recent operator-terminal blocker: environment only

The owner ran the following successfully on their Mac:

```sh
git fetch origin
git worktree add --detach ../OpenFrontIO-X-extended origin/feature/extended-map-controls-solo-rules
cd ../OpenFrontIO-X-extended
```

Their local new worktree is at detached `2c6f6de0`. It is not a tracked feature branch. They then ran `npm run inst`, which invoked `npm ci --ignore-scripts` and failed **EBADENGINE**, reporting:

- Required: `node >=24.15.0 <25`; `npm >=12.1.0 <13`.
- Actual: **Node v26.10.0**, npm **12.1.0**.
- Subsequent `npm run format` reported `oxfmt: command not found`, and `npm run typecheck` reported `tsc: command not found` because dependency installation never completed. These are NOT yet evidence of a code defect.
- In the engineering execution environment, provision **Node 24.15+ less than 25 and npm 12.1+ less than 13** via the available version manager, verify both versions, and run `npm run inst` successfully before any lint/test/build claims. Use supported versions; **do not bypass package engine checks**. If an engineer uses the physical Mac, do not disturb global Node installations or the original worktree; prefer a shell-scoped version manager. The owner does not need to run anything else until you finish source engineering.
- Do not reset, clean, overwrite or merge the user's preexisting `OpenFrontIO-X` worktree or the detached `OpenFrontIO-X-extended` worktree. Engineer can use a separate clone/worktree and push the feature branch to GitHub. No force pushes.

## Required deliverable A — 1x–10x maps and honest resource constraints

1. Keep **total area multiplier**, axes approximately sqrt(factor), deterministic packed nearest-neighbor scaling, unchanged 1x behavior, Compact/Normal mapping, shore flags, land/ocean/impassable values, spawn coordinates, mini map, nation/team spawn placement, snapshot and replay determinism.
2. Make 7, 8, 9 and 10 selectable for Solo on suitable maps and ensure all UI/schema/loader/build routes agree. Do not reintroduce public-server compatibility risks; public/listed/ranked games retain safe defaults and server-side restrictions.
3. The physical reference map `resources/maps/giantworldmap/manifest.json` is **4108×1948 = 8,002,384** source tiles. 6x ~48.02M; 7x ~56.02M; 8x ~64.02M; 9x ~72.02M; 10x ~80.02M. The present PR raises the prior 64.0M tile cap only to 64.1M, allowing 8x Giant World. **Do not silently make 9x or 10x Giant World run by removing safety checks.** Investigate targeted memory optimizations, chunking/tiling of graphics and data, GPU MAX_TEXTURE_SIZE, JS typed arrays, renderer passes, pathfinder and tick throughput. If 9/10x on Giant World can be enabled with measured headroom, do it with explicit checks and regression tests. If not, preserve graceful refusal and give measured blocker details; 9/10x on smaller maps are still legitimate.
4. Make the entire map visible with a reliable Zoom-to-Fit option/action, plus zooming out all the way to map edges, on live gameplay and both replay paths. Verify input coordinates, center/pan/scroll/pinch, name overlays, minimap and WebGL renderer actually stay aligned after extreme zoom. The current branch adjusts `TransformHandler`, `Camera` and `ReplayCamera`; audit that `centerAll()` and other callers behave as intended.
5. Test 1/2/3/4/5/6 baseline and 7/8/9/10 on qualifying Normal/Compact maps, determinism and memory caps, including Giant World 7/8 browser smoke and 9/10 graceful behavior. The UI must tell users when hardware or tile limits prevent a combination.

## Required deliverable B — Solo victory percentage (1–100)

1. Visible numeric game-setting control, integral range 1–100, default **80** with backward compatibility. Persist into per-match deterministic config; handle restart/new game correctly. Ingame win HUD should agree with actual threshold.
2. Explicit 100% must be achievable at precisely 100% of eligible land (older > threshold comparator cannot win at 100). Preserve old default 80% semantics unless intentionally and carefully revised with tests. Specify/verify how fallout denominator and overtime work. If the owner requests no time limit, Solo must not force an unrelated 170-minute winner; an explicitly enabled timer can still end the match.
3. Public/ranked/multiplayer must not receive unauthorized rule changes. Review the server patches/schemas, not only the Solo UI. Test saved game records and replays with this new field.

## Required deliverable C — Offline Solo save, replays and post-win continuation

**This is NOT yet implemented. Completing it is the main additional engineering task.**

1. Ensure Solo without an API server **locally saves the source game record**, rather than depending on `/archive_singleplayer_game`. The current `src/client/LocalServer.ts` records turns/hashes but tries to upload a partial record at victory and `endGame()`. The existing `ReplayStore` IndexedDB contains cached **processed** replays, not a durable Solo source-record library.
2. Store validated game start information/config, seed/build/version, player details, turn intents, periodic hashes, winner and exact first win tick, subsequent turns and last saved tick, metadata, and an explicit incomplete/finished flag. Use versioned IndexedDB **bounded chunks/checkpoints**, not continuously rewriting an unbounded single giant JSON array. Offer quota/error handling and storage usage visibility. No auth or internet required.
3. At victory, show the result, offer **Keep Playing**, and **continue the actual simulation** when chosen. Preserve the official victory/win tick while recording **every subsequent turn**, through user exit / tab close. The replay timeline should cover those post-win turns, not abruptly cut off at victory. Treat mid-session incremental saves as essential: `unload`/`pagehide` can only attempt a best-effort last flush. Distinguish **recording until tab closed** from **resuming active simulation after restart** (the latter is not required by the owner).
4. Integrate offline sources into the replay viewer and a small, usable local replay library: list with map/factor/date/duration/result, watch, export portable compressed record, import with schema/build safeguards, delete. Work out whether the existing `GameRecord` schema can represent post-win ticks without falsely changing original winner info or confusing replay processors. Keep game hashes and deterministic playback checks. Consider low-memory streaming/partial-record recovery.
5. Preserve standard remote archive behavior when its API exists and public/ranked integrity. Decide on a clear strategy for winner-time remote archival vs local continuously extended record; avoid sending post-win timelines back as ambiguous ranked or remote results. Avoid accidental uploads of private Solo turn histories without explicit user expectations.
6. Tests: no backend; game won at threshold; Keep Playing advances 100s/1000s of ticks; win tick remains stable; tab exit; unexpected closure/refresh; stalled/quota-full IndexedDB; import/export round trip; replay past winner; 1x old record; 6x–10x config; hash validation; build mismatch; large-record performance; no duplicate archival.

## Full validation, acceptance and reporting

- Fix current PR #2 compile/test/style issues first, including newly authored tests. Do not assume any tests are green just because they were written.
- Run at least `npm run inst`, `npm run format:check`, `npm run typecheck`, `npm run lint`, targeted Vitest, full `npm test` where feasible, `npm run build-prod`, and actual locally served Solo browser gameplay; report precise outcomes. Apply formatter deliberately only to intended files and review noisy diffs.
- Benchmark a comparable map at 1x–10x with identical seeds, bots, ticks and resource metrics. Measure GPU limits, CPU time, peak RSS, browser memory and FPS for Giant World where practical; do not claim perf figures that were not run. Prefer compatibility/no-data-loss over impressive factor labels.
- In addition to functional tests, test defeat/no winner, achievements/score integrity, recorded hashes and cleanup of listeners/intervals/workers/object URLs/IndexedDB handles on exit and repeated game/replay launches.
- Keep all writes in **LeviCade/OpenFrontIO-X** on PR #2 branch or a deliberate child branch/PR to this repository. Do not push to upstream, do not merge PR #1 or #2, do not modify the physical Skybot host/VM infrastructure, do not force-push user work.
- **After every meaningful milestone**, commit and push `docs/ENGINEERING_STATUS.md` and `docs/DEVLOG.md` with exact progress, command/test output summaries, blocker evidence and current SHA (the owner uses another session to audit actual GitHub state). Update this handoff and PR description as reality changes. GitHub Issues are disabled for this repository, so track in committed docs and PR conversation.
- Final engineer reply should distinguish **fully working**, **implemented but untested**, **blocked**, and **not done**, with changed files, links/SHAs, actual test/build results, tangible browser/performance evidence, remaining risks, exact handoff for any operator-only task, and whether PR #2 remains draft.

**Success criterion:** Owner can locally open a huge Solo map, zoom all the way out, choose victory 1–100%, win, keep playing, close the browser, and later open a faithful **offline** replay that includes the action after the original victory — subject only to explicit, understandable hardware/storage limits for the highest multipliers.
