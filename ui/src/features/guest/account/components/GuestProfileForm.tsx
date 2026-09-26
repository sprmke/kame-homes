import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Camera, Loader2, MapPin, Phone } from 'lucide-react';

import {
  useGuestProfile,
  useGuestProfileMutations,
} from '@/features/guest/account/hooks/useGuestProfile';
import {
  guestInitials,
  resolveGuestAvatarUrl,
  resolveGuestDisplayName,
} from '@/features/guest/account/lib/guestAccountIdentity';
import {
  guestProfilePhoneError,
  isGuestProfileDraftValid,
} from '@/features/guest/account/lib/guestProfileValidation';
import { useGuestSession } from '@/features/guest/auth/hooks/useGuestSession';

import { GuestProfileFormSkeleton } from '@/components/skeletons/GuestAccountSkeletons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { LocationSearchInput } from '@/lib/google-maps/LocationSearchInput';
import { cn } from '@/lib/utils';
import { normalizePhoneDigits } from '@/lib/validation/fieldValidation';

const BIO_MAX = 500;

interface ProfileDraft {
  displayName: string;
  bio: string;
  phone: string;
  locationLabel: string;
}

function draftFromProfile(
  session: ReturnType<typeof useGuestSession>['session'],
  profile: ReturnType<typeof useGuestProfile>['data']
): ProfileDraft {
  return {
    displayName: profile?.displayName ?? resolveGuestDisplayName(session, profile),
    bio: profile?.bio ?? '',
    phone: profile?.phone ?? '',
    locationLabel: profile?.locationLabel ?? '',
  };
}

function draftsEqual(a: ProfileDraft, b: ProfileDraft): boolean {
  return (
    a.displayName.trim() === b.displayName.trim() &&
    a.bio.trim() === b.bio.trim() &&
    a.phone.trim() === b.phone.trim() &&
    a.locationLabel.trim() === b.locationLabel.trim()
  );
}

type GuestProfileFormProps = {
  /** Drop outer card chrome when rendered inside a modal shell. */
  embedded?: boolean;
  /** Hide inline save/cancel — modal footer owns actions. */
  hideFooter?: boolean;
  formId?: string;
  onFormStateChange?: (state: GuestProfileFormState) => void;
};

export type GuestProfileFormState = {
  isDirty: boolean;
  isValid: boolean;
  isPending: boolean;
  reset: () => void;
  save: () => void;
};

