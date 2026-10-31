import { useEffect, type RefObject } from 'react';

export function useDismissOnOutsideClick(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const target = e.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        onClose();
      }
    };
    // Capture + pointerdown so Radix Select/Dropdown triggers still dismiss siblings
    // before their own open state commits.
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open, onClose, ref]);
}
