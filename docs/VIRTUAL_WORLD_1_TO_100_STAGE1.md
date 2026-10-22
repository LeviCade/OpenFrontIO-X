# Virtual World 1×–100× — Stage 1, experimental

**October 22, 2026. Draft PR #5** stacked on draft PR #4, `feature/virtual-world-1-100-stage1`. **NOT production ready, not pixel/tactics-equivalent to a physically 100× map.** The user's working PR3 and PR4 Mac worktrees remain unchanged.

## Product interaction

- Solo map configuration now has **Virtual (default)** and **Physical** tabs and **one numeric 1–100× input** (default 1).
- In Virtual mode: `mapAreaMultiplier=1` and `virtualWorldAreaMultiplier=A`; existing terrain bytes and physical grid sizes remain 1× regardless of A. All maps can *request* A up to 100 without exceeding the physical tile multiplier budget. Some rules/sprites remain subject to one-tile limits.
- In Physical mode: `mapAreaMultiplier=1..20` (user input capped at 20; the pre-start safety check rejects any dimensions exceeding **64,100,000 physical tiles**). `virtualWorldAreaMultiplier=1`.
- The values are separate state fields while toggling so switching modes doesn't silently convert a virtual 100 into an illegal physical 100.
- The wire field `virtualWorldAreaMultiplier` is optional and bounded by `zb.uint({min:1,max:100})` for deterministic zbin binary encoding. Old saves/replays without this field represent virtual A=1. Non-Solo `Config.virtualWorldArea()` returns 1 even when confronted with untrusted values in config.
- Zoom limit grows from 20× in regular games up to **200×** in virtual 100× (a bounded camera capability, not more tile detail).

## Mathematical intent

Virtual area `A` corresponds to linear factor `L=√A`. `1/L` is a proposed scale for world-space geometric speed, visual sprite sizes, attack-front velocity, blast radius and starting territory radius. A=100 => L=10: **same map grid** with ~10× slower macro-scale movement. This is not the same as making every gameplay clock 100× slower.

Perceived size is a design goal, **not perfect parity**: one physical tile cannot contain 100 independent subtiles. A spawn with physical 4-tile radius at virtual 100× becomes 0.4 tile, clamped to a minimum playable radius of 1. At 100×, borders move in visually discrete full-tile jumps; currently fractional fixed-point pacing makes those jumps occur roughly once per 10 turns for one active attack, not a smooth continuous sub-tile animation.

## Engine and rendering integrations *implemented in this increment*

- `VirtualWorldScale.ts`: explicit bounded A, L, inverse visual scale, spawn radius, integer ticks-per-move and deterministic fixed-point per-attack progress. Bad/out-of-range values rejected.
- `EngineConfig` and `Config`: virtual mode accessor, smaller minimum spawn distance, selected nuclear travel speed, SAM/targetable range, blast inner/outer footprint, structure separation. Full weapon/range audit remains open.
- `SpawnExecution` and `Util`: dynamically sized spawn BFS with one-tile minimum. Both manual and random starting spawns honor virtual scale.
- `AttackExecution`: optional snapshot-stored virtual pacing credit; normal A=1 behavior preserved. **Initial implementation is discrete tick skipping** and must be calibrated for per-attack speed and semantics. No false claims of perfectly smooth conquest.
- `TransportShipExecution`: existing `ticksPerMove` follows virtual L; recorded motion plans/snapshots have matching tick step.
- `TradeShipExecution`: independent ticks-per-move/last-move with optional backward-compatible snapshot fields; motion plans reflect cadence. Needs physical Mac playback testing.
- GPU render pass icon scaling: mobile units including trains, transports, trading ships, warships, missiles/nukes; static cities, factories, ports, forts etc.; railroad line thickness; and nuke trajectory strokes. The underlying terrain and player-name text are not scaled.
- `Camera.ts`: proportional deeper camera zoom with a bounded cap of 200×; regular 1× stays capped at 20×.

## Explicitly not complete / unsafe to claim

- Proportional scaling in **every** render pass: structure level badges, attack trails, SAM overlays, explosions, shells/particle FX, defensive radius previews, paths, building placement indicators, minimap icons, music/notifications, hover hitboxes and selection targets remain to be audited and visually tested.
- All strategy rules and economy: bot choices, troop regeneration/growth, trade income, cities/factories efficiency, high-level nukes/MIRV/SAM launchers, warship range/patrol/repair, trains/rail behavior, nation spawns and victory duration. Initial rule changes are a prototype.
- Real *smooth* territory expansion below one tile per tick: demands a virtual sub-tile visual overlay or a multi-resolution simulation design; existing world tiles cannot split.
- Replay acceptance: real Mac gameplay, 100× Solo win, Keep Playing, exit/reopen, deterministic replay engine hashes, recorded unit movement plans, sustained CPU/FPS/camera behavior. Passing Vitest does **not** establish these behaviors.
- Physical Giant World 10× still exceeds unchanged engine cap, even when the UI says 1–100 Virtual; separate PR #4 renderer/tiling effort stands.
- Multiplayer/public game compatibility: Virtual intended **Solo only**. Do not enable in competitive servers without versioned protocol negotiation.

## Verification and next work

- `tests/VirtualWorldScale.test.ts`: values 1/2/4/10/20/100, bounds, legacy defaults, deterministic fixed-point pacing.
- `tests/MapMultiplierGameplay.test.ts`: real 100× virtual Solo tick/bot smoke with the untouched 64×64 physical grid, alongside prior 2× and 20× physical test.
- `tests/client/render/CameraVirtualWorld.test.ts`: zoom cap invariants.
- GitHub Actions full-build, format/lint, map generator and all 3 test shards required at **the final commit**. No implementation pass can be called complete before all gates green.

**Recommended next isolated engineering pass:** physical Mac A=1 vs 10 vs 100 side-by-side, recording video and performance; scale still-missing FX/hitboxes and visual overlays; smooth territory expansion; balance AI/trade/economy; snapshot/motion-plan consistency; optional browser acceptance automation, then guarded merge review. Keep all stacked PRs draft.

## Quieter Mac local Solo testing

The user's attached Oct 22 server log ran ~60 min and was dominated by failed polls to absent `localhost:8787` cosmetics/reserved tags and repeated missing lobby-service `ECONNREFUSED`, not a reported OOM or replay-processing crash. For Solo development, after correct **Node 24 + npm 12** dependency installation, use `npm run start:client` instead of `npm run dev` if no local server-backed features are required. This avoids starting the full server, workers and noisy fake public lobbies. It may not support server-backed functions; fall back to `npm run dev` when needed.

Do not run blind `npm audit fix --force`; review transitive and exploitable dependencies separately.
