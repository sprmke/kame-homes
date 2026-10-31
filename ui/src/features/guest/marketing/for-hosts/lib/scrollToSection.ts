export function scrollToSection(id: string, prefersReducedMotion: boolean) {
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}
