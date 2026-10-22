import { describe, expect, it } from "vitest";
import {
  packMotionPlans,
  unpackMotionPlans,
} from "@openfront/engine-lib/game/MotionPlans";
import { MotionPlanResolver } from "../src/client/view/MotionPlanResolver";

describe("Virtual World train motion, determinism and backward compatibility", () => {
  it("serializes a 100× virtual train interval and preserves ordinary 1×", () => {
    const train = {
      kind: "train" as const,
      engineUnitId: 1,
      carUnitIds: [2],
      planId: 1,
      startTick: 1,
      speed: 2,
      spacing: 2,
      ticksPerMove: 10,
      path: Array.from({ length: 100 }, (_, i) => i),
    };
    const decoded = unpackMotionPlans(packMotionPlans([train]));
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toMatchObject({
      ticksPerMove: 10,
      startTick: 1,
      speed: 2,
      spacing: 2,
    });
    const unscaled = unpackMotionPlans(packMotionPlans([{ ...train, ticksPerMove: 1 }]));
    expect(unscaled[0]).toMatchObject({ ticksPerMove: 1 });
  });

  it("decodes previously recorded train packets without the new interval field", () => {
    // 1 record; old train record has 2+7 fixed words, 1 car and 3 path cells.
    const oldPacket = Uint32Array.from([
      1, // number of plans
      2, 13, // kind train, word count
      1, 1, 1, 2, 2, 1, 3, // engine, plan id, start, speed, spacing, cars, path length
      2, 0, 1, 2, // car id, path
    ]);
    expect(unpackMotionPlans(oldPacket)[0]).toMatchObject({
      kind: "train",
      ticksPerMove: 1,
      speed: 2,
      spacing: 2,
    });
  });

  it("moves the train only once every ten ticks when Virtual is 100×", () => {
    const r = new MotionPlanResolver();
    const positions = new Map([[1, 0]]);
    const units = {
      tileOf: (id: number) => positions.get(id),
      move: (id: number, tile: number) => { positions.set(id, tile); },
      rest: () => {},
    };
    r.applyRecords([{
      kind: "train",
      engineUnitId: 1,
      carUnitIds: [],
      planId: 1,
      startTick: 1,
      speed: 2,
      spacing: 2,
      ticksPerMove: 10,
      path: Array.from({ length: 100 }, (_, i) => i),
    }]);
    for (let t = 1; t <= 9; t++) r.advance(t, units);
    expect(positions.get(1)).toBe(0);
    r.advance(10, units);
    expect(positions.get(1)).toBe(2);
    r.advance(19, units);
    expect(positions.get(1)).toBe(2);
    r.advance(20, units);
    expect(positions.get(1)).toBe(4);
  });
});
