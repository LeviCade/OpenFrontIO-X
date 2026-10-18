/**
 * Durable LOCAL-ONLY Solo source journal. Do not confuse with ReplayStore:
 * that cache contains derived video frames and may evict them at any time.
 *
 * Source turns live in 64-turn immutable chunks, hashes in independent rows
 * (the engine reports them after the turn was produced), and metadata in a
 * small row. A win updates metadata without closing the recording.
 */
import type { Turn, Winner } from "@openfront/engine-api/Schemas";
import type { WireGameStartInfo, GameRecord, PlayerRecord } from "@openfront/shared/WireSchemas";
import { GameRecordSchema } from "@openfront/shared/WireSchemas";
import { ClientEnv } from "../ClientEnv";

export const SOLO_JOURNAL_CHUNK_TURNS = 64;
const MAX_PENDING_TURNS = 512;
const DB_NAME = "openfront-solo-source-records";
const DB_VERSION = 1;
const GAMES = "games";
const CHUNKS = "chunks";
const HASHES = "hashes";

export interface SoloRecordMeta {
  gameID: string;
  startInfo: WireGameStartInfo;
  gitCommit: string;
  startedAt: number;
  updatedAt: number;
  lastRecordedTurn: number;
  wonAtTick: number | null;
  winner?: Winner;
  finished: boolean;
  failed: boolean;
  stats?: PlayerRecord["stats"];
}

interface SoloChunk {
  gameID: string;
  first: number;
  last: number;
  turns: Turn[];
}
interface SoloHash {
  gameID: string;
  turn: number;
  hash: number;
}
export interface SoloRecordSnapshot {
  meta: SoloRecordMeta;
  chunks: SoloChunk[];
  hashes: SoloHash[];
}
export interface SoloRecordBackend {
  write(meta: SoloRecordMeta, chunks: SoloChunk[], hashes: SoloHash[]): Promise<void>;
  read(gameID: string): Promise<SoloRecordSnapshot | undefined>;
  meta(gameID: string): Promise<SoloRecordMeta | undefined>;
  list(): Promise<SoloRecordMeta[]>;
  remove(gameID: string): Promise<void>;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES, { keyPath: "gameID" });
      if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: ["gameID", "first"] });
      if (!db.objectStoreNames.contains(HASHES)) db.createObjectStore(HASHES, { keyPath: ["gameID", "turn"] });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Solo replay database upgrade blocked by another tab"));
  });
}
function range(gameID: string): IDBKeyRange {
  return IDBKeyRange.bound([gameID, 0], [gameID, Number.MAX_SAFE_INTEGER]);
}
/** Separate database; never upgrade or evict the processed ReplayStore. */
export function createIndexedSoloBackend(factory: IDBFactory | undefined = globalThis.indexedDB): SoloRecordBackend {
  const withDb = async <T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> => {
    if (!factory) throw new Error("IndexedDB is unavailable: Solo cannot save offline replays");
    const db = await openDatabase(factory);
    try { return await fn(db); } finally { db.close(); }
  };
  return {
    write: (meta, chunks, hashes) => withDb(async (db) => {
      const tx = db.transaction([GAMES, CHUNKS, HASHES], "readwrite");
      const done = complete(tx);
      tx.objectStore(GAMES).put(meta);
      for (const chunk of chunks) tx.objectStore(CHUNKS).put(chunk);
      for (const hash of hashes) tx.objectStore(HASHES).put(hash);
      await done;
    }),
    read: (gameID) => withDb(async (db) => {
      const tx = db.transaction([GAMES, CHUNKS, HASHES], "readonly");
      const meta = await request(tx.objectStore(GAMES).get(gameID)) as SoloRecordMeta | undefined;
      if (!meta) return undefined;
      const [chunks, hashes] = await Promise.all([
        request(tx.objectStore(CHUNKS).getAll(range(gameID))) as Promise<SoloChunk[]>,
        request(tx.objectStore(HASHES).getAll(range(gameID))) as Promise<SoloHash[]>,
      ]);
      return { meta, chunks, hashes };
    }),
    meta: (gameID) => withDb(async (db) => {
      const tx = db.transaction(GAMES, "readonly");
      return await request(tx.objectStore(GAMES).get(gameID)) as SoloRecordMeta | undefined;
    }),
    list: () => withDb(async (db) => {
      const tx = db.transaction(GAMES, "readonly");
      return await request(tx.objectStore(GAMES).getAll()) as SoloRecordMeta[];
    }),
    remove: (gameID) => withDb(async (db) => {
      const tx = db.transaction([GAMES, CHUNKS, HASHES], "readwrite");
      const done = complete(tx);
      tx.objectStore(GAMES).delete(gameID);
      // A bounded per-game cursor, not a getAll of potentially huge chunks.
      const clear = (name: string) => new Promise<void>((resolve, reject) => {
        const store = tx.objectStore(name);
        const cursor = store.openKeyCursor(range(gameID));
        cursor.onerror = () => reject(cursor.error);
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return resolve();
          store.delete(current.primaryKey);
          current.continue();
        };
      });
      await Promise.all([clear(CHUNKS), clear(HASHES)]);
      await done;
    }),
  };
}

