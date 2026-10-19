import * as React from 'react';

import { ImagePlus, Loader2, Plus, Star, Trash2, Upload } from 'lucide-react';

import type { AppSettingsDto } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { resolvePaymentMethodQrDisplayUrl } from '@/features/dashboard/lib/storedMediaDisplay';
import { PaymentProviderSelect } from '@/features/dashboard/org/components/property-settings/PaymentProviderSelect';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';
import {
  createEmptyPaymentMethod,
  MAX_PROPERTY_PAYMENT_METHODS,
  setPrimaryPaymentMethod,
  type PropertyPaymentMethod,
} from '@/features/dashboard/org/lib/paymentMethods';
import {
  paymentAccountNumberLabel,
  paymentAccountNumberPlaceholder,
  paymentProviderLabel,
  paymentQrAltText,
} from '@/features/dashboard/org/lib/paymentProviders';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  data: AppSettingsDto;
  methods: PropertyPaymentMethod[];
  disabled?: boolean;
  resolveFieldError: (fieldId: string) => string | null;
  markFieldInteracted: (fieldId: string) => void;
  onChange: (methods: PropertyPaymentMethod[]) => void;
  onMethodQrFile: (methodId: string, file: File) => void;
  qrUploadingMethodId?: string | null;
};

function providerInitial(provider: string): string {
  const label = paymentProviderLabel(provider);
  return label.charAt(0).toUpperCase() || 'P';
}

