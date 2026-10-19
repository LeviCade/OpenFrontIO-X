/**
 * Real Chromium + Vite + IndexedDB source persistence smoke.
 * The turn inputs are deterministic fixtures: this is NOT a full game UI
 * or replay-engine determinism acceptance test.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright";

const url = process.env.SOLO_BROWSER_URL ??
  "http://127.0.0.1:9000/tests/browser/solo-replay-idb.html";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});

async function openFixture(context) {
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("PAGE ERROR:", error));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.documentElement.dataset.soloFixture === "ready",
  );
  return page;
}

try {
  const first = await browser.newContext({ acceptDownloads: true });
  const page = await openFixture(first);
  const gameID = "SOLOE2E1";
  const initial = await page.evaluate(async (id) => {
    const { SoloRecordJournal, getSoloRecord, soloRecordBackend } =
      await import("/src/client/replay/SoloRecordStore.ts");
    const startInfo = {
      gameID: id,
      lobbyCreatedAt: Date.now(),
      players: [
        { clientID: "client001", username: "Test User", clanTag: null },
      ],
      config: {
        gameMap: "Pangaea",
        difficulty: "Medium",
        donateGold: false,
        donateTroops: false,
        gameType: "Singleplayer",
        gameMode: "Free For All",
        gameMapSize: "Normal",
        nations: "default",
        bots: 0,
        infiniteGold: false,
        infiniteTroops: false,
        instantBuild: false,
        randomSpawn: false,
        disabledUnits: [],
        mapAreaMultiplier: 2,
        winPercentage: 20,
      },
    };
    const errors = [];
    const journal = new SoloRecordJournal(
      startInfo,
      soloRecordBackend(),
      (error) => errors.push(error.message),
      Date.now,
      () => "DEV",
    );
    journal.begin();
    for (let tick = 0; tick < 1000; tick++) {
      journal.append({ turnNumber: tick, intents: [] });
      if (tick === 200) {
        journal.win(["player", "client001"], 200);
      }
      if (tick === 600) {
        journal.hash(100, 1.25);
      }
      if (tick % 64 === 63) await journal.flush();
    }
    await journal.finish();
    const replay = await getSoloRecord(id);
    if (!replay) throw new Error("Recorded source is missing");
    return {
      errors,
      length: replay.info.num_turns,
      winner: replay.info.winner,
      hash: replay.turns.find((turn) => turn.turnNumber === 100)?.hash,
    };
  }, gameID);
  assert.deepEqual(initial.errors, []);
  assert.equal(initial.length, 1000);
  assert.deepEqual(initial.winner, ["player", "client001"]);
  assert.equal(initial.hash, 1.25);

  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.soloFixture === "ready",
  );
  const recovered = await page.evaluate(async (id) => {
    const { getSoloRecord, hasSoloRecord, listSoloRecords } =
      await import("/src/client/replay/SoloRecordStore.ts");
    const { fetchReplayRecord } =
      await import("/src/client/replay/ReplayRecord.ts");
    const entries = await listSoloRecords();
    const record = await getSoloRecord(id);
    const lookedUp = await fetchReplayRecord(id, { ownCommit: "DEV" });
    return {
      exists: await hasSoloRecord(id),
      count: entries.length,
      last: entries[0]?.lastRecordedTurn,
      firstWin: entries[0]?.wonAtTick,
      finished: entries[0]?.finished,
      length: record?.info.num_turns,
      source: lookedUp.kind === "record" && lookedUp.local === true,
    };
  }, gameID);
  assert.deepEqual(recovered, {
    exists: true,
    count: 1,
    last: 999,
    firstWin: 200,
    finished: true,
    length: 1000,
    source: true,
  });

  const library = page.locator("solo-replay-library");
  await library.locator("summary").click();
  assert.match(await library.textContent(), /Saved Solo Replays \(1\)/);
  const downloadPromise = page.waitForEvent("download");
  await library.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "openfront-solo-SOLOE2E1.json.gz");
  const exported = gunzipSync(await readFile(await download.path()));
  const parsed = JSON.parse(exported.toString("utf8"));
  assert.equal(parsed.kind, "openfront-solo-v1");
  assert.equal(parsed.record.info.num_turns, 1000);
  assert.equal(parsed.wonAtTick, 200);

  // Browser profile isolation: game IDs do NOT reveal local/private replays.
  const second = await browser.newContext({ acceptDownloads: true });
  const other = await openFixture(second);
  const absent = await other.evaluate(async (id) => {
    const { hasSoloRecord } =
      await import("/src/client/replay/SoloRecordStore.ts");
    return hasSoloRecord(id);
  }, gameID);
  assert.equal(absent, false);

  // An explicit user export/import is the currently supported cross-device
  // transfer; do not represent this as a cloud sync test.
  const secondLibrary = other.locator("solo-replay-library");
  await secondLibrary.locator("summary").click();
  await secondLibrary.locator("input[type=file]").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/gzip",
    buffer: await readFile(await download.path()),
  });
  await other.waitForFunction(() =>
    document.querySelector("solo-replay-library")?.textContent?.includes(
      "Replay imported.",
    ),
  );
  const imported = await other.evaluate(async (id) => {
    const { getSoloRecord, listSoloRecords } =
      await import("/src/client/replay/SoloRecordStore.ts");
    const record = await getSoloRecord(id);
    const meta = (await listSoloRecords())[0];
    return {
      last: record?.info.num_turns,
      winner: record?.info.winner,
      firstWin: meta?.wonAtTick,
    };
  }, gameID);
  assert.deepEqual(imported, {
    last: 1000,
    winner: ["player", "client001"],
    firstWin: 200,
  });
  await second.close();
  await first.close();
  console.log("PASS: Chromium IndexedDB 1000 turns, win at 200, continued capture, exit/reload, local lookup, gzip export/import and second-profile isolation");
  console.log("LIMIT: Deterministic source-turn fixture; no game engine playback or real Solo HUD win flow exercised");
} finally {
  await browser.close();
}
