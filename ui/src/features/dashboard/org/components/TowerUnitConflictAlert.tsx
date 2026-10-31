import { AlertTriangle } from 'lucide-react';

import { formatTowerAndUnit } from '@/features/dashboard/org/lib/propertyTowerUnit';
import type { PropertyTowerUnitConflict } from '@/features/dashboard/org/lib/propertyTowerUnitConflict';

import { cn } from '@/lib/utils';

type Props = {
  tower: string;
  unitNumber: string;
  conflict: PropertyTowerUnitConflict | null;
  className?: string;
};

/** Non-blocking succession warning when an ACTIVE peer already lists this unit. */
export function TowerUnitConflictAlert({ tower, unitNumber, conflict, className }: Props) {
  if (!conflict) return null;

  const label = formatTowerAndUnit(tower, unitNumber);
  const orgLabel = conflict.orgName.trim() || 'another organization';

  return (
    <div
      className={cn(
        'text-foreground flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3',
        className
      )}
      role="status"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden
      />
      <div className="space-y-1 text-[13px] leading-snug">
        <p>
          <span className="font-medium">{label}</span> is already listed under{' '}
          <span className="font-medium">{orgLabel}</span>.
        </p>
        <p className="text-muted-foreground">
          If you are taking over the management of this property, please continue. Submit the
          authorization documents to verify your ownership or management authority. We will review
          and confirm the transfer with the current management.
        </p>
        <p className="text-muted-foreground">
          If you only need dashboard access, please ask the current managing host to invite you
          through Team instead.
        </p>
      </div>
    </div>
  );
}
