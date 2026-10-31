import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

type PageEditorPreviewScrollApi = {
  registerScrollRoot: (el: HTMLElement | null) => void;
  scrollToAnchor: (anchor: string) => void;
  scrollToTop: (behavior?: ScrollBehavior) => void;
};

const PageEditorPreviewScrollContext = createContext<PageEditorPreviewScrollApi | null>(null);

function offsetTopWithin(element: HTMLElement, ancestor: HTMLElement): number {
  const ancestorRect = ancestor.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top - ancestorRect.top + ancestor.scrollTop;
}

export function PageEditorPreviewScrollProvider({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement | null>(null);

  const registerScrollRoot = useCallback((el: HTMLElement | null) => {
    rootRef.current = el;
  }, []);

  const scrollToAnchor = useCallback((anchor: string) => {
    const root = rootRef.current;
    const trimmed = anchor.trim();
    if (!root || !trimmed) return;

    const target =
      (root.querySelector(
        `[data-page-editor-anchor="${CSS.escape(trimmed)}"]`
      ) as HTMLElement | null) ??
      (root.querySelector(`#${CSS.escape(trimmed)}`) as HTMLElement | null);
    if (!target) return;

    const top = Math.max(0, offsetTopWithin(target, root) - 12);
    root.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'auto') => {
    const root = rootRef.current;
    if (!root) return;
    root.scrollTo({ top: 0, behavior });
  }, []);

  return (
    <PageEditorPreviewScrollContext.Provider
      value={{ registerScrollRoot, scrollToAnchor, scrollToTop }}
    >
      {children}
    </PageEditorPreviewScrollContext.Provider>
  );
}

export function usePageEditorPreviewScroll(): PageEditorPreviewScrollApi | null {
  return useContext(PageEditorPreviewScrollContext);
}

/** Scroll the preview frame to `anchor`. No-op when anchor is null/undefined (global settings). */
export function useRevealPreviewAnchor(anchor: string | null | undefined) {
  const api = usePageEditorPreviewScroll();
  const lastRef = useRef({ anchor: '', at: 0 });

  return useCallback(() => {
    const trimmed = anchor?.trim() || '';
    if (!trimmed || !api) return;
    const now = Date.now();
    if (lastRef.current.anchor === trimmed && now - lastRef.current.at < 350) return;
    lastRef.current = { anchor: trimmed, at: now };
    window.requestAnimationFrame(() => {
      api.scrollToAnchor(trimmed);
    });
  }, [anchor, api]);
}

type RevealProps = {
  /** Preview anchor id. Omit / null for global fields (no scroll). */
  anchor?: string | null;
  children: ReactNode;
  className?: string;
};

/**
 * When the user focuses or presses inside this control block, scroll the live
 * preview to the matching section. Skip by leaving `anchor` empty.
 */
export function PageEditorRevealTarget({ anchor = null, children, className }: RevealProps) {
  const reveal = useRevealPreviewAnchor(anchor);

  const handle = (event: { stopPropagation: () => void }) => {
    // Innermost reveal wins when controls nest (chapter → section card).
    event.stopPropagation();
    reveal();
  };

  return (
    <div className={className} onFocus={handle} onPointerDown={handle}>
      {children}
    </div>
  );
}

/** Call when a controlled accordion/panel opens so the preview follows. */
export function useRevealPreviewOnOpen(open: boolean, anchor: string | null | undefined) {
  const reveal = useRevealPreviewAnchor(anchor);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) {
      // Let accordion content mount before measuring.
      const id = window.setTimeout(reveal, 40);
      wasOpen.current = open;
      return () => window.clearTimeout(id);
    }
    wasOpen.current = open;
  }, [open, reveal]);
}
