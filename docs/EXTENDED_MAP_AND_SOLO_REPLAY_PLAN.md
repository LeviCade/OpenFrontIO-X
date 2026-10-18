# Extended maps, Solo victory and offline replay engineering

Status (2026-10-18): **Offline Solo source recording code added, but NO Node 24 compile, test or browser verification on this PR head.** Work here is independent from upstream OpenFrontIO.

## Implemented in this branch

- Total-area multipliers 1x through 10x use the existing deterministic terrain scaler.
- The existing allocation budget is raised only from 64,000,000 to 64,100,000 tiles, enough for 8x Giant World while retaining a strict memory guard.
- Gigantic maps that exceed this budget are rejected before a Solo match starts, with a user-readable dimension warning. No guard is silently bypassed.
- Normal/Compact scaling, minis, spawns, replay configuration and WebGL maximum texture size validation retain their existing paths.
- The actual live input camera (`TransformHandler`), WebGL camera, and replay viewer camera now permit zooming out to a 90%-fit full-map view even below their historic zoom floors. Other maps keep their existing minimum.
- Solo has a 1–100% integer territory win setting, default 80%. The override is ignored by multiplayer/ranked logic. Exactly 100% is attainable for an explicit Solo choice; no override preserves the original strict >80% comparison. Explicit Solo overrides also bypass the hosted 170-minute automatic winner watchdog (the optional Solo max timer remains authoritative if enabled).
- Extended values are represented in the GameConfig wire schema, so game starts/turns use deterministic settings.

### Giant World constraints (Normal size)

Original map: 4108×1948 = 8,002,384 tiles.

| Area multiplier | Expanded dimensions | Expanded tiles | 64.1M cap |
| --- | --- | --- | --- |
| 6x | 10063×4772 | 48,020,636 | Within |
| 7x | 10869×5154 | 56,018,826 | Within |
| 8x | 11619×5510 | 64,020,690 | Within |
| 9x | 12324×5844 | 72,021,456 | Exceeds |
| 10x | 12991×6160 | 80,024,560 | Exceeds |

**This does not establish that even 8x performs acceptably on any specific GPU or that 9x–10x Giant World is safe.** 9x and 10x are offered for smaller source maps (or Compact) that remain below the cap. They must not be enabled for Giant World Normal without measured memory/GPU budgets and a deliberate allocation redesign. MAX_TEXTURE_SIZE is a separate per-axis GPU gate.

## Run before treating this as complete

1. On macOS use Node 24/npm 12, then `npm run format`, `npm run format:check`, `npm run typecheck`, `npm run lint`.
2. Run `npm test -- tests/MapMultiplier.test.ts tests/MapMultiplierIntegration.test.ts tests/MapMultiplierGameplay.test.ts tests/client/render/CameraGiantMap.test.ts tests/client/GiantMapZoom.test.ts tests/core/executions/WinCheckExecution.test.ts`.
3. Run `npm run build-prod` and `npm run start:client`.
4. In Solo test 1x 80% regression; 2x 1%, 50%, and 100% exact territory win; full 7x/8x Giant World zoom and gameplay; graceful 9x/10x Giant World refusal; 9x/10x smaller maps; camera minimap alignment.
5. Measure tick time, browser/GPU memory, frame rate, texture support and replay determinism on the target Mac.
6. Keep the PR draft until tests and manual evidence exist.

## Offline Solo replay / keep-playing architecture (source implemented, UNVERIFIED)

### Existing behavior found

- `src/client/LocalServer.ts` accumulates turns and their periodic hashes.
- On the winner message, it immediately calls `archiveGameRecord(false)`, and `archiveGame()` posts to `/archive_singleplayer_game` using a session token. With the API unavailable (client-only dev mode), no remote archive is created.
- The winner modal already has **Keep Playing** (or Spectate). The local turn producer does **not** stop merely because a winner was received, but `archived` / `archiveInFlight` prevents a newer, extended turn record being uploaded at exit. Consequently the win-time archive normally captures only turns through victory.
- `src/client/replay/ReplayRecord.ts` fetches a `GameRecord` from the remote API. `ReplayViewer.ts` processes it locally and then uses `ReplayStore.ts`'s 256 MiB IndexedDB cache **for processed replays**, not for independent offline source records. The cache is not a Solo game-record library.

### New source implementation (not yet tested)

- `src/client/replay/SoloRecordStore.ts`: separate IndexedDB source database, 64-tick immutable chunks and separate hash rows, serial atomic metadata writes, first victory tick, last tick, source build, incomplete/finished state, bounded 512 pending/in-flight turn buffer, 2-second checkpoints and best-effort visibility/pagehide flush.
- `LocalServer.ts`: keeps the original remote win-time archive for compatibility while retaining a separate local extended recording, including all turns after Keep Playing. In-memory empty turns are sparse so long-running games do not hold a full object per tick. A rejoin materializes dense turns temporarily.
- `ReplayRecord.ts` / `ReplayViewer.ts`: load local source before remote API/processed frame cache, avoid stale derived frames, enforce exact build compatibility for local replays.
- `SoloReplayLibrary.ts` / `SinglePlayerModal.ts`: offline list, Watch, Delete, compressed JSON Export, Import, quota estimate; import capped at 2,000,000 turns and restricted to Solo. Export and replay decode still need large-session memory measurements.
- `tests/client/replay/SoloRecordStore.test.ts`: first win + subsequent 1000 turns, late hashes, offline load, export/import, duplicate/build rejection and simulated quota failure. Written, **NOT RUN**.
- Added visible full-map Fit map actions in HUD and replay viewer, fixed Solo default 80% forced 170-minute watchdog and added regression test. These still require actual UI and runtime checks.

### Original proposed acceptance contract (open and unverified)


- Add a separate `SoloRecordStore` in IndexedDB for validated, versioned **source turn logs**, with bounded batches/chunks and periodic checkpoints while playing; retain game start/config, seed, player identity/cosmetics, hashes, win event/win tick and end/last-processed tick.
- At victory, mark an outcome/checkpoint **without freezing or deleting the turn log**. Keep simulation running if the player chooses Keep Playing; all subsequent turns must remain replayable until the player exits/closes the tab. Preserve the original winner and tick as the result, even when the replay extends past it.
- Save incrementally *before* tab closure; `pagehide`/`visibilitychange` can request a best-effort last flush but are **not guaranteed** to finish. Make crash recovery, partial chunks, quota errors and idle pause explicit.
- Teach replay record loading to check this local store before attempting the API. Make local replays discoverable, exportable (portable compressed file), importable, deletable, and clearly distinguish local-only from remotely archived games. Respect replay/version compatibility and hash validation.
- Maintain separate `wonAtTick` / `lastRecordedTick` semantics; a win should not automatically terminate gameplay or recording; do not submit altered extended matches to ranked/public archives. Revisit the win-time API upload vs. final on-exit record lifecycle to avoid duplicate or misleading remote records.
- Specify quotas for multi-hour 8x matches and avoid an unbounded turn array in RAM. Test no backend, browser/tab exit, refresh/crash, resumed viewing, quota full, replay beyond victory, 1x compatibility, cross-build rejection, server availability restoration and correct deletion/export.

This source now belongs to draft PR #2, stacked on PR #1. Do not claim working, verified or released until actual Node 24, replay determinism and browser tests pass.
