/**
 * The track-based video editor (v2). `VITE_VIDEO_EDITOR_V2=false` falls back to the scene
 * editor, which stays one release as the rollback path. Saved projects are data, not UI: v1
 * rows always open in whichever editor is on (v2 upgrades them on open).
 */
export function isVideoEditorV2Enabled(
  value: string | undefined = import.meta.env.VITE_VIDEO_EDITOR_V2
): boolean {
  return value?.trim().toLowerCase() !== 'false';
}
