import { describe, expect, it } from "vitest";
import { GameConfigPatchSchema } from "@openfront/engine-api/Schemas";
import {
  advanceVirtualPace,
  assertVirtualWorldArea,
  virtualLinearScale,
  virtualSpawnRadius,
  virtualTicksPerMove,
  virtualVisualScale,
} from "@openfront/engine-lib/game/VirtualWorldScale";

describe("Virtual World 1×–100×, independent of physical terrain tiles", () => {
  it.each([1, 2, 4, 10, 20, 100])("accepts %ix as a finite integer", (area) => {
    expect(() => assertVirtualWorldArea(area)).not.toThrow();
    expect(virtualLinearScale(area)).toBeCloseTo(Math.sqrt(area));
    expect(virtualVisualScale(area)).toBeCloseTo(1 / Math.sqrt(area));
  });

  it.each([0, -1, 1.5, 101, Infinity, NaN])(
    "rejects invalid virtual area %s",
    (area) => {
      expect(() => assertVirtualWorldArea(area)).toThrow();
      expect(GameConfigPatchSchema.safeParse({
        virtualWorldAreaMultiplier: area,
      }).success).toBe(false);
    },
  );

  it("serializes area 100 separately from the physical map area", () => {
    const config = GameConfigPatchSchema.parse({
      mapAreaMultiplier: 1,
      virtualWorldAreaMultiplier: 100,
    });
    expect(config.mapAreaMultiplier).toBe(1);
    expect(config.virtualWorldAreaMultiplier).toBe(100);
    expect(GameConfigPatchSchema.parse({ mapAreaMultiplier: 1 })
      .virtualWorldAreaMultiplier).toBeUndefined();
  });

  it("has one-tile minimum spawn and slows grid travel at 100×", () => {
    expect(virtualSpawnRadius(1)).toBe(4);
    expect(virtualSpawnRadius(100)).toBe(1);
    expect(virtualTicksPerMove(1)).toBe(1);
    expect(virtualTicksPerMove(100)).toBe(10);
    expect(virtualVisualScale(100)).toBeCloseTo(0.1);
  });

  it("is deterministic with fixed-point fractional attack credit", () => {
    let credit = 0;
    let moves = 0;
    for (let tick = 0; tick < 100; tick++) {
      const step = advanceVirtualPace(100, credit);
      credit = step.credit;
      if (step.move) moves++;
    }
    expect(moves).toBe(10);
    expect(credit).toBe(0);
    expect(advanceVirtualPace(1, 0)).toEqual({ move: true, credit: 0 });
  });
});
