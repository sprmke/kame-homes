/** Scroll to an in-page section and move focus to its heading for keyboard / screen reader users. */
export function scrollToTripSection(hash: string): void {
  const target = document.getElementById(hash.replace(/^#/, ''));
  if (!target) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  const heading = target.querySelector<HTMLElement>('h2, h3') ?? target;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}
