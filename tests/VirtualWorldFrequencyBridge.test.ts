import type { GameMap } from "@openfront/engine-api/game/GameMap";
import { GameType } from "@openfront/engine-api/game/GameTypes";
import { TrainStationExecution, factorySpawnDenominator, factorySpawnCooldown } from "@openfront/engine/execution/TrainStationExecution";
import { bridgeWaterSpanWithinRange } from "@openfront/engine/game/RailNetworkImpl";
import { AStarRail } from "@openfront/engine/pathfinding/algorithms/AStar.Rail";
import { describe, expect, it, vi } from "vitest";

describe("Factory Multiplier changes frequency, not train payload", () => {
  it("divides the expected spawn interval and hard cooldown by stack level", () => {
    expect(factorySpawnDenominator(100, 1)).toBe(100);
    expect(factorySpawnDenominator(100, 2)).toBe(50);
    expect(factorySpawnDenominator(100, 3)).toBe(34);
    expect(factorySpawnDenominator(100, 100)).toBe(1);
    expect(factorySpawnCooldown(10, 1)).toBe(10);
    expect(factorySpawnCooldown(10, 2)).toBe(5);
    expect(factorySpawnCooldown(10, 3)).toBe(4);
    expect(factorySpawnCooldown(10, 100)).toBe(1);
  });

  it("dispatches precisely one ordinary train per successful spawn, at a shorter interval", () => {
    const owner = { unitCount: () => 2 };
    const unit = {
      setTrainStation: vi.fn(),
      level: () => 2,
      owner: () => owner,
    };
    const addExecution = vi.fn();
    const network = {};
    const game = {
      config: () => ({
        gameConfig: () => ({
          gameType: GameType.Singleplayer,
          specialOptions: { factoryMultiplier: true },
        }),
        trainSpawnRate: () => 100,
      }),
      unitCount: () => 0,
      railNetwork: () => network,
      addExecution,
    };
    const chance = vi.fn(() => true);
    const other = {};
    const cluster = {
      hasAnyTradeDestination: () => true,
      randomTradeDestination: () => other,
    };
    const station = { getCluster: () => cluster };
    const exec = new TrainStationExecution(unit as never, true) as any;
    exec.mg = game;
    exec.random = { chance };

    exec.spawnTrain(station, 5);
    expect(addExecution).toHaveBeenCalledTimes(1);
    expect(chance).toHaveBeenLastCalledWith(50);
    exec.spawnTrain(station, 9);
    expect(addExecution).toHaveBeenCalledTimes(1);
    exec.spawnTrain(station, 10);
    expect(addExecution).toHaveBeenCalledTimes(2);
    // No extra wagons/cargo/earnings are minted by factory stacking.
    expect(addExecution.mock.calls.every((call) =>
      call.length === 1 && call[0].constructor.name === "TrainExecution"
    )).toBe(true);
  });

  it("retains 10-tick cooldown and normal trials when the option is off", () => {
    const unit = {
      setTrainStation: vi.fn(),
      level: () => 2,
      owner: () => ({ unitCount: () => 2 }),
    };
    const addExecution = vi.fn();
    const game = {
      config: () => ({
        gameConfig: () => ({ gameType: GameType.Singleplayer, specialOptions: {} }),
        trainSpawnRate: () => 100,
      }),
      unitCount: () => 0,
      railNetwork: () => ({}),
      addExecution,
    };
    const chance = vi.fn(() => true);
    const station = {
      getCluster: () => ({
        hasAnyTradeDestination: () => true,
        randomTradeDestination: () => ({}),
      }),
    };
    const exec = new TrainStationExecution(unit as never, true) as any;
    exec.mg = game;
    exec.random = { chance };
    exec.spawnTrain(station, 5);
    exec.spawnTrain(station, 10);
    expect(addExecution).toHaveBeenCalledTimes(1);
    exec.spawnTrain(station, 15);
    expect(addExecution).toHaveBeenCalledTimes(2);
    expect(chance).toHaveBeenCalledWith(100);
  });
});

describe("Optional Long Rail Bridges", () => {
  // A narrow island-to-mainland sea channel with one open-water stretch.
  const map = {
    width: () => 10,
    height: () => 1,
    isWater: (t: number) => t >= 2 && t <= 7,
    isShoreline: (t: number) => t === 1 || t === 8,
    isImpassable: () => false,
  } as unknown as GameMap;

  it("leaves open water blocked by default and spans it only when opted in", () => {
    expect(new AStarRail(map).findPath(0, 9)).toBeNull();
    const bridge = new AStarRail(map, true).findPath(0, 9);
    expect(bridge).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("permits a water span up to factory radius, never beyond it", () => {
    const bridge = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(bridgeWaterSpanWithinRange(bridge, (tile) => map.isWater(tile), 6)).toBe(true);
    expect(bridgeWaterSpanWithinRange(bridge, (tile) => map.isWater(tile), 5)).toBe(false);
    expect(bridgeWaterSpanWithinRange([], () => true, 6)).toBe(true);
  });
});
