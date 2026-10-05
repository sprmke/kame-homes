/**
 * Which gallery slides a listing card should mount.
 *
 * Mounting every slide (even at opacity 0) downloads the whole gallery for every card in
 * view. Cards mount the current slide, every slide already shown (so crossfades and
 * back-navigation stay instant), and the neighbours once the guest shows intent
 * (hover / focus / touch) so the next tap is already loaded.
 */
export function galleryIndicesToMount(
  count: number,
  current: number,
  visited: ReadonlySet<number>,
  warm: boolean
): Set<number> {
  const mounted = new Set<number>();
  if (count <= 0) return mounted;
  const safeCurrent = ((current % count) + count) % count;
  mounted.add(safeCurrent);
  for (const index of visited) {
    if (index >= 0 && index < count) mounted.add(index);
  }
  if (warm && count > 1) {
    mounted.add((safeCurrent + 1) % count);
    mounted.add((safeCurrent - 1 + count) % count);
  }
  return mounted;
}

/** Card entrance stagger, capped so long grids do not wait seconds for the last card. */
export function cardEntranceDelay(index: number, step = 0.05, maxSteps = 8): number {
  return Math.min(Math.max(index, 0), maxSteps) * step;
}
