import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Bug, HelpCircle, Lightbulb, Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TicketAttachmentDropzone } from '@/features/dashboard/help-support/components/TicketAttachmentDropzone';
import { useSubmitSupportTicket } from '@/features/dashboard/help-support/hooks/useSupportTickets';
import {
  isSupportTicketDraftComplete,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_CATEGORY_DESCRIPTIONS,
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_SEVERITIES,
  SUPPORT_TICKET_SEVERITY_LABELS,
  supportTicketDraftSchema,
  supportTicketFormSchema,
  type SupportTicketAttachmentDraft,
  type SupportTicketCategory,
  type SupportTicketDraftValues,
} from '@/features/dashboard/help-support/lib/supportTicketSchema';

import { FieldLabel, RequiredMark } from '@/components/forms/FieldLabel';
import { useAntiSpamFields } from '@/components/security/useAntiSpamFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { captureAppEvent } from '@/lib/posthog/capture';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<SupportTicketCategory, typeof Bug> = {
  bug_report: Bug,
  feature_suggestion: Lightbulb,
  general_inquiry: HelpCircle,
  business_inquiry: Briefcase,
};

export type TicketComposeStatus = {
  canSubmit: boolean;
  submitting: boolean;
  uploading: boolean;
  dirty: boolean;
};

type Props = {
  onSubmitted: (ticketId: string) => void;
  formId?: string;
  hideSubmit?: boolean;
  onStatusChange?: (status: TicketComposeStatus) => void;
  defaultSubject?: string;
  defaultCategory?: SupportTicketCategory;
};

