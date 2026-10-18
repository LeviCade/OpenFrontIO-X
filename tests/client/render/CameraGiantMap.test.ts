import { afterEach, describe, expect, it, vi } from "vitest";
import { Camera } from "../../../src/client/render/gl/Camera";

describe("Camera: giant map zoom-to-fit", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("allows repeated zoom-out to a full 10x Giant World view", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const camera = new Camera(12991, 6160);
    camera.resize(1200, 800);
    const fit = camera.zoom;
    expect(fit).toBeLessThan(0.2);
    expect(fit).toBeGreaterThan(0);
    camera.zoomBy(2);
    expect(camera.zoom).toBeGreaterThan(fit);
    camera.zoomBy(0.1);
    expect(camera.zoom).toBeCloseTo(fit, 7);
    camera.zoomTo(0.0001);
    expect(camera.zoom).toBeCloseTo(fit, 7);
    camera.zoomAtScreen(0.5, 600, 400);
    expect(camera.zoom).toBeCloseTo(fit, 7);
    expect([...camera.getMatrix()].every(Number.isFinite)).toBe(true);
  });

  it("keeps the original 0.2 zoom floor on smaller maps", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const camera = new Camera(500, 250);
    camera.resize(1200, 800);
    camera.zoomTo(0.001);
    expect(camera.zoom).toBe(0.2);
  });
});
