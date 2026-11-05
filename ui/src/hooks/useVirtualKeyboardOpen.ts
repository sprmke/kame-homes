import { useEffect, useState } from 'react';

/**
 * Height the on-screen keyboard must eat before we call it open. Below this,
 * the shrink is browser chrome (Safari's collapsing toolbar), not a keyboard.
 */
const KEYBOARD_MIN_PX = 140;

/**
 * True while the on-screen keyboard covers part of the viewport.
 *
 * The docked bottom bar is `position: fixed`, so on Android (and iOS when the
 * page is not resized) it rides up on top of the keyboard and covers the field
 * the user is typing into. Chrome hides itself while this is true.
 *
 * Uses `visualViewport`, which is the only reliable keyboard signal on the web;
 * returns `false` when unavailable so desktop and old browsers keep the bar.
 */
export function useVirtualKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
    if (!vv) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      // Keyboard is the gap between the layout viewport and the visual one.
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      setOpen(hidden > KEYBOARD_MIN_PX);
    };
    const onChange = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
    };
  }, []);

  return open;
}
