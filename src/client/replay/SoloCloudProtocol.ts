/**
 * Explicit, OFF-BY-DEFAULT contract for an independently owned Solo replay
 * service. This module performs NO network requests unless a trusted backend
 * implementation is provided by the application.
 *
 * The official OpenFront archive is NOT a SoloCloudBackend.
 */
import type { SoloRecordMeta, SoloRecordSnapshot } from "./SoloRecordStore";

export const SOLO_CLOUD_MAX_CHUNK_BYTES = 1024 * 1024;
export const SOLO_CLOUD_MAX_RETRIES = 4;
export type SoloCloudState = "local_only" | "uploading" | "synced" | "failed";

export interface SoloCloudBegin {
  /** Server-generated opaque upload capability tied to an authenticated owner. */
  uploadID: string;
  /** Already durably committed 64-turn chunks, in order. */
  nextChunk: number;
}

export interface SoloCloudChunk {
  uploadID: string;
  index: number;
  gameID: string;
  first: number;
  last: number;
  payload: string;
  sha256: string;
}

export interface SoloCloudBackend {
  /**
   * Authenticated owner-only request. Must bind manifestDigest, game ID,
   * build, first winner/tick and immutable configuration on first write.
   * A resume MUST check owner and digest before returning the next cursor.
   */
  begin(meta: SoloRecordMeta, manifestDigest: string): Promise<SoloCloudBegin>;
  /**
   * Commit a chunk in a transaction with conditional sequence advancement.
   * Re-uploading an identical chunk is idempotent, changed bytes are rejected.
   * Acknowledgment must represent durable, contiguous server storage.
   */
  putChunk(chunk: SoloCloudChunk): Promise<{ nextChunk: number }>;
  /**
   * Accessible only to the owner. Finalize never changes the first winner.
   * Rejects a watermark larger than the contiguous committed sequence.
   */
  finish(uploadID: string, gameID: string, lastTurn: number): Promise<void>;
}

export interface SyncOptions {
  onState?: (state: SoloCloudState) => void;
  retryWait?: (milliseconds: number) => Promise<void>;
  signal?: AbortSignal;
  maxRetries?: number;
}

function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Solo cloud upload aborted");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function retry<T>(
  work: () => Promise<T>,
  options: SyncOptions,
): Promise<T> {
  const maxRetries = Math.min(
    6,
    Math.max(0, options.maxRetries ?? SOLO_CLOUD_MAX_RETRIES),
  );
  const wait =
    options.retryWait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; ; attempt++) {
    assertActive(options.signal);
    try {
      return await work();
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      await wait(Math.min(15000, 300 * 2 ** attempt));
    }
  }
}

/**
 * Synchronizes a committed local snapshot, never uncommitted pending turns.
 * On reconnect, begin() discovers the authoritative durable sequence and
 * skips previously acknowledged chunks. No credentials or endpoints here.
 */
export async function syncSoloSnapshot(
  snapshot: SoloRecordSnapshot,
  backend: SoloCloudBackend | null,
  options: SyncOptions = {},
): Promise<SoloCloudState> {
  if (backend === null) {
    options.onState?.("local_only");
    return "local_only";
  }
  options.onState?.("uploading");
  try {
    const { meta } = snapshot;
    if (meta.lastRecordedTurn < 0) throw new Error("No persisted turns");
    const chunks = [...snapshot.chunks].sort((a, b) => a.first - b.first);
    const expectedCount = Math.ceil(
      (meta.lastRecordedTurn + 1) / 64,
    );
    if (chunks.length !== expectedCount) {
      throw new Error("Local source journal has missing chunks");
    }
    for (let i = 0; i < chunks.length; i++) {
      const first = i * 64;
      const last = Math.min(first + 63, meta.lastRecordedTurn);
      if (chunks[i].first !== first || chunks[i].last !== last) {
        throw new Error("Local source journal has missing or reordered turns");
      }
    }
    // UpdatedAt, per-session network state and extended watermark are NOT
    // part of the immutable manifest; first winner/tick and config are.
    const manifestDigest = await sha256(
      JSON.stringify({
        gameID: meta.gameID,
        gitCommit: meta.gitCommit,
        startInfo: meta.startInfo,
        startedAt: meta.startedAt,
        wonAtTick: meta.wonAtTick,
        winner: meta.winner,
      }),
    );
    const session = await retry(
      () => backend.begin(meta, manifestDigest),
      options,
    );
    if (
      !Number.isSafeInteger(session.nextChunk) ||
      session.nextChunk < 0 ||
      session.nextChunk > chunks.length ||
      !session.uploadID
    ) {
      throw new Error("Invalid upload cursor from replay backend");
    }
    let next = session.nextChunk;
    while (next < chunks.length) {
      assertActive(options.signal);
      const chunk = chunks[next];
      const payload = JSON.stringify({
        turns: chunk.turns,
        hashes: snapshot.hashes.filter(
          (hash) =>
            hash.turn >= chunk.first && hash.turn <= chunk.last,
        ),
      });
      if (
        new TextEncoder().encode(payload).byteLength >
        SOLO_CLOUD_MAX_CHUNK_BYTES
      ) {
        throw new Error("Solo replay chunk is over the 1 MiB upload limit");
      }
      const ack = await retry(
        () =>
          backend.putChunk({
            uploadID: session.uploadID,
            index: next,
            gameID: meta.gameID,
            first: chunk.first,
            last: chunk.last,
            payload,
            sha256: await sha256(payload),
          }),
        options,
      );
      if (ack.nextChunk !== next + 1) {
        throw new Error("Backend acknowledged a noncontiguous turn chunk");
      }
      next++;
    }
    if (meta.finished) {
      await retry(
        () => backend.finish(session.uploadID, meta.gameID, meta.lastRecordedTurn),
        options,
      );
    }
    options.onState?.("synced");
    return "synced";
  } catch (error) {
    options.onState?.("failed");
    throw error;
  }
}
