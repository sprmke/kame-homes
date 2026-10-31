const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], label[for], .cta-btn';

export function isTemplatePreviewInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

/** Prevent navigation / submit in template preview without changing element styles. */
export function blockTemplatePreviewAction(event: Event): void {
  if (!isTemplatePreviewInteractiveTarget(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
}

export function blockTemplatePreviewKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  blockTemplatePreviewAction(event);
}

export function attachTemplatePreviewActionBlocker(root: Document | HTMLElement): () => void {
  const onClick = (event: Event) => blockTemplatePreviewAction(event);
  const onSubmit = (event: Event) => blockTemplatePreviewAction(event);
  const onKeyDown = (event: Event) => blockTemplatePreviewKeydown(event as KeyboardEvent);

  root.addEventListener('click', onClick, true);
  root.addEventListener('submit', onSubmit, true);
  root.addEventListener('keydown', onKeyDown, true);

  return () => {
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('submit', onSubmit, true);
    root.removeEventListener('keydown', onKeyDown, true);
  };
}
