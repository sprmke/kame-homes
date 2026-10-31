import { useEffect, type RefObject } from 'react';

const LOG = '[kame-polotno-overlay]';

function isTooltipContainer(container: HTMLElement): boolean {
  return container.querySelector('.bp5-tooltip') != null;
}

function readPlacement(container: HTMLElement): string {
  const inner = container.querySelector('.bp5-popover, .bp5-tooltip');
  const match = inner?.className.match(/bp5-popover-placement-(\w+)/);
  return match?.[1] ?? 'bottom';
}

function findAnchorTarget(root: HTMLElement): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>('.bp5-popover-target.bp5-popover-open') ??
    root.querySelector<HTMLElement>('.bp5-popover-target.bp5-active') ??
    root.querySelector<HTMLElement>('.bp5-popover-target:hover')
  );
}

function popperAlreadyAnchored(container: HTMLElement): boolean {
  const transform = container.style.transform;
  if (transform && transform !== 'none') return true;

  const top = container.style.top;
  const left = container.style.left;
  if (top && top !== '0px' && top !== 'auto') return true;
  if (left && left !== '0px' && left !== 'auto') return true;

  return false;
}

function applyManualAnchor(container: HTMLElement, root: HTMLElement): boolean {
  if (container.dataset.kameManualAnchor === 'true') return true;
  if (popperAlreadyAnchored(container)) return false;

  const target = findAnchorTarget(root);
  if (!target) return false;

  const targetRect = target.getBoundingClientRect();
  if (targetRect.width === 0 && targetRect.height === 0) return false;

  const width = container.offsetWidth || container.getBoundingClientRect().width || 200;
  const height = container.offsetHeight || container.getBoundingClientRect().height || 40;
  const placement = readPlacement(container);
  const tooltip = isTooltipContainer(container);
  const gap = 8;

  let top: number;
  let left: number;

  if (placement.startsWith('top')) {
    top = targetRect.top - height - gap;
    left = targetRect.left + targetRect.width / 2 - width / 2;
  } else if (placement.startsWith('left')) {
    left = targetRect.left - width - gap;
    top = targetRect.top + targetRect.height / 2 - height / 2;
  } else if (placement.startsWith('right')) {
    left = targetRect.right + gap;
    top = targetRect.top + targetRect.height / 2 - height / 2;
  } else {
    top = targetRect.bottom + gap;
    left = tooltip ? targetRect.left + targetRect.width / 2 - width / 2 : targetRect.left;
  }

  top = Math.min(Math.max(gap, top), window.innerHeight - height - gap);
  left = Math.min(Math.max(gap, left), window.innerWidth - width - gap);

  container.style.setProperty('position', 'fixed', 'important');
  container.style.setProperty('top', `${top}px`, 'important');
  container.style.setProperty('left', `${left}px`, 'important');
  container.style.setProperty('transform', 'none', 'important');
  container.style.setProperty('z-index', '10000', 'important');
  container.dataset.kameManualAnchor = 'true';

  if (import.meta.env.DEV) {
    console.info(LOG, 'manual anchor applied', {
      placement,
      tooltip,
      targetRect: {
        top: targetRect.top,
        left: targetRect.left,
        width: targetRect.width,
        height: targetRect.height,
      },
      anchoredAt: { top, left },
    });
  }

  return true;
}

function scheduleManualAnchor(
  container: HTMLElement,
  root: HTMLElement,
  mounted: { current: boolean },
  attempt = 0
) {
  if (attempt > 8) return;

  requestAnimationFrame(() => {
    if (!mounted.current || !document.body.contains(container)) return;

    const anchored = applyManualAnchor(container, root);
    const needsRetry =
      !anchored ||
      (container.offsetWidth === 0 && attempt < 8) ||
      (!popperAlreadyAnchored(container) && container.dataset.kameManualAnchor !== 'true');

    if (needsRetry) {
      scheduleManualAnchor(container, root, mounted, attempt + 1);
    }
  });
}

function reanchorVisibleContainers(root: HTMLElement, mounted: { current: boolean }) {
  if (!mounted.current) return;
  document
    .querySelectorAll<HTMLElement>('.bp5-popover-transition-container')
    .forEach((container) => {
      if (container.dataset.kameManualAnchor === 'true' || !popperAlreadyAnchored(container)) {
        delete container.dataset.kameManualAnchor;
        scheduleManualAnchor(container, root, mounted, 0);
      }
    });
}

/**
 * OpenPolotno's Blueprint poppers sometimes mount with top/left 0 (broken react-popper
 * context when deps are prebundled). Manually anchor portaled overlays to the open target.
 */
export function usePolotnoOverlayAnchor(studioRootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = studioRootRef.current;
    if (!root) return;

    const mounted = { current: true };

    const onMutation: MutationCallback = (records) => {
      if (!mounted.current) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;

          const containers: HTMLElement[] = [];
          if (node.classList.contains('bp5-popover-transition-container')) {
            containers.push(node as HTMLElement);
          }
          node.querySelectorAll<HTMLElement>('.bp5-popover-transition-container').forEach((el) => {
            containers.push(el);
          });

          for (const container of containers) {
            scheduleManualAnchor(container, root, mounted, 0);
          }
        }
      }
    };

    const observer = new MutationObserver(onMutation);
    observer.observe(document.body, { childList: true, subtree: true });

    const onLayoutChange = () => reanchorVisibleContainers(root, mounted);
    window.addEventListener('scroll', onLayoutChange, true);
    window.addEventListener('resize', onLayoutChange);

    return () => {
      mounted.current = false;
      observer.disconnect();
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
    };
  }, [studioRootRef]);
}
