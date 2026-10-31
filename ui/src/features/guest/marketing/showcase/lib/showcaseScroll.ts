/**
 * Live / editor primary showcase — excludes Page Editor template-picker thumbs
 * so global DOM lookups never hit duplicate `#hero` nodes inside miniatures.
 */
export const SHOWCASE_PRIMARY_SCOPE_SELECTOR =
  '.showcase-scope:not([data-showcase-template-thumb])';

/** CSS custom properties painted on `.showcase-scope` (palette + accent). */
const SHOWCASE_SCOPE_CSS_VARS = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--ring',
  '--showcase-surface',
  '--showcase-surface-elevated',
  '--showcase-ink',
  '--showcase-ink-muted',
  '--showcase-ink-faint',
  '--showcase-border',
  '--showcase-border-strong',
  '--showcase-accent',
  '--showcase-on-accent',
  '--showcase-display-scale',
  '--showcase-body-scale',
] as const;

export type ShowcaseScopeThemeSnapshot = {
  style: Record<string, string>;
  surface: string | null;
};

/**
 * Snapshot palette vars from the primary showcase scope so portaled UI
 * (mobile menu in Page Editor / embed) keeps brand surfaces + accent.
 */
export function readShowcaseScopeTheme(
  scope: HTMLElement | null = typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>(SHOWCASE_PRIMARY_SCOPE_SELECTOR)
    : null
): ShowcaseScopeThemeSnapshot | null {
  if (!scope) return null;

  const computed = getComputedStyle(scope);
  const style: Record<string, string> = {};
  for (const key of SHOWCASE_SCOPE_CSS_VARS) {
    const value = computed.getPropertyValue(key).trim();
    if (value) style[key] = value;
  }

  // Do not copy scope backgroundColor/color onto portaled overlays — that would
  // paint the full-screen dialog (including the dimmed backdrop). Panels use
  // --showcase-surface / --showcase-ink via Tailwind classes instead.

  return {
    style,
    surface: scope.getAttribute('data-showcase-surface'),
  };
}

/** Nearest ancestor that scrolls vertically (Page Editor preview pane, embed root, etc.). */
export function findShowcaseScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el = start?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(overflowY)) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Non-scrolling overlay host beside the Page Editor preview scrollport
 * (`[data-page-editor-preview-chrome]`). Guest header/menu portal here with
 * `position: absolute` so they clip to the frame and stay under admin sheets.
 */
export function resolveShowcaseChromeHost(scrollRoot: HTMLElement | null): HTMLElement | null {
  if (!scrollRoot) return null;
  const parent = scrollRoot.parentElement;
  if (!parent) return null;
  return parent.querySelector<HTMLElement>(':scope > [data-page-editor-preview-chrome]');
}

/**
 * Keep a portaled overlay glued to a nested preview frame.
 * Nested scroll does not bubble, so we listen in capture phase and skip no-op rects
 * (scrolling inside the frame must not re-render the header).
 */
export function observeShowcaseFrameRect(
  frame: HTMLElement,
  onChange: (rect: DOMRectReadOnly) => void
): () => void {
  let last = { top: Number.NaN, left: Number.NaN, width: Number.NaN, height: Number.NaN };

  const sync = () => {
    const rect = frame.getBoundingClientRect();
    if (
      rect.top === last.top &&
      rect.left === last.left &&
      rect.width === last.width &&
      rect.height === last.height
    ) {
      return;
    }
    last = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    onChange(rect);
  };

  sync();
  const ro = new ResizeObserver(sync);
  ro.observe(frame);
  window.addEventListener('resize', sync);
  window.addEventListener('scroll', sync, { capture: true, passive: true });
  window.visualViewport?.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('scroll', sync);

  return () => {
    ro.disconnect();
    window.removeEventListener('resize', sync);
    window.removeEventListener('scroll', sync, { capture: true });
    window.visualViewport?.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('scroll', sync);
  };
}

/** Hero (or any section) belonging to the primary showcase only. */
export function findPrimaryShowcaseSection(sectionId: string): HTMLElement | null {
  const escaped = CSS.escape(sectionId);
  return (
    document.querySelector<HTMLElement>(`${SHOWCASE_PRIMARY_SCOPE_SELECTOR} #${escaped}`) ??
    document.querySelector<HTMLElement>(
      `${SHOWCASE_PRIMARY_SCOPE_SELECTOR} [data-page-editor-anchor="${escaped}"]`
    )
  );
}

export function findPrimaryShowcaseHero(): HTMLElement | null {
  return findPrimaryShowcaseSection('hero');
}

/** Scroll container for showcase: marked root, editor preview ancestor, or null (= window). */
export function resolveShowcaseScrollRoot(options: {
  embed: boolean;
  containedChrome: boolean;
  anchor?: HTMLElement | null;
}): HTMLElement | null {
  const markedRoot = document.querySelector<HTMLElement>(
    `${SHOWCASE_PRIMARY_SCOPE_SELECTOR}[data-showcase-scroll-root]`
  );
  if (markedRoot) return markedRoot;

  const anchor = options.anchor ?? findPrimaryShowcaseHero();
  if (options.embed || options.containedChrome) {
    return findShowcaseScrollableAncestor(anchor);
  }

  const ancestor = findShowcaseScrollableAncestor(anchor);
  if (ancestor && ancestor !== document.documentElement && ancestor !== document.body) {
    return ancestor;
  }

  return null;
}

/** Scroll the showcase root (embed / Page Editor) or the document on live guest pages. */
export function scrollShowcaseToTop(behavior: ScrollBehavior = 'smooth') {
  const embedRoot = document.querySelector<HTMLElement>(
    `${SHOWCASE_PRIMARY_SCOPE_SELECTOR}[data-showcase-scroll-root]`
  );
  if (embedRoot) {
    embedRoot.scrollTo({ top: 0, behavior });
    return;
  }

  const hero = findPrimaryShowcaseHero();
  const previewRoot = findShowcaseScrollableAncestor(hero);
  if (previewRoot) {
    previewRoot.scrollTo({ top: 0, behavior });
    return;
  }

  window.scrollTo({ top: 0, behavior });
}

/** Monolith / Aurora header switches to solid bar once hero clears the chrome. */
export const SHOWCASE_HEADER_SOLID_THRESHOLD_PX = 76;

/** @deprecated use SHOWCASE_HEADER_SOLID_THRESHOLD_PX */
export const MONOLITH_HEADER_SOLID_THRESHOLD_PX = SHOWCASE_HEADER_SOLID_THRESHOLD_PX;

/**
 * True when the hero section has scrolled past the header chrome.
 * Uses the nearest scrollport top (Page Editor preview, embed) — not always viewport y=0.
 */
export function isShowcaseHeaderSolid(
  thresholdPx = SHOWCASE_HEADER_SOLID_THRESHOLD_PX,
  scrollRoot?: HTMLElement | null
): boolean {
  const hero = findPrimaryShowcaseHero();
  if (!hero) return true;

  const heroRect = hero.getBoundingClientRect();
  const root = scrollRoot ?? findShowcaseScrollableAncestor(hero);

  if (root) {
    const rootTop = root.getBoundingClientRect().top;
    return heroRect.bottom <= rootTop + thresholdPx;
  }

  return heroRect.bottom <= thresholdPx;
}

/** @deprecated use isShowcaseHeaderSolid */
export function isMonolithHeaderSolid(
  thresholdPx = SHOWCASE_HEADER_SOLID_THRESHOLD_PX,
  scrollRoot?: HTMLElement | null
): boolean {
  return isShowcaseHeaderSolid(thresholdPx, scrollRoot);
}
