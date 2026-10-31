/** Format optional parking space dimension for public listing stats. */
export function formatParkingDimensionMeters(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} m`;
}
