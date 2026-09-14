import {
  VIDEO_DURATION_LABELS,
  VIDEO_RESOLUTION_LABELS,
  videoTierOptions,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import type {
  VideoDuration,
  VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
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
  resolution: VideoResolution;
  onResolutionChange: (resolution: VideoResolution) => void;
  durationSeconds: VideoDuration;
  onDurationSecondsChange: (durationSeconds: VideoDuration) => void;
  /** 1080p is offered on Business+ (the same plan that unlocks video). */
  allowHighResolution?: boolean;
  allowPremium?: boolean;
  disabled?: boolean;
};

/** Video advanced controls — Quality + Resolution + Length. Shape is in AiStudioAspectPicker. */
export function AiStudioVideoOptionsBar({
  tier,
  onTierChange,
  resolution,
  onResolutionChange,
  durationSeconds,
  onDurationSecondsChange,
  allowHighResolution = false,
  allowPremium = false,
  disabled,
}: Props) {
  const tiers = videoTierOptions(allowPremium);
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="settings-field-label" htmlFor="ai-studio-video-resolution">
            Resolution
          </Label>
          <Select
            value={resolution}
            onValueChange={(value) => onResolutionChange(value as VideoResolution)}
            disabled={disabled || !allowHighResolution}
          >
            <SelectTrigger id="ai-studio-video-resolution" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">{VIDEO_RESOLUTION_LABELS['720p']}</SelectItem>
              {allowHighResolution && (
                <SelectItem value="1080p">{VIDEO_RESOLUTION_LABELS['1080p']}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="settings-field-label" htmlFor="ai-studio-video-duration">
            Length
          </Label>
          <Select
            value={String(durationSeconds)}
            onValueChange={(value) => onDurationSecondsChange(Number(value) as VideoDuration)}
            disabled={disabled}
          >
            <SelectTrigger id="ai-studio-video-duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">{VIDEO_DURATION_LABELS[6]}</SelectItem>
              <SelectItem value="8">{VIDEO_DURATION_LABELS[8]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
