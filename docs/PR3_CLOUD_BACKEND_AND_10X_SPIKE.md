# PR #3 — Owned Solo replay backend decision and 10× quality/memory engineering spike

**Status 2026-10-19:** API contract implemented and tested in source; NO OWNER-CONTROLLED BACKEND DEPLOYED. High-quality 10× Giant World NOT DELIVERED. Only the existing area-scaling implementation and 64.1-million-tile limit are shipped in this draft branch.

## Actual source/hosting findings

- `src/client/LocalServer.ts`: a Solo game gets one ID. Original win-time `/archive_singleplayer_game` upload remains the official statistics/archive path; it cannot be assumed mutable or owner-private after Keep Playing.
- `src/server/Archive.ts`: official game server archive uses `ServerEnv.jwtIssuer()/game/:id` and a server API key. This is NOT an owner-controlled, independently deployed replay service. Do not point new source records to that endpoint or expose its API key to a browser.
- `src/client/replay/SoloRecordStore.ts`: standalone IndexedDB for source turns and hashes; `SoloReplayLibrary.ts` provides offline export/import. The local journal includes first winner, win tick and post-win duration.
- `.github/workflows/deploy.yml` describes an upstream-oriented staging/deployment pipeline, with GitHub secrets whose availability/ownership has not been established. **No independent backend origin, account auth authority, object-store bucket, database connection or data-processing policy was verified in this repository.** Therefore cloud sync must be **OFF BY DEFAULT**, without even attempting an unauthenticated upstream request.
- `src/client/replay/SoloCloudProtocol.ts`: injectable `SoloCloudBackend` interface for owner-authorized begin, sequenced chunk upload, separate late-hash upload and finalize. `syncSoloSnapshot` returns `local_only` without a supplied backend, enforces contiguous local chunks, 1 MiB payload ceiling and bounded retries, and never claims cross-device availability in local-only mode. Fake-backend Vitest tests are in `tests/client/replay/SoloCloudProtocol.test.ts`; this does **not** constitute a deployed cloud or security test.

## Deployment target selection (requires ownership verification)

Recommended independent architecture: **owned API + relational manifest store + private object store**, either (a) a Cloudflare Worker with D1/R2 and a verified domain and session provider owned by LeviCade, or (b) self-hosted service with Postgres and private S3-compatible object storage. Neither is selected as operational until credentials, billing account, DNS, encryption-at-rest, backups and account identities have been verified. Do not reuse the upstream API or its session as proof of ownership.

### Proposed versioned HTTP API

All endpoints below belong exclusively to a future authenticated OpenFrontIO-X-controlled origin (no published endpoint exists today).

| Operation | Method + route | Constraints |
| --- | --- | --- |
| Begin/resume | `POST /v1/solo-replays/:gameID/uploads` | Verify active owner session, CSRF protection and manifest, mint opaque 256-bit upload capability, return durable next contiguous chunk number |
| Immutable source chunk | `PUT /v1/solo-replays/:gameID/uploads/:uploadID/chunks/:index` | At most 64 logical turns and 1 MiB serialized; SHA-256; atomic database pointer only after private object-store write; same hash/sequence idempotent; different bytes rejected (409) |
| Late hash batch | `PUT /v1/solo-replays/:gameID/uploads/:uploadID/hashes` | Hashes bound to committed tick range; same (tick, hash) accepted, changed hash rejected; never rewrite game commands |
| Finalize | `POST /v1/solo-replays/:gameID/uploads/:uploadID/finalize` | Owner only; ensure contiguous full length and original first winner; idempotent |
| List/read | `GET /v1/solo-replays`, `GET /v1/solo-replays/:gameID/manifest`, `GET /v1/solo-replays/:gameID/chunks/:index` | Private to owner, no public lookup, no guessing-based access, short-lived signed links only to authorized session |
| Delete | `DELETE /v1/solo-replays/:gameID` | Owner or account-deletion flow; tombstone immediately, revoke capabilities, asynchronously purge blobs/backups per retention policy |
| Explicit share/revoke | `POST /v1/solo-replays/:gameID/shares`, `DELETE /v1/solo-replays/:gameID/shares/:id` | Off by default, random 256-bit capability, optional TTL/revocation, avoid leaking via referrers/indexers/logs |

Do not trust a `gameID` as authentication. Bind all records to an authoritative owner user ID; never accept ownerID, access tier, immutable config, build identity or winner changes from client-supplied update bodies. The browser's Solo engine is not an authoritative anti-cheat service, so identify imported replays as unverified user recordings rather than server-attested game results. Preserve original official archive and XP path exactly once, never double award.

Proposed DB invariants: unique `(owner_id, game_id)`; unique `(game_id, chunk_index)` with digest, byte count and immutable source range; unique `(game_id, turn)` for hashes; CAS revision for `committed_chunk_count`; `first_winner`/tick write-once after first authenticated upload; `last_committed_turn` monotonic; finalized bit irreversible; source build/manifest immutable. On conflict or expired/revoked capability return specific 401/403/409/413/429 errors and retain local journal for retry/export.

