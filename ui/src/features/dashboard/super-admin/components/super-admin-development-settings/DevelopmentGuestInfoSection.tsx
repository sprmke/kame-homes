import { BookOpen, Waves } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  emptyGuestGuide,
  type DevelopmentGuestGuide,
} from '@/features/dashboard/super-admin/lib/developmentGuestInfo';
import type { DevelopmentProfileDraft } from '@/features/dashboard/super-admin/lib/developmentSettingsForm';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  draft: DevelopmentProfileDraft;
  disabled?: boolean;
  onChange: <K extends keyof DevelopmentProfileDraft>(
    key: K,
    value: DevelopmentProfileDraft[K]
  ) => void;
};

function GuestGuidesEditor({
  guides,
  disabled,
  onChange,
}: {
  guides: DevelopmentGuestGuide[];
  disabled?: boolean;
  onChange: (guides: DevelopmentGuestGuide[]) => void;
}) {
  const updateGuide = (index: number, patch: Partial<DevelopmentGuestGuide>) => {
    onChange(guides.map((guide, i) => (i === index ? { ...guide, ...patch } : guide)));
  };

  const removeGuide = (index: number) => {
    onChange(guides.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {guides.map((guide, index) => (
        <div key={guide.id} className="space-y-3 rounded-xl border p-4">
          <SettingsField id={`guide-title-${guide.id}`} label="Title">
            <Input
              id={`guide-title-${guide.id}`}
              value={guide.title}
              onChange={(event) => updateGuide(index, { title: event.target.value })}
              className="h-10"
              disabled={disabled}
            />
          </SettingsField>
          <SettingsField id={`guide-content-${guide.id}`} label="Content">
            <Textarea
              id={`guide-content-${guide.id}`}
              value={guide.content}
              onChange={(event) => updateGuide(index, { content: event.target.value })}
              rows={4}
              disabled={disabled}
            />
          </SettingsField>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={disabled}
            onClick={() => removeGuide(index)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px]"
        disabled={disabled}
        onClick={() => onChange([...guides, emptyGuestGuide()])}
      >
        Add guide
      </Button>
    </div>
  );
}

export function DevelopmentGuestInfoSection({ draft, disabled = false, onChange }: Props) {
  return (
    <>
      <AdminSection id="pool" title="Pool" icon={Waves}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField id="development-pool-fee" label="Pool fee (PHP)">
            <Input
              id="development-pool-fee"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={draft.poolFee ?? ''}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === '') {
                  onChange('poolFee', null);
                  return;
                }
                const parsed = Number(raw);
                onChange('poolFee', Number.isFinite(parsed) ? parsed : null);
              }}
              className="h-10"
              disabled={disabled}
            />
          </SettingsField>
        </div>
        <SettingsField id="development-pool-schedule" label="Pool schedule">
          <Textarea
            id="development-pool-schedule"
            value={draft.poolSchedule}
            onChange={(event) => onChange('poolSchedule', event.target.value)}
            rows={3}
            disabled={disabled}
          />
        </SettingsField>
      </AdminSection>

      <AdminSection id="guest-info" title="Guest information" icon={BookOpen}>
        <SettingsField id="development-guest-requirements" label="Requirements">
          <Textarea
            id="development-guest-requirements"
            value={draft.guestRequirements}
            onChange={(event) => onChange('guestRequirements', event.target.value)}
            rows={4}
            disabled={disabled}
          />
        </SettingsField>
        <SettingsField id="development-guest-guides" label="Guides">
          <GuestGuidesEditor
            guides={draft.guestGuides}
            disabled={disabled}
            onChange={(guides) => onChange('guestGuides', guides)}
          />
        </SettingsField>
        <SettingsField id="development-important-info" label="Other information">
          <Textarea
            id="development-important-info"
            value={draft.importantInfo}
            onChange={(event) => onChange('importantInfo', event.target.value)}
            rows={4}
            disabled={disabled}
          />
        </SettingsField>
      </AdminSection>
    </>
  );
}
