import { useState } from 'react';

import { StayGuideRichContent } from '@/features/guest/stay-guide/components/StayGuideRichContent';

import {
  announcementScheduleEndFromDate,
  announcementScheduleStartFromDate,
  announcementScheduleToDate,
} from '@/features/dashboard/announcements/lib/hostAnnouncementSchedule';
import type {
  HostAnnouncementDraft,
  HostAnnouncementSeverity,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { RichTextEditor } from '@/features/dashboard/bookings/components/property-templates/RichTextEditor';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';

import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DATE_PICKER_DISPLAY_FORMAT } from '@/utils/format/dates';

type BodyEditorMode = 'edit' | 'preview';

const SEVERITY_OPTIONS: Array<{ value: HostAnnouncementSeverity; label: string }> = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

type Props = {
  value: HostAnnouncementDraft;
  disabled?: boolean;
  onChange: (patch: Partial<HostAnnouncementDraft>) => void;
};

/** Compact, single-entity CRUD form for one announcement — shared by the platform detail
 *  page and the development-scoped edit dialog. */
export function HostAnnouncementFormFields({ value, disabled = false, onChange }: Props) {
  const fieldId = (name: string) => `announcement-${name}-${value.id}`;
  const [bodyMode, setBodyMode] = useState<BodyEditorMode>('edit');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
        <SettingsField id={fieldId('title')} label="Title" required>
          <Input
            id={fieldId('title')}
            value={value.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="h-10"
            disabled={disabled}
          />
        </SettingsField>
        <SettingsField id={fieldId('severity')} label="Severity">
          <Select
            value={value.severity}
            onValueChange={(severity) =>
              onChange({ severity: severity as HostAnnouncementSeverity })
            }
            disabled={disabled}
          >
            <SelectTrigger id={fieldId('severity')} className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>

      <div className="border-border/60 bg-muted/30 flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <Label
          htmlFor={fieldId('active')}
          className="text-foreground min-w-0 flex-1 text-sm font-medium"
        >
          Active
        </Label>
        <Switch
          id={fieldId('active')}
          checked={value.active}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ active: checked })}
        />
      </div>

      <SettingsField id={fieldId('body')} label="Message" required>
        <Tabs value={bodyMode} onValueChange={(mode) => setBodyMode(mode as BodyEditorMode)}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="edit" className="mt-3">
            <RichTextEditor
              content={value.body}
              onChange={(body) => onChange({ body })}
              minHeight="160px"
              editable={!disabled}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-3">
            <div className="min-h-[160px] rounded-lg border px-4 py-3">
              {value.body.trim() ? (
                <StayGuideRichContent html={value.body} className="text-sm leading-relaxed" />
              ) : (
                <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SettingsField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsField id={fieldId('starts')} label="Starts">
          <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
            <DatePicker
              date={announcementScheduleToDate(value.startsAt)}
              rangeEnd={announcementScheduleToDate(value.endsAt)}
              placeholder={DATE_PICKER_DISPLAY_FORMAT}
              maxDate={announcementScheduleToDate(value.endsAt)}
              onSelect={(date) =>
                onChange({ startsAt: date ? announcementScheduleStartFromDate(date) : null })
              }
            />
          </fieldset>
        </SettingsField>
        <SettingsField id={fieldId('ends')} label="Ends">
          <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
            <DatePicker
              date={announcementScheduleToDate(value.endsAt)}
              rangeEnd={announcementScheduleToDate(value.startsAt)}
              placeholder={DATE_PICKER_DISPLAY_FORMAT}
              minDate={announcementScheduleToDate(value.startsAt)}
              onSelect={(date) =>
                onChange({ endsAt: date ? announcementScheduleEndFromDate(date) : null })
              }
            />
          </fieldset>
        </SettingsField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsField id={fieldId('link-url')} label="Link URL">
          <Input
            id={fieldId('link-url')}
            value={value.linkUrl ?? ''}
            onChange={(event) => onChange({ linkUrl: event.target.value.trim() || null })}
            className="h-10"
            disabled={disabled}
          />
        </SettingsField>
        <SettingsField id={fieldId('link-label')} label="Link label">
          <Input
            id={fieldId('link-label')}
            value={value.linkLabel ?? ''}
            onChange={(event) => onChange({ linkLabel: event.target.value.trim() || null })}
            className="h-10"
            disabled={disabled}
          />
        </SettingsField>
      </div>
    </div>
  );
}
