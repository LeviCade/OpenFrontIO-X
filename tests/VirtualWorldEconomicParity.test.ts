import { describe, expect, it } from "vitest";
import {
  GameType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";

function config(area: number): EngineConfig {
  return new EngineConfig(
    {
      gameType: GameType.Singleplayer,
      virtualWorldAreaMultiplier: area,
    } as GameConfig,
    false,
  );
}

function player(tiles: number, cityLevels = 0, troops = 100_000) {
  return {
    numTilesOwned: () => tiles,
    type: () => PlayerType.Human,
    troops: () => troops,
    isLobbyCreator: () => false,
    units: () =>
      cityLevels
        ? [{ level: () => cityLevels, isUnderConstruction: () => false }]
        : [],
    unitsOwned: () => 0,
    unitsConstructed: () => 0,
  };
}

describe("Virtual World economic parity without baseline inflation", () => {
  it.each([1, 4, 10, 20, 100])(
    "uses %i perceived territory cells in the normal sublinear troop cap",
    (area) => {
      const cfg = config(area);
      const p = player(1_000);
      expect(cfg.effectiveTilesOwned(p as never)).toBe(1_000 * area);
      const expected = 2 * (Math.pow(1_000 * area, 0.6) * 1000 + 50000);
      expect(cfg.maxTroops(p as never)).toBeCloseTo(expected, 2);
      expect(cfg.maxTroopsWithoutCities(p as never)).toBeCloseTo(expected, 2);
    },
  );

  it("preserves 250,000 capacity per city level rather than scaling cities by area", () => {
    for (const area of [1, 10, 100]) {
      const cfg = config(area);
      const without = cfg.maxTroops(player(500) as never);
      const withCities = cfg.maxTroops(player(500, 2) as never);
      expect(withCities - without).toBeCloseTo(2 * cfg.cityTroopIncrease(), 6);
      expect(cfg.cityTroopIncrease()).toBe(250_000);
    }
  });

  it("regenerates toward the territory-adjusted cap, with no added base-income multiplier", () => {
    const p = player(1_000, 0, 200_000);
    const one = config(1);
    const virtual100 = config(100);
    expect(virtual100.maxTroops(p as never)).toBeGreaterThan(
      one.maxTroops(p as never),
    );
    expect(virtual100.troopIncreaseRate(p as never)).toBeGreaterThan(
      one.troopIncreaseRate(p as never),
    );
    expect(virtual100.troopIncreaseRate(p as never)).toBeLessThan(
      virtual100.maxTroops(p as never),
    );
  });

  it("leaves starting troops, passive gold, train reward, and construction prices unchanged", () => {
    const p = player(1_000);
    const start = { playerType: PlayerType.Human, isLobbyCreator: false };
    const normal = config(1);
    const hundred = config(100);
    expect(hundred.startManpower(start as never)).toBe(
      normal.startManpower(start as never),
    );
    expect(hundred.startManpower(start as never)).toBe(25_000);
    expect(hundred.goldAdditionRate(p as never)).toBe(
      normal.goldAdditionRate(p as never),
    );
    expect(hundred.goldAdditionRate(p as never)).toBe(100n);
    expect(hundred.trainGold("self", 0, p as never)).toBe(
      normal.trainGold("self", 0, p as never),
    );
    expect(hundred.unitInfo(UnitType.City).cost!({} as never, p as never)).toBe(
      normal.unitInfo(UnitType.City).cost!({} as never, p as never),
    );
    expect(hundred.unitInfo(UnitType.Port).cost!({} as never, p as never)).toBe(
      normal.unitInfo(UnitType.Port).cost!({} as never, p as never),
    );
  });

  it("awards the same gold for an equally long perceived trade voyage", () => {
    const p = player(1_000);
    const normal = config(1);
    expect(config(100).tradeShipGold(45, p as never)).toBe(
      normal.tradeShipGold(450, p as never),
    );
    expect(config(4).tradeShipGold(150, p as never)).toBe(
      normal.tradeShipGold(300, p as never),
    );
    expect(normal.tradeShipGold(45, p as never)).toBe(
      config(1).tradeShipGold(45, p as never),
    );
  });
});
