import { describe, expect, it } from "vitest";
import { planHybridWorldResolution } from "@openfront/engine-lib/game/HybridWorldResolution";

describe("adaptive hybrid world resolution (planning only)", () => {
  it("preserves 1× geometry when the footprint is already one tile", () => {
    const plan = planHybridWorldResolution(16, 64, 64, 4096);
    expect(plan.feasiblePhysicalArea).toBe(1);
    expect(plan.residualVirtualArea).toBe(16);
    expect(plan.requiresHigherResolution).toBe(false);
    expect(plan.predictedFootprintRadius).toBe(1);
  });

  it("uses exactly the minimum sevenfold physical area for 100× spawn", () => {
    const plan = planHybridWorldResolution(100, 64, 64, 4096);
    expect(plan.requiredPhysicalArea).toBe(7);
    expect(plan.feasiblePhysicalArea).toBe(7);
    expect(plan.residualVirtualArea).toBeCloseTo(100 / 7);
    expect(plan.predictedFootprintRadius).toBeGreaterThanOrEqual(1);
    expect(plan.rejection).toBeNull();
  });

  it("rejects a Giant World hybrid when GPU axis size cannot fit", () => {
    const plan = planHybridWorldResolution(100, 4108, 1948, 8192);
    expect(plan.requiredPhysicalArea).toBe(7);
    expect(plan.feasiblePhysicalArea).toBeNull();
    expect(plan.rejection).toBe("texture-limit");
  });

  it("reports geometry feasibility, not a claim of GPU memory safety", () => {
    const plan = planHybridWorldResolution(100, 4108, 1948, 16384);
    expect(plan.feasiblePhysicalArea).toBe(7);
    expect(plan.rejection).toBeNull();
  });

  it("refuses maps that exceed the unchanged full-grid safety cap", () => {
    const plan = planHybridWorldResolution(100, 6400, 6400, 16384);
    expect(plan.rejection).toBe("tile-budget");
  });

  it("cannot repair a one-tile radius at 100× within the physical cap", () => {
    const plan = planHybridWorldResolution(100, 64, 64, 16384, 1);
    expect(plan.requiredPhysicalArea).toBe(100);
    expect(plan.rejection).toBe("physical-cap");
  });

  it.each([0, 101, 2.3, NaN])("rejects virtual %s", (area) => {
    expect(() => planHybridWorldResolution(area, 64, 64, 4096)).toThrow();
  });
  it("rejects ungrounded dimensions and invalid hardware", () => {
    expect(() => planHybridWorldResolution(100, 0, 64, 4096)).toThrow();
    expect(() => planHybridWorldResolution(100, 64, 64, 0)).toThrow();
  });
});
