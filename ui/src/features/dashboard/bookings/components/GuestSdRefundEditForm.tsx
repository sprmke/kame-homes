/**
 * Editable guest SD refund submission — Progress rail (and formerly edit Workflow).
 * Mirrors guest `/sd-form` fields.
 */

import { useEffect, useMemo, useState } from 'react';

import { SD_BANKS, refundBodySchema, type SdBank } from '@/features/guest/sd-form/lib/sdFormSchema';

import { Field, Input, Row2 } from '@/features/dashboard/bookings/components/BookingEditLayout';
import {
  WorkflowFormShell,
  type WorkflowFormVariant,
} from '@/features/dashboard/bookings/components/WorkflowFormShell';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { cn } from '@/lib/utils';
import { toCapitalCase } from '@/utils/text/formatters';
import { handleNameInputChange } from '@/utils/text/helpers';

export type GuestSdRefundEditValues = {
  method: 'same_phone' | 'other_bank' | 'cash';
  bank: SdBank;
  accountName: string;
  accountNumber: string;
};

type Props = {
  booking: BookingRow;
  onChange: (values: GuestSdRefundEditValues | null) => void;
  editMode?: boolean;
  variant?: WorkflowFormVariant;
};

function defaultValuesFromBooking(booking: BookingRow): GuestSdRefundEditValues {
  return {
    method: booking.sd_refund_method ?? 'same_phone',
    bank:
      booking.sd_refund_bank && SD_BANKS.includes(booking.sd_refund_bank)
        ? booking.sd_refund_bank
        : SD_BANKS[0],
    accountName: booking.sd_refund_account_name?.trim() ?? '',
    accountNumber: booking.sd_refund_account_number?.trim() ?? '',
  };
}

const METHOD_OPTIONS: Array<{
  value: GuestSdRefundEditValues['method'];
  label: string;
}> = [
  {
    value: 'same_phone',
    label: 'GCash (same phone number from guest form)',
  },
  {
    value: 'other_bank',
    label: 'Another GCash or bank account',
  },
  {
    value: 'cash',
    label: 'Cash pickup',
  },
];

