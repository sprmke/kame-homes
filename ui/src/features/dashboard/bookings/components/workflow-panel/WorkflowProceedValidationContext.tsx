/**
 * Forms in the workflow rail register a validate() callback. Proceed / Mark
 * complete stays enabled; click runs the active validators so required field
 * errors appear (money, checkbox, upload, etc.) instead of a disabled CTA + tooltip.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import { requiredSubForm, type SubFormKind } from '@/features/dashboard/bookings/lib/workflow';

export type WorkflowProceedValidator = () => boolean | Promise<boolean>;

export type WorkflowProceedValidatorId =
  'pricing' | 'surprise_decor' | 'parking' | 'guest_balance' | 'sd_refund';

type Ctx = {
  registerValidator: (
    id: WorkflowProceedValidatorId,
    validate: WorkflowProceedValidator
  ) => () => void;
  /** Run validators for the sub-form required by `from → to`. */
  validateForTransition: (from: BookingStatus, to: BookingStatus) => Promise<boolean>;
  /** Run a single registered validator (e.g. parking Mark complete). */
  validateById: (id: WorkflowProceedValidatorId) => Promise<boolean>;
};

const WorkflowProceedValidationContext = createContext<Ctx | null>(null);

const SUB_FORM_VALIDATORS: Record<Exclude<SubFormKind, null>, WorkflowProceedValidatorId[]> = {
  pricing: ['pricing', 'surprise_decor'],
  parking: ['parking'],
  guest_balance: ['guest_balance'],
  sd_refund: ['sd_refund'],
};

export function WorkflowProceedValidationProvider({ children }: { children: ReactNode }) {
  const validatorsRef = useRef(new Map<WorkflowProceedValidatorId, WorkflowProceedValidator>());

  const registerValidator = useCallback(
    (id: WorkflowProceedValidatorId, validate: WorkflowProceedValidator) => {
      validatorsRef.current.set(id, validate);
      return () => {
        if (validatorsRef.current.get(id) === validate) {
          validatorsRef.current.delete(id);
        }
      };
    },
    []
  );

  const runIds = useCallback(async (ids: WorkflowProceedValidatorId[]): Promise<boolean> => {
    let allOk = true;
    for (const id of ids) {
      const validate = validatorsRef.current.get(id);
      if (!validate) continue;
      const ok = await validate();
      if (!ok) allOk = false;
    }
    return allOk;
  }, []);

  const validateForTransition = useCallback(
    async (from: BookingStatus, to: BookingStatus): Promise<boolean> => {
      const subForm = requiredSubForm(from, to);
      if (!subForm) return true;
      return runIds(SUB_FORM_VALIDATORS[subForm]);
    },
    [runIds]
  );

  const validateById = useCallback(
    async (id: WorkflowProceedValidatorId): Promise<boolean> => runIds([id]),
    [runIds]
  );

  const value = useMemo(
    () => ({ registerValidator, validateForTransition, validateById }),
    [registerValidator, validateForTransition, validateById]
  );

  return (
    <WorkflowProceedValidationContext.Provider value={value}>
      {children}
    </WorkflowProceedValidationContext.Provider>
  );
}

export function useWorkflowProceedValidation(): Ctx {
  const ctx = useContext(WorkflowProceedValidationContext);
  if (!ctx) {
    throw new Error(
      'useWorkflowProceedValidation must be used within WorkflowProceedValidationProvider'
    );
  }
  return ctx;
}

/** Optional — forms may render outside the workflow rail (e.g. edit tabs). */
export function useOptionalWorkflowProceedValidation(): Ctx | null {
  return useContext(WorkflowProceedValidationContext);
}

export function useRegisterWorkflowProceedValidator(
  id: WorkflowProceedValidatorId,
  validate: WorkflowProceedValidator,
  enabled = true
) {
  const ctx = useOptionalWorkflowProceedValidation();
  const validateRef = useRef(validate);
  validateRef.current = validate;

  const stableValidate = useCallback<WorkflowProceedValidator>(() => validateRef.current(), []);

  useEffect(() => {
    if (!ctx || !enabled) return;
    return ctx.registerValidator(id, stableValidate);
  }, [ctx, enabled, id, stableValidate]);
}

/** Focus the first invalid control after a failed proceed attempt. */
export function focusFirstWorkflowFieldError(root?: HTMLElement | null) {
  const scope = root ?? document;
  const el = scope.querySelector<HTMLElement>(
    '[aria-invalid="true"], [data-workflow-field-error="true"]'
  );
  el?.focus?.();
  el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}
