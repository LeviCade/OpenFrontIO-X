import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { describe, expect, it } from "vitest";

/**
 * Headless real-runner smoke test. A browser/WebGL manual acceptance test is
 * still necessary: this only drives the actual game simulation through turns.
 */
describe("multiplied map real game runner", () => {
  it("initializes a 2x private game with bots and advances ticks", async () => {
    const width = 64;
    const height = 64;
    const main = new Uint8Array(width * height).fill(0x80);
    const mini = new Uint8Array((width / 2) * (height / 2)).fill(0x80);
    const tiny = new Uint8Array((width / 4) * (height / 4)).fill(0x80);

    const map: MapFiles = {
      map: GameMapType.World,
      mapSize: GameMapSize.Normal,
      manifest: {
        name: "2x synthetic game",
        map: { width, height, num_land_tiles: main.length },
        map4x: {
          width: width / 2,
          height: height / 2,
          num_land_tiles: mini.length,
        },
        map16x: {
          width: width / 4,
          height: height / 4,
          num_land_tiles: tiny.length,
        },
        nations: [],
      },
      mapBin: main,
      map4xBin: mini,
      map16xBin: tiny,
    };

    const config: GameConfig = {
      gameMap: GameMapType.World,
      gameMapSize: GameMapSize.Normal,
      mapAreaMultiplier: 2,
      gameType: GameType.Singleplayer,
      gameMode: GameMode.FFA,
      difficulty: Difficulty.Medium,
      nations: "disabled",
      bots: 4,
      donateGold: false,
      donateTroops: false,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: true,
    };
    const start: GameStartInfo = {
      gameID: "openfront-2x-headless-smoke",
      lobbyCreatedAt: 0,
      config,
      players: [],
    };

    let updates = 0;
    const runner = await createGameRunner(start, undefined, map, (update) => {
      if ("updates" in update) updates++;
    });

    expect([runner.game.width(), runner.game.height()]).toEqual([91, 91]);
    expect([
      runner.game.miniMap().width(),
      runner.game.miniMap().height(),
    ]).toEqual([46, 46]);
    expect(runner.game.map().numLandTiles()).toBe(91 * 91);
    for (let turnNumber = 0; turnNumber < 24; turnNumber++) {
      runner.addTurn({ turnNumber, intents: [] });
      expect(runner.executeNextTick()).toBe(true);
    }
    expect(runner.game.ticks()).toBe(24);
    expect(updates).toBe(24);
    expect(runner.game.players().length).toBeGreaterThan(0);
  });
});
