import { replacer } from "@openfront/shared/SharedUtil";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  deleteSoloRecord,
  exportSoloRecord,
  importSoloRecord,
  listSoloRecords,
  type SoloRecordMeta,
} from "./SoloRecordStore";

const MAX_IMPORT_BYTES = 128 * 1024 * 1024;

/** Browser-only source library. No authentication or API dependency. */
@customElement("solo-replay-library")
export class SoloReplayLibrary extends LitElement {
  @state() private entries: SoloRecordMeta[] = [];
  @state() private message = "";
  @state() private busy = false;
  @state() private storage = "";

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      this.entries = await listSoloRecords();
      const estimate = await navigator.storage?.estimate?.();
      this.storage =
        estimate?.usage !== undefined && estimate.quota !== undefined
          ? String(Math.round(estimate.usage / 1048576)) +
            " MiB used of " +
            String(Math.round(estimate.quota / 1048576)) +
            " MiB available (all site storage)"
          : "Storage usage unavailable";
    } catch (error) {
      this.message = "Browser storage unavailable: " + String(error);
    }
  }

  private async exportGame(gameID: string): Promise<void> {
    this.busy = true;
    try {
      const json = JSON.stringify(await exportSoloRecord(gameID), replacer);
      const source = new Blob([json], { type: "application/json" });
      const compressed = new Response(
        source.stream().pipeThrough(new CompressionStream("gzip")),
      );
      const blob = await compressed.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "openfront-solo-" + gameID + ".json.gz";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      this.message = "Export failed: " + String(error);
    } finally {
      this.busy = false;
    }
  }

  private async importGame(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy = true;
    try {
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("The imported file exceeds the 128 MiB safety limit");
      const text = file.name.endsWith(".gz")
        ? await new Response(
            file.stream().pipeThrough(new DecompressionStream("gzip")),
          ).text()
        : await file.text();
      if (text.length > 256 * 1024 * 1024)
        throw new Error(
          "The decompressed file exceeds the 256 MiB safety limit",
        );
      await importSoloRecord(JSON.parse(text) as unknown);
      this.message = "Replay imported. Choose Watch to play it on this build.";
      await this.refresh();
    } catch (error) {
      this.message = "Import failed: " + String(error);
    } finally {
      input.value = "";
      this.busy = false;
    }
  }

  private async copyReference(gameID: string, link: boolean): Promise<void> {
    try {
      const value = link
        ? `${window.location.origin}/#replay-viewer=${encodeURIComponent(gameID)}`
        : gameID;
      await navigator.clipboard.writeText(value);
      this.message = link
        ? "Copied replay link. This replay is LOCAL ONLY: other devices cannot open it without an explicit import or future authenticated cloud sync."
        : "Copied game ID. This replay is LOCAL ONLY and is not published online.";
    } catch (error) {
      this.message = "Copy failed: " + String(error);
    }
  }

  private async removeGame(gameID: string): Promise<void> {
    if (!window.confirm("Delete this local Solo replay permanently?")) return;
    this.busy = true;
    try {
      await deleteSoloRecord(gameID);
      await this.refresh();
    } catch (error) {
      this.message = "Delete failed: " + String(error);
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`
      <details class="mt-3 rounded-lg border border-white/20 p-3 text-white/90">
        <summary class="cursor-pointer font-semibold">
          Saved Solo Replays (${this.entries.length})
        </summary>
        <div class="pt-3 space-y-3 text-sm">
          <p class="text-white/60">
            Offline, saved in this browser. Export important replays before
            clearing site data. Game IDs and replay links work in THIS browser only until you explicitly export/import them or a privately owned cloud backend is configured. Current matches save incrementally; sudden
            shutdown may lose recent turns.
          </p>
          <p class="text-xs text-white/50">${this.storage}</p>
          <label
            class="inline-block cursor-pointer rounded border border-white/30 px-3 py-2"
          >
            Import .json / .json.gz
            <input
              type="file"
              accept=".json,.gz,.json.gz"
              class="sr-only"
              ?disabled=${this.busy}
              @change=${this.importGame}
            />
          </label>
          <button
            class="rounded border border-white/30 px-3 py-2 ml-2"
            ?disabled=${this.busy}
            @click=${() => void this.refresh()}
          >
            Refresh
          </button>
          ${this.message
            ? html`<p role="status" class="text-amber-300">${this.message}</p>`
            : nothing}
          ${this.entries.length === 0
            ? html`<p>No local Solo replays recorded yet.</p>`
            : this.entries.map(
                (game) => html` <div
                  class="rounded border border-white/15 p-3 space-y-1"
                >
                  <p class="font-semibold">
                    ${game.startInfo.config.gameMap} ·
                    ${game.startInfo.config.mapAreaMultiplier ?? 1}× ·
                    ${new Date(game.startedAt).toLocaleString()}
                  </p>
                  <p class="text-xs text-white/60">
                    ${game.lastRecordedTurn + 1} turns ·
                    ${game.winner ? "Victory" : "No winner"} ·
                    ${game.finished ? "Exited" : "Interrupted / active"} · first
                    win tick ${game.wonAtTick ?? "—"}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      ?disabled=${this.busy || game.lastRecordedTurn < 0}
                      class="rounded bg-blue-700 px-3 py-1"
                      @click=${() => {
                        window.location.hash = "replay-viewer=" + game.gameID;
                      }}
                    >
                      Watch
                    </button>
                    <button
                      ?disabled=${this.busy}
                      class="rounded border border-white/30 px-3 py-1"
                      @click=${() => void this.copyReference(game.gameID, false)}
                    >
                      Copy game ID
                    </button>
                    <button
                      ?disabled=${this.busy}
                      class="rounded border border-white/30 px-3 py-1"
                      @click=${() => void this.copyReference(game.gameID, true)}
                    >
                      Copy replay link
                    </button>
                    <button
                      ?disabled=${this.busy}
                      class="rounded border border-white/30 px-3 py-1"
                      @click=${() => void this.exportGame(game.gameID)}
                    >
                      Export
                    </button>
                    <button
                      ?disabled=${this.busy}
                      class="rounded border border-red-500/40 px-3 py-1 text-red-300"
                      @click=${() => void this.removeGame(game.gameID)}
                    >
                      Delete
                    </button>
                  </div>
                </div>`,
              )}
        </div>
      </details>
    `;
  }
}
