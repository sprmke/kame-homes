/**
 * Shared contract between the AI review card's "Playbook: …" pills and the Improvement Playbook
 * list below it. Clicking a pill expands the matching article (React state) and then reveals it
 * (DOM), so a repeat click on an already-expanded article still brings it back into view.
 */

/** DOM id on each playbook article, also the `#playbook-<slug>` anchor target. */
export function playbookArticleElementId(slug: string): string {
  return `playbook-${slug}`;
}

/** Marks the disclosure button inside an article, so reveal can move focus onto it. */
export const PLAYBOOK_ARTICLE_TRIGGER_ATTR = 'data-playbook-trigger';

/** Scrolls a playbook article into view and focuses its disclosure. No-op when not rendered. */
export function revealPlaybookArticle(slug: string, options?: { reducedMotion?: boolean }): void {
  const article = document.getElementById(playbookArticleElementId(slug));
  if (!article) return;
  article
    .querySelector<HTMLElement>(`[${PLAYBOOK_ARTICLE_TRIGGER_ATTR}]`)
    ?.focus({ preventScroll: true });
  article.scrollIntoView({
    block: 'nearest',
    behavior: options?.reducedMotion ? 'auto' : 'smooth',
  });
}
