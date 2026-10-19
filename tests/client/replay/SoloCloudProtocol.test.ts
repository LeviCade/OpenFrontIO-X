import { describe, expect, it, vi } from "vitest";
import {
  syncSoloSnapshot,
  type SoloCloudBackend,
} from "../../../src/client/replay/SoloCloudProtocol";
import type { SoloRecordSnapshot } from "../../../src/client/replay/SoloRecordStore";

function makeSnapshot(): SoloRecordSnapshot {
  const gameID = "SOLOCLOUD";
  // Real journals flush early on victory, backgrounding, pagehide or timers.
  // Their chunk boundaries are not necessarily aligned to multiples of 64.
  const chunkEnds = [
    63, 127, 191, 200, 255,
    ...Array.from({ length: 12 }, (_, i) => Math.min(999, 319 + 64 * i)),
  ];
  return {
    meta: {
      gameID,
      gitCommit: "DEV",
      startedAt: 100,
      updatedAt: 10000,
      lastRecordedTurn: 999,
      wonAtTick: 200,
      winner: ["player", "client001"],
      finished: true,
      failed: false,
      startInfo: {
        gameID,
        lobbyCreatedAt: 100,
        config: {} as SoloRecordSnapshot["meta"]["startInfo"]["config"],
        players: [],
      },
    },
    chunks: chunkEnds.map((last, i) => {
      const first = i === 0 ? 0 : chunkEnds[i - 1] + 1;
      return {
        gameID,
        first,
        last,
        turns: [{ turnNumber: first, intents: [] }],
      };
    }),
    hashes: [
      { gameID, turn: 100, hash: 123.5 },
      { gameID, turn: 900, hash: 456.25 },
    ],
  };
}

function fakeBackend() {
  const stored = new Map<number, string>();
  const hashes = new Map<number, number>();
  let digest: string | null = null;
  let immutableWinner: string | undefined;
  let finishedAt: number | undefined;
  let lostAcknowledgment = true;
  const backend: SoloCloudBackend = {
    async begin(meta, manifestDigest) {
      if (meta.gameID !== "SOLOCLOUD") throw new Error("unauthorized");
      if (digest !== null && digest !== manifestDigest) {
        throw new Error("manifest mismatch");
      }
      digest = manifestDigest;
      if (meta.winner) {
        const candidate = JSON.stringify([meta.wonAtTick, meta.winner]);
        if (immutableWinner && immutableWinner !== candidate) {
          throw new Error("first winner cannot change");
        }
        immutableWinner ??= candidate;
      }
      return { uploadID: "secret-owner-upload", nextChunk: stored.size };
    },
    async putChunk(chunk) {
      expect(chunk.uploadID).toBe("secret-owner-upload");
      if (chunk.index > stored.size) throw new Error("out-of-order chunk");
      const prior = stored.get(chunk.index);
      if (prior !== undefined && prior !== chunk.sha256) {
        throw new Error("conflicting chunk");
      }
      stored.set(chunk.index, chunk.sha256);
      if (chunk.index === 3 && lostAcknowledgment) {
        lostAcknowledgment = false;
        throw new Error("connection lost after commit");
      }
      return { nextChunk: chunk.index + 1 };
    },
    async putHashes(_uploadID, _gameID, batch) {
      for (const item of batch) {
        if (hashes.has(item.turn) && hashes.get(item.turn) !== item.hash) {
          throw new Error("conflicting late hash");
        }
        hashes.set(item.turn, item.hash);
      }
    },
    async finish(_uploadID, _gameID, lastTurn) {
      if (stored.size !== 17) throw new Error("missing chunks");
      finishedAt = lastTurn;
    },
  };
  return { backend, stored, hashes, getFinished: () => finishedAt };
}

