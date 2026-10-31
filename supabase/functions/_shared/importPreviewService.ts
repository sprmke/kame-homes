/**
 * Import preview — map raw CSV rows + validate against importTargetSchemas.
 */

import { normalizeImportBoolean, normalizeImportFieldValue } from './importNormalization.ts';
import {
  BOOKING_IMPORT_TARGET_FIELDS,
  getBookingImportTargetField,
  type ImportTargetFieldType,
} from './importTargetSchemas.ts';

export type ImportValidationError = {
  field?: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  /** Source cell value that failed validation (pre-normalization when available). */
  value?: string | null;
};

export type ImportColumnMappingEntry = {
  rawHeader: string;
  suggestedTarget: string | null;
  status: string;
};

export type ImportRowPreviewInput = {
  id: string;
  row_index: number;
  raw_data: Record<string, string>;
  validation_status: string;
};

export type ImportRowPreviewOutput = {
  id: string;
  row_index: number;
  mapped_data: Record<string, string | null>;
  resolved_property_id: string;
  validation_status: 'valid' | 'error' | 'skipped';
  validation_errors: ImportValidationError[];
};

export type ImportPreviewSummary = {
  total: number;
  valid: number;
  error: number;
  skipped: number;
  warning: number;
};

type MappedRowData = {
  mappedData: Record<string, string | null>;
  /** Trimmed source string per target field id (empty string when cell was blank). */
  sourceByField: Record<string, string>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseColumnMappingEntries(columnMapping: unknown): ImportColumnMappingEntry[] {
  if (!columnMapping || typeof columnMapping !== 'object') return [];
  const mappings = (columnMapping as { mappings?: unknown }).mappings;
  if (!Array.isArray(mappings)) return [];
  return mappings
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as Record<string, unknown>;
      return {
        rawHeader: String(raw.rawHeader ?? ''),
        suggestedTarget:
          raw.suggestedTarget === null || typeof raw.suggestedTarget === 'string'
            ? raw.suggestedTarget
            : null,
        status: String(raw.status ?? ''),
      };
    })
    .filter((entry): entry is ImportColumnMappingEntry => Boolean(entry?.rawHeader));
}

export function buildHeaderToTargetMap(columnMapping: unknown): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of parseColumnMappingEntries(columnMapping)) {
    if (entry.suggestedTarget && entry.status !== 'skipped') {
      map.set(entry.rawHeader, entry.suggestedTarget);
    }
  }
  return map;
}

/** Reverse map: target field id → CSV header (first mapping wins). */
export function buildTargetToHeaderMap(columnMapping: unknown): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of parseColumnMappingEntries(columnMapping)) {
    if (entry.suggestedTarget && entry.status !== 'skipped' && !map.has(entry.suggestedTarget)) {
      map.set(entry.suggestedTarget, entry.rawHeader);
    }
  }
  return map;
}

export function applyImportColumnMapping(
  rawData: Record<string, string>,
  headerToTarget: Map<string, string>
): Record<string, string | null> {
  return mapImportRowData(rawData, headerToTarget).mappedData;
}

function mapImportRowData(
  rawData: Record<string, string>,
  headerToTarget: Map<string, string>
): MappedRowData {
  const mappedData: Record<string, string | null> = {};
  const sourceByField: Record<string, string> = {};

  for (const [header, targetFieldId] of headerToTarget) {
    const source = String(rawData[header] ?? '').trim();
    sourceByField[targetFieldId] = source;
    mappedData[targetFieldId] = normalizeImportFieldValue(targetFieldId, source || null);
  }

  return { mappedData, sourceByField };
}

/** Write corrected target-field values back into raw_data via column mapping. */
export function applyFieldValuePatches(
  rawData: Record<string, string>,
  targetToHeader: Map<string, string>,
  fieldValues: Record<string, string>
): Record<string, string> {
  const next = { ...rawData };
  for (const [fieldId, value] of Object.entries(fieldValues)) {
    const header = targetToHeader.get(fieldId);
    if (header) next[header] = value;
  }
  return next;
}

