/** Geometry-only planning for hybrid physical + virtual world scaling.
 *
 * Requested perceived area A may need a little real grid resolution P when
 * a mechanically important footprint would otherwise be sub-tile. At 100×
 * perceived area, a radius-4 spawn needs at least 7× physical area to retain
 * one full simulation tile: 4*sqrt(7/100) >= 1.
 *
 * The result is NOT permission to allocate terrain or GPU resources. The
 * runtime must also measure memory/FPS and get explicit acceptance before
 * enabling adaptive physical resolution.
 */
import { MAX_MULTIPLIED_MAP_TILES } from "./MapMultiplier";
import { assertVirtualWorldArea } from "./VirtualWorldScale";

export interface HybridWorldResolutionPlan {
  requestedArea: number;
  /** Minimum integer physical area needed to keep the selected footprint >=1 tile. */
  requiredPhysicalArea: number;
  /** Geometry-feasible recommendation only; never automatically allocate. */
  feasiblePhysicalArea: number | null;
  /** Remainder for a future hybrid engine; may be fractional. */
  residualVirtualArea: number | null;
  predictedFootprintRadius: number | null;
  requiresHigherResolution: boolean;
  rejection: "physical-cap" | "tile-budget" | "texture-limit" | null;
}

/** Real target physical dimensions use the same rounding as MapMultiplier. */
export function planHybridWorldResolution(
  perceivedArea: number,
  mapWidth: number,
  mapHeight: number,
  hardwareMaxTextureSize: number,
  footprintRadius = 4,
  minimumFootprintTiles = 1,
): HybridWorldResolutionPlan {
  assertVirtualWorldArea(perceivedArea);
  if (
    !Number.isSafeInteger(mapWidth) ||
    !Number.isSafeInteger(mapHeight) ||
    mapWidth < 1 ||
    mapHeight < 1 ||
    !Number.isSafeInteger(hardwareMaxTextureSize) ||
    hardwareMaxTextureSize < 1 ||
    !Number.isFinite(footprintRadius) ||
    footprintRadius <= 0 ||
    !Number.isFinite(minimumFootprintTiles) ||
    minimumFootprintTiles <= 0
  ) {
    throw new Error("Invalid physical map geometry or minimum footprint");
  }
  const requiredPhysicalArea = Math.max(
    1,
    Math.ceil(
      perceivedArea * (minimumFootprintTiles / footprintRadius) ** 2,
    ),
  );
  const rejected = (
    rejection: HybridWorldResolutionPlan["rejection"],
  ): HybridWorldResolutionPlan => ({
    requestedArea: perceivedArea,
    requiredPhysicalArea,
    feasiblePhysicalArea: null,
    residualVirtualArea: null,
    predictedFootprintRadius: null,
    requiresHigherResolution: requiredPhysicalArea > 1,
    rejection,
  });
  if (requiredPhysicalArea > 20) return rejected("physical-cap");

  const width = Math.round(mapWidth * Math.sqrt(requiredPhysicalArea));
  const height = Math.round(mapHeight * Math.sqrt(requiredPhysicalArea));
  if (width * height > MAX_MULTIPLIED_MAP_TILES) {
    return rejected("tile-budget");
  }
  if (width > hardwareMaxTextureSize || height > hardwareMaxTextureSize) {
    return rejected("texture-limit");
  }
  return {
    requestedArea: perceivedArea,
    requiredPhysicalArea,
    feasiblePhysicalArea: requiredPhysicalArea,
    residualVirtualArea: perceivedArea / requiredPhysicalArea,
    predictedFootprintRadius:
      footprintRadius * Math.sqrt(requiredPhysicalArea / perceivedArea),
    requiresHigherResolution: requiredPhysicalArea > 1,
    rejection: null,
  };
}
