import { GameMap } from "@openfront/engine-api/game/GameMap";
import {
  GameMapSize,
  TeamGameSpawnAreas,
} from "@openfront/engine-api/game/GameTypes";
import {
  AdditionalNation,
  MapFiles,
  MapLayer,
  MapMetadata,
  Nation,
} from "@openfront/engine-api/game/MapFiles";
import { GameMapImpl } from "./GameMapImpl";
import {
  MapAreaMultiplier,
  scaleSpawnArea,
  scaleTerrainGrid,
  scaleTileCoordinate,
} from "./MapMultiplier";

export type TerrainMapData = {
  nations: Nation[];
  additionalNations: AdditionalNation[];
  gameMap: GameMap;
  miniGameMap: GameMap;
  teamGameSpawnAreas?: TeamGameSpawnAreas;
  /** Map layers from the manifest, if any. */
  layers?: MapLayer[];
};

/**
 * Builds the maps from a map's files, which it takes over: the maps keep
 * the bins as their terrain and compact maps scale the manifest in place.
 * Pass files nothing else reads.
 */
export async function loadTerrainMap(
  files: MapFiles,
  multiplier: MapAreaMultiplier = 1,
): Promise<TerrainMapData> {
  const { map, mapSize } = files;
  // 1x intentionally follows the unmodified loader path, including its
  // historic Compact manifest conversion. Larger games own a deep-enough
  // manifest copy so cached source coordinates cannot be mutated.
  const manifest =
    multiplier === 1
      ? files.manifest
      : {
          ...files.manifest,
          nations: files.manifest.nations.map((nation) => ({
            ...nation,
            coordinates: nation.coordinates?.slice() as
              | [number, number]
              | undefined,
          })),
          additionalNations: files.manifest.additionalNations?.map(
            (nation) => ({
              ...nation,
              coordinates: nation.coordinates?.slice() as
                | [number, number]
                | undefined,
            }),
          ),
        };
  const sourceMain =
    mapSize === GameMapSize.Normal ? manifest.map : manifest.map4x;
  const sourceMini =
    mapSize === GameMapSize.Normal ? manifest.map4x : manifest.map16x;
  const bin = (data: Uint8Array | undefined, name: string) => {
    if (data === undefined) throw new Error(`${name} of ${map} was not passed`);
    return data;
  };

  const originalMain = bin(
    mapSize === GameMapSize.Normal ? files.mapBin : files.map4xBin,
    mapSize === GameMapSize.Normal ? "map.bin" : "map4x.bin",
  );
  const originalMini = bin(
    mapSize === GameMapSize.Normal ? files.map4xBin : files.map16xBin,
    mapSize === GameMapSize.Normal ? "map4x.bin" : "map16x.bin",
  );
  const main = scaleTerrainGrid(originalMain, sourceMain, multiplier);
  // The pathfinder's MiniMapTransformer divides coordinates by two.
  // Scale the minimap too and use ceil(width / 2) so odd destination
  // dimensions never produce an out-of-range minimap tile.
  const mini =
    multiplier === 1
      ? { metadata: sourceMini, bytes: originalMini }
      : scaleTerrainGrid(originalMini, sourceMini, multiplier, {
          width: Math.ceil(main.metadata.width / 2),
          height: Math.ceil(main.metadata.height / 2),
        });
  const gameMap = await genTerrainFromBin(main.metadata, main.bytes);
  const miniMap = await genTerrainFromBin(mini.metadata, mini.bytes);

  if (mapSize === GameMapSize.Compact) {
    manifest.nations.forEach((nation) => {
      if (nation.coordinates !== undefined) {
        nation.coordinates = [
          Math.floor(nation.coordinates[0] / 2),
          Math.floor(nation.coordinates[1] / 2),
        ];
      }
    });
    manifest.additionalNations?.forEach((nation) => {
      if (nation.coordinates !== undefined) {
        nation.coordinates = [
          Math.floor(nation.coordinates[0] / 2),
          Math.floor(nation.coordinates[1] / 2),
        ];
      }
    });
  }

  // Scale spawn areas for compact maps
  let teamGameSpawnAreas = manifest.teamGameSpawnAreas;
  if (mapSize === GameMapSize.Compact && teamGameSpawnAreas) {
    const scaled: TeamGameSpawnAreas = {};
    for (const [key, areas] of Object.entries(teamGameSpawnAreas)) {
      scaled[key] = areas.map((a) => ({
        x: Math.floor(a.x / 2),
        y: Math.floor(a.y / 2),
        width: Math.max(1, Math.floor(a.width / 2)),
        height: Math.max(1, Math.floor(a.height / 2)),
      }));
    }
    teamGameSpawnAreas = scaled;
  }

  if (multiplier !== 1) {
    // The Compact conversion above already divided coordinates / areas by
    // two. Transform from that actual source grid into the new game grid.
    for (const nation of [
      ...manifest.nations,
      ...(manifest.additionalNations ?? []),
    ]) {
      if (nation.coordinates !== undefined) {
        nation.coordinates = scaleTileCoordinate(
          nation.coordinates,
          sourceMain,
          main.metadata,
        );
      }
    }
    if (teamGameSpawnAreas) {
      const scaled: TeamGameSpawnAreas = {};
      for (const [key, areas] of Object.entries(teamGameSpawnAreas)) {
        scaled[key] = areas.map((area) =>
          scaleSpawnArea(area, sourceMain, main.metadata),
        );
      }
      teamGameSpawnAreas = scaled;
    }
  }

  const layers = manifest.layers;

  // Validate layer placements and alpha at game start.
  if (layers) {
    for (const layer of layers) {
      if (layer.placement !== "land" && layer.placement !== "water") {
        throw new Error(
          `Map ${map}: layer "${layer.id}" has invalid placement "${layer.placement}" (must be "land" or "water")`,
        );
      }
      if (
        layer.alpha !== undefined &&
        (!Number.isFinite(layer.alpha) || layer.alpha < 0 || layer.alpha > 1)
      ) {
        throw new Error(
          `Map ${map}: layer "${layer.id}" has invalid alpha ${layer.alpha} (must be a finite number between 0 and 1)`,
        );
      }
    }
  }

  return {
    nations: manifest.nations,
    additionalNations: manifest.additionalNations ?? [],
    gameMap: gameMap,
    miniGameMap: miniMap,
    teamGameSpawnAreas,
    layers,
  };
}

export async function genTerrainFromBin(
  mapData: MapMetadata,
  data: Uint8Array,
): Promise<GameMap> {
  if (data.length !== mapData.width * mapData.height) {
    throw new Error(
      `Invalid data: buffer size ${data.length} incorrect for ${mapData.width}x${mapData.height} terrain plus 4 bytes for dimensions.`,
    );
  }

  return new GameMapImpl(
    mapData.width,
    mapData.height,
    data,
    mapData.num_land_tiles,
  );
}
