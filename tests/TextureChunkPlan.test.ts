import { describe, expect, it } from "vitest";
import {
  findTextureChunk,
  planTextureChunks,
} from "../packages/engine-lib/src/game/TextureChunkPlan";

describe("10x render-only texture tiling prototype", () => {
  it("partitions giant 10x dimensions without allocating logical tile buffers", () => {
    const plan = planTextureChunks(12991, 6160, 4096, 1);
    expect(plan.columns).toBe(4);
    expect(plan.rows).toBe(2);
    expect(plan.chunks).toHaveLength(8);
    expect(
      plan.chunks.every(
        (chunk) =>
          chunk.textureWidth <= 4096 &&
          chunk.textureHeight <= 4096 &&
          chunk.width > 0 &&
          chunk.height > 0,
      ),
    ).toBe(true);
    let covered = 0;
    for (const chunk of plan.chunks) {
      covered += chunk.width * chunk.height;
      expect(chunk.sourceX).toBeGreaterThanOrEqual(0);
      expect(chunk.sourceY).toBeGreaterThanOrEqual(0);
      expect(chunk.sourceX + chunk.sourceWidth).toBeLessThanOrEqual(12991);
      expect(chunk.sourceY + chunk.sourceHeight).toBeLessThanOrEqual(6160);
      expect(chunk.sourceWidth + chunk.destinationX).toBeLessThanOrEqual(
        chunk.textureWidth,
      );
      expect(chunk.sourceHeight + chunk.destinationY).toBeLessThanOrEqual(
        chunk.textureHeight,
      );
    }
    expect(covered).toBe(12991 * 6160);
  });

  it("maps exact seam tiles into their correct chunk with reserved halo", () => {
    const p = planTextureChunks(9000, 4600, 2048, 2);
    const coords = [
      [0, 0],
      [p.interior - 1, 42],
      [p.interior, 42],
      [p.interior + 1, 42],
      [8999, 4599],
      [1, 2044],
      [1, 2045],
    ];
    for (const [x, y] of coords) {
      const { chunk, localX, localY } = findTextureChunk(p, x, y);
      expect(x).toBe(chunk.x + localX - p.halo);
      expect(y).toBe(chunk.y + localY - p.halo);
      expect(localX).toBeGreaterThanOrEqual(p.halo);
      expect(localX).toBeLessThan(chunk.textureWidth - p.halo);
      expect(localY).toBeGreaterThanOrEqual(p.halo);
      expect(localY).toBeLessThan(chunk.textureHeight - p.halo);
    }
  });

  it("preserves 1x geometry and rejects GPU/coordinate hazards", () => {
    const p = planTextureChunks(1000, 1000, 2048);
    expect(p.chunks).toHaveLength(1);
    expect(p.chunks[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      sourceX: 0,
      destinationX: 1,
    });
    expect(() => planTextureChunks(10, 10, 2, 1)).toThrow("usable interior");
    expect(() => planTextureChunks(100, -1, 4096)).toThrow("Invalid map");
    expect(() => planTextureChunks(1e11, 1e11, 4096)).toThrow(
      "safe integer precision",
    );
    expect(() => findTextureChunk(p, -1, 0)).toThrow("outside map");
    expect(() => findTextureChunk(p, 1000, 500)).toThrow("outside map");
  });
});