/** Compact rows for the settings card — provider + primary only (no account/QR). */
export function PropertyPaymentMethodsSummary({
  methods,
  onManage,
}: {
  methods: PropertyPaymentMethod[];
  onManage: () => void;
}) {
  const ordered = [...methods].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  return (
    <div className="space-y-2">
      {ordered.map((method) => (
        <div
          key={method.id}
          className={cn(
            'flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-3',
            method.isPrimary
              ? 'border-primary/30 from-primary/[0.06] via-card to-card ring-primary/15 bg-gradient-to-br shadow-sm ring-1'
              : 'border-border/60 bg-card'
          )}
        >
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
              method.isPrimary
                ? 'bg-primary-strong text-primary-foreground shadow-sm'
                : 'bg-muted text-foreground'
            )}
            aria-hidden
          >
            {providerInitial(method.provider)}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <p className="text-foreground truncate text-sm font-semibold">
              {paymentProviderLabel(method.provider)}
            </p>
            {method.isPrimary ? (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15 gap-1 border-0 text-[10px] font-bold uppercase tracking-wide">
                <Star className="size-3 fill-current" aria-hidden />
                Primary
              </Badge>
            ) : null}
          </div>
          {method.isPrimary ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="settings-action"
              onClick={onManage}
            >
              Manage
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PaymentQrUpload({
  fieldId,
  provider,
  imageUrl,
  disabled,
  busy,
  error,
  onFile,
}: {
  fieldId: string;
  provider: string;
  imageUrl: string | null;
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  onFile: (file: File) => void;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <SettingsField id={fieldId} label={`QR code · ${paymentProviderLabel(provider)}`} error={error}>
      <div className="w-fit max-w-full">
        <div className="group/qr relative mx-auto w-fit max-w-full shrink-0 sm:mx-0">
          {busy ? (
            <div className="border-border/60 bg-muted/15 flex min-h-[9.5rem] min-w-[9.5rem] flex-col items-center justify-center gap-2 rounded-xl border p-2 text-xs font-medium">
              <Loader2 className="text-primary size-5 animate-spin" aria-hidden />
              Uploading…
            </div>
          ) : hasImage ? (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
              aria-label="Replace QR code image"
              className={cn(
                'border-border/60 bg-muted/15 relative overflow-hidden rounded-xl border p-2 transition-shadow',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                !disabled && !busy && 'hover:shadow-md',
                error && 'border-destructive/50 ring-destructive/20 ring-1',
                (disabled || busy) && 'cursor-not-allowed opacity-70'
              )}
            >
              <img
                src={imageUrl!}
                alt={paymentQrAltText(provider)}
                className="block h-auto max-h-36 w-auto max-w-[9.5rem] object-contain sm:max-h-40"
              />
              <span
                className={cn(
                  'bg-background/85 text-foreground absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center text-xs font-medium opacity-0 transition-opacity group-focus-within/qr:opacity-100 group-hover/qr:opacity-100'
                )}
                aria-hidden
              >
                <Upload className="text-primary size-5" />
                Replace
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
              aria-label="Upload QR code image"
              className={cn(
                'border-border/60 bg-muted/15 text-muted-foreground flex min-h-[9.5rem] min-w-[9.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center text-xs font-medium',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                !disabled &&
                  !busy &&
                  'hover:border-primary/40 hover:bg-muted/25 hover:text-foreground cursor-pointer',
                error && 'border-destructive/50',
                (disabled || busy) && 'cursor-not-allowed opacity-70'
              )}
            >
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
                <ImagePlus className="size-4" aria-hidden />
              </span>
              Upload QR
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </div>
    </SettingsField>
  );
}

function PaymentMethodCard({
  method,
  isPrimary,
  canRemove,
  disabled,
  qrImageUrl,
  qrUploadBusy,
  qrError,
  resolveFieldError,
  onProviderChange,
  onNameChange,
  onNumberChange,
  onSetPrimary,
  onRemove,
  onQrFile,
}: {
  method: PropertyPaymentMethod;
  isPrimary: boolean;
  canRemove: boolean;
  disabled?: boolean;
  qrImageUrl: string | null;
  qrUploadBusy?: boolean;
  qrError?: string | null;
  resolveFieldError: (fieldId: string) => string | null;
  onProviderChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  onSetPrimary: () => void;
  onRemove: () => void;
  onQrFile: (file: File) => void;
}) {
  const prefix = `payment-method-${method.id}`;
  const providerErr = resolveFieldError(`${prefix}-provider`);
  const nameErr = resolveFieldError(`${prefix}-name`);
  const numberErr = resolveFieldError(`${prefix}-number`);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border transition-shadow',
        isPrimary
          ? 'border-primary/30 from-primary/[0.06] via-card to-card ring-primary/15 bg-gradient-to-br shadow-sm ring-1'
          : 'border-border/60 bg-card'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 border-b px-3 py-3 sm:px-4',
          isPrimary ? 'border-primary/15' : 'border-border/50'
        )}
      >
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
            isPrimary
              ? 'bg-primary-strong text-primary-foreground shadow-sm'
              : 'bg-muted text-foreground'
          )}
          aria-hidden
        >
          {providerInitial(method.provider)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-foreground truncate text-sm font-semibold sm:text-[15px]">
              {paymentProviderLabel(method.provider)}
            </p>
            {isPrimary ? (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15 gap-1 border-0 text-[10px] font-bold uppercase tracking-wide">
                <Star className="size-3 fill-current" aria-hidden />
                Primary
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isPrimary ? (
            <Button
              type="button"
              variant="soft"
              size="sm"
              disabled={disabled}
              className="min-h-[44px] gap-1.5 px-3"
              onClick={onSetPrimary}
            >
              <Star className="size-3.5" aria-hidden />
              Set primary
            </Button>
          ) : null}

          {canRemove ? (
            <Button
              type="button"
              variant="outline-destructive"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
              disabled={disabled}
              aria-label={`Remove ${paymentProviderLabel(method.provider)}`}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-3 py-4 sm:grid-cols-2 sm:px-4">
        <SettingsField
          id={`${prefix}-provider`}
          label="Provider"
          required
          error={providerErr}
          className="sm:col-span-2"
        >
          <PaymentProviderSelect
            id={`${prefix}-provider`}
            value={method.provider}
            disabled={disabled}
            onValueChange={onProviderChange}
          />
        </SettingsField>

        <SettingsField id={`${prefix}-name`} label="Account name" required error={nameErr}>
          <Input
            id={`${prefix}-name`}
            disabled={disabled}
            value={method.accountName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Registered account name"
            aria-invalid={Boolean(nameErr)}
            className={cn('h-10', nameErr && 'border-destructive')}
          />
        </SettingsField>

        <SettingsField
          id={`${prefix}-number`}
          label={paymentAccountNumberLabel()}
          required
          error={numberErr}
        >
          <Input
            id={`${prefix}-number`}
            disabled={disabled}
            value={method.accountNumber}
            onChange={(e) => onNumberChange(e.target.value)}
            placeholder={paymentAccountNumberPlaceholder()}
            aria-invalid={Boolean(numberErr)}
            className={cn('h-10 tabular-nums', numberErr && 'border-destructive')}
          />
        </SettingsField>
      </div>

      <div
        className={cn(
          'border-t px-3 py-4 sm:px-4',
          isPrimary ? 'border-primary/15 bg-primary/[0.03]' : 'border-border/50'
        )}
      >
        <PaymentQrUpload
          fieldId={`${prefix}-qr`}
          provider={method.provider}
          imageUrl={qrImageUrl}
          disabled={disabled}
          busy={qrUploadBusy}
          error={qrError}
          onFile={onQrFile}
        />
      </div>
    </article>
  );
}

export function PropertyPaymentMethodsSection({
  data,
  methods,
  disabled = false,
  resolveFieldError,
  markFieldInteracted,
  onChange,
  onMethodQrFile,
  qrUploadingMethodId = null,
}: Props) {
  const updateMethod = (id: string, patch: Partial<PropertyPaymentMethod>, fieldId: string) => {
    markFieldInteracted(fieldId);
    onChange(methods.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMethod = (id: string) => {
    if (methods.length <= 1) return;
    markFieldInteracted('payment-methods');
    const next = methods.filter((m) => m.id !== id);
    if (!next.some((m) => m.isPrimary) && next[0]) {
      onChange(setPrimaryPaymentMethod(next, next[0].id));
    } else {
      onChange(next);
    }
  };

  const addMethod = () => {
    if (methods.length >= MAX_PROPERTY_PAYMENT_METHODS) return;
    markFieldInteracted('payment-methods');
    onChange([...methods, createEmptyPaymentMethod(false)]);
  };

  const atMethodLimit = methods.length >= MAX_PROPERTY_PAYMENT_METHODS;

  return (
    <div className="space-y-3">
      {methods.map((method) => {
        const isPrimary = method.isPrimary;
        const qrImageUrl = resolvePaymentMethodQrDisplayUrl({
          methodQrUrl: method.qrImageUrl,
          legacyQrUrl: data.gcashQrImageUrl,
          legacyQrSource: data.fieldSources?.gcashQrImageUrl,
          useLegacyFallback: isPrimary,
        });
        return (
          <PaymentMethodCard
            key={method.id}
            method={method}
            isPrimary={isPrimary}
            canRemove={methods.length > 1}
            disabled={disabled}
            qrImageUrl={qrImageUrl}
            qrUploadBusy={qrUploadingMethodId === method.id}
            qrError={resolveFieldError(`payment-method-${method.id}-qr`)}
            resolveFieldError={resolveFieldError}
            onProviderChange={(next) =>
              updateMethod(method.id, { provider: next }, `payment-method-${method.id}-provider`)
            }
            onNameChange={(next) =>
              updateMethod(method.id, { accountName: next }, `payment-method-${method.id}-name`)
            }
            onNumberChange={(next) =>
              updateMethod(method.id, { accountNumber: next }, `payment-method-${method.id}-number`)
            }
            onSetPrimary={() => {
              markFieldInteracted('payment-methods');
              onChange(setPrimaryPaymentMethod(methods, method.id));
            }}
            onRemove={() => removeMethod(method.id)}
            onQrFile={(file) => {
              markFieldInteracted(`payment-method-${method.id}-qr`);
              onMethodQrFile(method.id, file);
            }}
          />
        );
      })}

      {!atMethodLimit ? (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="min-h-[44px] w-full gap-2 sm:w-auto"
          onClick={addMethod}
        >
          <Plus className="size-4" aria-hidden />
          Add payment method
        </Button>
      ) : null}
    </div>
  );
}
