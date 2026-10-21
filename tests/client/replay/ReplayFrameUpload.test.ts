import type { FrameData } from "../../../src/client/render/types";
import {
  uploadReplayFrame,
  type ReplayFrameUploadTarget,
} from "../../../src/client/replay/ReplayFrameUpload";

/** Record the calls relevant to territory changes; other uploads are no-ops. */
function harness() {
  const calls: string[] = [];
  const view = {
    uploadLiveDelta: (_tiles: Uint16Array, refs: readonly number[]) =>
      calls.push(`delta:${refs.join(",")}`),
    uploadTileAndTrailState: () => calls.push("full"),
    flushReplayTileDeltas: () => calls.push("flush"),
    uploadLiveTrailDelta: () => {},
    updateSpiralRibbons: () => {},
    uploadRailroadState: () => {},
    applyRailroadDust: () => {},
    updateUnits: () => {},
    updateStructures: () => {},
    applyDeadUnits: () => {},
    applyConquestEvents: () => {},
    applyBonusEvents: () => {},
    updateAttackRings: () => {},
    updateNukeTelegraphs: () => {},
    updateNames: () => {},
    updateRelations: () => {},
    setSAMAllianceClusters: () => {},
  } as ReplayFrameUploadTarget;
  const tileState = new Uint16Array(16);
  const frame = (changedTiles: number[] | null) =>
    ({
      tick: 5,
      changedTiles,
      tileState,
      trailState: new Uint16Array(16),
      trailDirtyRowMax: -1,
      spiralRibbons: [],
      railroadDirty: false,
      units: new Map(),
      structuresDirty: false,
      events: { deadUnits: [], conquestEvents: [], bonusEvents: [] },
      attackRings: [],
      nukeTelegraphs: [],
      names: new Map(),
      players: new Map(),
      playerStatus: new Map(),
      relationsDirty: false,
      allianceClusters: new Map(),
    }) as unknown as FrameData;
  return { calls, view, frame };
}

describe("ReplayFrameUpload", () => {
  it("presents each normal playback delta before the displayed replay frame", () => {
    const { calls, view, frame } = harness();
    uploadReplayFrame(view, frame([2, 5]), false);
    expect(calls).toEqual(["delta:2,5", "flush"]);
    calls.length = 0;
    uploadReplayFrame(view, frame([7]), false);
    expect(calls).toEqual(["delta:7", "flush"]);
  });

  it("does not leave older pending drip buckets behind on an empty delta", () => {
    const { calls, view, frame } = harness();
    uploadReplayFrame(view, frame([]), false);
    expect(calls).toEqual(["flush"]);
  });

  it("seeking uses a complete terrain state, not the live delta drip", () => {
    const { calls, view, frame } = harness();
    uploadReplayFrame(view, frame(null), true);
    expect(calls).toEqual(["full"]);
  });
});
