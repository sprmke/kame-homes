import {
  IMAGE_SIZE_LABELS,
  imageSizeOptions,
  imageTierOptions,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import type { ImageSize } from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/sliding-tabs';

type Props = {
  tier: MarketingGenerationTier;
  onTierChange: (tier: MarketingGenerationTier) => void;
  imageSize: ImageSize;
  onImageSizeChange: (imageSize: ImageSize) => void;
  allowPremium?: boolean;
  disabled?: boolean;
};

/** Image advanced controls — Quality + Size. Shape lives in AiStudioAspectPicker. */
export function AiStudioOptionsBar({
  tier,
  onTierChange,
  imageSize,
  onImageSizeChange,
  allowPremium = false,
  disabled,
}: Props) {
  const sizes = imageSizeOptions(tier);
  const tiers = imageTierOptions(allowPremium);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="settings-field-label">Quality</Label>
        <SegmentedControl
          value={tier}
          onChange={onTierChange}
          size="dense"
          fullWidth
          aria-label="Quality"
          options={tiers.map((option) => ({
            value: option.value,
            label: option.label,
            ariaLabel: `${option.label}. ${option.hint}`,
            disabled,
          }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="settings-field-label" htmlFor="ai-studio-size">
          Size
        </Label>
        <Select
          value={imageSize}
          onValueChange={(value) => onImageSizeChange(value as ImageSize)}
          disabled={disabled || sizes.length === 1}
        >
          <SelectTrigger id="ai-studio-size" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((size) => (
              <SelectItem key={size} value={size}>
                {IMAGE_SIZE_LABELS[size]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