describe("optional private Solo cloud transfer contract", () => {
  it("never attempts a network save when no owned backend is configured", async () => {
    const states: string[] = [];
    expect(
      await syncSoloSnapshot(makeSnapshot(), null, {
        onState: (state) => states.push(state),
      }),
    ).toBe("local_only");
    expect(states).toEqual(["local_only"]);
  });

  it("uploads all 1000 turns with idempotent retry and late hashes", async () => {
    const { backend, stored, hashes, getFinished } = fakeBackend();
    const wait = vi.fn(async () => undefined);
    const states: string[] = [];
    expect(
      await syncSoloSnapshot(makeSnapshot(), backend, {
        retryWait: wait,
        onState: (s) => states.push(s),
      }),
    ).toBe("synced");
    expect(stored.size).toBe(17);
    expect(hashes.get(100)).toBe(123.5);
    expect(hashes.get(900)).toBe(456.25);
    expect(getFinished()).toBe(999);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["uploading", "synced"]);
    expect(await syncSoloSnapshot(makeSnapshot(), backend)).toBe("synced");
    expect(stored.size).toBe(17);
  });

  it("resumes an early winner checkpoint without rewriting uploaded chunks", async () => {
    const { backend, stored, getFinished } = fakeBackend();
    const first = makeSnapshot();
    first.chunks = first.chunks.slice(0, 4);
    first.hashes = first.hashes.filter((entry) => entry.turn <= 200);
    first.meta.lastRecordedTurn = 200;
    first.meta.finished = false;
    expect(await syncSoloSnapshot(first, backend)).toBe("synced");
    expect(stored.size).toBe(4);
    expect(getFinished()).toBeUndefined();
    const original = [...stored.entries()];
    expect(await syncSoloSnapshot(makeSnapshot(), backend)).toBe("synced");
    expect(stored.size).toBe(17);
    expect(getFinished()).toBe(999);
    for (const [index, checksum] of original) {
      expect(stored.get(index)).toBe(checksum);
    }
  });

  it("refuses a missing early-flushed boundary, corrupt turn or duplicate hash", async () => {
    for (const mutate of [
      (s: SoloRecordSnapshot) => { s.chunks[4].first++; },
      (s: SoloRecordSnapshot) => { s.chunks[3].last = 265; },
      (s: SoloRecordSnapshot) => {
        s.chunks[3].turns[0].turnNumber = 201;
      },
      (s: SoloRecordSnapshot) => { s.hashes.push({ ...s.hashes[0] }); },
    ]) {
      const snapshot = makeSnapshot();
      mutate(snapshot);
      const begin = vi.fn();
      const backend = { ...fakeBackend().backend, begin };
      await expect(
        syncSoloSnapshot(snapshot, backend, { maxRetries: 0 }),
      ).rejects.toThrow(/Local source journal/);
      expect(begin).not.toHaveBeenCalled();
    }
  });

  it("rejects an incomplete local journal without uploading", async () => {
    const snapshot = makeSnapshot();
    snapshot.chunks.splice(2, 1);
    const begin = vi.fn();
    const backend = { ...fakeBackend().backend, begin };
    await expect(
      syncSoloSnapshot(snapshot, backend, { maxRetries: 0 }),
    ).rejects.toThrow("missing or invalid chunks");
    expect(begin).not.toHaveBeenCalled();
  });

  it("keeps private-access errors visible and never claims a sync", async () => {
    const snapshot = makeSnapshot();
    snapshot.meta.gameID = "WRONGOWN";
    snapshot.meta.startInfo.gameID = "WRONGOWN";
    for (const chunk of snapshot.chunks) chunk.gameID = "WRONGOWN";
    for (const hash of snapshot.hashes) hash.gameID = "WRONGOWN";
    const states: string[] = [];
    await expect(
      syncSoloSnapshot(snapshot, fakeBackend().backend, {
        retryWait: async () => undefined,
        maxRetries: 0,
        onState: (s) => states.push(s),
      }),
    ).rejects.toThrow("unauthorized");
    expect(states).toEqual(["uploading", "failed"]);
  });
});
