/** Replay frame upload policy, separate from the live game's visual tile drip.
 *
 * Normal frame playback has already advanced the replay timeline, so every
 * changed territory tile must be applied before the matching frame is drawn.
 * A seek triggers a full tile-state upload, which already clears old drip
 * buckets; no extra flush is necessary there.
 */
import { uploadFrameData, type FrameUploadTarget } from "../render/frame/Upload";
import type { FrameData } from "../render/types";

export interface ReplayFrameUploadTarget extends FrameUploadTarget {
  flushReplayTileDeltas(): void;
}

export function uploadReplayFrame(
  view: ReplayFrameUploadTarget,
  frame: FrameData,
  seeked: boolean,
): void {
  uploadFrameData(view, frame);
  if (!seeked) view.flushReplayTileDeltas();
}
