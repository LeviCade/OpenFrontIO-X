import { describe, expect, it } from "vitest";
import { EventBus } from "@openfront/shared/EventBus";
import { ZoomEvent } from "../../src/client/InputHandler";
import { TransformHandler } from "../../src/client/TransformHandler";
import { ReplayCamera } from "../../src/client/replay/ReplayCamera";
import type { GameView } from "../../src/client/view";

describe("giant-map view controls", () => {
  it("lets live gameplay scroll out until the whole enlarged world fits", () => {
    const game = { width: () => 12991, height: () => 6160 } as GameView;
    const canvas = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1200,
        height: 800,
      }),
    } as unknown as HTMLElement;
    const handler = new TransformHandler(game, new EventBus(), canvas);
    handler.centerAll(0.9);
    const fit = Math.min(1200 / 12991, 800 / 6160) * 0.9;
    handler.onZoom(new ZoomEvent(600, 400, 10000));
    expect(handler.scale).toBeCloseTo(fit, 7);
    expect(handler.scale).toBeLessThan(0.2);
  });

  it("lets the replay viewer use the full-map fit too", () => {
    const camera = new ReplayCamera(12991, 6160);
    camera.fit(1200, 800);
    const fit = camera.zoom;
    expect(fit).toBeLessThan(0.1);
    camera.zoomAt(600, 400, 0.1, 1200, 800);
    expect(camera.zoom).toBeCloseTo(fit, 7);
  });
});