export function TicketComposeForm({
  onSubmitted,
  formId,
  hideSubmit = false,
  onStatusChange,
  defaultSubject,
  defaultCategory,
}: Props) {
  const submitTicket = useSubmitSupportTicket();
  const antiSpam = useAntiSpamFields();
  const [attachments, setAttachments] = useState<SupportTicketAttachmentDraft[]>([]);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, touchedFields, isSubmitted, isDirty },
  } = useForm<SupportTicketDraftValues>({
    resolver: zodResolver(supportTicketDraftSchema),
    mode: 'onTouched',
    defaultValues: {
      category: defaultCategory ?? 'bug_report',
      subject: defaultSubject?.trim() ?? '',
      description: '',
      severity: 'medium',
      contactPreference: '',
    },
  });

  useEffect(() => {
    if (!defaultSubject?.trim()) return;
    setValue('subject', defaultSubject.trim());
    if (defaultCategory) setValue('category', defaultCategory);
  }, [defaultCategory, defaultSubject, setValue]);

  const category = watch('category');
  const subject = watch('subject');
  const description = watch('description');
  const contactPreference = watch('contactPreference');
  const canSubmit = isSupportTicketDraftComplete({
    subject,
    description,
    category,
    contactPreference,
  });
  const submitting = submitTicket.isPending;
  const uploading = attachmentsBusy;
  const dirty = isDirty || attachments.length > 0;

  useEffect(() => {
    onStatusChange?.({ canSubmit, submitting, uploading, dirty });
  }, [canSubmit, dirty, onStatusChange, submitting, uploading]);

  const pageUrl = useMemo(() => (typeof window === 'undefined' ? '' : window.location.href), []);
  const browserInfo = useMemo(
    () => (typeof navigator === 'undefined' ? '' : navigator.userAgent),
    []
  );

  const subjectError =
    errors.subject && (touchedFields.subject || isSubmitted) ? errors.subject.message : undefined;
  const descriptionError =
    errors.description && (touchedFields.description || isSubmitted)
      ? errors.description.message
      : undefined;
  const contactError =
    errors.contactPreference && (touchedFields.contactPreference || isSubmitted)
      ? errors.contactPreference.message
      : undefined;

  const onSubmit = async (values: SupportTicketDraftValues) => {
    const payload =
      values.category === 'bug_report'
        ? {
            category: values.category,
            subject: values.subject,
            description: values.description,
            pageUrl,
            browserInfo,
            severity: values.severity,
            attachments,
          }
        : values.category === 'business_inquiry'
          ? {
              category: values.category,
              subject: values.subject,
              description: values.description,
              contactPreference: values.contactPreference.trim(),
            }
          : {
              category: values.category,
              subject: values.subject,
              description: values.description,
            };

    const parsed = supportTicketFormSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Please check the form and try again');
      return;
    }

    try {
      const result = await submitTicket.mutateAsync({
        category: parsed.data.category,
        subject: parsed.data.subject,
        description: parsed.data.description,
        pageUrl: 'pageUrl' in parsed.data ? parsed.data.pageUrl : undefined,
        browserInfo: 'browserInfo' in parsed.data ? parsed.data.browserInfo : undefined,
        severity: 'severity' in parsed.data ? parsed.data.severity : undefined,
        contactPreference:
          'contactPreference' in parsed.data ? parsed.data.contactPreference : undefined,
        attachments: 'attachments' in parsed.data ? parsed.data.attachments : undefined,
        antiSpam: antiSpam.getFields(),
      });
      captureAppEvent('support_ticket_submitted', {
        category: parsed.data.category,
        severity: 'severity' in parsed.data ? parsed.data.severity : 'not_applicable',
        attachment_count: 'attachments' in parsed.data ? parsed.data.attachments.length : 0,
      });
      toast.success('Submitted');
      onSubmitted(result.ticket.id);
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not submit'));
    }
  };

  const selectCategory = (next: SupportTicketCategory) => {
    setValue('category', next, { shouldValidate: true });
    if (next !== 'business_inquiry') {
      setValue('contactPreference', '');
    }
    if (next !== 'bug_report') {
      setAttachments([]);
    }
  };

  const subjectField = (
    <TicketField htmlFor="ticket-subject" label="Subject" required error={subjectError}>
      <Input
        id="ticket-subject"
        className="h-11"
        maxLength={200}
        {...register('subject')}
        error={Boolean(subjectError)}
        aria-invalid={Boolean(subjectError)}
        aria-describedby={subjectError ? 'ticket-subject-error' : undefined}
        aria-required
      />
    </TicketField>
  );

  return (
    <form
      id={formId}
      className="space-y-5"
      onSubmit={handleSubmit((values) => void onSubmit(values))}
      noValidate
    >
      {antiSpam.field}
      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">
          What is this about?
          <RequiredMark />
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUPPORT_TICKET_CATEGORIES.map((value) => {
            const Icon = CATEGORY_ICONS[value];
            const selected = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectCategory(value)}
                aria-pressed={selected}
                className={cn(
                  'flex min-h-11 items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/40'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                    selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </div>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-semibold">
                    {SUPPORT_TICKET_CATEGORY_LABELS[value]}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                    {SUPPORT_TICKET_CATEGORY_DESCRIPTIONS[value]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {category === 'bug_report' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)]">
          {subjectField}
          <TicketField htmlFor="ticket-severity" label="How urgent?" required>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ticket-severity" className="h-11 w-full" aria-required>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_TICKET_SEVERITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SUPPORT_TICKET_SEVERITY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </TicketField>
        </div>
      ) : category === 'business_inquiry' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {subjectField}
          <TicketField
            htmlFor="ticket-contact-preference"
            label="How should we reach you?"
            required
            error={contactError}
          >
            <Input
              id="ticket-contact-preference"
              className="h-11"
              maxLength={200}
              placeholder="Email or phone"
              {...register('contactPreference')}
              error={Boolean(contactError)}
              aria-invalid={Boolean(contactError)}
              aria-describedby={contactError ? 'ticket-contact-preference-error' : undefined}
              aria-required
            />
          </TicketField>
        </div>
      ) : (
        subjectField
      )}

      <TicketField htmlFor="ticket-description" label="Details" required error={descriptionError}>
        <Textarea
          id="ticket-description"
          rows={5}
          maxLength={5000}
          {...register('description')}
          aria-invalid={Boolean(descriptionError)}
          aria-describedby={descriptionError ? 'ticket-description-error' : undefined}
          aria-required
          className={cn(descriptionError && 'border-destructive/50')}
        />
      </TicketField>

      {category === 'bug_report' ? (
        <TicketAttachmentDropzone
          value={attachments}
          onChange={setAttachments}
          disabled={submitTicket.isPending}
          onBusyChange={setAttachmentsBusy}
        />
      ) : null}

      {hideSubmit ? null : (
        <Button
          type="submit"
          disabled={!canSubmit || submitting || uploading}
          className="min-h-11 w-full sm:w-auto"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Submit
        </Button>
      )}
    </form>
  );
}

function TicketField({
  htmlFor,
  label,
  required,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <FieldLabel htmlFor={htmlFor} label={label} required={required} />
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-destructive text-xs leading-snug">
          {error}
        </p>
      ) : null}
    </div>
  );
}
