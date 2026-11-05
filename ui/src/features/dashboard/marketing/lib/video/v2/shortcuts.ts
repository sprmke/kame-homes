/**
 * Keyboard map for the v2 editor. Pure: the hook feeds key events in and runs the command.
 * Undo/redo live in `useVideoProjectHistoryShortcuts`.
 */

export type ShortcutCommand =
  | { type: 'toggle-play' }
  | { type: 'split' }
  | { type: 'delete'; ripple: boolean }
  | { type: 'duplicate' }
  | { type: 'copy' }
  | { type: 'paste' }
  | { type: 'select-all' }
  | { type: 'deselect' }
  | { type: 'step'; frames: number };

export type ShortcutInput = {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
  /** Typing in an input, textarea, select or contenteditable. */
  typing: boolean;
  /** Focus is on a timeline clip (it handles its own arrows and Enter). */
  onClip: boolean;
  /** A button or link has focus (Space/Enter belong to it). */
  onControl: boolean;
};

export function resolveShortcut(input: ShortcutInput, fps: number): ShortcutCommand | null {
  if (input.typing || input.alt) return null;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;

  if (input.mod) {
    switch (key) {
      case 'd':
        return { type: 'duplicate' };
      case 'c':
        return { type: 'copy' };
      case 'v':
        return { type: 'paste' };
      case 'a':
        return { type: 'select-all' };
      default:
        return null;
    }
  }

  switch (key) {
    case ' ':
      return input.onControl ? null : { type: 'toggle-play' };
    case 's':
      return { type: 'split' };
    case 'Delete':
    case 'Backspace':
      return { type: 'delete', ripple: input.shift };
    case 'Escape':
      return { type: 'deselect' };
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (input.onClip) return null;
      const size = input.shift ? fps : 1;
      return { type: 'step', frames: key === 'ArrowRight' ? size : -size };
    }
    default:
      return null;
  }
}
