# OpenFrontIO-X next engineering program: upstream v0.35.2, game-ID Solo saves, and full-quality 10× maps

**Status:** engineering specification and work queue; implementation NOT COMPLETE. Created October 19, 2026. All features described below require execution evidence before they can be marked VERIFIED. **Work only inside `LeviCade/OpenFrontIO-X`.** Never push to `openfrontio/OpenFrontIO`.

## Proven baseline and branch discipline

- Baseline is draft PR #2, `feature/extended-map-controls-solo-rules`, head `5845afa73b9ccaea89f7029827618eca71ae4c44` at initiation. Stacked on PR #1 `feature/map-multiplier`. The full GitHub Actions workflow **passed all eight CI jobs** at [run 39161637481](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39161637481): format, lint, build/typecheck, map generation, three Vitest shards, rollup. Mac full-suite `npm test` previously passed 9,319 tests, one skipped, no failures. Neither CI nor the unit tests proves real-browser IndexedDB/playback or 10× Giant World stability.
- New integration branch `feature/v0352-cloud-solo-10x` is based on PR #2, with its own **draft, stacked** PR. Work here, **not** in the baseline branch. Keep both draft until hardware/browser validation, security review, and milestone gates are complete.
- Original owner's macOS workspace contains separate uncommitted work and MUST NOT be reset/cleaned/stashed/switched by any automation. If local testing is needed, make yet another isolated worktree based on THIS branch.
- Record truthful commit SHAs, commands, CI run URLs, observed failures, measurements and unresolved limitations in this document and `docs/DEVLOG.md`. Never infer a pass from source alone.

## A. Incorporate official v0.35.2 first, without losing custom behavior

