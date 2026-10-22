/** Conservative, allocation-free preflight for extended logical map areas.
 *
 * This is a feasibility planner, NOT permission to lift engine safety guards.
 * The byte counts are strictly LOWER BOUNDS, based on concrete allocations:
 *   GameMapImpl terrain Uint8 + tile state Uint16                   =  3 B/tile
 *   GPU resources: tile R16UI + trail R16UI + heat R8 + heat R8  =  6 B/tile
 *   TerrainPass RGBA8 + BorderComputePass RGBA8 + Defense R8     =  9 B/tile
 * Other duplicated client/worker state, minimap, JS arrays, GPU passes, atlas
 * halos, WebGL render targets and transient buffers are intentionally OMITTED.
 */
import {
  MAX_MULTIPLIED_MAP_TILES,
  type MapAreaMultiplier,
} from "./MapMultiplier";
import { planTextureChunks, type TextureChunkPlan } from "./TextureChunkPlan";

const CPU_CORE_BYTES_PER_TILE = 3;
const GPU_CORE_BYTES_PER_TILE = 15;

export interface ExtendedMapFeasibility {
  multiplier: MapAreaMultiplier;
  width: number;
  height: number;
  tiles: number;
  cpuCoreBytesLowerBound: number;
  gpuCoreBytesLowerBound: number;
  combinedCoreBytesLowerBound: number;
  withinExistingSafetyBudget: boolean;
  requiresGpuTiling: boolean;
  /** Render-only hypothetical partition, not wired into the live pipeline. */
  texturePlan: TextureChunkPlan;
}

export function estimateExtendedMap(
  sourceWidth: number,
  sourceHeight: number,
  multiplier: MapAreaMultiplier,
  maxTextureSize: number,
): ExtendedMapFeasibility {
  if (
    !Number.isSafeInteger(sourceWidth) ||
    !Number.isSafeInteger(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    throw new Error("Source map dimensions must be positive safe integers");
  }
  const axis = Math.sqrt(multiplier);
  const width = Math.max(1, Math.round(sourceWidth * axis));
  const height = Math.max(1, Math.round(sourceHeight * axis));
  const tiles = width * height;
  if (!Number.isSafeInteger(tiles)) {
    throw new Error("Scaled map tile count exceeds safe integer precision");
  }
  const texturePlan = planTextureChunks(width, height, maxTextureSize);
  return {
    multiplier,
    width,
    height,
    tiles,
    cpuCoreBytesLowerBound: tiles * CPU_CORE_BYTES_PER_TILE,
    gpuCoreBytesLowerBound: tiles * GPU_CORE_BYTES_PER_TILE,
    combinedCoreBytesLowerBound:
      tiles * (CPU_CORE_BYTES_PER_TILE + GPU_CORE_BYTES_PER_TILE),
    withinExistingSafetyBudget: tiles <= MAX_MULTIPLIED_MAP_TILES,
    requiresGpuTiling:
      width > maxTextureSize || height > maxTextureSize,
    texturePlan,
  };
}
