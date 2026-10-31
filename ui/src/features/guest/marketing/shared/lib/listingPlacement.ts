const AZURE_TOWERS = ['Monaco', 'Bali', 'Barbados'] as const;

export function parseTowerAndUnit(
  tower: string | null | undefined,
  unitNumber: string | null | undefined,
  towerAndUnit: string | null | undefined
): { tower: string | null; unitNumber: string | null } {
  const directTower = tower?.trim() || null;
  const directUnit = unitNumber?.trim() || null;
  if (directTower && directUnit) {
    return { tower: directTower, unitNumber: directUnit };
  }

  const legacy = towerAndUnit?.trim();
  if (!legacy) {
    return { tower: directTower, unitNumber: directUnit };
  }

  for (const candidate of AZURE_TOWERS) {
    const pattern = new RegExp(`^${candidate}\\s+(\\d{4})$`, 'i');
    const match = legacy.match(pattern);
    if (match) {
      return { tower: candidate, unitNumber: match[1] ?? null };
    }
  }

  const generic = legacy.match(/^(.+?)\s+(\d{4})$/);
  if (generic) {
    return {
      tower: directTower ?? generic[1]?.trim() ?? null,
      unitNumber: directUnit ?? generic[2] ?? null,
    };
  }

  return { tower: directTower ?? legacy, unitNumber: directUnit };
}

/** Azure-style 4-digit unit numbers encode floor in the first two digits (e.g. 2604 → Floor 26). */
export function floorLabelFromUnitNumber(unitNumber: string | null | undefined): string | null {
  const trimmed = unitNumber?.trim() ?? '';
  if (!/^\d{4}$/.test(trimmed)) return null;
  const floor = Number.parseInt(trimmed.slice(0, 2), 10);
  if (!Number.isFinite(floor) || floor <= 0) return null;
  return `Floor ${floor}`;
}

export function buildPropertyPlacementLabels(input: {
  tower?: string | null;
  unitNumber?: string | null;
  towerAndUnit?: string | null;
}): string[] {
  const { tower, unitNumber } = parseTowerAndUnit(
    input.tower,
    input.unitNumber,
    input.towerAndUnit
  );
  const labels: string[] = [];
  if (tower) labels.push(tower);
  const floor = floorLabelFromUnitNumber(unitNumber);
  if (floor) labels.push(floor);
  return labels;
}

export function formatParkingLevelLabel(level: string | null | undefined): string | null {
  const trimmed = level?.trim();
  if (!trimmed) return null;
  if (/^level\s+/i.test(trimmed)) return trimmed;
  return `Level ${trimmed}`;
}

export function buildParkingPlacementLabels(
  tower: string | null | undefined,
  level: string | null | undefined
): string[] {
  const labels: string[] = [];
  if (tower?.trim()) labels.push(tower.trim());
  const levelLabel = formatParkingLevelLabel(level);
  if (levelLabel) labels.push(levelLabel);
  return labels;
}
