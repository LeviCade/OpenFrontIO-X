import { MapMetadata } from "@openfront/engine-api/game/MapFiles";

/** Total-area choices. Each axis grows by approximately sqrt(multiplier). */
export type MapAreaMultiplier = 1 | 2 | 3 | 4 | 5 | 6;

export const MAP_AREA_MULTIPLIERS: readonly MapAreaMultiplier[] = [
  1, 2, 3, 4, 5, 6,
];

/** Cap deterministic CPU allocations before constructing the game state. */
export const MAX_MULTIPLIED_MAP_TILES = 64_000_000;

export interface ScaledTerrain {
  metadata: MapMetadata;
  bytes: Uint8Array;
}

const LAND = 0x80;
const SHORE = 0x40;
const MAGNITUDE = 0x1f;
const IMPASSABLE = 31;

/** Count transitions to water or passable land, excluding impassable void. */
function coastNeighbor(bytes: Uint8Array, index: number, land: boolean): boolean {
  const tile = bytes[index];
  const neighborLand = (tile & LAND) !== 0;
  return (
    neighborLand !== land &&
    !(neighborLand && (tile & MAGNITUDE) === IMPASSABLE)
  );
}

export function assertMapAreaMultiplier(
  value: number,
): asserts value is MapAreaMultiplier {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error(`Map area multiplier must be an integer from 1 to 6: ${value}`);
  }
}

function checkDimensions(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > MAX_MULTIPLIED_MAP_TILES
  ) {
    throw new Error(
      `Map dimensions ${width}x${height} exceed the ${MAX_MULTIPLIED_MAP_TILES}-tile budget`,
    );
  }
}

/**
 * Scale packed terrain deterministically with integer nearest-neighbor samples.
 * Recalculates only shoreline bits; land/ocean/height/depth/impassable bits
 * come from the source. Never writes into the input or its metadata.
 * At 1x, preserves the *exact* byte-array and metadata references.
 */
export function scaleTerrainGrid(
  bytes: Uint8Array,
  metadata: MapMetadata,
  multiplier: MapAreaMultiplier,
  dimensions?: { width: number; height: number },
): ScaledTerrain {
  assertMapAreaMultiplier(multiplier);
  const { width, height } = metadata;
  checkDimensions(width, height);
  if (bytes.length !== width * height) {
    throw new Error(
      `Map terrain buffer length ${bytes.length} does not match ${width}x${height}`,
    );
  }
  if (multiplier === 1) {
    if (
      dimensions !== undefined &&
      (dimensions.width !== width || dimensions.height !== height)
    ) {
      throw new Error("Cannot override terrain dimensions at 1x");
    }
    return { bytes, metadata };
  }

  const targetWidth =
    dimensions?.width ?? Math.max(1, Math.round(width * Math.sqrt(multiplier)));
  const targetHeight =
    dimensions?.height ?? Math.max(1, Math.round(height * Math.sqrt(multiplier)));
  checkDimensions(targetWidth, targetHeight);
  if (targetWidth < width || targetHeight < height) {
    throw new Error("Map multiplier may not shrink terrain dimensions");
  }

  const scaled = new Uint8Array(targetWidth * targetHeight);
  const sourceX = new Uint32Array(targetWidth);
  for (let x = 0; x < targetWidth; x++) {
    sourceX[x] = Math.min(width - 1, Math.floor((x * width) / targetWidth));
  }

  let landTiles = 0;
  for (let y = 0; y < targetHeight; y++) {
    const sourceRow =
      Math.min(height - 1, Math.floor((y * height) / targetHeight)) * width;
    const dstRow = y * targetWidth;
    for (let x = 0; x < targetWidth; x++) {
      const terrain = bytes[sourceRow + sourceX[x]];
      scaled[dstRow + x] = terrain & ~SHORE;
      if ((terrain & LAND) !== 0 && (terrain & MAGNITUDE) !== IMPASSABLE) {
        landTiles++;
      }
    }
  }

  // The source shore flag describes 4-connected adjacency. Duplicating it
  // would incorrectly mark interior pixels of stretched shore cells as coast.
  // Water next to impassable void does not constitute a shoreline.
  for (let y = 0; y < targetHeight; y++) {
    const row = y * targetWidth;
    for (let x = 0; x < targetWidth; x++) {
      const index = row + x;
      const terrain = scaled[index];
      const land = (terrain & LAND) !== 0;
      if (land && (terrain & MAGNITUDE) === IMPASSABLE) continue;
      if (
        (x > 0 && coastNeighbor(scaled, index - 1, land)) ||
        (x + 1 < targetWidth && coastNeighbor(scaled, index + 1, land)) ||
        (y > 0 && coastNeighbor(scaled, index - targetWidth, land)) ||
        (y + 1 < targetHeight &&
          coastNeighbor(scaled, index + targetWidth, land))
      ) {
        scaled[index] |= SHORE;
      }
    }
  }

  return {
    bytes: scaled,
    metadata: {
      width: targetWidth,
      height: targetHeight,
      num_land_tiles: landTiles,
    },
  };
}

/** Map a source tile's center onto a destination tile without overflowing. */
export function scaleTileCoordinate(
  coordinate: [number, number],
  source: Pick<MapMetadata, "width" | "height">,
  target: Pick<MapMetadata, "width" | "height">,
): [number, number] {
  return [
    Math.max(
      0,
      Math.min(
        target.width - 1,
        Math.floor(((coordinate[0] + 0.5) * target.width) / source.width),
      ),
    ),
    Math.max(
      0,
      Math.min(
        target.height - 1,
        Math.floor(((coordinate[1] + 0.5) * target.height) / source.height),
      ),
    ),
  ];
}

/** Scale a spawn rectangle by its boundaries to preserve occupied coverage. */
export function scaleSpawnArea(
  area: { x: number; y: number; width: number; height: number },
  source: Pick<MapMetadata, "width" | "height">,
  target: Pick<MapMetadata, "width" | "height">,
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(
    0,
    Math.min(target.width - 1, Math.floor((area.x * target.width) / source.width)),
  );
  const y = Math.max(
    0,
    Math.min(target.height - 1, Math.floor((area.y * target.height) / source.height)),
  );
  const right = Math.min(
    target.width,
    Math.ceil(((area.x + area.width) * target.width) / source.width),
  );
  const bottom = Math.min(
    target.height,
    Math.ceil(((area.y + area.height) * target.height) / source.height),
  );
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}
