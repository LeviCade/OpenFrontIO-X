import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { GameConfigPatchSchema } from "@openfront/engine-api/Schemas";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { describe, expect, it } from "vitest";

function makeFiles(mapSize: GameMapSize): MapFiles {
  // Four columns, split into two passable land and two ocean columns.
  const mapBin = new Uint8Array([
    0x80, 0x80, 0x20, 0x20, 0x80, 0x80, 0x20, 0x20, 0x80, 0x80, 0x20, 0x20,
    0x80, 0x80, 0x20, 0x20,
  ]);
  return {
    map: GameMapType.World,
    mapSize,
    manifest: {
      name: "synthetic",
      map: { width: 4, height: 4, num_land_tiles: 8 },
      map4x: { width: 2, height: 2, num_land_tiles: 2 },
      map16x: { width: 1, height: 1, num_land_tiles: 1 },
      nations: [{ name: "East", coordinates: [3, 3] }],
      additionalNations: [{ name: "West", coordinates: [0, 0] }],
      teamGameSpawnAreas: {
        red: [{ x: 2, y: 2, width: 2, height: 2 }],
      },
    },
    mapBin,
    map4xBin: new Uint8Array([0x80, 0x20, 0x80, 0x20]),
    map16xBin: new Uint8Array([0x80]),
  };
}

describe("Map Multiplier terrain-loader integration", () => {
  it("does not change the legacy 1x normal map", async () => {
    const files = makeFiles(GameMapSize.Normal);
    const game = await loadTerrainMap(files);
    expect([game.gameMap.width(), game.gameMap.height()]).toEqual([4, 4]);
    expect([game.miniGameMap.width(), game.miniGameMap.height()]).toEqual([
      2, 2,
    ]);
    expect(game.gameMap.numLandTiles()).toBe(8);
    expect(game.nations[0].coordinates).toEqual([3, 3]);
    expect(
      Array.from({ length: 16 }, (_, i) => game.gameMap.terrainByte(i)),
    ).toEqual(Array.from(files.mapBin!));
  });

  it("expands normal map and minimap, nation and team area for 2x", async () => {
    const files = makeFiles(GameMapSize.Normal);
    const game = await loadTerrainMap(files, 2);
    expect([game.gameMap.width(), game.gameMap.height()]).toEqual([6, 6]);
    expect([game.miniGameMap.width(), game.miniGameMap.height()]).toEqual([
      3, 3,
    ]);
    expect(game.gameMap.numLandTiles()).toBe(18);
    expect(game.nations[0].coordinates).toEqual([5, 5]);
    expect(game.additionalNations[0].coordinates).toEqual([0, 0]);
    expect(game.teamGameSpawnAreas?.red).toEqual([
      { x: 3, y: 3, width: 3, height: 3 },
    ]);
    expect(files.manifest.nations[0].coordinates).toEqual([3, 3]);
    expect(files.mapBin?.length).toBe(16);
    expect(game.gameMap.isShoreline(game.gameMap.ref(2, 0))).toBe(true);
    expect(game.gameMap.isShoreline(game.gameMap.ref(0, 0))).toBe(false);
  });

  it("divides compact coordinates exactly once, then applies multiplier", async () => {
    const files = makeFiles(GameMapSize.Compact);
    const game = await loadTerrainMap(files, 2);
    expect([game.gameMap.width(), game.gameMap.height()]).toEqual([3, 3]);
    expect([game.miniGameMap.width(), game.miniGameMap.height()]).toEqual([
      2, 2,
    ]);
    expect(game.gameMap.numLandTiles()).toBe(6);
    expect(game.nations[0].coordinates).toEqual([2, 2]);
    expect(game.teamGameSpawnAreas?.red).toEqual([
      { x: 1, y: 1, width: 2, height: 2 },
    ]);
    expect(files.manifest.nations[0].coordinates).toEqual([3, 3]);
    expect(files.manifest.teamGameSpawnAreas?.red[0]).toEqual({
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    });
  });

  it("loads 20x small real terrain, minimap, and nation coordinates", async () => {
    const files = makeFiles(GameMapSize.Normal);
    const game = await loadTerrainMap(files, 20);
    expect([game.gameMap.width(), game.gameMap.height()]).toEqual([18, 18]);
    expect([game.miniGameMap.width(), game.miniGameMap.height()]).toEqual([
      9, 9,
    ]);
    expect(game.nations[0].coordinates).toEqual([15, 15]);
    expect(game.additionalNations[0].coordinates).toEqual([2, 2]);
    expect(files.manifest.map.width).toBe(4);
  });

  it("parses optional area factor in old and new game patches", () => {
    expect(GameConfigPatchSchema.parse({}).mapAreaMultiplier).toBeUndefined();
    for (const multiplier of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 20]) {
      expect(
        GameConfigPatchSchema.parse({ mapAreaMultiplier: multiplier })
          .mapAreaMultiplier,
      ).toBe(multiplier);
    }
    expect(
      GameConfigPatchSchema.safeParse({ mapAreaMultiplier: 0 }).success,
    ).toBe(false);
    expect(
      GameConfigPatchSchema.safeParse({ mapAreaMultiplier: 21 }).success,
    ).toBe(false);
    expect(
      GameConfigPatchSchema.safeParse({ mapAreaMultiplier: 2.5 }).success,
    ).toBe(false);
    expect(
      GameConfigPatchSchema.parse({ winPercentage: 100 }).winPercentage,
    ).toBe(100);
    expect(
      GameConfigPatchSchema.parse({ winPercentage: 1 }).winPercentage,
    ).toBe(1);
    expect(GameConfigPatchSchema.safeParse({ winPercentage: 0 }).success).toBe(
      false,
    );
    expect(
      GameConfigPatchSchema.safeParse({ winPercentage: 101 }).success,
    ).toBe(false);
    expect(
      GameConfigPatchSchema.safeParse({ winPercentage: 50.5 }).success,
    ).toBe(false);
  });
});
