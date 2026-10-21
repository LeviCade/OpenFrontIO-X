/**
 * Pure, allocation-free map atlas planning for very large logical grids.
 *
 * This is a RENDERER SPIKE, not an enabled path. Game simulation and its
 * 64.1-million logical-tile guard remain unchanged.
 *
 * A halo gives a future shader nearest-neighbor/linear samples access to
 * adjacent coastline texels without seams. Uploaders must clamp missing
 * outer-edge texels and copy only the sourceRect into each texture.
 */
export interface TextureChunk {
  id: number;
  column: number;
  row: number;
  /** Logical map extent (not including the halo). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** GPU allocation dimensions including reserved halo. */
  textureWidth: number;
  textureHeight: number;
  /** Actual in-map source pixels to copy into the texture. */
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  /** Placement of source pixels into the halo-extended texture. */
  destinationX: number;
  destinationY: number;
}

export interface TextureChunkPlan {
  mapWidth: number;
  mapHeight: number;
  maxTextureSize: number;
  halo: number;
  interior: number;
  columns: number;
  rows: number;
  chunks: TextureChunk[];
}

/**
 * O(chunks), independent of tile count. Never allocates an entire map.
 * `maxTextureSize` must come from the *actual* GPU, not a guessed tier.
 */
export function planTextureChunks(
  mapWidth: number,
  mapHeight: number,
  maxTextureSize: number,
  halo = 1,
): TextureChunkPlan {
  for (const [name, value] of [
    ["mapWidth", mapWidth],
    ["mapHeight", mapHeight],
    ["maxTextureSize", maxTextureSize],
    ["halo", halo],
  ] as const) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${name} must be a safe integer`);
    }
  }
  if (mapWidth < 1 || mapHeight < 1 || halo < 0) {
    throw new Error("Invalid map dimensions or texture halo");
  }
  if (maxTextureSize < 2 * halo + 1) {
    throw new Error("GPU texture limit leaves no usable interior");
  }
  if (!Number.isSafeInteger(mapWidth * mapHeight)) {
    throw new Error("Map tile indexing exceeds safe integer precision");
  }
  const interior = maxTextureSize - 2 * halo;
  const columns = Math.ceil(mapWidth / interior);
  const rows = Math.ceil(mapHeight / interior);
  if (columns * rows > 1_000_000) {
    throw new Error("Map requires too many GPU texture chunks");
  }
  const chunks: TextureChunk[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = column * interior;
      const y = row * interior;
      const width = Math.min(interior, mapWidth - x);
      const height = Math.min(interior, mapHeight - y);
      const sourceX = Math.max(0, x - halo);
      const sourceY = Math.max(0, y - halo);
      const sourceRight = Math.min(mapWidth, x + width + halo);
      const sourceBottom = Math.min(mapHeight, y + height + halo);
      chunks.push({
        id: row * columns + column,
        column,
        row,
        x,
        y,
        width,
        height,
        textureWidth: width + 2 * halo,
        textureHeight: height + 2 * halo,
        sourceX,
        sourceY,
        sourceWidth: sourceRight - sourceX,
        sourceHeight: sourceBottom - sourceY,
        destinationX: halo - (x - sourceX),
        destinationY: halo - (y - sourceY),
      });
    }
  }
  return {
    mapWidth,
    mapHeight,
    maxTextureSize,
    halo,
    interior,
    columns,
    rows,
    chunks,
  };
}

/** Exact tile->atlas interior routing. No floating-point map coordinates. */
export function findTextureChunk(
  plan: TextureChunkPlan,
  x: number,
  y: number,
): { chunk: TextureChunk; localX: number; localY: number } {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= plan.mapWidth ||
    y >= plan.mapHeight
  ) {
    throw new Error("Tile outside map bounds");
  }
  const column = Math.floor(x / plan.interior);
  const row = Math.floor(y / plan.interior);
  const chunk = plan.chunks[row * plan.columns + column];
  return {
    chunk,
    localX: x - chunk.x + plan.halo,
    localY: y - chunk.y + plan.halo,
  };
}