**Initial quotas for planning, not provisioned values:** request body <= 1 MiB/chunk, <= 64 ticks/chunk, max source 2 million ticks, <= 500 MiB stored per game and <= 2 GiB per owner, >= 24-hour idempotency retention, upload rate limit by owner/IP, unfinalized upload expiry and a documented owner-selected retention policy. Budget separately for PUT counts, GET/egress, DB transactions, backups, snapshots and replay downloads: `monthly cost = GB-month stored × storage price + operation count × price + GB egress × price + compute + backup`. The actual price and retention choice require an owned vendor account and explicit configuration.

## Area scaling vs true high-quality 10×

Current nearest-neighbor scaler is deterministic and recomputes coast flags, but **it does not create geographic detail**. A new rendering path must preserve tile-to-click correspondence and replay hashes. Do not make tactical resolution silently coarser.

### Concrete baseline derived from checked-in Giant World manifest

| Giant World Normal area | Approximate source/destination | Logical cells | Safety status |
| --- | --- | --- | --- |
| 1× | 4,108 × 1,948 | 8,002,384 | Existing |
| 8× | about 11,619 × 5,510 | about 64.0 million | Fits 64.1M guard, but GPU/memory NOT verified |
| 9× | about 12,324 × 5,844 | about 72.0 million | Refused |
| 10× | about 12,991 × 6,160 | about 80.0 million | Refused |

The engine's immutable packed terrain `Uint8Array` + ownership/state `Uint16Array` alone cost **3 bytes/cell**: at Giant 10×, at least **240 MB decimal** (~229 MiB), before independently held client/worker maps, transient scale buffers, WebGL textures, simulation caches, render layers, pathfinding, snapshot/replay and peak GC copies. The actual limit is significantly higher than 3 bytes/cell. On WebGL implementations with `MAX_TEXTURE_SIZE = 8192`, even the ~11.6k-wide 8× texture cannot be allocated as one texture; a 16,384-device may fit the dimension but still fail memory. The existing 64.1M CPU cap is necessary, not sufficient.

### High-quality implementation directions and acceptance gates

1. **Real performance evidence:** `.github/workflows/pr3-map-perf.yml` runs same-seed, 64-tick, 10-bot Pangaea 1×, 4× and 10× headless with CPU/heap footprint traces. Treat hosted runner as a baseline only, not a measurement of the owner's GPU. Run Giant World 1×/6×/8× on a measured Mac after initial CPU results; avoid 9×/10× Giant allocation before algorithm redesign.
2. **Memory ledger:** instrument per-tile allocations (terrain/state/ownership, generator input/output, minimap, client worker transfer, WebGL render/color/state/overlay textures, temporary coast scan buffers, pathfinding caches). Measure startup p50/p95, JS+RSS peak, live 64-tick p50/p95, GC pauses, context loss and FPS/frame-time p95.
3. **Tiled GPU spike:** cap physical texture tile width/height under measured `MAX_TEXTURE_SIZE`, add 1px borders where sampling needs neighbors, derive deterministic tile→chunk coordinates, and update only dirty texture rectangles; test click-hit mapping across seams and water-nuke/railroad effects. Maintain logical full-resolution state until proven safe. Do not simply change the global tile guard.
4. **Visual geography:** use existing source data for honest source detail; prototype anti-aliased coast/path boundaries or validated higher-resolution vector map generation. Measure coastline silhouette displacement (<1 logical source-cell where applicable), nation coordinate consistency and border continuity. Distinguish visual LOD from tactical simulation resolution.
5. **Determinism:** fixed seed + build across 1×/4×/10× supported maps; test hash parity between actual simulation and locally recorded/replayed turns, nation spawns, impassable geography, water nuke terrain modifications, minimap/world transforms and all major rendering paths. Only after complete tests and Mac RAM/GPU headroom may a larger Giant World cap be proposed.

## Verification ledger

- **PASS:** exact official v0.35.2 merge, real GitHub Action [39311331279](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39311331279), commit `c558732504a7c460d328ea23d60ca2be25d7b067`.
- **PASS:** real Chromium IndexedDB fixture [39312933139](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39312933139), 1,000 turns, first winner at 200, turn 999 persists across reload, compressed export/import in isolated second browser profile. **Not** a player-driven game UI/replay-renderer acceptance.
- **RECORDED CI FAILURES:** integration workflow YAML initially invalid (repaired); after tag merge, initial formatter/generated-map jobs found unformatted new docs; cloud protocol initially caused TS1308 (repaired); browser first test timed out due nested Vite HTML routing (repaired); oxlint `||` in browser harness (repaired). Formatter one-shot [39313372741](https://github.com/LeviCade/OpenFrontIO-X/actions/runs/39313372741) applied repository formatting and removed temporary write-enabled integration workflows.
- **PENDING:** fresh full 8-job CI result on final PR3 head, final cloud fake-backend tests, fresh Chromium following latest UI changes, bounded map CPU benchmarks.
- **NOT VERIFIED:** real Solo UI win→Keep Playing→full playback/render; actual deployable owner-controlled cloud; cross-device by ID; 7×–10× Giant World physical GPU/fps/RAM; tiled rendering or new coastline detail. PR #3 stays DRAFT.
