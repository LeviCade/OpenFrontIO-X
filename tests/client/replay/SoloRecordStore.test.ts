// @vitest-environment node
import type {
  GameRecord,
  WireGameStartInfo,
} from "@openfront/shared/WireSchemas";
import { GameType } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it, vi } from "vitest";
import {
  SoloRecordJournal,
  getSoloRecord,
  exportSoloRecord,
  importSoloRecord,
  listSoloRecords,
  deleteSoloRecord,
  type SoloRecordBackend,
  type SoloRecordSnapshot,
} from "../../../src/client/replay/SoloRecordStore";
import { fetchReplayRecord } from "../../../src/client/replay/ReplayRecord";
import { config, human, playAndArchive } from "./util/ArchiveGame";

function memoryBackend(): SoloRecordBackend {
  const games = new Map<string, SoloRecordSnapshot>();
  return {
    async write(meta, chunks, hashes) {
      const existing = games.get(meta.gameID);
      const chunkMap = new Map(
        (existing?.chunks ?? []).map((c) => [c.first, c]),
      );
      const hashMap = new Map((existing?.hashes ?? []).map((h) => [h.turn, h]));
      for (const chunk of chunks)
        chunkMap.set(chunk.first, structuredClone(chunk));
      for (const hash of hashes) hashMap.set(hash.turn, structuredClone(hash));
      games.set(meta.gameID, {
        meta: structuredClone(meta),
        chunks: [...chunkMap.values()].sort((a, b) => a.first - b.first),
        hashes: [...hashMap.values()].sort((a, b) => a.turn - b.turn),
      });
    },
    async read(id) {
      return games.get(id);
    },
    async meta(id) {
      return games.get(id)?.meta;
    },
    async list() {
      return [...games.values()].map((v) => v.meta);
    },
    async remove(id) {
      games.delete(id);
    },
  };
}

async function fixture(): Promise<{
  info: WireGameStartInfo;
  record: GameRecord;
}> {
  const { record } = await playAndArchive({
    gameID: "SOLOREC1",
    config: config({ bots: 0, gameType: GameType.Singleplayer }),
    players: [human(1)],
    ticks: 5,
    intents: () => [],
  });
  record.gitCommit = "DEV";
  return { info: record.info as WireGameStartInfo, record };
}

describe("durable Solo source recording", () => {
  it("captures 1000 turns, later hash, first winner and post-win continuation", async () => {
    const { info } = await fixture();
    const backend = memoryBackend();
    const failures = vi.fn();
    const journal = new SoloRecordJournal(
      info,
      backend,
      failures,
      () => 1000,
      () => "DEV",
    );
    journal.begin();
    for (let turn = 0; turn < 1000; turn++) {
      journal.append({ turnNumber: turn, intents: [] });
      if (turn === 200) journal.win(["player", info.players[0].clientID], 200);
      if (turn === 400) journal.win(["player", info.players[0].clientID], 400);
      if (turn === 710) journal.hash(100, 1.25); // late hash on old persisted chunk
      // Simulate realistic event-loop progress: the bounded writer deliberately
      // refuses 512 uncommitted ticks arriving in one synchronous burst.
      if (turn % 64 === 63) await journal.flush();
    }
    await journal.finish();
    const stored = await backend.read(info.gameID);
    expect(stored?.chunks.length).toBeGreaterThan(1);
    expect(stored?.chunks.every((c) => c.last - c.first < 64)).toBe(true);
    expect(stored?.meta.lastRecordedTurn).toBe(999);
    expect(stored?.meta.wonAtTick).toBe(200);
    expect(stored?.meta.finished).toBe(true);
    const replay = await getSoloRecord(info.gameID, backend);
    expect(replay?.info.num_turns).toBe(1000);
    expect(replay?.info.winner).toEqual(["player", info.players[0].clientID]);
    expect(replay?.turns).toContainEqual({
      turnNumber: 100,
      intents: [],
      hash: 1.25,
    });
    expect(failures).not.toHaveBeenCalled();
  }, 60_000);

  it("exports and imports an extended replay with winner tick and compatible build", async () => {
    const { info } = await fixture();
    const original = memoryBackend();
    const journal = new SoloRecordJournal(
      info,
      original,
      undefined,
      Date.now,
      () => "DEV",
    );
    journal.begin();
    for (let i = 0; i < 145; i++)
      journal.append({ turnNumber: i, intents: [] });
    journal.win(["player", info.players[0].clientID], 70);
    await journal.finish();
    const portable = await exportSoloRecord(info.gameID, original);
    expect(portable.record.info.num_turns).toBe(145);
    const destination = memoryBackend();
    await importSoloRecord(portable, destination, "DEV");
    expect((await destination.meta(info.gameID))?.wonAtTick).toBe(70);
    expect(
      (await getSoloRecord(info.gameID, destination))?.info.num_turns,
    ).toBe(145);
    expect((await listSoloRecords(destination)).length).toBe(1);
    await expect(
      importSoloRecord(portable, destination, "DEV"),
    ).rejects.toThrow("already exists");
    await expect(
      importSoloRecord(portable, memoryBackend(), "a".repeat(40)),
    ).rejects.toThrow("original game build");
    await deleteSoloRecord(info.gameID, destination);
    expect(await getSoloRecord(info.gameID, destination)).toBeUndefined();
  }, 60_000);

  it("prioritizes the local source when remote API is unreachable", async () => {
    const { record } = await fixture();
    const remote = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await fetchReplayRecord(record.info.gameID, {
      ownCommit: "DEV",
      localSource: async () => record,
      fetchFn: remote as typeof fetch,
    });
    expect(result).toEqual({ kind: "record", record, local: true });
    expect(remote).not.toHaveBeenCalled();
  }, 60_000);

  it("keeps a bounded writer and surfaces quota failure without crashing gameplay", async () => {
    const { info } = await fixture();
    const failed = vi.fn();
    const backend = memoryBackend();
    backend.write = async () => {
      throw new Error("QuotaExceededError");
    };
    const journal = new SoloRecordJournal(
      info,
      backend,
      failed,
      Date.now,
      () => "DEV",
    );
    journal.begin();
    for (let i = 0; i < 100; i++)
      journal.append({ turnNumber: i, intents: [] });
    await journal.flush();
    expect(journal.error?.message).toBe("QuotaExceededError");
    expect(failed).toHaveBeenCalledTimes(1);
    journal.append({ turnNumber: 101, intents: [] });
    await journal.finish();
  }, 60_000);
});