let defaultBackend: SoloRecordBackend | undefined;
export function soloRecordBackend(): SoloRecordBackend {
  return defaultBackend ??= createIndexedSoloBackend();
}

export function recordFromSnapshot(snapshot: SoloRecordSnapshot): GameRecord {
  const { meta, chunks, hashes } = snapshot;
  const turns = new Map<number, Turn>();
  for (const chunk of chunks) for (const turn of chunk.turns) {
    if (turn.turnNumber > meta.lastRecordedTurn) continue;
    turns.set(turn.turnNumber, turn);
  }
  for (const entry of hashes) {
    if (entry.turn > meta.lastRecordedTurn) continue;
    const existing = turns.get(entry.turn);
    turns.set(entry.turn, { turnNumber: entry.turn, intents: existing?.intents ?? [], hash: entry.hash });
  }
  const players: PlayerRecord[] = meta.startInfo.players.map((player) => ({
    ...player, persistentID: null, stats: meta.stats,
  }));
  const record = {
    gitCommit: meta.gitCommit,
    version: "v0.0.2" as const,
    info: {
      ...meta.startInfo,
      players,
      start: meta.startedAt,
      end: meta.updatedAt,
      duration: Math.max(0, Math.floor((meta.updatedAt - meta.startedAt) / 1000)),
      num_turns: meta.lastRecordedTurn + 1,
      winner: meta.winner,
      lobbyFillTime: 0,
    },
    turns: [...turns.values()].filter((t) => t.intents.length || t.hash !== undefined)
      .sort((a, b) => a.turnNumber - b.turnNumber),
  };
  return GameRecordSchema.parse(record);
}

export class SoloRecordJournal {
  private meta: SoloRecordMeta;
  private pending: Turn[] = [];
  private pendingHashes = new Map<number, number>();
  private serial: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setInterval> | null = null;
  private failed: Error | null = null;
  private stopped = false;
  private committedTurn = -1;
  private readonly onVisibility = () => {
    if (document.visibilityState === "hidden") void this.flush();
  };
  private readonly onPageHide = () => { void this.flush(); };

  constructor(
    startInfo: WireGameStartInfo,
    private backend: SoloRecordBackend = soloRecordBackend(),
    private onError: (error: Error) => void = (e) => console.error("Solo replay storage failed", e),
    now: () => number = Date.now,
  ) {
    this.now = now;
    this.meta = {
      gameID: startInfo.gameID,
      startInfo,
      gitCommit: ClientEnv.gitCommit(),
      startedAt: now(), updatedAt: now(), lastRecordedTurn: -1,
      wonAtTick: null, finished: false, failed: false,
    };
  }
  private readonly now: () => number;

