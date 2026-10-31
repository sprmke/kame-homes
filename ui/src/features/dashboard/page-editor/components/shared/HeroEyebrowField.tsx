import { useEffect, useState } from 'react';

import type { ShowcaseTextSourceConfig } from '@/features/guest/marketing/showcase/types/showcase';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  value?: ShowcaseTextSourceConfig;
  onChange: (next: ShowcaseTextSourceConfig | undefined) => void;
  /** When false, Development is hidden from the dropdown. */
  developmentAvailable: boolean;
  developmentName?: string | null;
  /** Field label — e.g. "Above heading" (hero) or "Under heading" (location). */
  label?: string;
  idPrefix?: string;
};

export function HeroEyebrowField({
  value,
  onChange,
  developmentAvailable,
  developmentName,
  label = 'Above heading',
  idPrefix = 'showcase-text-source',
}: Props) {
  const unsetDefault = developmentAvailable ? 'development' : 'location';
  const source = value?.source ?? unsetDefault;
  const [customDraft, setCustomDraft] = useState(value?.customText ?? '');

  useEffect(() => {
    setCustomDraft(value?.customText ?? '');
  }, [value?.customText]);

  const effectiveSource = source === 'development' && !developmentAvailable ? 'location' : source;

  const sourceId = `${idPrefix}-source`;
  const customId = `${idPrefix}-custom`;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={sourceId}>{label}</Label>
        <Select
          value={effectiveSource}
          onValueChange={(next) => {
            if (next === 'location') {
              onChange({ source: 'location' });
              return;
            }
            if (next === 'development') {
              onChange({ source: 'development' });
              return;
            }
            onChange({
              source: 'custom',
              customText: customDraft.trim() || undefined,
            });
          }}
        >
          <SelectTrigger id={sourceId} className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            <SelectItem value="location">Location</SelectItem>
            {developmentAvailable ? (
              <SelectItem value="development">
                Development{developmentName ? ` (${developmentName})` : ''}
              </SelectItem>
            ) : null}
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {effectiveSource === 'custom' ? (
        <div className="space-y-1.5">
          <Label htmlFor={customId}>Custom text</Label>
          <Input
            id={customId}
            value={customDraft}
            maxLength={120}
            onChange={(event) => {
              const next = event.target.value;
              setCustomDraft(next);
              onChange({
                source: 'custom',
                customText: next.trim() || undefined,
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
