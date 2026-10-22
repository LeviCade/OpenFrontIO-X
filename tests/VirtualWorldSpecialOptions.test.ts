import { describe, expect, it } from "vitest";
import { GameType, UnitType, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig, GameConfigPatchSchema, BuildUnitIntentSchema } from "@openfront/engine-api/Schemas";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { extractNukeTelegraphs } from "../src/client/render/frame/derive/NukeTelegraphs";

const cfg = (area: number, specialOptions: { factoryMultiplier?: boolean; samMultiplier?: boolean; atomicMultiplier?: boolean } = {}) =>
  new EngineConfig({
    gameType: GameType.Singleplayer,
    virtualWorldAreaMultiplier: area,
    specialOptions,
  } as GameConfig, false);

describe("Special Options opt-in and Virtual World coverage geometry", () => {
  it("validates independent factory/SAM/atomic toggles and bounded blast intents", () => {
    expect(GameConfigPatchSchema.parse({
      specialOptions: { factoryMultiplier: true, samMultiplier: true, atomicMultiplier: true },
    }).specialOptions).toEqual({ factoryMultiplier: true, samMultiplier: true, atomicMultiplier: true });
    const intent = { type: "build_unit", unit: UnitType.AtomBomb, tile: 5, blastMultiplier: 4 };
    expect(BuildUnitIntentSchema.parse(intent).blastMultiplier).toBe(4);
    expect(BuildUnitIntentSchema.safeParse({ ...intent, blastMultiplier: 9 }).success).toBe(false);
    expect(BuildUnitIntentSchema.safeParse({ ...intent, blastMultiplier: 0 }).success).toBe(false);
    expect(BuildUnitIntentSchema.safeParse({ ...intent, blastMultiplier: 1.5 }).success).toBe(false);
  });

  it("preserves 1× and disabled SAM curves, while stacked SAMs add exact base radius", () => {
    expect(cfg(1).samRange(1)).toBe(70);
    expect(cfg(1).samRange(2)).toBeCloseTo(150 - 480 / 7);
    const stacked = cfg(1, { samMultiplier: true });
    expect(stacked.samRange(1)).toBe(70);
    expect(stacked.samRange(2)).toBe(140);
    expect(stacked.samRange(3)).toBe(210);
    expect(stacked.samRange(4)).toBe(280);
    const scaled = cfg(100, { samMultiplier: true });
    expect(scaled.samRange(1)).toBe(7);
    expect(scaled.samRange(2)).toBe(14);
    expect(scaled.samRange(4)).toBe(28);
  });

  it("uses realistic per-cell placement spacing at high virtual area", () => {
    expect(cfg(1).structureMinDist()).toBe(15);
    expect(cfg(100).structureMinDist()).toBe(1);
  });

  it("stacks atomic and hydrogen radii independently from number of missiles", () => {
    const normal = cfg(100);
    const special = cfg(100, { atomicMultiplier: true });
    expect(normal.nukeMagnitudes(UnitType.AtomBomb)).toEqual({
      inner: 1,
      outer: 3,
    });
    expect(special.nukeMagnitudes(UnitType.AtomBomb, 1)).toEqual({
      inner: 1,
      outer: 3,
    });
    expect(special.nukeMagnitudes(UnitType.AtomBomb, 4)).toEqual({
      inner: 4,
      outer: 12,
    });
    expect(special.nukeMagnitudes(UnitType.HydrogenBomb, 4)).toEqual({
      inner: 32,
      outer: 40,
    });
    expect(normal.nukeMagnitudes(UnitType.AtomBomb, 4)).toEqual(
      normal.nukeMagnitudes(UnitType.AtomBomb),
    );
    expect(special.nukeMagnitudes(UnitType.MIRVWarhead, 4)).toEqual(
      special.nukeMagnitudes(UnitType.MIRVWarhead),
    );
    expect(
      cfg(1, { atomicMultiplier: true }).nukeMagnitudes(
        UnitType.HydrogenBomb,
        2,
      ).outer,
    ).toBe(200);
  });

  it("does not alter starting manpower, income, or per-building price", () => {
    const one = cfg(1);
    const special = cfg(100, {
      factoryMultiplier: true,
      samMultiplier: true,
      atomicMultiplier: true,
    });
    const input = {
      type: () => PlayerType.Human,
      numTilesOwned: () => 500,
      unitsOwned: () => 0,
      unitsConstructed: () => 0,
      units: () => [],
      isLobbyCreator: () => false,
      troops: () => 10_000,
    };
    expect(
      special.startManpower({ playerType: PlayerType.Human } as never),
    ).toBe(one.startManpower({ playerType: PlayerType.Human } as never));
    expect(special.goldAdditionRate(input as never)).toBe(
      one.goldAdditionRate(input as never),
    );
    expect(
      special.unitInfo(UnitType.Factory).cost!({} as never, input as never),
    ).toBe(one.unitInfo(UnitType.Factory).cost!({} as never, input as never));
  });

  it("makes in-flight nuclear telegraph use configured area and selected radius", () => {
    const special = cfg(100, { atomicMultiplier: true });
    const unit = {
      id: 2,
      ownerID: 3,
      unitType: UnitType.AtomBomb,
      targetTile: 505,
      isActive: true,
      waitTicks: 0,
      blastMultiplier: 4,
    };
    const result = extractNukeTelegraphs(
      new Map([[2, unit as never]]),
      100,
      0,
      undefined,
      0,
      undefined,
      0,
      (type, multiplier) =>
        special.nukeMagnitudes(type as UnitType, multiplier),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      innerRadius: 4,
      outerRadius: 12,
      x: 5,
      y: 5,
    });
  });
});
