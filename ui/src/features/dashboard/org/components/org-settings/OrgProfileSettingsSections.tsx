import { Info, Share2 } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { storedOrgSettingsMediaUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import {
  OrgSettingsField,
  OrgSettingsFieldGrid,
  OrgSettingsFieldSpan,
} from '@/features/dashboard/org/components/org-settings/OrgSettingsFields';
import { OrgSettingsImageField } from '@/features/dashboard/org/components/org-settings/OrgSettingsImageField';
import { BrandColorField } from '@/features/dashboard/org/components/settings/BrandColorField';
import { type OrgSettingsFieldSource } from '@/features/dashboard/org/hooks/useOrgSettings';
import type { OrgSettingsDraft } from '@/features/dashboard/org/lib/orgSettingsForm';
import {
  ORG_DESCRIPTION_MAX_LENGTH,
  ORG_TAGLINE_MAX_LENGTH,
} from '@/features/dashboard/org/lib/orgSettingsValidation';
import { absoluteGuestPath, guestHostPath } from '@/features/dashboard/org/lib/guestPublicPaths';

import { AvailabilityCheckInput } from '@/components/AvailabilityCheckInput';
import { ReadonlySlugField } from '@/components/forms/ReadonlySlugField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AvailabilityCheckState } from '@/lib/availabilityCheckState';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { DEFAULT_ORG_BRAND_COLOR } from '@/lib/theme/brandColor';
import { cn } from '@/lib/utils';

export function OrgBasicInformationSection({
  draft,
  disabled,
  slugPreview,
  logoSource,
  logoUrl,
  nameUnavailable,
  nameConflictMessage,
  nameAvailabilityState = 'idle',
  resolveFieldError,
  markFieldInteracted,
  onChange,
}: {
  draft: OrgSettingsDraft;
  disabled?: boolean;
  slugPreview: string;
  logoSource?: OrgSettingsFieldSource;
  logoUrl: string;
  nameUnavailable?: boolean;
  nameConflictMessage?: string | null;
  nameAvailabilityState?: AvailabilityCheckState;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: <K extends keyof OrgSettingsDraft>(key: K, value: OrgSettingsDraft[K]) => void;
}) {
  const fieldError = resolveFieldError;
  const nameError = fieldError('org-name');
  const taglineError = fieldError('org-tagline');
  const descriptionError = fieldError('org-description');
  const brandColorError = fieldError('org-brand-color');

  const setBrandColor = (value: string) => {
    markFieldInteracted('org-brand-color');
    onChange('brandColor', value);
  };

  return (
    <AdminSection
      id="basic"
      title="Basic Information"
      icon={Info}
      description="Update your organization's fundamental details."
    >
      <OrgSettingsFieldGrid>
        <OrgSettingsFieldSpan>
          <OrgSettingsImageField
            id="org-logo"
            label="Organization logo"
            help="This logo will appear on guest forms, emails, and invoices."
            source={logoSource}
            disabled={disabled}
            imageUrl={storedOrgSettingsMediaUrl(logoUrl, logoSource)}
            fallbackName={draft.name}
            previewAlt="Organization logo preview"
            uploadLabel="Upload logo"
            replaceLabel="Replace logo"
            required
            error={fieldError('org-logo')}
            onInteract={() => markFieldInteracted('org-logo')}
          />
        </OrgSettingsFieldSpan>

        <OrgSettingsFieldSpan>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5">
            <OrgSettingsField
              id="org-name"
              label="Organization name"
              required
              help="This is the name displayed to your team and in reports."
            >
              <AvailabilityCheckInput
                id="org-name"
                value={draft.name}
                onChange={(event) => {
                  markFieldInteracted('org-name');
                  onChange('name', event.target.value);
                }}
                disabled={disabled}
                required
                placeholder="Enter organization name"
                className={cn('h-10', (nameUnavailable || nameError) && 'border-destructive')}
                maxLength={120}
                aria-invalid={Boolean(nameUnavailable || nameError)}
                checkState={nameAvailabilityState}
              />
              {nameError ? (
                <p className="text-destructive text-xs">{nameError}</p>
              ) : nameUnavailable ? (
                <p className="text-destructive text-xs">
                  {nameConflictMessage ?? 'An organization with this name already exists.'}
                </p>
              ) : null}
            </OrgSettingsField>

            <OrgSettingsField id="org-slug" label="URL slug">
              <ReadonlySlugField
                id="org-slug"
                value={slugPreview}
                copyUrl={absoluteGuestPath(guestHostPath(slugPreview))}
                disabled={disabled}
              />
            </OrgSettingsField>
          </div>
        </OrgSettingsFieldSpan>

        <OrgSettingsFieldSpan>
          <BrandColorField
            id="org-brand-color"
            layout="org"
            value={draft.brandColor}
            resolvedColor={DEFAULT_ORG_BRAND_COLOR}
            disabled={disabled}
            error={brandColorError}
            help="Tints org dashboard pages (org dashboard, org settings, org properties)."
            onChange={setBrandColor}
          />
        </OrgSettingsFieldSpan>

        <OrgSettingsFieldSpan>
          <OrgSettingsField id="org-tagline" label="Tagline" error={taglineError}>
            <Input
              id="org-tagline"
              value={draft.tagline}
              onChange={(event) => {
                markFieldInteracted('org-tagline');
                onChange('tagline', event.target.value);
              }}
              disabled={disabled}
              placeholder="A short tagline for your organization"
              className={cn('h-10', taglineError && 'border-destructive')}
              maxLength={ORG_TAGLINE_MAX_LENGTH}
              aria-invalid={Boolean(taglineError)}
            />
            {!taglineError ? (
              <p className="text-muted-foreground text-xs">
                {draft.tagline.length}/{ORG_TAGLINE_MAX_LENGTH} characters
              </p>
            ) : null}
          </OrgSettingsField>
        </OrgSettingsFieldSpan>

        <OrgSettingsFieldSpan>
          <OrgSettingsField id="org-description" label="Description" error={descriptionError}>
            <Textarea
              id="org-description"
              value={draft.description}
              onChange={(event) => {
                markFieldInteracted('org-description');
                onChange('description', event.target.value);
              }}
              disabled={disabled}
              placeholder="Brief description of your organization"
              rows={8}
              maxLength={ORG_DESCRIPTION_MAX_LENGTH}
              aria-invalid={Boolean(descriptionError)}
              className={cn(descriptionError && 'border-destructive')}
            />
            {!descriptionError ? (
              <p className="text-muted-foreground text-xs">
                {draft.description.length}/{ORG_DESCRIPTION_MAX_LENGTH} characters
              </p>
            ) : null}
          </OrgSettingsField>
        </OrgSettingsFieldSpan>
      </OrgSettingsFieldGrid>
    </AdminSection>
  );
}

const SOCIAL_LINK_FIELDS = [
  {
    id: 'facebook-page-url',
    key: 'facebookPageUrl' as const,
    label: 'Facebook',
    placeholder: FORM_PLACEHOLDERS.facebookPage,
  },
  {
    id: 'airbnb-url',
    key: 'airbnbUrl' as const,
    label: 'Airbnb',
    placeholder: FORM_PLACEHOLDERS.airbnbListing,
  },
  {
    id: 'instagram-url',
    key: 'instagramUrl' as const,
    label: 'Instagram',
    placeholder: FORM_PLACEHOLDERS.instagramProfile,
  },
  {
    id: 'tiktok-url',
    key: 'tiktokUrl' as const,
    label: 'TikTok',
    placeholder: FORM_PLACEHOLDERS.tiktokProfile,
  },
] as const;

export function OrgSocialsSection({
  operatorDraft,
  disabled,
  resolveFieldError,
  markFieldInteracted,
  onOperatorChange,
}: {
  operatorDraft: {
    facebookPageUrl: string;
    airbnbUrl: string;
    instagramUrl: string;
    tiktokUrl: string;
  };
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onOperatorChange: (
    key: 'facebookPageUrl' | 'airbnbUrl' | 'instagramUrl' | 'tiktokUrl',
    value: string
  ) => void;
}) {
  const fieldError = resolveFieldError;

  return (
    <AdminSection id="branding" title="Socials" icon={Share2}>
      <p className="text-muted-foreground -mt-2 text-xs">
        Properties inherit these when not customized.
      </p>
      <div className="space-y-4">
        <OrgSettingsFieldGrid>
          <OrgSettingsFieldSpan>
            <div className="border-border/60 divide-border/50 divide-y overflow-hidden rounded-xl border">
              {SOCIAL_LINK_FIELDS.map((field) => {
                const socialError = fieldError(field.id);
                return (
                  <div
                    key={field.id}
                    className="bg-card flex flex-col gap-1 p-2 sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3 sm:p-2.5"
                  >
                    <Label htmlFor={field.id} className="settings-field-label">
                      {field.label}
                    </Label>
                    <div className="min-w-0 space-y-1">
                      <Input
                        id={field.id}
                        type="text"
                        inputMode="url"
                        disabled={disabled}
                        value={operatorDraft[field.key]}
                        onChange={(event) => {
                          markFieldInteracted(field.id);
                          onOperatorChange(field.key, event.target.value);
                        }}
                        className={cn(
                          'h-8 min-h-8 min-w-0 text-xs sm:text-sm',
                          socialError && 'border-destructive'
                        )}
                        placeholder={field.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={Boolean(socialError)}
                      />
                      {socialError ? (
                        <p className="text-destructive text-xs">{socialError}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </OrgSettingsFieldSpan>
        </OrgSettingsFieldGrid>
      </div>
    </AdminSection>
  );
}

/** @deprecated Use OrgSocialsSection */
export const OrgSocialsBrandingSection = OrgSocialsSection;
