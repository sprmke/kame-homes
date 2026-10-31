export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Smooth 0→1 ramp between edges (Airbnb-style UI fades). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - clamp01(t)) ** 3;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
