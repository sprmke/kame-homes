import { Plus, Trash2 } from 'lucide-react';

import {
  addUnitType,
  removeUnitType,
  updateUnitType,
  type DevelopmentUnitType,
} from '@/features/dashboard/bookings/lib/unitTypes';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  list: DevelopmentUnitType[];
  disabled?: boolean;
  onChange: (next: DevelopmentUnitType[]) => void;
};

export function UnitTypesListEditor({ list, disabled = false, onChange }: Props) {
  return (
    <div className="space-y-3">
      {list.map((entry) => (
        <div
          key={entry.id}
          className="border-border/80 bg-background/60 grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.7fr))_auto]"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`unit-type-label-${entry.id}`}>Type</Label>
            <Input
              id={`unit-type-label-${entry.id}`}
              value={entry.label}
              disabled={disabled}
              onChange={(event) =>
                onChange(updateUnitType(list, entry.id, { label: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`unit-type-bedrooms-${entry.id}`}>Bedrooms</Label>
            <Input
              id={`unit-type-bedrooms-${entry.id}`}
              type="number"
              min={0}
              value={entry.bedrooms}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  updateUnitType(list, entry.id, {
                    bedrooms: Math.max(0, Number(event.target.value) || 0),
                  })
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`unit-type-bathrooms-${entry.id}`}>Bathrooms</Label>
            <Input
              id={`unit-type-bathrooms-${entry.id}`}
              type="number"
              min={0}
              step={0.5}
              value={entry.bathrooms}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  updateUnitType(list, entry.id, {
                    bathrooms: Math.max(0, Number(event.target.value) || 0),
                  })
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`unit-type-adults-${entry.id}`}>Max adults</Label>
            <Input
              id={`unit-type-adults-${entry.id}`}
              type="number"
              min={1}
              value={entry.maxAdults}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  updateUnitType(list, entry.id, {
                    maxAdults: Math.max(1, Number(event.target.value) || 1),
                  })
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`unit-type-children-${entry.id}`}>Max children</Label>
            <Input
              id={`unit-type-children-${entry.id}`}
              type="number"
              min={0}
              value={entry.maxChildren}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  updateUnitType(list, entry.id, {
                    maxChildren: Math.max(0, Number(event.target.value) || 0),
                  })
                )
              }
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground min-h-[44px] min-w-[44px]"
              disabled={disabled || list.length <= 1}
              aria-label={`Remove ${entry.label}`}
              onClick={() => onChange(removeUnitType(list, entry.id))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full sm:w-auto"
        disabled={disabled}
        onClick={() => onChange(addUnitType(list, 'New unit type'))}
      >
        <Plus className="size-4" aria-hidden />
        Add unit type
      </Button>
    </div>
  );
}