function normalizeComparableUnit(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function booleanFieldLabel(fieldId: string): string {
  return getBookingImportTargetField(fieldId)?.description ?? fieldId.replace(/_/g, ' ');
}

function invalidFormatMessage(fieldType: ImportTargetFieldType, fieldId: string): string {
  switch (fieldType) {
    case 'email':
      return 'Invalid email address';
    case 'phone':
      return 'Phone number has no digits';
    case 'date':
      return 'Unrecognized date format';
    case 'integer':
      return 'Expected a whole number';
    case 'decimal':
      return 'Expected a number';
    case 'boolean':
      return `${booleanFieldLabel(fieldId)} must be yes, no, true, or false in your file`;
    default:
      return 'Invalid value';
  }
}

/** Non-empty source that failed normalization → typed error instead of silent null. */
function validateNormalizationFailures(
  mappedData: Record<string, string | null>,
  sourceByField: Record<string, string>
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  for (const [fieldId, source] of Object.entries(sourceByField)) {
    if (!source) continue;
    const field = getBookingImportTargetField(fieldId);
    if (!field) continue;

    const normalized = mappedData[fieldId];
    if (normalized !== null && normalized !== '') continue;

    if (field.type === 'boolean' && normalizeImportBoolean(source) === null) {
      errors.push({
        field: fieldId,
        code: 'invalid_boolean',
        message: invalidFormatMessage('boolean', fieldId),
        severity: 'error',
        value: source,
      });
      continue;
    }

    if (field.type === 'date') {
      errors.push({
        field: fieldId,
        code: 'invalid_date',
        message: invalidFormatMessage('date', fieldId),
        severity: 'error',
        value: source,
      });
    }
  }

  return errors;
}

function validateFieldType(
  fieldId: string,
  fieldType: ImportTargetFieldType,
  value: string | null,
  sourceValue?: string
): ImportValidationError | null {
  if (value === null || value === '') return null;

  const displayValue = sourceValue && sourceValue !== value ? sourceValue : value;

  switch (fieldType) {
    case 'email':
      if (!EMAIL_RE.test(value)) {
        return {
          field: fieldId,
          code: 'invalid_email',
          message: 'Invalid email address',
          severity: 'error',
          value: displayValue,
        };
      }
      return null;
    case 'phone':
      if (!/\d/.test(value)) {
        return {
          field: fieldId,
          code: 'invalid_phone',
          message: 'Phone number has no digits',
          severity: 'error',
          value: displayValue,
        };
      }
      return null;
    case 'date': {
      const normalized = normalizeImportFieldValue(fieldId, value);
      if (!normalized) {
        return {
          field: fieldId,
          code: 'invalid_date',
          message: 'Unrecognized date format',
          severity: 'error',
          value: displayValue,
        };
      }
      return null;
    }
    case 'integer': {
      const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
      if (!Number.isFinite(parsed)) {
        return {
          field: fieldId,
          code: 'invalid_integer',
          message: 'Expected a whole number',
          severity: 'error',
          value: displayValue,
        };
      }
      return null;
    }
    case 'decimal': {
      const parsed = Number.parseFloat(value.replace(/,/g, ''));
      if (!Number.isFinite(parsed)) {
        return {
          field: fieldId,
          code: 'invalid_decimal',
          message: 'Expected a number',
          severity: 'error',
          value: displayValue,
        };
      }
      return null;
    }
    case 'boolean': {
      if (normalizeImportBoolean(value) === null) {
        return {
          field: fieldId,
          code: 'invalid_boolean',
          message: invalidFormatMessage('boolean', fieldId),
          severity: 'error',
          value: displayValue,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

function validateRequiredFields(
  mappedData: Record<string, string | null>,
  sourceByField: Record<string, string>,
  fieldsWithErrors: Set<string>
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  for (const field of BOOKING_IMPORT_TARGET_FIELDS) {
    if (!field.required) continue;
    if (fieldsWithErrors.has(field.id)) continue;

    const value = mappedData[field.id];
    if (value === null || value === '') {
      const source = sourceByField[field.id] ?? '';
      errors.push({
        field: field.id,
        code: 'required',
        message: 'Required field is missing',
        severity: 'error',
        value: source || null,
      });
    }
  }
  return errors;
}

function validateFieldTypes(
  mappedData: Record<string, string | null>,
  sourceByField: Record<string, string>,
  fieldsWithErrors: Set<string>
): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  for (const [fieldId, value] of Object.entries(mappedData)) {
    if (fieldsWithErrors.has(fieldId)) continue;
    const field = getBookingImportTargetField(fieldId);
    if (!field || value === null || value === '') continue;
    const typeError = validateFieldType(fieldId, field.type, value, sourceByField[fieldId]);
    if (typeError) errors.push(typeError);
  }
  return errors;
}

function validateDateOrder(
  mappedData: Record<string, string | null>,
  sourceByField: Record<string, string>
): ImportValidationError | null {
  const checkIn = mappedData.check_in_date;
  const checkOut = mappedData.check_out_date;
  if (!checkIn || !checkOut) return null;

  const inNorm = normalizeImportFieldValue('check_in_date', checkIn);
  const outNorm = normalizeImportFieldValue('check_out_date', checkOut);
  if (!inNorm || !outNorm) return null;

  const inParts = inNorm.split('-').map(Number);
  const outParts = outNorm.split('-').map(Number);
  if (inParts.length !== 3 || outParts.length !== 3) return null;

  const inDate = new Date(inParts[2], inParts[0] - 1, inParts[1]);
  const outDate = new Date(outParts[2], outParts[0] - 1, outParts[1]);
  if (outDate <= inDate) {
    return {
      field: 'check_out_date',
      code: 'date_order',
      message: 'Check-out must be after check-in',
      severity: 'error',
      value: sourceByField.check_out_date || checkOut,
    };
  }
  return null;
}

function validateUnitMismatch(
  mappedData: Record<string, string | null>,
  propertyTowerAndUnit: string | null,
  propertyName: string | null
): ImportValidationError | null {
  const rowUnit = mappedData.tower_and_unit_number;
  if (!rowUnit) return null;

  const rowNorm = normalizeComparableUnit(rowUnit);
  if (!rowNorm) return null;

  const candidates = [propertyTowerAndUnit, propertyName]
    .map((value) => normalizeComparableUnit(value))
    .filter(Boolean);

  if (candidates.length === 0) return null;

  const matches = candidates.some(
    (candidate) => rowNorm.includes(candidate) || candidate.includes(rowNorm)
  );

  if (matches) return null;

  const label = propertyTowerAndUnit || propertyName || 'this property';
  return {
    field: 'tower_and_unit_number',
    code: 'unit_mismatch',
    message: `Row mentions "${rowUnit}" but import target is ${label}`,
    severity: 'warning',
    value: rowUnit,
  };
}

export function previewImportRow(
  row: ImportRowPreviewInput,
  headerToTarget: Map<string, string>,
  propertyId: string,
  propertyTowerAndUnit: string | null,
  propertyName: string | null,
  preserveSkipped: boolean
): ImportRowPreviewOutput {
  if (preserveSkipped && row.validation_status === 'skipped') {
    return {
      id: row.id,
      row_index: row.row_index,
      mapped_data: applyImportColumnMapping(row.raw_data, headerToTarget),
      resolved_property_id: propertyId,
      validation_status: 'skipped',
      validation_errors: [],
    };
  }

  const { mappedData, sourceByField } = mapImportRowData(row.raw_data, headerToTarget);

  const normalizationErrors = validateNormalizationFailures(mappedData, sourceByField);
  const fieldsWithErrors = new Set(
    normalizationErrors.map((entry) => entry.field).filter(Boolean) as string[]
  );

  const validationErrors: ImportValidationError[] = [
    ...normalizationErrors,
    ...validateRequiredFields(mappedData, sourceByField, fieldsWithErrors),
    ...validateFieldTypes(mappedData, sourceByField, fieldsWithErrors),
  ];

  for (const entry of validationErrors) {
    if (entry.field) fieldsWithErrors.add(entry.field);
  }

  const dateOrderError = validateDateOrder(mappedData, sourceByField);
  if (dateOrderError && !fieldsWithErrors.has('check_out_date')) {
    validationErrors.push(dateOrderError);
  }

  const unitWarning = validateUnitMismatch(mappedData, propertyTowerAndUnit, propertyName);
  if (unitWarning) validationErrors.push(unitWarning);

  const hasBlockingError = validationErrors.some((entry) => entry.severity === 'error');

  return {
    id: row.id,
    row_index: row.row_index,
    mapped_data: mappedData,
    resolved_property_id: propertyId,
    validation_status: hasBlockingError ? 'error' : 'valid',
    validation_errors: validationErrors,
  };
}

export function summarizeImportPreview(rows: ImportRowPreviewOutput[]): ImportPreviewSummary {
  let valid = 0;
  let error = 0;
  let skipped = 0;
  let warning = 0;

  for (const row of rows) {
    if (row.validation_status === 'valid') valid += 1;
    else if (row.validation_status === 'error') error += 1;
    else if (row.validation_status === 'skipped') skipped += 1;

    if (row.validation_errors.some((entry) => entry.severity === 'warning')) {
      warning += 1;
    }
  }

  return {
    total: rows.length,
    valid,
    error,
    skipped,
    warning,
  };
}
