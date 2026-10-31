import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  label: string;
  storedValue: string;
  orgValue: string;
  inheritsOrg: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
  onStoredChange: (value: string) => void;
  onInheritsOrgChange: (inherits: boolean) => void;
  onInteract: () => void;
};

const PLACEHOLDER_BY_LABEL: Record<string, string> = {
  Facebook: FORM_PLACEHOLDERS.facebookPage,
  Airbnb: FORM_PLACEHOLDERS.airbnbListing,
  Instagram: FORM_PLACEHOLDERS.instagramProfile,
  TikTok: FORM_PLACEHOLDERS.tiktokProfile,
};

export function SocialLinkInheritField({
  id,
  label,
  storedValue,
  orgValue,
  inheritsOrg,
  placeholder,
  disabled,
  error,
  onStoredChange,
  onInheritsOrgChange,
  onInteract,
}: Props) {
  const resolvedPlaceholder = placeholder ?? PLACEHOLDER_BY_LABEL[label] ?? 'https://';
  const displayValue = inheritsOrg ? orgValue : storedValue;

  return (
    <div className="bg-card flex flex-col gap-1 p-2 sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-3 sm:p-2.5">
      <Label htmlFor={id} className="settings-field-label">
        {label}
      </Label>

      <div className="min-w-0 space-y-1">
        <div className="flex flex-nowrap items-center gap-1.5">
          <Input
            id={id}
            type="text"
            inputMode="url"
            disabled={disabled || inheritsOrg}
            readOnly={inheritsOrg}
            value={displayValue}
            onChange={(event) => {
              onInteract();
              onStoredChange(event.target.value);
            }}
            className={cn(
              'h-8 min-h-8 min-w-0 flex-1 text-xs sm:text-sm',
              inheritsOrg && 'bg-muted/40 text-muted-foreground',
              error && 'border-destructive'
            )}
            placeholder={resolvedPlaceholder}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-readonly={inheritsOrg}
          />
          {inheritsOrg ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="settings-action"
              onClick={() => {
                onInteract();
                onInheritsOrgChange(false);
                onStoredChange(orgValue.trim());
              }}
            >
              <span className="sm:hidden">Customize</span>
              <span className="hidden sm:inline">Customize link</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="settings-action"
              onClick={() => {
                onInteract();
                onInheritsOrgChange(true);
                onStoredChange('');
              }}
            >
              <span className="sm:hidden">Use org</span>
              <span className="hidden sm:inline">Use org link</span>
            </Button>
          )}
        </div>

        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </div>
  );
}