export function GuestProfileForm({
  embedded = false,
  hideFooter = false,
  formId,
  onFormStateChange,
}: GuestProfileFormProps) {
  const { session } = useGuestSession();
  const { data: profile, isLoading } = useGuestProfile();
  const { updateProfile, uploadAvatar } = useGuestProfileMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<ProfileDraft>({
    displayName: '',
    bio: '',
    phone: '',
    locationLabel: '',
  });
  const [savedDraft, setSavedDraft] = useState<ProfileDraft>(draft);

  useEffect(() => {
    if (!profile && !session) return;
    const next = draftFromProfile(session, profile);
    setDraft(next);
    setSavedDraft(next);
  }, [profile, session]);

  const avatarUrl = resolveGuestAvatarUrl(session, profile);
  const displayNamePreview = draft.displayName.trim() || 'Guest';
  const initials = guestInitials(displayNamePreview);
  const email = profile?.email ?? session?.user?.email ?? '';
  const isDirty = useMemo(() => !draftsEqual(draft, savedDraft), [draft, savedDraft]);
  const isValid = useMemo(() => isGuestProfileDraftValid(draft), [draft]);
  const phoneError = guestProfilePhoneError(draft.phone);
  const bioRemaining = BIO_MAX - draft.bio.length;

  const patchField = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSave = useCallback(() => {
    if (!isGuestProfileDraftValid(draft) || updateProfile.isPending) return;

    const normalizedPhone = draft.phone.trim() ? normalizePhoneDigits(draft.phone.trim()) : null;

    updateProfile.mutate(
      {
        displayName: draft.displayName.trim(),
        bio: draft.bio.trim() || null,
        phone: normalizedPhone,
        locationLabel: draft.locationLabel.trim() || null,
      },
      {
        onSuccess: () => {
          const trimmed: ProfileDraft = {
            displayName: draft.displayName.trim(),
            bio: draft.bio.trim(),
            phone: normalizedPhone ?? '',
            locationLabel: draft.locationLabel.trim(),
          };
          setDraft(trimmed);
          setSavedDraft(trimmed);
        },
      }
    );
  }, [draft, updateProfile]);

  const resetDraft = useCallback(() => {
    setDraft(savedDraft);
  }, [savedDraft]);

  useEffect(() => {
    if (!embedded || !onFormStateChange) return;
    onFormStateChange({
      isDirty,
      isValid,
      isPending: updateProfile.isPending,
      reset: resetDraft,
      save: handleSave,
    });
  }, [
    embedded,
    onFormStateChange,
    isDirty,
    isValid,
    updateProfile.isPending,
    resetDraft,
    handleSave,
  ]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadAvatar.mutate(file);
    event.target.value = '';
  };

  const shellClassName = cn(
    embedded
      ? 'w-full'
      : 'bg-card border-border w-full overflow-hidden rounded-2xl border shadow-sm'
  );

  const pageGridClassName =
    'grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:items-start lg:gap-10 lg:p-10';
  const modalBodyClassName = 'space-y-6';

  const avatarButton = (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn('group relative shrink-0', embedded && 'mx-auto')}
        aria-label="Change profile photo"
      >
        <Avatar
          className={cn(
            'ring-background shadow-md',
            embedded ? 'size-24 ring-4 sm:size-28' : 'size-28 ring-4 sm:size-32'
          )}
        >
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
          <AvatarFallback
            className={cn(
              'from-primary/90 to-primary bg-gradient-to-br text-white',
              embedded ? 'text-xl sm:text-2xl' : 'text-xl'
            )}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="bg-background/90 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploadAvatar.isPending ? (
            <Loader2
              className={cn('text-foreground animate-spin', embedded ? 'size-6' : 'size-5')}
              aria-hidden
            />
          ) : (
            <Camera className={cn('text-foreground', embedded ? 'size-6' : 'size-5')} aria-hidden />
          )}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleAvatarChange}
      />
    </>
  );

  const fields = (
    <div className={cn('grid grid-cols-1 gap-4', !embedded && 'gap-6')}>
      {embedded && email ? (
        <div className="space-y-2">
          <Label htmlFor="guest-email">Email</Label>
          <Input
            id="guest-email"
            value={email}
            readOnly
            tabIndex={-1}
            autoComplete="email"
            aria-readonly="true"
            className="bg-muted/50 text-muted-foreground h-10 cursor-default"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="guest-display-name">Display name</Label>
        <Input
          id="guest-display-name"
          value={draft.displayName}
          onChange={(event) => patchField('displayName', event.target.value)}
          maxLength={80}
          className="h-10"
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <Label htmlFor="guest-bio">Bio</Label>
          <span
            className={cn(
              'text-xs tabular-nums',
              bioRemaining < 40 ? 'text-destructive' : 'text-muted-foreground'
            )}
            aria-live="polite"
          >
            {bioRemaining}
          </span>
        </div>
        <Textarea
          id="guest-bio"
          value={draft.bio}
          onChange={(event) => patchField('bio', event.target.value)}
          rows={embedded ? 3 : 4}
          maxLength={BIO_MAX}
          className={cn('resize-y', embedded ? 'min-h-[88px]' : 'min-h-[120px]')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="guest-phone">Phone</Label>
        <div className="relative">
          <Phone
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id="guest-phone"
            type="tel"
            value={draft.phone}
            onChange={(event) => patchField('phone', event.target.value)}
            placeholder={FORM_PLACEHOLDERS.phone}
            className={cn('h-10 pl-10 tabular-nums', phoneError && 'border-destructive')}
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(phoneError)}
          />
        </div>
        {phoneError ? (
          <p className="text-destructive text-sm" role="alert">
            {phoneError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="guest-location">Location</Label>
        <LocationSearchInput
          id="guest-location"
          value={draft.locationLabel}
          onChange={(value) => patchField('locationLabel', value)}
          placeholder="Search location"
        />
      </div>
    </div>
  );

  const footer = hideFooter ? null : (
    <div
      className={cn(
        'border-border flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end lg:pt-8',
        isDirty && 'lg:justify-between'
      )}
    >
      {isDirty ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] sm:mr-auto"
          onClick={resetDraft}
          disabled={updateProfile.isPending}
        >
          Cancel
        </Button>
      ) : (
        <span className="hidden sm:block" aria-hidden />
      )}
      <Button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || !isValid || updateProfile.isPending}
        className="min-h-[44px] min-w-[7.5rem]"
      >
        {updateProfile.isPending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className={shellClassName}>
        <GuestProfileFormSkeleton
          embedded={embedded}
          className={embedded ? modalBodyClassName : pageGridClassName}
        />
      </div>
    );
  }

  if (embedded) {
    return (
      <form
        id={formId}
        className={shellClassName}
        onSubmit={(event) => {
          event.preventDefault();
          if (isDirty && isValid && !updateProfile.isPending) handleSave();
        }}
      >
        <div className={modalBodyClassName}>
          <div className="flex justify-center px-1 pb-1 pt-2">{avatarButton}</div>
          {fields}
        </div>
      </form>
    );
  }

  return (
    <div className={shellClassName}>
      <div className={pageGridClassName}>
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 sm:items-start">{avatarButton}</div>

          <div className="min-w-0 space-y-3 text-center sm:text-left">
            <div>
              <h2 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
                {displayNamePreview}
              </h2>
              {email ? (
                <p className="text-muted-foreground mt-1 truncate text-sm">{email}</p>
              ) : null}
            </div>
            {(draft.locationLabel.trim() || draft.phone.trim() || draft.bio.trim()) && (
              <div className="text-muted-foreground space-y-1.5 text-sm">
                {draft.locationLabel.trim() ? (
                  <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{draft.locationLabel.trim()}</span>
                  </p>
                ) : null}
                {draft.phone.trim() ? (
                  <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{draft.phone.trim()}</span>
                  </p>
                ) : null}
                {draft.bio.trim() ? (
                  <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                    {draft.bio.trim()}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:space-y-8">
          {fields}
          {footer}
        </div>
      </div>
    </div>
  );
}
