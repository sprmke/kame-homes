import { useMemo, useState } from 'react';

import { CheckCircle2 } from 'lucide-react';

import type {
  ChatBlock,
  DynamicFormField,
} from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  dynamicFormValueDisplay,
  humanizeAssistantConfirmationCopy,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';
import {
  isDynamicFormValid,
  validateDynamicFormValues,
} from '@/features/dashboard/ai-assistant/lib/dynamicFormValidation';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DynamicForm = Extract<ChatBlock, { type: 'dynamic_form' }>;

type Props = DynamicForm & {
  onSubmit?: (block: DynamicForm, values: Record<string, string>) => void;
  disabled?: boolean;
};

function inputTypeFor(fieldType: DynamicFormField['fieldType']): string {
  switch (fieldType) {
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'tel':
      return 'tel';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

/** Required-field marker matching the guest/admin form convention (`text-destructive` asterisk). */
function RequiredMark() {
  return (
    <>
      {' '}
      <span className="text-destructive" aria-hidden>
        *
      </span>
    </>
  );
}

function FieldControl({
  field,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  field: DynamicFormField;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onBlur: () => void;
}) {
  const inputId = `dynform-${field.key}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const hasError = Boolean(error);

  if (field.fieldType === 'checkbox') {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <Checkbox
            id={inputId}
            checked={value === 'true'}
            onCheckedChange={(checked) => {
              onChange(checked ? 'true' : 'false');
              onBlur();
            }}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={errorId}
          />
          <Label htmlFor={inputId} className="text-sm font-normal leading-tight">
            {field.label}
            {field.required ? <RequiredMark /> : null}
          </Label>
        </div>
        {error ? (
          <p id={errorId} className="text-destructive pl-6 text-xs font-medium">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs">
        {field.label}
        {field.required ? <RequiredMark /> : null}
      </Label>

      {field.fieldType === 'textarea' ? (
        <Textarea
          id={inputId}
          value={value}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={errorId}
          className={cn(hasError && 'border-destructive/50 bg-destructive/5')}
        />
      ) : field.fieldType === 'select' ? (
        <Select
          value={value || undefined}
          onValueChange={(next) => {
            onChange(next);
            onBlur();
          }}
          disabled={disabled}
        >
          <SelectTrigger
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={errorId}
            className={cn(hasError && 'border-destructive')}
          >
            <SelectValue placeholder={field.placeholder || 'Select…'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.fieldType === 'radio' ? (
        <RadioGroup
          value={value}
          onValueChange={(next) => {
            onChange(next);
            onBlur();
          }}
          disabled={disabled}
          className="gap-2 pt-1"
        >
          {(field.options ?? []).map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`${inputId}-${opt.value}`} />
              <Label htmlFor={`${inputId}-${opt.value}`} className="text-sm font-normal">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : (
        <Input
          id={inputId}
          type={inputTypeFor(field.fieldType)}
          value={value}
          placeholder={field.placeholder}
          maxLength={field.fieldType === 'text' ? field.maxLength : undefined}
          min={field.fieldType === 'number' ? field.min : undefined}
          max={field.fieldType === 'number' ? field.max : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          error={hasError}
          aria-invalid={hasError}
          aria-describedby={errorId}
        />
      )}

      {error ? (
        <p id={errorId} className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** In-chat form for multi-field host input — replaces asking for each field one at a time in text. */
export function DynamicFormBlock({ onSubmit, disabled, ...block }: Props) {
  const { fields, title, description, submitLabel, status, values: submittedValues } = block;
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const fieldErrors = useMemo(() => validateDynamicFormValues(fields, values), [fields, values]);
  const isFormValid = useMemo(() => isDynamicFormValid(fields, values), [fields, values]);

  if (status === 'submitted') {
    const display = submittedValues ?? values;
    return (
      <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-foreground text-sm font-medium">
            {title ? humanizeAssistantConfirmationCopy(title) : 'Submitted'}
          </p>
        </div>
        <dl className="space-y-0.5 pl-6">
          {fields.map((field) => {
            const shown = dynamicFormValueDisplay(field, display[field.key]);
            if (!shown) return null;
            return (
              <div key={field.key} className="flex gap-2 text-xs">
                <dt className="text-muted-foreground">{field.label}:</dt>
                <dd className="text-foreground">{shown}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  }

  const setValue = (key: string, next: string) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const markTouched = (key: string) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const handleSubmit = () => {
    if (!isFormValid) {
      setTouched(Object.fromEntries(fields.map((field) => [field.key, true])));
      return;
    }
    onSubmit?.(block, values);
  };

  return (
    <div className="border-border/60 bg-card space-y-3 rounded-xl border p-3">
      {title ? (
        <p className="text-foreground text-sm font-medium">
          {humanizeAssistantConfirmationCopy(title)}
        </p>
      ) : null}
      {description ? (
        <p className="text-muted-foreground text-xs">
          {humanizeAssistantConfirmationCopy(description)}
        </p>
      ) : null}

      <div className="space-y-3">
        {fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={values[field.key] ?? ''}
            error={touched[field.key] ? fieldErrors[field.key] : undefined}
            disabled={disabled}
            onChange={(next) => setValue(field.key, next)}
            onBlur={() => markTouched(field.key)}
          />
        ))}
      </div>

      <Button type="button" size="sm" onClick={handleSubmit} disabled={disabled || !isFormValid}>
        {submitLabel?.trim() || 'Submit'}
      </Button>
    </div>
  );
}