  begin(): void {
    this.queue([], [], -1);
    this.timer = setInterval(() => { void this.flush(); }, 2000);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
      window.addEventListener("pagehide", this.onPageHide);
    }
  }

  append(turn: Turn): void {
    if (this.stopped || this.failed) return;
    if (this.pending.length >= MAX_PENDING_TURNS) {
      this.fail(new Error("Offline replay writer is stalled; bounded turn buffer exhausted"));
      return;
    }
    // Keep only non-empty turns. Other ticks are represented by the last-turn
    // watermark, and the reader reconstructs the gaps deterministically.
    this.pending.push({
      turnNumber: turn.turnNumber,
      intents: [...turn.intents],
    });
    if (this.pending.length >= SOLO_JOURNAL_CHUNK_TURNS) void this.flush();
  }

  hash(turn: number, hash: number): void {
    if (this.stopped || this.failed || !Number.isFinite(hash)) return;
    this.pendingHashes.set(turn, hash);
    // A hash may arrive after its turn's chunk was already persisted.
    // Stored separately, it never rewrites that immutable turn chunk.
    if (this.pendingHashes.size >= 8) void this.flush();
  }

  win(winner: Winner, tick: number, stats?: PlayerRecord["stats"]): void {
    if (this.meta.wonAtTick !== null) return; // first win is immutable
    this.meta.wonAtTick = Math.max(0, tick);
    this.meta.winner = winner;
    this.meta.stats = stats;
    void this.flush(); // checkpoint, NOT a stop or archive of extended turns
  }

  async flush(): Promise<void> {
    if (this.failed) return;
    const batch = this.pending.splice(0, SOLO_JOURNAL_CHUNK_TURNS);
    const hashes = [...this.pendingHashes].map(([turn, hash]) => ({
      gameID: this.meta.gameID, turn, hash,
    }));
    this.pendingHashes.clear();
    const last = batch.at(-1)?.turnNumber ?? this.committedTurn;
    this.queue(batch, hashes, last);
    // Do not loop until empty in same call: callers run every 2s and the
    // next flush will advance, keeping input and IDB work bounded.
    await this.serial;
  }

  async finish(): Promise<void> {
    if (this.stopped) return this.serial;
    this.stopped = true;
    if (this.timer !== null) clearInterval(this.timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
      window.removeEventListener("pagehide", this.onPageHide);
    }
    this.meta.finished = true;
    while (this.pending.length > 0 && !this.failed) await this.flush();
    if (!this.failed) {
      this.queue([], [...this.pendingHashes].map(([turn, hash]) => ({
        gameID: this.meta.gameID, turn, hash,
      })), this.committedTurn);
      this.pendingHashes.clear();
    }
    await this.serial;
  }

  get error(): Error | null { return this.failed; }

  private queue(batch: Turn[], hashes: SoloHash[], last: number): void {
    const chunks: SoloChunk[] = [];
    if (batch.length > 0) {
      chunks.push({
        gameID: this.meta.gameID, first: batch[0].turnNumber,
        last: batch[batch.length - 1].turnNumber,
        turns: batch.filter((t) => t.intents.length > 0),
      });
    }
    this.serial = this.serial.then(async () => {
      if (this.failed) return;
      const committedTurn = Math.max(this.committedTurn, last);
      const nextMeta = {
        ...this.meta, updatedAt: this.now(),
        lastRecordedTurn: committedTurn,
      };
      try {
        await this.backend.write(nextMeta, chunks, hashes);
        this.committedTurn = committedTurn;
      } catch (err) {
        this.fail(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private fail(error: Error): void {
    if (this.failed) return;
    this.failed = error;
    this.onError(error);
  }
}

export async function hasSoloRecord(
  gameID: string,
  backend: SoloRecordBackend = soloRecordBackend(),
): Promise<boolean> {
  return (await backend.meta(gameID)) !== undefined;
}

export async function listSoloRecords(backend: SoloRecordBackend = soloRecordBackend()):
  Promise<SoloRecordMeta[]> {
  return (await backend.list()).sort((a, b) => b.startedAt - a.startedAt);
}
export async function getSoloRecord(
  gameID: string,
  backend: SoloRecordBackend = soloRecordBackend(),
): Promise<GameRecord | undefined> {
  const stored = await backend.read(gameID);
  return stored === undefined ? undefined : recordFromSnapshot(stored);
}
export async function deleteSoloRecord(
  gameID: string,
  backend: SoloRecordBackend = soloRecordBackend(),
): Promise<void> {
  await backend.remove(gameID);
}
export async function exportSoloRecord(
  gameID: string,
  backend: SoloRecordBackend = soloRecordBackend(),
): Promise<{ kind: "openfront-solo-v1"; wonAtTick: number | null; record: GameRecord }> {
  const snapshot = await backend.read(gameID);
  if (!snapshot) throw new Error("Solo replay not found");
  return { kind: "openfront-solo-v1", wonAtTick: snapshot.meta.wonAtTick, record: recordFromSnapshot(snapshot) };
}

export async function importSoloRecord(
  data: unknown,
  backend: SoloRecordBackend = soloRecordBackend(),
  build: string = ClientEnv.gitCommit(),
): Promise<void> {
  const wrapper = data && typeof data === "object" && "kind" in data &&
    (data as { kind?: unknown }).kind === "openfront-solo-v1"
      ? data as { record: unknown; wonAtTick: unknown }
      : null;
  const record = GameRecordSchema.parse(wrapper ? wrapper.record : data);
  const wonAtTick = wrapper && Number.isSafeInteger(wrapper.wonAtTick) &&
    Number(wrapper.wonAtTick) >= 0 &&
    Number(wrapper.wonAtTick) < record.info.num_turns
      ? Number(wrapper.wonAtTick) : null;
  if (build !== "DEV" && record.gitCommit !== build) {
    throw new Error("This replay needs the original game build; import rejected");
  }
  const gameID = record.info.gameID;
  if (await backend.read(gameID)) throw new Error("This Solo replay already exists");
  const startedAt = record.info.start, updatedAt = record.info.end;
  const meta: SoloRecordMeta = {
    gameID,
    startInfo: {
      gameID, lobbyCreatedAt: record.info.lobbyCreatedAt,
      config: record.info.config, players: record.info.players.map(({ persistentID: _id, stats: _stats, ...p }) => p),
    },
    gitCommit: record.gitCommit, startedAt, updatedAt,
    lastRecordedTurn: record.info.num_turns - 1,
    wonAtTick, winner: record.info.winner,
    finished: true, failed: false, stats: record.info.players[0]?.stats,
  };
  const chunks = new Map<number, SoloChunk>();
  for (const turn of record.turns) {
    if (turn.turnNumber >= record.info.num_turns) {
      throw new Error("Imported replay contains a turn past its declared length");
    }
    const first = Math.floor(turn.turnNumber / SOLO_JOURNAL_CHUNK_TURNS) * SOLO_JOURNAL_CHUNK_TURNS;
    let chunk = chunks.get(first);
    if (!chunk) {
      chunk = { gameID, first, last: Math.min(first + SOLO_JOURNAL_CHUNK_TURNS - 1, record.info.num_turns - 1), turns: [] };
      chunks.set(first, chunk);
    }
    if (chunk.turns.some((previous) => previous.turnNumber === turn.turnNumber))
      throw new Error("Imported replay contains duplicate turns");
    chunk.turns.push(turn);
  }
  // Metadata watermark only advances with committed source chunks, so an
  // interrupted import remains visibly incomplete instead of looking valid.
  for (let first = 0; first < record.info.num_turns; first += SOLO_JOURNAL_CHUNK_TURNS) {
    const last = Math.min(first + SOLO_JOURNAL_CHUNK_TURNS - 1, record.info.num_turns - 1);
    await backend.write({ ...meta, lastRecordedTurn: last, finished: false },
      [chunks.get(first) ?? { gameID, first, last, turns: [] }], []);
  }
  await backend.write(meta, [], []);
}