export function GuestSdRefundEditForm({
  booking,
  onChange,
  editMode = true,
  variant = 'workflow',
}: Props) {
  const [values, setValues] = useState<GuestSdRefundEditValues>(() =>
    defaultValuesFromBooking(booking)
  );
  const [touched, setTouched] = useState({
    bank: false,
    accountName: false,
    accountNumber: false,
  });

  useEffect(() => {
    setValues(defaultValuesFromBooking(booking));
    setTouched({ bank: false, accountName: false, accountNumber: false });
  }, [booking.id]);

  const validation = useMemo(() => {
    const payload =
      values.method === 'same_phone'
        ? ({ method: 'same_phone' } as const)
        : values.method === 'cash'
          ? ({ method: 'cash' } as const)
          : ({
              method: 'other_bank' as const,
              bank: values.bank,
              accountName: values.accountName,
              accountNumber: values.accountNumber,
            } as const);
    const r = refundBodySchema.safeParse(payload);
    if (r.success) return { valid: true, errors: {} as Record<string, string> };
    const errors: Record<string, string> = {};
    for (const iss of r.error.issues) {
      const k = iss.path[0];
      if (typeof k === 'string' && !errors[k]) errors[k] = iss.message;
    }
    return { valid: false, errors };
  }, [values]);

  useEffect(() => {
    if (editMode || validation.valid) {
      onChange(values);
    } else {
      onChange(null);
    }
  }, [values, validation.valid, editMode, onChange]);

  const phoneDisplay = booking.guest_phone_number?.trim() || '-';
  const submittedLabel = booking.sd_refund_form_submitted_at
    ? new Date(booking.sd_refund_form_submitted_at).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
      })
    : null;

  function patch(next: Partial<GuestSdRefundEditValues>) {
    setValues((prev) => ({ ...prev, ...next }));
  }

  function showError(field: keyof typeof touched) {
    return values.method === 'other_bank' && touched[field] && Boolean(validation.errors[field]);
  }

  const selectErrorClass = (field: keyof typeof touched) =>
    showError(field) ? 'border-red-400 ring-1 ring-red-400/30' : undefined;

  return (
    <WorkflowFormShell
      title="SD Refund Form"
      variant={variant}
      bodyClassName="space-y-4"
      advanceMode="manual"
    >
      <Field label="Refund method" required>
        <Select
          value={values.method}
          onValueChange={(v) => {
            const method = v as GuestSdRefundEditValues['method'];
            patch({ method });
            if (method !== 'other_bank') {
              setTouched({
                bank: false,
                accountName: false,
                accountNumber: false,
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {values.method === 'same_phone' ? (
        <Field label="Phone number">
          <Input readOnly value={phoneDisplay} className="bg-muted/50" />
        </Field>
      ) : null}

      {values.method === 'other_bank' ? (
        <>
          <Row2>
            <Field label="Bank / channel" required>
              <Select
                value={values.bank}
                onValueChange={(v) => {
                  setTouched((prev) => ({ ...prev, bank: true }));
                  patch({ bank: v as SdBank });
                }}
              >
                <SelectTrigger className={selectErrorClass('bank')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SD_BANKS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showError('bank') ? (
                <p className="text-[11px] text-red-600">{validation.errors.bank}</p>
              ) : null}
            </Field>
            <Field label="Account name" required>
              <Input
                value={values.accountName}
                placeholder={FORM_PLACEHOLDERS.fullName}
                autoComplete="name"
                onChange={(e) => {
                  setTouched((prev) => ({ ...prev, accountName: true }));
                  handleNameInputChange(e, (v) => patch({ accountName: v }), toCapitalCase);
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, accountName: true }))}
                className={cn(showError('accountName') && 'border-red-400 ring-1 ring-red-400/30')}
              />
              {showError('accountName') ? (
                <p className="text-[11px] text-red-600">{validation.errors.accountName}</p>
              ) : null}
            </Field>
          </Row2>
          <Field label="Account number" required>
            <Input
              value={values.accountNumber}
              placeholder="Digits only"
              inputMode="numeric"
              autoComplete="off"
              onChange={(e) => {
                setTouched((prev) => ({ ...prev, accountNumber: true }));
                patch({
                  accountNumber: e.target.value.replace(/\s+/g, ''),
                });
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, accountNumber: true }))}
              className={cn(showError('accountNumber') && 'border-red-400 ring-1 ring-red-400/30')}
            />
            {showError('accountNumber') ? (
              <p className="text-[11px] text-red-600">{validation.errors.accountNumber}</p>
            ) : null}
          </Field>
        </>
      ) : null}

      {submittedLabel ? (
        <p className="text-muted-foreground text-xs">
          Guest submitted: <span className="text-foreground font-medium">{submittedLabel}</span>
        </p>
      ) : null}
    </WorkflowFormShell>
  );
}

export function guestSdRefundPayloadFromValues(
  values: GuestSdRefundEditValues
): Pick<
  import('@/features/dashboard/bookings/hooks/useUpdateBooking').UpdateBookingPayload,
  | 'sd_refund_method'
  | 'sd_refund_phone_confirmed'
  | 'sd_refund_bank'
  | 'sd_refund_account_name'
  | 'sd_refund_account_number'
> {
  return {
    sd_refund_method: values.method,
    sd_refund_phone_confirmed: values.method === 'same_phone' ? true : null,
    sd_refund_bank: values.method === 'other_bank' ? values.bank : null,
    sd_refund_account_name:
      values.method === 'other_bank' ? values.accountName.trim() || null : null,
    sd_refund_account_number:
      values.method === 'other_bank' ? values.accountNumber.replace(/\s+/g, '') || null : null,
  };
}
