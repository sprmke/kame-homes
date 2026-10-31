/**
 * Editor **Scale** control — multiplies display + body sizes via CSS vars on `.showcase-scope`.
 * Class strings must stay literal (Tailwind JIT).
 */

export const SHOWCASE_DISPLAY_SCALE_VAR = 'var(--showcase-display-scale, 1)';
export const SHOWCASE_BODY_SCALE_VAR = 'var(--showcase-body-scale, 1)';

export function showcaseScaledRem(rem: number): string {
  return `calc(${rem}rem * ${SHOWCASE_DISPLAY_SCALE_VAR})`;
}

export function showcaseScaledVw(vw: number): string {
  return `calc(${vw}vw * ${SHOWCASE_DISPLAY_SCALE_VAR})`;
}

/** Wrap a CSS `clamp()` expression so editor Scale multiplies the result. */
export function showcaseScaledClampExpr(clampExpr: string): string {
  return `calc(${clampExpr} * ${SHOWCASE_DISPLAY_SCALE_VAR})`;
}

export function showcaseScaledClampClass(minRem: number, vw: number, maxRem: number): string {
  return `text-[clamp(calc(${minRem}rem*var(--showcase-display-scale,1)),calc(${vw}vw*var(--showcase-display-scale,1)),calc(${maxRem}rem*var(--showcase-display-scale,1)))]`;
}

/** Section h2 — aurora / haven default band. */
export const showcaseSectionHeadingClass =
  '@sm:text-[calc(2.25rem*var(--showcase-display-scale,1))] text-[calc(1.875rem*var(--showcase-display-scale,1))] font-semibold tracking-tight';

/** Section h2 — larger band (CTA, atlas). */
export const showcaseSectionHeadingLgClass =
  '@md:text-[calc(3rem*var(--showcase-display-scale,1))] @sm:text-[calc(2.25rem*var(--showcase-display-scale,1))] text-[calc(1.875rem*var(--showcase-display-scale,1))]';

/** Editorial template section titles (Cormorant). */
export const showcaseEditorialSectionHeadingClass =
  'font-cormorant @sm:text-[calc(3rem*var(--showcase-display-scale,1))] text-[calc(1.875rem*var(--showcase-display-scale,1))] tracking-tight';

/** Body copy tied to Scale — use instead of bare `text-base` in showcase sections. */
export const showcaseBodyTextClass =
  'text-[length:calc(1rem*var(--showcase-body-scale,1))] leading-relaxed';
