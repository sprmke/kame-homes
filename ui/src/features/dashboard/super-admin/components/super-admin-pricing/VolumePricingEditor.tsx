import { Plus, Trash2 } from 'lucide-react';

import {
  computeOrgSubscriptionTotalPhp,
  discountedPlanPricePhp,
  normalizeVolumeDiscountTiers,
  type VolumeDiscountTier,
} from '@/features/dashboard/plans/lib/planPricing';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type VolumePricingEditorProps = {
  listPricePhp: number;
  discountPercent: number;
  volumeRampFloorPhp: number;
  volumeRampAtCount: number;
  volumeDiscountTiers: VolumeDiscountTier[];
  onVolumeRampFloorPhpChange: (value: number) => void;
  onVolumeRampAtCountChange: (value: number) => void;
  onVolumeDiscountTiersChange: (tiers: VolumeDiscountTier[]) => void;
  className?: string;
};

function sortedTiers(tiers: VolumeDiscountTier[]): VolumeDiscountTier[] {
  return normalizeVolumeDiscountTiers(tiers);
}

export function VolumePricingEditor({
  listPricePhp,
  discountPercent,
  volumeRampFloorPhp,
  volumeRampAtCount,
  volumeDiscountTiers,
  onVolumeRampFloorPhpChange,
  onVolumeRampAtCountChange,
  onVolumeDiscountTiersChange,
  className,
}: VolumePricingEditorProps) {
  const promoRate = discountedPlanPricePhp(listPricePhp, discountPercent);
  const tiers = sortedTiers(volumeDiscountTiers);
  const previewCounts = [1, 5, 10, 50].filter(
    (count) => count <= Math.max(10, volumeRampAtCount + 40)
  );

  const updateTier = (index: number, patch: Partial<VolumeDiscountTier>) => {
    const next = tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier));
    onVolumeDiscountTiersChange(sortedTiers(next));
  };

  const removeTier = (index: number) => {
    onVolumeDiscountTiersChange(tiers.filter((_, i) => i !== index));
  };

  const addTier = () => {
    const lastMin = tiers.length > 0 ? tiers[tiers.length - 1]!.minProperties : volumeRampAtCount;
    onVolumeDiscountTiersChange(
      sortedTiers([...tiers, { minProperties: lastMin + 10, discountPercent: 0 }])
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="volume-ramp-floor">Ramp floor (PHP/property)</Label>
          <Input
            id="volume-ramp-floor"
            type="number"
            min={0}
            step={1}
            value={volumeRampFloorPhp}
            onChange={(e) => onVolumeRampFloorPhpChange(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="volume-ramp-at">Ramp at (properties)</Label>
          <Input
            id="volume-ramp-at"
            type="number"
            min={1}
            step={1}
            value={volumeRampAtCount}
            onChange={(e) => onVolumeRampAtCountChange(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Volume discount tiers</Label>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addTier}>
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
        </div>

        {tiers.length === 0 ? (
          <p className="text-muted-foreground text-xs">No tiers. Only the ramp applies.</p>
        ) : (
          <ul className="space-y-2">
            {tiers.map((tier, index) => (
              <li key={`${tier.minProperties}-${index}`} className="flex items-end gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs" htmlFor={`tier-min-${index}`}>
                    Min properties
                  </Label>
                  <Input
                    id={`tier-min-${index}`}
                    type="number"
                    min={1}
                    step={1}
                    value={tier.minProperties}
                    onChange={(e) =>
                      updateTier(index, {
                        minProperties: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                      })
                    }
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="text-xs" htmlFor={`tier-discount-${index}`}>
                    Discount %
                  </Label>
                  <Input
                    id={`tier-discount-${index}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={tier.discountPercent}
                    onChange={(e) =>
                      updateTier(index, {
                        discountPercent: Math.min(
                          100,
                          Math.max(0, Math.floor(Number(e.target.value) || 0))
                        ),
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label={`Remove tier at ${tier.minProperties} properties`}
                  onClick={() => removeTier(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {promoRate > 0 ? (
        <div className="border-border rounded-lg border p-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Preview (promo rate ₱{promoRate.toLocaleString('en-PH')})
          </p>
          <ul className="mt-2 space-y-1 text-sm tabular-nums">
            {previewCounts.map((count) => {
              const total = computeOrgSubscriptionTotalPhp(promoRate, tiers, count, {
                volumeRampFloorPhp,
                volumeRampAtCount,
              });
              return (
                <li key={count} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {count} {count === 1 ? 'property' : 'properties'}
                  </span>
                  <span>
                    ₱{total.toLocaleString('en-PH')}
                    <span className="text-muted-foreground text-xs">
                      {' '}
                      (₱{Math.floor(total / count)}/property)
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
