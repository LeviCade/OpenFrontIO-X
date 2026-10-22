import { describe, expect, it } from "vitest";
import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig, GameConfigPatchSchema } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
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
      expect(
        GameConfigPatchSchema.safeParse({
          virtualWorldAreaMultiplier: area,
        }).success,
      ).toBe(false);
    },
  );

  it("serializes area 100 separately from the physical map area", () => {
    const config = GameConfigPatchSchema.parse({
      mapAreaMultiplier: 1,
      virtualWorldAreaMultiplier: 100,
    });
    expect(config.mapAreaMultiplier).toBe(1);
    expect(config.virtualWorldAreaMultiplier).toBe(100);
    expect(
      GameConfigPatchSchema.parse({ mapAreaMultiplier: 1 })
        .virtualWorldAreaMultiplier,
    ).toBeUndefined();
  });

  it("has one-tile minimum spawn and slows grid travel at 100×", () => {
    expect(virtualSpawnRadius(1)).toBe(4);
    expect(virtualSpawnRadius(100)).toBe(1);
    expect(virtualTicksPerMove(1)).toBe(1);
    expect(virtualTicksPerMove(100)).toBe(10);
    expect(virtualVisualScale(100)).toBeCloseTo(0.1);
  });

  it("scales defensive gameplay ranges at 100× and preserves 1× rules", () => {
    const makeConfig = (area: number) =>
      new Config(
        {
          gameType: GameType.Singleplayer,
          virtualWorldAreaMultiplier: area,
        } as GameConfig,
        false,
      );
    const normal = makeConfig(1);
    const virtual100 = makeConfig(100);

    expect(normal.defensePostRange()).toBe(30);
    expect(virtual100.defensePostRange()).toBe(3);

    expect(normal.samRange(1)).toBe(70);
    expect(normal.samRange(5)).toBe(102);
    expect(normal.maxSamRange()).toBe(150);
    expect(virtual100.samRange(1)).toBeCloseTo(7);
    expect(virtual100.samRange(5)).toBeCloseTo(10.2);
    expect(virtual100.maxSamRange()).toBe(15);
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
