import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import type {
  DocumentApprovalSource,
  DocumentRequirement,
  DocumentTriggerCondition,
} from '@/features/dashboard/bookings/lib/documentRequirements';
import {
  addDocumentRequirement,
  DOCUMENT_APPROVAL_SOURCE_LABELS,
  DOCUMENT_APPROVAL_SOURCES,
  DOCUMENT_PDF_TEMPLATE_LABELS,
  DOCUMENT_PDF_TEMPLATE_NONE,
  DOCUMENT_PDF_TEMPLATES,
  DOCUMENT_TRIGGER_CONDITION_LABELS,
  DOCUMENT_TRIGGER_CONDITIONS,
  isRequestPdfTemplateId,
  moveDocumentRequirement,
  removeDocumentRequirement,
  updateDocumentRequirement,
} from '@/features/dashboard/org/lib/propertyDocumentRequirements';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

function OrderBadge({ index }: { index: number }) {
  return (
    <span
      className="text-muted-foreground bg-background mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      aria-hidden
    >
      {index + 1}
    </span>
  );
}

function RowActionButton({
  label,
  disabled,
  variant = 'default',
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function DocumentRequirementEditRow({
  requirement,
  index,
  total,
  disabled,
  labelError,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  requirement: DocumentRequirement;
  index: number;
  total: number;
  disabled?: boolean;
  labelError?: string | null;
  onChange: (patch: Partial<DocumentRequirement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const rowId = `document-requirement-${index}`;
  const pdfTemplateValue = isRequestPdfTemplateId(requirement.pdfTemplateId)
    ? requirement.pdfTemplateId
    : DOCUMENT_PDF_TEMPLATE_NONE;

  return (
    <div className="border-border/40 bg-muted/15 space-y-3 rounded-lg border px-3 py-3">
      <div className="flex items-start gap-2">
        <OrderBadge index={index} />
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${rowId}-label`} className="sr-only">
            Document label
          </Label>
          <Input
            id={`${rowId}-label`}
            value={requirement.label}
            disabled={disabled}
            placeholder="e.g. GAF Approval"
            onChange={(event) => onChange({ label: event.target.value })}
            className={cn('h-10', labelError && 'border-destructive')}
            aria-invalid={Boolean(labelError)}
            aria-describedby={labelError ? `${rowId}-label-error` : undefined}
          />
          {labelError ? (
            <p id={`${rowId}-label-error`} className="text-destructive mt-1.5 text-xs">
              {labelError}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <RowActionButton label="Move up" disabled={disabled || index === 0} onClick={onMoveUp}>
            <ChevronUp className="size-4" aria-hidden />
          </RowActionButton>
          <RowActionButton
            label="Move down"
            disabled={disabled || index === total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-4" aria-hidden />
          </RowActionButton>
          <RowActionButton
            label="Remove document"
            variant="destructive"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </RowActionButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${rowId}-trigger`} className="text-muted-foreground text-xs">
            Trigger
          </Label>
          <Select
            value={requirement.triggerCondition}
            onValueChange={(value) =>
              onChange({ triggerCondition: value as DocumentTriggerCondition })
            }
            disabled={disabled}
          >
            <SelectTrigger id={`${rowId}-trigger`} className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TRIGGER_CONDITIONS.map((condition) => (
                <SelectItem key={condition} value={condition}>
                  {DOCUMENT_TRIGGER_CONDITION_LABELS[condition]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${rowId}-approval`} className="text-muted-foreground text-xs">
            Approval source
          </Label>
          <Select
            value={requirement.approvalSource}
            onValueChange={(value) => onChange({ approvalSource: value as DocumentApprovalSource })}
            disabled={disabled}
          >
            <SelectTrigger id={`${rowId}-approval`} className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_APPROVAL_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {DOCUMENT_APPROVAL_SOURCE_LABELS[source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${rowId}-pdf-template`} className="text-muted-foreground text-xs">
            PDF template
          </Label>
          <Select
            value={pdfTemplateValue}
            onValueChange={(value) =>
              onChange({
                pdfTemplateId: value === DOCUMENT_PDF_TEMPLATE_NONE ? null : value,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id={`${rowId}-pdf-template`} className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DOCUMENT_PDF_TEMPLATE_NONE}>None</SelectItem>
              {DOCUMENT_PDF_TEMPLATES.map((template) => (
                <SelectItem key={template} value={template}>
                  {DOCUMENT_PDF_TEMPLATE_LABELS[template]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

type Props = {
  list: DocumentRequirement[];
  disabled?: boolean;
  resolveFieldError?: (fieldId: string) => string | null;
  markFieldInteracted?: (fieldId: string) => void;
  onChange: (next: DocumentRequirement[]) => void;
};

export function DocumentRequirementsListEditor({
  list,
  disabled = false,
  resolveFieldError,
  markFieldInteracted,
  onChange,
}: Props) {
  const fieldError = resolveFieldError ?? (() => null);

  return (
    <div className="space-y-2">
      {list.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-sm">
          No documents required — bookings skip straight to Ready for check-in.
        </p>
      ) : (
        list.map((requirement, index) => (
          <DocumentRequirementEditRow
            key={requirement.id}
            requirement={requirement}
            index={index}
            total={list.length}
            disabled={disabled}
            labelError={fieldError(`document-requirement-${index}-label`)}
            onChange={(patch) => {
              markFieldInteracted?.(`document-requirement-${index}-label`);
              onChange(updateDocumentRequirement(list, index, patch));
            }}
            onMoveUp={() => onChange(moveDocumentRequirement(list, index, -1))}
            onMoveDown={() => onChange(moveDocumentRequirement(list, index, 1))}
            onRemove={() => onChange(removeDocumentRequirement(list, index))}
          />
        ))
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(addDocumentRequirement(list))}
        className="border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden />
        Add document
      </button>
    </div>
  );
}
