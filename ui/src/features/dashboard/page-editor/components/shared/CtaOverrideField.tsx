import { useEffect, useState } from 'react';

import {
  CTA_TARGET_CALENDAR,
  CTA_TARGET_CUSTOM_DRAFT,
  CTA_TARGET_FORM,
} from '@/features/guest/marketing/showcase/lib/showcaseSectionLayout';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TargetMode = 'form' | 'calendar' | 'custom';

function parseTargetMode(ctaTarget: string | undefined): TargetMode {
  const t = ctaTarget?.trim();
  if (!t || t === CTA_TARGET_FORM) return 'form';
  if (t === CTA_TARGET_CALENDAR) return 'calendar';
  if (t === CTA_TARGET_CUSTOM_DRAFT) return 'custom';
  return 'custom';
}

function targetFromMode(mode: TargetMode, customUrl: string): string {
  if (mode === 'form') return CTA_TARGET_FORM;
  if (mode === 'calendar') return CTA_TARGET_CALENDAR;
  const url = customUrl.trim();
  return url || CTA_TARGET_CUSTOM_DRAFT;
}

type Props = {
  ctaLabel?: string;
  ctaTarget?: string;
  onChange: (ctaLabel?: string, ctaTarget?: string) => void;
  idPrefix?: string;
};

export function CtaOverrideField({
  ctaLabel,
  ctaTarget,
  onChange,
  idPrefix = 'showcase-cta',
}: Props) {
  const modeFromProps = parseTargetMode(ctaTarget);
  const [mode, setMode] = useState<TargetMode>(modeFromProps);
  const [customUrl, setCustomUrl] = useState(() =>
    modeFromProps === 'custom' && ctaTarget?.trim() && ctaTarget.trim() !== CTA_TARGET_CUSTOM_DRAFT
      ? ctaTarget.trim()
      : ''
  );
  const [labelDraft, setLabelDraft] = useState(ctaLabel ?? '');

  useEffect(() => {
    setMode(parseTargetMode(ctaTarget));
    if (
      ctaTarget?.trim() &&
      ctaTarget.trim() !== CTA_TARGET_FORM &&
      ctaTarget.trim() !== CTA_TARGET_CALENDAR &&
      ctaTarget.trim() !== CTA_TARGET_CUSTOM_DRAFT
    ) {
      setCustomUrl(ctaTarget.trim());
    }
  }, [ctaTarget]);

  useEffect(() => {
    setLabelDraft(ctaLabel ?? '');
  }, [ctaLabel]);

  const labelId = `${idPrefix}-label`;
  const targetId = `${idPrefix}-target`;
  const urlId = `${idPrefix}-custom-url`;

  return (
    <div className="border-border space-y-3 border-t pt-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        Primary button
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={labelId}>Button label</Label>
        <Input
          id={labelId}
          value={labelDraft}
          maxLength={60}
          placeholder="Request stay"
          onChange={(event) => {
            const next = event.target.value;
            setLabelDraft(next);
            onChange(next, targetFromMode(mode, customUrl));
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={targetId}>Link to</Label>
        <Select
          value={mode}
          onValueChange={(value) => {
            const nextMode = value as TargetMode;
            setMode(nextMode);
            onChange(labelDraft, targetFromMode(nextMode, customUrl));
          }}
        >
          <SelectTrigger id={targetId} className="min-h-11">
            <SelectValue placeholder="Choose link" />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            <SelectItem value="form">Booking form</SelectItem>
            <SelectItem value="calendar">Calendar</SelectItem>
            <SelectItem value="custom">Custom URL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'custom' ? (
        <div className="space-y-1.5">
          <Label htmlFor={urlId}>Custom URL</Label>
          <Input
            id={urlId}
            value={customUrl}
            placeholder="/properties/slug or https://…"
            onChange={(event) => {
              const next = event.target.value;
              setCustomUrl(next);
              onChange(labelDraft, targetFromMode('custom', next));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
