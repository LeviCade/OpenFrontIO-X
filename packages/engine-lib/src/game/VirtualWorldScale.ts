/** Virtual world area scale keeps the original logical terrain/grid.
 *
 * An area multiplier A changes the *perceived* length of a map by sqrt(A).
 * Unlike physical mapAreaMultiplier, this NEVER allocates more terrain tiles.
 * These helpers only establish deterministic initial pacing. All affected
 * simulation and rendering systems require their own explicit integration.
 */
export type WorldScaleMode = "virtual" | "physical";
export const MAX_VIRTUAL_WORLD_AREA = 100;

export const MAX_VIRTUAL_INSPECTION_ZOOM = 1000;

/**
 * The simulation has A times the perceived terrain area without A times the
 * grid cells. Allow extra magnification so a player can actually target small
 * virtual structures, rather than stopping at the original 20× HUD limit.
 * Physical mode retains its existing sqrt(area) zoom behavior.
 */
export function virtualInspectionZoomCap(
  perceivedArea: number,
  virtualArea = 1,
): number {
  if (
    !Number.isFinite(perceivedArea) ||
    perceivedArea < 1 ||
    !Number.isFinite(virtualArea) ||
    virtualArea < 1
  ) {
    throw new Error("Invalid perceived or virtual world area");
  }
  return Math.min(
    MAX_VIRTUAL_INSPECTION_ZOOM,
    20 * Math.sqrt(perceivedArea) * Math.sqrt(virtualArea),
  );
}

/** Fail closed on invalid or fractional input; old records default to 1. */
export function assertVirtualWorldArea(area: number): asserts area is number {
  if (
    !Number.isSafeInteger(area) ||
    area < 1 ||
    area > MAX_VIRTUAL_WORLD_AREA
  ) {
    throw new Error("Virtual world area must be an integer from 1 to 100");
  }
}

export function virtualLinearScale(area: number): number {
  assertVirtualWorldArea(area);
  return Math.sqrt(area);
}

/** For tile-based visual assets, never permit the sprite to vanish entirely. */
export function virtualVisualScale(area: number): number {
  return 1 / virtualLinearScale(area);
}

/** UI hit testing is stricter than construction spacing. At 100× the
 * player must target the physical tile occupied by a tiny structure; a
 * distant neighboring building must never be upgraded by mistake.
 * Normal 1× retains the historical large interaction range.
 */
/** Precise world-space selection for moving units. With 100× Virtual
 * magnification, even warships must be clicked on their actual physical cell.
 */
export function virtualUnitPickRadius(area: number, normalRadius = 10): number {
  assertVirtualWorldArea(area);
  if (!Number.isSafeInteger(normalRadius) || normalRadius < 1) {
    throw new Error("Invalid unit selection radius");
  }
  if (area === 1) return normalRadius;
  return Math.max(0, Math.floor(normalRadius / Math.sqrt(area) - 0.5));
}

export function virtualStructurePickRadius(area: number): number {
  assertVirtualWorldArea(area);
  if (area === 1) return 15;
  return Math.max(0, Math.floor(6 / Math.sqrt(area) - 0.5));
}

/** Discrete start tiles cannot be subdivided; one-tile minimum is essential. */
export function virtualSpawnRadius(area: number): number {
  return Math.max(1, Math.round(4 / virtualLinearScale(area)));
}

/** Boat / missile movement interval for a first-pass grid-based pacing. */
export function virtualTicksPerMove(area: number): number {
  return Math.max(1, Math.round(virtualLinearScale(area)));
}

const PACE_UNITS = 1_000_000;

/** Fixed-point pacing avoids random/probabilistic skipping of conquest ticks.
 * Saved `credit` is an integer and must travel with the attack snapshot.
 * This is a discrete approximation to the physical-multiplier world velocity.
 */
export function advanceVirtualPace(
  area: number,
  credit: number,
): { move: boolean; credit: number } {
  assertVirtualWorldArea(area);
  if (!Number.isSafeInteger(credit) || credit < 0 || credit >= PACE_UNITS) {
    throw new Error("Invalid virtual pacing credit");
  }
  if (area === 1) return { move: true, credit: 0 };
  const next = credit + Math.round(PACE_UNITS / Math.sqrt(area));
  return next >= PACE_UNITS
    ? { move: true, credit: next - PACE_UNITS }
    : { move: false, credit: next };
}
