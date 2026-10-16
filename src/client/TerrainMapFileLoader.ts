import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  loadTerrainMap,
  TerrainMapData,
} from "@openfront/engine-lib/game/TerrainMapLoader";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { MapAreaMultiplier } from "@openfront/engine-lib/game/MapMultiplier";
import { FetchGameMapLoader } from "@openfront/shared/FetchGameMapLoader";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";

export const terrainMapFileLoader = new FetchGameMapLoader((path) =>
  assetUrl(`maps/${path}`),
);

const terrainMaps = new Map<string, TerrainMapData>();

/** The maps the client draws on, built once per map and size. */
export async function loadCachedTerrainMap(
  map: GameMapType,
  mapSize: GameMapSize,
  multiplier: MapAreaMultiplier = 1,
): Promise<TerrainMapData> {
  const key = `${map}:${mapSize}:${multiplier}`;
  const cached = terrainMaps.get(key);
  if (cached !== undefined) return cached;
  const terrain = await loadTerrainMap(
    await loadMapFiles(terrainMapFileLoader, map, mapSize),
    multiplier,
  );
  terrainMaps.set(key, terrain);
  return terrain;
}
