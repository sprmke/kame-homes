import { useEffect, useRef } from 'react';

import {
  resolveShortcut,
  type ShortcutCommand,
} from '@/features/dashboard/marketing/lib/video/v2/shortcuts';

const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset']);

/** Text entry only. A focused slider or checkbox does not swallow editor shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function dialogOpen(): boolean {
  return Boolean(
    document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]')
  );
}

type Options = {
  enabled: boolean;
  fps: number;
  onCommand: (command: ShortcutCommand) => void;
};

/** Window-level editor shortcuts. Ignored while typing or while a dialog is open. */
export function useVideoEditorShortcutsV2({ enabled, fps, onCommand }: Options) {
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (dialogOpen()) return;
      const command = resolveShortcut(
        {
          key: event.key,
          mod: event.metaKey || event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          typing: isTyping(event.target),
          onClip: Boolean(target?.closest('[data-timeline-item]')),
          onControl: Boolean(target?.closest('button, a, [role="button"], [role="tab"]')),
        },
        fps
      );
      if (!command) return;
      event.preventDefault();
      commandRef.current(command);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, fps]);
}
