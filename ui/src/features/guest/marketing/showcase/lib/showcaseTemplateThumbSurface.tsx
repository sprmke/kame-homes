import { useLayoutEffect, useRef, createContext, useContext, type ReactNode } from 'react';

const ShowcaseTemplateThumbSurfaceContext = createContext(false);

/**
 * Marks a subtree as a template-picker miniature.
 * - Context: shells skip menus / interactive chrome / document title.
 * - Strips section `id` attributes so duplicate `#hero` nodes cannot steal
 *   the page editor preview’s mobile menu portal or scrollspy.
 */
export function ShowcaseTemplateThumbSurface({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const stripDuplicateSectionIds = () => {
      for (const el of root.querySelectorAll<HTMLElement>('[id]')) {
        const id = el.id;
        if (!id) continue;
        if (!el.getAttribute('data-showcase-section')) {
          el.setAttribute('data-showcase-section', id);
        }
        el.removeAttribute('id');
        el.removeAttribute('data-page-editor-anchor');
      }
    };

    stripDuplicateSectionIds();
    const observer = new MutationObserver(stripDuplicateSectionIds);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['id', 'data-page-editor-anchor'],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <ShowcaseTemplateThumbSurfaceContext.Provider value={true}>
      <div ref={rootRef} className="contents" data-showcase-template-thumb-root="">
        {children}
      </div>
    </ShowcaseTemplateThumbSurfaceContext.Provider>
  );
}

export function useShowcaseTemplateThumbSurface(): boolean {
  return useContext(ShowcaseTemplateThumbSurfaceContext);
}
