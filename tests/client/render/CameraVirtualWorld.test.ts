import { describe, expect, it } from "vitest";
import { Camera } from "../../../src/client/render/gl/Camera";

describe("Camera virtual 1×–100× inspection depth", () => {
  it("preserves the original 20× camera cap in an ordinary world", () => {
    const camera = new Camera(1000, 500);
    camera.zoomTo(1000);
    expect(camera.zoom).toBe(20);
  });

  it("allows 200× inspection zoom in a virtual 100× world", () => {
    const camera = new Camera(1000, 500, 100);
    camera.zoomTo(1000);
    expect(camera.zoom).toBe(200);
    camera.zoomBy(0.5);
    expect(camera.zoom).toBe(100);
  });

  it("bounds zoom on ordinary physically multiplied maps too", () => {
    const camera = new Camera(1000, 500, 20);
    camera.zoomTo(1000);
    expect(camera.zoom).toBeCloseTo(20 * Math.sqrt(20));
  });
});
