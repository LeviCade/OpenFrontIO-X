import { describe, expect, it } from "vitest";
import {
  assertMapAreaMultiplier,
  scaleSpawnArea,
  scaleTerrainGrid,
  scaleTileCoordinate,
} from "@openfront/engine-lib/game/MapMultiplier";

describe("Map Multiplier packed terrain", () => {
  const metadata = { width: 2, height: 2, num_land_tiles: 1 };
  // 0x80 passable land; 0x9f impassable land; 0x20 ocean; 0x00 lake.
  const terrain = new Uint8Array([0x80, 0x20, 0x9f, 0x00]);

  it("preserves identical references and bytes at 1x", () => {
    const scaled = scaleTerrainGrid(terrain, metadata, 1);
    expect(scaled.bytes).toBe(terrain);
    expect(scaled.metadata).toBe(metadata);
    expect(Array.from(scaled.bytes)).toEqual(Array.from(terrain));
  });

  it("2x means double area, not double each axis", () => {
    const scaled = scaleTerrainGrid(terrain, metadata, 2);
    expect([scaled.metadata.width, scaled.metadata.height]).toEqual([3, 3]);
    expect(scaled.bytes.length).toBe(9);
    expect(scaled.metadata.num_land_tiles).toBe(4);
    expect(scaled.bytes[0] & 0x80).toBe(0x80);
    expect(scaled.bytes[8] & 0x80).toBe(0);
    expect(scaled.bytes[2] & 0x20).toBe(0x20);
    expect(scaled.bytes[6]).toBe(0x9f);
    expect(terrain).toEqual(new Uint8Array([0x80, 0x20, 0x9f, 0x00]));
  });

  it("corrects stale shore bits on stretched land and water", () => {
    const source = new Uint8Array([0xc1, 0x60, 0xc1, 0x60]);
    const scaled = scaleTerrainGrid(
      source,
      { width: 2, height: 2, num_land_tiles: 2 },
      4,
    );
    expect(scaled.metadata.width).toBe(4);
    expect(scaled.metadata.height).toBe(4);
    expect(scaled.bytes[0] & 0x40).toBe(0); // inland at x=0
    expect(scaled.bytes[1] & 0x40).toBe(0x40);
    expect(scaled.bytes[2] & 0x40).toBe(0x40);
    expect(scaled.bytes[3] & 0x40).toBe(0); // offshore at x=3
    expect(scaled.bytes[0] & 0x1f).toBe(1);
    expect(scaled.bytes[3] & 0x20).toBe(0x20);
    expect(source[0]).toBe(0xc1);
  });

  it("does not flag impassable-to-water boundaries as shores", () => {
    const scaled = scaleTerrainGrid(
      new Uint8Array([0x9f, 0x20]),
      { width: 2, height: 1, num_land_tiles: 0 },
      4,
    );
    expect(Array.from(scaled.bytes)).toEqual([
      0x9f, 0x9f, 0x20, 0x20, 0x9f, 0x9f, 0x20, 0x20,
    ]);
    expect(scaled.metadata.num_land_tiles).toBe(0);
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 20] as const)(
    "is deterministic and bounded at %ix",
    (factor) => {
      const a = scaleTerrainGrid(terrain, metadata, factor);
      const b = scaleTerrainGrid(terrain, metadata, factor);
      expect(a.bytes).toEqual(b.bytes);
      expect(a.metadata).toEqual(b.metadata);
      expect(a.metadata.width * a.metadata.height).toBe(a.bytes.length);
    },
  );

  it("admits 20x only when its logical grid is within the unchanged tile guard", () => {
    const source = { width: 2, height: 2, num_land_tiles: 4 };
    const scaled = scaleTerrainGrid(new Uint8Array(4).fill(0x80), source, 20);
    expect(scaled.metadata.width).toBe(9);
    expect(scaled.metadata.height).toBe(9);
    expect(scaled.bytes.length).toBe(81);
    expect(() =>
      scaleTerrainGrid(
        new Uint8Array(4).fill(0x80),
        source,
        20,
        { width: 12_991, height: 6_160 },
      ),
    ).toThrow("budget");
  });

  it("scales coordinates and spawn rectangles within map boundaries", () => {
    const a = { width: 100, height: 50 };
    const b = { width: 245, height: 122 };
    expect(scaleTileCoordinate([99, 49], a, b)).toEqual([243, 120]);
    expect(
      scaleSpawnArea({ x: 90, y: 40, width: 10, height: 10 }, a, b),
    ).toEqual({
      x: 220,
      y: 97,
      width: 25,
      height: 25,
    });
  });

  it("rejects invalid factors, malformed bins and excessive allocations", () => {
    expect(() => assertMapAreaMultiplier(21)).toThrow("1 to 20");
    expect(() => scaleTerrainGrid(new Uint8Array(1), metadata, 2)).toThrow(
      "length",
    );
    expect(() =>
      scaleTerrainGrid(
        new Uint8Array(1),
        { width: 1, height: 1, num_land_tiles: 1 },
        6,
        { width: 1_000_000, height: 1_000_000 },
      ),
    ).toThrow("budget");
  });
});
