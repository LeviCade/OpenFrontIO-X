# OpenFrontIO-X Map Multiplier roadmap

Status: **planning / branch scaffold**. The docs do not constitute a working feature.

## v0.1 - Baseline and 2x proof (do first)

- [ ] Confirm repo is independent and \`origin\` points ONLY to \`LeviCade/OpenFrontIO-X\`.
- [ ] Run pristine baseline: environment, \`npm run inst\`, \`npm run typecheck\`, \`npm test\`, \`npm run dev\`; record results.
- [ ] Inventory every terrain load path: client worker, server/headless, renderer cache, replay/save/snapshot.
- [ ] Make a pure deterministic typed-array scaler and metadata/spawn transformer, without modifying source assets.
- [ ] Add unit tests (1x identity, small known grid 2x, land/shore/ocean/impassable, compact, spawn areas, bounds).
- [ ] Run an **actual 2x single-player game** on a small map, verify bots/combat and record screenshots/logs.
- [ ] Compare 1x vs 2x performance and correctness with the same map/seed.
- [ ] Update DEVLOG with commit, tests and known issues.

Gate: 2x must be **playable**, not merely render a bigger image.

## v0.2 - Config and selector

- [ ] Add authoritative config to schemas and deterministic game start, default 1x.
- [ ] Add 1x/2x/3x/4x/5x/6x selector near map selection.
- [ ] Ensure lobby/match state, preview and in-game UI agree on selected factor.
- [ ] Fix cache identity, minimap and layer mapping; test compact vs normal.
- [ ] Safeguard unmodified upstream public/ranked matches (1x only).
- [ ] Confirm old saved/replay configs still parse as 1x.

Gate: 1x exact compatibility + selected 2x stable through UI/game start.

## v0.3 - 3x through 6x / performance

- [ ] Stress-test each factor in order: 3x, 4x, 5x, 6x.
- [ ] Inspect MAX_TEXTURE_SIZE, full-map GPU textures, rendering memory; chunk/render-tile as needed.
- [ ] Benchmark Giant World and at least one small map at representative FPS/tick/load/memory thresholds established from hardware baseline.
- [ ] Evaluate simulation balance and any dimension-dependent algorithms.
- [ ] Ensure errors are graceful on unsupported map/device configurations.
- [ ] Report a compatibility matrix with pass/fail for each factor and reason.

Gate: don't market a factor as working until gameplay + deterministic tests + representative performance pass.

## v0.4 - Multiplayer, reliability and open source

- [ ] Verify server authoritative config and deterministic client/server agreement.
- [ ] Verify repeatable replay/snapshots and absence of desync.
- [ ] Validate deployment without official services or inappropriate proprietary asset reuse.
- [ ] CI checks (typecheck, tests, lint, formatting, build) and targeted multiplier regression tests.
- [ ] Readme/how-to and install/run documentation for community users.
- [ ] Define review policy for regularly incorporating changes from official OpenFront.
- [ ] Prepare a PR **only within LeviCade/OpenFrontIO-X** for the implementation.

Gate: one playable open-source build, documented limitations and repeatable tests.

## Deferred

- 7x-10x and higher area multipliers.
- More detailed shorelines/new geographic source data.
- Chrome extension/userscript.
- Submission of any PR to official \`openfrontio/OpenFrontIO\`.

## Completion contract for the GPT-6 Sol engineering session

Implement as far through v0.1-v0.4 as feasible **in that session**. Execute tests and report evidence. Never represent an untested checkbox as complete. Append detailed handoff notes on what remains (file paths and commands) even if all engineering cannot be finished in one pass.
