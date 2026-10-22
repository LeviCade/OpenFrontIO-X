import { describe, expect, it } from "vitest";
import { estimateExtendedMap } from "@openfront/engine-lib/game/ExtendedMapFeasibility";

describe("full-resolution Giant World area feasibility (planning only)", () => {
  const sourceWidth = 4108;
  const sourceHeight = 1948;

  it("measures real 10x logical grid, safety gate and 4096 GPU seams", () => {
    const e = estimateExtendedMap(sourceWidth, sourceHeight, 10, 4096);
    expect([e.width, e.height, e.tiles]).toEqual([
      12991, 6160, 80_024_560,
    ]);
    expect(e.withinExistingSafetyBudget).toBe(false);
    expect(e.requiresGpuTiling).toBe(true);
    expect([e.texturePlan.columns, e.texturePlan.rows]).toEqual([4, 2]);
    expect(e.cpuCoreBytesLowerBound).toBe(80_024_560 * 3);
    expect(e.gpuCoreBytesLowerBound).toBe(80_024_560 * 15);
    expect(e.combinedCoreBytesLowerBound).toBe(80_024_560 * 18);
  });

  it("measures real 20x logical grid, mandatory tiling even on 16k GPU", () => {
    const e = estimateExtendedMap(sourceWidth, sourceHeight, 20, 16384);
    expect([e.width, e.height, e.tiles]).toEqual([
      18372, 8712, 160_056_864,
    ]);
    expect(e.withinExistingSafetyBudget).toBe(false);
    expect(e.requiresGpuTiling).toBe(true);
    expect([e.texturePlan.columns, e.texturePlan.rows]).toEqual([2, 1]);
    expect(e.gpuCoreBytesLowerBound).toBe(2_400_852_960);
  });

  it("distinguishes the tile budget from a GPU's maximum texture size", () => {
    const e = estimateExtendedMap(sourceWidth, sourceHeight, 8, 8192);
    expect(e.tiles).toBe(64_020_690);
    expect(e.withinExistingSafetyBudget).toBe(true);
    expect(e.requiresGpuTiling).toBe(true);
    expect(e.texturePlan.chunks.length).toBe(2);
  });

  it("does not require GPU tiling on small 20x maps that fit", () => {
    const e = estimateExtendedMap(128, 128, 20, 4096);
    expect(e.width).toBe(572);
    expect(e.height).toBe(572);
    expect(e.withinExistingSafetyBudget).toBe(true);
    expect(e.requiresGpuTiling).toBe(false);
    expect(e.texturePlan.chunks).toHaveLength(1);
  });

  it("rejects malformed geometry and unusable GPU texture limits", () => {
    expect(() => estimateExtendedMap(-1, 1948, 10, 4096)).toThrow(
      "Source map dimensions",
    );
    expect(() => estimateExtendedMap(4108, 1948, 10, 2)).toThrow(
      "usable interior",
    );
  });
});
