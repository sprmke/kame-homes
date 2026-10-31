export function parkingTypeLabel(type: string): string {
  if (type === 'inside_tower') return 'Inside tower';
  if (type === 'outside_tower') return 'Outside tower';
  if (type === 'motorcycle') return 'Motorcycle';
  return type;
}
