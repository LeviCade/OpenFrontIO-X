/**
 * Fetches the archived game record a replay is made from, the same way the
 * client-side replay does (JoinLobbyModal.checkArchivedGame).
 *
 * A record only replays on the build that played it, because the core is
 * only deterministic within a build. Records from other builds are watched
 * on that build's versioned shell (#4934), which has its own viewer and
 * processor, so this build never tries to simulate them.
 */

import { GameRecord, GameRecordSchema } from "@openfront/shared/WireSchemas";
import { getApiBase } from "../ApiBase";
import { ClientEnv } from "../ClientEnv";
import { getSoloRecord, hasSoloRecord } from "./SoloRecordStore";

export type RecordResult =
  | { kind: "record"; record: GameRecord; local?: boolean }
  /** Played on another build (or under another record schema). */
  | { kind: "other_build"; local?: boolean }
  | { kind: "not_found" }
  | { kind: "unreachable" };

/**
 * A record JoinLobbyModal already fetched and checked, passed to the
 * viewer so it isn't downloaded twice. Used once, then cleared.
 */
let handedOver: { gameID: string; record: GameRecord } | null = null;

export function handOverRecord(gameID: string, record: GameRecord): void {
  handedOver = { gameID, record };
}

export async function fetchReplayRecord(
  gameID: string,
  opts: {
    apiBase?: string;
    ownCommit?: string;
    fetchFn?: typeof fetch;
    localSource?: (id: string) => Promise<GameRecord | undefined>;
  } = {},
): Promise<RecordResult> {
  if (handedOver?.gameID === gameID) {
    const { record } = handedOver;
    handedOver = null;
    return { kind: "record", record };
  }
  const ownCommit = opts.ownCommit ?? ClientEnv.gitCommit();
  // Local source turns are authoritative over remote win-time archives and
  // derived processed caches; they include post-victory turns.
  if (
    opts.localSource ||
    (opts.fetchFn === undefined && typeof indexedDB !== "undefined")
  ) {
    try {
      const local = opts.localSource
        ? await opts.localSource(gameID)
        : (await hasSoloRecord(gameID))
          ? await getSoloRecord(gameID)
          : undefined;
      if (local) {
        if (ownCommit !== "DEV" && local.gitCommit !== ownCommit)
          return { kind: "other_build", local: true };
        return { kind: "record", record: local, local: true };
      }
    } catch (error) {
      console.error("Local Solo replay source unreadable:", error);
      return { kind: "unreachable" };
    }
  }
  const apiBase = opts.apiBase ?? getApiBase();
  const fetchFn = opts.fetchFn ?? fetch;
  let res: Response;
  try {
    res = await fetchFn.call(
      globalThis,
      `${apiBase}/game/${encodeURIComponent(gameID)}`,
      { headers: { Accept: "application/json" } },
    );
  } catch {
    return { kind: "unreachable" };
  }
  if (res.status === 404) return { kind: "not_found" };
  if (!res.ok) return { kind: "unreachable" };
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return { kind: "unreachable" };
  }
  // A record that doesn't match the schema is from another build (the
  // client-side replay treats it the same way).
  const parsed = GameRecordSchema.safeParse(raw);
  if (!parsed.success) return { kind: "other_build" };
  const record = parsed.data;
  // DEV builds replay anything, like the client-side replay.
  if (ownCommit !== "DEV" && record.gitCommit !== ownCommit) {
    return { kind: "other_build" };
  }
  return { kind: "record", record };
}

/**
 * Whether the record has any of the hashes the processor checks the game
 * against. Without them it can be replayed, but not verified.
 */
export function hasRecordedHashes(record: GameRecord): boolean {
  return record.turns.some((t) => t.hash !== null && t.hash !== undefined);
}
