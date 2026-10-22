import { describe, expect, it } from "vitest";
import {
  GameType,
  PlayerType,
  TerrainType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { RailNetworkImpl } from "@openfront/engine/game/RailNetworkImpl";
import { Railroad } from "@openfront/engine/game/Railroad";
import { RailSpatialGrid } from "@openfront/engine/game/RailroadSpatialGrid";
import { TrainStation } from "@openfront/engine/game/TrainStation";
import { virtualInspectionZoomCap } from "@openfront/engine-lib/game/VirtualWorldScale";

function config(area: number): EngineConfig {
  return new EngineConfig(
    {
      gameType: GameType.Singleplayer,
      virtualWorldAreaMultiplier: area,
    } as GameConfig,
    false,
  );
}

describe("100× Virtual World geometry and troop economics", () => {
  it("charges perceived territory cost without altering the original 1× baseline", () => {
    const input = {
      terrain: TerrainType.Plains,
      attackTroops: 1_000_000,
      attacker: { type: PlayerType.Human, numTiles: 500 },
      defender: null,
      defenderHasDefensePost: false,
      falloutRatio: null,
      borderSize: 15,
    };
    const one = config(1).attackLogic(input);
    const hundred = config(100).attackLogic(input);
    expect(hundred.attackerTroopLoss).toBeCloseTo(
      one.attackerTroopLoss * 100,
    );
    expect(hundred.tickFraction).toBe(one.tickFraction);
    expect(hundred.defenderTroopLoss).toBe(0);
  });

  it("charges 100 perceived cells for a defended tile without removing defender troops 100 times", () => {
    const input = {
      terrain: TerrainType.Highland,
      attackTroops: 1_000_000,
      attacker: { type: PlayerType.Human, numTiles: 500 },
      defender: {
        type: PlayerType.Human,
        numTiles: 300,
        troops: 120_000,
        isTraitor: false,
        isDisconnectedTeammate: false,
      },
      defenderHasDefensePost: false,
      falloutRatio: null,
      borderSize: 15,
    };
    const one = config(1).attackLogic(input);
    const hundred = config(100).attackLogic(input);
    expect(hundred.attackerTroopLoss).toBeCloseTo(
      one.attackerTroopLoss * 100,
    );
    expect(hundred.defenderTroopLoss).toBe(one.defenderTroopLoss);
    expect(hundred.tickFraction).toBe(one.tickFraction);
  });

  it("scales factory reach, train spacing, warship zones and deep zoom", () => {
    const one = config(1);
    const hundred = config(100);
    expect(one.trainStationMaxRange()).toBe(110);
    expect(hundred.trainStationMaxRange()).toBe(11);
    expect(one.trainStationMinRange()).toBe(15);
    expect(hundred.trainStationMinRange()).toBe(2);
    expect(one.warshipTargettingRange()).toBe(130);
    expect(hundred.warshipTargettingRange()).toBe(13);
    expect(hundred.warshipPatrolRange()).toBe(10);
    expect(hundred.warshipDockingRange()).toBe(1);
    expect(hundred.warshipPassiveHealingRange()).toBe(15);
    expect(virtualInspectionZoomCap(1, 1)).toBe(20);
    expect(virtualInspectionZoomCap(20, 1)).toBeCloseTo(
      20 * Math.sqrt(20),
    );
    expect(virtualInspectionZoomCap(100, 100)).toBe(1000);
  });

  it("does not mistake a neighboring spatial-grid cell for a rail snap at 100×", () => {
    const game = {
      config: () => ({
        virtualWorldArea: () => 100,
        virtualWorldVisualScale: () => 0.1,
      }),
      x: (tile: number) => tile % 100,
      y: (tile: number) => Math.floor(tile / 100),
    };
    const network = new RailNetworkImpl(
      game as never,
      { addStation: () => {}, removeStation: () => {} } as never,
      { findTilePath: () => [], findStationsPath: () => [] } as never,
    );
    const rail = new Railroad({} as TrainStation, {} as TrainStation, [110], 1);
    (
      network as unknown as { railGrid: RailSpatialGrid }
    ).railGrid.register(rail);
    expect(network.overlappingRailroads(UnitType.Factory, 110)).toEqual([110]);
    expect(network.overlappingRailroads(UnitType.Factory, 111)).toEqual([]);
  });
});
