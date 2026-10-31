import { useEffect, type RefObject } from 'react';

const LOG = '[kame-polotno-overlay]';

type TransformAncestor = {
  tag: string;
  className: string;
  transform: string;
  filter: string;
  perspective: string;
  contain: string;
  willChange: string;
  overflow: string;
  position: string;
};

function collectTransformAncestors(
  from: Element | null,
  stopAt: Element | null
): TransformAncestor[] {
  const hits: TransformAncestor[] = [];
  let el = from?.parentElement ?? null;
  while (el && el !== stopAt && el !== document.documentElement) {
    const style = getComputedStyle(el);
    const hasRisk =
      style.transform !== 'none' ||
      style.filter !== 'none' ||
      style.perspective !== 'none' ||
      style.contain.includes('paint') ||
      style.willChange.includes('transform');
    if (hasRisk) {
      hits.push({
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString?.().slice(0, 120) ?? '',
        transform: style.transform,
        filter: style.filter,
        perspective: style.perspective,
        contain: style.contain,
        willChange: style.willChange,
        overflow: `${style.overflowX}/${style.overflowY}`,
        position: style.position,
      });
    }
    el = el.parentElement;
  }
  return hits;
}

function findTransitionContainer(node: Element): Element | null {
  return node.closest('.bp5-popover-transition-container');
}

function inspectOverlay(
  node: Element,
  kind: 'popover' | 'tooltip',
  studioRoot: HTMLElement | null
) {
  const container = findTransitionContainer(node) ?? node;
  const rect = container.getBoundingClientRect();
  const style = getComputedStyle(container);
  const inner = node.classList.contains('bp5-popover-transition-container')
    ? node.querySelector('.bp5-popover, .bp5-tooltip')
    : node;
  const innerStyle = inner ? getComputedStyle(inner) : null;
  const placement =
    container.getAttribute('data-popper-placement') ?? node.getAttribute('data-popper-placement');
  const inlineTransform = container instanceof HTMLElement ? container.style.transform : '';
  const isMisplaced =
    rect.top < 24 &&
    rect.left < 80 &&
    (!placement || inlineTransform === '' || inlineTransform === 'none');

  const payload = {
    kind,
    misplaced: isMisplaced,
    transitionContainer: {
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      computed: {
        position: style.position,
        top: style.top,
        left: style.left,
        transform: style.transform,
      },
      inlineTransform,
      placement,
    },
    innerContent:
      innerStyle && inner
        ? {
            transform: innerStyle.transform,
            className: inner.className?.toString?.().slice(0, 80) ?? '',
          }
        : null,
    portalParent: container.parentElement?.className?.toString?.().slice(0, 80) ?? null,
    transformAncestorsFromStudio: studioRoot
      ? collectTransformAncestors(studioRoot, document.body)
      : [],
  };

  if (isMisplaced) {
    console.warn(LOG, 'misplaced overlay: popper did not anchor transition container', payload);
  } else {
    console.info(LOG, 'overlay mounted', payload);
  }
}

function logToolbarTrigger(studioRoot: HTMLElement, target: Element) {
  const button = target.closest('button');
  if (!button || !studioRoot.contains(button)) return;

  const toolbar = button.closest('.raeditor-toolbar');
  if (!toolbar) return;

  const rect = button.getBoundingClientRect();
  console.info(LOG, 'toolbar control clicked', {
    label: button.textContent?.trim().slice(0, 40) ?? '',
    ariaLabel: button.getAttribute('aria-label'),
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    connected: button.isConnected,
    display: getComputedStyle(button).display,
  });

  requestAnimationFrame(() => {
    const containers = document.querySelectorAll('.bp5-popover-transition-container');
    console.info(LOG, 'overlays after click (rAF)', {
      transitionContainerCount: containers.length,
      containers: [...containers].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          top: r.top,
          left: r.left,
          placement: el.getAttribute('data-popper-placement'),
          inlineTransform: el instanceof HTMLElement ? el.style.transform : '',
          computedTransform: getComputedStyle(el).transform,
        };
      }),
    });
  });
}

import { isPolotnoOverlayDebugEnabled } from '@/features/dashboard/marketing/lib/polotno/configurePolotnoOverlays';

/** Dev-only diagnostics for Blueprint popovers/tooltips anchoring at (0,0). */
export function usePolotnoOverlayDebug(studioRootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isPolotnoOverlayDebugEnabled()) return;

    const studioRoot = studioRootRef.current;
    console.info(LOG, 'debug enabled: open font picker / hover toolbar icons and watch console', {
      studioRoot: studioRoot?.className ?? null,
      studioRect: studioRoot?.getBoundingClientRect(),
      bodyChildren: document.body.childElementCount,
    });

    const onBodyMutation: MutationCallback = (records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (node.classList.contains('bp5-popover')) {
            inspectOverlay(node, 'popover', studioRootRef.current);
          } else if (node.classList.contains('bp5-tooltip')) {
            inspectOverlay(node, 'tooltip', studioRootRef.current);
          } else if (node.classList.contains('bp5-popover-transition-container')) {
            const inner = node.querySelector('.bp5-popover') ?? node.querySelector('.bp5-tooltip');
            if (inner) {
              inspectOverlay(
                inner,
                inner.classList.contains('bp5-tooltip') ? 'tooltip' : 'popover',
                studioRootRef.current
              );
            }
          } else {
            node.querySelectorAll('.bp5-popover').forEach((el) => {
              inspectOverlay(el, 'popover', studioRootRef.current);
            });
            node.querySelectorAll('.bp5-tooltip').forEach((el) => {
              inspectOverlay(el, 'tooltip', studioRootRef.current);
            });
          }
        }
      }
    };

    const observer = new MutationObserver(onBodyMutation);
    observer.observe(document.body, { childList: true, subtree: true });

    const onClick = (event: MouseEvent) => {
      const root = studioRootRef.current;
      if (!root) return;
      logToolbarTrigger(root, event.target instanceof Element ? event.target : root);
    };

    studioRoot?.addEventListener('click', onClick, true);

    return () => {
      observer.disconnect();
      studioRoot?.removeEventListener('click', onClick, true);
    };
  }, [studioRootRef]);
}