**Verified comparison:** fork baseline main `dfd420fd7836ae023504a9440d9d68897745b7b4` exists in upstream history. Official tag [v0.35.2](https://github.com/openfrontio/OpenFrontIO/releases/tag/v0.35.2) targets `08b63c054897c030e6516e0731ab7cc62b2998b7`; `openfrontio/OpenFrontIO/compare/dfd420fd...v0.35.2` shows **6 commits ahead** of fork main, zero behind, with changes across 31 paths. These are:

1. `8989303`: Antarctic tribe themes.
2. `0273d3d`: hide store, Steam promos, and profile links on portals.
3. `538d205`: latest clan tag on profile cards.
4. `5dbb3a0`: WinModal test mock CI fix.
5. `2f8a6f9`: kick all sessions of a kicked account.
6. `08b63c0`: Snap Build Preview option, off by default.

**Execution plan:** Fetch the upstream **tag** in an isolated worktree (never pull upstream `main` instead, because `main` has subsequent commits). Merge/tag-integrate its commit ancestry into the new PR branch; resolve conflicts explicitly with PR #1/#2 map, Solo, replay customizations. Avoid blanket `git checkout --theirs` or overwriting whole directories. Verify upstream v0.35.2 release code and non-duplicated tests, regenerate maps only if required, run full existing CI, then manual smoke tests. Record merge-base, conflict decisions, and exact resulting commit.

**Version semantics:** Existing replays depend on exact `gitCommit` determinism. Test the handling of previously recorded local records from the pre-upgrade build; don't silently relabel old records as compatible with new code. Maintain versioned replay-shell access or provide a safe export/archive fallback.

## B. Make Solo saves retrievable by game ID, across devices

### Observed existing behavior (source-grounded)

- `SinglePlayerModal.ts` calls `generateID()` for each Solo game; there is already a real game ID.
- `LocalServer.ts` records all Solo turns/hashes in `SoloRecordJournal` backed by browser IndexedDB, and preserves first winner/tick after **Keep Playing**.
- At the **first** win, `LocalServer.archiveGameRecord(false)` POSTs a gzip partial record to `${getApiBase()}/archive_singleplayer_game`, authenticated by `getAuthHeader()`. This legacy remote archive contains the win-time snapshot, NOT all subsequent turns. The endGame fallback does not replace an archive already made.
- Normal server game archival calls `ServerEnv.jwtIssuer()/game/${id}` (`src/server/Archive.ts`). `ReplayRecord.ts` resolves locally saved source records first, then remote `GET ${getApiBase()}/game/${gameID}`. Viewer URL hash already supports `#replay-viewer=<gameID>` (`ReplayViewerRoute.ts`).
- The current `SoloReplayLibrary` explicitly labels records as **saved in this browser**. Never imply that past-win records are synchronized or independently retrievable online yet.

### Required product behavior

1. A Solo game has ONE stable ID from start through first win, Keep Playing, exit, and playback. Show a **Copy game ID / Copy replay link** action. A successful _cloud_ save must be openable by that ID on another supported device/build **subject to access permissions**. A local-only saved ID must say clearly that it is unavailable on other devices until synced.
2. Preserve **first winner, first-win tick, all completed turn intents, periodic engine hashes, map name/size/multiplier, Solo rules, engine build ID, recorded last turn, timestamps**. After Keep Playing, uploading additional turns must **not** overwrite the first win, reduce watermark, or truncate older chunks.
3. Use a robust upload protocol to an **owned/authorized backend**: authenticated owner + per-game authorization, versioned schema, bounded batches (e.g. 64-turn chunks), idempotent sequence numbers / content hashes, resumable upload acknowledgments, atomic server-side commit of contiguous chunks, bounded retries, offline backoff, and a finalize operation. Guard against forged IDs, malicious oversized inputs, rate abuse, cost explosion, and replay poisoning.
4. Do **not** assume the official upstream `api.openfront.io` backend supports post-win mutation or our custom schema. Do NOT upload experimental records to production upstream as a hack. Evaluate storage options explicitly (self-hosted service/object store/database, credentials, quotas and retention), with a deploy and cost plan. If an owned backend isn't configured, keep a fully functional **local-first mode** with export/import and a truthful `Local only / Uploading / Synced / Failed` indicator.
5. Choose and document access policy before exposing links: default **private to owner**, explicit opt-in for shareable/unlisted links, strong unguessable access capability if used, controls to revoke/delete, retention and account-deletion treatment. Never expose unlisted Solo activity merely because someone guesses a game ID.
6. Tests: 1,000+ turns with first win at turn 200, post-win continued to 1,000; restart client; lose network mid-batch; retry duplicate / reorder / interrupted batch; open by ID on another browser/profile; preserve privacy; simulate quota/full disk, backend 500, revoked access, unauthenticated guest, corrupt chunk, mismatched build, two-tabs collision, export/import. Check replay timeline reaches **last committed turn**, not first win, and hashes/determinism agree.
7. Keep the original official singleplayer archive/win/statistics path stable where possible. Do not introduce double XP, duplicate wins, remote database inconsistencies or publish by default.

## C. Genuine, high-quality 10× area—including Giant World if hardware supports it

### Existing architecture and constraints

- `packages/engine-lib/src/game/MapMultiplier.ts` scales destination width/height approximately by `sqrt(areaMultiplier)` using packed **nearest-neighbor** sampling and recomputed coast flags. This increases tile count but **does not invent new geographic detail**.
- `MAX_MULTIPLIED_MAP_TILES = 64_100_000`. The current code says 8× Giant World occupies ~64.02M tiles, so 9×–10× Giant World Normal is intentionally refused. Keep a safety guard until measured memory and GPU safety permits a carefully designed replacement.
- Physical camera/render/WebGL textures, minimap/pathfinding, simulation arrays, bot AI, asset coordinates and snapshot/replay all depend on this grid. A larger allocation or relaxed cap does not guarantee safe performance.
- **Definition:** 10× is _10 times total map area_, NOT 10 times each axis (which would be 100× area). Confirm this is the intended product knob. Define separate **visual-quality** goals (smooth boundaries, clear coastlines, readable overlays at zoom) vs simulation resolution (number of logical tiles).

### Engineering spikes (measure before design choices)

1. Profile actual 1× / 2× / 4× / 6× / 8× / 9× / 10× by map and Normal/Compact, including Giant World. Record source/destination width/height and tiles, RAM/heap/GC, GPU MAX_TEXTURE_SIZE, GPU allocations/context losses, p50/p95 game tick time, startup latency, replay hash checks, FPS/frame p95, and crash/blank-map behavior. Repeat comparable measurements on Mac and an automated headless baseline; compare same map/seed/bots/ticks.
2. Build a **memory model** for every per-tile array, snapshots, connected-component/pathfinding caches, terrain texture and color layers, replay buffers, and temporary scaling copies. Identify true 10× bottlenecks and set explicit device-based ceilings; avoid global allocation of extra full-size temporary copies.
3. Prototype **tiled textures/chunked map buffers** and incremental upload or streaming where WebGL max texture dimensions force it. Audit coordinate overflow, tile indexing, shaders, hit-testing, projected nations/spawns, pathfinding, railroads, water nukes and borders. Compare a tiled implementation to current baseline in correctness and memory.
4. Evaluate visual-quality options separately: vector/coastline tracing or antialiased boundaries and multiresolution/LOD rendering; avoid presenting nearest-neighbor magnification as new geography. Preserve original map silhouette; do not fake coastline/gameplay interactions. If source geography is insufficient for desired quality, specify and prototype a reproducible higher-resolution map-generation asset pipeline.
5. Consider simulation optimizations (typed array packing, chunk-local work queues, lazy sparse caches, minimizing full-map scans, worker sequencing). If attempting coarser simulation under high-quality visuals, **make the gameplay semantics trade-off explicit** and test click-to-territory correspondence. Do not quietly reduce strategy resolution while labeling it full-resolution gameplay.
6. Add **deterministic map scaling** and rendering regression tests for same seed/map, land areas, shorelines, impassable data, spawn coordinates, minimap, camera fit, overlays, replay hashes, multi-client version compatibility and 1× unchanged behavior.
7. Enable 9× and 10× Giant World only once the algorithm and target machines satisfy documented measurable thresholds. Otherwise keep a graceful explanatory refusal and provide a choice of Compact/other maps. Do not simply delete the 64.1M cap.

## D. CI and browser automation

- Existing `.github/workflows/ci.yml` already does Node 24 / npm 12 setup, typecheck + production build, lint, formatter, generated-map consistency, and **three Vitest shards**. Keep every gate strict, especially as new work is merged.
- Add Playwright Chromium acceptance for **real IndexedDB, Solo game startup, first win, Keep Playing, exit, restart, resume/sync, replay viewing past win, export/import** in a temporary isolated profile. Make test fixtures deterministic; use test backend credentials only, no production keys, no live upstream writes. Upload redacted logs/screenshots/traces on failure.
- Add small budget-controlled performance CI samples for scale tests and benchmark regression outputs. Most hosted Linux CI lacks the target Mac GPU/driver; keep physical GPU/browser acceptance separate. Use concurrency cancellation, cache responsibly, and avoid giant memory tests on every documentation commit.
- Repository is public: standard GitHub-hosted runner minutes are generally free per GitHub Actions billing policy, **but runners still have concurrency/usage restrictions**, storage constraints and risk of abuse. Do not assume infinite compute or expensive artifacts are free.

## E. Execution order and release gates

**Stage 1 — Upgrade only:** integrate six v0.35.2 commits into THIS feature branch; resolve conflicts; all CI green. Preserve PR1+PR2 baseline. Keep it draft.

**Stage 2 — Reproduce live browser:** immediately run the existing Solo 2×/20% win/Keep Playing/exit/replay scenario on Mac so we know the old local-only path works _before_ rewriting persistence. Record bugs and fix. Add browser integration smoke tests.

**Stage 3 — Define and implement owned game-ID cloud replay storage:** write API/schema/auth/storage design, identify actual available backend and credentials; implement local-first uploader and cloud reader only where supported. Ensure owner privacy and first-win immutable semantics.

**Stage 4 — High-quality 10× spike:** record hardware benchmarks and design selection; prototype tiled rendering/high-res visual quality, rewrite only the necessary hot paths, run determinism and GPU/memory tests. Enforce measured limits.

**Stage 5 — Final regression and handoff:** 1× parity; Solo thresholds 1% / 50% / default 80% / exact 100%; first-win/post-win timeline; export/import; offline/online sync and privacy; 2×–10× map matrix; production build; full CI; security, source/asset licensing and rollback plan. Only then discuss merging stacked PRs.

### First engineering action (for the returning engineer)

Use this new stacked draft PR only. Start by fetching the exact upstream tag and comparing the 31 touched upstream paths to PR #2 changes. **Integrate v0.35.2 before new feature code**, recording any merge conflict resolution. Run CI and report actual results. Then implement the automated browser Solo acceptance check; discover and document what deploy/storage is available before committing to a cloud backend. If infrastructure is missing, finish a self-contained local-first + backend-interface slice and report the blocker; do not claim cloud ID saves already work.
